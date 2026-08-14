"""Orders + Invoices + Smart Multi-Warehouse Allocation & Partial Billing."""
from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin, require_roles
from models import OrderIn, OrderStatusUpdate, OrderPartialBillingIn

router = APIRouter(tags=["orders"])


async def _order_number() -> str:
    count = await db.orders.count_documents({})
    return f"ORD-2026{(count + 1):04d}"


async def _enrich_orders(docs: list) -> list:
    out = serialize_docs(docs)
    if not out:
        return out

    # Collect all user IDs (dealers + cnfs)
    party_ids = set()
    for d in out:
        if d.get("dealer_id") and ObjectId.is_valid(d["dealer_id"]):
            party_ids.add(ObjectId(d["dealer_id"]))
        if d.get("cnf_id") and ObjectId.is_valid(d["cnf_id"]):
            party_ids.add(ObjectId(d["cnf_id"]))
        if d.get("mnp_id") and ObjectId.is_valid(d["mnp_id"]):
            party_ids.add(ObjectId(d["mnp_id"]))

    users = {}
    if party_ids:
        user_docs = await db.users.find({"_id": {"$in": list(party_ids)}}).to_list(1000)
        users = {str(u["_id"]): u for u in user_docs}

    # Collect warehouse IDs
    wh_ids = {ObjectId(d["warehouse_id"]) for d in out if d.get("warehouse_id") and ObjectId.is_valid(d["warehouse_id"])}
    warehouses = {}
    if wh_ids:
        wh_docs = await db.warehouses.find({"_id": {"$in": list(wh_ids)}}).to_list(100)
        warehouses = {str(w["_id"]): w for w in wh_docs}

    for d in out:
        dlr = users.get(d.get("dealer_id"))
        cnf_obj = users.get(d.get("cnf_id") or d.get("mnp_id"))

        if dlr:
            is_cnf_party = dlr.get("role") in ["cnf", "mnp"]
            if not d.get("dealer_code"):
                d["dealer_code"] = dlr.get("user_code") or dlr.get("login_id") or ("C-DEPOT" if is_cnf_party else "D-ASSIGNED")
            if not d.get("dealer_name"):
                d["dealer_name"] = dlr.get("company") or dlr.get("name")
            if not d.get("dealer_state"):
                d["dealer_state"] = dlr.get("state", "")
            if not d.get("dealer_gstin"):
                d["dealer_gstin"] = dlr.get("gstin", "")

            # Check if dealer is linked to a CNF
            linked_cnf_id = str(dlr.get("cnf_id") or dlr.get("mnp_id") or "")
            if linked_cnf_id and linked_cnf_id in users:
                linked_cnf = users[linked_cnf_id]
                d["cnf_code"] = linked_cnf.get("user_code") or linked_cnf.get("login_id") or "C-ASSIGNED"
                d["cnf_name"] = linked_cnf.get("name") or linked_cnf.get("company") or "Regional CNF"
                d["mnp_code"] = d["cnf_code"]
                d["mnp_name"] = d["cnf_name"]
            elif is_cnf_party:
                d["cnf_code"] = d["dealer_code"]
                d["cnf_name"] = d["dealer_name"]
                d["mnp_code"] = d["dealer_code"]
                d["mnp_name"] = d["dealer_name"]
                d["order_type"] = "cnf_stock"
            elif not d.get("cnf_code") and not d.get("mnp_code"):
                d["cnf_code"] = "DIRECT"
                d["cnf_name"] = "Direct (Yamini Flow HQ)"
                d["mnp_code"] = "DIRECT"
                d["mnp_name"] = "Direct (Yamini Flow HQ)"
        else:
            d["dealer_code"] = d.get("dealer_code") or "D-ASSIGNED"
            d["dealer_name"] = d.get("dealer_name") or "Direct Order"
            if not d.get("cnf_code") and not d.get("mnp_code"):
                d["cnf_code"] = "DIRECT"
                d["cnf_name"] = "Direct (HQ)"
                d["mnp_code"] = "DIRECT"
                d["mnp_name"] = "Direct (HQ)"

        if cnf_obj and not d.get("cnf_code"):
            d["cnf_code"] = cnf_obj.get("user_code") or cnf_obj.get("login_id") or "C-ASSIGNED"
            d["cnf_name"] = cnf_obj.get("name") or cnf_obj.get("company") or "Regional CNF"
            d["mnp_code"] = d["cnf_code"]
            d["mnp_name"] = d["cnf_name"]

        # Warehouse enrichment
        wh = warehouses.get(d.get("warehouse_id"))
        if wh:
            d["warehouse_name"] = wh.get("name") or wh.get("code")
            d["warehouse_code"] = wh.get("code")

        # Invoice number generation/alias
        if not d.get("invoice_no"):
            d["invoice_no"] = d.get("tally_voucher_no") or ("INV-" + d["order_no"].replace("ORD-", ""))

        # Ensure order items have proper quantity keys
        items = d.get("items", [])
        for item in items:
            q_ord = item.get("quantity_ordered") or item.get("quantity") or 0
            q_inv = item.get("quantity_invoiced") or 0
            item["quantity_ordered"] = q_ord
            item["quantity_invoiced"] = q_inv
            item["quantity_pending"] = item.get("quantity_pending", max(0, q_ord - q_inv))
            if "quantity_allocated" not in item:
                item["quantity_allocated"] = q_ord if d.get("status") in ["approved", "shipped", "delivered"] else 0

    return out


