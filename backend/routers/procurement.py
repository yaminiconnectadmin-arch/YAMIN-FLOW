"""Procurement engine + Purchase Orders + Intelligent Order Collation & Weight Matrix."""
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin
from models import PurchaseOrderIn, POStatusUpdate, WeightMatrixItem

router = APIRouter(tags=["procurement"])


import urllib.parse
from datetime import datetime, timezone

class CollateTriggerIn(BaseModel):
    triggered_by: str = "manual"


class ApproveSupplierPOIn(BaseModel):
    supplier_id: str
    warehouse_id: Optional[str] = None
    custom_phone: Optional[str] = None
    notes: Optional[str] = None
    expected_delivery: Optional[str] = None


def clean_whatsapp_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    digits = "".join(c for c in str(phone) if c.isdigit())
    if len(digits) == 10:
        return "91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return digits
    return digits


def build_whatsapp_url(phone: Optional[str], text: str) -> str:
    clean_p = clean_whatsapp_phone(phone)
    encoded = urllib.parse.quote(text)
    if clean_p:
        return f"https://wa.me/{clean_p}?text={encoded}"
    return f"https://api.whatsapp.com/send?text={encoded}"


def generate_whatsapp_po_message(
    po_no: str,
    supplier_name: str,
    items: list,
    total_pcs: int,
    total_kg: float,
    subtotal: float,
    gst: float,
    total: float,
    warehouse_name: str = "Central Warehouse Hub"
) -> str:
    today_str = datetime.now(timezone.utc).strftime("%d %b %Y")
    lines = [
        "📦 *OFFICIAL PURCHASE ORDER — YAMINI FLOW*",
        f"*PO Number:* {po_no}",
        f"*Date:* {today_str}",
        f"*Supplier:* {supplier_name}",
        f"*Destination Hub:* {warehouse_name}",
        "",
        "📋 *COLLATED ITEMS & WEIGHT BREAKDOWN:*",
    ]
    for idx, it in enumerate(items, 1):
        name = it.get("product_name") or it.get("sku") or "Fastener Item"
        size = it.get("size") or ""
        sku = it.get("sku") or ""
        pcs = it.get("quantity") or it.get("demanded_pcs") or it.get("recommended_pcs") or 0
        kg = it.get("quantity_kg") or it.get("recommended_weight_kg") or 0.0
        wt1000 = it.get("wt_1000_pcs_kg") or it.get("weight_per_1000_pcs") or 0.0
        rate = it.get("rate") or 0.0
        amount = it.get("amount") or round(pcs * rate, 2)

        desc = f"{name}" if not size else f"{name} ({size})"
        lines.append(f"{idx}. *{desc}* [{sku}]")
        lines.append(f"   • Qty: {pcs:,.0f} Pcs | *Weight: {kg:,.2f} KG* (@ {wt1000:.2f} kg/1k pcs)")
        lines.append(f"   • Rate: ₹{rate:.2f}/pc | Amount: ₹{amount:,.2f}")

    lines.extend([
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"⚖️ *TOTAL COLLATED WEIGHT:* {total_kg:,.2f} KG",
        f"🔢 *TOTAL QUANTITY:* {total_pcs:,.0f} Pcs",
        f"💵 *SUBTOTAL (Basic):* ₹{subtotal:,.2f}",
        f"🏷️ *GST (18%):* ₹{gst:,.2f}",
        f"💰 *GRAND TOTAL:* ₹{total:,.2f}",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "🚚 *Instructions:*",
        "1. Please verify fastener sizes and collated weights.",
        "2. Confirm production schedule and share LR Docket tracking upon dispatch.",
        "3. Share e-Way bill and Tax Invoice copy.",
        "",
        "_Generated via Yamini Flow Intelligent Procurement & Collation Engine._"
    ])
    return "\n".join(lines)


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
    """Analyze pending/approved/partially_fulfilled orders that haven't been fully collated into weight-based supplier POs."""
    uncollated = await db.orders.find({
        "status": {"$in": ["pending", "approved", "partially_fulfilled"]}
    }).to_list(5000)

    total_orders = len(uncollated)
    dealer_ids = {o.get("dealer_id") for o in uncollated if o.get("dealer_id") and ObjectId.is_valid(o.get("dealer_id"))}
    dealers = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": [ObjectId(x) for x in dealer_ids]}}).to_list(1000)} if dealer_ids else {}
    mnp_ids = {u.get("mnp_id") for u in dealers.values() if u.get("mnp_id") and ObjectId.is_valid(u.get("mnp_id"))}
    mnps = {str(m["_id"]): m for m in await db.users.find({"_id": {"$in": [ObjectId(x) for x in mnp_ids]}}).to_list(1000)} if mnp_ids else {}

    demanded_boxes_map = {}
    demanded_pcs_map = {}
    dealer_codes_map = {}
    mnp_codes_map = {}
    order_breakdown_map = {}   # pid -> list of {order_no, dealer_code, dealer_name, order_status, qty_pending, qty_allocated, qty_ordered}
    filtered_orders_count = set()

    for o in uncollated:
        dlr = dealers.get(o.get("dealer_id"))
        d_code = o.get("dealer_code")
        if not d_code and dlr:
            d_code = dlr.get("user_code") or dlr.get("login_id")
        if not d_code:
            d_code = "D-UNKNOWN"

        d_name = o.get("dealer_name") or (dlr.get("company") or dlr.get("name")) if dlr else d_code

        m_code = o.get("mnp_code")
        if not m_code and dlr:
            mid = str(dlr.get("mnp_id") or "")
            if mid and mid in mnps:
                m_code = mnps[mid].get("user_code") or mnps[mid].get("login_id")
            else:
                m_code = "DIRECT"
        if not m_code:
            m_code = "DIRECT"

        has_pending_items = False
        for item in o.get("items", []):
            pid = item["product_id"]
            qty_per_b = int(item.get("qty_per_box") or 1000)
            
            # Use unit normalizers
            q_ord = int(item.get("boxes") if item.get("boxes") is not None and int(item.get("boxes", 0)) > 0 else (item.get("quantity_ordered") if item.get("quantity_ordered") is not None else item.get("quantity", 0)))
            if q_ord >= 10000 and q_ord % qty_per_b == 0:
                q_ord = q_ord // qty_per_b
                
            q_alloc = int(item.get("boxes_allocated") if item.get("boxes_allocated") is not None else (item.get("quantity_allocated") or 0))
            if q_alloc >= 10000 and q_alloc % qty_per_b == 0:
                q_alloc = q_alloc // qty_per_b
                
            q_deficit_boxes = max(0, q_ord - q_alloc)
            
            if q_deficit_boxes > 0:
                has_pending_items = True
                q_deficit_pcs = q_deficit_boxes * qty_per_b
                demanded_boxes_map[pid] = demanded_boxes_map.get(pid, 0) + q_deficit_boxes
                demanded_pcs_map[pid] = demanded_pcs_map.get(pid, 0) + q_deficit_pcs

                if pid not in dealer_codes_map:
                    dealer_codes_map[pid] = set()
                    mnp_codes_map[pid] = set()
                    order_breakdown_map[pid] = []
                dealer_codes_map[pid].add(d_code)
                mnp_codes_map[pid].add(m_code)
                order_breakdown_map[pid].append({
                    "order_no": o.get("order_no", str(o.get("_id", ""))[:8]),
                    "dealer_code": d_code,
                    "dealer_name": d_name,
                    "cnf_code": m_code,
                    "order_status": o.get("status", "pending"),
                    "qty_ordered_boxes": q_ord,
                    "qty_allocated_boxes": q_alloc,
                    "qty_pending_boxes": q_deficit_boxes,
                    "qty_ordered_pcs": q_ord * qty_per_b,
                    "qty_allocated_pcs": q_alloc * qty_per_b,
                    "qty_pending_pcs": q_deficit_pcs,
                })

        if has_pending_items:
            filtered_orders_count.add(str(o["_id"]))

    total_orders = len(filtered_orders_count)

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

    for pid, deficit_pcs in demanded_pcs_map.items():
        p = prods.get(str(pid))
        if not p:
            if ObjectId.is_valid(str(pid)):
                p = await db.products.find_one({"_id": ObjectId(pid)})
            if not p:
                p = await db.products.find_one({"_id": str(pid)})
            if not p:
                p = await db.products.find_one({"sku": str(pid)})
        if not p:
            sample_ob = order_breakdown_map.get(pid, [{}])[0]
            p = {
                "name": sample_ob.get("product_name") or f"Fastener Product ({str(pid)[:6]})",
                "sku": sample_ob.get("sku") or str(pid)[:8],
                "category": "Fasteners",
                "size": "",
                "wt_1000_pcs_kg": 1.0,
                "price": 0
            }
        avail = inv_agg.get(pid, 0)
        safety = p.get("safety_stock", 0)
        procure_pcs = deficit_pcs
        procure_boxes = demanded_boxes_map.get(pid, 0)
        wt_1000 = p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000.0) or 1.0
        req_kg = round((procure_pcs / 1000.0) * wt_1000, 4)

        sid = p.get("primary_supplier_id")
        sup = suppliers.get(str(sid)) if sid else None

        rate = p.get("cost", 0) or p.get("price", 0)
        items_breakdown.append({
            "product_id": pid,
            "sku": p.get("sku", ""),
            "product_name": p.get("name", ""),
            "category": p.get("category", ""),
            "size": p.get("size", ""),
            "demanded_boxes": procure_boxes,
            "demanded_pcs": deficit_pcs,
            "available_pcs": avail,
            "safety_stock": safety,
            "recommended_boxes": procure_boxes,
            "recommended_pcs": procure_pcs,
            "wt_1000_pcs_kg": wt_1000,
            "recommended_weight_kg": req_kg,
            "supplier_id": str(sid) if sid else "",
            "supplier_name": (sup.get("company") or sup.get("name")) if sup else "Unassigned Supplier",
            "supplier_phone": sup.get("phone", "") if sup else "",
            "supplier_company": sup.get("company", "") if sup else "",
            "rate": rate,
            "amount": round(procure_boxes * rate, 2),
            "dealer_codes": sorted(list(dealer_codes_map.get(pid, []))),
            "cnf_codes": sorted(list(mnp_codes_map.get(pid, []))),
            "mnp_codes": sorted(list(mnp_codes_map.get(pid, []))),
            "dealer_summary": ", ".join(sorted(list(dealer_codes_map.get(pid, [])))),
            "cnf_summary": ", ".join(sorted(list(mnp_codes_map.get(pid, [])))),
            "mnp_summary": ", ".join(sorted(list(mnp_codes_map.get(pid, [])))),
            "order_breakdown": order_breakdown_map.get(pid, []),
        })
        total_pcs += procure_pcs
        total_kg += req_kg

    items_breakdown.sort(key=lambda x: -x["recommended_weight_kg"])

    # Group items by Supplier for direct PO generation & WhatsApp dispatch
    by_supplier_map = {}
    for it in items_breakdown:
        sid = it["supplier_id"] or "unassigned"
        if sid not in by_supplier_map:
            sup = suppliers.get(sid)
            s_name = it["supplier_name"]
            s_phone = sup.get("phone", "") if sup else it.get("supplier_phone", "")
            s_company = sup.get("company", "") if sup else s_name
            s_email = sup.get("email", "") if sup else ""
            s_city = sup.get("city", "") if sup else ""
            s_state = sup.get("state", "") if sup else ""
            s_gstin = sup.get("gstin", "") if sup else ""
            by_supplier_map[sid] = {
                "supplier_id": sid,
                "supplier_name": s_name,
                "company": s_company,
                "phone": s_phone,
                "email": s_email,
                "city": s_city,
                "state": s_state,
                "gstin": s_gstin,
                "items": [],
                "total_pcs": 0,
                "total_kg": 0.0,
                "subtotal": 0.0,
                "gst": 0.0,
                "total": 0.0,
            }
        pcs = it["recommended_pcs"]
        kg = it["recommended_weight_kg"]
        amt = round(pcs * it["rate"], 2)
        by_supplier_map[sid]["items"].append({
            **it,
            "quantity": pcs,
            "quantity_kg": kg,
            "amount": amt,
        })
        by_supplier_map[sid]["total_pcs"] += pcs
        by_supplier_map[sid]["total_kg"] = round(by_supplier_map[sid]["total_kg"] + kg, 2)
        by_supplier_map[sid]["subtotal"] = round(by_supplier_map[sid]["subtotal"] + amt, 2)

    po_count = await db.purchase_orders.count_documents({})
    by_supplier_list = []
    for idx, (sid, s_data) in enumerate(by_supplier_map.items()):
        sub = s_data["subtotal"]
        gst_amt = round(sub * 0.18, 2)
        tot = round(sub + gst_amt, 2)
        s_data["gst"] = gst_amt
        s_data["total"] = tot
        draft_po = f"PO-2026{(po_count + idx + 1):04d}"
        s_data["draft_po_no"] = draft_po
        msg = generate_whatsapp_po_message(
            po_no=draft_po,
            supplier_name=s_data["supplier_name"],
            items=s_data["items"],
            total_pcs=s_data["total_pcs"],
            total_kg=s_data["total_kg"],
            subtotal=sub,
            gst=gst_amt,
            total=tot,
            warehouse_name="Central Warehouse Hub"
        )
        s_data["whatsapp_message"] = msg
        s_data["whatsapp_url"] = build_whatsapp_url(s_data["phone"], msg)
        by_supplier_list.append(s_data)

    return {
        "total_orders": total_orders,
        "total_demanded_pcs": total_pcs,
        "estimated_total_kg": round(total_kg, 2),
        "items": items_breakdown,
        "by_supplier": by_supplier_list,
    }


