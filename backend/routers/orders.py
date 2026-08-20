"""Orders + Invoices + Smart Multi-Warehouse Allocation & Partial Billing."""
from datetime import datetime, timezone, timedelta
import math
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin, require_roles
from models import OrderIn, OrderStatusUpdate, OrderPartialBillingIn, WarehouseAssignmentIn

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

    # Collect warehouse IDs and codes
    wh_ids = []
    wh_codes = []
    for d in out:
        wid = d.get("warehouse_id")
        if wid:
            if ObjectId.is_valid(str(wid)):
                wh_ids.append(ObjectId(str(wid)))
            else:
                wh_codes.append(str(wid))

    warehouses = {}
    if wh_ids or wh_codes:
        wh_query = {}
        clauses = []
        if wh_ids:
            clauses.append({"_id": {"$in": wh_ids}})
        if wh_codes:
            clauses.append({"code": {"$in": wh_codes}})
            clauses.append({"_id": {"$in": wh_codes}})
        wh_query["$or"] = clauses
        wh_docs = await db.warehouses.find(wh_query).to_list(100)
        for w in wh_docs:
            warehouses[str(w["_id"])] = w
            if w.get("code"):
                warehouses[w["code"]] = w

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

        # Warehouse enrichment from real admin warehouse records
        wh = warehouses.get(str(d.get("warehouse_id", "")))
        if wh:
            d["warehouse_name"] = wh.get("name") or wh.get("code")
            d["warehouse_code"] = wh.get("code")
            d["warehouse_city"] = wh.get("city", "")
            d["warehouse_state"] = wh.get("state", "")
        else:
            d["warehouse_name"] = d.get("warehouse_name") or d.get("warehouse_code") or "Main Warehouse"
            d["warehouse_code"] = d.get("warehouse_code") or ""

        # Invoice number generation: Only issued AFTER explicit Admin approval!
        is_approved = bool(d.get("approved_at"))
        if is_approved:
            if not d.get("invoice_no"):
                ord_no = str(d.get("order_no", "ORD-PENDING"))
                d["invoice_no"] = d.get("tally_voucher_no") or ("INV-" + ord_no.replace("ORD-", ""))
        else:
            d["invoice_no"] = None
            d["invoices"] = []
            d["status"] = "pending"
            if d.get("_id") and (d.get("invoices") or d.get("invoice_no") or d.get("status") != "pending"):
                raw_id = d["_id"]
                oid = ObjectId(raw_id) if ObjectId.is_valid(str(raw_id)) else raw_id
                await db.orders.update_one(
                    {"_id": oid},
                    {"$set": {"status": "pending"}, "$unset": {"invoice_no": "", "invoices": "", "tally_voucher_no": "", "tally_voucher": ""}}
                )

        # Estimated delivery and countdown enrichment
        if not d.get("delivery_days_total"):
            est_raw = str(d.get("estimated_delivery_days") or "")
            if "7" in est_raw:
                d["delivery_days_total"] = 7
            elif "5" in est_raw:
                d["delivery_days_total"] = 5
            elif "3" in est_raw:
                d["delivery_days_total"] = 3
            elif "10" in est_raw:
                d["delivery_days_total"] = 10
            else:
                d["delivery_days_total"] = 7

        if not d.get("estimated_delivery_days"):
            d["estimated_delivery_days"] = f"{d.get('delivery_days_total', 7)} Days"

        if not d.get("target_delivery_date") and d.get("dispatch_date"):
            try:
                disp_dt = datetime.fromisoformat(str(d["dispatch_date"])[:10])
                d["target_delivery_date"] = (disp_dt + timedelta(days=int(d.get("delivery_days_total", 7)))).strftime("%Y-%m-%d")
            except Exception:
                pass

        # Ensure order items have proper quantity and box keys (ALL IN BOXES)
        items = d.get("items") or []
        total_b_ord = 0
        total_b_alloc = 0

        for item in items:
            b_ord = item.get("boxes") if item.get("boxes") is not None else (item.get("quantity_ordered") if item.get("quantity_ordered") is not None else (item.get("quantity") or 0))
            b_alloc = item.get("boxes_allocated") if item.get("boxes_allocated") is not None else (item.get("quantity_allocated") if item.get("quantity_allocated") is not None else (b_ord if d.get("reservation_status") == "reserved" else 0))
            b_inv = item.get("boxes_invoiced") if item.get("boxes_invoiced") is not None else (item.get("quantity_invoiced") or 0)
            b_pend = item.get("boxes_pending") if item.get("boxes_pending") is not None else max(0, b_ord - b_alloc)

            qty_per_box = item.get("qty_per_box") or 1000

            item["boxes"] = b_ord
            item["boxes_allocated"] = b_alloc
            item["boxes_invoiced"] = b_inv
            item["boxes_pending"] = b_pend
            item["quantity"] = b_ord
            item["quantity_ordered"] = b_ord
            item["quantity_allocated"] = b_alloc
            item["quantity_invoiced"] = b_inv
            item["quantity_pending"] = b_pend
            item["total_pcs"] = b_ord * qty_per_box
            item["allocated_pcs"] = b_alloc * qty_per_box
            item["pending_pcs"] = b_pend * qty_per_box

            total_b_ord += b_ord
            total_b_alloc += b_alloc

        # Force pending status if order has not been explicitly approved by admin
        if not d.get("approved_at"):
            d["status"] = "pending"
            d["invoice_no"] = None
            d["invoices"] = []

        # Dynamically correct reservation status for existing orders
        if total_b_ord > 0:
            if total_b_alloc >= total_b_ord:
                d["reservation_status"] = "reserved"
            elif total_b_alloc > 0:
                d["reservation_status"] = "partially_reserved"
            else:
                d["reservation_status"] = "pending"

    return out


