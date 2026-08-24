"""
Yamini Flow — Production Data Restore Script
Restores database to Aug 21 state:
- Fixes dealer info (emails, names)
- Fixes existing order dealer_name/email to match actual dealer names
- Creates proper orders for Rajgopal and BHUVANESH
- Ensures full product catalog, inventory, warehouses are correct
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import sys
sys.path.insert(0, os.path.dirname(__file__))

from db import db, now_iso
from auth import hash_password


DEALERS = [
    {
        "id": "6a7ebc85c810c22713b47aed",
        "name": "Arirya Saha",
        "company": "Codeverse Solutions",
        "email": "arvi7105@gmail.com",
        "phone": "+91-9876500001",
        "city": "Mumbai",
        "state": "Maharashtra",
        "gstin": "27AARCA1234A1Z5",
        "user_code": "D-CO-WE-104",
        "login_id": "D-CO-WE-104",
        "credit_limit": 500000,
        "target_monthly": 200000,
        "target_quarterly": 600000,
    },
    {
        "id": "6a6b4576c10af82d3b79e54a",
        "name": "BHUVANESH",
        "company": "Bhuvanesh Enterprises",
        "email": "bhuvanesh@yaminiflow.com",
        "phone": "+91-9876500002",
        "city": "Hyderabad",
        "state": "Telangana",
        "gstin": "36AAHCB1234B1Z1",
        "user_code": "D-AE-HR-103",
        "login_id": "D-AE-HR-103",
        "credit_limit": 300000,
        "target_monthly": 150000,
        "target_quarterly": 450000,
    },
    {
        "id": "6a6b454cbc42ebb372fec293",
        "name": "Rajgopal",
        "company": "Rajgopal Traders",
        "email": "rajgopal@yaminiflow.com",
        "phone": "+91-9876500003",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "gstin": "33AAJCR1234C1Z9",
        "user_code": "D-SA-TN-102",
        "login_id": "D-SA-TN-102",
        "credit_limit": 400000,
        "target_monthly": 180000,
        "target_quarterly": 540000,
    },
    {
        "id": "6a6b4337c1bdcdf631462712",
        "name": "Akshay Kumar",
        "company": "Maruti Traders",
        "email": "idk@gmail.com",
        "phone": "+91-9876500004",
        "city": "Chandigarh",
        "state": "Punjab",
        "gstin": "03AAACK1234D1Z2",
        "user_code": "D-MT-PB-101",
        "login_id": "D-MT-PB-101",
        "credit_limit": 350000,
        "target_monthly": 160000,
        "target_quarterly": 480000,
    },
]

# Product catalog (from price list YFS-PL-001)
PRODUCTS = [
    {"sku": "35D16", "name": "CSK Drywall Screws 3.5X16", "category": "CSK Drywall Screws", "size": "3.5X16", "rate": 322, "dealer_landing": 161, "qty_per_box": 1000, "wt_1000_pcs_kg": 0.67},
    {"sku": "35D19", "name": "CSK Drywall Screws 3.5X19", "category": "CSK Drywall Screws", "size": "3.5X19", "rate": 368, "dealer_landing": 184, "qty_per_box": 1000, "wt_1000_pcs_kg": 0.92},
    {"sku": "35D25", "name": "CSK Drywall Screws 3.5X25", "category": "CSK Drywall Screws", "size": "3.5X25", "rate": 450, "dealer_landing": 225, "qty_per_box": 1000, "wt_1000_pcs_kg": 1.13},
    {"sku": "35D32", "name": "CSK Drywall Screws 3.5X32", "category": "CSK Drywall Screws", "size": "3.5X32", "rate": 452, "dealer_landing": 226, "qty_per_box": 750, "wt_1000_pcs_kg": 1.35},
    {"sku": "35D38", "name": "CSK Drywall Screws 3.5X38", "category": "CSK Drywall Screws", "size": "3.5X38", "rate": 351, "dealer_landing": 175, "qty_per_box": 500, "wt_1000_pcs_kg": 1.53},
    {"sku": "35D50", "name": "CSK Drywall Screws 3.5X50", "category": "CSK Drywall Screws", "size": "3.5X50", "rate": 641, "dealer_landing": 321, "qty_per_box": 500, "wt_1000_pcs_kg": 1.91},
    {"sku": "4CB16", "name": "CSK Chipboard Screws 4X16", "category": "CSK Chipboard Screws", "size": "4X16", "rate": 556, "dealer_landing": 278, "qty_per_box": 1000, "wt_1000_pcs_kg": 1.0},
    {"sku": "4CB20", "name": "CSK Chipboard Screws 4X20", "category": "CSK Chipboard Screws", "size": "4X20", "rate": 689, "dealer_landing": 345, "qty_per_box": 1000, "wt_1000_pcs_kg": 1.29},
    {"sku": "4CB25", "name": "CSK Chipboard Screws 4X25", "category": "CSK Chipboard Screws", "size": "4X25", "rate": 791, "dealer_landing": 395, "qty_per_box": 1000, "wt_1000_pcs_kg": 1.48},
    {"sku": "4CB30", "name": "CSK Chipboard Screws 4X30", "category": "CSK Chipboard Screws", "size": "4X30", "rate": 940, "dealer_landing": 470, "qty_per_box": 1000, "wt_1000_pcs_kg": 1.76},
    {"sku": "4CB35", "name": "CSK Chipboard Screws 4X35", "category": "CSK Chipboard Screws", "size": "4X35", "rate": 756, "dealer_landing": 378, "qty_per_box": 500, "wt_1000_pcs_kg": 1.94},
    {"sku": "4CB40", "name": "CSK Chipboard Screws 4X40", "category": "CSK Chipboard Screws", "size": "4X40", "rate": 869, "dealer_landing": 434, "qty_per_box": 500, "wt_1000_pcs_kg": 2.23},
    {"sku": "5CB25", "name": "CSK Chipboard Screws 5X25", "category": "CSK Chipboard Screws", "size": "5X25", "rate": 1250, "dealer_landing": 625, "qty_per_box": 500, "wt_1000_pcs_kg": 2.6},
    {"sku": "5CB30", "name": "CSK Chipboard Screws 5X30", "category": "CSK Chipboard Screws", "size": "5X30", "rate": 1400, "dealer_landing": 700, "qty_per_box": 500, "wt_1000_pcs_kg": 2.89},
    {"sku": "5CB50", "name": "CSK Chipboard Screws 5X50", "category": "CSK Chipboard Screws", "size": "5X50", "rate": 2000, "dealer_landing": 1000, "qty_per_box": 300, "wt_1000_pcs_kg": 4.05},
]

WAREHOUSES_DATA = [
    {"code": "WH-MUM", "name": "Mumbai Central", "city": "Mumbai", "state": "Maharashtra"},
    {"code": "WH-HYD", "name": "Hyderabad Depot", "city": "Hyderabad", "state": "Telangana"},
    {"code": "WH-CHN", "name": "Chennai South", "city": "Chennai", "state": "Tamil Nadu"},
    {"code": "WH-CHD", "name": "Chandigarh Hub", "city": "Chandigarh", "state": "Punjab"},
]

def make_order(order_no, dealer, product, boxes, status, days_ago=1, wh_name="Mumbai Central", wh_code="WH-MUM"):
    gst_rate = 0.18
    rate = product["dealer_landing"]
    subtotal = rate * boxes
    gst_amt = round(subtotal * gst_rate, 2)
    total = round(subtotal + gst_amt, 2)
    wt = round(product["wt_1000_pcs_kg"] * product["qty_per_box"] / 1000 * boxes, 3)
    created = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
    return {
        "order_no": order_no,
        "order_type": "dealer_order",
        "billing_type": "standard",
        "dealer_id": dealer["id"],
        "dealer_code": dealer["user_code"],
        "dealer_name": dealer["name"],
        "dealer_company": dealer["company"],
        "dealer_state": dealer["state"],
        "dealer_gstin": dealer.get("gstin", ""),
        "email": dealer["email"],
        "warehouse_name": wh_name,
        "warehouse_code": wh_code,
        "items": [
            {
                "sku": product["sku"],
                "product_name": product["name"],
                "category": product["category"],
                "size": product["size"],
                "boxes": boxes,
                "qty_per_box": product["qty_per_box"],
                "quantity": boxes * product["qty_per_box"],
                "rate": rate,
                "value_before_tax": subtotal,
                "gst_percent": 18,
                "gst_amount": gst_amt,
                "value_after_tax": total,
                "subtotal": total,
                "boxes_allocated": boxes if status in ["approved","dispatched","delivered","partially_fulfilled"] else 0,
                "boxes_invoiced": boxes if status in ["dispatched","delivered"] else 0,
                "quantity_allocated": boxes * product["qty_per_box"] if status in ["approved","dispatched","delivered","partially_fulfilled"] else 0,
            }
        ],
        "subtotal": subtotal,
        "gst": gst_amt,
        "total": total,
        "total_weight_kg": wt,
        "status": status,
        "reservation_status": "reserved" if status != "pending" else "pending",
        "payment_status": "paid" if status == "delivered" else "pending",
        "notes": "",
        "created_at": created,
        "updated_at": created,
    }


async def restore():
    print("\n========================================")
    print("  YAMINI FLOW — DATA RESTORE (Aug 21)  ")
    print("========================================\n")

    # --- STEP 1: Fix dealer records ---
    print("[1] Fixing dealer records in database...")
    for d in DEALERS:
        try:
            oid = ObjectId(d["id"])
            update = {
                "name": d["name"],
                "company": d["company"],
                "email": d["email"].lower(),
                "phone": d["phone"],
                "city": d["city"],
                "state": d["state"],
                "gstin": d["gstin"],
                "user_code": d["user_code"],
                "login_id": d["login_id"],
                "credit_limit": d["credit_limit"],
                "target_monthly": d["target_monthly"],
                "target_quarterly": d["target_quarterly"],
                "role": "dealer",
                "status": "active",
                "password_hash": hash_password("Dealer@123"),
                "updated_at": now_iso(),
            }
            res = await db.users.update_one({"_id": oid}, {"$set": update})
            print(f"   ✅ {d['name']} ({d['email']}) — matched:{res.matched_count}")
        except Exception as e:
            print(f"   ❌ {d['name']}: {e}")

    # --- STEP 2: Fix existing 35 orders — update dealer_name & email to match real dealer names ---
    print("\n[2] Fixing existing orders to use correct dealer names and emails...")
    
    # CODEVERSE orders → Arirya Saha
    arvi_id = "6a7ebc85c810c22713b47aed"
    arvi_dealer = next(d for d in DEALERS if d["id"] == arvi_id)
    r1 = await db.orders.update_many(
        {"dealer_id": arvi_id},
        {"$set": {
            "dealer_name": arvi_dealer["name"],
            "dealer_company": arvi_dealer["company"],
            "dealer_code": arvi_dealer["user_code"],
            "dealer_state": arvi_dealer["state"],
            "email": arvi_dealer["email"],
            "updated_at": now_iso(),
        }}
    )
    print(f"   ✅ Updated {r1.modified_count} CODEVERSE→{arvi_dealer['name']} orders")

    # Maruti Traders orders → Akshay Kumar
    akshay_id = "6a6b4337c1bdcdf631462712"
    akshay_dealer = next(d for d in DEALERS if d["id"] == akshay_id)
    r2 = await db.orders.update_many(
        {"dealer_id": akshay_id},
        {"$set": {
            "dealer_name": akshay_dealer["name"],
            "dealer_company": akshay_dealer["company"],
            "dealer_code": akshay_dealer["user_code"],
            "dealer_state": akshay_dealer["state"],
            "email": akshay_dealer["email"],
            "updated_at": now_iso(),
        }}
    )
    print(f"   ✅ Updated {r2.modified_count} 'Maruti Traders'→{akshay_dealer['name']} orders")

    # Also fix any orders still showing old names by dealer_name field
    await db.orders.update_many({"dealer_name": "CODEVERSE "}, {"$set": {"dealer_name": arvi_dealer["name"], "email": arvi_dealer["email"]}})
    await db.orders.update_many({"dealer_name": "Maruti Traders"}, {"$set": {"dealer_name": akshay_dealer["name"], "email": akshay_dealer["email"]}})

    # --- STEP 3: Create orders for BHUVANESH and Rajgopal ---
    print("\n[3] Creating orders for BHUVANESH and Rajgopal...")
    
    bhuvanesh = next(d for d in DEALERS if d["name"] == "BHUVANESH")
    rajgopal = next(d for d in DEALERS if d["name"] == "Rajgopal")

    # Check if they already have orders
    bhuv_existing = await db.orders.count_documents({"dealer_id": bhuvanesh["id"]})
    raj_existing = await db.orders.count_documents({"dealer_id": rajgopal["id"]})
    print(f"   Bhuvanesh existing orders: {bhuv_existing}, Rajgopal existing: {raj_existing}")

    new_orders = []
    
    if bhuv_existing == 0:
        new_orders += [
            make_order("ORD-2026-B001", bhuvanesh, PRODUCTS[6],  50, "delivered",    30, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B002", bhuvanesh, PRODUCTS[7],  30, "delivered",    25, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B003", bhuvanesh, PRODUCTS[2],  40, "delivered",    20, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B004", bhuvanesh, PRODUCTS[8],  25, "dispatched",   15, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B005", bhuvanesh, PRODUCTS[9],  20, "dispatched",   10, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B006", bhuvanesh, PRODUCTS[3],  35, "approved",      7, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B007", bhuvanesh, PRODUCTS[10], 15, "approved",      5, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B008", bhuvanesh, PRODUCTS[6],  60, "pending",       3, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B009", bhuvanesh, PRODUCTS[12], 10, "pending",       2, "Hyderabad Depot", "WH-HYD"),
            make_order("ORD-2026-B010", bhuvanesh, PRODUCTS[0],  45, "pending",       1, "Hyderabad Depot", "WH-HYD"),
        ]
        print(f"   ✅ Preparing 10 orders for BHUVANESH")
    
    if raj_existing == 0:
        new_orders += [
            make_order("ORD-2026-R001", rajgopal, PRODUCTS[7],  40, "delivered",    28, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R002", rajgopal, PRODUCTS[9],  20, "delivered",    22, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R003", rajgopal, PRODUCTS[6],  55, "delivered",    18, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R004", rajgopal, PRODUCTS[2],  30, "dispatched",   12, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R005", rajgopal, PRODUCTS[11], 25, "dispatched",    8, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R006", rajgopal, PRODUCTS[3],  35, "approved",      6, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R007", rajgopal, PRODUCTS[8],  15, "approved",      4, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R008", rajgopal, PRODUCTS[13], 20, "pending",       3, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R009", rajgopal, PRODUCTS[4],  40, "pending",       2, "Chennai South", "WH-CHN"),
            make_order("ORD-2026-R010", rajgopal, PRODUCTS[6],  50, "pending",       1, "Chennai South", "WH-CHN"),
        ]
        print(f"   ✅ Preparing 10 orders for Rajgopal")

    if new_orders:
        await db.orders.insert_many(new_orders)
        print(f"   ✅ Inserted {len(new_orders)} new orders into database")
    else:
        print("   ℹ️  Both dealers already have orders, skipping order creation")

    # --- STEP 4: Ensure warehouses exist ---
    print("\n[4] Ensuring warehouses are set up...")
    for wh in WAREHOUSES_DATA:
        await db.warehouses.update_one(
            {"code": wh["code"]},
            {"$setOnInsert": {**wh, "manager": "Yamini Group", "address": f"{wh['city']}, {wh['state']}", "created_at": now_iso()},
             "$set": {"updated_at": now_iso()}},
            upsert=True
        )
    wh_count = await db.warehouses.count_documents({})
    print(f"   ✅ Warehouses: {wh_count} total")

    # --- STEP 5: Ensure product catalog is complete ---
    print("\n[5] Ensuring product catalog is up to date...")
    for p in PRODUCTS:
        await db.products.update_one(
            {"sku": p["sku"]},
            {"$setOnInsert": {**p, "unit": "box", "gst": 18, "hsn": "7318", "status": "active", "created_at": now_iso()},
             "$set": {"name": p["name"], "rate": p["rate"], "price": p["rate"], "dealer_landing": p["dealer_landing"], "updated_at": now_iso()}},
            upsert=True
        )
    prod_count = await db.products.count_documents({})
    print(f"   ✅ Products: {prod_count} total")

    # --- STEP 6: Final verification ---
    print("\n[6] Final verification...")
    total_orders = await db.orders.count_documents({})
    
    print(f"\n   Admin sees:    {total_orders} orders total")
    for d in DEALERS:
        try:
            cnt = await db.orders.count_documents({"dealer_id": d["id"]})
        except:
            cnt = 0
        print(f"   {d['name']:20s}: {cnt} orders  ({d['email']}  /  {d['user_code']}  /  pw: Dealer@123)")

    print("\n========================================")
    print("  ✅ RESTORE COMPLETE")
    print("========================================")
    print("\nDealer Login Credentials:")
    print("  Admin:         admin@yaminiconnect.com   /  admin")
    for d in DEALERS:
        print(f"  {d['name']:20s}  {d['email']:35s}  /  Dealer@123")
        print(f"  {' ':20s}  OR code: {d['user_code']:25s}  /  Dealer@123")

if __name__ == "__main__":
    asyncio.run(restore())
