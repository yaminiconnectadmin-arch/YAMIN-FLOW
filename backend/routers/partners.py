"""Dealers, Suppliers, MNP users."""
import secrets
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin, require_admin_or_mnp, hash_password
from models import DealerIn, SupplierIn, MnpIn

router = APIRouter(tags=["partners"])


async def _list_role(role: str, mnp_id: str = None):
    q = {"role": role}
    if mnp_id:
        q["mnp_id"] = mnp_id
    docs = await db.users.find(q).sort("created_at", -1).to_list(1000)
    out = []
    for d in docs:
        s = serialize_doc(d)
        s.pop("password_hash", None)
        out.append(s)
    return out


# --- Dealers & Distributors ---
@router.get("/dealers")
@router.get("/distributors")
async def list_dealers(user: dict = Depends(get_current_user)):
    mnp_id = user["id"] if user.get("role") == "mnp" else None
    return await _list_role("dealer", mnp_id)


@router.post("/dealers")
@router.post("/distributors")
async def create_dealer(payload: DealerIn, user: dict = Depends(require_admin_or_mnp)):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(400, "Email exists")
    
    # If MNP is creating distributor, link directly to them
    mnp_id = user["id"] if user.get("role") == "mnp" else payload.mnp_id
    raw_pwd = payload.password or f"Dist@{secrets.randbelow(9000)+1000}"
    
    doc = {
        "email": payload.email.lower(),
        "password_hash": hash_password(raw_pwd),
        "name": payload.name, "role": "dealer",
        "phone": payload.phone, "company": payload.company,
        "city": payload.city, "state": payload.state,
        "gstin": payload.gstin, "credit_limit": payload.credit_limit,
        "mnp_id": mnp_id, "status": "active",
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    s = serialize_doc(doc)
    s.pop("password_hash", None)
    s["raw_password"] = raw_pwd
    return s


@router.put("/dealers/{dealer_id}")
@router.put("/distributors/{dealer_id}")
async def update_dealer(dealer_id: str, payload: DealerIn, user: dict = Depends(require_admin_or_mnp)):
    q = {"_id": ObjectId(dealer_id), "role": "dealer"}
    if user.get("role") == "mnp":
        q["mnp_id"] = user["id"]
    
    update = {"name": payload.name, "phone": payload.phone, "company": payload.company,
              "city": payload.city, "state": payload.state, "gstin": payload.gstin,
              "credit_limit": payload.credit_limit,
              "updated_at": now_iso()}
    if user.get("role") == "admin":
        update["mnp_id"] = payload.mnp_id
        
    res = await db.users.update_one(q, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Distributor not found or unauthorized")
    doc = await db.users.find_one({"_id": ObjectId(dealer_id)})
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.delete("/dealers/{dealer_id}")
@router.delete("/distributors/{dealer_id}")
async def delete_dealer(dealer_id: str, user: dict = Depends(require_admin_or_mnp)):
    q = {"_id": ObjectId(dealer_id), "role": "dealer"}
    if user.get("role") == "mnp":
        q["mnp_id"] = user["id"]
    res = await db.users.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(404, "Distributor not found or unauthorized")
    return {"ok": True}


# --- Suppliers ---
@router.get("/suppliers")
async def list_suppliers(user: dict = Depends(get_current_user)):
    return await _list_role("supplier")


@router.post("/suppliers")
async def create_supplier(payload: SupplierIn, admin: dict = Depends(require_admin)):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(400, "Email exists")
    raw_pwd = payload.password or f"Supplier@{secrets.randbelow(9000)+1000}"
    doc = {
        "email": payload.email.lower(),
        "password_hash": hash_password(raw_pwd),
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
    s["raw_password"] = raw_pwd
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
    raw_pwd = payload.password or f"Mnp@{secrets.randbelow(9000)+1000}"
    doc = {
        "email": payload.email.lower(),
        "password_hash": hash_password(raw_pwd),
        "name": payload.name, "role": "mnp",
        "phone": payload.phone, "area": payload.area, "state": payload.state,
        "target_monthly": payload.target_monthly,
        "status": "active", "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    s = serialize_doc(doc); s.pop("password_hash", None)
    s["raw_password"] = raw_pwd
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

