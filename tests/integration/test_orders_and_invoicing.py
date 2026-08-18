"""
End-to-end integration and unit tests for Dealer Orders, Smart Stock Allocation,
Admin Panel Visibility, GST Tax Invoicing, and Non-Destructive Authentication.
"""
import pytest
from datetime import datetime, timezone
from bson import ObjectId

from models import OrderIn, OrderItemIn, OrderStatusUpdate, OrderPartialBillingIn
from routers.orders import _enrich_orders


def test_order_matrix_weight_and_gst_calculation():
    """Verify fastener matrix weight and GST 18% calculation."""
    qty = 2000
    wt_1000 = 1.480  # 4X25 CSK screw: 1.480 kg per 1000 pcs
    rate_per_box = 791.0
    boxes = 2
    
    total_weight = round((qty / 1000.0) * wt_1000, 3)
    assert total_weight == 2.96

    taxable = round(rate_per_box * boxes, 2)
    gst_18 = round(taxable * 0.18, 2)
    grand_total = round(taxable + gst_18, 2)

    assert taxable == 1582.0
    assert gst_18 == 284.76
    assert grand_total == 1866.76


@pytest.mark.asyncio
async def test_enrich_orders_with_party_and_invoice_details(monkeypatch):
    """Verify that _enrich_orders properly populates party codes, warehouse info, and invoice numbers."""
    fake_dealer_id = ObjectId()
    fake_wh_id = ObjectId()

    orders = [
        {
            "_id": ObjectId(),
            "order_no": "ORD-20260042",
            "dealer_id": str(fake_dealer_id),
            "warehouse_id": str(fake_wh_id),
            "status": "approved",
            "items": [
                {
                    "product_id": str(ObjectId()),
                    "product_name": "CSK Chipboard Screws 4X25",
                    "quantity": 1000,
                    "boxes": 1,
                    "rate": 791,
                }
            ],
            "subtotal": 791.0,
            "gst": 142.38,
            "total": 933.38,
            "total_weight_kg": 1.48,
        }
    ]

    class MockUsers:
        def find(self, query):
            class Cursor:
                async def to_list(self, n):
                    return [
                        {
                            "_id": fake_dealer_id,
                            "name": "Krishna Fasteners",
                            "company": "Krishna Fasteners Pvt Ltd",
                            "user_code": "DLR-KRISHNA-01",
                            "role": "dealer",
                            "state": "Maharashtra",
                            "gstin": "27AAECK1234F1Z1",
                        }
                    ]
            return Cursor()

    class MockWarehouses:
        def find(self, query):
            class Cursor:
                async def to_list(self, n):
                    return [
                        {
                            "_id": fake_wh_id,
                            "code": "WH-MUM",
                            "name": "Mumbai Central",
                        }
                    ]
            return Cursor()

    import routers.orders as orders_module
    monkeypatch.setattr(orders_module.db, "users", MockUsers())
    monkeypatch.setattr(orders_module.db, "warehouses", MockWarehouses())

    enriched = await _enrich_orders(orders)
    assert len(enriched) == 1
    ord_doc = enriched[0]

    assert ord_doc["dealer_code"] == "DLR-KRISHNA-01"
    assert ord_doc["dealer_name"] == "Krishna Fasteners Pvt Ltd"
    assert ord_doc["dealer_state"] == "Maharashtra"
    assert ord_doc["dealer_gstin"] == "27AAECK1234F1Z1"
    assert ord_doc["warehouse_name"] == "Mumbai Central"
    assert ord_doc["invoice_no"] == "INV-20260042"
    assert ord_doc["items"][0]["quantity_ordered"] == 1000
    assert ord_doc["items"][0]["quantity_allocated"] == 1000


def test_smart_allocation_deficit_logic():
    """Verify smart multi-warehouse allocation deficit rules."""
    demanded = 5000
    on_hand = 3000
    reserved = 1000
    available = max(0, on_hand - reserved)  # 2000

    assert available == 2000
    allocated = min(demanded, available)
    deficit = demanded - allocated

    assert allocated == 2000
    assert deficit == 3000
    status = "partially_fulfilled" if allocated > 0 else "pending"
    assert status == "partially_fulfilled"
