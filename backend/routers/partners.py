"""Dealers, Suppliers, CNF / MNP users."""
import secrets
from typing import Optional, List, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin, require_admin_or_cnf, require_admin_or_mnp, hash_password
from models import DealerIn, SupplierIn, CnfIn, MnpIn
from datetime import datetime, timezone

router = APIRouter(tags=["partners"])


STATE_ABBR_MAP = {
    "maharashtra": "MH", "delhi": "DL", "karnataka": "KA", "gujarat": "GJ",
    "tamil nadu": "TN", "uttar pradesh": "UP", "west bengal": "WB", "rajasthan": "RJ",
    "telangana": "TS", "andhra pradesh": "AP", "kerala": "KL", "punjab": "PB",
    "haryana": "HR", "madhya pradesh": "MP", "bihar": "BR", "odisha": "OD",
    "assam": "AS", "chhattisgarh": "CG", "jharkhand": "JH", "uttarakhand": "UK",
    "himachal pradesh": "HP", "goa": "GA", "tripura": "TR", "meghalaya": "ML",
    "manipur": "MN", "nagaland": "NL", "arunachal pradesh": "AR", "sikkim": "SK",
    "mizoram": "MZ", "chandigarh": "CH", "puducherry": "PY", "jammu & kashmir": "JK",
    "ladakh": "LA"
}


def _abbreviate_business_name(name_str: str, default_prefix: str = "DS") -> str:
    if not name_str or not name_str.strip():
        return default_prefix
    clean_name = name_str.strip()
    words = [w for w in clean_name.replace("-", " ").replace("/", " ").split() if w]
    if len(words) >= 2:
        return "".join(w[0].upper() for w in words[:4])
    word = words[0]
    if word.lower() == "codeverse":
        return "CVS"
    uppers = [c for c in word if c.isupper()]
    if len(uppers) >= 2:
        return "".join(uppers[:3])
    first_char = word[0].upper()
    vowels = set("AEIOUaeiou")
    consonants = [c.upper() for c in word[1:] if c.isalpha() and c not in vowels]
    if len(consonants) >= 2:
        return first_char + consonants[0] + consonants[1]
    elif len(consonants) == 1:
        return first_char + consonants[0]
    else:
        return word[:3].upper()


async def _generate_partner_code(company: str, name: str, state: str, prefix: str = "D", role: str = "dealer") -> str:
    st_clean = (state or "").strip().lower()
    st_code = STATE_ABBR_MAP.get(st_clean)
    if not st_code:
        if st_clean and len(st_clean) >= 2:
            st_code = st_clean[:2].upper()
        else:
            st_code = "IN"

    src = (company or name or ("CNF" if role in ["cnf", "mnp"] else "DIST")).strip()
    default_pre = "CF" if role in ["cnf", "mnp"] else "DS"
    initials = _abbreviate_business_name(src, default_pre)

    base_count = await db.users.count_documents({"role": {"$in": [role, "cnf", "mnp"] if role in ["cnf", "mnp"] else [role]}})
    idx = base_count + 1
    while True:
        num_str = f"{idx:03d}"
        code = f"{prefix}-{initials}-{st_code}-{num_str}"
        exists = await db.users.find_one({"$or": [{"user_code": code}, {"login_id": code}]})
        if not exists:
            return code
        idx += 1


async def _generate_distributor_code(company: str, name: str, state: str) -> str:
    return await _generate_partner_code(company, name, state, prefix="D", role="dealer")


async def _resolve_dealer_cnf(cnf_id_raw: Optional[str]) -> tuple:
    if not cnf_id_raw or str(cnf_id_raw).strip().lower() in ["", "direct", "none", "null"]:
        return None, "DIRECT", "Direct (Yamini Flow HQ)"
    try:
        m = await db.users.find_one({"_id": ObjectId(cnf_id_raw), "role": {"$in": ["cnf", "mnp"]}})
        if m:
            code = m.get("user_code") or m.get("login_id") or "C-ASSIGNED"
            name = m.get("name") or "Regional CNF"
            return str(m["_id"]), code, name
    except Exception:
        pass
    return None, "DIRECT", "Direct (Yamini Flow HQ)"


