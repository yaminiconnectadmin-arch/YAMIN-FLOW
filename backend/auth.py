"""JWT authentication, password hashing, RBAC guards."""
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
import bcrypt
import jwt
from bson import ObjectId
from fastapi import HTTPException, Request, Depends
from db import db, serialize_doc

JWT_ALGORITHM = "HS256"
ACCESS_MIN = 60 * 12  # 12 hours
REFRESH_DAYS = 7


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _secret() -> str:
    return os.environ.get("JWT_SECRET", "yamini_flow_super_secret_jwt_key_2026")



def create_access_token(user_id: str, email: str, role: str,
                        admin_role: str = "super_admin",
                        allowed_tabs: list | None = None,
                        must_change_password: bool = False) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "admin_role": admin_role,
        "allowed_tabs": allowed_tabs or ["all"],
        "must_change_password": must_change_password,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MIN),
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=ACCESS_MIN * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=REFRESH_DAYS * 86400, path="/")


def clear_auth_cookies(response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        sub = payload.get("sub", "")
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(sub)})
        except Exception:
            pass
        if not user:
            user = await db.users.find_one({"$or": [{"_id": sub}, {"email": payload.get("email", "").lower()}]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        u = serialize_doc(user)
        u.pop("password_hash", None)
        # Ensure RBAC fields are present (default to super_admin for existing admins, staff for staff roles)
        if u.get("role") in ["admin", "staff", "employee"]:
            if u.get("role") in ["staff", "employee"]:
                u.setdefault("admin_role", "staff")
            else:
                u.setdefault("admin_role", "super_admin")
            u.setdefault("allowed_tabs", ["all"])
            u.setdefault("must_change_password", False)
        return u
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_roles(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role")
        # Map staff/employee roles to admin for permission checks if needed
        effective_role = user_role
        if effective_role not in roles and ("admin" in roles and user_role in ["staff", "employee"]):
            effective_role = "admin"
        if effective_role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _dep


require_admin = require_roles("admin")
require_admin_or_mnp = require_roles("admin", "mnp")


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    """Only users with role=admin AND admin_role=super_admin may proceed."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user.get("admin_role", "super_admin") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return user


async def brute_force_check(identifier: str) -> None:
    entry = await db.login_attempts.find_one({"identifier": identifier})
    if not entry:
        return
    if entry.get("count", 0) >= 3:
        locked_until = entry.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Account locked due to 3 failed attempts. Please try again after 30 minutes.")


async def record_failed_attempt(identifier: str) -> None:
    now = datetime.now(timezone.utc)
    entry = await db.login_attempts.find_one({"identifier": identifier})
    count = (entry.get("count", 0) if entry else 0) + 1
    locked_until = (now + timedelta(minutes=30)).isoformat() if count >= 3 else None
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$set": {"count": count, "locked_until": locked_until, "updated_at": now.isoformat()}},
        upsert=True,
    )


async def clear_attempts(identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})

