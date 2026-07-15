"""Procurement engine + Purchase Orders."""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin
from models import PurchaseOrderIn, POStatusUpdate

router = APIRouter(tags=["procurement"])


@router.get("/procurement/recommendations")
async def procurement_recommendations(admin: dict = Depends(get_current_user)):
    """Compute deficit = safety_stock + pending_demand - available for each product across warehouses."""
    if admin["role"] not in ("admin", "mnp"):
        raise HTTPException(403, "Forbidden")
    # Sum available and reserved per product across all warehouses
    inv_docs = await db.inventory.find({}).to_list(10000)
    prods = {str(p["_id"]): p for p in await db.products.find({}).to_list(2000)}
    agg = {}
    for i in inv_docs:
        pid = i["product_id"]
        agg.setdefault(pid, {"quantity": 0, "reserved": 0})
        agg[pid]["quantity"] += i.get("quantity", 0)
        agg[pid]["reserved"] += i.get("reserved", 0)

    # Pending demand from pending orders
    pending_orders = await db.orders.find({"status": {"$in": ["pending", "approved"]}}).to_list(1000)
    demand = {}
    for o in pending_orders:
        for item in o.get("items", []):
            demand[item["product_id"]] = demand.get(item["product_id"], 0) + item["quantity"]

    recs = []
    for pid, p in prods.items():
        available = agg.get(pid, {}).get("quantity", 0) - agg.get(pid, {}).get("reserved", 0)
        safety = p.get("safety_stock", 0)
        pending = demand.get(pid, 0)
        required = safety + pending
        deficit = max(0, required - available)
        if deficit > 0 or available < safety:
            recs.append({
                "product_id": pid,
                "product_name": p["name"],
                "sku": p["sku"],
                "category": p["category"],
                "available": available,
                "safety_stock": safety,
                "pending_demand": pending,
                "recommended_qty": max(deficit, p.get("moq", 1)),
                "moq": p.get("moq", 1),
                "lead_time_days": p.get("lead_time_days", 7),
                "supplier_id": p.get("primary_supplier_id"),
                "cost": p.get("cost", 0),
                "urgency": "critical" if available < safety * 0.5 else ("high" if available < safety else "medium"),
            })
    # Enrich supplier name
    sup_ids = [ObjectId(r["supplier_id"]) for r in recs if r.get("supplier_id")]
    suppliers = {str(s["_id"]): s for s in await db.users.find({"_id": {"$in": sup_ids}}).to_list(200)}
    for r in recs:
        s = suppliers.get(r.get("supplier_id"))
        r["supplier_name"] = s.get("company") or s.get("name") if s else "—"
    recs.sort(key=lambda x: (["critical", "high", "medium"].index(x["urgency"]), -x["recommended_qty"]))
    return recs


async def _po_number() -> str:
    count = await db.purchase_orders.count_documents({})
    return f"PO-2026{(count + 1):04d}"


@router.get("/purchase-orders")
async def list_purchase_orders(status: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "supplier":
        query["supplier_id"] = user["id"]
    if status:
        query["status"] = status
    docs = await db.purchase_orders.find(query).sort("created_at", -1).to_list(1000)
    return serialize_docs(docs)


@router.get("/purchase-orders/{po_id}")
async def get_po(po_id: str, user: dict = Depends(get_current_user)):
    doc = await db.purchase_orders.find_one({"_id": ObjectId(po_id)})
    if not doc:
        raise HTTPException(404, "Not found")
    if user["role"] == "supplier" and str(doc.get("supplier_id")) != user["id"]:
        raise HTTPException(403, "Forbidden")
    return serialize_doc(doc)


@router.post("/purchase-orders")
async def create_po(payload: PurchaseOrderIn, admin: dict = Depends(require_admin)):
    prod_ids = [ObjectId(i.product_id) for i in payload.items]
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(500)}
    items_out = []
    total = 0
    for i in payload.items:
        p = products.get(i.product_id)
        if not p:
            raise HTTPException(400, f"Product {i.product_id} not found")
        amount = i.quantity * i.rate
        items_out.append({"product_id": i.product_id, "product_name": p["name"],
                          "sku": p["sku"], "quantity": i.quantity, "rate": i.rate, "amount": amount})
        total += amount

    supplier = await db.users.find_one({"_id": ObjectId(payload.supplier_id)})
    if not supplier:
        raise HTTPException(400, "Supplier not found")
    po_no = await _po_number()
    doc = {
        "po_no": po_no,
        "supplier_id": payload.supplier_id,
        "supplier_name": supplier.get("company") or supplier.get("name"),
        "warehouse_id": payload.warehouse_id,
        "items": items_out,
        "subtotal": total,
        "gst": round(total * 0.18, 2),
        "total": round(total * 1.18, 2),
        "status": "draft",
        "expected_delivery": payload.expected_delivery or "",
        "notes": payload.notes or "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.purchase_orders.insert_one(doc)
    doc["_id"] = res.inserted_id

    await db.notifications.insert_one({
        "user_id": payload.supplier_id, "title": f"New Purchase Order {po_no}",
        "body": f"₹{doc['total']:.0f} — {len(items_out)} items",
        "kind": "info", "read": False, "created_at": now_iso(),
    })
    await db.audit_logs.insert_one({
        "actor_id": admin["id"], "actor_email": admin["email"],
        "action": "po.create", "target": po_no, "meta": {"total": doc["total"]},
        "created_at": now_iso(),
    })
    return serialize_doc(doc)


@router.patch("/purchase-orders/{po_id}/status")
async def update_po_status(po_id: str, payload: POStatusUpdate,
                            user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "supplier"):
        raise HTTPException(403, "Forbidden")
    doc = await db.purchase_orders.find_one({"_id": ObjectId(po_id)})
    if not doc:
        raise HTTPException(404, "Not found")

    # On received, add to inventory
    if payload.status == "received" and doc["status"] != "received":
        for item in doc.get("items", []):
            await db.inventory.update_one(
                {"warehouse_id": doc["warehouse_id"], "product_id": item["product_id"]},
                {"$inc": {"quantity": item["quantity"]}, "$set": {"updated_at": now_iso()}},
                upsert=True,
            )

    await db.purchase_orders.update_one({"_id": ObjectId(po_id)},
                                         {"$set": {"status": payload.status, "updated_at": now_iso()}})
    await db.audit_logs.insert_one({
        "actor_id": user["id"], "actor_email": user["email"],
        "action": "po.status", "target": doc["po_no"],
        "meta": {"from": doc["status"], "to": payload.status}, "created_at": now_iso(),
    })
    doc["status"] = payload.status
    return serialize_doc(doc)
