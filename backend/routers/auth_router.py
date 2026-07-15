"""Auth router — login, logout, me, register (admin creates), refresh."""
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from db import db, serialize_doc, now_iso
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user, require_admin,
    brute_force_check, record_failed_attempt, clear_attempts,
)
from models import LoginInput, RegisterInput

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(payload: LoginInput, request: Request, response: Response):
    email = payload.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    await brute_force_check(identifier)

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")

    await clear_attempts(identifier)
    uid = str(user["_id"])
    access = create_access_token(uid, email, user["role"])
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)

    u = serialize_doc(user)
    u.pop("password_hash", None)
    return {"user": u, "access_token": access}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/register")
async def register(payload: RegisterInput, response: Response, admin: dict = Depends(require_admin)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email, "password_hash": hash_password(payload.password),
        "name": payload.name, "role": payload.role,
        "phone": payload.phone or "", "company": payload.company or "",
        "status": "active", "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    return {"id": str(res.inserted_id), "email": email, "role": payload.role, "name": payload.name}
