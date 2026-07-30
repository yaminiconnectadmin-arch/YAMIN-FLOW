"""YAMINI FLOW backend integration tests via public URL."""
import os
import time
import pytest
import requests
from pathlib import Path

# Load frontend .env to pick REACT_APP_BACKEND_URL
FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
if not FRONTEND_ENV.exists():
    FRONTEND_ENV = Path("/app/frontend/.env")
BASE_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("REACT_APP_BACKEND_URL"):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
        break
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@yaminiconnect.com", "Admin@yamini12"),
    "dealer": ("dealer@yaminiflow.com", "Dealer12"),
    "mnp": ("mnp@yaminiflow.com", "Mnp@1234"),
    "supplier": ("supplier@yaminiflow.com", "Supp1234"),
    "employee": ("EMP-101", "Emp@1234"),
}


# ---------------- Session fixtures ----------------
def _login(role: str):
    email, pwd = CREDS[role]
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"login_id": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, f"{role} login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token")
    assert token
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s, data["user"]


@pytest.fixture(scope="session")
def admin():
    return _login("admin")


@pytest.fixture(scope="session")
def dealer():
    return _login("dealer")


@pytest.fixture(scope="session")
def mnp():
    return _login("mnp")


@pytest.fixture(scope="session")
def supplier():
    return _login("supplier")


@pytest.fixture(scope="session")
def employee():
    return _login("employee")


# ---------------- Health ----------------
def test_health():
    r = requests.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_login_admin(self, admin):
        s, user = admin
        assert user["email"] == "admin@yaminiconnect.com"
        assert user["role"] == "admin"

    def test_me_admin(self, admin):
        s, _ = admin
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "admin@yaminiconnect.com", "password": "wrong"},
                          timeout=15)
        assert r.status_code in (401, 429)

    def test_login_dealer(self, dealer):
        _, u = dealer
        assert u["role"] == "dealer"

    def test_login_mnp(self, mnp):
        _, u = mnp
        assert u["role"] == "mnp"

    def test_login_supplier(self, supplier):
        _, u = supplier
        assert u["role"] == "supplier"

    def test_login_employee(self, employee):
        _, u = employee
        assert u["admin_role"] == "staff" or u["role"] in ["admin", "staff", "employee"]

    def test_password_max_length_exceeded(self):
        r = requests.post(f"{API}/auth/login",
                          json={"login_id": "EMP-101", "password": "LongPasswordExceeding8Chars"},
                          timeout=15)
        assert r.status_code == 400
        assert "not exceed 8 characters" in r.text



# ---------------- RBAC ----------------
class TestRBAC:
    def test_dealer_cannot_get_audit(self, dealer):
        s, _ = dealer
        r = s.get(f"{API}/audit-logs")
        assert r.status_code == 403

    def test_dealer_cannot_create_product(self, dealer):
        s, _ = dealer
        payload = {"sku": "TEST_RBAC_SKU", "name": "x", "category": "Electronics", "price": 1}
        r = s.post(f"{API}/products", json=payload)
        assert r.status_code == 403

    def test_dealer_cannot_create_dealer(self, dealer):
        s, _ = dealer
        r = s.post(f"{API}/dealers", json={"name": "x", "email": "TEST_x@x.com",
                                            "phone": "1", "company": "c", "city": "c", "state": "s"})
        assert r.status_code == 403

    def test_supplier_cannot_get_products_writes(self, supplier):
        s, _ = supplier
        r = s.post(f"{API}/products", json={"sku": "TEST_S_SKU", "name": "x",
                                             "category": "Electronics", "price": 1})
        assert r.status_code == 403

    def test_unauthenticated_denied(self):
        r = requests.get(f"{API}/products", timeout=15)
        assert r.status_code == 401