@router.get("/orders")
async def list_orders(status: str = "", dealer_id: str = "",
                       user: dict = Depends(get_current_user)):
    query = {}
    role = user.get("role")

    if role == "dealer":
        query["dealer_id"] = user["id"]
    elif role in ("cnf", "mnp"):
        # Find all dealers tagged under this CNF
        dealers = await db.users.find({
            "role": "dealer",
            "$or": [{"cnf_id": user["id"]}, {"mnp_id": user["id"]}]
        }).to_list(500)
        sub_dealer_ids = [str(d["_id"]) for d in dealers]
        
        # CNF sees orders from their dealers, plus direct CNF stock orders
        allowed_ids = sub_dealer_ids + [user["id"]]
        query["$or"] = [
            {"dealer_id": {"$in": allowed_ids}},
            {"cnf_id": user["id"]},
            {"mnp_id": user["id"]}
        ]
    elif role == "admin":
        if dealer_id:
            query["dealer_id"] = dealer_id

    if status:
        query["status"] = status

    docs = await db.orders.find(query).sort("created_at", -1).to_list(2000)
    return await _enrich_orders(docs)


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Order not found")

    role = user.get("role")
    if role == "dealer" and doc.get("dealer_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    elif role in ("cnf", "mnp"):
        # Verify order belongs to this CNF network
        if doc.get("dealer_id") != user["id"] and doc.get("cnf_id") != user["id"] and doc.get("mnp_id") != user["id"]:
            dlr = await db.users.find_one({
                "_id": ObjectId(doc["dealer_id"]),
                "$or": [{"cnf_id": user["id"]}, {"mnp_id": user["id"]}]
            })
            if not dlr:
                raise HTTPException(403, "Forbidden")

    enriched = await _enrich_orders([doc])
    return enriched[0]


@router.post("/orders")
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ("dealer", "cnf", "mnp", "admin"):
        raise HTTPException(403, "Only dealers, CNFs, MNPs, or admins can place orders")

    # Determine target dealer / party
    dealer_id = user["id"]
    order_type = payload.order_type or "dealer_order"
    
    if user["role"] == "admin":
        if payload.dealer_id:
            dealer_id = payload.dealer_id
        else:
            # If admin didn't specify a dealer, find first active dealer or self
            first_dlr = await db.users.find_one({"role": "dealer", "status": "active"})
            if first_dlr:
                dealer_id = str(first_dlr["_id"])
    elif user["role"] in ("cnf", "mnp"):
        if payload.dealer_id:
            dealer_id = payload.dealer_id
            order_type = "dealer_order"
        else:
            # CNF Depot Replenishment Order
            dealer_id = user["id"]
            order_type = "cnf_stock"

    # Fetch party details
    dealer = await db.users.find_one({"_id": ObjectId(dealer_id)})
    if not dealer:
        dealer = user

    dealer_role = dealer.get("role", "dealer")
    is_cnf_depot = dealer_role in ["cnf", "mnp"] or order_type == "cnf_stock"
    dealer_code = dealer.get("user_code") or dealer.get("login_id") or ("C-DEPOT" if is_cnf_depot else "D-ASSIGNED")
    dealer_name = dealer.get("company") or dealer.get("name")
    dealer_state = dealer.get("state", "")
    dealer_gstin = dealer.get("gstin", "")

    # Resolve CNF linkage
    cnf_id_val = payload.cnf_id or dealer.get("cnf_id") or dealer.get("mnp_id")
    cnf_code = "DIRECT"
    cnf_name = "Direct (Yamini Flow HQ)"

    if is_cnf_depot:
        cnf_id_val = str(dealer["_id"])
        cnf_code = dealer_code
        cnf_name = dealer_name
    elif cnf_id_val and str(cnf_id_val).strip().lower() not in ["", "direct", "none", "null"]:
        try:
            cnf_doc = await db.users.find_one({"_id": ObjectId(cnf_id_val)})
            if cnf_doc:
                cnf_code = cnf_doc.get("user_code") or cnf_doc.get("login_id") or "C-ASSIGNED"
                cnf_name = cnf_doc.get("name") or cnf_doc.get("company") or "Regional CNF"
        except Exception:
            pass

    # Load products from DB
    prod_ids = [ObjectId(i.product_id) for i in payload.items if ObjectId.is_valid(i.product_id)]
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(500)}

    # Resolve Warehouse with Smart Multi-Warehouse Routing
    warehouses = await db.warehouses.find({}).to_list(50)
    wh_id = payload.warehouse_id
    if not wh_id and warehouses:
        # Match by State proximity
        matched_wh = next((w for w in warehouses if w.get("state", "").strip().lower() == dealer_state.strip().lower()), None)
        wh_id = str(matched_wh["_id"]) if matched_wh else str(warehouses[0]["_id"])

    # ------------------ SMART STOCK ALLOCATION ENGINE ------------------
    items_out = []
    subtotal = 0
    total_weight_kg = 0.0
    deficits = []
    total_demanded = 0
    total_allocated = 0

    for i in payload.items:
        p = products.get(i.product_id)
        if not p:
            raise HTTPException(400, f"Product {i.product_id} not found in catalog")

        qty = int(i.quantity)
        total_demanded += qty
        qty_per_box = i.qty_per_box or p.get("qty_per_box", 1000)
        boxes = i.boxes or max(1, qty // qty_per_box)
        wt_1000 = i.wt_1000_pcs_kg or p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000)
        item_weight = round((qty / 1000.0) * wt_1000, 3)
        total_weight_kg += item_weight

        # Price computation
        rate = i.rate or (p.get("wd_landing") if is_cnf_depot else (p.get("dealer_landing") or p.get("price", 0.0)))
        sub = i.value_before_tax if (i.value_before_tax and i.value_before_tax > 0) else round(rate * boxes, 2)
        gst = i.gst_amount if (i.gst_amount and i.gst_amount > 0) else round(sub * 0.18, 2)
        tot = i.value_after_tax if (i.value_after_tax and i.value_after_tax > 0) else round(sub + gst, 2)
        subtotal += sub

        # Check inventory at target warehouse
        inv = await db.inventory.find_one({"warehouse_id": wh_id, "product_id": i.product_id})
        on_hand = inv.get("quantity", 0) if inv else 0
        reserved = inv.get("reserved", 0) if inv else 0
        available = max(0, on_hand - reserved)

        if available >= qty:
            allocated = qty
            deficit = 0
            # Reserve full stock
            await db.inventory.update_one(
                {"warehouse_id": wh_id, "product_id": i.product_id},
                {"$inc": {"reserved": qty}, "$set": {"updated_at": now_iso()}},
                upsert=True
            )
        elif available > 0:
            allocated = available
            deficit = qty - available
            # Reserve partial stock
            await db.inventory.update_one(
                {"warehouse_id": wh_id, "product_id": i.product_id},
                {"$inc": {"reserved": available}, "$set": {"updated_at": now_iso()}},
                upsert=True
            )
            deficits.append({
                "product_id": i.product_id,
                "product_name": p["name"],
                "sku": p["sku"],
                "required": qty,
                "available": available,
                "allocated": allocated,
                "deficit": deficit,
                "weight_deficit_kg": round((deficit / 1000.0) * wt_1000, 3)
            })
        else:
            allocated = 0
            deficit = qty
            deficits.append({
                "product_id": i.product_id,
                "product_name": p["name"],
                "sku": p["sku"],
                "required": qty,
                "available": 0,
                "allocated": 0,
                "deficit": deficit,
                "weight_deficit_kg": round((deficit / 1000.0) * wt_1000, 3)
            })

        total_allocated += allocated

        items_out.append({
            "product_id": i.product_id,
            "product_name": p["name"],
            "sku": p["sku"],
            "category": p.get("category", ""),
            "size": i.size or p.get("size", ""),
            "quantity": qty,
            "quantity_ordered": qty,
            "quantity_allocated": allocated,
            "quantity_invoiced": 0,
            "quantity_pending": qty,
            "boxes": boxes,
            "qty_per_box": qty_per_box,
            "wt_1000_pcs_kg": wt_1000,
            "total_weight_kg": item_weight,
            "allocated_weight_kg": round((allocated / 1000.0) * wt_1000, 3),
            "rate": rate,
            "dealer_landing": p.get("dealer_landing", rate),
            "value_before_tax": sub,
            "gst_amount": gst,
            "value_after_tax": tot,
        })

    # Allocation Status
    if total_allocated == total_demanded:
        overall_status = "approved"
        reservation_status = "reserved"
    elif total_allocated > 0:
        overall_status = "partially_fulfilled"
        reservation_status = "partially_reserved"
    else:
        overall_status = "pending"
        reservation_status = "pending"

    order_no = await _order_number()
    invoice_no = f"INV-{order_no.replace('ORD-', '')}"
    gst_total = round(subtotal * 0.18, 2)
    grand_total = round(subtotal + gst_total, 2)

    doc = {
        "order_no": order_no,
        "invoice_no": invoice_no,
        "order_type": order_type,
        "billing_type": payload.billing_type or "direct",
        "dealer_id": dealer_id,
        "dealer_code": dealer_code,
        "dealer_name": dealer_name,
        "dealer_state": dealer_state,
        "dealer_gstin": dealer_gstin,
        "cnf_id": str(cnf_id_val) if cnf_id_val else None,
        "cnf_code": cnf_code,
        "cnf_name": cnf_name,
        "mnp_id": str(cnf_id_val) if cnf_id_val else None,
        "mnp_code": cnf_code,
        "mnp_name": cnf_name,
        "warehouse_id": wh_id,
        "items": items_out,
        "subtotal": round(subtotal, 2),
        "gst": gst_total,
        "total": grand_total,
        "total_weight_kg": round(total_weight_kg, 3),
        "status": overall_status,
        "reservation_status": reservation_status,
        "payment_status": "unpaid",
        "deficits": deficits,
        "invoices": [],  # Multi-invoice tracking synced from Tally or generated on approval
        "notes": payload.notes or "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    res = await db.orders.insert_one(doc)
    doc["_id"] = res.inserted_id

    # Push notifications
    await db.notifications.insert_many([
        {
            "role": "admin",
            "title": f"New Order {order_no} ({order_type.replace('_', ' ').title()})",
            "body": f"{dealer_name} placed order ₹{grand_total:.0f} • Allocation: {reservation_status.upper()}",
            "kind": "info" if reservation_status == "reserved" else "warning",
            "read": False,
            "created_at": now_iso()
        },
        {
            "user_id": dealer_id,
            "title": f"Order {order_no} Submitted",
            "body": f"Status: {overall_status.upper()}. Total ₹{grand_total:.0f}",
            "kind": "success",
            "read": False,
            "created_at": now_iso()
        },
    ])

    # Audit Trail
    await db.audit_logs.insert_one({
        "actor_id": user["id"], "actor_email": user.get("email", "system"),
        "action": "order.create", "target": order_no,
        "meta": {
            "total": grand_total,
            "status": overall_status,
            "reservation_status": reservation_status,
            "deficits_count": len(deficits)
        },
        "created_at": now_iso(),
    })

    return serialize_doc(doc)


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusUpdate,
                               user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "cnf", "mnp"):
        raise HTTPException(403, "Forbidden")
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Order not found")
    old_status = doc["status"]
    new_status = payload.status

    # Stock reconciliation on delivered
    if new_status == "delivered" and old_status != "delivered":
        for item in doc.get("items", []):
            qty = item.get("quantity_ordered") or item.get("quantity", 0)
            await db.inventory.update_one(
                {"warehouse_id": doc.get("warehouse_id"), "product_id": item["product_id"]},
                {"$inc": {"quantity": -qty, "reserved": -qty},
                 "$set": {"updated_at": now_iso()}},
            )
    elif new_status == "cancelled" and old_status != "cancelled":
        for item in doc.get("items", []):
            qty = item.get("quantity_allocated") or item.get("quantity", 0)
            await db.inventory.update_one(
                {"warehouse_id": doc.get("warehouse_id"), "product_id": item["product_id"]},
                {"$inc": {"reserved": -qty}, "$set": {"updated_at": now_iso()}},
            )

    update_fields = {"status": new_status, "updated_at": now_iso()}
    if payload.notes:
        update_fields["notes"] = payload.notes

    # If approved and no invoices exist yet, generate the base synced tax invoice
    if new_status in ["approved", "processing", "partially_fulfilled"] and not doc.get("invoices"):
        inv_no = doc.get("invoice_no") or f"INV-{doc['order_no'].replace('ORD-', '')}"
        initial_inv = {
            "invoice_no": inv_no,
            "date": now_iso()[:10],
            "amount": doc.get("total", 0),
            "linked_by": "admin_approval",
            "items_billed": doc.get("items", [])
        }
        update_fields["invoices"] = [initial_inv]

    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_fields})
    await db.audit_logs.insert_one({
        "actor_id": user["id"], "actor_email": user.get("email", "system"),
        "action": "order.status", "target": doc["order_no"],
        "meta": {"from": old_status, "to": new_status},
        "created_at": now_iso(),
    })
    doc["status"] = new_status
    enriched = await _enrich_orders([doc])
    return enriched[0]