@router.get("/orders")
async def list_orders(status: str = "", dealer_id: str = "",
                       user: dict = Depends(get_current_user)):
    query = {}
    role = user.get("role")

    if role == "dealer":
        uid = str(user.get("id") or user.get("_id") or "")
        # STRICT: only match by dealer_id (string or ObjectId). Never match by email/code
        # as those can collide across dealers and leak other dealers' orders.
        match_conditions = [{"dealer_id": uid}, {"user_id": uid}]
        if uid and ObjectId.is_valid(uid):
            match_conditions.append({"dealer_id": ObjectId(uid)})
        query["$or"] = match_conditions
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
    elif role in ("admin", "staff", "employee"):
        if dealer_id:
            query["dealer_id"] = dealer_id

    if status:
        query["status"] = status

    docs = await db.orders.find(query).sort("created_at", -1).to_list(2000)
    return await _enrich_orders(docs)


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(order_id)
        doc = await db.orders.find_one({"_id": oid})
    except Exception:
        doc = await db.orders.find_one({"_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")

    role = user.get("role")
    if role == "dealer" and doc.get("dealer_id") != user["id"]:
        raise HTTPException(403, "Forbidden")
    elif role in ("cnf", "mnp"):
        # Verify order belongs to this CNF network
        if doc.get("dealer_id") != user["id"] and doc.get("cnf_id") != user["id"] and doc.get("mnp_id") != user["id"]:
            dlr_q = {"_id": ObjectId(doc["dealer_id"])} if ObjectId.is_valid(doc.get("dealer_id", "")) else {"_id": doc.get("dealer_id")}
            dlr_q["$or"] = [{"cnf_id": user["id"]}, {"mnp_id": user["id"]}]
            dlr = await db.users.find_one(dlr_q)
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
    dealer = await db.users.find_one({"_id": ObjectId(dealer_id)}) if ObjectId.is_valid(dealer_id) else await db.users.find_one({"_id": dealer_id})
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
            cnf_doc = await db.users.find_one({"_id": ObjectId(cnf_id_val)}) if ObjectId.is_valid(str(cnf_id_val)) else await db.users.find_one({"_id": cnf_id_val})
            if cnf_doc:
                cnf_code = cnf_doc.get("user_code") or cnf_doc.get("login_id") or "C-ASSIGNED"
                cnf_name = cnf_doc.get("name") or cnf_doc.get("company") or "Regional CNF"
        except Exception:
            pass

    # Load products from DB
    prod_ids = [ObjectId(i.product_id) for i in payload.items if ObjectId.is_valid(i.product_id)]
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(500)}

    # ------------------ SMART STOCK ALLOCATION ENGINE ------------------
    warehouses = await db.warehouses.find({}).to_list(50)
    wh_id = payload.warehouse_id
    wh_doc = None
    allocation_method = "admin_selected" if wh_id else "smart_allocated"

    if wh_id:
        if ObjectId.is_valid(wh_id):
            wh_doc = await db.warehouses.find_one({"_id": ObjectId(wh_id)})
        if not wh_doc:
            wh_doc = await db.warehouses.find_one({"_id": wh_id})
        if not wh_doc:
            wh_doc = await db.warehouses.find_one({"code": wh_id})

    # If no warehouse chosen by admin (e.g. dealer placed order), run Multi-Warehouse Smart Stock Allocation
    if not wh_doc and warehouses:
        allocation_method = "smart_allocated"
        state_lower = dealer_state.strip().lower()
        
        # Regional zone routing
        north_states = ["delhi", "punjab", "haryana", "uttar pradesh", "rajasthan", "chandigarh", "himachal pradesh", "jammu and kashmir", "uttarakhand"]
        south_states = ["karnataka", "tamil nadu", "telangana", "andhra pradesh", "kerala", "puducherry"]
        west_states = ["maharashtra", "gujarat", "goa", "madhya pradesh", "chhattisgarh"]
        
        preferred_code = None
        if state_lower in north_states:
            preferred_code = "WH-DEL"
        elif state_lower in south_states:
            preferred_code = "WH-BLR"
        elif state_lower in west_states:
            preferred_code = "WH-MUM"
            
        regional_wh = next((w for w in warehouses if w.get("code") == preferred_code), None)
        if not regional_wh:
            regional_wh = next((w for w in warehouses if w.get("state", "").strip().lower() == state_lower), warehouses[0])
            
        # Check stock availability across candidate warehouses
        best_wh = regional_wh
        max_stock_score = -1

        for cand_wh in warehouses:
            cand_id = str(cand_wh["_id"])
            stock_score = 0
            for it in payload.items:
                inv = await db.inventory.find_one({"warehouse_id": cand_id, "product_id": it.product_id})
                on_hand_boxes = inv.get("quantity", 0) if inv else 0
                reserved_boxes = inv.get("reserved", 0) if inv else 0
                avail_boxes = max(0, on_hand_boxes - reserved_boxes)

                p_it = products.get(it.product_id, {})
                q_per_b = it.qty_per_box or p_it.get("qty_per_box", 1000)
                demanded_b = it.boxes or (it.quantity if p_it.get("unit") == "box" else max(1, it.quantity // q_per_b))

                if avail_boxes >= demanded_b:
                    stock_score += 2
                elif avail_boxes > 0:
                    stock_score += 1
            
            # Proximity bonus for regional hub
            if cand_wh.get("code") == regional_wh.get("code"):
                stock_score += 0.5
                
            if stock_score > max_stock_score:
                max_stock_score = stock_score
                best_wh = cand_wh

        wh_doc = best_wh
        wh_id = str(wh_doc["_id"])
    elif wh_doc:
        wh_id = str(wh_doc["_id"])
    else:
        wh_id = "default"

    warehouse_name = wh_doc.get("name") if wh_doc else "Main Warehouse"
    warehouse_code = wh_doc.get("code") if wh_doc else "WH-MAIN"

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

        qty_per_box = i.qty_per_box or p.get("qty_per_box", 1000) or 1000
        demanded_boxes = int(i.boxes if (i.boxes and i.boxes > 0) else (i.quantity or 1))
        demanded_pcs = demanded_boxes * qty_per_box
        total_demanded += demanded_boxes

        wt_1000 = i.wt_1000_pcs_kg or p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000)
        item_weight = round((demanded_pcs / 1000.0) * wt_1000, 3)
        total_weight_kg += item_weight

        # Price computation per box
        rate = i.rate or (p.get("wd_landing") if is_cnf_depot else (p.get("dealer_landing") or p.get("price", 0.0)))
        sub = i.value_before_tax if (i.value_before_tax and i.value_before_tax > 0) else round(rate * demanded_boxes, 2)
        gst = i.gst_amount if (i.gst_amount and i.gst_amount > 0) else round(sub * 0.18, 2)
        tot = i.value_after_tax if (i.value_after_tax and i.value_after_tax > 0) else round(sub + gst, 2)
        subtotal += sub

        inv = await db.inventory.find_one({"warehouse_id": wh_id, "product_id": i.product_id})
        on_hand_boxes = inv.get("quantity", 0) if inv else 0
        reserved_boxes = inv.get("reserved", 0) if inv else 0
        avail_boxes = max(0, on_hand_boxes - reserved_boxes)

        if avail_boxes >= demanded_boxes:
            allocated_boxes = demanded_boxes
            allocated_pcs = demanded_pcs
            deficit_boxes = 0
            deficit_pcs = 0
            # Reserve stock in inventory immediately so stock is locked
            await db.inventory.update_one(
                {"warehouse_id": wh_id, "product_id": i.product_id},
                {"$inc": {"reserved": allocated_boxes}, "$set": {"updated_at": now_iso()}},
                upsert=True
            )
        elif avail_boxes > 0:
            allocated_boxes = avail_boxes
            allocated_pcs = allocated_boxes * qty_per_box
            deficit_boxes = demanded_boxes - allocated_boxes
            deficit_pcs = deficit_boxes * qty_per_box
            # Reserve partial stock in inventory immediately
            await db.inventory.update_one(
                {"warehouse_id": wh_id, "product_id": i.product_id},
                {"$inc": {"reserved": allocated_boxes}, "$set": {"updated_at": now_iso()}},
                upsert=True
            )
            deficits.append({
                "product_id": i.product_id,
                "product_name": p["name"],
                "sku": p["sku"],
                "required_boxes": demanded_boxes,
                "available_boxes": avail_boxes,
                "allocated_boxes": allocated_boxes,
                "deficit_boxes": deficit_boxes,
                "required": demanded_pcs,
                "available": allocated_pcs,
                "allocated": allocated_pcs,
                "deficit": deficit_pcs,
                "weight_deficit_kg": round((deficit_pcs / 1000.0) * wt_1000, 3)
            })
        else:
            allocated_boxes = 0
            allocated_pcs = 0
            deficit_boxes = demanded_boxes
            deficit_pcs = demanded_pcs
            deficits.append({
                "product_id": i.product_id,
                "product_name": p["name"],
                "sku": p["sku"],
                "required_boxes": demanded_boxes,
                "available_boxes": 0,
                "allocated_boxes": 0,
                "deficit_boxes": deficit_boxes,
                "required": demanded_pcs,
                "available": 0,
                "allocated": 0,
                "deficit": deficit_pcs,
                "weight_deficit_kg": round((deficit_pcs / 1000.0) * wt_1000, 3)
            })

        total_allocated += allocated_boxes

        items_out.append({
            "product_id": i.product_id,
            "product_name": p["name"],
            "sku": p["sku"],
            "category": p.get("category", ""),
            "size": i.size or p.get("size", ""),
            "quantity": demanded_boxes,
            "quantity_ordered": demanded_boxes,
            "quantity_allocated": allocated_boxes,
            "quantity_invoiced": 0,
            "quantity_pending": deficit_boxes,
            "boxes": demanded_boxes,
            "boxes_allocated": allocated_boxes,
            "boxes_invoiced": 0,
            "boxes_pending": deficit_boxes,
            "qty_per_box": qty_per_box,
            "wt_1000_pcs_kg": wt_1000,
            "total_weight_kg": item_weight,
            "allocated_weight_kg": round((allocated_pcs / 1000.0) * wt_1000, 3),
            "pending_replenishment_kg": round((deficit_pcs / 1000.0) * wt_1000, 3),
            "rate": rate,
            "dealer_landing": p.get("dealer_landing", rate),
            "value_before_tax": sub,
            "gst_amount": gst,
            "value_after_tax": tot,
        })

    # Allocation & Order Status: Stock is reserved, but Order Status is PENDING with NO Invoice until Admin Approval!
    overall_status = "pending"
    reservation_status = "reserved" if total_allocated == total_demanded else ("partially_reserved" if total_allocated > 0 else "pending")

    order_no = await _order_number()
    invoice_no = None
    gst_total = round(subtotal * 0.18, 2)
    grand_total = round(subtotal + gst_total, 2)
    invoices = []

    doc = {
        "order_no": order_no,
        "invoice_no": invoice_no,
        "invoices": invoices,
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
        "warehouse_name": warehouse_name,
        "warehouse_code": warehouse_code,
        "allocation_method": allocation_method,
        "items": items_out,
        "subtotal": round(subtotal, 2),
        "gst": gst_total,
        "total": grand_total,
        "total_weight_kg": round(total_weight_kg, 3),
        "status": overall_status,
        "reservation_status": reservation_status,
        "payment_status": "unpaid",
        "deficits": deficits,
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
    try:
        oid = ObjectId(order_id)
        doc = await db.orders.find_one({"_id": oid})
    except Exception:
        doc = await db.orders.find_one({"_id": order_id})
        oid = order_id

    if not doc:
        raise HTTPException(404, "Order not found")
    old_status = doc.get("status", "pending")
    new_status = payload.status if payload.status is not None else old_status

    # Stock reconciliation on delivered
    if new_status == "delivered" and old_status != "delivered":
        for item in doc.get("items", []):
            qty_per_b = item.get("qty_per_box") or 1000
            q_ord = item.get("quantity_ordered") or item.get("quantity", 0)
            boxes_deliv = item.get("boxes_allocated") or item.get("boxes") or (int(math.ceil(q_ord / qty_per_b)) if qty_per_b else q_ord)
            await db.inventory.update_one(
                {"warehouse_id": doc.get("warehouse_id"), "product_id": item["product_id"]},
                {"$inc": {"quantity": -boxes_deliv, "reserved": -boxes_deliv},
                 "$set": {"updated_at": now_iso()}},
            )
    elif new_status == "cancelled" and old_status != "cancelled":
        for item in doc.get("items", []):
            qty_per_b = item.get("qty_per_box") or 1000
            q_alloc = item.get("quantity_allocated") or item.get("quantity", 0)
            boxes_unreserve = item.get("boxes_allocated") or (int(math.ceil(q_alloc / qty_per_b)) if qty_per_b else q_alloc)
            await db.inventory.update_one(
                {"warehouse_id": doc.get("warehouse_id"), "product_id": item["product_id"]},
                {"$inc": {"reserved": -boxes_unreserve}, "$set": {"updated_at": now_iso()}},
            )

    update_fields = {"status": new_status, "updated_at": now_iso()}
    if new_status == "approved":
        update_fields["approved_at"] = now_iso()
        update_fields["approved_by"] = user.get("email", "admin")
        
        items = doc.get("items", [])
        wh_id = str(doc.get("warehouse_id", "default"))
        updated_items = []
        total_b_ord = 0
        total_b_alloc = 0

        for item in items:
            p_id = item.get("product_id")
            demanded_boxes = item.get("boxes") if item.get("boxes") is not None else (item.get("quantity_ordered") or item.get("quantity") or 0)
            existing_alloc = item.get("boxes_allocated") if item.get("boxes_allocated") is not None else (item.get("quantity_allocated") or 0)

            total_b_ord += demanded_boxes

            if existing_alloc == 0 and demanded_boxes > 0:
                inv = await db.inventory.find_one({"warehouse_id": wh_id, "product_id": p_id})
                on_hand = inv.get("quantity", 0) if inv else 0
                reserved = inv.get("reserved", 0) if inv else 0
                avail = max(0, on_hand - reserved)
                alloc = min(avail, demanded_boxes)

                if alloc > 0:
                    await db.inventory.update_one(
                        {"warehouse_id": wh_id, "product_id": p_id},
                        {"$inc": {"reserved": alloc}, "$set": {"updated_at": now_iso()}},
                        upsert=True
                    )
                
                item["quantity_allocated"] = alloc
                item["boxes_allocated"] = alloc
                item["quantity_pending"] = max(0, demanded_boxes - alloc)
                item["boxes_pending"] = max(0, demanded_boxes - alloc)
                total_b_alloc += alloc
            else:
                total_b_alloc += existing_alloc

            updated_items.append(item)

        update_fields["items"] = updated_items

        is_partial = total_b_alloc < total_b_ord and total_b_alloc > 0
        if is_partial:
            update_fields["status"] = "partially_fulfilled"
            update_fields["reservation_status"] = "partially_reserved"
        else:
            update_fields["status"] = "approved"
            update_fields["reservation_status"] = "reserved" if total_b_alloc == total_b_ord else "pending"

        inv_no = doc.get("invoice_no") or f"INV-{doc['order_no'].replace('ORD-', '')}{'-P1' if is_partial else ''}"
        update_fields["invoice_no"] = inv_no
        
        # Build batch invoice #1 entry
        existing_invoices = doc.get("invoices", [])
        if not existing_invoices:
            inv_items = []
            inv_sub = 0.0
            inv_gst = 0.0
            inv_tot = 0.0
            
            for item in updated_items:
                b_alloc = item.get("boxes_allocated") if item.get("boxes_allocated") is not None else (item.get("quantity_allocated") or 0)
                if b_alloc > 0:
                    rate = item.get("rate") or item.get("dealer_landing") or 0
                    sub = round(rate * b_alloc, 2)
                    gst = round(sub * 0.18, 2)
                    tot = round(sub + gst, 2)
                    inv_sub += sub
                    inv_gst += gst
                    inv_tot += tot
                    inv_items.append({
                        "product_id": item.get("product_id"),
                        "product_name": item.get("product_name"),
                        "sku": item.get("sku"),
                        "size": item.get("size", ""),
                        "boxes": b_alloc,
                        "quantity": b_alloc,
                        "qty_per_box": item.get("qty_per_box", 1000),
                        "total_pcs": b_alloc * (item.get("qty_per_box", 1000) or 1000),
                        "rate": rate,
                        "subtotal": sub,
                        "gst": gst,
                        "total": tot
                    })
            
            if inv_items:
                update_fields["invoices"] = [{
                    "invoice_no": inv_no,
                    "date": now_iso()[:10],
                    "subtotal": round(inv_sub, 2),
                    "gst": round(inv_gst, 2),
                    "amount": round(inv_tot, 2),
                    "linked_by": "admin_approval",
                    "items_billed": inv_items
                }]
    if payload.notes is not None:
        update_fields["notes"] = payload.notes
    if payload.carrier is not None:
        update_fields["carrier"] = payload.carrier
    if payload.tracking_no is not None:
        update_fields["tracking_no"] = payload.tracking_no
    if payload.dispatch_date is not None:
        update_fields["dispatch_date"] = payload.dispatch_date
    elif new_status == "shipped" and not doc.get("dispatch_date"):
        update_fields["dispatch_date"] = now_iso()[:10]

    delivery_days = payload.delivery_days_total or doc.get("delivery_days_total") or 7
    update_fields["delivery_days_total"] = int(delivery_days)
    
    if payload.estimated_delivery_days is not None:
        update_fields["estimated_delivery_days"] = payload.estimated_delivery_days
    else:
        update_fields["estimated_delivery_days"] = f"{delivery_days} Days"

    # Compute target delivery date for countdown
    disp_date_str = update_fields.get("dispatch_date") or doc.get("dispatch_date") or now_iso()[:10]
    try:
        disp_dt = datetime.fromisoformat(str(disp_date_str)[:10])
        target_dt = disp_dt + timedelta(days=int(delivery_days))
        update_fields["target_delivery_date"] = payload.target_delivery_date or target_dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    await db.orders.update_one({"_id": doc["_id"]}, {"$set": update_fields})
    await db.audit_logs.insert_one({
        "actor_id": user["id"], "actor_email": user.get("email", "system"),
        "action": "order.status" if payload.status else "order.delivery_update",
        "target": doc["order_no"],
        "meta": {
            "from": old_status,
            "to": new_status,
            "tracking_no": update_fields.get("tracking_no", doc.get("tracking_no")),
            "delivery_days_total": delivery_days,
            "target_delivery_date": update_fields.get("target_delivery_date")
        },
        "created_at": now_iso(),
    })
    doc.update(update_fields)
    enriched = await _enrich_orders([doc])
    return enriched[0]


@router.post("/orders/{order_id}/partial-bill")
async def record_partial_billing(order_id: str, payload: OrderPartialBillingIn,
                                 admin: dict = Depends(require_admin)):
    """Admin records partial billing / dispatch against an order line by line."""
    try:
        oid = ObjectId(order_id)
        doc = await db.orders.find_one({"_id": oid})
    except Exception:
        doc = await db.orders.find_one({"_id": order_id})
        oid = order_id

    if not doc:
        raise HTTPException(404, "Order not found")

    items = doc.get("items", [])
    bill_map = {b.product_id: b.quantity_to_bill for b in payload.items}
    
    updated_items = []
    total_subtotal_now = 0.0
    total_gst_now = 0.0
    total_billed_now = 0.0
    items_billed_out = []
    all_completed = True

    for it in items:
        pid = it["product_id"]
        qty_per_b = it.get("qty_per_box") or 1000
        b_ord = it.get("boxes") if it.get("boxes") is not None else (it.get("quantity_ordered") or it.get("quantity") or 0)
        b_prev_inv = it.get("boxes_invoiced") if it.get("boxes_invoiced") is not None else (it.get("quantity_invoiced") or 0)
        
        b_item = next((b for b in payload.items if b.product_id == pid), None)
        if b_item:
            bill_boxes = b_item.boxes_to_bill if (b_item.boxes_to_bill is not None and b_item.boxes_to_bill > 0) else (b_item.quantity_to_bill or 0)
        else:
            bill_boxes = 0

        new_inv_boxes = min(b_ord, b_prev_inv + bill_boxes)
        new_pending_boxes = max(0, b_ord - new_inv_boxes)

        if new_pending_boxes > 0:
            all_completed = False

        it["boxes_invoiced"] = new_inv_boxes
        it["boxes_pending"] = new_pending_boxes
        it["quantity_invoiced"] = new_inv_boxes
        it["quantity_pending"] = new_pending_boxes
        updated_items.append(it)

        if bill_boxes > 0:
            rate = it.get("rate") or it.get("dealer_landing") or 0
            sub = round(rate * bill_boxes, 2)
            gst = round(sub * 0.18, 2)
            tot = round(sub + gst, 2)

            total_subtotal_now += sub
            total_gst_now += gst
            total_billed_now += tot

            items_billed_out.append({
                "product_id": pid,
                "product_name": it.get("product_name"),
                "sku": it.get("sku"),
                "size": it.get("size", ""),
                "boxes": bill_boxes,
                "quantity": bill_boxes,
                "qty_per_box": qty_per_b,
                "total_pcs": bill_boxes * qty_per_b,
                "rate": rate,
                "subtotal": sub,
                "gst": gst,
                "total": tot
            })

    inv_number = payload.invoice_no or f"INV-{doc['order_no'].replace('ORD-', '')}-P{len(doc.get('invoices', [])) + 1}"
    new_invoice_entry = {
        "invoice_no": inv_number,
        "date": now_iso()[:10],
        "subtotal": round(total_subtotal_now, 2),
        "gst": round(total_gst_now, 2),
        "amount": round(total_billed_now, 2),
        "linked_by": "admin_partial_billing",
        "notes": payload.notes or "",
        "items_billed": items_billed_out
    }

    invoices = doc.get("invoices", [])
    invoices.append(new_invoice_entry)

    next_status = "delivered" if all_completed else "partially_fulfilled"

    await db.orders.update_one(
        {"_id": doc["_id"]},
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


@router.put("/orders/{order_id}/warehouse")
@router.patch("/orders/{order_id}/warehouse")
async def update_order_warehouse(order_id: str, payload: WarehouseAssignmentIn,
                                 admin: dict = Depends(require_admin)):
    """Admin reassigns or manually selects the fulfillment warehouse for an order."""
    try:
        oid = ObjectId(order_id)
        doc = await db.orders.find_one({"_id": oid})
    except Exception:
        doc = await db.orders.find_one({"_id": order_id})
        oid = order_id

    if not doc:
        raise HTTPException(404, "Order not found")

    wh_id = payload.warehouse_id
    wh_doc = None
    if ObjectId.is_valid(wh_id):
        wh_doc = await db.warehouses.find_one({"_id": ObjectId(wh_id)})
    if not wh_doc:
        wh_doc = await db.warehouses.find_one({"_id": wh_id})
    if not wh_doc:
        wh_doc = await db.warehouses.find_one({"code": wh_id})
    if not wh_doc:
        raise HTTPException(404, "Target warehouse not found")

    old_wh_id = str(doc.get("warehouse_id", ""))
    new_wh_id = str(wh_doc["_id"])

    # Reconcile inventory reservations across warehouses for active orders
    if doc.get("status") in ["pending", "approved", "processing", "partially_fulfilled"]:
        for item in doc.get("items", []):
            p_id = item.get("product_id")
            qty_per_b = item.get("qty_per_box") or 1000
            q_alloc = item.get("quantity_allocated") or item.get("quantity", 0)
            allocated_boxes = item.get("boxes_allocated") or (int(math.ceil(q_alloc / qty_per_b)) if qty_per_b else q_alloc)
            if allocated_boxes > 0:
                if old_wh_id and old_wh_id != "default":
                    await db.inventory.update_one(
                        {"warehouse_id": old_wh_id, "product_id": p_id},
                        {"$inc": {"reserved": -allocated_boxes}}
                    )
                await db.inventory.update_one(
                    {"warehouse_id": new_wh_id, "product_id": p_id},
                    {"$inc": {"reserved": allocated_boxes}, "$set": {"updated_at": now_iso()}},
                    upsert=True
                )

    await db.orders.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "warehouse_id": new_wh_id,
            "warehouse_name": wh_doc.get("name"),
            "warehouse_code": wh_doc.get("code"),
            "allocation_method": "admin_selected",
            "updated_at": now_iso()
        }}
    )

    await db.audit_logs.insert_one({
        "actor_id": admin["id"], "actor_email": admin.get("email", "admin"),
        "action": "order.warehouse_reassign", "target": doc["order_no"],
        "meta": {"from_warehouse": old_wh_id, "to_warehouse": new_wh_id, "warehouse_name": wh_doc.get("name")},
        "created_at": now_iso(),
    })

    updated = await db.orders.find_one({"_id": doc["_id"]})
    enriched = await _enrich_orders([updated])
    return enriched[0]


