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

DEFAULT_TIMEOUT = 8.0


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


async def _count_records_xml(xml_text: str, module: str) -> int:
    """Rough count of returned entities in the Tally XML response."""
    tag_map = {
        "products": "STOCKITEM", "stock": "STOCKITEM",
        "sales": "VOUCHER", "purchases": "VOUCHER", "vouchers": "VOUCHER",
        "warehouses": "GODOWN", "ledgers": "LEDGER",
    }
    tag = tag_map.get(module, "").upper()
    if not tag:
        return 0
    # simple case-insensitive occurrence count of the opening tag
    return xml_text.upper().count(f"<{tag}")


async def perform_tally_sync(module: str, direction: str = "pull") -> dict:
    """Attempt a real HTTP-XML sync against the configured Tally endpoint.

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
        records = await _count_records_xml(response.text, module)
        return {
            "module": module, "direction": direction, "status": "success",
            "records": records,
            "message": f"Synced {records} record(s) from Tally at {endpoint}",
            "duration_ms": duration,
            "response_bytes": len(response.content),
        }
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