# ================== CORE COLLATION ENGINE ==================
async def execute_order_collation(triggered_by: str = "manual", actor: Optional[dict] = None) -> dict:
    """Core logic: aggregates uncollated/partially-fulfilled orders, computes kg weight, creates grouped supplier POs."""
    uncollated = await db.orders.find({
        "status": {"$in": ["pending", "approved", "partially_fulfilled"]}
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

    # Sum unfulfilled deficit demand per product (units left for replenishment)
    demanded_pcs_map = {}
    for o in uncollated:
        for item in o.get("items", []):
            pid = item["product_id"]
            qty_per_b = item.get("qty_per_box") or 1000
            q_ord = item.get("boxes") if item.get("boxes") is not None else (item.get("quantity_ordered") or item.get("quantity", 0))
            q_alloc = item.get("boxes_allocated") if item.get("boxes_allocated") is not None else (item.get("quantity_allocated") or 0)
            q_deficit_boxes = item.get("boxes_pending") if item.get("boxes_pending") is not None else item.get("quantity_pending")
            if q_deficit_boxes is None:
                q_deficit_boxes = max(0, q_ord - q_alloc)
            if q_deficit_boxes > 0:
                q_deficit_pcs = q_deficit_boxes * qty_per_b
                demanded_pcs_map[pid] = demanded_pcs_map.get(pid, 0) + q_deficit_pcs

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

    for pid, deficit_demand in demanded_pcs_map.items():
        p = prods.get(str(pid))
        if not p:
            if ObjectId.is_valid(str(pid)):
                p = await db.products.find_one({"_id": ObjectId(pid)})
            if not p:
                p = await db.products.find_one({"_id": str(pid)})
            if not p:
                p = await db.products.find_one({"sku": str(pid)})
        if not p:
            p = {"name": f"Fastener Product ({str(pid)[:6]})", "sku": str(pid)[:8], "wt_1000_pcs_kg": 1.0, "cost": 0, "price": 0}
        procure_pcs = deficit_demand
        if procure_pcs <= 0:
            continue

        wt_1000 = p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000.0) or 1.0
        req_kg = round((procure_pcs / 1000.0) * wt_1000, 4)

        sid = p.get("primary_supplier_id") or "unassigned"
        if sid not in by_supplier:
            by_supplier[sid] = []

        rate = p.get("cost", 0) or p.get("price", 0)
        by_supplier[sid].append({
            "product_id": pid,
            "product_name": p.get("name", ""),
            "sku": p.get("sku", ""),
            "quantity": procure_pcs,
            "quantity_kg": req_kg,
            "weight_per_1000_pcs": wt_1000,
            "rate": rate,
            "amount": round(procure_pcs * rate, 2),
        })
        total_pcs += procure_pcs
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

    if total_pcs <= 0 or total_kg <= 0:
        return {
            "status": "noop",
            "batch_no": None,
            "message": "All pending order items have already been collated into supplier POs.",
            "orders_count": 0,
            "po_count": 0,
            "total_pcs": 0,
            "total_kg": 0.0
        }

    # Flatten collated items for historical inspection
    collated_items_flat = []
    for sid, items in by_supplier.items():
        sup_name = supplier_users.get(sid, {}).get("company") or supplier_users.get(sid, {}).get("name", "Assigned Supplier") if sid in supplier_users else "Unassigned Supplier"
        for it in items:
            collated_items_flat.append({
                **it,
                "supplier_id": sid,
                "supplier_name": sup_name
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
        "items": collated_items_flat,
        "orders_breakdown": [
            {
                "order_no": o.get("order_no", str(o.get("_id", ""))[:8]),
                "dealer_code": o.get("dealer_code", "D-ASSIGNED"),
                "dealer_name": o.get("dealer_name", "Distributor"),
                "status": o.get("status", "processing"),
            } for o in uncollated
        ],
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
        "message": f"Collated {len(uncollated)} orders into {len(po_ids)} weight POs ({total_kg:.2f} KG total).",
        "orders_count": len(uncollated),
        "po_count": len(po_ids),
        "po_nos": po_nos,
        "total_pcs": total_pcs,
        "total_kg": round(total_kg, 2),
        "items": collated_items_flat
    }


@router.get("/procurement/collations/{batch_no}")
async def get_collation_batch_details(batch_no: str, user: dict = Depends(get_current_user)):
    """Fetch complete collated items matrix, weight breakdown, and source orders for a historical collation batch."""
    b = await db.collations.find_one({"batch_no": batch_no})
    if not b:
        raise HTTPException(404, f"Collation batch {batch_no} not found")
    return serialize_doc(b)


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

    # Pending demand from pending / partially_fulfilled orders — count DEFICIT only, not full quantity
    pending_orders = await db.orders.find({"status": {"$in": ["pending", "approved", "partially_fulfilled"]}}).to_list(1000)
    demand = {}
    for o in pending_orders:
        for item in o.get("items", []):
            q_ord = item.get("quantity_ordered") or item.get("quantity", 0)
            q_alloc = item.get("quantity_allocated") or 0
            q_deficit = item.get("quantity_pending")
            if q_deficit is None:
                q_deficit = max(0, q_ord - q_alloc)
            demand[item["product_id"]] = demand.get(item["product_id"], 0) + q_deficit

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


@router.post("/procurement/approve-supplier-po")
async def approve_supplier_po(payload: ApproveSupplierPOIn, admin: dict = Depends(require_admin)):
    """Approve collated items for a single supplier, generate official PO, update source orders, and create WhatsApp redirection."""
    uncollated = await db.orders.find({
        "status": {"$in": ["pending", "approved", "partially_fulfilled"]}
    }).to_list(5000)

    if not uncollated:
        raise HTTPException(400, "No pending uncollated orders found to generate PO")

    # Demanded replenishment deficit per product
    demanded_pcs_map = {}
    for o in uncollated:
        for item in o.get("items", []):
            pid = item["product_id"]
            qty_per_b = item.get("qty_per_box") or 1000
            q_ord = item.get("boxes") if item.get("boxes") is not None else (item.get("quantity_ordered") or item.get("quantity", 0))
            q_alloc = item.get("boxes_allocated") if item.get("boxes_allocated") is not None else (item.get("quantity_allocated") or 0)
            q_deficit_boxes = item.get("boxes_pending") if item.get("boxes_pending") is not None else item.get("quantity_pending")
            if q_deficit_boxes is None:
                q_deficit_boxes = max(0, q_ord - q_alloc)
            if q_deficit_boxes > 0:
                q_deficit_pcs = q_deficit_boxes * qty_per_b
                demanded_pcs_map[pid] = demanded_pcs_map.get(pid, 0) + q_deficit_pcs

    prod_ids = [ObjectId(pid) for pid in demanded_pcs_map.keys() if ObjectId.is_valid(pid)]
    prods = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(1000)}
    inv_docs = await db.inventory.find({}).to_list(5000)
    inv_agg = {}
    for idx in inv_docs:
        pid = idx["product_id"]
        inv_agg[pid] = inv_agg.get(pid, 0) + max(0, idx.get("quantity", 0) - idx.get("reserved", 0))

    # Supplier details
    supplier = None
    if payload.supplier_id and payload.supplier_id != "unassigned" and ObjectId.is_valid(payload.supplier_id):
        supplier = await db.users.find_one({"_id": ObjectId(payload.supplier_id)})

    sup_name = (supplier.get("company") or supplier.get("name")) if supplier else "Assigned Supplier"
    sup_phone = payload.custom_phone or (supplier.get("phone") if supplier else "")

    supplier_items = []
    total_pcs = 0
    total_kg = 0.0

    for pid, deficit_demand in demanded_pcs_map.items():
        p = prods.get(pid)
        if not p:
            continue
        p_sup = str(p.get("primary_supplier_id") or "unassigned")
        if payload.supplier_id != "all" and p_sup != payload.supplier_id:
            continue

        procure_pcs = deficit_demand
        if procure_pcs <= 0:
            continue

        wt_1000 = p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000.0) or 1.0
        req_kg = round((procure_pcs / 1000.0) * wt_1000, 4)
        rate = p.get("cost", 0) or p.get("price", 0)
        amt = round(procure_pcs * rate, 2)

        supplier_items.append({
            "product_id": pid,
            "product_name": p.get("name", ""),
            "category": p.get("category", ""),
            "size": p.get("size", ""),
            "sku": p.get("sku", ""),
            "quantity": procure_pcs,
            "quantity_kg": req_kg,
            "weight_per_1000_pcs": wt_1000,
            "wt_1000_pcs_kg": wt_1000,
            "rate": rate,
            "amount": amt,
        })
        total_pcs += procure_pcs
        total_kg += req_kg

    if not supplier_items:
        raise HTTPException(400, f"No collated items found for supplier {sup_name}")

    subtotal = sum(i["amount"] for i in supplier_items)
    gst = round(subtotal * 0.18, 2)
    grand_total = round(subtotal + gst, 2)

    # Warehouse resolution
    wh_id = payload.warehouse_id
    wh_name = "Central Warehouse Hub"
    wh_address = "Sector 18, Industrial Area, Bhiwandi, Maharashtra"
    if wh_id and ObjectId.is_valid(wh_id):
        wh = await db.warehouses.find_one({"_id": ObjectId(wh_id)})
        if wh:
            wh_name = f"{wh.get('name')} ({wh.get('code')})"
            wh_address = f"{wh.get('address', '')}, {wh.get('city', '')} {wh.get('state', '')}"
    else:
        warehouses = await db.warehouses.find({}).to_list(5)
        if warehouses:
            wh_id = str(warehouses[0]["_id"])
            wh_name = f"{warehouses[0].get('name')} ({warehouses[0].get('code')})"
            wh_address = f"{warehouses[0].get('address', '')}, {warehouses[0].get('city', '')} {warehouses[0].get('state', '')}"

    po_count = await db.purchase_orders.count_documents({})
    po_no = f"PO-2026{(po_count + 1):04d}"

    msg = generate_whatsapp_po_message(
        po_no=po_no,
        supplier_name=sup_name,
        items=supplier_items,
        total_pcs=total_pcs,
        total_kg=round(total_kg, 2),
        subtotal=subtotal,
        gst=gst,
        total=grand_total,
        warehouse_name=wh_name
    )
    whatsapp_url = build_whatsapp_url(sup_phone, msg)

    po_doc = {
        "po_no": po_no,
        "supplier_id": payload.supplier_id if payload.supplier_id != "unassigned" else "",
        "supplier_name": sup_name,
        "supplier_phone": sup_phone,
        "supplier_company": supplier.get("company") if supplier else sup_name,
        "supplier_email": supplier.get("email", "") if supplier else "",
        "supplier_gstin": supplier.get("gstin", "") if supplier else "",
        "supplier_city": supplier.get("city", "") if supplier else "",
        "supplier_state": supplier.get("state", "") if supplier else "",
        "warehouse_id": wh_id or "",
        "warehouse_name": wh_name,
        "warehouse_address": wh_address,
        "items": supplier_items,
        "subtotal": round(subtotal, 2),
        "gst": gst,
        "total": grand_total,
        "total_weight_kg": round(total_kg, 2),
        "total_pieces": total_pcs,
        "status": "sent",
        "expected_delivery": payload.expected_delivery or "",
        "notes": payload.notes or f"Approved via Collation Engine for {sup_name}",
        "whatsapp_url": whatsapp_url,
        "whatsapp_message": msg,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.purchase_orders.insert_one(po_doc)
    po_doc["_id"] = res.inserted_id

    # Mark corresponding dealer orders as collated & processing
    supplier_prod_ids = set(i["product_id"] for i in supplier_items)
    affected_order_ids = []
    for o in uncollated:
        for item in o.get("items", []):
            if item["product_id"] in supplier_prod_ids:
                affected_order_ids.append(o["_id"])
                break

    if affected_order_ids:
        await db.orders.update_many(
            {"_id": {"$in": affected_order_ids}},
            {"$set": {
                "collated": True,
                "status": "processing",
                "updated_at": now_iso()
            }}
        )

    # Audit & Notification
    await db.audit_logs.insert_one({
        "actor_id": admin["id"],
        "actor_email": admin["email"],
        "action": "procurement.approve_supplier_po",
        "target": po_no,
        "meta": {"supplier": sup_name, "total_kg": round(total_kg, 2), "total": grand_total},
        "created_at": now_iso(),
    })

    return {
        "success": True,
        "po": serialize_doc(po_doc),
        "po_no": po_no,
        "whatsapp_url": whatsapp_url,
        "whatsapp_message": msg,
        "total_kg": round(total_kg, 2),
        "total_pcs": total_pcs,
        "total": grand_total,
        "supplier_name": sup_name,
        "supplier_phone": sup_phone,
    }


@router.get("/purchase-orders")
async def list_purchase_orders(status: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "supplier":
        query["supplier_id"] = user["id"]
    if status:
        query["status"] = status
    docs = await db.purchase_orders.find(query).sort("created_at", -1).to_list(1000)
    
    # Enrich docs with whatsapp_url and total_weight_kg if missing
    for d in docs:
        if not d.get("total_weight_kg"):
            d["total_weight_kg"] = round(sum(i.get("quantity_kg", 0) for i in d.get("items", [])), 2)
        if not d.get("whatsapp_url") and d.get("supplier_phone"):
            msg = d.get("whatsapp_message") or generate_whatsapp_po_message(
                po_no=d.get("po_no", ""),
                supplier_name=d.get("supplier_name", ""),
                items=d.get("items", []),
                total_pcs=sum(i.get("quantity", 0) for i in d.get("items", [])),
                total_kg=d.get("total_weight_kg", 0.0),
                subtotal=d.get("subtotal", 0.0),
                gst=d.get("gst", 0.0),
                total=d.get("total", 0.0),
                warehouse_name=d.get("warehouse_name", "Central Warehouse Hub")
            )
            d["whatsapp_message"] = msg
            d["whatsapp_url"] = build_whatsapp_url(d.get("supplier_phone"), msg)
            
    return serialize_docs(docs)


@router.get("/purchase-orders/{po_id}")
async def get_po(po_id: str, user: dict = Depends(get_current_user)):
    doc = await db.purchase_orders.find_one({"_id": ObjectId(po_id)})
    if not doc:
        raise HTTPException(404, "Not found")
    if user["role"] == "supplier" and str(doc.get("supplier_id")) != user["id"]:
        raise HTTPException(403, "Forbidden")
    if not doc.get("total_weight_kg"):
        doc["total_weight_kg"] = round(sum(i.get("quantity_kg", 0) for i in doc.get("items", [])), 2)
    if not doc.get("whatsapp_url") and doc.get("supplier_phone"):
        msg = doc.get("whatsapp_message") or generate_whatsapp_po_message(
            po_no=doc.get("po_no", ""),
            supplier_name=doc.get("supplier_name", ""),
            items=doc.get("items", []),
            total_pcs=sum(i.get("quantity", 0) for i in doc.get("items", [])),
            total_kg=doc.get("total_weight_kg", 0.0),
            subtotal=doc.get("subtotal", 0.0),
            gst=doc.get("gst", 0.0),
            total=doc.get("total", 0.0),
            warehouse_name=doc.get("warehouse_name", "Central Warehouse Hub")
        )
        doc["whatsapp_message"] = msg
        doc["whatsapp_url"] = build_whatsapp_url(doc.get("supplier_phone"), msg)
    return serialize_doc(doc)


@router.post("/purchase-orders")
async def create_po(payload: PurchaseOrderIn, admin: dict = Depends(require_admin)):
    prod_ids = [ObjectId(i.product_id) for i in payload.items if ObjectId.is_valid(i.product_id)]
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": prod_ids}}).to_list(500)}
    items_out = []
    total = 0
    total_kg = 0.0
    for i in payload.items:
        p = products.get(i.product_id)
        if not p:
            raise HTTPException(400, f"Product {i.product_id} not found")
        amount = i.quantity * i.rate
        wt_1000 = p.get("wt_1000_pcs_kg", 0.0) or (p.get("weight_kg", 0.0) * 1000.0) or 1.0
        qty_kg = i.quantity_kg if i.quantity_kg > 0 else round((i.quantity / 1000.0) * wt_1000, 4)
        items_out.append({
            "product_id": i.product_id, "product_name": p["name"],
            "sku": p["sku"], "size": p.get("size", ""), "category": p.get("category", ""),
            "quantity": i.quantity, "quantity_kg": qty_kg,
            "weight_per_1000_pcs": wt_1000, "rate": i.rate, "amount": amount
        })
        total += amount
        total_kg += qty_kg

    supplier = await db.users.find_one({"_id": ObjectId(payload.supplier_id)}) if ObjectId.is_valid(payload.supplier_id) else None
    if not supplier:
        raise HTTPException(400, "Supplier not found")
    po_no = await _po_number()

    # Warehouse info
    wh = await db.warehouses.find_one({"_id": ObjectId(payload.warehouse_id)}) if ObjectId.is_valid(payload.warehouse_id) else None
    wh_name = f"{wh.get('name')} ({wh.get('code')})" if wh else "Central Warehouse Hub"

    subtotal = total
    gst = round(total * 0.18, 2)
    grand_total = round(total * 1.18, 2)

    msg = generate_whatsapp_po_message(
        po_no=po_no,
        supplier_name=supplier.get("company") or supplier.get("name"),
        items=items_out,
        total_pcs=sum(i["quantity"] for i in items_out),
        total_kg=round(total_kg, 2),
        subtotal=subtotal,
        gst=gst,
        total=grand_total,
        warehouse_name=wh_name
    )
    whatsapp_url = build_whatsapp_url(supplier.get("phone"), msg)

    doc = {
        "po_no": po_no,
        "supplier_id": payload.supplier_id,
        "supplier_name": supplier.get("company") or supplier.get("name"),
        "supplier_phone": supplier.get("phone", ""),
        "supplier_company": supplier.get("company", ""),
        "supplier_gstin": supplier.get("gstin", ""),
        "warehouse_id": payload.warehouse_id,
        "warehouse_name": wh_name,
        "items": items_out,
        "subtotal": subtotal,
        "gst": gst,
        "total": grand_total,
        "total_weight_kg": round(total_kg, 2),
        "status": "draft",
        "expected_delivery": payload.expected_delivery or "",
        "notes": payload.notes or "",
        "whatsapp_url": whatsapp_url,
        "whatsapp_message": msg,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.purchase_orders.insert_one(doc)
    doc["_id"] = res.inserted_id

    await db.notifications.insert_one({
        "user_id": payload.supplier_id, "title": f"New Purchase Order {po_no}",
        "body": f"₹{doc['total']:.0f} — {len(items_out)} items ({total_kg:.2f} kg)",
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