@router.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user)):
    """Invoices are only issued to the dealer / buyer after Admin approval."""
    query = {
        "status": {"$in": ["approved", "processing", "shipped", "delivered"]}
    }
    role = user.get("role")

    if role == "dealer":
        uid = str(user.get("id") or user.get("_id") or "")
        match_conditions = [{"dealer_id": uid}, {"user_id": uid}]
        if ObjectId.is_valid(uid):
            match_conditions.append({"dealer_id": ObjectId(uid)})
        if user.get("email"):
            match_conditions.append({"dealer_email": user["email"]})
        if user.get("user_code"):
            match_conditions.append({"dealer_code": user["user_code"]})
        query["$and"] = [{"$or": match_conditions}]
    elif role in ("cnf", "mnp"):
        dealers = await db.users.find({
            "role": "dealer",
            "$or": [{"cnf_id": user["id"]}, {"mnp_id": user["id"]}]
        }).to_list(500)
        sub_dealer_ids = [str(d["_id"]) for d in dealers]
        query["$and"] = [{
            "$or": [
                {"dealer_id": {"$in": sub_dealer_ids + [user["id"]]}},
                {"cnf_id": user["id"]},
                {"mnp_id": user["id"]}
            ]
        }]

    docs = await db.orders.find(query).sort("created_at", -1).to_list(1000)
    enriched = await _enrich_orders(docs)
    return enriched


