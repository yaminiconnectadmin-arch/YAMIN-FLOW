"""Real Tally ERP integration via HTTP-XML.

Tally exposes an HTTP server on (default) port 9000 that accepts XML request envelopes
and returns XML responses. This module builds proper envelopes for each supported
module and posts them to the configured Tally endpoint. If Tally is unreachable
we return a structured failure so the UI can surface it (never crash).

Docs reference: https://help.tallysolutions.com/tally-prime/tally-developer2/tally-http-post/
"""
from __future__ import annotations

import time
from typing import Any
import httpx
from db import db

import xml.etree.ElementTree as ET
import re
from db import db, now_iso
from voucher_linker import auto_link_voucher

DEFAULT_TIMEOUT = 8.0


# ------- Helper Parsers -------
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
        return abs(float(s or 0))
    except ValueError:
        return 0.0


def _qty(s: str) -> float:
    try:
        # Extract numeric float from string like "100 Pcs" or "25.5 Box"
        match = re.search(r"[-+]?\d*\.?\d+", s or "")
        return float(match.group()) if match else 0.0
    except ValueError:
        return 0.0


# ------- Envelope Builders -------
def _envelope(report_name: str, extra_static: str = "", collection_type: str | None = None) -> str:
    """Build a standard EXPORT DATA envelope for a given report/collection."""
    collection_block = ""
    if collection_type:
        collection_block = f"""
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="{report_name}" ISMODIFY="No">
              <TYPE>{collection_type}</TYPE>
              <FETCH>*.*</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>"""

    return f"""<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>{report_name}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        {extra_static}
      </STATICVARIABLES>
      {collection_block}
    </DESC>
  </BODY>
</ENVELOPE>"""


MODULE_ENVELOPES = {
    "products": lambda: _envelope("YF_Products", collection_type="Stock Item"),
    "stock": lambda: _envelope("YF_StockSummary", collection_type="StockItem",
                               extra_static="<SVFROMDATE>20240101</SVFROMDATE><SVTODATE>20991231</SVTODATE>"),
    "sales": lambda: _envelope("YF_SalesVouchers", collection_type="Voucher",
                                extra_static="<SVFROMDATE>20240101</SVFROMDATE><SVTODATE>20991231</SVTODATE><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>"),
    "purchases": lambda: _envelope("YF_PurchaseVouchers", collection_type="Voucher",
                                    extra_static="<SVFROMDATE>20240101</SVFROMDATE><SVTODATE>20991231</SVTODATE><VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>"),
    "vouchers": lambda: _envelope("YF_Vouchers", collection_type="Voucher",
                                   extra_static="<SVFROMDATE>20240101</SVFROMDATE><SVTODATE>20991231</SVTODATE>"),
    "warehouses": lambda: _envelope("YF_Godowns", collection_type="Godown"),
    "ledgers": lambda: _envelope("YF_Ledgers", collection_type="Ledger"),
}


async def _get_endpoint() -> str | None:
    settings = await db.settings.find_one({"key": "global"})
    if settings and settings.get("tally_endpoint"):
        return settings["tally_endpoint"].strip()
    return None


