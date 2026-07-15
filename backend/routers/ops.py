"""Tally Sync (mock) + AI Insights + Analytics + Notifications + Audit + Settings."""
import os
import random
import time
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin, require_roles
from models import TallySyncIn, AiInsightIn, NotificationIn

router = APIRouter(tags=["ops"])


# ------------------ TALLY SYNC (MOCK) ------------------
@router.get("/tally/status")
async def tally_status(user: dict = Depends(require_roles("admin", "mnp"))):
    last = await db.tally_sync_logs.find({}).sort("created_at", -1).to_list(1)
    modules_last = {}
    for m in ["products", "stock", "sales", "purchases", "vouchers", "warehouses", "ledgers"]:
        row = await db.tally_sync_logs.find({"module": m}).sort("created_at", -1).to_list(1)
        modules_last[m] = serialize_doc(row[0]) if row else None
    success_ct = await db.tally_sync_logs.count_documents({"status": "success"})
    fail_ct = await db.tally_sync_logs.count_documents({"status": "failed"})
    return {
        "last_sync": serialize_doc(last[0]) if last else None,
        "modules": modules_last,
        "success_count": success_ct,
        "failed_count": fail_ct,
        "health": "healthy" if fail_ct < success_ct * 0.2 else "degraded",
    }


@router.get("/tally/logs")
async def tally_logs(limit: int = 100, user: dict = Depends(require_roles("admin", "mnp"))):
    docs = await db.tally_sync_logs.find({}).sort("created_at", -1).to_list(limit)
    return serialize_docs(docs)


@router.post("/tally/sync")
async def tally_sync(payload: TallySyncIn, admin: dict = Depends(require_admin)):
    """Mock a Tally sync. In production this posts XML to Tally ODBC/HTTP endpoint."""
    start = time.time()
    # simulate records processed
    ranges = {"products": (5, 60), "stock": (10, 200), "sales": (10, 150),
              "purchases": (5, 80), "vouchers": (5, 300), "warehouses": (1, 5),
              "ledgers": (5, 40)}
    lo, hi = ranges.get(payload.module, (5, 50))
    records = random.randint(lo, hi)
    success = random.random() > 0.1
    duration_ms = int((time.time() - start) * 1000) + random.randint(300, 2500)
    log = {
        "module": payload.module,
        "direction": payload.direction,
        "status": "success" if success else "failed",
        "records": records if success else 0,
        "message": "Sync completed successfully" if success else "Timeout communicating with Tally ODBC on port 9000",
        "duration_ms": duration_ms,
        "created_at": now_iso(),
    }
    res = await db.tally_sync_logs.insert_one(log)
    log["_id"] = res.inserted_id
    await db.audit_logs.insert_one({
        "actor_id": admin["id"], "actor_email": admin["email"],
        "action": "tally.sync", "target": payload.module,
        "meta": {"direction": payload.direction, "status": log["status"], "records": log["records"]},
        "created_at": now_iso(),
    })
    return serialize_doc(log)


# ------------------ AI INSIGHTS ------------------
async def _gather_business_context() -> dict:
    total_orders = await db.orders.count_documents({})
    delivered = await db.orders.count_documents({"status": "delivered"})
    revenue_pipe = [{"$match": {"status": {"$in": ["delivered", "shipped", "approved"]}}},
                     {"$group": {"_id": None, "revenue": {"$sum": "$total"}}}]
    r = await db.orders.aggregate(revenue_pipe).to_list(1)
    revenue = r[0]["revenue"] if r else 0
    dealers = await db.users.count_documents({"role": "dealer"})
    suppliers = await db.users.count_documents({"role": "supplier"})
    products = await db.products.count_documents({})
    # Top dealers by revenue
    top_dealers = await db.orders.aggregate([
        {"$match": {"status": {"$in": ["delivered", "shipped", "approved"]}}},
        {"$group": {"_id": "$dealer_id", "name": {"$first": "$dealer_name"},
                     "state": {"$first": "$dealer_state"}, "revenue": {"$sum": "$total"},
                     "orders": {"$sum": 1}}},
        {"$sort": {"revenue": -1}}, {"$limit": 5}
    ]).to_list(5)
    # Top products
    top_products_pipe = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "name": {"$first": "$items.product_name"},
                     "units": {"$sum": "$items.quantity"}, "revenue": {"$sum": "$items.subtotal"}}},
        {"$sort": {"revenue": -1}}, {"$limit": 5}
    ]
    top_products = await db.orders.aggregate(top_products_pipe).to_list(5)
    return {
        "total_orders": total_orders,
        "delivered_orders": delivered,
        "revenue": round(revenue, 2),
        "dealers": dealers,
        "suppliers": suppliers,
        "products": products,
        "top_dealers": top_dealers,
        "top_products": top_products,
    }


