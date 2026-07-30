"""Dealers, Suppliers, MNP users."""
import secrets
from typing import Optional, List, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from db import db, serialize_doc, serialize_docs, now_iso
from auth import get_current_user, require_admin, require_admin_or_mnp, hash_password
from models import DealerIn, SupplierIn, MnpIn
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


async def _generate_partner_code(company: str, name: str, state: str, prefix: str = "D", role: str = "dealer") -> str:
    st_clean = (state or "").strip().lower()
    st_code = STATE_ABBR_MAP.get(st_clean)
    if not st_code:
        if st_clean and len(st_clean) >= 2:
            st_code = st_clean[:2].upper()
        else:
            st_code = "IN"

    src = (company or name or ("MNP" if role == "mnp" else "DIST")).strip()
    words = [w for w in src.replace("-", " ").split() if w]
    if len(words) >= 2:
        initials = "".join(w[0].upper() for w in words[:3])
    elif words:
        initials = words[0][:2].upper()
    else:
        initials = "MP" if role == "mnp" else "DS"

    base_count = await db.users.count_documents({"role": role})
    idx = 100 + base_count + 1
    while True:
        code = f"{prefix}-{initials}-{st_code}-{idx}"
        exists = await db.users.find_one({"$or": [{"user_code": code}, {"login_id": code}]})
        if not exists:
            return code
        idx += 1


async def _generate_distributor_code(company: str, name: str, state: str) -> str:
    return await _generate_partner_code(company, name, state, prefix="D", role="dealer")


async def _resolve_dealer_mnp(mnp_id_raw: Optional[str]) -> tuple:
    if not mnp_id_raw or str(mnp_id_raw).strip().lower() in ["", "direct", "none", "null"]:
        return None, "DIRECT", "Direct (Yamini Flow HQ)"
    try:
        m = await db.users.find_one({"_id": ObjectId(mnp_id_raw), "role": "mnp"})
        if m:
            code = m.get("user_code") or m.get("login_id") or "M-ASSIGNED"
            name = m.get("name") or "Regional MNP"
            return str(m["_id"]), code, name
    except Exception:
        pass
    return None, "DIRECT", "Direct (Yamini Flow HQ)"


async def _list_role(role: str, mnp_id: str = None):
    q = {"role": role}
    if mnp_id:
        q["mnp_id"] = mnp_id
    docs = await db.users.find(q).sort("created_at", -1).to_list(1000)
    out = []

    mnp_map = {}
    if role == "dealer":
        mnp_docs = await db.users.find({"role": "mnp"}).to_list(1000)
        for m in mnp_docs:
            mnp_map[str(m["_id"])] = {
                "code": m.get("user_code") or m.get("login_id") or "M-ASSIGNED",
                "name": m.get("name") or "Regional MNP"
            }
        
        # Calculate current month's revenue for all dealers (Tally verified only)
        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()
        rev_agg = await db.orders.aggregate([
            {"$match": {
                "created_at": {"$gte": start_of_month},
                "status": {"$in": ["delivered", "shipped", "approved"]},
                "tally_voucher_no": {"$exists": True, "$ne": None}
            }},
            {"$group": {"_id": "$dealer_id", "revenue": {"$sum": "$total"}}}
        ]).to_list(1000)
        dealer_rev_map = {r["_id"]: r["revenue"] for r in rev_agg}

    for d in docs:
        if role in ["dealer", "mnp"] and not d.get("login_id") and not d.get("user_code"):
            prefix = "M" if role == "mnp" else "D"
            code = await _generate_partner_code(d.get("company", "") or d.get("name", "") or d.get("area", ""), d.get("name", ""), d.get("state", ""), prefix=prefix, role=role)
            await db.users.update_one({"_id": d["_id"]}, {"$set": {"user_code": code, "login_id": code}})
            d["user_code"] = code
            d["login_id"] = code
        s = serialize_doc(d)
        s.pop("password_hash", None)

        if role == "dealer":
            mid = str(d.get("mnp_id") or "")
            if mid and mid in mnp_map:
                s["mnp_code"] = mnp_map[mid]["code"]
                s["mnp_name"] = mnp_map[mid]["name"]
                s["assignment_type"] = f"MNP ({s['mnp_code']})"
            else:
                s["mnp_code"] = "DIRECT"
                s["mnp_name"] = "Direct (Yamini Flow HQ)"
                s["assignment_type"] = "Direct (HQ)"
            
            # Attach fulfillment metrics
            rev = dealer_rev_map.get(str(d["_id"]), 0)
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
    mnp_id = user["id"] if user.get("role") == "mnp" else None
    return await _list_role("dealer", mnp_id)


@router.post("/dealers")
@router.post("/distributors")
async def create_dealer(payload: DealerIn, user: dict = Depends(require_admin_or_mnp)):
    email_val = (payload.email or "").strip().lower()
    if email_val and await db.users.find_one({"email": email_val}):
        raise HTTPException(400, "Email already registered")
    
    code = payload.user_code or payload.login_id or await _generate_distributor_code(payload.company, payload.name, payload.state)
    if not email_val:
        email_val = f"{code.lower()}@distributor.yaminiflow.com"

    # If MNP is creating distributor, link directly to them
    mnp_id_raw = user["id"] if user.get("role") == "mnp" else payload.mnp_id
    mid, mcode, mname = await _resolve_dealer_mnp(mnp_id_raw)
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
        "mnp_id": mid, "mnp_code": mcode, "mnp_name": mname,
        "status": "active",
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    s = serialize_doc(doc)
    s.pop("password_hash", None)
    s["raw_password"] = raw_pwd
    s["assignment_type"] = f"MNP ({mcode})" if mid else "Direct (HQ)"
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
              "target_monthly": payload.target_monthly, "target_quarterly": payload.target_quarterly,
              "updated_at": now_iso()}
    if user.get("role") == "admin":
        mid, mcode, mname = await _resolve_dealer_mnp(payload.mnp_id)
        update["mnp_id"] = mid
        update["mnp_code"] = mcode
        update["mnp_name"] = mname
        
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
    email_val = (payload.email or "").strip().lower()
    if email_val and await db.users.find_one({"email": email_val}):
        raise HTTPException(400, "Email already registered")

    code = payload.user_code or payload.login_id or await _generate_partner_code(payload.company or payload.area or payload.name, payload.name, payload.state, prefix="M", role="mnp")
    if not email_val:
        email_val = f"{code.lower()}@mnp.yaminiflow.com"

    raw_pwd = payload.password or f"Mnp@{secrets.randbelow(9000)+1000}"
    doc = {
        "email": email_val,
        "user_code": code,
        "login_id": code,
        "password_hash": hash_password(raw_pwd),
        "name": payload.name, "role": "mnp",
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


@router.put("/mnp/{mnp_id}")
async def update_mnp(mnp_id: str, payload: MnpIn, admin: dict = Depends(require_admin)):
    update = {"name": payload.name, "phone": payload.phone, "area": payload.area,
              "state": payload.state, "target_monthly": payload.target_monthly,
              "target_quarterly": payload.target_quarterly,
              "updated_at": now_iso()}
    await db.users.update_one({"_id": ObjectId(mnp_id), "role": "mnp"}, {"$set": update})
    doc = await db.users.find_one({"_id": ObjectId(mnp_id)})
    s = serialize_doc(doc); s.pop("password_hash", None)
    return s


@router.delete("/mnp/{mnp_id}")
async def delete_mnp(mnp_id: str, admin: dict = Depends(require_admin)):
    await db.users.delete_one({"_id": ObjectId(mnp_id), "role": "mnp"})
    return {"ok": True}

