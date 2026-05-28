"""
ERRORHACKER backend — FastAPI + MongoDB
Endpoints:
  GET    /api/                  health
  GET    /api/config            return full site config
  PUT    /api/config            replace full config (admin)
  PATCH  /api/config            partial update (admin)
  POST   /api/admin/login       { password } -> { ok, token }
  POST   /api/admin/password    change password (admin)
  POST   /api/orders            create order (public)
  GET    /api/orders            list all orders (admin)
  GET    /api/orders/{id}       get one order (public, for tracker)
  PATCH  /api/orders/{id}       update status (admin)
  DELETE /api/orders            clear all orders (admin)
"""
from fastapi import FastAPI, APIRouter, Header, HTTPException, status, UploadFile, File, Request, Response, Depends, Cookie, Body
from fastapi.responses import Response as FastResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
import os, uuid, logging, base64, asyncio, secrets, io
import httpx, bcrypt, jwt
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr

from defaults import DEFAULT_CONFIG

# --------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
fs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="feed_media")

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGO = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days

app = FastAPI(title="ERRORHACKER API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("eh")

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# --------------------------------------------------------------------------
# Models
class OrderIn(BaseModel):
    service: Optional[str] = None
    serviceName: Optional[str] = None
    name: str
    email: str
    tg: Optional[str] = ""
    size: Optional[str] = ""
    target: Optional[str] = ""
    notes: Optional[str] = ""

class StatusIn(BaseModel):
    status: str

class LoginIn(BaseModel):
    password: str

class PasswordIn(BaseModel):
    new_password: str

class TelegramTestIn(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    message: Optional[str] = "ERRORHACKER // Telegram test alert ok_"

# ---- Recovery models ----
class RecoveryCaseIn(BaseModel):
    service_id: str
    service_name: Optional[str] = None
    issue: Optional[str] = None
    platform: str
    account_url: Optional[str] = ""
    follower_tier: Optional[str] = ""
    urgency: Optional[str] = "medium"  # low | medium | high
    description: Optional[str] = ""
    proof_urls: List[str] = []
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    telegram: Optional[str] = ""
    whatsapp: Optional[str] = ""
    estimated_price: Optional[float] = 0
    currency: Optional[str] = "INR"
    contact_pref: Optional[str] = "telegram"

class RecoveryCaseStatusIn(BaseModel):
    status: str  # new | reviewing | engaged | recovering | recovered | closed | rejected
    admin_note: Optional[str] = None

class RecoveryServiceIn(BaseModel):
    name: str
    issue_key: str
    price_min: float = 0
    price_max: float = 0
    eta_min_days: int = 1
    eta_max_days: int = 30
    success_rate: int = 92
    bullets: List[str] = []
    active: bool = True
    sort: int = 0

class RecoveryReviewIn(BaseModel):
    name: str
    handle: Optional[str] = ""
    avatar_url: Optional[str] = ""
    quote: str
    rating: int = 5
    service_key: Optional[str] = ""
    approved: bool = True
    sort: int = 0

# ---- Auth models ----
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=100)
    name: Optional[str] = None
    ref: Optional[str] = None  # referral code of inviter

class LoginUserIn(BaseModel):
    email: EmailStr
    password: str

class GoogleSessionIn(BaseModel):
    session_id: str

# ---- Coupon models ----
class CouponIn(BaseModel):
    code: str
    type: str = Field(pattern="^(percent|flat)$")
    value: float
    max_uses: int = -1
    active: bool = True
    expires_at: Optional[str] = None
    description: Optional[str] = ""

class ApplyCouponIn(BaseModel):
    code: str
    amount: float

# ---- Chat models ----
class ChatIn(BaseModel):
    session_id: str
    message: str

# ---- Payment models ----
class PaymentSettingsIn(BaseModel):
    manual_enabled: bool = True
    upi_id: Optional[str] = ""
    upi_name: Optional[str] = ""
    bank_details: Optional[str] = ""
    qr_image_url: Optional[str] = ""
    instructions: Optional[str] = ""
    crypto_enabled: bool = True
    crypto_wallets: Optional[List[Dict[str, Any]]] = None
    currencies: Optional[List[Dict[str, Any]]] = None
    default_currency: Optional[str] = "INR"

class PaymentProofIn(BaseModel):
    order_id: str
    method: str
    coin: Optional[str] = ""
    tx_reference: Optional[str] = ""
    proof_url: Optional[str] = ""
    amount: Optional[float] = 0
    currency: Optional[str] = "INR"

# ---- Feed (Instagram-style) models ----
class PostIn(BaseModel):
    image_url: str
    caption: Optional[str] = ""
    location: Optional[str] = ""
    likes_base: int = 0
    views_base: int = 0
    pinned: bool = False

class ReelIn(BaseModel):
    video_url: str
    thumb_url: Optional[str] = ""
    caption: Optional[str] = ""
    likes_base: int = 0
    views_base: int = 0
    pinned: bool = False

class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)

class AdminCommentIn(BaseModel):
    post_id: Optional[str] = None
    reel_id: Optional[str] = None
    user_name: str
    text: str
    picture: Optional[str] = ""

# --------------------------------------------------------------------------
# Helpers
async def _ensure_config():
    doc = await db.site_config.find_one({"_id": "main"})
    if not doc:
        await db.site_config.insert_one({"_id": "main", **DEFAULT_CONFIG, "updated_at": datetime.utcnow().isoformat()})
        doc = await db.site_config.find_one({"_id": "main"})
        return doc
    # Auto-migrate: merge in any new top-level keys from DEFAULT_CONFIG
    updates = {}
    for k, v in DEFAULT_CONFIG.items():
        if k not in doc:
            updates[k] = v
    # Make sure 'Feed' nav item exists (insert before Blogs)
    try:
        nav = doc.get("nav") or []
        if not any((n.get("to") == "/feed") for n in nav):
            new_nav = []
            inserted = False
            for n in nav:
                if not inserted and n.get("to") == "/blogs":
                    new_nav.append({"label": "Feed", "to": "/feed"})
                    inserted = True
                new_nav.append(n)
            if not inserted:
                new_nav.append({"label": "Feed", "to": "/feed"})
            updates["nav"] = new_nav
    except Exception:
        pass
    # Replace 'Blogs' nav item with 'Recovery'
    try:
        nav = updates.get("nav") or doc.get("nav") or []
        changed = False
        new_nav = []
        for n in nav:
            if n.get("to") in ("/blogs", "/blog"):
                new_nav.append({"label": "Recovery", "to": "/recovery"})
                changed = True
            else:
                new_nav.append(n)
        if changed:
            updates["nav"] = new_nav
    except Exception:
        pass
    if updates:
        updates["updated_at"] = datetime.utcnow().isoformat()
        await db.site_config.update_one({"_id": "main"}, {"$set": updates})
        doc = await db.site_config.find_one({"_id": "main"})
    return doc