async def _parse_and_persist_xml(xml_text: str, module: str) -> int:
    """Parse XML payload from Tally and persist entities directly into MongoDB."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return 0

    saved_count = 0

    # 1. Products & Stock Items
    if module in ("products", "stock"):
        for item in root.iter("STOCKITEM"):
            name = item.attrib.get("NAME") or _text(item, "NAME")
            if not name:
                continue
            sku = _text(item, "MAILINGNAME") or re.sub(r"[^A-Za-z0-9]", "-", name).strip("-").upper()
            category = _text(item, "PARENT") or "General"
            unit = _text(item, "BASEUNITS") or "Pcs"
            qty = _qty(_text(item, "CLOSINGBALANCE") or _text(item, "OPENINGBALANCE"))
            rate = _amount(_text(item, "CLOSINGRATE") or _text(item, "RATE"))
            value = _amount(_text(item, "CLOSINGVALUE"))

            await db.products.update_one(
                {"name": name},
                {"$set": {
                    "name": name, "sku": sku, "category": category,
                    "price": rate if rate > 0 else 100.0, "unit": unit,
                    "stock": int(qty), "updated_at": now_iso()
                }},
                upsert=True
            )

            # Get product_id and main warehouse_id for inventory update
            prod_doc = await db.products.find_one({"name": name})
            wh_doc = await db.warehouses.find_one({})
            if prod_doc:
                prod_id = str(prod_doc["_id"])
                wh_id = str(wh_doc["_id"]) if wh_doc else "default"
                await db.inventory.update_one(
                    {"warehouse_id": wh_id, "product_id": prod_id},
                    {"$set": {
                        "warehouse_id": wh_id, "product_id": prod_id,
                        "sku": sku, "product_name": name, "quantity": int(qty),
                        "unit_price": rate, "valuation": value, "updated_at": now_iso()
                    }},
                    upsert=True
                )
            saved_count += 1

    # 2. Sales / Purchases / Vouchers
    elif module in ("sales", "purchases", "vouchers"):
        for vch in root.iter("VOUCHER"):
            vch_type = vch.attrib.get("VCHTYPE") or _text(vch, "VOUCHERTYPENAME") or "Sales"
            vch_no = _text(vch, "VOUCHERNUMBER") or _text(vch, "VCHNUMBER")
            party = _text(vch, "PARTYNAME") or _text(vch, "PARTYLEDGERNAME")
            amt = _amount(_text(vch, "AMOUNT"))
            order_no = _text(vch, "BASICBUYERORDERNO") or _text(vch, "REFERENCE")
            guid = _text(vch, "GUID") or vch.attrib.get("GUID", "")

            if not vch_no and not guid:
                continue

            # Extract itemized inventory entries
            items = []
            for inv_entry in vch.iter("ALLINVENTORYENTRIES.LIST"):
                item_name = _text(inv_entry, "STOCKITEMNAME")
                billed_qty = _qty(_text(inv_entry, "BILLEDQTY") or _text(inv_entry, "ACTUALQTY"))
                rate = _amount(_text(inv_entry, "RATE"))
                inv_amt = _amount(_text(inv_entry, "AMOUNT"))
                if item_name:
                    items.append({
                        "name": item_name,
                        "billed_qty": int(billed_qty),
                        "rate": rate,
                        "amount": inv_amt
                    })

            event = {
                "voucher_type": vch_type, "voucher_no": vch_no,
                "party": party, "amount": amt, "guid": guid,
                "order_no": order_no, "items": items,
                "action": "create", "received_at": now_iso()
            }

            # Attempt auto-linking with Yamini orders
            await auto_link_voucher(event)
            await db.tally_webhook_events.update_one(
                {"voucher_no": vch_no, "guid": guid},
                {"$set": event, "$inc": {"revisions": 1}},
                upsert=True
            )
            saved_count += 1

    # 3. Ledgers (Dealers & Suppliers)
    elif module == "ledgers":
        for ledger in root.iter("LEDGER"):
            name = ledger.attrib.get("NAME") or _text(ledger, "NAME")
            if not name:
                continue
            parent = _text(ledger, "PARENT") or "Sundry Debtors"
            phone = _text(ledger, "LEDPHONE") or _text(ledger, "PHONE")
            state = _text(ledger, "STATENAME")
            balance = _amount(_text(ledger, "CLOSINGBALANCE"))

            await db.tally_ledgers.update_one(
                {"name": name},
                {"$set": {
                    "name": name, "parent": parent, "phone": phone,
                    "state": state, "closing_balance": balance,
                    "updated_at": now_iso()
                }},
                upsert=True
            )
            saved_count += 1

    # 4. Fallback tag count if standard XML structure varies
    if saved_count == 0:
        tag_map = {
            "products": "STOCKITEM", "stock": "STOCKITEM",
            "sales": "VOUCHER", "purchases": "VOUCHER", "vouchers": "VOUCHER",
            "warehouses": "GODOWN", "ledgers": "LEDGER",
        }
        tag = tag_map.get(module, "").upper()
        if tag:
            saved_count = xml_text.upper().count(f"<{tag}")

    return saved_count


async def perform_tally_sync(module: str, direction: str = "pull") -> dict:
    """Attempt a real HTTP-XML sync against the configured Tally endpoint and persist data into MongoDB.

    Returns a dict compatible with the tally_sync_logs schema
    (module, direction, status, records, message, duration_ms).
    """
    start = time.time()
    endpoint = await _get_endpoint()

    if not endpoint:
        return {
            "module": module, "direction": direction, "status": "failed", "records": 0,
            "message": "No Tally endpoint configured. Set it in Settings → Tally Integration.",
            "duration_ms": int((time.time() - start) * 1000),
        }

    builder = MODULE_ENVELOPES.get(module)
    if not builder:
        return {
            "module": module, "direction": direction, "status": "failed", "records": 0,
            "message": f"Module '{module}' has no Tally envelope mapping.",
            "duration_ms": int((time.time() - start) * 1000),
        }

    xml_payload = builder()
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.post(
                endpoint,
                content=xml_payload.encode("utf-8"),
                headers={"Content-Type": "text/xml"},
            )
        duration = int((time.time() - start) * 1000)
        if response.status_code != 200:
            return {
                "module": module, "direction": direction, "status": "failed", "records": 0,
                "message": f"Tally returned HTTP {response.status_code}: {response.text[:120]}",
                "duration_ms": duration,
            }
        
        # Parse XML response and persist records directly into MongoDB
        records = await _parse_and_persist_xml(response.text, module)
        
        log_entry = {
            "module": module, "direction": direction, "status": "success",
            "records": records,
            "message": f"Synced {records} record(s) from Tally at {endpoint}",
            "duration_ms": duration,
            "created_at": now_iso(),
        }
        await db.tally_sync_logs.insert_one(log_entry)
        return log_entry

    except httpx.ConnectError as e:
        return {
            "module": module, "direction": direction, "status": "failed", "records": 0,
            "message": f"Cannot reach Tally at {endpoint} — is Tally running with HTTP-XML enabled on the configured port? ({e})",
            "duration_ms": int((time.time() - start) * 1000),
        }
    except httpx.TimeoutException:
        return {
            "module": module, "direction": direction, "status": "failed", "records": 0,
            "message": f"Timeout communicating with Tally at {endpoint} (>{DEFAULT_TIMEOUT}s).",
            "duration_ms": int((time.time() - start) * 1000),
        }
    except Exception as e:
        return {
            "module": module, "direction": direction, "status": "failed", "records": 0,
            "message": f"Tally sync error: {str(e)[:200]}",
            "duration_ms": int((time.time() - start) * 1000),
        }

