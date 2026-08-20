"""Voucher ↔ Order auto-linker.

When a Sales voucher arrives from Tally, try to link it to a pending/approved/shipped
Yamini order by matching (dealer party name, amount) with fuzzy tolerance.
"""
from __future__ import annotations
import re
from bson import ObjectId
from db import db, now_iso

# Corporate suffixes stripped before comparison
_STRIP_TOKENS = [
    "pvt ltd", "pvt. ltd", "pvt limited", "private limited", "private ltd",
    "limited", "ltd", "llp", "& co", "and co", "co.", "inc", "corp", "corporation",
    "enterprises", "traders", "trading", "stores", "distributors", "distribution",
    "agencies", "agency", "sons", "brothers", "bros",
]

AMOUNT_TOLERANCE = 0.01  # 1%


def _normalize_party(name: str) -> str:
    if not name:
        return ""
    s = name.lower().strip()
    s = re.sub(r"[.,]", " ", s)
    s = re.sub(r"\s+", " ", s)
    for tok in _STRIP_TOKENS:
        s = s.replace(f" {tok} ", " ").strip()
        if s.endswith(" " + tok):
            s = s[: -(len(tok) + 1)]
        if s.startswith(tok + " "):
            s = s[len(tok) + 1 :]
    return re.sub(r"\s+", " ", s).strip()


