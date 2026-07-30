"""Orders + Invoices."""
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin
from models import OrderIn, OrderStatusUpdate

router = APIRouter(tags=["orders"])


async def _order_number() -> str:
    count = await db.orders.count_documents({})
    return f"ORD-2026{(count + 1):04d}"


async def _enrich_orders(docs: list) -> list:
    out = serialize_docs(docs)
    if not out:
        return out
    dealer_ids = {d["dealer_id"] for d in out if d.get("dealer_id") and ObjectId.is_valid(d["dealer_id"])}
    if not dealer_ids:
        return out
    dealers = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": [ObjectId(x) for x in dealer_ids]}}).to_list(1000)}
    mnp_ids = {u.get("mnp_id") for u in dealers.values() if u.get("mnp_id") and ObjectId.is_valid(u.get("mnp_id"))}
    mnps = {str(m["_id"]): m for m in await db.users.find({"_id": {"$in": [ObjectId(x) for x in mnp_ids]}}).to_list(1000)} if mnp_ids else {}

    for d in out:
        dlr = dealers.get(d.get("dealer_id"))
        if dlr:
            if not d.get("dealer_code"):
                d["dealer_code"] = dlr.get("user_code") or dlr.get("login_id") or "D-ASSIGNED"
            if not d.get("dealer_name"):
                d["dealer_name"] = dlr.get("company") or dlr.get("name")
            m_id = str(dlr.get("mnp_id") or "")
            if m_id and m_id in mnps:
                d["mnp_code"] = mnps[m_id].get("user_code") or mnps[m_id].get("login_id") or "M-ASSIGNED"
                d["mnp_name"] = mnps[m_id].get("name") or "Regional MNP"
            else:
                d["mnp_code"] = "DIRECT"
                d["mnp_name"] = "Direct (Yamini Flow HQ)"
        else:
            d["dealer_code"] = d.get("dealer_code") or "D-UNKNOWN"
            d["mnp_code"] = d.get("mnp_code") or "DIRECT"
            d["mnp_name"] = d.get("mnp_name") or "Direct (HQ)"
    return out


