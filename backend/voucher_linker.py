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


async def find_candidate_orders(party: str, amount: float, limit: int = 5) -> list[dict]:
    """Return up to `limit` orders that could match this voucher."""
    if not party or amount <= 0:
        return []
    # Fetch open orders (broadly), filter in-memory (dataset is small per company)
    orders = await db.orders.find({
        "status": {"$in": ["pending", "approved", "shipped"]},
        "tally_voucher_no": {"$exists": False},
    }).sort("created_at", -1).to_list(500)
    candidates = []
    for o in orders:
        if _party_matches(o.get("dealer_name", ""), party) and _amount_matches(o.get("total", 0), amount):
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
    if not party:
        event["link_status"] = "no_party"
        return event

    if vch_type == "sales":
        candidates = await find_candidate_orders(party, amount, limit=5)
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
    """Return candidate orders for Receipt: status in (approved, shipped, delivered) and payment_status != paid."""
    if not party or amount <= 0:
        return []
    orders = await db.orders.find({
        "status": {"$in": ["approved", "shipped", "delivered"]},
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
    """Write bidirectional link + optional status bump."""
    voucher_meta = {
        "voucher_no": event.get("voucher_no"),
        "guid": event.get("guid"),
        "date": event.get("date"),
        "amount": event.get("amount"),
        "linked_at": now_iso(),
        "linked_by": "auto" if auto else "manual",
    }
    update = {
        "tally_voucher_no": event.get("voucher_no"),
        "tally_voucher": voucher_meta,
        "updated_at": now_iso(),
    }
    # Auto-transition: pending/approved → shipped when invoice hits Tally
    if order.get("status") in ("pending", "approved"):
        update["status"] = "shipped"
    await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    await db.audit_logs.insert_one({
        "actor_id": "system", "actor_email": "tally-webhook",
        "action": "order.voucher_linked",
        "target": order.get("order_no"),
        "meta": {"voucher_no": event.get("voucher_no"), "auto": auto,
                 "from_status": order.get("status"),
                 "to_status": update.get("status", order.get("status"))},
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