def _party_matches(a: str, b: str) -> bool:
    na, nb = _normalize_party(a), _normalize_party(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    # substring either direction — catches "Suresh Traders" vs "Suresh Traders Pvt Ltd"
    return na in nb or nb in na


def _amount_matches(a: float, b: float) -> bool:
    a, b = float(a or 0), float(b or 0)
    if a <= 0 or b <= 0:
        return False
    return abs(a - b) / max(a, b) <= AMOUNT_TOLERANCE


async def find_candidate_orders(party: str, amount: float, limit: int = 5, order_no: str | None = None) -> list[dict]:
    """Return up to `limit` orders that could match this voucher.

    Matches either by explicit order_no reference or (dealer party name, amount).
    """
    if order_no:
        direct = await db.orders.find_one({
            "order_no": order_no,
            "status": {"$in": ["approved", "processing", "shipped", "partially_fulfilled"]},
            "approved_at": {"$exists": True, "$ne": None}
        })
        if direct:
            return [direct]

    if not party or amount <= 0:
        return []

    # Fetch open approved orders (EXCLUDING PENDING orders)
    orders = await db.orders.find({
        "status": {"$in": ["approved", "processing", "shipped", "partially_fulfilled"]},
        "approved_at": {"$exists": True, "$ne": None}
    }).sort("created_at", -1).to_list(500)
    candidates = []
    for o in orders:
        if _party_matches(o.get("dealer_name", ""), party):
            # Matches exact total or partial billing amount
            if _amount_matches(o.get("total", 0), amount) or amount <= o.get("total", 0):
                candidates.append(o)
        if len(candidates) >= limit:
            break
    return candidates


async def auto_link_voucher(event: dict) -> dict:
    """Try to link an inbound Sales or Receipt voucher event to a Yamini order.

    Mutates and returns the event dict with link_status / matched_order_* fields.
    """
    vch_type = (event.get("voucher_type") or "").lower()
    if vch_type not in ("sales", "receipt"):
        event["link_status"] = "non_sales"
        return event

    party = event.get("party") or ""
    amount = float(event.get("amount") or 0)
    order_no = event.get("order_no") or event.get("reference")

    if not party and not order_no:
        event["link_status"] = "no_party"
        return event

    if vch_type == "sales":
        candidates = await find_candidate_orders(party, amount, limit=5, order_no=order_no)
        if len(candidates) == 0:
            event["link_status"] = "unmatched"
        elif len(candidates) > 1:
            event["link_status"] = "ambiguous"
            event["candidate_order_ids"] = [str(c["_id"]) for c in candidates]
        else:
            order = candidates[0]
            await _attach(order, event, auto=True)
            event["link_status"] = "linked"
            event["matched_order_id"] = str(order["_id"])
            event["matched_order_no"] = order.get("order_no")
    elif vch_type == "receipt":
        candidates = await find_candidate_receipt_orders(party, amount, limit=5)
        if len(candidates) == 0:
            event["link_status"] = "unmatched"
        elif len(candidates) > 1:
            event["link_status"] = "ambiguous"
            event["candidate_order_ids"] = [str(c["_id"]) for c in candidates]
        else:
            order = candidates[0]
            await _attach_receipt(order, event, auto=True)
            event["link_status"] = "linked"
            event["matched_order_id"] = str(order["_id"])
            event["matched_order_no"] = order.get("order_no")

    return event


async def find_candidate_receipt_orders(party: str, amount: float, limit: int = 5) -> list[dict]:
    """Return candidate orders for Receipt: status in (approved, shipped, delivered, partially_fulfilled) and payment_status != paid."""
    if not party or amount <= 0:
        return []
    orders = await db.orders.find({
        "status": {"$in": ["approved", "shipped", "delivered", "partially_fulfilled"]},
        "payment_status": {"$ne": "paid"},
    }).sort("created_at", -1).to_list(500)
    candidates = []
    for o in orders:
        if _party_matches(o.get("dealer_name", ""), party) and _amount_matches(o.get("total", 0), amount):
            candidates.append(o)
        if len(candidates) >= limit:
            break
    return candidates


async def _attach(order: dict, event: dict, auto: bool) -> None:
    """Write bidirectional link + partial fulfillment status & multi-invoice list."""
    invoice_entry = {
        "invoice_no": event.get("voucher_no"),
        "guid": event.get("guid"),
        "date": event.get("date"),
        "amount": float(event.get("amount") or 0),
        "items_billed": event.get("items", []),
        "linked_at": now_iso(),
        "linked_by": "auto" if auto else "manual",
    }

    # Calculate item-level quantities
    order_items = order.get("items", [])
    vch_items = event.get("items", [])
    total_ordered = 0
    total_invoiced = 0

    updated_items = []
    for item in order_items:
        q_ordered = int(item.get("quantity_ordered") or item.get("quantity") or 0)
        q_invoiced = int(item.get("quantity_invoiced") or 0)
        
        # Check if this voucher specifies item billed quantity
        match_vch_qty = 0
        for vi in vch_items:
            if (vi.get("sku") and vi["sku"] == item.get("sku")) or (vi.get("name") and vi["name"] == item.get("product_name")):
                match_vch_qty = int(vi.get("billed_qty") or vi.get("qty") or 0)
                break
        
        if match_vch_qty > 0:
            q_invoiced += match_vch_qty
        elif not vch_items and q_invoiced == 0:
            # Fallback when item breakdown is omitted
            q_invoiced = q_ordered

        q_pending = max(0, q_ordered - q_invoiced)
        
        total_ordered += q_ordered
        total_invoiced += q_invoiced

        updated_items.append({
            **item,
            "quantity_ordered": q_ordered,
            "quantity_invoiced": q_invoiced,
            "quantity_pending": q_pending,
        })

    # Determine status: partially_fulfilled if any items remain pending
    if total_invoiced < total_ordered and total_invoiced > 0:
        new_status = "partially_fulfilled"
    else:
        new_status = "delivered"

    existing_invoices = order.get("invoices", [])
    # Deduplicate invoice entries by invoice_no
    if not any(i.get("invoice_no") == invoice_entry["invoice_no"] for i in existing_invoices):
        existing_invoices.append(invoice_entry)

    update = {
        "tally_voucher_no": event.get("voucher_no"),
        "tally_voucher": invoice_entry,
        "items": updated_items if updated_items else order_items,
        "invoices": existing_invoices,
        "status": new_status,
        "updated_at": now_iso(),
    }

    await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    await db.audit_logs.insert_one({
        "actor_id": "system", "actor_email": "tally-webhook",
        "action": "order.voucher_linked",
        "target": order.get("order_no"),
        "meta": {"voucher_no": event.get("voucher_no"), "auto": auto,
                 "from_status": order.get("status"),
                 "to_status": new_status,
                 "invoiced_items_count": len(updated_items)},
        "created_at": now_iso(),
    })


async def _attach_receipt(order: dict, event: dict, auto: bool) -> None:
    """Write Receipt voucher details + payment status paid."""
    receipt_meta = {
        "receipt_no": event.get("voucher_no"),
        "guid": event.get("guid"),
        "date": event.get("date"),
        "amount": event.get("amount"),
        "linked_at": now_iso(),
        "linked_by": "auto" if auto else "manual",
    }
    update = {
        "tally_receipt_no": event.get("voucher_no"),
        "tally_receipt": receipt_meta,
        "payment_status": "paid",
        "updated_at": now_iso(),
    }
    await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    await db.audit_logs.insert_one({
        "actor_id": "system", "actor_email": "tally-webhook",
        "action": "order.receipt_linked",
        "target": order.get("order_no"),
        "meta": {"receipt_no": event.get("voucher_no"), "auto": auto},
        "created_at": now_iso(),
    })


async def manual_link(event_id: str, order_id: str) -> dict:
    """Manually link a webhook event to a specific order (admin override)."""
    event = await db.tally_webhook_events.find_one({"_id": ObjectId(event_id)})
    if not event:
        return {"ok": False, "error": "Event not found"}
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        return {"ok": False, "error": "Order not found"}

    vch_type = (event.get("voucher_type") or "").lower()
    if vch_type == "receipt":
        await _attach_receipt(order, event, auto=False)
    else:
        await _attach(order, event, auto=False)

    await db.tally_webhook_events.update_one(
        {"_id": event["_id"]},
        {"$set": {
            "link_status": "linked",
            "matched_order_id": str(order["_id"]),
            "matched_order_no": order.get("order_no"),
            "linked_by": "manual",
        }},
    )
    return {"ok": True, "order_no": order.get("order_no")}


async def unlink_event(event_id: str) -> dict:
    event = await db.tally_webhook_events.find_one({"_id": ObjectId(event_id)})
    if not event or not event.get("matched_order_id"):
        return {"ok": False, "error": "Event has no linked order"}

    vch_type = (event.get("voucher_type") or "").lower()
    if vch_type == "receipt":
        await db.orders.update_one(
            {"_id": ObjectId(event["matched_order_id"])},
            {"$unset": {"tally_receipt_no": "", "tally_receipt": ""},
             "$set": {"payment_status": "unpaid", "updated_at": now_iso()}},
        )
    else:
        await db.orders.update_one(
            {"_id": ObjectId(event["matched_order_id"])},
            {"$unset": {"tally_voucher_no": "", "tally_voucher": ""},
             "$set": {"updated_at": now_iso()}},
        )

    await db.tally_webhook_events.update_one(
        {"_id": event["_id"]},
        {"$set": {"link_status": "unmatched"},
         "$unset": {"matched_order_id": "", "matched_order_no": ""}},
    )
    return {"ok": True}