async def _ensure_admin():
    doc = await db.admin.find_one({"_id": "creds"})
    env_pw = os.environ.get("ADMIN_PASSWORD", "").strip()
    env_force = os.environ.get("ADMIN_PASSWORD_FORCE", "").strip() == "1"
    if not doc:
        # First boot — use env password if provided, otherwise default admin123
        pw = env_pw or "admin123"
        await db.admin.insert_one({"_id": "creds", "password": pw, "tokens": []})
        doc = await db.admin.find_one({"_id": "creds"})
        log.info("admin creds bootstrapped")
    elif env_force and env_pw and env_pw != doc.get("password"):
        # ADMIN_PASSWORD_FORCE=1 → sync password from env (one-shot reset)
        await db.admin.update_one({"_id": "creds"}, {"$set": {"password": env_pw, "tokens": []}})
        doc = await db.admin.find_one({"_id": "creds"})
        log.info("admin password force-synced from ADMIN_PASSWORD env var")
    return doc

async def _check_admin(token: Optional[str]):
    if not token:
        raise HTTPException(status_code=401, detail="Missing admin token")
    creds = await _ensure_admin()
    if token not in (creds.get("tokens") or []):
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return True

async def _check_feed_writer(request: Request, x_admin_token: Optional[str] = None) -> Dict[str, Any]:
    """Returns {role, by} on success. Allows admin token OR JWT user with role in {owner, feed_mod}."""
    if x_admin_token:
        creds = await _ensure_admin()
        if x_admin_token in (creds.get("tokens") or []):
            return {"role": "owner", "by": "admin_token", "user_id": None}
    user = await _get_user_from_request(request)
    if user and user.get("role") in ("owner", "feed_mod") and not user.get("disabled"):
        return {"role": user["role"], "by": user.get("email"), "user_id": user.get("user_id")}
    raise HTTPException(status_code=401, detail="Not authorized")

async def _enforce_mod_quota(actor: Dict[str, Any], file_size: int = 0):
    """For feed_mod actor, check daily upload limit and per-file max size."""
    if actor.get("role") != "feed_mod" or not actor.get("user_id"):
        return
    u = await db.users.find_one({"user_id": actor["user_id"]})
    if not u:
        raise HTTPException(status_code=401, detail="Moderator account missing")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily_limit = int(u.get("daily_upload_limit") or 10)
    max_mb = int(u.get("max_upload_mb") or 15)
    if file_size and file_size > max_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds your {max_mb} MB limit")
    log_doc = u.get("upload_log") or {}
    used = int(log_doc.get(today) or 0)
    if used >= daily_limit:
        raise HTTPException(status_code=429, detail=f"Daily upload limit reached ({daily_limit}). Try again tomorrow.")
    # increment
    await db.users.update_one({"user_id": actor["user_id"]}, {"$set": {f"upload_log.{today}": used + 1}})

async def _audit(actor: Dict[str, Any], action: str, target_id: str = "", meta: Optional[Dict[str, Any]] = None):
    try:
        await db.mod_audit_log.insert_one({
            "id": f"AUD-{uuid.uuid4().hex[:10]}",
            "at": _now_iso(),
            "actor_role": actor.get("role"),
            "actor": actor.get("by"),
            "actor_user_id": actor.get("user_id"),
            "action": action,
            "target_id": target_id,
            "meta": meta or {},
        })
    except Exception as e:
        log.warning("audit failed: %s", e)

def _clean(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return {}
    doc.pop("_id", None)
    return doc

# ---- Telegram --------------------------------------------------------------
async def _telegram_send(bot_token: str, chat_id: str, text: str) -> Dict[str, Any]:
    if not bot_token or not chat_id:
        return {"ok": False, "error": "missing_bot_token_or_chat_id"}
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True})
        try:
            return r.json()
        except Exception:
            return {"ok": False, "status": r.status_code}

async def _notify_recovery_case(case: Dict[str, Any]):
    try:
        cfg = await _ensure_config()
        notif = (cfg.get("notifications") or {}).get("telegram") or {}
        if not notif.get("enabled"):
            return
        bot = notif.get("bot_token", "")
        chat = notif.get("chat_id", "")
        urg = (case.get("urgency") or "").upper()
        text = (
            "<b>NEW RECOVERY CASE // ERRORHACKER</b>\n"
            f"<b>Case:</b> {case.get('id')}\n"
            f"<b>Service:</b> {case.get('service_name') or '—'}\n"
            f"<b>Platform:</b> {case.get('platform')}\n"
            f"<b>Urgency:</b> {urg}\n"
            f"<b>Account:</b> {case.get('account_url') or '—'}\n"
            f"<b>Name:</b> {case.get('name')}\n"
            f"<b>Email:</b> {case.get('email')}\n"
            f"<b>Telegram:</b> {case.get('telegram') or '—'}\n"
            f"<b>WhatsApp:</b> {case.get('whatsapp') or '—'}\n"
            f"<b>Estimate:</b> {case.get('estimated_price')} {case.get('currency')}\n"
            f"<b>Description:</b>\n{(case.get('description') or '—')[:600]}\n"
            f"<b>Proofs:</b> {len(case.get('proof_urls') or [])} file(s)"
        )
        res = await _telegram_send(bot, chat, text)
        if not res.get("ok"):
            log.warning("telegram recovery notify failed: %s", res)
    except Exception as e:
        log.warning("telegram recovery notify exception: %s", e)

async def _notify_order(order: Dict[str, Any]):
    try:
        cfg = await _ensure_config()
        notif = (cfg.get("notifications") or {}).get("telegram") or {}
        if not notif.get("enabled"):
            return
        bot = notif.get("bot_token", "")
        chat = notif.get("chat_id", "")
        text = (
            "<b>NEW ORDER // ERRORHACKER</b>\n"
            f"<b>ID:</b> {order.get('id')}\n"
            f"<b>Service:</b> {order.get('serviceName') or order.get('service') or '—'}\n"
            f"<b>Name:</b> {order.get('name')}\n"
            f"<b>Email:</b> {order.get('email')}\n"
            f"<b>Telegram:</b> {order.get('tg') or '—'}\n"
            f"<b>Size:</b> {order.get('size') or '—'}\n"
            f"<b>Target:</b> {order.get('target') or '—'}\n"
            f"<b>Notes:</b> {order.get('notes') or '—'}\n"
            f"<b>Time:</b> {order.get('createdAt')}"
        )
        res = await _telegram_send(bot, chat, text)
        if not res.get("ok"):
            log.warning("telegram notify failed: %s", res)
    except Exception as e:
        log.warning("telegram notify exception: %s", e)

# --------------------------------------------------------------------------
# Routes
@api.get("/")
async def root():
    return {"service": "ERRORHACKER API", "status": "online", "ts": datetime.utcnow().isoformat()}

# ---- Config ----------------------------------------------------------------
@api.get("/config")
async def get_config():
    doc = await _ensure_config()
    return _clean(doc)

