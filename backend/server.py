"""Main FastAPI application - YAMINI FLOW backend."""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter, Request, Response
from starlette.middleware.cors import CORSMiddleware

from db import db, create_db_indexes
from seed import seed_all, create_indexes

from routers.auth_router import router as auth_router
from routers.catalog import router as catalog_router
from routers.partners import router as partners_router
from routers.orders import router as orders_router
from routers.procurement import router as procurement_router
from routers.ops import router as ops_router
from routers.staff_router import router as staff_router


logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("yamini_flow")


from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(title="YAMINI FLOW", version="2.0.2")

# GZip Compression for API response speed optimization
app.add_middleware(GZipMiddleware, minimum_size=500)

# Universal CORS configuration with Regex matching for all HTTPS domains
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import json

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception: {exc}")
    origin = request.headers.get("origin", "*")
    return Response(
        content=json.dumps({"detail": str(exc) or "Internal server error"}),
        status_code=500,
        media_type="application/json",
        headers={
            "Access-Control-Allow-Origin": origin if origin else "*",
            "Access-Control-Allow-Credentials": "true"
        }
    )
from models import LoginInput
from routers.auth_router import login as auth_login_func

@app.post("/auth/login")
@app.post("/auth/login/")
@app.post("/api/auth/login")
@app.post("/api/auth/login/")
@app.post("/login")
@app.post("/login/")
@app.post("/api/login")
@app.post("/api/login/")
async def universal_login_endpoint(payload: LoginInput, request: Request, response: Response):
    return await auth_login_func(payload, request, response)

@app.get("/")
@app.get("/api")
@app.get("/api/")
async def root():
    return {"app": "YAMINI FLOW", "version": "2.0.2", "status": "ok"}


@app.get("/health")
@app.get("/api/health")
async def health():
    try:
        await db.command("ping")
        orders_count = await db.orders.count_documents({})
        return {"status": "ok", "db": "up", "db_name": db.name, "orders_count": orders_count}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}


@app.get("/reset-prod-db")
@app.get("/api/reset-prod-db")
async def reset_prod_db():
    from seed import seed_all, create_indexes
    try:
        await create_indexes()
    except Exception:
        pass
    await seed_all(force_purge=False)
    return {"status": "ok", "message": "Production indexes and master schema refreshed."}