@router.get("/orders")
async def list_orders(status: str = "", dealer_id: str = "",
                       user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "dealer":
        query["dealer_id"] = user["id"]
    elif user["role"] == "mnp":
        dealers = await db.users.find({"role": "dealer", "mnp_id": user["id"]}).to_list(500)
        query["dealer_id"] = {"$in": [str(d["_id"]) for d in dealers]}
    if status:
        query["status"] = status
    if dealer_id and user["role"] in ("admin", "mnp"):
        query["dealer_id"] = dealer_id
    docs = await db.orders.find(query).sort("created_at", -1).to_list(1000)
    return await _enrich_orders(docs)


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Not found")
    if user["role"] == "dealer" and doc["dealer_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "mnp":
        dlr = await db.users.find_one({"_id": ObjectId(doc["dealer_id"]), "mnp_id": user["id"]})
        if not dlr:
            raise HTTPException(403, "Forbidden")
    enriched = await _enrich_orders([doc])
    return enriched[0]


@router.post("/orders")
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ("dealer", "mnp", "admin"):
        raise HTTPException(403, "Only dealers, MNPs, or admins can place orders")
    dealer_id = user["id"]
    if user["role"] in ("mnp", "admin") and payload.dealer_id:
        dealer_id = payload.dealer_id
    elif user["role"] == "mnp":
        # Default to first dealer assigned to this MNP if none provided
        dlr = await db.users.find_one({"role": "dealer", "mnp_id": user["id"]})
        if dlr:
            dealer_id = str(dlr["_id"])

    # Load products
    prod_ids = [ObjectId(i.product_id) for i in payload.items]
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(500)}

    items_out = []
    subtotal = 0
    for i in payload.items:
        p = products.get(i.product_id)
        if not p:
            raise HTTPException(400, f"Product {i.product_id} not found")
        # Use exact value_before_tax if computed, otherwise price * quantity
        sub = i.value_before_tax if (i.value_before_tax and i.value_before_tax > 0) else (p["price"] * i.quantity)
        items_out.append({
            "product_id": i.product_id, "product_name": p["name"],
            "sku": p["sku"], "quantity": i.quantity,
            "price": i.rate or p["price"], "subtotal": sub,
            "size": i.size or p.get("size", ""),
            "boxes": i.boxes or 1,
            "qty_per_box": i.qty_per_box or p.get("qty_per_box", 1000),
            "wt_1000_pcs_kg": i.wt_1000_pcs_kg or p.get("wt_1000_pcs_kg", 0.0),
            "total_weight_kg": i.total_weight_kg or round((i.quantity / 1000.0) * (p.get("wt_1000_pcs_kg", 0.0)), 3),
            "rate": i.rate or p.get("price", 0.0),
            "dealer_landing": i.dealer_landing or p.get("dealer_landing", 0.0),
            "value_before_tax": sub,
            "gst_amount": i.gst_amount if (i.gst_amount and i.gst_amount > 0) else round(sub * 0.18, 2),
            "value_after_tax": i.value_after_tax if (i.value_after_tax and i.value_after_tax > 0) else round(sub * 1.18, 2),
        })
        subtotal += sub

    # Try to reserve inventory (use first warehouse with stock if not specified)
    warehouses = await db.warehouses.find({}).to_list(50)
    wh_id = payload.warehouse_id or (str(warehouses[0]["_id"]) if warehouses else None)

    reservation_status = "reserved"
    deficits = []
    for i in payload.items:
        inv = await db.inventory.find_one({"warehouse_id": wh_id, "product_id": i.product_id})
        avail = (inv.get("quantity", 0) - inv.get("reserved", 0)) if inv else 0
        if avail < i.quantity:
            reservation_status = "pending"
            deficits.append({"product_id": i.product_id, "product_name": products[i.product_id]["name"],
                             "required": i.quantity, "available": avail, "deficit": i.quantity - avail})
        else:
            await db.inventory.update_one(
                {"warehouse_id": wh_id, "product_id": i.product_id},
                {"$inc": {"reserved": i.quantity}, "$set": {"updated_at": now_iso()}},
            )

    dealer = await db.users.find_one({"_id": ObjectId(dealer_id)})
    order_no = await _order_number()
    dealer_code = dealer.get("user_code") or dealer.get("login_id") or "D-ASSIGNED"
    mnp_id_val = dealer.get("mnp_id")
    mnp_code = "DIRECT"
    mnp_name = "Direct (Yamini Flow HQ)"
    if mnp_id_val and str(mnp_id_val).strip().lower() not in ["", "direct", "none", "null"]:
        try:
            mnp_doc = await db.users.find_one({"_id": ObjectId(mnp_id_val), "role": "mnp"})
            if mnp_doc:
                mnp_code = mnp_doc.get("user_code") or mnp_doc.get("login_id") or "M-ASSIGNED"
                mnp_name = mnp_doc.get("name") or "Regional MNP"
        except Exception:
            pass

    doc = {
        "order_no": order_no,
        "dealer_id": dealer_id,
        "dealer_code": dealer_code,
        "dealer_name": dealer.get("company") or dealer.get("name"),
        "dealer_state": dealer.get("state", ""),
        "mnp_id": str(mnp_id_val) if (mnp_id_val and str(mnp_id_val).strip().lower() not in ["", "direct", "none", "null"]) else None,
        "mnp_code": mnp_code,
        "mnp_name": mnp_name,
        "warehouse_id": wh_id,
        "items": items_out,
        "subtotal": subtotal,
        "gst": round(subtotal * 0.18, 2),
        "total": round(subtotal * 1.18, 2),
        "status": "approved" if reservation_status == "reserved" else "pending",
        "reservation_status": reservation_status,
        "payment_status": "unpaid",
        "deficits": deficits,
        "notes": payload.notes or "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.orders.insert_one(doc)
    doc["_id"] = res.inserted_id

    # Notify admin + dealer
    await db.notifications.insert_many([
        {"role": "admin", "title": f"New Order {order_no}",
         "body": f"{doc['dealer_name']} placed order ₹{doc['total']:.0f}",
         "kind": "info", "read": False, "created_at": now_iso()},
        {"user_id": dealer_id, "title": f"Order {order_no} placed",
         "body": f"Status: {doc['status']}. Total ₹{doc['total']:.0f}",
         "kind": "success", "read": False, "created_at": now_iso()},
    ])

    # Audit
    await db.audit_logs.insert_one({
        "actor_id": user["id"], "actor_email": user["email"],
        "action": "order.create", "target": order_no,
        "meta": {"total": doc["total"], "status": doc["status"]},
        "created_at": now_iso(),
    })

    return serialize_doc(doc)


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusUpdate,
                               user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "mnp"):
        raise HTTPException(403, "Forbidden")
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Not found")
    old_status = doc["status"]
    new_status = payload.status

    # On delivered, decrement inventory + reserved
    if new_status == "delivered" and old_status != "delivered":
        for item in doc.get("items", []):
            await db.inventory.update_one(
                {"warehouse_id": doc.get("warehouse_id"), "product_id": item["product_id"]},
                {"$inc": {"quantity": -item["quantity"], "reserved": -item["quantity"]},
                 "$set": {"updated_at": now_iso()}},
            )
    if new_status == "cancelled" and old_status != "cancelled":
        for item in doc.get("items", []):
            await db.inventory.update_one(
                {"warehouse_id": doc.get("warehouse_id"), "product_id": item["product_id"]},
                {"$inc": {"reserved": -item["quantity"]}, "$set": {"updated_at": now_iso()}},
            )

    await db.orders.update_one({"_id": ObjectId(order_id)},
                                {"$set": {"status": new_status, "updated_at": now_iso()}})
    await db.audit_logs.insert_one({
        "actor_id": user["id"], "actor_email": user["email"],
        "action": "order.status", "target": doc["order_no"],
        "meta": {"from": old_status, "to": new_status}, "created_at": now_iso(),
    })
    doc["status"] = new_status
    return serialize_doc(doc)


@router.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user)):
    query = {"status": {"$in": ["approved", "shipped", "delivered"]}}
    if user["role"] == "dealer":
        query["dealer_id"] = user["id"]
    docs = await db.orders.find(query).sort("created_at", -1).to_list(500)
    out = []
    for d in docs:
        s = serialize_doc(d)
        s["invoice_no"] = "INV-" + s["order_no"].replace("ORD-", "")
        out.append(s)
    return out
