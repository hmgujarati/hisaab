"""RapidXT Hisaab — main FastAPI server.

Includes: auth, super-admin routes, SMTP, and includes owner_routes router.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from models import (
    LoginIn, ForgotPasswordIn, ResetPasswordIn, ChangePasswordIn,
    BusinessCreate, BusinessUpdate, ExtendExpiryIn, StatusChangeIn, AdminResetPasswordIn,
    SmtpSettingsIn, new_id,
)
from utils import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, now_iso, parse_date, evaluate_account_status,
    send_email_smtp, gen_reset_token,
)
from owner_routes import build_owner_router

# ---------- Setup ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="RapidXT Hisaab API")

# Public file serving for uploaded bills / docs
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

api = APIRouter(prefix="/api")


# ---------- Auth Dependencies ----------
def _extract_token(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token


async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            raise HTTPException(401, "User not found")
        user.pop("password_hash", None)
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Invalid or expired token")


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    return user


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("owner", "staff"):
        raise HTTPException(403, "Business account required")
    return user


async def get_active_business(user: dict = Depends(require_owner)) -> dict:
    bid = user.get("business_id")
    if not bid:
        raise HTTPException(403, "No business assigned")
    biz = await db.businesses.find_one({"_id": bid})
    if not biz:
        raise HTTPException(404, "Business not found")
    biz["live_status"] = evaluate_account_status(biz)
    return biz


async def require_active_business(biz: dict = Depends(get_active_business)) -> dict:
    """For write actions: must be active (not expired / suspended)."""
    status = biz.get("live_status")
    if status == "suspended":
        raise HTTPException(403, "Account suspended")
    if status == "expired":
        raise HTTPException(403, "Plan expired — please contact admin to renew")
    return biz


# ---------- Cookie helpers ----------
def set_auth_cookies(response: Response, access: str, refresh: str):
    # secure=True needed for SameSite=None over HTTPS; use Lax to allow same-site app.
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=1209600, path="/")


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


# ---------- Public serialization helpers ----------
def public_user(u: dict) -> dict:
    return {
        "id": u["_id"],
        "email": u.get("email"),
        "mobile": u.get("mobile"),
        "name": u.get("name"),
        "role": u.get("role"),
        "business_id": u.get("business_id"),
    }


def public_business(b: dict) -> dict:
    out = {k: b.get(k) for k in [
        "business_name", "owner_name", "mobile", "email",
        "plan_start_date", "plan_expiry_date", "status", "created_at"
    ]}
    out["id"] = b["_id"]
    out["live_status"] = evaluate_account_status(b)
    expiry = parse_date(b.get("plan_expiry_date"))
    out["days_remaining"] = (expiry - date.today()).days if expiry else None
    return out


# ---------- AUTH ----------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    ident = body.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"email": ident}, {"mobile": ident}]})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    # For owners, evaluate business status
    if user.get("role") in ("owner", "staff"):
        biz = await db.businesses.find_one({"_id": user.get("business_id")})
        if not biz:
            raise HTTPException(403, "Business not found")
        live = evaluate_account_status(biz)
        if live == "suspended":
            raise HTTPException(403, "Account suspended. Please contact admin.")

    access = create_access_token(user["_id"], user["role"], user.get("business_id"))
    refresh = create_refresh_token(user["_id"])
    set_auth_cookies(response, access, refresh)
    return {"user": public_user(user), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    out = public_user(user)
    if user.get("business_id"):
        biz = await db.businesses.find_one({"_id": user["business_id"]})
        if biz:
            out["business"] = public_business(biz)
    return out


@api.post("/auth/refresh")
async def refresh_token_route(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(401, "No refresh token")
    try:
        payload = decode_token(rt)
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            raise HTTPException(401, "User not found")
        access = create_access_token(user["_id"], user["role"], user.get("business_id"))
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Invalid refresh token")


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn):
    ident = body.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"email": ident}, {"mobile": ident}]})
    # Always respond positively to avoid email enumeration
    if not user or not user.get("email"):
        return {"ok": True, "message": "If account exists, reset email sent."}

    token = gen_reset_token()
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    await db.password_reset_tokens.insert_one({
        "_id": new_id(),
        "user_id": user["_id"],
        "token": token,
        "expires_at": expires,
        "used": False,
        "created_at": now_iso(),
    })

    smtp = await db.smtp_settings.find_one({"_id": "smtp"})
    frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend}/reset-password?token={token}"

    if smtp and smtp.get("host"):
        html = f"""
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#F5F4F0;padding:32px;border-radius:12px;color:#1C2B2D">
          <h2 style="color:#2B4C3B;margin:0 0 12px">RapidXT Hisaab — Password Reset</h2>
          <p>Namaste,</p>
          <p>We received a request to reset your password. Click below to set a new password (link valid for 1 hour):</p>
          <p><a href="{reset_link}" style="display:inline-block;background:#2B4C3B;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset Password</a></p>
          <p style="color:#5A6566;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
        </div>
        """
        ok, msg = send_email_smtp(smtp, user["email"], "Reset your RapidXT Hisaab password", html)
        if not ok:
            logging.warning(f"SMTP send failed: {msg} — reset link: {reset_link}")
    else:
        logging.warning(f"SMTP not configured — reset link: {reset_link}")

    return {"ok": True, "message": "If account exists, reset email sent."}


@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not rec:
        raise HTTPException(400, "Invalid or used token")
    if rec["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(400, "Token expired")
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password too short")
    await db.users.update_one(
        {"_id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    """Logged-in users change their own password (verifies current first)."""
    if len(body.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    fresh = await db.users.find_one({"_id": user["_id"]})
    if not fresh or not verify_password(body.current_password, fresh["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if verify_password(body.new_password, fresh["password_hash"]):
        raise HTTPException(400, "New password must be different from current password")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    return {"ok": True}



# ---------- SUPER ADMIN ----------
@api.get("/admin/businesses")
async def list_businesses(_: dict = Depends(require_super_admin)):
    items = await db.businesses.find({}).sort("created_at", -1).to_list(2000)
    return [public_business(b) for b in items]


@api.post("/admin/businesses")
async def create_business(body: BusinessCreate, _: dict = Depends(require_super_admin)):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"$or": [{"email": email}, {"mobile": body.mobile}]})
    if existing:
        raise HTTPException(400, "Email or mobile already exists")

    biz_id = new_id()
    biz = {
        "_id": biz_id,
        "business_name": body.business_name,
        "owner_name": body.owner_name,
        "mobile": body.mobile,
        "email": email,
        "plan_start_date": body.plan_start_date,
        "plan_expiry_date": body.plan_expiry_date,
        "status": body.status,
        "created_at": now_iso(),
    }
    await db.businesses.insert_one(biz)

    user = {
        "_id": new_id(),
        "email": email,
        "mobile": body.mobile,
        "name": body.owner_name,
        "password_hash": hash_password(body.password),
        "role": "owner",
        "business_id": biz_id,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)

    # Seed default project stages for the new business
    default_stages = [
        "Site Visit Done", "Measurement Taken", "Quotation Sent",
        "Advance Received", "Material Ordered", "Work Started",
        "25% Completed", "50% Completed", "75% Completed",
        "Final Finishing", "Handover Done", "Payment Completed"
    ]
    stage_docs = [
        {"_id": new_id(), "business_id": biz_id, "name": s,
         "display_order": i, "active": True, "created_at": now_iso()}
        for i, s in enumerate(default_stages)
    ]
    await db.stages_master.insert_many(stage_docs)

    return public_business(biz)


@api.get("/admin/businesses/{biz_id}")
async def get_business(biz_id: str, _: dict = Depends(require_super_admin)):
    b = await db.businesses.find_one({"_id": biz_id})
    if not b:
        raise HTTPException(404, "Business not found")
    owner = await db.users.find_one({"business_id": biz_id, "role": "owner"})
    out = public_business(b)
    out["owner_user_id"] = owner["_id"] if owner else None
    return out


@api.put("/admin/businesses/{biz_id}")
async def update_business(biz_id: str, body: BusinessUpdate, _: dict = Depends(require_super_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No changes")
    if "email" in updates:
        updates["email"] = updates["email"].lower().strip()
    await db.businesses.update_one({"_id": biz_id}, {"$set": updates})
    # Sync owner user contact fields too
    owner_updates = {}
    for k in ("email", "mobile"):
        if k in updates:
            owner_updates[k] = updates[k]
    if "owner_name" in updates:
        owner_updates["name"] = updates["owner_name"]
    if owner_updates:
        await db.users.update_one({"business_id": biz_id, "role": "owner"}, {"$set": owner_updates})
    b = await db.businesses.find_one({"_id": biz_id})
    return public_business(b)


@api.post("/admin/businesses/{biz_id}/extend-expiry")
async def extend_expiry(biz_id: str, body: ExtendExpiryIn, _: dict = Depends(require_super_admin)):
    b = await db.businesses.find_one({"_id": biz_id})
    if not b:
        raise HTTPException(404, "Business not found")
    updates = {"plan_expiry_date": body.new_expiry_date}
    # If was expired and new date is future and not manually suspended, mark active
    new_expiry = parse_date(body.new_expiry_date)
    if b.get("status") != "suspended" and new_expiry and new_expiry >= date.today():
        updates["status"] = "active"
    await db.businesses.update_one({"_id": biz_id}, {"$set": updates})
    b = await db.businesses.find_one({"_id": biz_id})
    return public_business(b)


@api.post("/admin/businesses/{biz_id}/status")
async def change_status(biz_id: str, body: StatusChangeIn, _: dict = Depends(require_super_admin)):
    await db.businesses.update_one({"_id": biz_id}, {"$set": {"status": body.status}})
    b = await db.businesses.find_one({"_id": biz_id})
    if not b:
        raise HTTPException(404, "Business not found")
    return public_business(b)


@api.post("/admin/businesses/{biz_id}/reset-password")
async def admin_reset_password(biz_id: str, body: AdminResetPasswordIn, _: dict = Depends(require_super_admin)):
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password too short")
    res = await db.users.update_one(
        {"business_id": biz_id, "role": "owner"},
        {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Owner user not found")
    return {"ok": True}


@api.delete("/admin/businesses/{biz_id}")
async def delete_business(biz_id: str, _: dict = Depends(require_super_admin)):
    """Hard-delete a business + its users + all child data."""
    b = await db.businesses.find_one({"_id": biz_id})
    if not b:
        raise HTTPException(404, "Business not found")

    # Cascade delete all business-scoped data
    collections = [
        "users", "projects", "clients", "parties", "refs",
        "transactions", "extra_work", "materials", "documents",
        "reminders", "stages_master", "stage_history",
    ]
    for coll in collections:
        await db[coll].delete_many({"business_id": biz_id})

    await db.businesses.delete_one({"_id": biz_id})
    return {"ok": True, "deleted": biz_id}


# SMTP
@api.get("/admin/smtp")
async def get_smtp(_: dict = Depends(require_super_admin)):
    s = await db.smtp_settings.find_one({"_id": "smtp"})
    if not s:
        return {"configured": False}
    out = {k: s.get(k) for k in ["host", "port", "username", "encryption", "from_email", "from_name"]}
    out["configured"] = True
    out["has_password"] = bool(s.get("password"))
    return out


@api.put("/admin/smtp")
async def update_smtp(body: SmtpSettingsIn, _: dict = Depends(require_super_admin)):
    doc = body.model_dump()
    doc["_id"] = "smtp"
    doc["updated_at"] = now_iso()
    await db.smtp_settings.replace_one({"_id": "smtp"}, doc, upsert=True)
    return {"ok": True}


@api.post("/admin/smtp/test")
async def test_smtp(body: dict, _: dict = Depends(require_super_admin)):
    test_to = body.get("to")
    if not test_to:
        raise HTTPException(400, "Provide 'to' email")
    smtp = await db.smtp_settings.find_one({"_id": "smtp"})
    if not smtp:
        raise HTTPException(400, "SMTP not configured")
    ok, msg = send_email_smtp(
        smtp, test_to,
        "RapidXT Hisaab — SMTP Test",
        "<p>Your SMTP settings are working. Hisaab kitaab ready hai!</p>"
    )
    return {"ok": ok, "message": msg}


# ---------- Mount admin & auth router ----------
app.include_router(api)
# Mount business owner routes (separate file because of size)
app.include_router(build_owner_router(db, get_active_business, require_active_business, require_owner))


# ---------- CORS ----------
frontend_url = os.environ.get("FRONTEND_URL", "*")
origins = [frontend_url] if frontend_url != "*" else ["*"]
# Always include localhost for dev
if "http://localhost:3000" not in origins:
    origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Logging ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("rapidxt")


# ---------- Startup: indexes + seed super admin ----------
@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email")
        await db.users.create_index("mobile")
        await db.users.create_index("business_id")
        await db.businesses.create_index("email")
        await db.projects.create_index("business_id")
        await db.clients.create_index("business_id")
        await db.parties.create_index("business_id")
        await db.refs.create_index("business_id")
        await db.transactions.create_index([("business_id", 1), ("project_id", 1)])
        await db.transactions.create_index([("business_id", 1), ("date", -1)])
        await db.extra_work.create_index([("business_id", 1), ("project_id", 1)])
        await db.materials.create_index([("business_id", 1), ("project_id", 1)])
        await db.documents.create_index([("business_id", 1), ("project_id", 1)])
        await db.reminders.create_index([("business_id", 1), ("due_date", 1)])
        await db.stages_master.create_index([("business_id", 1), ("display_order", 1)])
        await db.stage_history.create_index([("business_id", 1), ("project_id", 1)])
        await db.password_reset_tokens.create_index("expires_at")
    except Exception as e:
        logger.warning(f"Index create issue: {e}")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@rapidxt.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    admin_name = os.environ.get("ADMIN_NAME", "Super Admin")

    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "_id": new_id(),
            "email": admin_email,
            "mobile": "0000000000",
            "name": admin_name,
            "password_hash": hash_password(admin_password),
            "role": "super_admin",
            "business_id": None,
            "created_at": now_iso(),
        })
        logger.info(f"Seeded super admin: {admin_email}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"app": "RapidXT Hisaab API", "ok": True}