@api.put("/config")
async def put_config(payload: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    payload.pop("_id", None)
    payload["updated_at"] = datetime.utcnow().isoformat()
    await db.site_config.replace_one({"_id": "main"}, {"_id": "main", **payload}, upsert=True)
    doc = await db.site_config.find_one({"_id": "main"})
    return _clean(doc)

@api.patch("/config")
async def patch_config(payload: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    payload.pop("_id", None)
    payload["updated_at"] = datetime.utcnow().isoformat()
    await db.site_config.update_one({"_id": "main"}, {"$set": payload}, upsert=True)
    doc = await db.site_config.find_one({"_id": "main"})
    return _clean(doc)

# ---- Admin auth ------------------------------------------------------------
@api.post("/admin/login")
async def admin_login(body: LoginIn):
    creds = await _ensure_admin()
    if body.password != creds.get("password"):
        raise HTTPException(status_code=401, detail="Access denied")
    token = uuid.uuid4().hex
    tokens = (creds.get("tokens") or [])[-9:] + [token]  # keep last 10
    await db.admin.update_one({"_id": "creds"}, {"$set": {"tokens": tokens}})
    return {"ok": True, "token": token}

@api.post("/admin/password")
async def admin_change_password(body: PasswordIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    if not body.new_password or len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password too short")
    await db.admin.update_one({"_id": "creds"}, {"$set": {"password": body.new_password, "tokens": []}})
    return {"ok": True}

@api.post("/admin/logout")
async def admin_logout(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token:
        await db.admin.update_one({"_id": "creds"}, {"$pull": {"tokens": x_admin_token}})
    return {"ok": True}

# ---- Orders ----------------------------------------------------------------
@api.post("/orders")
async def create_order(body: OrderIn, request: Request):
    user = await _get_user_from_request(request)
    order = {
        "id": f"ORD-{uuid.uuid4().hex[:10].upper()}",
        **body.dict(),
        "status": "received",
        "createdAt": datetime.utcnow().isoformat(),
    }
    if user:
        order["user_id"] = user["user_id"]
        order["userEmail"] = user.get("email")
    await db.orders.insert_one(order)
    order.pop("_id", None)
    # Fire-and-forget Telegram notification
    asyncio.create_task(_notify_order(order))
    return order

@api.get("/orders")
async def list_orders(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.orders.find().sort("createdAt", -1).to_list(1000)
    for r in rows:
        r.pop("_id", None)
    return rows

@api.get("/orders/{order_id}")
async def get_order(order_id: str):
    row = await db.orders.find_one({"id": order_id})
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    row.pop("_id", None)
    return row

@api.patch("/orders/{order_id}")
async def update_order(order_id: str, body: StatusIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.orders.update_one({"id": order_id}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    row = await db.orders.find_one({"id": order_id})
    row.pop("_id", None)
    return row

@api.delete("/orders")
async def clear_orders(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.orders.delete_many({})
    return {"deleted": res.deleted_count}

# ---- Recovery: services (config-stored) -----------------------------------
@api.get("/recovery/config")
async def recovery_config():
    cfg = await _ensure_config()
    return {
        "services": cfg.get("recovery", {}).get("services", []),
        "platforms": cfg.get("recovery", {}).get("platforms", []),
        "hero": cfg.get("recovery", {}).get("hero", {}),
        "trust": cfg.get("recovery", {}).get("trust", {}),
        "default_currency": (cfg.get("payments", {}).get("default_currency") or "INR"),
    }

@api.put("/recovery/config")
async def recovery_config_update(body: Dict[str, Any] = Body(...), x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    cfg = await _ensure_config()
    rec = cfg.get("recovery") or {}
    for k in ("services", "platforms", "hero", "trust"):
        if k in body:
            rec[k] = body[k]
    await db.site_config.update_one({"_id": "main"}, {"$set": {"recovery": rec, "updated_at": _now_iso()}})
    return {"ok": True, "recovery": rec}

# ---- Recovery: cases ------------------------------------------------------
@api.post("/recovery/cases")
async def recovery_create_case(body: RecoveryCaseIn, request: Request):
    user = await _get_user_from_request(request)
    case = {
        "id": f"REC-{uuid.uuid4().hex[:10].upper()}",
        **body.dict(),
        "status": "new",
        "admin_note": "",
        "createdAt": _now_iso(),
    }
    if user:
        case["user_id"] = user["user_id"]
        case["userEmail"] = user.get("email")
    await db.recovery_cases.insert_one(case)
    case.pop("_id", None)
    asyncio.create_task(_notify_recovery_case(case))
    return case

@api.get("/recovery/cases")
async def recovery_list_cases(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.recovery_cases.find().sort("createdAt", -1).to_list(1000)
    for r in rows:
        r.pop("_id", None)
    return rows

@api.get("/recovery/cases/{case_id}")
async def recovery_get_case(case_id: str):
    row = await db.recovery_cases.find_one({"id": case_id})
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
    row.pop("_id", None)
    return row

@api.patch("/recovery/cases/{case_id}")
async def recovery_update_case(case_id: str, body: RecoveryCaseStatusIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    upd = {"status": body.status}
    if body.admin_note is not None:
        upd["admin_note"] = body.admin_note
    res = await db.recovery_cases.update_one({"id": case_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case not found")
    row = await db.recovery_cases.find_one({"id": case_id})
    row.pop("_id", None)
    return row

@api.delete("/recovery/cases/{case_id}")
async def recovery_delete_case(case_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.recovery_cases.delete_one({"id": case_id})
    return {"deleted": res.deleted_count}

# ---- Recovery: reviews ----------------------------------------------------
@api.get("/recovery/reviews")
async def recovery_list_reviews(service_key: Optional[str] = None, all: bool = False, x_admin_token: Optional[str] = Header(None)):
    query: Dict[str, Any] = {}
    if not all:
        query["approved"] = True
    else:
        # only admin can list unapproved
        await _check_admin(x_admin_token)
    if service_key:
        query["service_key"] = service_key
    rows = await db.recovery_reviews.find(query).sort([("sort", 1), ("createdAt", -1)]).to_list(500)
    for r in rows:
        r.pop("_id", None)
    return rows

@api.post("/recovery/reviews")
async def recovery_create_review(body: RecoveryReviewIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rev = {
        "id": f"REV-{uuid.uuid4().hex[:8]}",
        **body.dict(),
        "createdAt": _now_iso(),
    }
    await db.recovery_reviews.insert_one(rev)
    rev.pop("_id", None)
    return rev

@api.patch("/recovery/reviews/{review_id}")
async def recovery_update_review(review_id: str, body: Dict[str, Any] = Body(...), x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    body.pop("id", None); body.pop("_id", None); body.pop("createdAt", None)
    res = await db.recovery_reviews.update_one({"id": review_id}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    row = await db.recovery_reviews.find_one({"id": review_id})
    row.pop("_id", None)
    return row

@api.delete("/recovery/reviews/{review_id}")
async def recovery_delete_review(review_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.recovery_reviews.delete_one({"id": review_id})
    return {"deleted": res.deleted_count}

# ---- Recovery: stats (public) ---------------------------------------------
@api.get("/recovery/stats")
async def recovery_stats():
    total = await db.recovery_cases.count_documents({})
    recovered = await db.recovery_cases.count_documents({"status": "recovered"})
    # cases this week
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    weekly = await db.recovery_cases.count_documents({"status": "recovered", "createdAt": {"$gte": since}})
    success = int((recovered / total) * 100) if total else 0
    return {"total": total, "recovered": recovered, "weekly_recovered": weekly, "success_rate": success}

# ---- Uploads ---------------------------------------------------------------
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

@api.post("/uploads")
async def upload_image(file: UploadFile = File(...), x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")
    uid = uuid.uuid4().hex
    doc = {
        "_id": uid,
        "content_type": file.content_type,
        "filename": file.filename or f"{uid}",
        "size": len(raw),
        "data": base64.b64encode(raw).decode("ascii"),
        "createdAt": datetime.utcnow().isoformat(),
    }
    await db.uploads.insert_one(doc)
    return {"id": uid, "url": f"/api/uploads/{uid}", "size": len(raw), "content_type": file.content_type}

@api.get("/uploads/{uid}")
async def get_upload(uid: str):
    doc = await db.uploads.find_one({"_id": uid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return FastResponse(content=base64.b64decode(doc["data"]), media_type=doc.get("content_type", "image/png"), headers={"Cache-Control": "public, max-age=31536000, immutable"})

@api.delete("/uploads/{uid}")
async def delete_upload(uid: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    await db.uploads.delete_one({"_id": uid})
    return {"ok": True}

# ---- Telegram --------------------------------------------------------------
@api.post("/admin/telegram/test")
async def telegram_test(body: TelegramTestIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    bot = body.bot_token
    chat = body.chat_id
    if not bot or not chat:
        cfg = await _ensure_config()
        n = (cfg.get("notifications") or {}).get("telegram") or {}
        bot = bot or n.get("bot_token", "")
        chat = chat or n.get("chat_id", "")
    res = await _telegram_send(bot, chat, body.message or "ERRORHACKER // Telegram test alert ok_")
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("description") or "Telegram send failed")
    return {"ok": True, "result": res.get("result", {})}

# ---- Auth helpers ----------------------------------------------------------
def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def _make_jwt(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def _set_session_cookie(resp: Response, token: str):
    resp.set_cookie(key="eh_session", value=token, httponly=True, secure=True, samesite="none", max_age=ACCESS_TTL_MIN * 60, path="/")

def _safe_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in u.items() if k not in ("password_hash", "_id")}

def _gen_ref_code() -> str:
    return "EH" + secrets.token_hex(3).upper()

async def _get_user_from_request(request: Request) -> Optional[Dict[str, Any]]:
    token = request.cookies.get("eh_session")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        return user
    except Exception:
        return None

async def require_user(request: Request) -> Dict[str, Any]:
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ---- Auth routes -----------------------------------------------------------
@api.post("/auth/register")
async def auth_register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    referred_by_uid = None
    if body.ref:
        inviter = await db.users.find_one({"referral_code": body.ref.upper().strip()})
        if inviter:
            referred_by_uid = inviter["user_id"]
    user = {
        "user_id": user_id,
        "email": email,
        "name": (body.name or email.split("@")[0]).strip(),
        "picture": None,
        "password_hash": _hash_pw(body.password),
        "role": "user",
        "provider": "password",
        "referral_code": _gen_ref_code(),
        "referred_by": referred_by_uid,
        "credit_balance": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    # Award inviter on signup
    if referred_by_uid:
        settings = await _ensure_referral_settings()
        award = float(settings.get("signup_reward", 0) or 0)
        if award > 0:
            await db.users.update_one({"user_id": referred_by_uid}, {"$inc": {"credit_balance": award}})
            await db.referrals.insert_one({
                "id": f"REF-{uuid.uuid4().hex[:10]}",
                "inviter_id": referred_by_uid,
                "invitee_id": user_id,
                "invitee_email": email,
                "type": "signup",
                "amount": award,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    token = _make_jwt(user_id, email)
    _set_session_cookie(response, token)
    return {"user": _safe_user(user), "token": token}

@api.post("/auth/login")
async def auth_login(body: LoginUserIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not _verify_pw(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = _make_jwt(user["user_id"], email)
    _set_session_cookie(response, token)
    return {"user": _safe_user(user), "token": token}

@api.post("/auth/logout")
async def auth_logout(response: Response):
    response.delete_cookie("eh_session", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def auth_me(request: Request):
    user = await _get_user_from_request(request)
    if not user:
        return {"user": None}
    return {"user": _safe_user(user)}

# Emergent Google Auth exchange
@api.post("/auth/google/session")
async def auth_google_session(body: GoogleSessionIn, response: Response):
    sess_id = body.session_id
    if not sess_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    url = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.get(url, headers={"X-Session-ID": sess_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    data = r.json()
    email = data.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="No email from Google")
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"),
            "password_hash": None,
            "role": "user",
            "provider": "google",
            "referral_code": _gen_ref_code(),
            "referred_by": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
    else:
        # Update picture/name from latest google data
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"name": data.get("name") or user.get("name"), "picture": data.get("picture") or user.get("picture")}})
        user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    token = _make_jwt(user["user_id"], email)
    _set_session_cookie(response, token)
    return {"user": _safe_user(user), "token": token}

# ---- Coupons ---------------------------------------------------------------
@api.get("/coupons")
async def list_coupons(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.coupons.find().sort("created_at", -1).to_list(500)
    for r in rows: r.pop("_id", None)
    return rows

@api.post("/coupons")
async def create_coupon(body: CouponIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    code = body.code.upper().strip()
    if not code:
        raise HTTPException(status_code=400, detail="Code required")
    existing = await db.coupons.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=409, detail="Coupon code already exists")
    doc = {
        "code": code,
        "type": body.type,
        "value": float(body.value),
        "max_uses": int(body.max_uses),
        "used": 0,
        "active": bool(body.active),
        "expires_at": body.expires_at,
        "description": body.description or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/coupons/{code}")
async def update_coupon(code: str, body: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    body.pop("_id", None); body.pop("code", None); body.pop("created_at", None)
    res = await db.coupons.update_one({"code": code.upper()}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    row = await db.coupons.find_one({"code": code.upper()}); row.pop("_id", None)
    return row

@api.delete("/coupons/{code}")
async def delete_coupon(code: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    await db.coupons.delete_one({"code": code.upper()})
    return {"ok": True}

@api.post("/coupons/apply")
async def apply_coupon(body: ApplyCouponIn):
    code = body.code.upper().strip()
    c = await db.coupons.find_one({"code": code})
    if not c or not c.get("active"):
        raise HTTPException(status_code=404, detail="Invalid coupon")
    if c.get("max_uses", -1) != -1 and c.get("used", 0) >= c["max_uses"]:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    if c.get("expires_at"):
        try:
            if datetime.fromisoformat(c["expires_at"]) < datetime.now(timezone.utc).replace(tzinfo=None):
                raise HTTPException(status_code=400, detail="Coupon expired")
        except HTTPException: raise
        except Exception: pass
    amount = max(0.0, float(body.amount))
    if c["type"] == "percent":
        discount = round(amount * (float(c["value"]) / 100.0), 2)
    else:
        discount = min(amount, float(c["value"]))
    total = max(0.0, round(amount - discount, 2))
    return {"valid": True, "code": code, "discount": discount, "total": total, "type": c["type"], "value": c["value"]}

# ---- Customer "My Orders" --------------------------------------------------
@api.get("/me/orders")
async def my_orders(request: Request):
    user = await require_user(request)
    rows = await db.orders.find({"user_id": user["user_id"]}).sort("createdAt", -1).to_list(500)
    for r in rows: r.pop("_id", None)
    return rows

# ---- AI Chat ---------------------------------------------------------------
CHAT_SYSTEM_PROMPT = (
    "You are ERR0R-BOT, the friendly support assistant for ERRORHACKER — an underground tech intel "
    "& hacking-services brand. Be concise, helpful, and on-brand: hacker/cyberpunk vibe, lowercase terminal style, "
    "punchy 2-4 sentence replies. Topics you can answer: services (social media growth, custom automation, "
    "cybersecurity audits, OSINT), pricing (varies per package, ask for target+quantity), delivery (12-72h typical, "
    "some packages start in minutes), refund/refill policy (up to 60-day refill warranty), "
    "payment methods (crypto BTC/USDT, manual UPI/bank, card via Stripe). "
    "If asked something illegal/unethical or unrelated to the site, politely decline and redirect to /services or Telegram. "
    "Never invent prices or guarantees beyond what is stated."
)

@api.post("/chat/message")
async def chat_message(body: ChatIn):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        log.error("emergentintegrations import failed: %s", e)
        raise HTTPException(status_code=500, detail="AI assistant unavailable")
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="AI key not configured")
    # Persist user message
    await db.chat_history.insert_one({"session_id": body.session_id, "role": "user", "text": body.message, "ts": datetime.now(timezone.utc).isoformat()})
    chat = LlmChat(api_key=key, session_id=body.session_id, system_message=CHAT_SYSTEM_PROMPT).with_model("anthropic", "claude-haiku-4-5-20251001")
    reply = None
    try:
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as e:
        log.warning("chat send_message failed: %s", e)
        raise HTTPException(status_code=502, detail="AI assistant temporarily unavailable")
    if not reply:
        raise HTTPException(status_code=502, detail="AI assistant returned empty response")
    await db.chat_history.insert_one({"session_id": body.session_id, "role": "bot", "text": reply, "ts": datetime.now(timezone.utc).isoformat()})
    return {"reply": reply}

# ---- Feed (Instagram-style) ------------------------------------------------
async def _enrich_feed_item(item: Dict[str, Any], kind: str, user: Optional[Dict[str, Any]]):
    item.pop("_id", None)
    id_key = "post_id" if kind == "post" else "reel_id"
    like_filter = {id_key: item["id"]}
    item["likes_count"] = (item.get("likes_base", 0) or 0) + await db.feed_likes.count_documents(like_filter)
    item["comments_count"] = await db.feed_comments.count_documents(like_filter)
    item["views_count"] = (item.get("views_base", 0) or 0) + await db.feed_views.count_documents(like_filter)
    item["liked_by_me"] = False
    if user:
        liked = await db.feed_likes.find_one({**like_filter, "user_id": user["user_id"]})
        item["liked_by_me"] = bool(liked)
    return item

@api.post("/feed/upload-media")
async def feed_upload_media(request: Request, file: UploadFile = File(...), x_admin_token: Optional[str] = Header(None)):
    actor = await _check_feed_writer(request, x_admin_token)
    ct = file.content_type or ""
    is_video = ct.startswith("video/")
    is_image = ct.startswith("image/")
    if not (is_video or is_image):
        raise HTTPException(status_code=400, detail="Only image or video allowed")
    raw = await file.read()
    # global ceiling first
    hard_limit = 50 * 1024 * 1024 if is_video else 5 * 1024 * 1024
    if len(raw) > hard_limit:
        raise HTTPException(status_code=413, detail=f"File too large (max {hard_limit // (1024*1024)}MB)")
    # per-mod quota
    await _enforce_mod_quota(actor, file_size=len(raw))
    if is_image:
        # reuse simple uploads collection
        uid = uuid.uuid4().hex
        await db.uploads.insert_one({"_id": uid, "content_type": ct, "filename": file.filename or uid, "size": len(raw), "data": base64.b64encode(raw).decode("ascii"), "createdAt": datetime.utcnow().isoformat()})
        return {"id": uid, "url": f"/api/uploads/{uid}", "kind": "image", "content_type": ct, "size": len(raw)}
    # video → GridFS
    grid_id = await fs_bucket.upload_from_stream(file.filename or f"video-{uuid.uuid4().hex}.mp4", io.BytesIO(raw), metadata={"content_type": ct, "size": len(raw)})
    sid = str(grid_id)
    return {"id": sid, "url": f"/api/feed/media/{sid}", "kind": "video", "content_type": ct, "size": len(raw)}

@api.get("/feed/media/{media_id}")
async def feed_get_media(media_id: str, request: Request):
    try:
        oid = ObjectId(media_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        stream = await fs_bucket.open_download_stream(oid)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    ct = (stream.metadata or {}).get("content_type", "video/mp4")
    total = stream.length

    range_header = request.headers.get("range") or request.headers.get("Range")
    if range_header:
        # Parse "bytes=start-end" or "bytes=start-"
        try:
            units, _, rng = range_header.partition("=")
            if units.strip().lower() != "bytes":
                raise ValueError("unsupported unit")
            start_s, _, end_s = rng.partition("-")
            start = int(start_s) if start_s.strip() else 0
            end = int(end_s) if end_s.strip() else total - 1
            if start < 0 or end >= total or start > end:
                raise ValueError("invalid range")
        except Exception:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{total}"})

        # Cap a single response at ~2 MiB so mobile clients can paginate progressively
        MAX_CHUNK = 2 * 1024 * 1024
        if end - start + 1 > MAX_CHUNK:
            end = start + MAX_CHUNK - 1
        length = end - start + 1

        stream.seek(start)

        async def range_gen(remaining=length):
            chunk_size = 64 * 1024
            while remaining > 0:
                buf = await stream.read(min(chunk_size, remaining))
                if not buf:
                    break
                remaining -= len(buf)
                yield buf

        return StreamingResponse(
            range_gen(),
            status_code=206,
            media_type=ct,
            headers={
                "Content-Range": f"bytes {start}-{end}/{total}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        )

    # No Range header — stream the whole file (original behaviour)
    async def gen():
        while True:
            chunk = await stream.readchunk()
            if not chunk:
                break
            yield chunk
    return StreamingResponse(
        gen(),
        media_type=ct,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Accept-Ranges": "bytes",
            "Content-Length": str(total),
        },
    )

# Posts CRUD (writer = admin or feed_mod)
@api.post("/feed/posts")
async def feed_create_post(body: PostIn, request: Request, x_admin_token: Optional[str] = Header(None)):
    actor = await _check_feed_writer(request, x_admin_token)
    doc = {
        "id": f"POST-{uuid.uuid4().hex[:10]}",
        "image_url": body.image_url,
        "caption": body.caption or "",
        "location": body.location or "",
        "likes_base": int(body.likes_base or 0),
        "views_base": int(body.views_base or 0),
        "pinned": bool(body.pinned),
        "hidden": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": actor.get("by"),
        "created_by_role": actor.get("role"),
    }
    await db.feed_posts.insert_one(doc)
    await _audit(actor, "create_post", doc["id"])
    return await _enrich_feed_item(doc, "post", None)

@api.patch("/feed/posts/{post_id}")
async def feed_update_post(post_id: str, body: Dict[str, Any], request: Request, x_admin_token: Optional[str] = Header(None)):
    actor = await _check_feed_writer(request, x_admin_token)
    body.pop("_id", None); body.pop("id", None); body.pop("created_at", None)
    # mods can't change hidden via PATCH — only via dedicated endpoints
    if actor.get("role") == "feed_mod":
        body.pop("hidden", None); body.pop("hidden_at", None)
    res = await db.feed_posts.update_one({"id": post_id}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    doc = await db.feed_posts.find_one({"id": post_id})
    await _audit(actor, "update_post", post_id, {"keys": list(body.keys())})
    return await _enrich_feed_item(doc, "post", None)

@api.post("/feed/posts/{post_id}/hide")
async def feed_hide_post(post_id: str, request: Request, x_admin_token: Optional[str] = Header(None)):
    actor = await _check_feed_writer(request, x_admin_token)
    res = await db.feed_posts.update_one({"id": post_id}, {"$set": {"hidden": True, "hidden_at": _now_iso(), "hidden_by": actor.get("by")}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    await _audit(actor, "hide_post", post_id)
    return {"ok": True, "id": post_id, "hidden": True}

@api.post("/feed/posts/{post_id}/restore")
async def feed_restore_post(post_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.feed_posts.update_one({"id": post_id}, {"$set": {"hidden": False}, "$unset": {"hidden_at": "", "hidden_by": ""}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True, "id": post_id, "hidden": False}

@api.delete("/feed/posts/{post_id}")
async def feed_delete_post(post_id: str, x_admin_token: Optional[str] = Header(None)):
    # owner only — mods cannot permanently delete
    await _check_admin(x_admin_token)
    await db.feed_posts.delete_one({"id": post_id})
    await db.feed_likes.delete_many({"post_id": post_id})
    await db.feed_comments.delete_many({"post_id": post_id})
    await db.feed_views.delete_many({"post_id": post_id})
    return {"ok": True}

@api.get("/feed/posts")
async def feed_list_posts(request: Request, limit: int = 30, include_hidden: bool = False, x_admin_token: Optional[str] = Header(None)):
    user = await _get_user_from_request(request)
    q: Dict[str, Any] = {}
    can_view_hidden = False
    if include_hidden:
        # only admin or owner/mod can request hidden
        if x_admin_token:
            try: await _check_admin(x_admin_token); can_view_hidden = True
            except HTTPException: pass
        elif user and user.get("role") in ("owner", "feed_mod"):
            can_view_hidden = True
    if not can_view_hidden:
        q["$or"] = [{"hidden": {"$exists": False}}, {"hidden": False}]
    rows = await db.feed_posts.find(q).sort([("pinned", -1), ("created_at", -1)]).to_list(min(max(limit, 1), 100))
    return [await _enrich_feed_item(r, "post", user) for r in rows]

@api.get("/feed/posts/trash")
async def feed_list_trashed_posts(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.feed_posts.find({"hidden": True}).sort("hidden_at", -1).to_list(200)
    return [await _enrich_feed_item(r, "post", None) for r in rows]

@api.get("/feed/posts/{post_id}")
async def feed_get_post(post_id: str, request: Request):
    user = await _get_user_from_request(request)
    doc = await db.feed_posts.find_one({"id": post_id})
    if not doc or (doc.get("hidden") and (not user or user.get("role") not in ("owner", "feed_mod"))):
        raise HTTPException(status_code=404, detail="Post not found")
    return await _enrich_feed_item(doc, "post", user)

# Reels CRUD (writer = admin or feed_mod)
@api.post("/feed/reels")
async def feed_create_reel(body: ReelIn, request: Request, x_admin_token: Optional[str] = Header(None)):
    actor = await _check_feed_writer(request, x_admin_token)
    doc = {
        "id": f"REEL-{uuid.uuid4().hex[:10]}",
        "video_url": body.video_url,
        "thumb_url": body.thumb_url or "",
        "caption": body.caption or "",
        "likes_base": int(body.likes_base or 0),
        "views_base": int(body.views_base or 0),
        "pinned": bool(body.pinned),
        "hidden": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": actor.get("by"),
        "created_by_role": actor.get("role"),
    }
    await db.feed_reels.insert_one(doc)
    await _audit(actor, "create_reel", doc["id"])
    return await _enrich_feed_item(doc, "reel", None)

@api.patch("/feed/reels/{reel_id}")
async def feed_update_reel(reel_id: str, body: Dict[str, Any], request: Request, x_admin_token: Optional[str] = Header(None)):
    actor = await _check_feed_writer(request, x_admin_token)
    body.pop("_id", None); body.pop("id", None); body.pop("created_at", None)
    if actor.get("role") == "feed_mod":
        body.pop("hidden", None); body.pop("hidden_at", None)
    res = await db.feed_reels.update_one({"id": reel_id}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reel not found")
    doc = await db.feed_reels.find_one({"id": reel_id})
    await _audit(actor, "update_reel", reel_id, {"keys": list(body.keys())})
    return await _enrich_feed_item(doc, "reel", None)

@api.post("/feed/reels/{reel_id}/hide")
async def feed_hide_reel(reel_id: str, request: Request, x_admin_token: Optional[str] = Header(None)):
    actor = await _check_feed_writer(request, x_admin_token)
    res = await db.feed_reels.update_one({"id": reel_id}, {"$set": {"hidden": True, "hidden_at": _now_iso(), "hidden_by": actor.get("by")}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reel not found")
    await _audit(actor, "hide_reel", reel_id)
    return {"ok": True, "id": reel_id, "hidden": True}

@api.post("/feed/reels/{reel_id}/restore")
async def feed_restore_reel(reel_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.feed_reels.update_one({"id": reel_id}, {"$set": {"hidden": False}, "$unset": {"hidden_at": "", "hidden_by": ""}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reel not found")
    return {"ok": True, "id": reel_id, "hidden": False}

@api.delete("/feed/reels/{reel_id}")
async def feed_delete_reel(reel_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    await db.feed_reels.delete_one({"id": reel_id})
    await db.feed_likes.delete_many({"reel_id": reel_id})
    await db.feed_comments.delete_many({"reel_id": reel_id})
    await db.feed_views.delete_many({"reel_id": reel_id})
    return {"ok": True}

@api.get("/feed/reels")
async def feed_list_reels(request: Request, limit: int = 30, include_hidden: bool = False, x_admin_token: Optional[str] = Header(None)):
    user = await _get_user_from_request(request)
    q: Dict[str, Any] = {}
    can_view_hidden = False
    if include_hidden:
        if x_admin_token:
            try: await _check_admin(x_admin_token); can_view_hidden = True
            except HTTPException: pass
        elif user and user.get("role") in ("owner", "feed_mod"):
            can_view_hidden = True
    if not can_view_hidden:
        q["$or"] = [{"hidden": {"$exists": False}}, {"hidden": False}]
    rows = await db.feed_reels.find(q).sort([("pinned", -1), ("created_at", -1)]).to_list(min(max(limit, 1), 100))
    return [await _enrich_feed_item(r, "reel", user) for r in rows]

@api.get("/feed/reels/trash")
async def feed_list_trashed_reels(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.feed_reels.find({"hidden": True}).sort("hidden_at", -1).to_list(200)
    return [await _enrich_feed_item(r, "reel", None) for r in rows]

# ---- Team & moderators (owner only) --------------------------------------
@api.get("/admin/team")
async def admin_list_team(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.users.find({"role": {"$in": ["feed_mod", "owner"]}}).to_list(200)
    out = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for u in rows:
        u.pop("_id", None); u.pop("password_hash", None)
        u["today_uploads"] = int((u.get("upload_log") or {}).get(today) or 0)
        out.append(u)
    return out

@api.post("/admin/team")
async def admin_add_team(body: Dict[str, Any] = Body(...), x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    email = (body.get("email") or "").strip().lower()
    role = body.get("role") or "feed_mod"
    if role not in ("feed_mod", "owner"):
        raise HTTPException(status_code=400, detail="role must be feed_mod or owner")
    if not email:
        raise HTTPException(status_code=400, detail="email required")
    u = await db.users.find_one({"email": email})
    upd = {
        "role": role,
        "disabled": False,
        "daily_upload_limit": int(body.get("daily_upload_limit", 10)),
        "max_upload_mb": int(body.get("max_upload_mb", 15)),
    }
    if not u:
        # create stub user with provided password
        pw = body.get("password")
        if not pw or len(pw) < 6:
            raise HTTPException(status_code=400, detail="password (6+ chars) required to create new mod")
        u = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": body.get("name") or email.split("@")[0],
            "password_hash": _hash_pw(pw),
            "createdAt": _now_iso(),
            **upd,
        }
        await db.users.insert_one(u)
    else:
        await db.users.update_one({"user_id": u["user_id"]}, {"$set": upd})
        u = await db.users.find_one({"user_id": u["user_id"]})
    u.pop("_id", None); u.pop("password_hash", None)
    return u

@api.patch("/admin/team/{user_id}")
async def admin_update_team(user_id: str, body: Dict[str, Any] = Body(...), x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    allowed = {}
    for k in ("role", "disabled", "daily_upload_limit", "max_upload_mb", "name"):
        if k in body: allowed[k] = body[k]
    if "role" in allowed and allowed["role"] not in ("feed_mod", "owner", "customer"):
        raise HTTPException(status_code=400, detail="invalid role")
    if "password" in body and body["password"]:
        if len(body["password"]) < 6:
            raise HTTPException(status_code=400, detail="password too short")
        allowed["password_hash"] = _hash_pw(body["password"])
    res = await db.users.update_one({"user_id": user_id}, {"$set": allowed})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="user not found")
    u = await db.users.find_one({"user_id": user_id})
    u.pop("_id", None); u.pop("password_hash", None)
    return u

@api.delete("/admin/team/{user_id}")
async def admin_remove_team(user_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.users.update_one({"user_id": user_id}, {"$set": {"role": "customer", "disabled": False}})
    return {"ok": True, "demoted": res.matched_count}

@api.get("/admin/audit")
async def admin_list_audit(x_admin_token: Optional[str] = Header(None), limit: int = 200):
    await _check_admin(x_admin_token)
    rows = await db.mod_audit_log.find().sort("at", -1).to_list(min(max(limit, 1), 500))
    for r in rows: r.pop("_id", None)
    return rows

# Like / unlike
async def _toggle_like(kind: str, content_id: str, user: Dict[str, Any]):
    id_key = "post_id" if kind == "post" else "reel_id"
    coll = db.feed_posts if kind == "post" else db.feed_reels
    if not await coll.find_one({"id": content_id}):
        raise HTTPException(status_code=404, detail="Not found")
    existing = await db.feed_likes.find_one({id_key: content_id, "user_id": user["user_id"]})
    if existing:
        await db.feed_likes.delete_one({"_id": existing["_id"]})
        liked = False
    else:
        await db.feed_likes.insert_one({id_key: content_id, "user_id": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()})
        liked = True
    base = (await coll.find_one({"id": content_id})).get("likes_base", 0) or 0
    total = base + await db.feed_likes.count_documents({id_key: content_id})
    return {"liked": liked, "likes_count": total}

@api.post("/feed/posts/{post_id}/like")
async def feed_post_like(post_id: str, request: Request):
    user = await require_user(request)
    return await _toggle_like("post", post_id, user)

@api.post("/feed/reels/{reel_id}/like")
async def feed_reel_like(reel_id: str, request: Request):
    user = await require_user(request)
    return await _toggle_like("reel", reel_id, user)

# Views (anonymous, deduped per session_id supplied by client)
@api.post("/feed/posts/{post_id}/view")
async def feed_post_view(post_id: str, body: Dict[str, Any]):
    sess = (body or {}).get("session_id", "")
    if not sess:
        raise HTTPException(status_code=400, detail="session_id required")
    try:
        await db.feed_views.update_one({"post_id": post_id, "session_id": sess}, {"$setOnInsert": {"post_id": post_id, "session_id": sess, "created_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    except Exception:
        pass
    doc = await db.feed_posts.find_one({"id": post_id})
    if not doc:
        return {"views_count": 0}
    total = (doc.get("views_base", 0) or 0) + await db.feed_views.count_documents({"post_id": post_id})
    return {"views_count": total}

@api.post("/feed/reels/{reel_id}/view")
async def feed_reel_view(reel_id: str, body: Dict[str, Any]):
    sess = (body or {}).get("session_id", "")
    if not sess:
        raise HTTPException(status_code=400, detail="session_id required")
    try:
        await db.feed_views.update_one({"reel_id": reel_id, "session_id": sess}, {"$setOnInsert": {"reel_id": reel_id, "session_id": sess, "created_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    except Exception:
        pass
    doc = await db.feed_reels.find_one({"id": reel_id})
    if not doc:
        return {"views_count": 0}
    total = (doc.get("views_base", 0) or 0) + await db.feed_views.count_documents({"reel_id": reel_id})
    return {"views_count": total}

# Comments
async def _comment_doc_clean(c):
    c.pop("_id", None)
    return c

@api.get("/feed/posts/{post_id}/comments")
async def feed_post_comments(post_id: str):
    rows = await db.feed_comments.find({"post_id": post_id}).sort("created_at", 1).to_list(500)
    return [_comment_doc_clean(r) for r in rows]

@api.get("/feed/reels/{reel_id}/comments")
async def feed_reel_comments(reel_id: str):
    rows = await db.feed_comments.find({"reel_id": reel_id}).sort("created_at", 1).to_list(500)
    return [_comment_doc_clean(r) for r in rows]

@api.post("/feed/posts/{post_id}/comments")
async def feed_post_add_comment(post_id: str, body: CommentIn, request: Request):
    user = await require_user(request)
    if not await db.feed_posts.find_one({"id": post_id}):
        raise HTTPException(status_code=404, detail="Post not found")
    doc = {
        "id": f"CMT-{uuid.uuid4().hex[:10]}",
        "post_id": post_id,
        "user_id": user["user_id"],
        "user_name": user.get("name") or user.get("email", "anon").split("@")[0],
        "picture": user.get("picture") or "",
        "text": body.text.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feed_comments.insert_one(doc)
    return _comment_doc_clean(doc)

@api.post("/feed/reels/{reel_id}/comments")
async def feed_reel_add_comment(reel_id: str, body: CommentIn, request: Request):
    user = await require_user(request)
    if not await db.feed_reels.find_one({"id": reel_id}):
        raise HTTPException(status_code=404, detail="Reel not found")
    doc = {
        "id": f"CMT-{uuid.uuid4().hex[:10]}",
        "reel_id": reel_id,
        "user_id": user["user_id"],
        "user_name": user.get("name") or user.get("email", "anon").split("@")[0],
        "picture": user.get("picture") or "",
        "text": body.text.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feed_comments.insert_one(doc)
    return _comment_doc_clean(doc)

@api.post("/feed/comments/admin")
async def feed_add_admin_comment(body: AdminCommentIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    if not body.post_id and not body.reel_id:
        raise HTTPException(status_code=400, detail="post_id or reel_id required")
    doc = {
        "id": f"CMT-{uuid.uuid4().hex[:10]}",
        "user_id": None,
        "user_name": body.user_name,
        "picture": body.picture or "",
        "text": body.text.strip(),
        "is_admin_seed": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.post_id: doc["post_id"] = body.post_id
    if body.reel_id: doc["reel_id"] = body.reel_id
    await db.feed_comments.insert_one(doc)
    return _comment_doc_clean(doc)

@api.delete("/feed/comments/{comment_id}")
async def feed_delete_comment(comment_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    await db.feed_comments.delete_one({"id": comment_id})
    return {"ok": True}

@api.get("/admin/users")
async def list_users(x_admin_token: Optional[str] = Header(None), limit: int = 500):
    await _check_admin(x_admin_token)
    rows = await db.users.find().sort("created_at", -1).to_list(min(max(limit, 1), 2000))
    out = []
    for u in rows:
        u.pop("_id", None); u.pop("password_hash", None)
        u["orders_count"] = await db.orders.count_documents({"user_id": u.get("user_id")})
        out.append(u)
    return out

@api.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    await db.users.delete_one({"user_id": user_id})
    return {"ok": True}

# ---- Referrals -------------------------------------------------------------
DEFAULT_REFERRAL_SETTINGS = {
    "enabled": True,
    "signup_reward": 50.0,
    "order_percent": 10.0,
    "min_payout": 500.0,
    "currency_symbol": "₹",
    "description": "Invite friends. Earn ₹50 when they sign up + 10% on their first order.",
}

async def _ensure_referral_settings():
    doc = await db.referral_settings.find_one({"_id": "main"})
    if not doc:
        await db.referral_settings.insert_one({"_id": "main", **DEFAULT_REFERRAL_SETTINGS})
        doc = await db.referral_settings.find_one({"_id": "main"})
    return doc

@api.get("/referrals/settings")
async def referrals_settings():
    doc = await _ensure_referral_settings()
    return _clean(doc)

@api.put("/referrals/settings")
async def referrals_put_settings(body: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    body.pop("_id", None)
    await db.referral_settings.update_one({"_id": "main"}, {"$set": body}, upsert=True)
    doc = await db.referral_settings.find_one({"_id": "main"})
    return _clean(doc)

@api.get("/me/referrals")
async def my_referrals(request: Request):
    user = await require_user(request)
    rows = await db.referrals.find({"inviter_id": user["user_id"]}).sort("created_at", -1).to_list(500)
    for r in rows: r.pop("_id", None)
    invited_users = await db.users.find({"referred_by": user["user_id"]}, {"_id": 0, "email": 1, "name": 1, "created_at": 1, "user_id": 1}).sort("created_at", -1).to_list(500)
    total = sum(r.get("amount", 0) for r in rows)
    return {
        "referral_code": user.get("referral_code"),
        "credit_balance": user.get("credit_balance", 0.0),
        "total_earned": total,
        "invited_count": len(invited_users),
        "invited": invited_users,
        "history": rows,
    }

@api.get("/admin/referrals")
async def admin_referrals(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.referrals.find().sort("created_at", -1).to_list(1000)
    for r in rows: r.pop("_id", None)
    return rows

# ---- Payment Settings & Intents -------------------------------------------
DEFAULT_PAYMENT_SETTINGS = {
    "manual_enabled": True,
    "upi_id": "errorhacker@upi",
    "upi_name": "ERRORHACKER",
    "bank_details": "",
    "qr_image_url": "",
    "instructions": "After payment, upload your transaction screenshot below. Order is confirmed once verified (usually within 30 min).",
    "crypto_enabled": True,
    "crypto_wallets": [
        {"coin": "BTC", "network": "Bitcoin", "address": "bc1qexamplebtcaddresshere0000000000000", "qr_url": ""},
        {"coin": "USDT", "network": "TRC20 (Tron)", "address": "TExampleUsdtAddressHere000000000000", "qr_url": ""},
    ],
    "currencies": [
        {"code": "INR", "symbol": "₹", "rate": 1.0},
        {"code": "USD", "symbol": "$", "rate": 0.012},
    ],
    "default_currency": "INR",
}

async def _ensure_payment_settings():
    doc = await db.payment_settings.find_one({"_id": "main"})
    if not doc:
        await db.payment_settings.insert_one({"_id": "main", **DEFAULT_PAYMENT_SETTINGS, "updated_at": datetime.utcnow().isoformat()})
        doc = await db.payment_settings.find_one({"_id": "main"})
    return doc

@api.get("/payments/settings")
async def get_payment_settings():
    doc = await _ensure_payment_settings()
    return _clean(doc)

@api.put("/payments/settings")
async def put_payment_settings(body: PaymentSettingsIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    data = body.dict(exclude_none=True)
    data["updated_at"] = datetime.utcnow().isoformat()
    await db.payment_settings.update_one({"_id": "main"}, {"$set": data}, upsert=True)
    doc = await db.payment_settings.find_one({"_id": "main"})
    return _clean(doc)

@api.post("/payments/proof")
async def submit_payment_proof(body: PaymentProofIn):
    # Public: customers submit proof against their order
    order = await db.orders.find_one({"id": body.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    update = {
        "payment_method": body.method,
        "payment_coin": body.coin or "",
        "payment_tx_reference": body.tx_reference or "",
        "payment_proof_url": body.proof_url or "",
        "payment_amount": float(body.amount or 0),
        "payment_currency": body.currency or "INR",
        "payment_submitted_at": datetime.utcnow().isoformat(),
        "status": "payment_review",
    }
    await db.orders.update_one({"id": body.order_id}, {"$set": update})
    # Telegram notify
    async def _notify():
        try:
            cfg = await _ensure_config()
            notif = (cfg.get("notifications") or {}).get("telegram") or {}
            if notif.get("enabled"):
                msg = (
                    "<b>PAYMENT SUBMITTED // ERRORHACKER</b>\n"
                    f"<b>Order:</b> {body.order_id}\n"
                    f"<b>Method:</b> {body.method} {body.coin or ''}\n"
                    f"<b>Amount:</b> {body.amount} {body.currency}\n"
                    f"<b>Ref:</b> {body.tx_reference}\n"
                    f"<b>Proof:</b> {body.proof_url or '—'}"
                )
                await _telegram_send(notif.get("bot_token", ""), notif.get("chat_id", ""), msg)
        except Exception as e:
            log.warning("payment notify failed: %s", e)
    asyncio.create_task(_notify())
    updated = await db.orders.find_one({"id": body.order_id})
    return _clean(updated)

# --------------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await _ensure_config()
    await _ensure_admin()
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.coupons.create_index("code", unique=True)
        await db.orders.create_index("user_id")
        await db.feed_posts.create_index("id", unique=True)
        await db.feed_reels.create_index("id", unique=True)
        await db.feed_comments.create_index("id", unique=True)
        await db.feed_comments.create_index("post_id")
        await db.feed_comments.create_index("reel_id")
        await db.feed_likes.create_index([("post_id", 1), ("user_id", 1)])
        await db.feed_likes.create_index([("reel_id", 1), ("user_id", 1)])
        await db.feed_views.create_index([("post_id", 1), ("session_id", 1)], unique=False)
        await db.feed_views.create_index([("reel_id", 1), ("session_id", 1)], unique=False)
    except Exception as e:
        log.warning("index create warn: %s", e)
    log.info("ERRORHACKER API ready")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