# ---------------- Analytics ----------------
class TestAnalytics:
    def test_overview_admin(self, admin):
        s, _ = admin
        r = s.get(f"{API}/analytics/overview")
        assert r.status_code == 200
        d = r.json()
        for k in ["kpis", "revenue_trend", "state_data", "top_dealers",
                  "top_products", "low_stock_alerts"]:
            assert k in d
        for k in ["revenue", "total_orders", "dealer_count", "product_count",
                  "inventory_value"]:
            assert k in d["kpis"]

    def test_overview_dealer_scoped(self, dealer):
        s, u = dealer
        r = s.get(f"{API}/analytics/overview")
        assert r.status_code == 200
        d = r.json()
        # dealer sees their own orders only
        assert "kpis" in d

    def test_mnp_dealer_analytics(self, mnp):
        s, _ = mnp
        r = s.get(f"{API}/analytics/mnp/dealers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    # New: Territory heatmap drill-down endpoint
    def test_state_drilldown_admin(self, admin):
        s, _ = admin
        r = s.get(f"{API}/analytics/state/Maharashtra")
        assert r.status_code == 200
        d = r.json()
        for k in ("state", "revenue", "orders", "dealers", "top_products"):
            assert k in d, f"missing key {k}"
        assert d["state"] == "Maharashtra"
        assert isinstance(d["dealers"], list)
        assert isinstance(d["top_products"], list)

    def test_state_drilldown_dealer_forbidden(self, dealer):
        s, _ = dealer
        r = s.get(f"{API}/analytics/state/Maharashtra")
        assert r.status_code == 403


# ---------------- Products / Inventory / Warehouses ----------------
class TestCatalog:
    def test_list_products(self, admin):
        s, _ = admin
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 3
        assert all("sku" in p for p in prods)
        assert all("_id" not in p for p in prods), "MongoDB _id should be excluded"

    def test_create_and_get_product(self, admin):
        s, _ = admin
        sku = f"TEST_SKU_{int(time.time())}"
        payload = {"sku": sku, "name": "TEST Product", "category": "Electronics",
                   "price": 100, "cost": 60, "safety_stock": 5, "moq": 1}
        r = s.post(f"{API}/products", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["sku"] == sku
        pid = created["id"]

        # GET verify persistence
        r2 = s.get(f"{API}/products/{pid}")
        assert r2.status_code == 200
        assert r2.json()["sku"] == sku

        # cleanup
        s.delete(f"{API}/products/{pid}")

    def test_duplicate_sku_rejected(self, admin):
        s, _ = admin
        sku = f"TEST_DUP_{int(time.time())}"
        r1 = s.post(f"{API}/products", json={"sku": sku, "name": "x",
                                              "category": "Electronics", "price": 1})
        assert r1.status_code == 200
        pid = r1.json()["id"]
        r2 = s.post(f"{API}/products", json={"sku": sku, "name": "x2",
                                              "category": "Electronics", "price": 1})
        assert r2.status_code == 400
        s.delete(f"{API}/products/{pid}")

    def test_list_inventory(self, admin):
        s, _ = admin
        r = s.get(f"{API}/inventory")
        assert r.status_code == 200
        inv = r.json()
        assert len(inv) > 0
        row = inv[0]
        for k in ["quantity", "reserved", "available", "safety_stock",
                  "product_name", "warehouse_name", "stock_status"]:
            assert k in row

    def test_inventory_warehouse_filter(self, admin):
        s, _ = admin
        r_w = s.get(f"{API}/warehouses")
        wh = r_w.json()[0]
        r = s.get(f"{API}/inventory", params={"warehouse_id": wh["id"]})
        assert r.status_code == 200
        for row in r.json():
            assert row["warehouse_id"] == wh["id"]

    def test_warehouses_list(self, admin):
        s, _ = admin
        r = s.get(f"{API}/warehouses")
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ---------------- Partners ----------------
class TestPartners:
    def test_list_dealers(self, admin):
        s, _ = admin
        r = s.get(f"{API}/dealers")
        assert r.status_code == 200
        for d in r.json():
            assert "password_hash" not in d

    def test_list_suppliers(self, admin):
        s, _ = admin
        r = s.get(f"{API}/suppliers")
        assert r.status_code == 200

    def test_list_mnp(self, admin):
        s, _ = admin
        r = s.get(f"{API}/mnp")
        assert r.status_code == 200


# ---------------- Orders ----------------
class TestOrders:
    def test_dealer_place_order(self, dealer, admin):
        s_dealer, _ = dealer
        s_admin, _ = admin
        # get a product
        prods = s_admin.get(f"{API}/products").json()
        pid = prods[0]["id"]
        r = s_dealer.post(f"{API}/orders", json={"items": [{"product_id": pid, "quantity": 1}]})
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["order_no"].startswith("ORD-")
        assert order["total"] > 0
        assert order["status"] in ("pending", "approved")
        assert len(order["items"]) == 1

        # verify visible in dealer's own list
        r_list = s_dealer.get(f"{API}/orders")
        assert r_list.status_code == 200
        nos = [o["order_no"] for o in r_list.json()]
        assert order["order_no"] in nos

    def test_admin_list_orders(self, admin):
        s, _ = admin
        r = s.get(f"{API}/orders")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_status_transitions(self, admin, dealer):
        s_admin, _ = admin
        s_dealer, _ = dealer
        prods = s_admin.get(f"{API}/products").json()
        pid = prods[0]["id"]
        r = s_dealer.post(f"{API}/orders", json={"items": [{"product_id": pid, "quantity": 1}]})
        assert r.status_code == 200
        oid = r.json()["id"]

        # transition through statuses
        for status in ["shipped", "delivered"]:
            r_up = s_admin.patch(f"{API}/orders/{oid}/status", json={"status": status})
            assert r_up.status_code == 200, r_up.text
            assert r_up.json()["status"] == status

    def test_dealer_cannot_change_status(self, dealer, admin):
        s_admin, _ = admin
        s_dealer, _ = dealer
        # get an order
        orders = s_admin.get(f"{API}/orders").json()
        oid = orders[0]["id"]
        r = s_dealer.patch(f"{API}/orders/{oid}/status", json={"status": "cancelled"})
        assert r.status_code == 403

    def test_receipt_voucher_autolink(self, admin, dealer):
        s_admin, _ = admin
        s_dealer, _ = dealer

        prods = s_admin.get(f"{API}/products").json()
        pid = prods[0]["id"]
        r = s_dealer.post(f"{API}/orders", json={"items": [{"product_id": pid, "quantity": 1000, "rate": 9.99}]})
        assert r.status_code == 200
        order = r.json()
        oid = order["id"]
        assert order["payment_status"] == "unpaid"

        s_admin.patch(f"{API}/orders/{oid}/status", json={"status": "approved"})

        payload = {
            "voucher_type": "Receipt",
            "voucher_no": f"REC-TEST-{int(time.time())}",
            "date": "2026-07-28",
            "party": order["dealer_name"],
            "amount": order["total"],
            "guid": f"GUID-REC-{int(time.time())}",
            "action": "create"
        }
        # Retrieve tally secret dynamically
        r_settings = s_admin.get(f"{API}/settings").json()
        token = r_settings.get("tally_webhook_secret") or "test_secret"
        r_web = s_admin.post(f"{API}/tally/webhook?token={token}", json=payload)
        assert r_web.status_code == 200

        # Verify payment status is paid
        r_verify = s_dealer.get(f"{API}/orders/{oid}")
        assert r_verify.status_code == 200
        assert r_verify.json()["payment_status"] == "paid"
        assert r_verify.json()["tally_receipt_no"] == payload["voucher_no"]

    def test_invoices(self, admin):
        s, _ = admin
        r = s.get(f"{API}/invoices")
        assert r.status_code == 200
        for inv in r.json():
            assert inv["invoice_no"].startswith("INV-")


# ---------------- Procurement / PO ----------------
class TestProcurement:
    def test_recommendations(self, admin):
        s, _ = admin
        r = s.get(f"{API}/procurement/recommendations")
        assert r.status_code == 200
        recs = r.json()
        assert isinstance(recs, list)
        if recs:
            for k in ["product_id", "sku", "recommended_qty", "urgency"]:
                assert k in recs[0]

    def test_list_pos(self, admin):
        s, _ = admin
        r = s.get(f"{API}/purchase-orders")
        assert r.status_code == 200

    def test_create_po_and_status(self, admin):
        s, _ = admin
        supp = s.get(f"{API}/suppliers").json()[0]
        wh = s.get(f"{API}/warehouses").json()[0]
        prod = s.get(f"{API}/products").json()[0]
        payload = {
            "supplier_id": supp["id"], "warehouse_id": wh["id"],
            "items": [{"product_id": prod["id"], "quantity": 10, "rate": 50}],
        }
        r = s.post(f"{API}/purchase-orders", json=payload)
        assert r.status_code == 200, r.text
        po = r.json()
        assert po["po_no"].startswith("PO-")
        assert po["status"] == "draft"

        # transition
        r_up = s.patch(f"{API}/purchase-orders/{po['id']}/status", json={"status": "sent"})
        assert r_up.status_code == 200
        assert r_up.json()["status"] == "sent"


# ---------------- Tally (mocked) ----------------
class TestTally:
    def test_status(self, admin):
        s, _ = admin
        r = s.get(f"{API}/tally/status")
        assert r.status_code == 200
        d = r.json()
        for k in ["modules", "success_count", "failed_count", "health"]:
            assert k in d

    def test_sync(self, admin):
        s, _ = admin
        r = s.post(f"{API}/tally/sync", json={"module": "products", "direction": "push"})
        assert r.status_code == 200
        d = r.json()
        assert d["module"] == "products"
        assert d["status"] in ("success", "failed")
        assert "duration_ms" in d

    def test_logs(self, admin):
        s, _ = admin
        r = s.get(f"{API}/tally/logs")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_dealer_cannot_sync(self, dealer):
        s, _ = dealer
        r = s.post(f"{API}/tally/sync", json={"module": "products"})
        assert r.status_code == 403

    # New: real HTTP-XML sync should attempt real call and fail gracefully in dev
    def test_real_tally_sync_fails_gracefully(self, admin):
        s, _ = admin
        pre_logs = s.get(f"{API}/tally/logs").json()
        pre_count = len(pre_logs)
        r = s.post(f"{API}/tally/sync",
                   json={"module": "products", "direction": "pull"},
                   timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # No fabricated records; must be failed with a helpful message
        assert d["status"] == "failed", f"expected failed but got {d}"
        assert d["records"] == 0
        assert d["module"] == "products"
        msg = (d.get("message") or "").lower()
        assert ("cannot reach tally" in msg
                or "timeout" in msg
                or "no tally endpoint" in msg
                or "tally sync error" in msg), f"unexpected message: {d.get('message')}"
        # persisted a log
        post_logs = s.get(f"{API}/tally/logs").json()
        assert len(post_logs) == pre_count + 1

    def test_tally_test_connection(self, admin):
        s, _ = admin
        pre_logs = s.get(f"{API}/tally/logs").json()
        pre_count = len(pre_logs)
        r = s.post(f"{API}/tally/test-connection", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is False
        assert "status" in d
        # test-connection MUST NOT persist a log
        post_logs = s.get(f"{API}/tally/logs").json()
        assert len(post_logs) == pre_count, "test-connection should not persist a log"

    def test_dealer_cannot_test_connection(self, dealer):
        s, _ = dealer
        r = s.post(f"{API}/tally/test-connection")
        assert r.status_code == 403


# ---------------- AI Insights ----------------
class TestAI:
    def test_ai_history(self, admin):
        s, _ = admin
        r = s.get(f"{API}/ai/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_ai_insight_sales_summary(self, admin):
        s, _ = admin
        r = s.post(f"{API}/ai/insight", json={"topic": "sales_summary"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["topic"] == "sales_summary"
        assert d.get("output"), "AI output empty"
        assert len(d["output"]) > 20

    def test_dealer_cannot_ai(self, dealer):
        s, _ = dealer
        r = s.post(f"{API}/ai/insight", json={"topic": "sales_summary"})
        assert r.status_code == 403


# ---------------- Notifications ----------------
class TestNotifications:
    def test_list(self, admin):
        s, _ = admin
        r = s.get(f"{API}/notifications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_mark_all_read(self, admin):
        s, _ = admin
        r = s.post(f"{API}/notifications/mark-all-read")
        assert r.status_code == 200


# ---------------- Audit ----------------
class TestAudit:
    def test_admin_audit(self, admin):
        s, _ = admin
        r = s.get(f"{API}/audit-logs")
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list)
        if logs:
            for k in ["actor_email", "action", "created_at"]:
                assert k in logs[0]


# ---------------- Settings ----------------
class TestSettings:
    def test_get_settings(self, admin):
        s, _ = admin
        r = s.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert "company_name" in d

    def test_update_settings(self, admin):
        s, _ = admin
        payload = {"company_name": "Yamini Group TEST",
                   "tally_endpoint": "http://localhost:9000"}
        r = s.put(f"{API}/settings", json=payload)
        assert r.status_code == 200
        assert r.json()["company_name"] == "Yamini Group TEST"
        # restore
        s.put(f"{API}/settings", json={"company_name": "Yamini Group",
                                        "tally_endpoint": "http://localhost:9000"})


# ---------------- Tally Webhook (push) ----------------
class TestTallyWebhook:
    """Iteration-3: Tally Webhook Receiver — RBAC, XML/JSON parsing, dedup, rotate."""

    def test_webhook_config_admin(self, admin):
        s, _ = admin
        r = s.get(f"{API}/tally/webhook-config")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("webhook_url", "secret_masked", "secret_full", "header_name", "query_param"):
            assert k in d, f"missing key {k}"
        assert d["header_name"] == "X-Tally-Token"
        assert d["query_param"] == "token"
        assert d["secret_full"], "secret_full must be present"
        assert d["secret_masked"] != d["secret_full"], "masked must differ from full"
        assert "/api/tally/webhook" in d["webhook_url"]

    def test_webhook_config_forbidden_for_others(self, dealer, mnp, supplier):
        for role_fixture, name in [(dealer, "dealer"), (mnp, "mnp"), (supplier, "supplier")]:
            s, _ = role_fixture
            r = s.get(f"{API}/tally/webhook-config")
            assert r.status_code == 403, f"{name} should be forbidden but got {r.status_code}"

    def test_webhook_post_no_token(self):
        r = requests.post(f"{API}/tally/webhook", data="<x/>", timeout=15)
        assert r.status_code == 401, r.text

    def test_webhook_post_wrong_token(self):
        r = requests.post(f"{API}/tally/webhook", params={"token": "not-a-real-token"},
                          data="<x/>", timeout=15)
        assert r.status_code == 401, r.text

    def test_webhook_post_xml_success(self, admin):
        s, _ = admin
        cfg = s.get(f"{API}/tally/webhook-config").json()
        secret = cfg["secret_full"]
        vch_no = f"TEST-VCH-{int(time.time())}"
        guid = f"TEST-GUID-{int(time.time())}"
        xml = f"""<ENVELOPE><BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE>
<VOUCHER VCHTYPE="Sales" ACTION="Create">
  <VOUCHERNUMBER>{vch_no}</VOUCHERNUMBER>
  <DATE>20260115</DATE>
  <PARTYNAME>TEST Party ABC</PARTYNAME>
  <AMOUNT>12345.50</AMOUNT>
  <GUID>{guid}</GUID>
</VOUCHER>
</TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>"""
        r = requests.post(f"{API}/tally/webhook", params={"token": secret},
                          data=xml, headers={"Content-Type": "application/xml"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["received"] == 1
        assert d["saved"] == 1
        # Verify persisted via events endpoint
        ev = s.get(f"{API}/tally/webhook-events", params={"limit": 200}).json()
        found = [e for e in ev if e.get("voucher_no") == vch_no and e.get("guid") == guid]
        assert found, "event not persisted"
        assert found[0]["voucher_type"] == "Sales"
        assert found[0]["party"] == "TEST Party ABC"
        assert abs(found[0]["amount"] - 12345.50) < 0.01
        assert found[0]["date"] == "2026-01-15"

    def test_webhook_post_json_success(self, admin):
        s, _ = admin
        cfg = s.get(f"{API}/tally/webhook-config").json()
        secret = cfg["secret_full"]
        vch_no = f"TEST-JSON-{int(time.time())}"
        guid = f"TEST-JGUID-{int(time.time())}"
        payload = {
            "voucher_type": "Purchase", "voucher_no": vch_no,
            "date": "2026-01-20", "party": "TEST JSON Party",
            "amount": 999.99, "guid": guid, "action": "create",
        }
        r = requests.post(f"{API}/tally/webhook",
                          headers={"X-Tally-Token": secret, "Content-Type": "application/json"},
                          json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["saved"] == 1

    def test_webhook_idempotency(self, admin):
        s, _ = admin
        cfg = s.get(f"{API}/tally/webhook-config").json()
        secret = cfg["secret_full"]
        vch_no = f"TEST-DEDUP-{int(time.time())}"
        guid = f"TEST-DEDUP-GUID-{int(time.time())}"
        payload = {
            "voucher_type": "Sales", "voucher_no": vch_no,
            "date": "2026-01-20", "party": "Dup Party",
            "amount": 100.0, "guid": guid, "action": "create",
        }
        for _ in range(2):
            r = requests.post(f"{API}/tally/webhook",
                              headers={"X-Tally-Token": secret, "Content-Type": "application/json"},
                              json=payload, timeout=20)
            assert r.status_code == 200
        # Verify only ONE row exists for this voucher, revisions >= 2
        ev = s.get(f"{API}/tally/webhook-events", params={"limit": 500}).json()
        rows = [e for e in ev if e.get("voucher_no") == vch_no and e.get("guid") == guid]
        assert len(rows) == 1, f"expected 1 row (idempotent), got {len(rows)}"
        assert rows[0].get("revisions", 0) >= 2, f"revisions not incremented: {rows[0]}"

    def test_webhook_malformed_xml(self, admin):
        s, _ = admin
        cfg = s.get(f"{API}/tally/webhook-config").json()
        secret = cfg["secret_full"]
        r = requests.post(f"{API}/tally/webhook", params={"token": secret},
                          data="<not-well-formed", headers={"Content-Type": "application/xml"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_webhook_empty_body(self, admin):
        s, _ = admin
        cfg = s.get(f"{API}/tally/webhook-config").json()
        secret = cfg["secret_full"]
        r = requests.post(f"{API}/tally/webhook", params={"token": secret},
                          data=b"", headers={"Content-Type": "application/xml"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_webhook_events_rbac(self, admin, mnp, dealer, supplier):
        s_admin, _ = admin
        r = s_admin.get(f"{API}/tally/webhook-events")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        s_mnp, _ = mnp
        assert s_mnp.get(f"{API}/tally/webhook-events").status_code == 200
        s_dealer, _ = dealer
        assert s_dealer.get(f"{API}/tally/webhook-events").status_code == 403
        s_supplier, _ = supplier
        assert s_supplier.get(f"{API}/tally/webhook-events").status_code == 403

    def test_webhook_success_writes_sync_log(self, admin):
        s, _ = admin
        cfg = s.get(f"{API}/tally/webhook-config").json()
        secret = cfg["secret_full"]
        pre_logs = s.get(f"{API}/tally/logs", params={"limit": 500}).json()
        pre_webhook_logs = [l for l in pre_logs if l.get("module") == "webhook"]
        payload = {
            "voucher_type": "Sales", "voucher_no": f"TEST-LOG-{int(time.time())}",
            "date": "2026-01-20", "party": "Log Party",
            "amount": 500.0, "guid": f"TEST-LOG-G-{int(time.time())}", "action": "create",
        }
        r = requests.post(f"{API}/tally/webhook",
                          headers={"X-Tally-Token": secret, "Content-Type": "application/json"},
                          json=payload, timeout=20)
        assert r.status_code == 200
        post_logs = s.get(f"{API}/tally/logs", params={"limit": 500}).json()
        post_webhook_logs = [l for l in post_logs if l.get("module") == "webhook"]
        assert len(post_webhook_logs) == len(pre_webhook_logs) + 1
        latest = post_webhook_logs[0]
        assert latest["direction"] == "webhook"
        assert latest["status"] == "success"

    def test_webhook_creates_admin_notification(self, admin):
        s, _ = admin
        cfg = s.get(f"{API}/tally/webhook-config").json()
        secret = cfg["secret_full"]
        vch_no = f"TEST-NOTIF-{int(time.time())}"
        payload = {
            "voucher_type": "Sales", "voucher_no": vch_no,
            "date": "2026-01-20", "party": "Notif Party",
            "amount": 700.0, "guid": f"TEST-NOTIF-G-{int(time.time())}", "action": "create",
        }
        r = requests.post(f"{API}/tally/webhook",
                          headers={"X-Tally-Token": secret, "Content-Type": "application/json"},
                          json=payload, timeout=20)
        assert r.status_code == 200
        notifs = s.get(f"{API}/notifications").json()
        # Find any notification with the voucher_no in body
        matched = [n for n in notifs if vch_no in (n.get("body") or "")]
        assert matched, "admin notification not created for webhook push"

    def test_webhook_rotate_invalidates_old(self, admin):
        s, _ = admin
        cfg = s.get(f"{API}/tally/webhook-config").json()
        old_secret = cfg["secret_full"]
        # Confirm old works
        payload = {
            "voucher_type": "Sales", "voucher_no": f"TEST-ROT-PRE-{int(time.time())}",
            "date": "2026-01-20", "party": "Pre",
            "amount": 1.0, "guid": f"TEST-ROT-PRE-G-{int(time.time())}", "action": "create",
        }
        r0 = requests.post(f"{API}/tally/webhook",
                          headers={"X-Tally-Token": old_secret, "Content-Type": "application/json"},
                          json=payload, timeout=15)
        assert r0.status_code == 200

        # Rotate
        r_rot = s.post(f"{API}/tally/webhook-config/rotate", json={})
        assert r_rot.status_code == 200, r_rot.text
        new_secret = r_rot.json()["secret_full"]
        assert new_secret and new_secret != old_secret

        # Old token now fails
        payload2 = {**payload, "voucher_no": f"TEST-ROT-POST-{int(time.time())}"}
        r_old = requests.post(f"{API}/tally/webhook",
                              headers={"X-Tally-Token": old_secret, "Content-Type": "application/json"},
                              json=payload2, timeout=15)
        assert r_old.status_code == 401

        # New token works
        r_new = requests.post(f"{API}/tally/webhook",
                              headers={"X-Tally-Token": new_secret, "Content-Type": "application/json"},
                              json=payload2, timeout=15)
        assert r_new.status_code == 200

        # Audit log entry written
        audits = s.get(f"{API}/audit-logs", params={"limit": 500}).json()
        rotate_entries = [a for a in audits if a.get("action") == "tally.webhook.rotate"]
        assert rotate_entries, "audit log entry 'tally.webhook.rotate' not found"


# ---------------- Tally Voucher Auto-Linking (Iteration 4) ----------------
class TestVoucherAutoLink:
    """Iteration 4 — Sales voucher ↔ Yamini order auto-linker (fuzzy party + 1% amount)."""

    @pytest.fixture(scope="class")
    def secret(self, admin):
        s, _ = admin
        return s.get(f"{API}/tally/webhook-config").json()["secret_full"]

    def _post_webhook(self, secret, payload):
        return requests.post(
            f"{API}/tally/webhook",
            headers={"X-Tally-Token": secret, "Content-Type": "application/json"},
            json=payload, timeout=20,
        )

    def _find_event(self, session, voucher_no):
        ev = session.get(f"{API}/tally/webhook-events", params={"limit": 500}).json()
        m = [e for e in ev if e.get("voucher_no") == voucher_no]
        return m[0] if m else None

    # 1) Non-sales voucher → link_status='non_sales'
    def test_non_sales_voucher_skipped(self, admin, secret):
        s, _ = admin
        vch = f"TEST-NS-{int(time.time())}"
        r = self._post_webhook(secret, {
            "voucher_type": "Purchase", "voucher_no": vch, "date": "2026-01-15",
            "party": "Anything", "amount": 100.0, "guid": vch, "action": "create",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["linked"] == 0 and d["ambiguous"] == 0 and d["unmatched"] == 0
        ev = self._find_event(s, vch)
        assert ev and ev.get("link_status") == "non_sales"

    # 2) Empty party → link_status='no_party'
    def test_no_party_voucher(self, admin, secret):
        s, _ = admin
        vch = f"TEST-NP-{int(time.time())}"
        r = self._post_webhook(secret, {
            "voucher_type": "Sales", "voucher_no": vch, "date": "2026-01-15",
            "party": "", "amount": 100.0, "guid": vch, "action": "create",
        })
        assert r.status_code == 200, r.text
        ev = self._find_event(s, vch)
        assert ev and ev.get("link_status") == "no_party"

    # 3) Unknown party → link_status='unmatched'
    def test_unknown_party_unmatched(self, admin, secret):
        s, _ = admin
        vch = f"TEST-UM-{int(time.time())}"
        r = self._post_webhook(secret, {
            "voucher_type": "Sales", "voucher_no": vch, "date": "2026-01-15",
            "party": "Zzz Unknown Nowhere Ltd", "amount": 999999.99,
            "guid": vch, "action": "create",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["unmatched"] >= 1
        ev = self._find_event(s, vch)
        assert ev and ev.get("link_status") == "unmatched"

    # 4) Ambiguous — multiple candidate Suresh Traders orders @₹2596 exist
    def test_ambiguous_multiple_candidates(self, admin, secret):
        s, _ = admin
        vch = f"TEST-AMB-{int(time.time())}"
        r = self._post_webhook(secret, {
            "voucher_type": "Sales", "voucher_no": vch, "date": "2026-01-15",
            "party": "Suresh Traders", "amount": 2596.0,
            "guid": vch, "action": "create",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        # Depending on seed data state may be ambiguous OR linked (if only 1 open)
        ev = self._find_event(s, vch)
        assert ev, "event not stored"
        assert ev.get("link_status") in ("ambiguous", "linked"), f"got {ev.get('link_status')}"
        if ev["link_status"] == "ambiguous":
            assert isinstance(ev.get("candidate_order_ids"), list) and len(ev["candidate_order_ids"]) >= 2
            assert d["ambiguous"] >= 1

    # 5) Auto-link happy path: single-match via unique amount
    def test_auto_link_single_match(self, admin, dealer, secret):
        s_admin, _ = admin
        s_dealer, _ = dealer
        # Create a fresh product with unique price to guarantee a unique total
        unique_price = 3141.59 + (int(time.time()) % 100)
        sku = f"TEST_AL_{int(time.time())}"
        pr = s_admin.post(f"{API}/products", json={
            "sku": sku, "name": "TEST AutoLink Product",
            "category": "Electronics", "price": unique_price, "cost": 100, "moq": 1,
        })
        assert pr.status_code == 200, pr.text
        pid = pr.json()["id"]
        try:
            # Dealer places order → this dealer is Suresh Traders Pvt Ltd
            r_o = s_dealer.post(f"{API}/orders", json={"items": [{"product_id": pid, "quantity": 1}]})
            assert r_o.status_code == 200, r_o.text
            order = r_o.json()
            order_no = order["order_no"]
            order_id = order["id"]
            order_total = order["total"]
            initial_status = order["status"]
            dealer_company = order["dealer_name"]  # 'Suresh Traders Pvt Ltd'

            # Post Sales voucher with fuzzy party ("Suresh Traders") + same amount
            vch = f"TEST-AL-{int(time.time())}"
            r = self._post_webhook(secret, {
                "voucher_type": "Sales", "voucher_no": vch, "date": "2026-01-15",
                "party": "Suresh Traders", "amount": order_total,
                "guid": vch, "action": "create",
            })
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["linked"] == 1, f"expected linked=1 got {d}"

            # Event has link_status=linked and matched_order_no
            ev = self._find_event(s_admin, vch)
            assert ev["link_status"] == "linked"
            assert ev.get("matched_order_no") == order_no

            # Order was mutated
            r_ord = s_admin.get(f"{API}/orders/{order_id}")
            assert r_ord.status_code == 200
            o2 = r_ord.json()
            assert o2["tally_voucher_no"] == vch
            assert o2.get("tally_voucher", {}).get("linked_by") == "auto"
            if initial_status in ("pending", "approved"):
                assert o2["status"] == "shipped", f"expected shipped got {o2['status']}"

            # Audit log has order.voucher_linked
            audits = s_admin.get(f"{API}/audit-logs", params={"limit": 500}).json()
            linked_audits = [a for a in audits
                             if a.get("action") == "order.voucher_linked"
                             and a.get("target") == order_no]
            assert linked_audits, "audit log 'order.voucher_linked' missing"

            # 6) IDEMPOTENCY: Posting SAME voucher again — order now filtered out → unmatched
            vch2 = vch  # same voucher — will hit idempotency in persist_events
            r2 = self._post_webhook(secret, {
                "voucher_type": "Sales", "voucher_no": vch2, "date": "2026-01-15",
                "party": "Suresh Traders", "amount": order_total,
                "guid": vch2, "action": "create",
            })
            assert r2.status_code == 200
            # The re-post should not create another linked pairing
            r_ord2 = s_admin.get(f"{API}/orders/{order_id}").json()
            assert r_ord2["tally_voucher_no"] == vch, "voucher_no must not change on re-post"
        finally:
            # cleanup product (order cleanup not needed, leaves data for retest inspection)
            s_admin.delete(f"{API}/products/{pid}")

    # 7) Candidates endpoint — admin gets list, dealer 403
    def test_candidates_endpoint_rbac(self, admin, dealer, secret):
        s_admin, _ = admin
        # Trigger an ambiguous event to get an event_id with candidates
        vch = f"TEST-CAND-{int(time.time())}"
        self._post_webhook(secret, {
            "voucher_type": "Sales", "voucher_no": vch, "date": "2026-01-15",
            "party": "Suresh Traders", "amount": 2596.0,
            "guid": vch, "action": "create",
        })
        ev = self._find_event(s_admin, vch)
        assert ev, "event not found"
        eid = ev["id"]

        r = s_admin.get(f"{API}/tally/webhook-events/{eid}/candidates")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

        s_dealer, _ = dealer
        r2 = s_dealer.get(f"{API}/tally/webhook-events/{eid}/candidates")
        assert r2.status_code == 403

    # 8) Manual link + missing order_id 400 + dealer 403 + unlink
    def test_manual_link_and_unlink(self, admin, dealer, secret):
        s_admin, _ = admin
        s_dealer, _ = dealer

        # Set up: ambiguous event
        vch = f"TEST-ML-{int(time.time())}"
        r0 = self._post_webhook(secret, {
            "voucher_type": "Sales", "voucher_no": vch, "date": "2026-01-15",
            "party": "Suresh Traders", "amount": 2596.0,
            "guid": vch, "action": "create",
        })
        assert r0.status_code == 200
        ev = self._find_event(s_admin, vch)
        assert ev and ev["link_status"] in ("ambiguous", "linked", "unmatched")
        eid = ev["id"]

        # Fetch candidates and pick one open order
        cands = s_admin.get(f"{API}/tally/webhook-events/{eid}/candidates").json()
        if not cands:
            # No open Suresh orders left; skip
            pytest.skip("no candidate orders available for manual link test")
        order_id = cands[0]["id"]
        order_no = cands[0]["order_no"]
        initial_status = cands[0]["status"]

        # Missing order_id → 400
        r_bad = s_admin.post(f"{API}/tally/webhook-events/{eid}/link", json={})
        assert r_bad.status_code == 400

        # Dealer forbidden
        r_forbid = s_dealer.post(f"{API}/tally/webhook-events/{eid}/link", json={"order_id": order_id})
        assert r_forbid.status_code == 403

        # Admin valid link
        r_link = s_admin.post(f"{API}/tally/webhook-events/{eid}/link", json={"order_id": order_id})
        assert r_link.status_code == 200, r_link.text
        assert r_link.json().get("ok") is True

        # Event now linked
        ev2 = self._find_event(s_admin, vch)
        assert ev2["link_status"] == "linked"
        assert ev2["matched_order_no"] == order_no

        # Order bumped + linked_by='manual'
        r_ord = s_admin.get(f"{API}/orders/{order_id}").json()
        assert r_ord["tally_voucher_no"] == vch
        assert r_ord.get("tally_voucher", {}).get("linked_by") == "manual"
        if initial_status in ("pending", "approved"):
            assert r_ord["status"] == "shipped"

        # Audit trail
        audits = s_admin.get(f"{API}/audit-logs", params={"limit": 500}).json()
        assert any(a.get("action") == "tally.webhook.manual_link" and a.get("target") == eid
                   for a in audits), "manual_link audit missing"

        # 9) Unlink — dealer 403
        r_unlink_dealer = s_dealer.post(f"{API}/tally/webhook-events/{eid}/unlink", json={})
        assert r_unlink_dealer.status_code == 403

        # Unlink — admin
        r_unlink = s_admin.post(f"{API}/tally/webhook-events/{eid}/unlink", json={})
        assert r_unlink.status_code == 200, r_unlink.text

        # Event now unmatched, order has no voucher
        ev3 = self._find_event(s_admin, vch)
        assert ev3["link_status"] == "unmatched"
        assert not ev3.get("matched_order_no")
        r_ord2 = s_admin.get(f"{API}/orders/{order_id}").json()
        assert not r_ord2.get("tally_voucher_no")

        # Unlink audit
        audits2 = s_admin.get(f"{API}/audit-logs", params={"limit": 500}).json()
        assert any(a.get("action") == "tally.webhook.unlink" and a.get("target") == eid
                   for a in audits2), "unlink audit missing"

    # 10) Fuzzy party matcher — unit test via direct import
    def test_fuzzy_party_matcher(self):
        import sys, os
        # Load backend/.env so voucher_linker → db module can import cleanly
        env_path = Path(__file__).resolve().parents[1] / ".env"
        if not env_path.exists():
            env_path = Path("/app/backend/.env")
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from voucher_linker import _party_matches, _amount_matches

        # Should match
        assert _party_matches("Suresh Traders", "Suresh Traders Pvt Ltd")
        assert _party_matches("Krishna Enterprises", "krishna enterprises")
        assert _party_matches("Metro Supplies", "Metro Supplies Ltd")
        assert _party_matches("Suresh Traders Pvt Ltd", "Suresh Traders")  # bidirectional

        # Should NOT match
        assert not _party_matches("Suresh Traders", "Krishna Enterprises")
        assert not _party_matches("Suresh", "Traders")
        assert not _party_matches("", "Suresh")
        assert not _party_matches("Suresh", "")

        # Amount tolerance 1%
        assert _amount_matches(100.0, 100.5)   # 0.5%
        assert _amount_matches(1000.0, 1009.0)  # 0.9%
        assert not _amount_matches(1000.0, 1020.0)  # 2%
        assert not _amount_matches(0, 100)
        assert not _amount_matches(100, 0)


# ---------------- Logout ----------------
class TestLogout:
    def test_logout(self):
        email, pwd = CREDS["admin"]
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert r.status_code == 200
        token = r.json()["access_token"]
        s.headers.update({"Authorization": f"Bearer {token}"})
        r2 = s.post(f"{API}/auth/logout")
        assert r2.status_code == 200
        assert r2.json()["ok"] is True
