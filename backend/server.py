"""Main FastAPI application - YAMINI FLOW backend."""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from db import db
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


app = FastAPI(title="YAMINI FLOW", version="2.0.0")

# CORS — allow credentials with configured origins
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
cors_origins = os.environ.get("CORS_ORIGINS", frontend_url).split(",")
# We include frontend URL + wildcard patterns handled at ingress level
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url] if cors_origins == ["*"] else cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "YAMINI FLOW", "version": "2.0.0", "status": "ok"}


@api.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "up"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}


# mount versioned + non-versioned same routes (v1 alias)
for r in [auth_router, catalog_router, partners_router, orders_router, procurement_router, ops_router, staff_router]:
    api.include_router(r)

app.include_router(api)

# v1 alias
v1 = APIRouter(prefix="/api/v1")
for r in [auth_router, catalog_router, partners_router, orders_router, procurement_router, ops_router, staff_router]:
    v1.include_router(r)
app.include_router(v1)


@app.on_event("startup")
async def on_startup():
    try:
        await create_indexes()
        await seed_all()
        logger.info("YAMINI FLOW startup complete: indexes + seed done")
    except Exception as e:
        logger.exception(f"Startup error: {e}")

    # Start 12 AM Auto-Collation Scheduler
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
            # Fallback async loop if apscheduler not installed in environment
            import asyncio
            from datetime import datetime
            async def _midnight_loop():
                while True:
                    now = datetime.now()
                    if now.hour == 0 and now.minute == 0:
                        logger.info("Triggering 12 AM auto-collation from fallback async loop...")
                        await execute_order_collation(triggered_by="auto_12am")
                        await asyncio.sleep(65)  # wait past the minute
                    await asyncio.sleep(30)
            asyncio.create_task(_midnight_loop())
            logger.info("Fallback async scheduler loop started for 12:00 AM auto-collation.")
    except Exception as e:
        logger.exception(f"Could not initialize collation scheduler: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown()
    logger.info("YAMINI FLOW shutting down")