@router.post("/orders/{order_id}/reallocate")
async def reallocate_order_stock(order_id: str, admin: dict = Depends(require_admin)):
    """Admin manually triggers stock re-allocation evaluation against live inventory for an order."""
    try:
        oid = ObjectId(order_id)
        doc = await db.orders.find_one({"_id": oid})
    except Exception:
        doc = await db.orders.find_one({"_id": order_id})
        oid = order_id

    if not doc:
        raise HTTPException(404, "Order not found")

    wh_id = str(doc.get("warehouse_id", ""))
    items = doc.get("items", [])
    deficits = []
    updated_items = []
    total_demanded_pcs = 0
    total_allocated_pcs = 0

    for item in items:
        p_id = item.get("product_id")
        qty_per_box = item.get("qty_per_box") or 1000
        demanded_boxes = item.get("boxes") if item.get("boxes") is not None else (item.get("quantity_ordered") if item.get("quantity_ordered") is not None else (item.get("quantity") or 0))
        demanded_pcs = demanded_boxes * qty_per_box
        
        old_allocated_boxes = item.get("boxes_allocated") if item.get("boxes_allocated") is not None else (item.get("quantity_allocated") if item.get("quantity_allocated") is not None else (demanded_boxes if doc.get("reservation_status") == "reserved" else 0))
        total_demanded_pcs += demanded_boxes

        inv = await db.inventory.find_one({"warehouse_id": wh_id, "product_id": p_id})
        on_hand_boxes = inv.get("quantity", 0) if inv else 0
        reserved_boxes = inv.get("reserved", 0) if inv else 0
        # Available stock excluding old reservation for this order item
        avail_boxes = max(0, (on_hand_boxes - reserved_boxes) + old_allocated_boxes)

        if avail_boxes >= demanded_boxes:
            new_alloc_boxes = demanded_boxes
            new_alloc_pcs = demanded_pcs
            def_boxes = 0
            def_pcs = 0
        elif avail_boxes > 0:
            new_alloc_boxes = avail_boxes
            new_alloc_pcs = new_alloc_boxes * qty_per_box
            def_boxes = demanded_boxes - new_alloc_boxes
            def_pcs = def_boxes * qty_per_box
            deficits.append({
                "product_id": p_id,
                "product_name": item.get("product_name"),
                "sku": item.get("sku"),
                "required_boxes": demanded_boxes,
                "available_boxes": avail_boxes,
                "allocated_boxes": new_alloc_boxes,
                "deficit_boxes": def_boxes,
                "required": demanded_pcs,
                "allocated": new_alloc_pcs,
                "deficit": def_pcs,
            })
        else:
            new_alloc_boxes = 0
            new_alloc_pcs = 0
            def_boxes = demanded_boxes
            def_pcs = demanded_pcs
            deficits.append({
                "product_id": p_id,
                "product_name": item.get("product_name"),
                "sku": item.get("sku"),
                "required_boxes": demanded_boxes,
                "available_boxes": 0,
                "allocated_boxes": 0,
                "deficit_boxes": def_boxes,
                "required": demanded_pcs,
                "available": 0,
                "allocated": 0,
                "deficit": def_pcs,
            })

        # Update reservation delta in inventory
        box_diff = new_alloc_boxes - old_allocated_boxes
        if box_diff != 0:
            await db.inventory.update_one(
                {"warehouse_id": wh_id, "product_id": p_id},
                {"$inc": {"reserved": box_diff}, "$set": {"updated_at": now_iso()}},
                upsert=True
            )

        total_allocated_pcs += new_alloc_boxes

        item["quantity"] = demanded_boxes
        item["quantity_ordered"] = demanded_boxes
        item["quantity_allocated"] = new_alloc_boxes
        item["quantity_pending"] = def_boxes
        item["boxes"] = demanded_boxes
        item["boxes_allocated"] = new_alloc_boxes
        item["boxes_pending"] = def_boxes
        item["total_pcs"] = demanded_pcs
        item["allocated_pcs"] = new_alloc_pcs
        item["pending_pcs"] = def_pcs
        updated_items.append(item)

    reservation_status = "reserved" if total_allocated_pcs == total_demanded_pcs else ("partially_reserved" if total_allocated_pcs > 0 else "pending")

    await db.orders.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "items": updated_items,
            "deficits": deficits,
            "reservation_status": reservation_status,
            "updated_at": now_iso()
        }}
    )

    await db.audit_logs.insert_one({
        "actor_id": admin["id"], "actor_email": admin.get("email", "admin"),
        "action": "order.reallocate", "target": doc.get("order_no"),
        "meta": {"reservation_status": reservation_status, "deficits_count": len(deficits)},
        "created_at": now_iso(),
    })

    updated = await db.orders.find_one({"_id": doc["_id"]})
    enriched = await _enrich_orders([updated])
    return enriched[0]