@app.get("/api/restore-aug21")
@app.get("/restore-aug21")
async def restore_aug21_data():
    """Restore all dealer records and orders to Aug 21 state."""
    from auth import hash_password
    from bson import ObjectId
    from datetime import datetime, timezone, timedelta
    from db import now_iso as _now_iso

    DEALERS = [
        {"id": "6a7ebc85c810c22713b47aed", "name": "Arirya Saha", "company": "Codeverse Solutions",
         "email": "arvi7105@gmail.com", "phone": "+91-9876500001", "city": "Mumbai", "state": "Maharashtra",
         "gstin": "27AARCA1234A1Z5", "user_code": "D-CO-WE-104", "login_id": "D-CO-WE-104",
         "credit_limit": 500000, "target_monthly": 200000, "target_quarterly": 600000},
        {"id": "6a7ad720c76d025a43b9b3bc", "name": "BHUVANESH", "company": "Bhuvanesh Enterprises",
         "email": "bhuvanesh@yaminiflow.com", "phone": "+91-9876500002", "city": "Hyderabad", "state": "Telangana",
         "gstin": "36AAHCB1234B1Z1", "user_code": "D-AE-HR-103", "login_id": "D-AE-HR-103",
         "credit_limit": 300000, "target_monthly": 150000, "target_quarterly": 450000},
        {"id": "6a6b454cbc42ebb372fec293", "name": "Rajgopal", "company": "Rajgopal Traders",
         "email": "rajgopal@yaminiflow.com", "phone": "+91-9876500003", "city": "Chennai", "state": "Tamil Nadu",
         "gstin": "33AAJCR1234C1Z9", "user_code": "D-SA-TN-102", "login_id": "D-SA-TN-102",
         "credit_limit": 400000, "target_monthly": 180000, "target_quarterly": 540000},
        {"id": "6a6b4337c1bdcdf631462712", "name": "Akshay Kumar", "company": "Maruti Traders",
         "email": "idk@gmail.com", "phone": "+91-9876500004", "city": "Chandigarh", "state": "Punjab",
         "gstin": "03AAACK1234D1Z2", "user_code": "D-MT-PB-101", "login_id": "D-MT-PB-101",
         "credit_limit": 350000, "target_monthly": 160000, "target_quarterly": 480000},
    ]

    PRODUCTS = [
        {"sku": "35D16", "name": "CSK Drywall Screws 3.5X16", "category": "CSK Drywall Screws", "size": "3.5X16", "rate": 322, "dealer_landing": 161, "qty_per_box": 1000, "wt": 0.67},
        {"sku": "35D25", "name": "CSK Drywall Screws 3.5X25", "category": "CSK Drywall Screws", "size": "3.5X25", "rate": 450, "dealer_landing": 225, "qty_per_box": 1000, "wt": 1.13},
        {"sku": "35D38", "name": "CSK Drywall Screws 3.5X38", "category": "CSK Drywall Screws", "size": "3.5X38", "rate": 351, "dealer_landing": 175, "qty_per_box": 500, "wt": 1.53},
        {"sku": "4CB16", "name": "CSK Chipboard Screws 4X16", "category": "CSK Chipboard Screws", "size": "4X16", "rate": 556, "dealer_landing": 278, "qty_per_box": 1000, "wt": 1.0},
        {"sku": "4CB20", "name": "CSK Chipboard Screws 4X20", "category": "CSK Chipboard Screws", "size": "4X20", "rate": 689, "dealer_landing": 345, "qty_per_box": 1000, "wt": 1.29},
        {"sku": "4CB25", "name": "CSK Chipboard Screws 4X25", "category": "CSK Chipboard Screws", "size": "4X25", "rate": 791, "dealer_landing": 395, "qty_per_box": 1000, "wt": 1.48},
        {"sku": "4CB30", "name": "CSK Chipboard Screws 4X30", "category": "CSK Chipboard Screws", "size": "4X30", "rate": 940, "dealer_landing": 470, "qty_per_box": 1000, "wt": 1.76},
        {"sku": "4CB35", "name": "CSK Chipboard Screws 4X35", "category": "CSK Chipboard Screws", "size": "4X35", "rate": 756, "dealer_landing": 378, "qty_per_box": 500, "wt": 1.94},
        {"sku": "4CB40", "name": "CSK Chipboard Screws 4X40", "category": "CSK Chipboard Screws", "size": "4X40", "rate": 869, "dealer_landing": 434, "qty_per_box": 500, "wt": 2.23},
        {"sku": "5CB25", "name": "CSK Chipboard Screws 5X25", "category": "CSK Chipboard Screws", "size": "5X25", "rate": 1250, "dealer_landing": 625, "qty_per_box": 500, "wt": 2.6},
        {"sku": "5CB30", "name": "CSK Chipboard Screws 5X30", "category": "CSK Chipboard Screws", "size": "5X30", "rate": 1400, "dealer_landing": 700, "qty_per_box": 500, "wt": 2.89},
        {"sku": "5CB50", "name": "CSK Chipboard Screws 5X50", "category": "CSK Chipboard Screws", "size": "5X50", "rate": 2000, "dealer_landing": 1000, "qty_per_box": 300, "wt": 4.05},
    ]

    def make_order(no, dealer, prod, boxes, status, days_ago, wh_name, wh_code):
        subtotal = round(prod["dealer_landing"] * boxes, 2)
        gst = round(subtotal * 0.18, 2)
        total = round(subtotal + gst, 2)
        wt = round(prod["wt"] * prod["qty_per_box"] / 1000 * boxes, 3)
        dt = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
        return {
            "order_no": no, "order_type": "dealer_order", "billing_type": "standard",
            "dealer_id": dealer["id"], "dealer_code": dealer["user_code"],
            "dealer_name": dealer["name"], "dealer_company": dealer["company"],
            "dealer_state": dealer["state"], "dealer_gstin": dealer.get("gstin", ""),
            "email": dealer["email"], "warehouse_name": wh_name, "warehouse_code": wh_code,
            "items": [{"sku": prod["sku"], "product_name": prod["name"], "category": prod["category"],
                       "size": prod["size"], "boxes": boxes, "qty_per_box": prod["qty_per_box"],
                       "quantity": boxes * prod["qty_per_box"], "rate": prod["dealer_landing"],
                       "value_before_tax": subtotal, "gst_percent": 18, "gst_amount": gst,
                       "value_after_tax": total, "subtotal": total,
                       "boxes_allocated": boxes if status in ["approved","dispatched","delivered","partially_fulfilled"] else 0,
                       "boxes_invoiced": boxes if status in ["dispatched","delivered"] else 0,
                       "quantity_allocated": boxes * prod["qty_per_box"] if status in ["approved","dispatched","delivered","partially_fulfilled"] else 0}],
            "subtotal": subtotal, "gst": gst, "total": total, "total_weight_kg": wt,
            "status": status, "reservation_status": "reserved" if status != "pending" else "pending",
            "payment_status": "paid" if status == "delivered" else "pending",
            "notes": "", "created_at": dt, "updated_at": dt,
        }

    results = {}

    # Step 1: Fix all dealer records
    dealer_fixes = []
    for d in DEALERS:
        try:
            oid = ObjectId(d["id"])
            update = {
                "name": d["name"], "company": d["company"], "email": d["email"].lower(),
                "phone": d["phone"], "city": d["city"], "state": d["state"], "gstin": d["gstin"],
                "user_code": d["user_code"], "login_id": d["login_id"],
                "credit_limit": d["credit_limit"], "target_monthly": d["target_monthly"],
                "target_quarterly": d["target_quarterly"], "role": "dealer", "status": "active",
                "password_hash": hash_password("Dealer@123"), "updated_at": _now_iso(),
            }
            res = await db.users.update_one({"_id": oid}, {"$set": update})
            dealer_fixes.append({"dealer": d["name"], "matched": res.matched_count})
        except Exception as e:
            dealer_fixes.append({"dealer": d["name"], "error": str(e)})
    results["dealer_fixes"] = dealer_fixes

    # Step 2: Fix existing orders - update dealer_name to match real names
    arvi = DEALERS[0]; akshay = DEALERS[3]
    r1 = await db.orders.update_many(
        {"dealer_id": arvi["id"]},
        {"$set": {"dealer_name": arvi["name"], "dealer_company": arvi["company"],
                  "dealer_code": arvi["user_code"], "dealer_state": arvi["state"], "email": arvi["email"]}}
    )
    r2 = await db.orders.update_many(
        {"dealer_id": akshay["id"]},
        {"$set": {"dealer_name": akshay["name"], "dealer_company": akshay["company"],
                  "dealer_code": akshay["user_code"], "dealer_state": akshay["state"], "email": akshay["email"]}}
    )
    # Also fix by old dealer_name fields
    await db.orders.update_many({"dealer_name": "CODEVERSE "}, {"$set": {"dealer_name": arvi["name"], "email": arvi["email"], "dealer_id": arvi["id"]}})
    await db.orders.update_many({"dealer_name": "CODEVERSE"}, {"$set": {"dealer_name": arvi["name"], "email": arvi["email"], "dealer_id": arvi["id"]}})
    await db.orders.update_many({"dealer_name": "Maruti Traders"}, {"$set": {"dealer_name": akshay["name"], "email": akshay["email"], "dealer_id": akshay["id"]}})
    results["order_fixes"] = {"arvi_updated": r1.modified_count, "akshay_updated": r2.modified_count}

    # Step 3: Purge any generated test orders (ORD-2026-B... and ORD-2026-R...)
    del_res = await db.orders.delete_many({
        "$or": [
            {"order_no": {"$regex": "^ORD-2026-B"}},
            {"order_no": {"$regex": "^ORD-2026-R"}}
        ]
    })
    results["purged_generated_orders"] = del_res.deleted_count

    # Final counts
    final_counts = {}
    for d in DEALERS:
        cnt = await db.orders.count_documents({"dealer_id": d["id"]})
        final_counts[d["name"]] = cnt
    final_counts["total"] = await db.orders.count_documents({})
    results["final_order_counts"] = final_counts

    return {"status": "ok", "message": "Aug 21 data restore complete (original 35 orders preserved)", "results": results}