@router.post("/orders/{order_id}/partial-bill")
async def record_partial_billing(order_id: str, payload: OrderPartialBillingIn,
                                 admin: dict = Depends(require_admin)):
    """Admin records partial billing / dispatch against an order line by line."""
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Order not found")

    items = doc.get("items", [])
    bill_map = {b.product_id: b.quantity_to_bill for b in payload.items}
    
    updated_items = []
    total_billed_now = 0
    all_completed = True

    for it in items:
        pid = it["product_id"]
        q_ord = it.get("quantity_ordered") or it.get("quantity", 0)
        q_prev_inv = it.get("quantity_invoiced", 0)
        
        bill_qty = bill_map.get(pid, 0)
        new_inv_qty = min(q_ord, q_prev_inv + bill_qty)
        new_pending = max(0, q_ord - new_inv_qty)

        if new_pending > 0:
            all_completed = False

        it["quantity_invoiced"] = new_inv_qty
        it["quantity_pending"] = new_pending
        updated_items.append(it)

        # Rate and amount for this batch
        rate = it.get("rate") or 0
        total_billed_now += round(rate * bill_qty * 1.18, 2)

    inv_number = payload.invoice_no or f"INV-{doc['order_no'].replace('ORD-', '')}-P{len(doc.get('invoices', [])) + 1}"
    new_invoice_entry = {
        "invoice_no": inv_number,
        "date": now_iso()[:10],
        "amount": total_billed_now,
        "linked_by": "admin_partial_billing",
        "notes": payload.notes or "",
        "items_billed": [{"product_id": b.product_id, "quantity_billed": b.quantity_to_bill} for b in payload.items]
    }

    invoices = doc.get("invoices", [])
    invoices.append(new_invoice_entry)

    next_status = "delivered" if all_completed else "partially_fulfilled"

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "items": updated_items,
            "invoices": invoices,
            "status": next_status,
            "updated_at": now_iso()
        }}
    )

    doc["items"] = updated_items
    doc["invoices"] = invoices
    doc["status"] = next_status
    enriched = await _enrich_orders([doc])
    return enriched[0]


@router.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user)):
    query = {"status": {"$in": ["approved", "processing", "partially_fulfilled", "shipped", "delivered"]}}
    role = user.get("role")

    if role == "dealer":
        query["dealer_id"] = user["id"]
    elif role in ("cnf", "mnp"):
        dealers = await db.users.find({
            "role": "dealer",
            "$or": [{"cnf_id": user["id"]}, {"mnp_id": user["id"]}]
        }).to_list(500)
        sub_dealer_ids = [str(d["_id"]) for d in dealers]
        query["$or"] = [
            {"dealer_id": {"$in": sub_dealer_ids + [user["id"]]}},
            {"cnf_id": user["id"]},
            {"mnp_id": user["id"]}
        ]

    docs = await db.orders.find(query).sort("created_at", -1).to_list(1000)
    enriched = await _enrich_orders(docs)
    return enriched
