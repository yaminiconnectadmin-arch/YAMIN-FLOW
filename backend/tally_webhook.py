"""Tally Webhook — receive push notifications from Tally the moment a voucher changes.

Accepts either native Tally XML (typical Tally TDL push output) or JSON.
The receiver is authenticated by a shared secret carried as `?token=…` or `X-Tally-Token` header.

Once parsed, an event is upserted (idempotent by voucher_no + guid) into
`tally_webhook_events` and a `tally_sync_logs` entry is written with direction='webhook'.
"""
from __future__ import annotations

import secrets
import xml.etree.ElementTree as ET
from typing import Any
from db import db, now_iso


TALLY_ACTIONS = {"create", "modify", "delete", "alter"}


def _text(el, tag: str) -> str:
    if el is None:
        return ""
    node = el.find(tag)
    return (node.text or "").strip() if node is not None and node.text else ""


def _amount(s: str) -> float:
    try:
        s = (s or "").replace(",", "").strip()
        if s.endswith("Dr"): s = s[:-2].strip()
        if s.endswith("Cr"): s = s[:-2].strip()
        return float(s or 0)
    except ValueError:
        return 0.0


def _parse_iso_date(s: str) -> str:
    """Tally sends YYYYMMDD — convert to ISO YYYY-MM-DD; pass through if already ISO."""
    s = (s or "").strip()
    if not s:
        return ""
    if len(s) == 8 and s.isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    return s


def parse_tally_xml(raw: bytes) -> list[dict]:
    """Extract voucher records from a Tally XML payload.

    Returns a list of normalized dicts:
      { voucher_type, voucher_no, date, party, amount, guid, action, raw_xml_fragment }
    """
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        raise ValueError(f"Malformed XML: {e}")

    events = []
    # find every VOUCHER (any depth)
    for voucher in root.iter("VOUCHER"):
        vch_type = voucher.attrib.get("VCHTYPE") or _text(voucher, "VOUCHERTYPENAME")
        action = (voucher.attrib.get("ACTION") or "create").lower()
        if action not in TALLY_ACTIONS:
            action = "create"

        events.append({
            "voucher_type": vch_type or "Unknown",
            "voucher_no": _text(voucher, "VOUCHERNUMBER") or _text(voucher, "VCHNUMBER"),
            "date": _parse_iso_date(_text(voucher, "DATE")),
            "party": _text(voucher, "PARTYNAME") or _text(voucher, "PARTYLEDGERNAME"),
            "amount": _amount(_text(voucher, "AMOUNT")),
            "guid": _text(voucher, "GUID") or voucher.attrib.get("GUID", ""),
            "action": action,
            "raw": ET.tostring(voucher, encoding="unicode")[:4000],
        })
    return events


def normalize_json(payload: Any) -> list[dict]:
    """Accept either a single voucher dict or {vouchers:[…]}."""
    if isinstance(payload, dict) and "vouchers" in payload and isinstance(payload["vouchers"], list):
        items = payload["vouchers"]
    elif isinstance(payload, list):
        items = payload
    else:
        items = [payload]

    events = []
    for it in items:
        if not isinstance(it, dict):
            continue
        events.append({
            "voucher_type": str(it.get("voucher_type") or it.get("type") or "Unknown"),
            "voucher_no": str(it.get("voucher_no") or it.get("number") or ""),
            "date": _parse_iso_date(str(it.get("date") or "")),
            "party": str(it.get("party") or it.get("party_name") or ""),
            "amount": float(it.get("amount") or 0),
            "guid": str(it.get("guid") or ""),
            "action": str(it.get("action") or "create").lower(),
            "raw": str(it)[:4000],
        })
    return events


async def get_webhook_secret() -> str:
    doc = await db.settings.find_one({"key": "global"}) or {}
    secret = doc.get("tally_webhook_secret")
    if not secret:
        secret = secrets.token_urlsafe(24)
        await db.settings.update_one(
            {"key": "global"},
            {"$set": {"tally_webhook_secret": secret, "key": "global", "updated_at": now_iso()}},
            upsert=True,
        )
    return secret


async def rotate_webhook_secret() -> str:
    new = secrets.token_urlsafe(24)
    await db.settings.update_one(
        {"key": "global"},
        {"$set": {"tally_webhook_secret": new, "key": "global", "updated_at": now_iso()}},
        upsert=True,
    )
    return new


async def persist_events(events: list[dict], source_ip: str) -> int:
    saved = 0
    for ev in events:
        if not ev.get("voucher_no") and not ev.get("guid"):
            continue
        key = {"voucher_no": ev["voucher_no"], "guid": ev.get("guid", "")}
        ev["source_ip"] = source_ip
        ev["received_at"] = now_iso()
        await db.tally_webhook_events.update_one(
            key, {"$set": ev, "$inc": {"revisions": 1}}, upsert=True,
        )
        saved += 1
    return saved