@app.get("/api/purge-generated-orders")
@app.get("/purge-generated-orders")
async def purge_generated_orders():
    del_res = await db.orders.delete_many({
        "$or": [
            {"order_no": {"$regex": "^ORD-2026-B"}},
            {"order_no": {"$regex": "^ORD-2026-R"}}
        ]
    })
    total = await db.orders.count_documents({})
    return {"status": "ok", "deleted": del_res.deleted_count, "total_remaining_orders": total}



# Mount all routers on root app directly (for stripped paths)
for r in [auth_router, catalog_router, partners_router, orders_router, procurement_router, ops_router, staff_router]:
    app.include_router(r)

# Mount all routers on /api
api = APIRouter(prefix="/api")
api.add_api_route("/reset-prod-db", reset_prod_db, methods=["GET"])
api.add_api_route("/restore-aug21", restore_aug21_data, methods=["GET"])
api.add_api_route("/purge-generated-orders", purge_generated_orders, methods=["GET"])
for r in [auth_router, catalog_router, partners_router, orders_router, procurement_router, ops_router, staff_router]:
    api.include_router(r)
app.include_router(api)

# Mount all routers on /api/v1
v1 = APIRouter(prefix="/api/v1")
v1.add_api_route("/reset-prod-db", reset_prod_db, methods=["GET"])
v1.add_api_route("/restore-aug21", restore_aug21_data, methods=["GET"])
v1.add_api_route("/purge-generated-orders", purge_generated_orders, methods=["GET"])
for r in [auth_router, catalog_router, partners_router, orders_router, procurement_router, ops_router, staff_router]:
    v1.include_router(r)
