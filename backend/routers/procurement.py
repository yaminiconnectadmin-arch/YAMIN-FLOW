"""Procurement engine + Purchase Orders + Intelligent Order Collation & Weight Matrix."""
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin
from models import PurchaseOrderIn, POStatusUpdate, WeightMatrixItem

router = APIRouter(tags=["procurement"])


class CollateTriggerIn(BaseModel):
    triggered_by: str = "manual"


# ================== TOTAL WEIGHT MATRIX ENDPOINTS ==================
@router.get("/procurement/weight-matrix")
async def list_weight_matrix(category: str = "", q: str = "", user: dict = Depends(get_current_user)):
    """List the Total Weight Matrix items (CSK Chipboard Screws, CSK Drywall Screws, etc.)."""
    query = {}
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"item_code": {"$regex": q, "$options": "i"}},
            {"size": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.weight_matrix.find(query).sort([("category", 1), ("wt_1000_pcs_kg", 1)]).to_list(1000)
    return serialize_docs(docs)


@router.post("/procurement/weight-matrix")
async def upsert_weight_matrix_item(payload: WeightMatrixItem, admin: dict = Depends(require_admin)):
    """Insert or update a Weight Matrix item and sync corresponding product."""
    doc = payload.model_dump()
    doc["updated_at"] = now_iso()
    await db.weight_matrix.update_one(
        {"item_code": payload.item_code},
        {"$set": doc, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    # Also sync/update product if it exists
    await db.products.update_one(
        {"sku": payload.item_code},
        {"$set": {
            "name": f"{payload.category} {payload.size}",
            "category": payload.category,
            "wt_1000_pcs_kg": payload.wt_1000_pcs_kg,
            "weight_kg": round(payload.wt_1000_pcs_kg / 1000.0, 5),
            "size": payload.size,
            "qty_per_box": payload.qty_per_box,
            "price": payload.rate,
            "cost": payload.dealer_landing,
            "dealer_landing": payload.dealer_landing,
            "wd_basic": payload.wd_basic,
            "wd_landing": payload.wd_landing,
            "updated_at": now_iso(),
        }}
    )
    res = await db.weight_matrix.find_one({"item_code": payload.item_code})
    return serialize_doc(res)


# ================== UNCOLLATED ORDERS SUMMARY ==================
@router.get("/procurement/uncollated-summary")
async def get_uncollated_summary(user: dict = Depends(get_current_user)):
    """Analyze pending/approved orders that haven't been collated into weight-based supplier POs."""
    uncollated = await db.orders.find({
        "status": {"$in": ["pending", "approved"]},
        "collated": {"$ne": True}
    }).to_list(2000)

    total_orders = len(uncollated)
    dealer_ids = {o.get("dealer_id") for o in uncollated if o.get("dealer_id") and ObjectId.is_valid(o.get("dealer_id"))}
    dealers = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": [ObjectId(x) for x in dealer_ids]}}).to_list(1000)} if dealer_ids else {}
    mnp_ids = {u.get("mnp_id") for u in dealers.values() if u.get("mnp_id") and ObjectId.is_valid(u.get("mnp_id"))}
    mnps = {str(m["_id"]): m for m in await db.users.find({"_id": {"$in": [ObjectId(x) for x in mnp_ids]}}).to_list(1000)} if mnp_ids else {}

    demanded_pcs_map = {}
    dealer_codes_map = {}
    mnp_codes_map = {}
    for o in uncollated:
        dlr = dealers.get(o.get("dealer_id"))
        d_code = o.get("dealer_code")
        if not d_code and dlr:
            d_code = dlr.get("user_code") or dlr.get("login_id")
        if not d_code:
            d_code = "D-UNKNOWN"

        m_code = o.get("mnp_code")
        if not m_code and dlr:
            mid = str(dlr.get("mnp_id") or "")
            if mid and mid in mnps:
                m_code = mnps[mid].get("user_code") or mnps[mid].get("login_id")
            else:
                m_code = "DIRECT"
        if not m_code:
            m_code = "DIRECT"

        for item in o.get("items", []):
            pid = item["product_id"]
            demanded_pcs_map[pid] = demanded_pcs_map.get(pid, 0) + item.get("quantity", 0)
            if pid not in dealer_codes_map:
                dealer_codes_map[pid] = set()
                mnp_codes_map[pid] = set()
            dealer_codes_map[pid].add(d_code)
            mnp_codes_map[pid].add(m_code)

    # Load products and inventory
    prod_ids = [ObjectId(pid) for pid in demanded_pcs_map.keys() if ObjectId.is_valid(pid)]
    prods = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(1000)}
    inv_docs = await db.inventory.find({}).to_list(5000)
    inv_agg = {}
    for idx in inv_docs:
        pid = idx["product_id"]
        inv_agg[pid] = inv_agg.get(pid, 0) + max(0, idx.get("quantity", 0) - idx.get("reserved", 0))

    # Suppliers map
    supplier_ids = list({p["primary_supplier_id"] for p in prods.values() if p.get("primary_supplier_id")})
    suppliers = {str(s["_id"]): s for s in await db.users.find({"_id": {"$in": [ObjectId(sid) for sid in supplier_ids if ObjectId.is_valid(sid)]}}).to_list(200)}

    items_breakdown = []
    total_pcs = 0
    total_kg = 0.0

    for pid, dem_qty in demanded_pcs_map.items():
        p = prods.get(pid)
        if not p:
            continue
        avail = inv_agg.get(pid, 0)
        safety = p.get("safety_stock", 0)
        deficit_pcs = max(0, dem_qty + safety - avail)
        # If deficit is 0 but demand > 0, we still collate at least demanded or deficit
        qty_to_order_pcs = max(deficit_pcs, dem_qty if avail < dem_qty else deficit_pcs)
        wt_1000 = p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000.0)
        if wt_1000 == 0.0:
            wt_1000 = 1.0  # fallback weight per 1000 pcs if unknown
        req_kg = round((qty_to_order_pcs / 1000.0) * wt_1000, 4)

        sid = p.get("primary_supplier_id")
        sup = suppliers.get(str(sid)) if sid else None

        items_breakdown.append({
            "product_id": pid,
            "sku": p.get("sku", ""),
            "product_name": p.get("name", ""),
            "category": p.get("category", ""),
            "size": p.get("size", ""),
            "demanded_pcs": dem_qty,
            "available_pcs": avail,
            "safety_stock": safety,
            "recommended_pcs": qty_to_order_pcs,
            "wt_1000_pcs_kg": wt_1000,
            "recommended_weight_kg": req_kg,
            "supplier_id": str(sid) if sid else "",
            "supplier_name": (sup.get("company") or sup.get("name")) if sup else "Unassigned Supplier",
            "rate": p.get("cost", 0) or p.get("price", 0),
            "dealer_codes": sorted(list(dealer_codes_map.get(pid, []))),
            "cnf_codes": sorted(list(mnp_codes_map.get(pid, []))),
            "mnp_codes": sorted(list(mnp_codes_map.get(pid, []))),
            "dealer_summary": ", ".join(sorted(list(dealer_codes_map.get(pid, [])))),
            "cnf_summary": ", ".join(sorted(list(mnp_codes_map.get(pid, [])))),
            "mnp_summary": ", ".join(sorted(list(mnp_codes_map.get(pid, [])))),
        })
        total_pcs += dem_qty
        total_kg += req_kg

    items_breakdown.sort(key=lambda x: -x["recommended_weight_kg"])
    return {
        "total_orders": total_orders,
        "total_demanded_pcs": total_pcs,
        "estimated_total_kg": round(total_kg, 2),
        "items": items_breakdown,
    }


# ================== CORE COLLATION ENGINE ==================
async def execute_order_collation(triggered_by: str = "manual", actor: Optional[dict] = None) -> dict:
    """Core logic: aggregates uncollated orders, computes kg weight, creates grouped supplier POs, marks orders collated."""
    uncollated = await db.orders.find({
        "status": {"$in": ["pending", "approved"]},
        "collated": {"$ne": True}
    }).to_list(5000)

    if not uncollated:
        return {
            "status": "noop",
            "batch_no": None,
            "message": "No uncollated orders found.",
            "orders_count": 0,
            "po_count": 0,
            "total_pcs": 0,
            "total_kg": 0.0
        }

    # Generate Batch number
    count = await db.collations.count_documents({})
    batch_no = f"COL-2026{(count + 1):04d}"

    # Sum demand per product
    demanded_pcs_map = {}
    for o in uncollated:
        for item in o.get("items", []):
            pid = item["product_id"]
            demanded_pcs_map[pid] = demanded_pcs_map.get(pid, 0) + item.get("quantity", 0)

    prod_ids = [ObjectId(pid) for pid in demanded_pcs_map.keys() if ObjectId.is_valid(pid)]
    prods = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(1000)}
    inv_docs = await db.inventory.find({}).to_list(5000)
    inv_agg = {}
    for idx in inv_docs:
        pid = idx["product_id"]
        inv_agg[pid] = inv_agg.get(pid, 0) + max(0, idx.get("quantity", 0) - idx.get("reserved", 0))

    # Group by supplier
    by_supplier = {}
    total_pcs = 0
    total_kg = 0.0

    for pid, dem_qty in demanded_pcs_map.items():
        p = prods.get(pid)
        if not p:
            continue
        avail = inv_agg.get(pid, 0)
        safety = p.get("safety_stock", 0)
        deficit_pcs = max(0, dem_qty + safety - avail)
        qty_to_order_pcs = max(deficit_pcs, dem_qty if avail < dem_qty else deficit_pcs)
        if qty_to_order_pcs <= 0:
            continue

        wt_1000 = p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000.0)
        if wt_1000 == 0.0:
            wt_1000 = 1.0
        req_kg = round((qty_to_order_pcs / 1000.0) * wt_1000, 4)

        sid = p.get("primary_supplier_id") or "unassigned"
        if sid not in by_supplier:
            by_supplier[sid] = []

        rate = p.get("cost", 0) or p.get("price", 0)
        by_supplier[sid].append({
            "product_id": pid,
            "product_name": p.get("name", ""),
            "sku": p.get("sku", ""),
            "quantity": qty_to_order_pcs,
            "quantity_kg": req_kg,
            "weight_per_1000_pcs": wt_1000,
            "rate": rate,
            "amount": round(qty_to_order_pcs * rate, 2),
        })
        total_pcs += qty_to_order_pcs
        total_kg += req_kg

    # Default warehouse for POs
    warehouses = await db.warehouses.find({}).to_list(10)
    wh_id = str(warehouses[0]["_id"]) if warehouses else ""

    po_ids = []
    po_nos = []
    supplier_users = {str(s["_id"]): s for s in await db.users.find({"role": "supplier"}).to_list(100)}

    for sid, items in by_supplier.items():
        if sid == "unassigned" and not items:
            continue
        subtotal = sum(i["amount"] for i in items)
        po_count = await db.purchase_orders.count_documents({})
        po_no = f"PO-2026{(po_count + len(po_ids) + 1):04d}"

        sup_name = "Assigned Supplier"
        if sid in supplier_users:
            sup_name = supplier_users[sid].get("company") or supplier_users[sid].get("name")

        po_doc = {
            "po_no": po_no,
            "supplier_id": sid if sid != "unassigned" else "",
            "supplier_name": sup_name,
            "warehouse_id": wh_id,
            "items": items,
            "subtotal": round(subtotal, 2),
            "gst": round(subtotal * 0.18, 2),
            "total": round(subtotal * 1.18, 2),
            "status": "draft",
            "expected_delivery": "",
            "notes": f"Auto-collated batch {batch_no} ({triggered_by}) — Weight-converted PO",
            "collation_batch_no": batch_no,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        res = await db.purchase_orders.insert_one(po_doc)
        po_ids.append(str(res.inserted_id))
        po_nos.append(po_no)

        if sid in supplier_users:
            await db.notifications.insert_one({
                "user_id": sid,
                "title": f"New Weight PO {po_no} ({batch_no})",
                "body": f"Collated weight order: ₹{po_doc['total']:.0f} — {len(items)} items",
                "kind": "info",
                "read": False,
                "created_at": now_iso(),
            })

    # Mark source orders collated
    order_ids = [o["_id"] for o in uncollated]
    await db.orders.update_many(
        {"_id": {"$in": order_ids}},
        {"$set": {
            "collated": True,
            "collation_batch_no": batch_no,
            "status": "processing",
            "updated_at": now_iso()
        }}
    )

    # Record Collation Batch
    batch_doc = {
        "batch_no": batch_no,
        "triggered_by": triggered_by,
        "orders_count": len(uncollated),
        "total_pcs": total_pcs,
        "total_kg": round(total_kg, 2),
        "po_ids": po_ids,
        "po_nos": po_nos,
        "created_at": now_iso(),
    }
    await db.collations.insert_one(batch_doc)

    # Notify Admin
    await db.notifications.insert_one({
        "role": "admin",
        "title": f"Order Collation {batch_no} Completed",
        "body": f"Collated {len(uncollated)} orders into {len(po_ids)} weight POs ({total_kg:.2f} KG total).",
        "kind": "success",
        "read": False,
        "created_at": now_iso(),
    })

    # Audit
    await db.audit_logs.insert_one({
        "actor_id": actor["id"] if actor else "system_12am_scheduler",
        "actor_email": actor["email"] if actor else "auto-scheduler@yaminiflow.com",
        "action": "procurement.collate",
        "target": batch_no,
        "meta": {"orders_count": len(uncollated), "po_count": len(po_ids), "total_kg": round(total_kg, 2), "triggered_by": triggered_by},
        "created_at": now_iso(),
    })

    return {
        "status": "success",
        "batch_no": batch_no,
        "orders_count": len(uncollated),
        "po_count": len(po_ids),
        "po_nos": po_nos,
        "total_pcs": total_pcs,
        "total_kg": round(total_kg, 2),
    }


@router.post("/procurement/collate")
async def trigger_collate_endpoint(payload: CollateTriggerIn = CollateTriggerIn(triggered_by="manual"), admin: dict = Depends(require_admin)):
    """API endpoint triggered by Admin click ('Collate Orders' button)."""
    return await execute_order_collation(triggered_by=payload.triggered_by, actor=admin)


@router.get("/procurement/collations")
async def list_collations(user: dict = Depends(get_current_user)):
    """List historical order collation batches."""
    docs = await db.collations.find({}).sort("created_at", -1).to_list(200)
    return serialize_docs(docs)


# ================== RECOMMENDATIONS & PO ENDPOINTS ==================
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
            rec_qty = max(deficit, p.get("moq", 1))
            wt_1000 = p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000.0)
            if wt_1000 == 0.0:
                wt_1000 = 1.0
            recs.append({
                "product_id": pid,
                "product_name": p["name"],
                "sku": p["sku"],
                "category": p["category"],
                "available": available,
                "safety_stock": safety,
                "pending_demand": pending,
                "recommended_qty": rec_qty,
                "wt_1000_pcs_kg": wt_1000,
                "recommended_weight_kg": round((rec_qty / 1000.0) * wt_1000, 4),
                "moq": p.get("moq", 1),
                "lead_time_days": p.get("lead_time_days", 7),
                "supplier_id": p.get("primary_supplier_id"),
                "cost": p.get("cost", 0),
                "urgency": "critical" if available < safety * 0.5 else ("high" if available < safety else "medium"),
            })
    # Enrich supplier name
    sup_ids = [ObjectId(r["supplier_id"]) for r in recs if r.get("supplier_id") and ObjectId.is_valid(r["supplier_id"])]
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
    prod_ids = [ObjectId(i.product_id) for i in payload.items if ObjectId.is_valid(i.product_id)]
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(500)}
    items_out = []
    total = 0
    for i in payload.items:
        p = products.get(i.product_id)
        if not p:
            raise HTTPException(400, f"Product {i.product_id} not found")
        amount = i.quantity * i.rate
        wt_1000 = p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000.0) or 1.0
        qty_kg = i.quantity_kg if i.quantity_kg > 0 else round((i.quantity / 1000.0) * wt_1000, 4)
        items_out.append({
            "product_id": i.product_id, "product_name": p["name"],
            "sku": p["sku"], "quantity": i.quantity, "quantity_kg": qty_kg,
            "weight_per_1000_pcs": wt_1000, "rate": i.rate, "amount": amount
        })
        total += amount

    supplier = await db.users.find_one({"_id": ObjectId(payload.supplier_id)}) if ObjectId.is_valid(payload.supplier_id) else None
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
        "body": f"₹{doc['total']:.0f} — {len(items_out)} items ({sum(i['quantity_kg'] for i in items_out):.2f} kg)",
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
