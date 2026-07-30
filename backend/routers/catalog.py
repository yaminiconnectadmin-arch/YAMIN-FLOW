"""Products, categories, warehouses, inventory."""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin
from models import ProductIn, CategoryIn, WarehouseIn, InventoryAdjustIn

router = APIRouter(tags=["catalog"])


# --- Categories ---
@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    docs = await db.categories.find({}).sort("name", 1).to_list(200)
    return serialize_docs(docs)


@router.post("/categories")
async def create_category(payload: CategoryIn, admin: dict = Depends(require_admin)):
    if await db.categories.find_one({"name": payload.name}):
        raise HTTPException(400, "Category exists")
    doc = {"name": payload.name, "description": payload.description or "", "created_at": now_iso()}
    res = await db.categories.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)


@router.put("/categories/{category_id}")
async def update_category(category_id: str, payload: CategoryIn, admin: dict = Depends(require_admin)):
    try:
        oid = ObjectId(category_id)
        query_ne = {"_id": {"$nin": [oid, category_id]}}
        query_self = {"_id": {"$in": [oid, category_id]}}
    except Exception:
        query_ne = {"_id": {"$ne": category_id}}
        query_self = {"_id": category_id}

    existing = await db.categories.find_one({"name": payload.name, **query_ne})
    if existing:
        raise HTTPException(400, "Category exists")
    update = {"name": payload.name, "description": payload.description or ""}
    res = await db.categories.update_one(query_self, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.categories.find_one(query_self)
    return serialize_doc(doc)


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: dict = Depends(require_admin)):
    try:
        oid = ObjectId(category_id)
        query = {"_id": {"$in": [oid, category_id]}}
    except Exception:
        query = {"_id": category_id}

    # Retrieve category info first to cascade delete products under this category
    cat_doc = await db.categories.find_one(query)
    if cat_doc:
        category_name = cat_doc.get("name")
        if category_name:
            # Find and delete all corresponding inventory records for products in this category
            prods = await db.products.find({"category": category_name}).to_list(1000)
            prod_ids = [str(p["_id"]) for p in prods]
            if prod_ids:
                await db.inventory.delete_many({"product_id": {"$in": prod_ids}})
            # Delete products in this category
            await db.products.delete_many({"category": category_name})

    res = await db.categories.delete_one(query)
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# --- Products ---
@router.get("/products")
async def list_products(q: str = "", category: str = "", status: str = "",
                         user: dict = Depends(get_current_user)):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"sku": {"$regex": q, "$options": "i"}}]
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    docs = await db.products.find(query).sort("name", 1).to_list(1000)
    return serialize_docs(docs)


@router.get("/products/{product_id}")
async def get_product(product_id: str, user: dict = Depends(get_current_user)):
    doc = await db.products.find_one({"_id": ObjectId(product_id)})
    if not doc:
        raise HTTPException(404, "Not found")
    return serialize_doc(doc)


@router.post("/products")
async def create_product(payload: ProductIn, admin: dict = Depends(require_admin)):
    if await db.products.find_one({"sku": payload.sku}):
        raise HTTPException(400, "SKU exists")
    doc = payload.model_dump()
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    res = await db.products.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)


@router.put("/products/{product_id}")
async def update_product(product_id: str, payload: ProductIn, admin: dict = Depends(require_admin)):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.products.find_one({"_id": ObjectId(product_id)})
    return serialize_doc(doc)


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(require_admin)):
    await db.products.delete_one({"_id": ObjectId(product_id)})
    return {"ok": True}


# --- Warehouses ---
@router.get("/warehouses")
async def list_warehouses(user: dict = Depends(get_current_user)):
    docs = await db.warehouses.find({}).sort("name", 1).to_list(200)
    return serialize_docs(docs)


@router.post("/warehouses")
async def create_warehouse(payload: WarehouseIn, admin: dict = Depends(require_admin)):
    if await db.warehouses.find_one({"code": payload.code}):
        raise HTTPException(400, "Code exists")
    doc = payload.model_dump()
    doc["created_at"] = now_iso()
    res = await db.warehouses.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)


@router.put("/warehouses/{wh_id}")
async def update_warehouse(wh_id: str, payload: WarehouseIn, admin: dict = Depends(require_admin)):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    await db.warehouses.update_one({"_id": ObjectId(wh_id)}, {"$set": update})
    doc = await db.warehouses.find_one({"_id": ObjectId(wh_id)})
    return serialize_doc(doc)


@router.delete("/warehouses/{wh_id}")
async def delete_warehouse(wh_id: str, admin: dict = Depends(require_admin)):
    await db.warehouses.delete_one({"_id": ObjectId(wh_id)})
    return {"ok": True}


# --- Inventory ---
@router.get("/inventory")
async def list_inventory(warehouse_id: str = "", product_id: str = "",
                          user: dict = Depends(get_current_user)):
    query = {}
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    if product_id:
        query["product_id"] = product_id
    inv = await db.inventory.find(query).to_list(5000)
    # Enrich with product + warehouse details
    prod_ids = list({i["product_id"] for i in inv})
    wh_ids = list({i["warehouse_id"] for i in inv})
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": [ObjectId(x) for x in prod_ids]}}).to_list(2000)}
    whs = {str(w["_id"]): w for w in await db.warehouses.find({"_id": {"$in": [ObjectId(x) for x in wh_ids]}}).to_list(200)}
    out = []
    for i in inv:
        s = serialize_doc(i)
        p = products.get(i["product_id"])
        w = whs.get(i["warehouse_id"])
        s["product_name"] = p.get("name") if p else "-"
        s["product_sku"] = p.get("sku") if p else "-"
        s["category"] = p.get("category") if p else "-"
        s["unit"] = p.get("unit") if p else "pcs"
        s["price"] = p.get("price", 0) if p else 0
        s["warehouse_name"] = w.get("name") if w else "-"
        s["warehouse_code"] = w.get("code") if w else "-"
        s["available"] = max(0, s.get("quantity", 0) - s.get("reserved", 0))
        ss = s.get("safety_stock", 0)
        s["stock_status"] = "critical" if s["available"] < ss else ("low" if s["available"] < ss * 2 else "healthy")
        out.append(s)
    return out


@router.post("/inventory/adjust")
async def adjust_inventory(payload: InventoryAdjustIn, admin: dict = Depends(require_admin)):
    key = {"warehouse_id": payload.warehouse_id, "product_id": payload.product_id}
    inv = await db.inventory.find_one(key)
    if not inv:
        await db.inventory.insert_one({**key, "quantity": max(0, payload.quantity),
                                       "reserved": 0, "safety_stock": 0, "updated_at": now_iso()})
    else:
        new_q = max(0, inv.get("quantity", 0) + payload.quantity)
        await db.inventory.update_one(key, {"$set": {"quantity": new_q, "updated_at": now_iso()}})
    # Audit
    await db.audit_logs.insert_one({
        "actor_id": admin["id"], "actor_email": admin["email"],
        "action": "inventory.adjust", "target": f"{payload.warehouse_id}/{payload.product_id}",
        "meta": {"delta": payload.quantity, "reason": payload.reason},
        "created_at": now_iso(),
    })
    inv = await db.inventory.find_one(key)
    return serialize_doc(inv)
