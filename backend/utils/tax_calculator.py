"""Tax calculation module for Yamini Flow — SRD v2.0.2 Gold Master.
Replaces universal hardcoded 0.18 multipliers with dynamic tax calculation
based on SKU GST rate and Warehouse State vs Party State context (Intra-state vs Inter-state).
"""

from typing import Dict, Any, Optional

def normalize_state(state: Optional[str]) -> str:
    """Normalize state string for comparison."""
    if not state:
        return ""
    return str(state).strip().lower().replace(" ", "").replace(".", "").replace("-", "")

def calculate_item_tax(
    subtotal: float,
    gst_rate: float = 18.0,
    warehouse_state: Optional[str] = "",
    party_state: Optional[str] = ""
) -> Dict[str, Any]:
    """
    Calculate dynamic tax components based on SKU GST rate and location.

    Rules:
    - Intra-State (warehouse_state == party_state or unassigned state):
      CGST = gst_rate / 2, SGST = gst_rate / 2, IGST = 0
    - Inter-State (warehouse_state != party_state):
      IGST = gst_rate, CGST = 0, SGST = 0
    """
    subtotal = round(float(subtotal or 0.0), 2)
    gst_rate = float(gst_rate if gst_rate is not None else 18.0)

    wh_st = normalize_state(warehouse_state)
    pt_st = normalize_state(party_state)

    # Determine state tax mode
    is_interstate = bool(wh_st and pt_st and wh_st != pt_st)

    if is_interstate:
        igst_rate = gst_rate
        cgst_rate = 0.0
        sgst_rate = 0.0
        igst_amount = round(subtotal * (igst_rate / 100.0), 2)
        cgst_amount = 0.0
        sgst_amount = 0.0
        tax_type = "IGST"
    else:
        igst_rate = 0.0
        cgst_rate = round(gst_rate / 2.0, 2)
        sgst_rate = round(gst_rate / 2.0, 2)
        igst_amount = 0.0
        cgst_amount = round(subtotal * (cgst_rate / 100.0), 2)
        sgst_amount = round(subtotal * (sgst_rate / 100.0), 2)
        tax_type = "CGST_SGST"

    gst_amount = round(cgst_amount + sgst_amount + igst_amount, 2)
    total_amount = round(subtotal + gst_amount, 2)

    return {
        "subtotal": subtotal,
        "gst_rate": gst_rate,
        "tax_type": tax_type,
        "cgst_rate": cgst_rate,
        "cgst_amount": cgst_amount,
        "sgst_rate": sgst_rate,
        "sgst_amount": sgst_amount,
        "igst_rate": igst_rate,
        "igst_amount": igst_amount,
        "gst_amount": gst_amount,
        "total_amount": total_amount
    }
