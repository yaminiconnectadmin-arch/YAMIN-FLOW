"""YAMINI FLOW backend integration tests via public URL."""
import os
import time
import pytest
import requests
from pathlib import Path

# Load frontend .env to pick REACT_APP_BACKEND_URL
FRONTEND_ENV = Path("/app/frontend/.env")
BASE_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("REACT_APP_BACKEND_URL"):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
        break
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@yaminiflow.com", "Admin@123"),
    "dealer": ("dealer@yaminiflow.com", "Dealer@123"),
    "mnp": ("mnp@yaminiflow.com", "Mnp@123"),
    "supplier": ("supplier@yaminiflow.com", "Supplier@123"),
}


# ---------------- Session fixtures ----------------
def _login(role: str):
    email, pwd = CREDS[role]
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=30)
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
        assert user["email"] == "admin@yaminiflow.com"
        assert user["role"] == "admin"

    def test_me_admin(self, admin):
        s, _ = admin
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "admin@yaminiflow.com", "password": "wrong"},
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