async def _list_role(role: str, cnf_id: str = None):
    target_roles = ["cnf", "mnp"] if role in ["cnf", "mnp"] else [role]
    q = {"role": {"$in": target_roles}}
    if cnf_id:
        q["$or"] = [{"cnf_id": cnf_id}, {"mnp_id": cnf_id}]
    docs = await db.users.find(q).sort("created_at", -1).to_list(1000)
    out = []

    cnf_map = {}
    if role == "dealer":
        cnf_docs = await db.users.find({"role": {"$in": ["cnf", "mnp"]}}).to_list(1000)
        for m in cnf_docs:
            cnf_map[str(m["_id"])] = {
                "code": m.get("user_code") or m.get("login_id") or "C-ASSIGNED",
                "name": m.get("name") or "Regional CNF"
            }
        
        # Calculate current month's revenue for all dealers based on admin-approved orders.
        # Tally sync is NOT required here — the trigger is admin approval, not Tally voucher.
        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()
        rev_agg = await db.orders.aggregate([
            {"$match": {
                "$or": [
                    {"approved_at": {"$gte": start_of_month}},
                    {"created_at": {"$gte": start_of_month}, "approved_at": {"$exists": False}}
                ],
                "status": {"$in": ["approved", "partially_fulfilled", "processing", "shipped", "delivered"]}
            }},
            {"$group": {"_id": "$dealer_id", "revenue": {"$sum": "$total"}}}
        ]).to_list(1000)
        # Build lookup supporting both string and ObjectId dealer_id values in orders
        dealer_rev_map = {}
        for r in rev_agg:
            dealer_rev_map[str(r["_id"])] = r["revenue"]

    for d in docs:
        if role in ["dealer", "cnf", "mnp"] and not d.get("login_id") and not d.get("user_code"):
            prefix = "C" if role in ["cnf", "mnp"] else "D"
            code = await _generate_partner_code(d.get("company", "") or d.get("name", "") or d.get("area", ""), d.get("name", ""), d.get("state", ""), prefix=prefix, role=role)
            await db.users.update_one({"_id": d["_id"]}, {"$set": {"user_code": code, "login_id": code}})
            d["user_code"] = code
            d["login_id"] = code
        s = serialize_doc(d)
        s.pop("password_hash", None)

        if role == "dealer":
            cid = str(d.get("cnf_id") or d.get("mnp_id") or "")
            if cid and cid in cnf_map:
                s["cnf_code"] = cnf_map[cid]["code"]
                s["cnf_name"] = cnf_map[cid]["name"]
                s["mnp_code"] = s["cnf_code"]
                s["mnp_name"] = s["cnf_name"]
                s["assignment_type"] = f"CNF ({s['cnf_code']})"
            else:
                s["cnf_code"] = "DIRECT"
                s["cnf_name"] = "Direct (Yamini Flow HQ)"
                s["mnp_code"] = "DIRECT"
                s["mnp_name"] = "Direct (Yamini Flow HQ)"
                s["assignment_type"] = "Direct (HQ)"
            
            # Attach fulfillment metrics — check both string _id and any alternate dealer_id keys
            did_str = str(d["_id"])
            rev = dealer_rev_map.get(did_str, 0)
            target = s.get("target_monthly", 0)
            s["current_month_revenue"] = round(rev, 2)
            s["fulfillment_pct"] = round((rev / target * 100), 1) if target > 0 else 0
            s["extra_sales"] = round(max(0, rev - target), 2)
        out.append(s)
    return out


# --- Dealers & Distributors ---
@router.get("/dealers")
@router.get("/distributors")
async def list_dealers(user: dict = Depends(get_current_user)):
    cnf_id = user["id"] if user.get("role") in ["cnf", "mnp"] else None
    return await _list_role("dealer", cnf_id)


