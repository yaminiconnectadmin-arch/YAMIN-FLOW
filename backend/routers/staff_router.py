"""Staff / Employee Access Management — CRUD endpoints (Super Admin only)."""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from db import db, serialize_doc, serialize_docs, now_iso
from auth import hash_password, verify_password, require_super_admin
from models import StaffCreateIn, StaffUpdateIn

router = APIRouter(prefix="/staff", tags=["staff"])

# All valid tab keys in the admin panel
ALL_TAB_KEYS = [
    "dashboard", "analytics", "products", "inventory", "orders",
    "procurement", "purchase-orders", "dealers", "mnp", "suppliers",
    "warehouses", "tally", "notifications", "audit", "settings",
]


def _serialize_staff(doc: dict) -> dict:
    s = serialize_doc(doc)
    s.pop("password_hash", None)
    return s


@router.get("")
async def list_staff(sa: dict = Depends(require_super_admin)):
    """Return all staff (admin-role=staff) accounts."""
    docs = await db.users.find(
        {"role": "admin", "admin_role": "staff"}
    ).sort("created_at", -1).to_list(500)
    return [_serialize_staff(d) for d in docs]


@router.post("")
async def create_staff(payload: StaffCreateIn, sa: dict = Depends(require_super_admin)):
    """Create a new employee account with limited tab access."""
    if not payload.email and not payload.login_id:
        raise HTTPException(status_code=400, detail="email or login_id is required")

    # Validate allowed_tabs — "all" is a valid shorthand
    if payload.allowed_tabs and payload.allowed_tabs != ["all"]:
        invalid = [t for t in payload.allowed_tabs if t not in ALL_TAB_KEYS]
        if invalid:
            raise HTTPException(status_code=400,
                                detail=f"Invalid tab keys: {invalid}. Valid: {ALL_TAB_KEYS}")

    # Check duplicate
    lookup_or = []
    if payload.email:
        lookup_or.append({"email": payload.email.lower()})
    if payload.login_id:
        lookup_or.append({"login_id": payload.login_id.upper()})
    if await db.users.find_one({"$or": lookup_or}):
        raise HTTPException(status_code=400, detail="Email / Login ID already exists")

    doc = {
        "name": payload.name,
        "role": "admin",
        "admin_role": "staff",
        "allowed_tabs": payload.allowed_tabs or [],
        "is_active": payload.is_active,
        "status": "active" if payload.is_active else "disabled",
        "must_change_password": True,  # Always force reset on first login
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "created_by": sa.get("id") or sa.get("_id", ""),
    }
    if payload.email:
        doc["email"] = payload.email.lower()
    if payload.login_id:
        doc["login_id"] = payload.login_id.upper()

    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id

    # Audit log
    await db.audit_logs.insert_one({
        "action": "staff_created",
        "actor_id": sa.get("id", ""),
        "actor_name": sa.get("name", ""),
        "target_id": str(res.inserted_id),
        "target_name": payload.name,
        "allowed_tabs": payload.allowed_tabs,
        "created_at": now_iso(),
    })

    return _serialize_staff(doc)


@router.put("/{staff_id}")
async def update_staff(staff_id: str, payload: StaffUpdateIn,
                       sa: dict = Depends(require_super_admin)):
    """Update name, allowed_tabs, active status, or reset password for a staff member."""
    try:
        oid = ObjectId(staff_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid staff_id")

    staff = await db.users.find_one({"_id": oid, "role": "admin", "admin_role": "staff"})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    updates: dict = {"updated_at": now_iso()}

    if payload.name is not None:
        updates["name"] = payload.name
    if payload.allowed_tabs is not None:
        if payload.allowed_tabs != ["all"]:
            invalid = [t for t in payload.allowed_tabs if t not in ALL_TAB_KEYS]
            if invalid:
                raise HTTPException(status_code=400,
                                    detail=f"Invalid tab keys: {invalid}")
        updates["allowed_tabs"] = payload.allowed_tabs
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active
        updates["status"] = "active" if payload.is_active else "disabled"
    if payload.new_password:
        updates["password_hash"] = hash_password(payload.new_password)
        updates["must_change_password"] = True  # Force reset again after admin resets

    await db.users.update_one({"_id": oid}, {"$set": updates})

    # Audit log
    await db.audit_logs.insert_one({
        "action": "staff_updated",
        "actor_id": sa.get("id", ""),
        "actor_name": sa.get("name", ""),
        "target_id": staff_id,
        "target_name": staff.get("name", ""),
        "changes": {k: v for k, v in updates.items() if k != "password_hash"},
        "created_at": now_iso(),
    })

    updated = await db.users.find_one({"_id": oid})
    return _serialize_staff(updated)


@router.delete("/{staff_id}")
async def delete_staff(staff_id: str, sa: dict = Depends(require_super_admin)):
    """Permanently remove a staff member's access."""
    try:
        oid = ObjectId(staff_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid staff_id")

    staff = await db.users.find_one({"_id": oid, "role": "admin", "admin_role": "staff"})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    await db.users.delete_one({"_id": oid})

    await db.audit_logs.insert_one({
        "action": "staff_deleted",
        "actor_id": sa.get("id", ""),
        "actor_name": sa.get("name", ""),
        "target_id": staff_id,
        "target_name": staff.get("name", ""),
        "created_at": now_iso(),
    })

    return {"ok": True, "deleted_id": staff_id}
