"""Seed database with demo admin, MNP, dealers, suppliers, products, warehouses, inventory."""
import os
from db import db, now_iso
from auth import hash_password
async def _upsert_user(email: str, password: str, name: str, role: str, extra: dict = None) -> str:
    existing = await db.users.find_one({"email": email.lower()})
    user_name = existing.get("name") if (existing and existing.get("name")) else name
    doc = {
        "email": email.lower(),
        "password_hash": hash_password(password),
        "name": user_name,
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



async def seed_all(force_purge: bool = False):
    # Live data protection: never purge user-created records
    pass

    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@yaminiconnect.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@yamini12")
    existing_admin = await db.users.find_one({"email": admin_email.lower()})
    admin_name = existing_admin.get("name") if (existing_admin and existing_admin.get("name")) else "Arpan"
    admin_id = await _upsert_user(admin_email, admin_password, admin_name, "admin",
                       {"phone": "+91-9999999999", "company": "Yamini Group", "admin_role": "super_admin",
                        "username": "admin", "login_id": "admin", "user_code": "ADMIN-101"})
    existing_admin = await db.users.find_one({"email": admin_email.lower()})
    if existing_admin:
        from auth import verify_password
        if not verify_password(admin_password, existing_admin.get("password_hash", "")):
            await db.users.update_one(
                {"_id": existing_admin["_id"]},
                {"$set": {"password_hash": hash_password(admin_password), "updated_at": now_iso()}},
            )

    # CNF / MNP
    cnf_id_1 = await _upsert_user("mnp@yaminiflow.com", "Mnp@123", "Western Region Depot", "mnp",
                                  {"phone": "+91-9876543210", "company": "Western Region Depot", "area": "West India",
                                   "state": "Maharashtra", "user_code": "C-ST-MH-201", "login_id": "c-st-mh-201",
                                   "target_monthly": 500000, "target_quarterly": 1500000})

    cnf_id_2 = await _upsert_user("cnf_north@yaminiflow.com", "Cnf@123", "Northern Region Depot", "cnf",
                                  {"phone": "+91-9876543211", "company": "Northern Region Depot", "area": "North India",
                                   "state": "Delhi", "user_code": "C-ST-DL-202", "login_id": "c-st-dl-202",
                                   "target_monthly": 400000, "target_quarterly": 1200000})

    # Dealers
    dealer_id_1 = await _upsert_user("dealer@yaminiflow.com", "Dealer12", "Apex Distributors", "dealer",
                                     {"phone": "+91-9123456789", "company": "Apex Distributors", "city": "Mumbai",
                                      "state": "Maharashtra", "gstin": "27AAACA1234A1Z5", "credit_limit": 500000,
                                      "target_monthly": 200000, "target_quarterly": 600000, "cnf_id": cnf_id_1, "mnp_id": cnf_id_1,
                                      "user_code": "D-ST-MH-101", "login_id": "d-st-mh-101"})

    dealer_id_2 = await _upsert_user("star@yaminiflow.com", "Dealer12", "Star Hardware & Tools", "dealer",
                                     {"phone": "+91-9123456780", "company": "Star Hardware & Tools", "city": "Delhi",
                                      "state": "Delhi", "gstin": "07AAACS1234B1Z2", "credit_limit": 300000,
                                      "target_monthly": 150000, "target_quarterly": 450000, "cnf_id": cnf_id_2, "mnp_id": cnf_id_2,
                                      "user_code": "D-ST-DL-102", "login_id": "d-st-dl-102"})

    dealer_id_3 = await _upsert_user("metro@yaminiflow.com", "Dealer12", "Metro Hardware Depot", "dealer",
                                     {"phone": "+91-9123456781", "company": "Metro Hardware Depot", "city": "Bangalore",
                                      "state": "Karnataka", "gstin": "29AAACM1234C1Z9", "credit_limit": 400000,
                                      "target_monthly": 180000, "target_quarterly": 540000, "cnf_id": cnf_id_1, "mnp_id": cnf_id_1,
                                      "user_code": "D-ST-KA-103", "login_id": "d-st-ka-103"})

    # Suppliers
    supplier_id_1 = await _upsert_user("supplier@yaminiflow.com", "Supplier12", "Precision Screw Mfg Ltd", "supplier",
                                       {"phone": "+91-9898989898", "company": "Precision Screw Mfg Ltd", "city": "Pune",
                                        "state": "Maharashtra", "gstin": "27AAACP5678D1Z4", "lead_time_days": 5})

    supplier_id_2 = await _upsert_user("fasteners@yaminiflow.com", "Supplier12", "National Fasteners Corp", "supplier",
                                       {"phone": "+91-9898989899", "company": "National Fasteners Corp", "city": "Ludhiana",
                                        "state": "Punjab", "gstin": "03AAACN5678E1Z1", "lead_time_days": 7})

    # Categories
    categories = ["CSK Chipboard Screws", "CSK Drywall Screws"]
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

    # Total Weight Matrix data (Price List YFS-PL-001 - Effective 06 June 2026)
    matrix_data = [
        # SECTION 01: DRY WALL SCREWS
        {"sr_no": 1, "category": "CSK Drywall Screws", "category_section": "01 DRY WALL SCREWS", "size": "3.5X16", "size_mm": "3.5 x 16", "wt_1000_pcs_kg": 0.67, "qty_per_box": 1000, "rate": 322, "mrp": 322, "price": 322, "dealer_landing": 161, "cost": 161, "item_code": "35D16", "wd_basic": 122, "wd_landing": 144},
        {"sr_no": 2, "category": "CSK Drywall Screws", "category_section": "01 DRY WALL SCREWS", "size": "3.5X19", "size_mm": "3.5 x 19", "wt_1000_pcs_kg": 0.92, "qty_per_box": 1000, "rate": 368, "mrp": 368, "price": 368, "dealer_landing": 184, "cost": 184, "item_code": "35D19", "wd_basic": 139, "wd_landing": 164},
        {"sr_no": 3, "category": "CSK Drywall Screws", "category_section": "01 DRY WALL SCREWS", "size": "3.5X25", "size_mm": "3.5 x 25", "wt_1000_pcs_kg": 1.13, "qty_per_box": 1000, "rate": 450, "mrp": 450, "price": 450, "dealer_landing": 225, "cost": 225, "item_code": "35D25", "wd_basic": 170, "wd_landing": 201},
        {"sr_no": 4, "category": "CSK Drywall Screws", "category_section": "01 DRY WALL SCREWS", "size": "3.5X32", "size_mm": "3.5 x 32", "wt_1000_pcs_kg": 1.35, "qty_per_box": 750,  "rate": 452, "mrp": 452, "price": 452, "dealer_landing": 226, "cost": 226, "item_code": "35D32", "wd_basic": 171, "wd_landing": 202},
        {"sr_no": 5, "category": "CSK Drywall Screws", "category_section": "01 DRY WALL SCREWS", "size": "3.5X38", "size_mm": "3.5 x 38", "wt_1000_pcs_kg": 1.53, "qty_per_box": 500,  "rate": 351, "mrp": 351, "price": 351, "dealer_landing": 175, "cost": 175, "item_code": "35D38", "wd_basic": 133, "wd_landing": 157},
        {"sr_no": 6, "category": "CSK Drywall Screws", "category_section": "01 DRY WALL SCREWS", "size": "3.5X50", "size_mm": "3.5 x 50", "wt_1000_pcs_kg": 1.91, "qty_per_box": 500,  "rate": 641, "mrp": 641, "price": 641, "dealer_landing": 321, "cost": 321, "item_code": "35D50", "wd_basic": 243, "wd_landing": 286},
        {"sr_no": 7, "category": "CSK Drywall Screws", "category_section": "01 DRY WALL SCREWS", "size": "3.5X60", "size_mm": "3.5 x 60", "wt_1000_pcs_kg": 2.28, "qty_per_box": 400,  "rate": 619, "mrp": 619, "price": 619, "dealer_landing": 309, "cost": 309, "item_code": "35D60", "wd_basic": 234, "wd_landing": 276},
        {"sr_no": 8, "category": "CSK Drywall Screws", "category_section": "01 DRY WALL SCREWS", "size": "3.5X75", "size_mm": "3.5 x 75", "wt_1000_pcs_kg": 2.68, "qty_per_box": 200,  "rate": 774, "mrp": 774, "price": 774, "dealer_landing": 387, "cost": 387, "item_code": "35D75", "wd_basic": 293, "wd_landing": 346},

        # SECTION 02: CHIPBOARD SCREWS (ZINC)
        {"sr_no": 1, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "4X16", "size_mm": "4 x 16", "wt_1000_pcs_kg": 1.000, "qty_per_box": 1000, "rate": 556, "mrp": 556, "price": 556, "dealer_landing": 278, "cost": 278, "item_code": "4CB16", "wd_basic": 195, "wd_landing": 231},
        {"sr_no": 2, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "4X20", "size_mm": "4 x 20", "wt_1000_pcs_kg": 1.290, "qty_per_box": 1000, "rate": 689, "mrp": 689, "price": 689, "dealer_landing": 345, "cost": 345, "item_code": "4CB20", "wd_basic": 242, "wd_landing": 286},
        {"sr_no": 3, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "4X25", "size_mm": "4 x 25", "wt_1000_pcs_kg": 1.480, "qty_per_box": 1000, "rate": 791, "mrp": 791, "price": 791, "dealer_landing": 395, "cost": 395, "item_code": "4CB25", "wd_basic": 278, "wd_landing": 328},
        {"sr_no": 4, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "4X30", "size_mm": "4 x 30", "wt_1000_pcs_kg": 1.760, "qty_per_box": 1000, "rate": 940, "mrp": 940, "price": 940, "dealer_landing": 470, "cost": 470, "item_code": "4CB30", "wd_basic": 331, "wd_landing": 390},
        {"sr_no": 5, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "4X35", "size_mm": "4 x 35", "wt_1000_pcs_kg": 1.940, "qty_per_box": 500,  "rate": 756, "mrp": 756, "price": 756, "dealer_landing": 378, "cost": 378, "item_code": "4CB35", "wd_basic": 266, "wd_landing": 314},
        {"sr_no": 6, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "4X40", "size_mm": "4 x 40", "wt_1000_pcs_kg": 2.230, "qty_per_box": 500,  "rate": 869, "mrp": 869, "price": 869, "dealer_landing": 434, "cost": 434, "item_code": "4CB40", "wd_basic": 306, "wd_landing": 361},
        {"sr_no": 7, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "4X45", "size_mm": "4 x 45", "wt_1000_pcs_kg": 2.480, "qty_per_box": 500,  "rate": 1846, "mrp": 1846, "price": 1846, "dealer_landing": 923, "cost": 923, "item_code": "4CB45", "wd_basic": 649, "wd_landing": 766},
        {"sr_no": 8, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "4X50", "size_mm": "4 x 50", "wt_1000_pcs_kg": 2.720, "qty_per_box": 400,  "rate": 1620, "mrp": 1620, "price": 1620, "dealer_landing": 810, "cost": 810, "item_code": "4CB50", "wd_basic": 570, "wd_landing": 672},
        {"sr_no": 9, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "5X20", "size_mm": "5 x 20", "wt_1000_pcs_kg": 2.310, "qty_per_box": 500,  "rate": 1100, "mrp": 1100, "price": 1100, "dealer_landing": 550, "cost": 550, "item_code": "5CB20", "wd_basic": 385, "wd_landing": 454},
        {"sr_no": 10, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "5X25", "size_mm": "5 x 25", "wt_1000_pcs_kg": 2.600, "qty_per_box": 500,  "rate": 1250, "mrp": 1250, "price": 1250, "dealer_landing": 625, "cost": 625, "item_code": "5CB25", "wd_basic": 438, "wd_landing": 517},
        {"sr_no": 11, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "5X30", "size_mm": "5 x 30", "wt_1000_pcs_kg": 2.890, "qty_per_box": 500,  "rate": 1400, "mrp": 1400, "price": 1400, "dealer_landing": 700, "cost": 700, "item_code": "5CB30", "wd_basic": 490, "wd_landing": 578},
        {"sr_no": 12, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "5X35", "size_mm": "5 x 35", "wt_1000_pcs_kg": 3.180, "qty_per_box": 400,  "rate": 1550, "mrp": 1550, "price": 1550, "dealer_landing": 775, "cost": 775, "item_code": "5CB35", "wd_basic": 543, "wd_landing": 640},
        {"sr_no": 13, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "5X40", "size_mm": "5 x 40", "wt_1000_pcs_kg": 3.470, "qty_per_box": 400,  "rate": 1700, "mrp": 1700, "price": 1700, "dealer_landing": 850, "cost": 850, "item_code": "5CB40", "wd_basic": 595, "wd_landing": 702},
        {"sr_no": 14, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "5X45", "size_mm": "5 x 45", "wt_1000_pcs_kg": 3.770, "qty_per_box": 300,  "rate": 1850, "mrp": 1850, "price": 1850, "dealer_landing": 925, "cost": 925, "item_code": "5CB45", "wd_basic": 648, "wd_landing": 765},
        {"sr_no": 15, "category": "CSK Chipboard Screws", "category_section": "02 CHIPBOARD SCREWS (ZINC)", "size": "5X50", "size_mm": "5 x 50", "wt_1000_pcs_kg": 4.050, "qty_per_box": 300,  "rate": 2000, "mrp": 2000, "price": 2000, "dealer_landing": 1000, "cost": 1000, "item_code": "5CB50", "wd_basic": 700, "wd_landing": 826},
    ]

    for md in matrix_data:
        await db.weight_matrix.update_one(
            {"item_code": md["item_code"]},
            {"$set": {**md, "updated_at": now_iso()}, "$setOnInsert": {"created_at": now_iso()}},
            upsert=True
        )

    # Products list (Strict Fastener catalog aligned with Price List YFS-PL-001)
    prods = []
    for md in matrix_data:
        prods.append({
            "sku": md["item_code"],
            "item_code": md["item_code"],
            "sr_no": md["sr_no"],
            "name": f"{md['category']} {md['size']}",
            "category": md["category"],
            "category_section": md["category_section"],
            "size": md["size"],
            "size_mm": md["size_mm"],
            "description": f"{md['category_section']} size {md['size_mm']} ({md['wt_1000_pcs_kg']} kg/1000 pcs, Box of {md['qty_per_box']} pcs, MRP ₹{md['mrp']}, Dealer Landing ₹{md['dealer_landing']})",
            "unit": "box",
            "weight_kg": round(md["wt_1000_pcs_kg"] / 1000.0, 5),
            "wt_1000_pcs_kg": md["wt_1000_pcs_kg"],
            "qty_per_box": md["qty_per_box"],
            "packing_options": "200 PCS / 250 PCS / 500 PCS / 1000 PCS",
            "document_code": "YFS-PL-001",
            "revision_no": "01",
            "effective_date": "06 June 2026",
            "mrp": md["mrp"],
            "rate": md["rate"],
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

    # Seed initial demo orders if order count is 0
    if await db.orders.count_documents({}) == 0:
        wh_mum = warehouses[0] if warehouses else {}
        p_screw = products[0] if products else {}
        dlr_1 = await db.users.find_one({"email": "dealer@yaminiflow.com"})
        dlr_id = str(dlr_1["_id"]) if dlr_1 else "69999ad9999ad9999ad99991"
        
        sample_orders = [
            {
                "order_no": "ORD-20260001",
                "dealer_id": dlr_id,
                "dealer_code": "D-ST-MH-101",
                "dealer_name": "Apex Distributors",
                "dealer_state": "Maharashtra",
                "warehouse_id": str(wh_mum.get("_id", "")),
                "warehouse_code": wh_mum.get("code", "WH-MUM"),
                "warehouse_name": wh_mum.get("name", "Mumbai Central"),
                "status": "pending",
                "total": 12500.0,
                "total_weight_kg": 25.5,
                "items": [
                    {
                        "product_id": str(p_screw.get("_id", "")),
                        "product_name": p_screw.get("name", "CSK Chipboard Screws 4X16"),
                        "sku": p_screw.get("sku", "4CB16"),
                        "boxes": 10,
                        "boxes_allocated": 10,
                        "boxes_invoiced": 0,
                        "boxes_pending": 0,
                        "quantity": 10,
                        "quantity_ordered": 10,
                        "quantity_allocated": 10,
                        "quantity_invoiced": 0,
                        "quantity_pending": 0,
                        "qty_per_box": 1000,
                        "rate": 556.0,
                        "value_before_tax": 5560.0,
                        "gst_amount": 1000.8,
                        "value_after_tax": 6560.8,
                        "subtotal": 6560.8
                    }
                ],
                "created_at": now_iso(),
                "updated_at": now_iso()
            }
        ]
        await db.orders.insert_many(sample_orders)


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