@router.post("/ai/insight")
async def ai_insight(payload: AiInsightIn, admin: dict = Depends(require_roles("admin", "mnp"))):
    """Generate an AI insight via emergentintegrations Claude Sonnet."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    ctx = await _gather_business_context()
    topic_prompts = {
        "dealer_ranking": "Rank the top dealers by revenue and orders, explain who is driving growth and who might need attention.",
        "supplier_ranking": "Assess supplier reliability and performance based on lead times and PO status.",
        "demand_forecast": "Provide a short demand forecast for the next 30 days based on historical order volume and top products.",
        "procurement": "Recommend procurement priorities based on inventory levels and pending demand.",
        "sales_summary": "Provide a concise executive sales summary with 3 headline numbers and 3 actionable observations.",
        "dead_stock": "Identify products with low velocity / risk of dead stock and give recommendations.",
    }
    prompt = topic_prompts.get(payload.topic, payload.context or "Provide a distribution business insight.")
    context_text = (
        f"Business Snapshot:\n"
        f"- Total Orders: {ctx['total_orders']} (delivered: {ctx['delivered_orders']})\n"
        f"- Revenue (approved+): ₹{ctx['revenue']:,.0f}\n"
        f"- Dealers: {ctx['dealers']}  Suppliers: {ctx['suppliers']}  SKUs: {ctx['products']}\n"
        f"- Top Dealers: " + ", ".join([f"{d.get('name')} (₹{d.get('revenue',0):,.0f}, {d.get('orders',0)} orders)" for d in ctx["top_dealers"]]) + "\n"
        f"- Top Products: " + ", ".join([f"{p.get('name')} ({p.get('units',0)} units)" for p in ctx["top_products"]]) + "\n"
    )
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"insight-{payload.topic}-{admin['id']}",
        system_message="You are a senior distribution business analyst for an ERP platform called Yamini Flow. Write concise, executive-grade insights in plain prose (max 180 words). Use INR (₹) and refer only to data provided. Never invent numbers. End with a short 'Recommended Actions:' bullet list of 2-3 items.",
    ).with_model("anthropic", "claude-sonnet-4-6")

    user_msg = UserMessage(text=f"{context_text}\n\nTask: {prompt}")
    try:
        response = await chat.send_message(user_msg)
        text = response if isinstance(response, str) else str(response)
    except Exception as e:
        text = f"AI service unavailable ({str(e)[:120]}). Fallback: {prompt}. Snapshot revenue ₹{ctx['revenue']:,.0f}."

    doc = {
        "topic": payload.topic,
        "actor_id": admin["id"],
        "prompt": prompt,
        "output": text,
        "context_snapshot": ctx,
        "created_at": now_iso(),
    }
    res = await db.ai_insights.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)


@router.get("/ai/history")
async def ai_history(limit: int = 20, user: dict = Depends(require_roles("admin", "mnp"))):
    docs = await db.ai_insights.find({}).sort("created_at", -1).to_list(limit)
    return serialize_docs(docs)


# ------------------ ANALYTICS ------------------
@router.get("/analytics/overview")
async def analytics_overview(user: dict = Depends(get_current_user)):
    role = user["role"]
    now = datetime.now(timezone.utc)

    # Base filters
    if role == "dealer":
        order_q = {"dealer_id": user["id"]}
    elif role == "mnp":
        dealers = await db.users.find({"role": "dealer", "mnp_id": user["id"]}).to_list(500)
        did = [str(d["_id"]) for d in dealers]
        order_q = {"dealer_id": {"$in": did}}
    elif role == "supplier":
        order_q = None  # suppliers see PO stats
    else:
        order_q = {}

    total_revenue = 0
    total_orders = 0
    pending_orders = 0
    delivered = 0
    if order_q is not None:
        agg = await db.orders.aggregate([
            {"$match": order_q},
            {"$group": {"_id": "$status", "count": {"$sum": 1}, "total": {"$sum": "$total"}}},
        ]).to_list(20)
        for a in agg:
            total_orders += a["count"]
            if a["_id"] in ("delivered", "shipped", "approved"):
                total_revenue += a["total"]
            if a["_id"] == "pending":
                pending_orders = a["count"]
            if a["_id"] == "delivered":
                delivered = a["count"]

    # Inventory value
    inv_agg = await db.inventory.aggregate([
        {"$lookup": {"from": "products", "let": {"pid": {"$toObjectId": "$product_id"}},
                     "pipeline": [{"$match": {"$expr": {"$eq": ["$_id", "$$pid"]}}}], "as": "p"}},
        {"$unwind": {"path": "$p", "preserveNullAndEmptyArrays": True}},
        {"$group": {"_id": None,
                     "inventory_value": {"$sum": {"$multiply": ["$quantity", {"$ifNull": ["$p.price", 0]}]}},
                     "total_units": {"$sum": "$quantity"}}},
    ]).to_list(1)
    inv_value = inv_agg[0]["inventory_value"] if inv_agg else 0
    total_units = inv_agg[0]["total_units"] if inv_agg else 0

    dealer_count = await db.users.count_documents({"role": "dealer"})
    supplier_count = await db.users.count_documents({"role": "supplier"})
    product_count = await db.products.count_documents({})

    # Revenue trend (last 12 weeks)
    weeks = []
    for i in range(11, -1, -1):
        start_dt = now - timedelta(weeks=i + 1)
        end_dt = now - timedelta(weeks=i)
        q = {"created_at": {"$gte": start_dt.isoformat(), "$lt": end_dt.isoformat()},
             "status": {"$in": ["delivered", "shipped", "approved"]}}
        if order_q:
            q = {**q, **order_q}
        r = await db.orders.aggregate([
            {"$match": q}, {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}}}
        ]).to_list(1)
        weeks.append({
            "label": end_dt.strftime("%b %d"),
            "revenue": round(r[0]["revenue"], 2) if r else 0,
            "orders": r[0]["orders"] if r else 0,
        })

    # State-wise sales
    state_pipe = [
        {"$match": {"status": {"$in": ["delivered", "shipped", "approved"]}}},
        {"$group": {"_id": "$dealer_state", "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}}},
        {"$sort": {"revenue": -1}}, {"$limit": 10}
    ]
    if order_q:
        state_pipe[0]["$match"].update(order_q)
    state_data = await db.orders.aggregate(state_pipe).to_list(10)

    # Top dealers
    top_dealers_pipe = [
        {"$match": {"status": {"$in": ["delivered", "shipped", "approved"]}}},
        {"$group": {"_id": "$dealer_id", "name": {"$first": "$dealer_name"},
                     "state": {"$first": "$dealer_state"}, "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}}},
        {"$sort": {"revenue": -1}}, {"$limit": 5}
    ]
    top_dealers = await db.orders.aggregate(top_dealers_pipe).to_list(5)

    # Top products
    top_products_pipe = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "name": {"$first": "$items.product_name"},
                     "units": {"$sum": "$items.quantity"}, "revenue": {"$sum": "$items.subtotal"}}},
        {"$sort": {"revenue": -1}}, {"$limit": 5}
    ]
    top_products = await db.orders.aggregate(top_products_pipe).to_list(5)

    # Low stock alerts
    low_stock = []
    inv_docs = await db.inventory.find({}).to_list(5000)
    products = {str(p["_id"]): p for p in await db.products.find({}).to_list(2000)}
    stock_agg = {}
    for i in inv_docs:
        pid = i["product_id"]
        stock_agg.setdefault(pid, 0)
        stock_agg[pid] += max(0, i.get("quantity", 0) - i.get("reserved", 0))
    for pid, qty in stock_agg.items():
        p = products.get(pid)
        if not p:
            continue
        ss = p.get("safety_stock", 0)
        if qty < ss:
            low_stock.append({"product_id": pid, "name": p["name"], "sku": p["sku"],
                              "available": qty, "safety_stock": ss})
    low_stock.sort(key=lambda x: x["available"])

    return {
        "kpis": {
            "revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "delivered_orders": delivered,
            "inventory_value": round(inv_value, 2),
            "total_units": total_units,
            "dealer_count": dealer_count,
            "supplier_count": supplier_count,
            "product_count": product_count,
        },
        "revenue_trend": weeks,
        "state_data": [{"state": s["_id"] or "Unknown", "revenue": round(s["revenue"], 2), "orders": s["orders"]} for s in state_data],
        "top_dealers": [{"id": str(d["_id"]), "name": d["name"], "state": d.get("state", ""),
                          "revenue": round(d["revenue"], 2), "orders": d["orders"]} for d in top_dealers],
        "top_products": [{"id": str(p["_id"]), "name": p["name"], "units": p["units"],
                           "revenue": round(p["revenue"], 2)} for p in top_products],
        "low_stock_alerts": low_stock[:8],
    }


@router.get("/analytics/mnp/dealers")
async def mnp_dealer_analytics(user: dict = Depends(require_roles("admin", "mnp"))):
    if user["role"] == "mnp":
        dealers = await db.users.find({"role": "dealer", "mnp_id": user["id"]}).to_list(500)
    else:
        dealers = await db.users.find({"role": "dealer"}).to_list(500)

    rows = []
    for d in dealers:
        did = str(d["_id"])
        agg = await db.orders.aggregate([
            {"$match": {"dealer_id": did, "status": {"$in": ["delivered", "shipped", "approved"]}}},
            {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}}}
        ]).to_list(1)
        rev = agg[0]["revenue"] if agg else 0
        orders = agg[0]["orders"] if agg else 0
        rows.append({
            "dealer_id": did, "name": d.get("company") or d["name"],
            "city": d.get("city", ""), "state": d.get("state", ""),
            "credit_limit": d.get("credit_limit", 0),
            "revenue": round(rev, 2), "orders": orders,
        })
    rows.sort(key=lambda x: -x["revenue"])
    return rows


# ------------------ NOTIFICATIONS ------------------
@router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    query = {"$or": [{"user_id": user["id"]}, {"role": user["role"]}]}
    docs = await db.notifications.find(query).sort("created_at", -1).to_list(200)
    return serialize_docs(docs)


@router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"_id": ObjectId(notif_id)}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/mark-all-read")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"$or": [{"user_id": user["id"]}, {"role": user["role"]}], "read": {"$ne": True}},
        {"$set": {"read": True}},
    )
    return {"ok": True}


# ------------------ AUDIT ------------------
@router.get("/audit-logs")
async def audit_logs(limit: int = 200, admin: dict = Depends(require_admin)):
    docs = await db.audit_logs.find({}).sort("created_at", -1).to_list(limit)
    return serialize_docs(docs)


# ------------------ SETTINGS ------------------
@router.get("/settings")
async def get_settings(admin: dict = Depends(require_admin)):
    doc = await db.settings.find_one({"key": "global"}) or {
        "company_name": "Yamini Group", "gst_percent": 18,
        "currency": "INR", "tally_endpoint": "http://localhost:9000",
        "auto_sync_enabled": True, "sync_interval_min": 30,
        "low_stock_threshold_multiplier": 1.0,
    }
    return serialize_doc(doc) if doc.get("_id") else doc


@router.put("/settings")
async def update_settings(payload: dict, admin: dict = Depends(require_admin)):
    payload["key"] = "global"
    payload["updated_at"] = now_iso()
    await db.settings.update_one({"key": "global"}, {"$set": payload}, upsert=True)
    doc = await db.settings.find_one({"key": "global"})
    return serialize_doc(doc)