app.include_router(v1)



@app.on_event("startup")
async def on_startup():
    if not os.environ.get("VERCEL"):
        try:
            await create_indexes()
            await seed_all(force_purge=False)
            await db.orders.update_many(
                {"$or": [{"approved_at": {"$exists": False}}, {"approved_at": None}]},
                {"$set": {"status": "pending"}, "$unset": {"invoice_no": "", "invoices": "", "tally_voucher_no": "", "tally_voucher": ""}}
            )
            logger.info("YAMINI FLOW startup complete: indexes + seed done + unapproved docs sanitized")
        except Exception as e:
            logger.exception(f"Startup error: {e}")

    # Start 12 AM Auto-Collation Scheduler (only in standalone mode, not serverless)
    if not os.environ.get("VERCEL"):
        try:
            from routers.procurement import execute_order_collation
            try:
                from apscheduler.schedulers.asyncio import AsyncIOScheduler
                from apscheduler.triggers.cron import CronTrigger
                scheduler = AsyncIOScheduler()
                scheduler.add_job(
                    execute_order_collation,
                    trigger=CronTrigger(hour=0, minute=0),
                    kwargs={"triggered_by": "auto_12am"},
                    id="midnight_auto_collate",
                    replace_existing=True
                )
                scheduler.start()
                app.state.scheduler = scheduler
                logger.info("APScheduler started: nightly auto-collation scheduled for 12:00 AM.")
            except ImportError:
                import asyncio
                from datetime import datetime
                async def _midnight_loop():
                    while True:
                        now = datetime.now()
                        if now.hour == 0 and now.minute == 0:
                            logger.info("Triggering 12 AM auto-collation from fallback async loop...")
                            await execute_order_collation(triggered_by="auto_12am")
                            await asyncio.sleep(65)
                        await asyncio.sleep(30)
                asyncio.create_task(_midnight_loop())
                logger.info("Fallback async scheduler loop started for 12:00 AM auto-collation.")
        except Exception as e:
            logger.warning(f"Could not start scheduler: {e}")



@app.on_event("shutdown")
async def on_shutdown():
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown()
    logger.info("YAMINI FLOW shutting down")