@router.post("/dealers")
@router.post("/distributors")
async def create_dealer(payload: DealerIn, user: dict = Depends(require_admin_or_cnf)):
    email_val = (payload.email or "").strip().lower()
    if email_val and await db.users.find_one({"email": email_val}):
        raise HTTPException(400, "Email already registered")
    
    code = payload.user_code or payload.login_id or await _generate_distributor_code(payload.company, payload.name, payload.state)
    if not email_val:
        email_val = f"{code.lower()}@distributor.yaminiflow.com"

    # If CNF is creating distributor, link directly to them
    cnf_id_raw = user["id"] if user.get("role") in ["cnf", "mnp"] else (payload.cnf_id or payload.mnp_id)
    cid, ccode, cname = await _resolve_dealer_cnf(cnf_id_raw)
    raw_pwd = payload.password or f"Dist@{secrets.randbelow(9000)+1000}"
    
    doc = {
        "email": email_val,
        "user_code": code,
        "login_id": code,
        "password_hash": hash_password(raw_pwd),
        "name": payload.name, "role": "dealer",
        "phone": payload.phone, "company": payload.company,
        "city": payload.city, "state": payload.state,
        "gstin": payload.gstin, "credit_limit": payload.credit_limit,
        "target_monthly": payload.target_monthly, "target_quarterly": payload.target_quarterly,
        "cnf_id": cid, "cnf_code": ccode, "cnf_name": cname,
        "mnp_id": cid, "mnp_code": ccode, "mnp_name": cname,
        "status": "active",
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    s = serialize_doc(doc)
    s.pop("password_hash", None)
    s["raw_password"] = raw_pwd
    s["assignment_type"] = f"CNF ({ccode})" if cid else "Direct (HQ)"
    return s


@router.put("/dealers/{dealer_id}")
@router.put("/distributors/{dealer_id}")
async def update_dealer(dealer_id: str, payload: DealerIn, user: dict = Depends(require_admin_or_cnf)):
    try:
        q = {"_id": ObjectId(dealer_id), "role": "dealer"}
    except Exception:
        q = {"$or": [{"user_code": dealer_id}, {"login_id": dealer_id}], "role": "dealer"}
    if user.get("role") in ["cnf", "mnp"]:
        q["$or"] = [{"cnf_id": user["id"]}, {"mnp_id": user["id"]}]
    
    update = {"name": payload.name, "phone": payload.phone, "company": payload.company,
              "city": payload.city, "state": payload.state, "gstin": payload.gstin,
              "credit_limit": payload.credit_limit,
              "target_monthly": payload.target_monthly, "target_quarterly": payload.target_quarterly,
              "updated_at": now_iso()}
    if payload.email:
        update["email"] = payload.email.strip().lower()
    if user.get("role") == "admin":
        cid, ccode, cname = await _resolve_dealer_cnf(payload.cnf_id or payload.mnp_id)
        update["cnf_id"] = cid
        update["cnf_code"] = ccode
        update["cnf_name"] = cname
        update["mnp_id"] = cid
        update["mnp_code"] = ccode
        update["mnp_name"] = cname
        
    res = await db.users.update_one(q, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Distributor not found or unauthorized")
    try:
        doc = await db.users.find_one({"_id": ObjectId(dealer_id)})
    except Exception:
        doc = await db.users.find_one({"$or": [{"user_code": dealer_id}, {"login_id": dealer_id}]})
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.delete("/dealers/{dealer_id}")
@router.delete("/distributors/{dealer_id}")
async def delete_dealer(dealer_id: str, user: dict = Depends(require_admin_or_cnf)):
    q = {"_id": ObjectId(dealer_id), "role": "dealer"}
    if user.get("role") in ["cnf", "mnp"]:
        q["$or"] = [{"cnf_id": user["id"]}, {"mnp_id": user["id"]}]
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


# --- CNF / MNP ---
@router.get("/cnf")
@router.get("/mnp")
async def list_cnf(user: dict = Depends(get_current_user)):
    return await _list_role("cnf")


@router.post("/cnf")
@router.post("/mnp")
async def create_cnf(payload: CnfIn, admin: dict = Depends(require_admin)):
    email_val = (payload.email or "").strip().lower()
    if email_val and await db.users.find_one({"email": email_val}):
        raise HTTPException(400, "Email already registered")

    code = payload.user_code or payload.login_id or await _generate_partner_code(payload.company or payload.area or payload.name, payload.name, payload.state, prefix="C", role="cnf")
    if not email_val:
        email_val = f"{code.lower()}@cnf.yaminiflow.com"

    raw_pwd = payload.password or f"Cnf@{secrets.randbelow(9000)+1000}"
    doc = {
        "email": email_val,
        "user_code": code,
        "login_id": code,
        "password_hash": hash_password(raw_pwd),
        "name": payload.name, "role": "cnf",
        "phone": payload.phone, "area": payload.area, "state": payload.state,
        "company": payload.company or "",
        "target_monthly": payload.target_monthly,
        "target_quarterly": payload.target_quarterly,
        "status": "active", "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    s = serialize_doc(doc); s.pop("password_hash", None)
    s["raw_password"] = raw_pwd
    return s


@router.put("/cnf/{cnf_id}")
@router.put("/mnp/{cnf_id}")
async def update_cnf(cnf_id: str, payload: CnfIn, admin: dict = Depends(require_admin)):
    update = {"name": payload.name, "phone": payload.phone, "area": payload.area,
              "state": payload.state, "target_monthly": payload.target_monthly,
              "target_quarterly": payload.target_quarterly,
              "updated_at": now_iso()}
    await db.users.update_one({"_id": ObjectId(cnf_id), "role": {"$in": ["cnf", "mnp"]}}, {"$set": update})
    doc = await db.users.find_one({"_id": ObjectId(cnf_id)})
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.delete("/cnf/{cnf_id}")
@router.delete("/mnp/{cnf_id}")
async def delete_cnf(cnf_id: str, admin: dict = Depends(require_admin)):
    await db.users.delete_one({"_id": ObjectId(cnf_id), "role": {"$in": ["cnf", "mnp"]}})
    return {"ok": True}


