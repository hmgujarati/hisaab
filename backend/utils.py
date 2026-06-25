"""Helpers: auth, currency, FY, email."""
from __future__ import annotations
import os
import bcrypt
import jwt
import smtplib
import secrets
from datetime import datetime, timezone, timedelta, date
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


JWT_ALGO = "HS256"


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, role: str, business_id: Optional[str]) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "business_id": business_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGO)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=14),
        "type": "refresh",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGO])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_iso() -> str:
    return date.today().isoformat()


def parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except Exception:
        return None


def fy_range(fy_label: str) -> tuple[date, date]:
    """fy_label like '2025-26' -> (2025-04-01, 2026-03-31)."""
    try:
        start_yr_str, end_yr_str = fy_label.replace("–", "-").split("-")
        start_yr = int(start_yr_str)
        # support 2-digit end year (e.g., 2025-26)
        end_yr = int(end_yr_str)
        if end_yr < 100:
            end_yr += 2000
        return date(start_yr, 4, 1), date(end_yr, 3, 31)
    except Exception:
        # fallback to current FY
        t = date.today()
        sy = t.year if t.month >= 4 else t.year - 1
        return date(sy, 4, 1), date(sy + 1, 3, 31)


def current_fy_label() -> str:
    t = date.today()
    sy = t.year if t.month >= 4 else t.year - 1
    return f"{sy}-{str(sy + 1)[-2:]}"


def gen_reset_token() -> str:
    return secrets.token_urlsafe(40)


def send_email_smtp(smtp_cfg: dict, to_email: str, subject: str, body_html: str) -> tuple[bool, str]:
    """Send an email using SMTP config. Returns (success, message)."""
    if not smtp_cfg or not smtp_cfg.get("host"):
        return False, "SMTP not configured"
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{smtp_cfg.get('from_name', 'RapidXT Hisaab')} <{smtp_cfg['from_email']}>"
        msg["To"] = to_email
        msg.attach(MIMEText(body_html, "html"))

        host = smtp_cfg["host"]
        port = int(smtp_cfg.get("port", 587))
        enc = (smtp_cfg.get("encryption") or "TLS").upper()

        if enc == "SSL":
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                if smtp_cfg.get("username"):
                    server.login(smtp_cfg["username"], smtp_cfg["password"])
                server.sendmail(smtp_cfg["from_email"], [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                if enc == "TLS":
                    server.starttls()
                    server.ehlo()
                if smtp_cfg.get("username"):
                    server.login(smtp_cfg["username"], smtp_cfg["password"])
                server.sendmail(smtp_cfg["from_email"], [to_email], msg.as_string())
        return True, "sent"
    except Exception as e:
        return False, f"SMTP error: {e}"


def evaluate_account_status(business: dict) -> str:
    """Compute live status: suspended (manual) > expired (date) > active."""
    if not business:
        return "expired"
    if business.get("status") == "suspended":
        return "suspended"
    expiry = parse_date(business.get("plan_expiry_date"))
    if expiry and expiry < date.today():
        return "expired"
    return "active"
