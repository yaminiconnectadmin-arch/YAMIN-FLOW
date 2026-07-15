"""Dealers, Suppliers, MNP users."""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin, hash_password
from models import DealerIn, SupplierIn, MnpIn

router = APIRouter(tags=["partners"])


async def _list_role(role: str):
    docs = await db.users.find({"role": role}).sort("created_at", -1).to_list(1000)
    out = []
    for d in docs:
        s = serialize_doc(d)
        s.pop("password_hash", None)
        out.append(s)
    return out


# --- Dealers ---
@router.get("/dealers")
async def list_dealers(user: dict = Depends(get_current_user)):
    return await _list_role("dealer")


@router.post("/dealers")
async def create_dealer(payload: DealerIn, admin: dict = Depends(require_admin)):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(400, "Email exists")
    doc = {
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password or "Dealer@123"),
        "name": payload.name, "role": "dealer",
        "phone": payload.phone, "company": payload.company,
        "city": payload.city, "state": payload.state,
        "gstin": payload.gstin, "credit_limit": payload.credit_limit,
        "mnp_id": payload.mnp_id, "status": "active",
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    s = serialize_doc(doc)
    s.pop("password_hash", None)
    return s


@router.put("/dealers/{dealer_id}")
async def update_dealer(dealer_id: str, payload: DealerIn, admin: dict = Depends(require_admin)):
    update = {"name": payload.name, "phone": payload.phone, "company": payload.company,
              "city": payload.city, "state": payload.state, "gstin": payload.gstin,
              "credit_limit": payload.credit_limit, "mnp_id": payload.mnp_id,
              "updated_at": now_iso()}
    await db.users.update_one({"_id": ObjectId(dealer_id), "role": "dealer"}, {"$set": update})
    doc = await db.users.find_one({"_id": ObjectId(dealer_id)})
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.delete("/dealers/{dealer_id}")
async def delete_dealer(dealer_id: str, admin: dict = Depends(require_admin)):
    await db.users.delete_one({"_id": ObjectId(dealer_id), "role": "dealer"})
    return {"ok": True}


# --- Suppliers ---
@router.get("/suppliers")
async def list_suppliers(user: dict = Depends(get_current_user)):
    return await _list_role("supplier")


@router.post("/suppliers")
async def create_supplier(payload: SupplierIn, admin: dict = Depends(require_admin)):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(400, "Email exists")
    doc = {
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password or "Supplier@123"),
        "name": payload.name, "role": "supplier",
        "phone": payload.phone, "company": payload.company,
        "city": payload.city, "state": payload.state,
        "gstin": payload.gstin, "lead_time_days": payload.lead_time_days,
        "status": "active", "performance_score": 80,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, payload: SupplierIn, admin: dict = Depends(require_admin)):
    update = {"name": payload.name, "phone": payload.phone, "company": payload.company,
              "city": payload.city, "state": payload.state, "gstin": payload.gstin,
              "lead_time_days": payload.lead_time_days, "updated_at": now_iso()}
    await db.users.update_one({"_id": ObjectId(supplier_id), "role": "supplier"}, {"$set": update})
    doc = await db.users.find_one({"_id": ObjectId(supplier_id)})
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, admin: dict = Depends(require_admin)):
    await db.users.delete_one({"_id": ObjectId(supplier_id), "role": "supplier"})
    return {"ok": True}


# --- MNP ---
@router.get("/mnp")
async def list_mnp(user: dict = Depends(get_current_user)):
    return await _list_role("mnp")


@router.post("/mnp")
async def create_mnp(payload: MnpIn, admin: dict = Depends(require_admin)):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(400, "Email exists")
    doc = {
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password or "Mnp@123"),
        "name": payload.name, "role": "mnp",
        "phone": payload.phone, "area": payload.area, "state": payload.state,
        "target_monthly": payload.target_monthly,
        "status": "active", "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.put("/mnp/{mnp_id}")
async def update_mnp(mnp_id: str, payload: MnpIn, admin: dict = Depends(require_admin)):
    update = {"name": payload.name, "phone": payload.phone, "area": payload.area,
              "state": payload.state, "target_monthly": payload.target_monthly,
              "updated_at": now_iso()}
    await db.users.update_one({"_id": ObjectId(mnp_id), "role": "mnp"}, {"$set": update})
    doc = await db.users.find_one({"_id": ObjectId(mnp_id)})
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.delete("/mnp/{mnp_id}")
async def delete_mnp(mnp_id: str, admin: dict = Depends(require_admin)):
    await db.users.delete_one({"_id": ObjectId(mnp_id), "role": "mnp"})
    return {"ok": True}
