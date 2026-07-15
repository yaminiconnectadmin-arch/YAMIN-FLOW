"""Seed database with demo admin, MNP, dealers, suppliers, products, warehouses, inventory."""
import os
from db import db, now_iso
from auth import hash_password


async def _upsert_user(email: str, password: str, name: str, role: str, extra: dict = None) -> str:
    existing = await db.users.find_one({"email": email.lower()})
    if existing:
        return str(existing["_id"])
    doc = {
        "email": email.lower(), "password_hash": hash_password(password),
        "name": name, "role": role, "status": "active",
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    if extra:
        doc.update(extra)
    res = await db.users.insert_one(doc)
    return str(res.inserted_id)


async def seed_all():
    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@yaminiflow.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    await _upsert_user(admin_email, admin_password, "System Admin", "admin",
                       {"phone": "+91-9999999999", "company": "Yamini Group"})

    # Ensure admin password matches env
    existing_admin = await db.users.find_one({"email": admin_email.lower()})
    if existing_admin:
        from auth import verify_password
        if not verify_password(admin_password, existing_admin.get("password_hash", "")):
            await db.users.update_one(
                {"_id": existing_admin["_id"]},
                {"$set": {"password_hash": hash_password(admin_password), "updated_at": now_iso()}},
            )

    # Demo MNP
    mnp_id = await _upsert_user("mnp@yaminiflow.com", "Mnp@123", "Rajesh Kumar", "mnp",
                                {"phone": "+91-9000000001", "area": "West Zone", "state": "Maharashtra",
                                 "target_monthly": 500000})

    # Demo Dealer
    dealer_id = await _upsert_user("dealer@yaminiflow.com", "Dealer@123", "Suresh Traders", "dealer",
                                   {"phone": "+91-9000000002", "company": "Suresh Traders Pvt Ltd",
                                    "city": "Mumbai", "state": "Maharashtra", "gstin": "27ABCDE1234F1Z5",
                                    "credit_limit": 200000, "mnp_id": mnp_id})

    # Demo Supplier
    supplier_id = await _upsert_user("supplier@yaminiflow.com", "Supplier@123", "Metro Supplies", "supplier",
                                     {"phone": "+91-9000000003", "company": "Metro Supplies Ltd",
                                      "city": "Pune", "state": "Maharashtra", "gstin": "27XYZAB5678G1Z2",
                                      "lead_time_days": 5})

    # Second dealer for analytics
    await _upsert_user("dealer2@yaminiflow.com", "Dealer@123", "Krishna Enterprises", "dealer",
                       {"phone": "+91-9000000004", "company": "Krishna Enterprises",
                        "city": "Delhi", "state": "Delhi", "gstin": "07LMNOP9876H1Z3",
                        "credit_limit": 300000, "mnp_id": mnp_id})

    # Categories
    categories = ["Electronics", "Appliances", "Hardware", "Furniture"]
    for c in categories:
        await db.categories.update_one({"name": c}, {"$setOnInsert": {"name": c, "description": f"{c} category", "created_at": now_iso()}}, upsert=True)

    # Warehouses
    if await db.warehouses.count_documents({}) == 0:
        wh_docs = [
            {"code": "WH-MUM", "name": "Mumbai Central", "city": "Mumbai", "state": "Maharashtra",
             "address": "Andheri East, Mumbai", "manager": "Anil Sharma", "created_at": now_iso()},
            {"code": "WH-DEL", "name": "Delhi North", "city": "Delhi", "state": "Delhi",
             "address": "Rohini, Delhi", "manager": "Vikas Gupta", "created_at": now_iso()},
            {"code": "WH-BLR", "name": "Bangalore South", "city": "Bangalore", "state": "Karnataka",
             "address": "Electronic City, Bangalore", "manager": "Ravi Menon", "created_at": now_iso()},
        ]
        await db.warehouses.insert_many(wh_docs)

    warehouses = await db.warehouses.find({}).to_list(100)
    wh_ids = [str(w["_id"]) for w in warehouses]

    # Products
    if await db.products.count_documents({}) == 0:
        prods = [
            {"sku": "LED-BLB-9W", "name": "LED Bulb 9W", "category": "Electronics", "description": "Energy efficient LED",
             "unit": "pcs", "weight_kg": 0.05, "price": 120, "cost": 75, "gst": 18, "hsn": "8539",
             "moq": 50, "safety_stock": 200, "lead_time_days": 5, "status": "active",
             "primary_supplier_id": supplier_id},
            {"sku": "CEIL-FAN-48", "name": "Ceiling Fan 48\"", "category": "Appliances",
             "description": "High speed ceiling fan", "unit": "pcs", "weight_kg": 4.5, "price": 2200, "cost": 1600,
             "gst": 18, "hsn": "8414", "moq": 5, "safety_stock": 20, "lead_time_days": 7,
             "status": "active", "primary_supplier_id": supplier_id},
            {"sku": "SCRW-6MM", "name": "Screws 6mm (pack of 100)", "category": "Hardware",
             "description": "Steel screws", "unit": "pack", "weight_kg": 0.3, "price": 180, "cost": 110,
             "gst": 18, "hsn": "7318", "moq": 10, "safety_stock": 50, "lead_time_days": 4,
             "status": "active", "primary_supplier_id": supplier_id},
            {"sku": "OFC-CHR-BLK", "name": "Office Chair Black", "category": "Furniture",
             "description": "Ergonomic office chair", "unit": "pcs", "weight_kg": 12, "price": 6500,
             "cost": 4800, "gst": 18, "hsn": "9401", "moq": 2, "safety_stock": 10, "lead_time_days": 10,
             "status": "active", "primary_supplier_id": supplier_id},
            {"sku": "MICROW-25L", "name": "Microwave 25L", "category": "Appliances",
             "description": "Convection microwave", "unit": "pcs", "weight_kg": 15, "price": 8900,
             "cost": 6700, "gst": 18, "hsn": "8516", "moq": 2, "safety_stock": 8, "lead_time_days": 12,
             "status": "active", "primary_supplier_id": supplier_id},
            {"sku": "USB-CBL-C", "name": "USB-C Cable 1m", "category": "Electronics",
             "description": "Fast charging USB-C", "unit": "pcs", "weight_kg": 0.1, "price": 250,
             "cost": 130, "gst": 18, "hsn": "8544", "moq": 25, "safety_stock": 100, "lead_time_days": 3,
             "status": "active", "primary_supplier_id": supplier_id},
        ]
        for p in prods:
            p["created_at"] = now_iso()
            p["updated_at"] = now_iso()
        await db.products.insert_many(prods)

    # Inventory: (warehouse × product)
    products = await db.products.find({}).to_list(200)
    if await db.inventory.count_documents({}) == 0:
        import random
        random.seed(42)
        inv_docs = []
        for wh in warehouses:
            for p in products:
                qty = random.randint(0, 500)
                reserved = random.randint(0, min(50, qty))
                inv_docs.append({
                    "warehouse_id": str(wh["_id"]),
                    "product_id": str(p["_id"]),
                    "quantity": qty,
                    "reserved": reserved,
                    "safety_stock": p.get("safety_stock", 0),
                    "updated_at": now_iso(),
                })
        await db.inventory.insert_many(inv_docs)

    # Seed some orders for analytics
    if await db.orders.count_documents({}) == 0:
        import random
        random.seed(1)
        dealers = await db.users.find({"role": "dealer"}).to_list(50)
        prod_list = products
        statuses = ["delivered", "delivered", "delivered", "approved", "pending", "shipped"]
        orders = []
        from datetime import datetime, timedelta, timezone
        for i in range(24):
            d = random.choice(dealers)
            items = []
            total = 0
            for _ in range(random.randint(1, 4)):
                p = random.choice(prod_list)
                q = random.randint(1, 20)
                subtotal = p["price"] * q
                items.append({"product_id": str(p["_id"]), "product_name": p["name"],
                              "sku": p["sku"], "quantity": q, "price": p["price"],
                              "subtotal": subtotal})
                total += subtotal
            order_no = f"ORD-{2026}{i+1:04d}"
            days_ago = random.randint(0, 90)
            ts = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
            orders.append({
                "order_no": order_no,
                "dealer_id": str(d["_id"]),
                "dealer_name": d.get("company") or d["name"],
                "dealer_state": d.get("state", ""),
                "warehouse_id": random.choice(wh_ids),
                "items": items,
                "subtotal": total,
                "gst": round(total * 0.18, 2),
                "total": round(total * 1.18, 2),
                "status": random.choice(statuses),
                "notes": "",
                "created_at": ts,
                "updated_at": ts,
            })
        await db.orders.insert_many(orders)

    # Purchase orders sample
    if await db.purchase_orders.count_documents({}) == 0:
        import random
        random.seed(7)
        suppliers = await db.users.find({"role": "supplier"}).to_list(20)
        if suppliers:
            po_docs = []
            for i in range(6):
                s = random.choice(suppliers)
                items = []
                total = 0
                for _ in range(random.randint(1, 3)):
                    p = random.choice(products)
                    q = random.randint(20, 100)
                    r = p["cost"]
                    items.append({"product_id": str(p["_id"]), "product_name": p["name"],
                                  "sku": p["sku"], "quantity": q, "rate": r, "amount": q * r})
                    total += q * r
                po_docs.append({
                    "po_no": f"PO-2026{i+1:04d}",
                    "supplier_id": str(s["_id"]),
                    "supplier_name": s.get("company") or s["name"],
                    "warehouse_id": random.choice(wh_ids),
                    "items": items,
                    "subtotal": total,
                    "gst": round(total * 0.18, 2),
                    "total": round(total * 1.18, 2),
                    "status": random.choice(["draft", "sent", "confirmed", "received"]),
                    "expected_delivery": now_iso(),
                    "notes": "",
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                })
            await db.purchase_orders.insert_many(po_docs)

    # Tally sync logs seed
    if await db.tally_sync_logs.count_documents({}) == 0:
        import random
        modules = ["products", "stock", "sales", "purchases", "vouchers", "warehouses", "ledgers"]
        logs = []
        from datetime import datetime, timedelta, timezone
        for i in range(12):
            m = random.choice(modules)
            days_ago = random.randint(0, 20)
            ts = (datetime.now(timezone.utc) - timedelta(hours=days_ago * 4)).isoformat()
            logs.append({
                "module": m,
                "direction": random.choice(["push", "pull"]),
                "status": random.choice(["success", "success", "success", "failed"]),
                "records": random.randint(5, 200),
                "message": "Sync completed" if random.random() > 0.15 else "Timeout communicating with Tally",
                "duration_ms": random.randint(300, 4000),
                "created_at": ts,
            })
        await db.tally_sync_logs.insert_many(logs)

    # Write credentials file
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# YAMINI FLOW — Test Credentials\n\n")
        f.write("## Admin\n- Email: admin@yaminiflow.com\n- Password: Admin@123\n- Role: admin\n\n")
        f.write("## Dealer\n- Email: dealer@yaminiflow.com\n- Password: Dealer@123\n- Role: dealer\n\n")
        f.write("## Dealer 2\n- Email: dealer2@yaminiflow.com\n- Password: Dealer@123\n- Role: dealer\n\n")
        f.write("## MNP\n- Email: mnp@yaminiflow.com\n- Password: Mnp@123\n- Role: mnp\n\n")
        f.write("## Supplier\n- Email: supplier@yaminiflow.com\n- Password: Supplier@123\n- Role: supplier\n\n")
        f.write("## Auth Endpoints\n- POST /api/auth/login\n- POST /api/auth/register (admin only)\n- GET /api/auth/me\n- POST /api/auth/logout\n")


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.login_attempts.create_index("identifier")
    await db.products.create_index("sku", unique=True)
    await db.products.create_index("category")
    await db.inventory.create_index([("warehouse_id", 1), ("product_id", 1)], unique=True)
    await db.orders.create_index("dealer_id")
    await db.orders.create_index("status")
    await db.orders.create_index("created_at")
    await db.purchase_orders.create_index("supplier_id")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index("created_at")
    await db.tally_sync_logs.create_index("created_at")
