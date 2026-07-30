"""Seed database with demo admin, MNP, dealers, suppliers, products, warehouses, inventory."""
import os
from db import db, now_iso
from auth import hash_password


async def _upsert_user(email: str, password: str, name: str, role: str, extra: dict = None) -> str:
    existing = await db.users.find_one({"email": email.lower()})
    doc = {
        "email": email.lower(),
        "password_hash": hash_password(password),
        "name": name,
        "role": role,
        "status": "active",
        "updated_at": now_iso(),
    }
    if extra:
        doc.update(extra)
        
    if existing:
        await db.users.update_one({"_id": existing["_id"]}, {"$set": doc})
        return str(existing["_id"])
        
    doc["created_at"] = now_iso()
    res = await db.users.insert_one(doc)
    return str(res.inserted_id)



async def seed_all(force_purge: bool = True):
    if force_purge:
        # Purge all legacy demo users except admin@yaminiconnect.com
        await db.users.delete_many({"email": {"$ne": "admin@yaminiconnect.com"}})
        # Purge all mock orders, POs, logs, notifications, collations
        await db.orders.delete_many({})
        await db.purchase_orders.delete_many({})
        await db.tally_sync_logs.delete_many({})
        await db.tally_webhook_events.delete_many({})
        await db.audit_logs.delete_many({})
        await db.notifications.delete_many({})
        await db.collations.delete_many({})
        await db.inventory.delete_many({})

    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@yaminiconnect.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@yamini12")
    await _upsert_user(admin_email, admin_password, "System Admin", "admin",
                       {"phone": "+91-9999999999", "company": "Yamini Group", "admin_role": "super_admin",
                        "username": "admin", "login_id": "admin", "user_code": "ADMIN-101"})

    # Ensure admin password matches env
    existing_admin = await db.users.find_one({"email": admin_email.lower()})
    if existing_admin:
        from auth import verify_password
        if not verify_password(admin_password, existing_admin.get("password_hash", "")):
            await db.users.update_one(
                {"_id": existing_admin["_id"]},
                {"$set": {"password_hash": hash_password(admin_password), "updated_at": now_iso()}},
            )

    # Categories
    categories = ["Electronics", "Appliances", "Hardware", "Furniture", "CSK Chipboard Screws", "CSK Drywall Screws"]
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

    # Total Weight Matrix data (23 sizes of CSK Chipboard & Drywall Screws)
    matrix_data = [
        # CSK CHIPBOARD SCREWS
        {"category": "CSK Chipboard Screws", "size": "4X16", "wt_1000_pcs_kg": 1.000, "qty_per_box": 1000, "rate": 556, "dealer_landing": 278, "item_code": "4CB16", "wd_basic": 195, "wd_landing": 231},
        {"category": "CSK Chipboard Screws", "size": "4X20", "wt_1000_pcs_kg": 1.290, "qty_per_box": 1000, "rate": 689, "dealer_landing": 345, "item_code": "4CB20", "wd_basic": 242, "wd_landing": 286},
        {"category": "CSK Chipboard Screws", "size": "4X25", "wt_1000_pcs_kg": 1.480, "qty_per_box": 1000, "rate": 791, "dealer_landing": 395, "item_code": "4CB25", "wd_basic": 278, "wd_landing": 328},
        {"category": "CSK Chipboard Screws", "size": "4X30", "wt_1000_pcs_kg": 1.760, "qty_per_box": 1000, "rate": 940, "dealer_landing": 470, "item_code": "4CB30", "wd_basic": 331, "wd_landing": 390},
        {"category": "CSK Chipboard Screws", "size": "4X35", "wt_1000_pcs_kg": 1.940, "qty_per_box": 500, "rate": 756, "dealer_landing": 378, "item_code": "4CB35", "wd_basic": 266, "wd_landing": 314},
        {"category": "CSK Chipboard Screws", "size": "4X40", "wt_1000_pcs_kg": 2.230, "qty_per_box": 500, "rate": 869, "dealer_landing": 434, "item_code": "4CB40", "wd_basic": 306, "wd_landing": 361},
        {"category": "CSK Chipboard Screws", "size": "4X45", "wt_1000_pcs_kg": 2.480, "qty_per_box": 500, "rate": 1846, "dealer_landing": 923, "item_code": "4CB45", "wd_basic": 649, "wd_landing": 766},
        {"category": "CSK Chipboard Screws", "size": "4X50", "wt_1000_pcs_kg": 2.720, "qty_per_box": 400, "rate": 1620, "dealer_landing": 810, "item_code": "4CB50", "wd_basic": 570, "wd_landing": 672},
        {"category": "CSK Chipboard Screws", "size": "5X20", "wt_1000_pcs_kg": 2.310, "qty_per_box": 500, "rate": 1100, "dealer_landing": 550, "item_code": "5CB20", "wd_basic": 385, "wd_landing": 454},
        {"category": "CSK Chipboard Screws", "size": "5X25", "wt_1000_pcs_kg": 2.600, "qty_per_box": 500, "rate": 1250, "dealer_landing": 625, "item_code": "5CB25", "wd_basic": 438, "wd_landing": 517},
        {"category": "CSK Chipboard Screws", "size": "5X30", "wt_1000_pcs_kg": 2.890, "qty_per_box": 500, "rate": 1400, "dealer_landing": 700, "item_code": "5CB30", "wd_basic": 490, "wd_landing": 578},
        {"category": "CSK Chipboard Screws", "size": "5X35", "wt_1000_pcs_kg": 3.180, "qty_per_box": 400, "rate": 1550, "dealer_landing": 775, "item_code": "5CB35", "wd_basic": 543, "wd_landing": 640},
        {"category": "CSK Chipboard Screws", "size": "5X40", "wt_1000_pcs_kg": 3.470, "qty_per_box": 400, "rate": 1700, "dealer_landing": 850, "item_code": "5CB40", "wd_basic": 595, "wd_landing": 702},
        {"category": "CSK Chipboard Screws", "size": "5X45", "wt_1000_pcs_kg": 3.770, "qty_per_box": 300, "rate": 1850, "dealer_landing": 925, "item_code": "5CB45", "wd_basic": 648, "wd_landing": 765},
        {"category": "CSK Chipboard Screws", "size": "5X50", "wt_1000_pcs_kg": 4.050, "qty_per_box": 300, "rate": 2000, "dealer_landing": 1000, "item_code": "5CB50", "wd_basic": 700, "wd_landing": 826},
        # CSK DRYWALL SCREWS
        {"category": "CSK Drywall Screws", "size": "3.5X16", "wt_1000_pcs_kg": 0.67, "qty_per_box": 1000, "rate": 322, "dealer_landing": 161, "item_code": "35D16", "wd_basic": 122, "wd_landing": 144},
        {"category": "CSK Drywall Screws", "size": "3.5X19", "wt_1000_pcs_kg": 0.92, "qty_per_box": 1000, "rate": 368, "dealer_landing": 184, "item_code": "35D19", "wd_basic": 139, "wd_landing": 164},
        {"category": "CSK Drywall Screws", "size": "3.5X25", "wt_1000_pcs_kg": 1.13, "qty_per_box": 1000, "rate": 450, "dealer_landing": 225, "item_code": "35D25", "wd_basic": 170, "wd_landing": 201},
        {"category": "CSK Drywall Screws", "size": "3.5X32", "wt_1000_pcs_kg": 1.35, "qty_per_box": 750, "rate": 452, "dealer_landing": 226, "item_code": "35D32", "wd_basic": 171, "wd_landing": 202},
        {"category": "CSK Drywall Screws", "size": "3.5X38", "wt_1000_pcs_kg": 1.53, "qty_per_box": 500, "rate": 351, "dealer_landing": 175, "item_code": "35D38", "wd_basic": 133, "wd_landing": 157},
        {"category": "CSK Drywall Screws", "size": "3.5X50", "wt_1000_pcs_kg": 1.91, "qty_per_box": 500, "rate": 641, "dealer_landing": 321, "item_code": "35D50", "wd_basic": 243, "wd_landing": 286},
        {"category": "CSK Drywall Screws", "size": "3.5X60", "wt_1000_pcs_kg": 2.28, "qty_per_box": 400, "rate": 619, "dealer_landing": 309, "item_code": "35D60", "wd_basic": 234, "wd_landing": 276},
        {"category": "CSK Drywall Screws", "size": "3.5X75", "wt_1000_pcs_kg": 2.68, "qty_per_box": 200, "rate": 774, "dealer_landing": 387, "item_code": "35D75", "wd_basic": 293, "wd_landing": 346},
    ]

    for md in matrix_data:
        await db.weight_matrix.update_one(
            {"item_code": md["item_code"]},
            {"$set": {**md, "updated_at": now_iso()}, "$setOnInsert": {"created_at": now_iso()}},
            upsert=True
        )

    # Products (catalog items + matrix products)
    prods = [
        {"sku": "LED-BLB-9W", "name": "LED Bulb 9W", "category": "Electronics", "description": "Energy efficient LED",
         "unit": "pcs", "weight_kg": 0.05, "wt_1000_pcs_kg": 50.0, "price": 120, "cost": 75, "gst": 18, "hsn": "8539",
         "moq": 50, "safety_stock": 200, "lead_time_days": 5, "status": "active",
         "primary_supplier_id": None},
        {"sku": "CEIL-FAN-48", "name": "Ceiling Fan 48\"", "category": "Appliances",
         "description": "High speed ceiling fan", "unit": "pcs", "weight_kg": 4.5, "wt_1000_pcs_kg": 4500.0, "price": 2200, "cost": 1600,
         "gst": 18, "hsn": "8414", "moq": 5, "safety_stock": 20, "lead_time_days": 7,
         "status": "active", "primary_supplier_id": None},
        {"sku": "SCRW-6MM", "name": "Screws 6mm (pack of 100)", "category": "Hardware",
         "description": "Steel screws", "unit": "pack", "weight_kg": 0.3, "wt_1000_pcs_kg": 3.0, "price": 180, "cost": 110,
         "gst": 18, "hsn": "7318", "moq": 10, "safety_stock": 50, "lead_time_days": 4,
         "status": "active", "primary_supplier_id": None},
        {"sku": "OFC-CHR-BLK", "name": "Office Chair Black", "category": "Furniture",
         "description": "Ergonomic office chair", "unit": "pcs", "weight_kg": 12, "wt_1000_pcs_kg": 12000.0, "price": 6500,
         "cost": 4800, "gst": 18, "hsn": "9401", "moq": 2, "safety_stock": 10, "lead_time_days": 10,
         "status": "active", "primary_supplier_id": None},
        {"sku": "MICROW-25L", "name": "Microwave 25L", "category": "Appliances",
         "description": "Convection microwave", "unit": "pcs", "weight_kg": 15, "wt_1000_pcs_kg": 15000.0, "price": 8900,
         "cost": 6700, "gst": 18, "hsn": "8516", "moq": 2, "safety_stock": 8, "lead_time_days": 12,
         "status": "active", "primary_supplier_id": None},
        {"sku": "USB-CBL-C", "name": "USB-C Cable 1m", "category": "Electronics",
         "description": "Fast charging USB-C", "unit": "pcs", "weight_kg": 0.1, "wt_1000_pcs_kg": 100.0, "price": 250,
         "cost": 130, "gst": 18, "hsn": "8544", "moq": 25, "safety_stock": 100, "lead_time_days": 3,
         "status": "active", "primary_supplier_id": None},
    ]
    # Include all 23 matrix screw items as products
    for md in matrix_data:
        prods.append({
            "sku": md["item_code"],
            "name": f"{md['category']} {md['size']}",
            "category": md["category"],
            "description": f"CSK Screw size {md['size']} ({md['wt_1000_pcs_kg']} kg per 1000 pcs, Box of {md['qty_per_box']} pcs)",
            "unit": "box",
            "weight_kg": round(md["wt_1000_pcs_kg"] / 1000.0, 5),
            "wt_1000_pcs_kg": md["wt_1000_pcs_kg"],
            "size": md["size"],
            "item_code": md["item_code"],
            "qty_per_box": md["qty_per_box"],
            "price": md["rate"],
            "cost": md["dealer_landing"],
            "dealer_landing": md["dealer_landing"],
            "wd_basic": md["wd_basic"],
            "wd_landing": md["wd_landing"],
            "gst": 18,
            "hsn": "7318",
            "moq": md["qty_per_box"],
            "safety_stock": md["qty_per_box"] * 5,
            "lead_time_days": 5,
            "status": "active",
            "primary_supplier_id": None,
        })
    for p in prods:
        await db.products.update_one(
            {"sku": p["sku"]},
            {"$set": {**p, "updated_at": now_iso()}, "$setOnInsert": {"created_at": now_iso()}},
            upsert=True
        )

    # Clean inventory: (warehouse × product) initialized to zero
    products = await db.products.find({}).to_list(200)
    if await db.inventory.count_documents({}) == 0:
        inv_docs = []
        for wh in warehouses:
            for p in products:
                inv_docs.append({
                    "warehouse_id": str(wh["_id"]),
                    "product_id": str(p["_id"]),
                    "quantity": 0,
                    "reserved": 0,
                    "safety_stock": p.get("safety_stock", 0),
                    "updated_at": now_iso(),
                })
        await db.inventory.insert_many(inv_docs)

    # Write credentials file
    try:
        os.makedirs("/app/memory", exist_ok=True)
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write("# YAMINI FLOW — Production Admin Credentials\n\n")
            f.write("## Admin\n- Email: admin@yaminiconnect.com\n- Password: Admin@yamini12\n- Role: admin\n\n")
            f.write("## Auth Endpoints\n- POST /api/auth/login\n- POST /api/auth/register (admin only)\n- GET /api/auth/me\n- POST /api/auth/logout\n")
    except Exception:
        pass


async def create_indexes():
    try:
        await db.users.drop_index("email_1")
    except Exception:
        pass
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("login_id", sparse=True)
    await db.users.create_index("user_code", sparse=True)
    await db.users.create_index("username", sparse=True)
    await db.users.create_index("employee_id", sparse=True)
    await db.users.create_index("role")
    await db.users.create_index("admin_role")
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
    await db.tally_webhook_events.create_index([("voucher_no", 1), ("guid", 1)])
    await db.tally_webhook_events.create_index("received_at")
    await db.weight_matrix.create_index("item_code", unique=True)
    await db.collations.create_index("batch_no", unique=True)


if __name__ == "__main__":
    import asyncio
    async def main():
        print("Creating indexes...")
        await create_indexes()
        print("Seeding database...")
        await seed_all()
        print("Database seed complete!")
    asyncio.run(main())
