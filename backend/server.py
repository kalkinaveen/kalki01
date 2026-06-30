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
from fastapi.responses import Response as FastResponse, StreamingResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
import os, uuid, logging, base64, asyncio, secrets, io, random
import httpx, bcrypt, jwt
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr

from defaults import DEFAULT_CONFIG
from email_service import (
    notify_case_received,
    notify_case_status,
    notify_quote_sent,
    notify_order_status,
    notify_wallet_credited,
    send_wallet_receipt_email,
    send_order_receipt_email,
)

# --------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
fs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="feed_media")

from contextlib import asynccontextmanager

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGO = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days


@asynccontextmanager
async def lifespan(_app):
    """App startup / shutdown — replaces the deprecated @app.on_event handlers.

    Body forward-references `_ensure_config`, `_ensure_admin`, `db`, `client`
    which are defined later in this module; Python resolves them at call time,
    by which point the module is fully loaded.
    """
    # ---- startup ----
    try:
        await _ensure_config()
        await _ensure_admin()
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
        # Log but don't block startup — duplicate-index errors are fine on hot reload.
        logging.getLogger("eh").warning("startup init warn: %s", e)
    logging.getLogger("eh").info("ERRORHACKER API ready")

    # Background SMM status poller — every 5 min, refresh any orders that
    # are placed-on-panel but not yet `Completed`. Wrapped so a single
    # failure doesn't kill the loop.
    async def _smm_poll_loop():
        from smm_service import get_config as _scfg, poll_order_status as _spoll, refresh_balance as _sbal
        import asyncio as _asyncio
        while True:
            try:
                cfg = await _scfg(db)
                if cfg.get("enabled") and cfg.get("api_key"):
                    cursor = db.orders.find({
                        "smm_panel_order_id": {"$exists": True, "$ne": None},
                        "smm_status": {"$nin": ["Completed", "Canceled", "Cancelled"]},
                    })
                    rows = await cursor.to_list(200)
                    for row in rows:
                        row.pop("_id", None)
                        try:
                            await _spoll(db, row)
                        except Exception as e:
                            logging.getLogger("smm").warning("poll %s err: %s", row.get("id"), e)
                    # Refresh wallet balance once per loop (cheap, surfaces low-balance alerts)
                    try: await _sbal(db)
                    except Exception: pass
            except Exception as e:
                logging.getLogger("smm").warning("smm poll loop err: %s", e)
            await _asyncio.sleep(300)

    smm_task = asyncio.create_task(_smm_poll_loop())

    yield  # ---- app runs ----

    # ---- shutdown ----
    try:
        smm_task.cancel()
    except Exception:
        pass
    try:
        client.close()
    except Exception:
        pass


app = FastAPI(title="ERRORHACKER API", lifespan=lifespan)
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
    # Optional pricing — cart sends these so PaymentBox doesn't lock as "awaiting quote".
    # Admin-quoted services (recovery, custom work) omit them and the team sets the amount later.
    amount: Optional[float] = None
    currency: Optional[str] = "INR"

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

class RecoveryPaymentIn(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "INR"
    note: Optional[str] = ""

class OrderQuoteIn(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "INR"
    note: Optional[str] = ""

class DirectRefundIn(BaseModel):
    tracking_id: str  # ORD-, REC-, RFD-, or wallet TXN-
    amount: float = Field(gt=0)
    reason: Optional[str] = ""
    method: Optional[str] = "wallet"  # wallet | upi | crypto | manual

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
    media_urls: List[Dict[str, Any]] = []  # [{ url, kind: 'image'|'video', content_type }]
    case_id: Optional[str] = ""
    email: Optional[str] = ""

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

# ---- Wallet models ----
class WalletAdjustIn(BaseModel):
    amount: float = Field(gt=0)
    note: Optional[str] = ""
    type: str = Field(default="credit", pattern="^(credit|debit)$")

class WalletDepositRequestIn(BaseModel):
    amount: float = Field(gt=0)
    method: str = Field(default="manual", pattern="^(manual|crypto)$")
    coin: Optional[str] = ""
    tx_reference: Optional[str] = ""
    proof_url: Optional[str] = ""

class SpinWheelSpinIn(BaseModel):
    pass

# ---- Chat models ----
class ChatIn(BaseModel):
    session_id: str
    message: str

# ---- AI Tools (Hub) ----
class ToolsAppealIn(BaseModel):
    platform: str = "Instagram"
    violation_reason: str  # e.g. "Community Guidelines", "Impersonation", "Spam"
    account_handle: Optional[str] = ""
    account_age: Optional[str] = ""      # e.g. "3 years"
    followers: Optional[str] = ""        # e.g. "12k"
    backstory: Optional[str] = ""        # 1-3 sentences user provides
    tone: Optional[str] = "polite"       # polite | formal | emotional
    language: Optional[str] = "english"

class ToolsFaqIn(BaseModel):
    session_id: str
    message: str

class ToolsBreachIn(BaseModel):
    email: EmailStr

class ToolsOddsIn(BaseModel):
    platform: str               # instagram | facebook | tiktok | snapchat | twitter
    issue: str                  # hacked | disabled | locked_2fa | forgot_password | impersonation | shadowban
    when: str                   # today | week | month | older
    has_email: bool = True
    has_phone: bool = True
    has_id: bool = True         # has government ID for verification

class ToolsPhishingIn(BaseModel):
    message: str                # the suspicious DM / SMS / email body
    channel: Optional[str] = "DM"  # DM | SMS | Email | Comment

class ToolsAccountWorthIn(BaseModel):
    platform: str = "Instagram"
    niche: str                  # fitness | fashion | food | tech | finance | travel | gaming | beauty | meme | other
    followers: int
    avg_likes: int = 0
    avg_comments: int = 0
    country_tier: Optional[str] = "tier2"  # tier1 (US/UK/EU/CA/AU) | tier2 (IN/BR/MX) | tier3 (others)
    verified: bool = False

class ToolsSelfieIn(BaseModel):
    lighting: str               # bright | dim | mixed
    background: str             # plain | busy | unsafe
    holding_id: bool = True
    matches_profile: bool = True

class AnnouncementIn(BaseModel):
    title: str
    body: str
    link: Optional[str] = ""           # e.g. /tools/breach
    tool_id: Optional[str] = ""        # if announcing a tool, e.g. "breach"
    send_telegram: bool = True
    send_email: bool = True
    audience: Optional[str] = "all"    # all | wallet | paying

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
    # Recovery: merge in any new platforms / services from defaults (keyed by 'key' / 'id')
    # so existing deployments pick up newly-added recovery options without losing customisations.
    try:
        default_rec = DEFAULT_CONFIG.get("recovery", {})
        cur_rec = doc.get("recovery") or {}
        cur_platforms = cur_rec.get("platforms") or []
        cur_services = cur_rec.get("services") or []
        new_rec = dict(cur_rec)
        plat_changed = False
        seen_keys = {p.get("key") for p in cur_platforms if p.get("key")}
        for p in default_rec.get("platforms", []):
            if p.get("key") and p["key"] not in seen_keys:
                cur_platforms.append(p)
                plat_changed = True
        svc_changed = False
        seen_ids = {s.get("id") for s in cur_services if s.get("id")}
        for s in default_rec.get("services", []):
            if s.get("id") and s["id"] not in seen_ids:
                cur_services.append(s)
                svc_changed = True
        if plat_changed:
            new_rec["platforms"] = cur_platforms
        if svc_changed:
            new_rec["services"] = cur_services
        if plat_changed or svc_changed:
            updates["recovery"] = new_rec
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

# ---- Telegram Bot (inbound/customer-facing) --------------------------------
async def _tg_call(bot_token: str, method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not bot_token:
        return {"ok": False, "error": "no_bot_token"}
    url = f"https://api.telegram.org/bot{bot_token}/{method}"
    async with httpx.AsyncClient(timeout=10) as cx:
        try:
            r = await cx.post(url, json=payload)
            return r.json()
        except Exception as e:
            return {"ok": False, "error": str(e)}

async def _tg_send(bot_token: str, chat_id: Any, text: str, reply_markup: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return await _tg_call(bot_token, "sendMessage", payload)

async def _get_bot_token() -> str:
    cfg = await _ensure_config()
    notif = (cfg.get("notifications") or {}).get("telegram") or {}
    return notif.get("bot_token", "") or ""

DEFAULT_BOT_CFG: Dict[str, Any] = {
    "enabled": False,
    "username": "",
    "webhook_secret": "",
    "webhook_url": "",
    "welcome_message": (
        "⚡ <b>ERRORHACKER · OPS</b>\n"
        "<i>secure ops channel · errorhacker.site</i>\n"
        "━━━━━━━━━━━━━━━\n\n"
        "Track cases, pull payment info and start a new recovery — right here. No login needed.\n\n"
        "<b>▸ Have an ID?</b>  Paste it and I'll fetch the live status instantly\n"
        "    <code>REC-XXXXXXXX</code>  ·  <code>ORD-XXXXXXXX</code>\n\n"
        "<b>▸ Quick commands</b>\n"
        "    <code>/menu</code>  open the full console\n"
        "    <code>/track</code>  live status\n"
        "    <code>/pay</code>  payment details\n"
        "    <code>/recover</code>  start a case\n"
        "    <code>/help</code>  ops cheat-sheet"
    ),
    "commands": {"track": True, "orders": True, "pay": True, "recover": True, "help": True},
    # NEW: chat IDs allowed to approve/decline wallet deposits via the bot
    "admin_chat_ids": [],
    # NEW: customizable payment info shown by /pay command + Payment Info menu button.
    # Fully edited from the webpanel. {amount} and {order_id} placeholders auto-substituted.
    "payment_info": {
        "heading": "◆ <b>PAYMENT GATEWAY</b>",
        "intro": "Pay via any method below — wallet credits the moment our team verifies.",
        "upi_id": "errorhacker@upi",
        "upi_name": "ERRORHACKER",
        "crypto_wallets": [
            {"coin": "USDT", "network": "TRC20", "address": "TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"},
        ],
        "instructions": (
            "<b>▸ steps</b>\n"
            "  1.  Send the exact amount to any address above\n"
            "  2.  Copy the UPI Reference / UTR or crypto TXID\n"
            "  3.  Tap <b>I've Paid</b> below to submit proof — verified in 5–30 min"
        ),
        "support_text": "<i>Need help? Reply here or tap Support below.</i>",
        "show_paid_button": True,
        "show_support_button": True,
        "show_quote_button": True,
        "paid_button_label": "✓ I've Paid",
        "support_button_label": "▌ Talk to Support",
        "quote_button_label": "◆ Get Free Quote",
        "support_url": "https://t.me/errorhacker",
        "quote_url": "https://errorhacker.site/recovery",
        "paid_form_url": "https://errorhacker.site/me/wallet",
    },
}

async def _get_bot_cfg() -> Dict[str, Any]:
    cfg = await _ensure_config()
    bot = (cfg.get("telegram_bot") or {}).copy()
    for k, v in DEFAULT_BOT_CFG.items():
        if k not in bot:
            bot[k] = v
    return bot

async def _save_bot_cfg(updates: Dict[str, Any]) -> Dict[str, Any]:
    bot = await _get_bot_cfg()
    bot.update(updates)
    await db.site_config.update_one({"_id": "main"}, {"$set": {"telegram_bot": bot, "updated_at": _now_iso()}})
    return bot

def _bot_main_keyboard(bot_username: str = "", enabled: Optional[Dict[str, bool]] = None) -> Dict[str, Any]:
    """Welcome / menu inline keyboard."""
    enabled = enabled or {"track": True, "orders": True, "pay": True, "recover": True, "help": True}
    rows = []
    if enabled.get("track"):
        rows.append([{"text": "▸  Track Case / Order", "callback_data": "menu_track"}])
    if enabled.get("pay"):
        rows.append([{"text": "◆  Payment Gateway", "callback_data": "menu_pay"}])
    if enabled.get("recover"):
        rows.append([{"text": "⬢  Start New Recovery", "url": "https://errorhacker.site/recovery"}])
    if enabled.get("orders"):
        rows.append([{"text": "▰  Live Alerts (optional)", "callback_data": "menu_orders"}])
    if enabled.get("help"):
        rows.append([{"text": "?  Help & Commands", "callback_data": "menu_help"}])
    return {"inline_keyboard": rows}

def _status_emoji(s: str) -> str:
    return {
        "received": "📥", "verified": "✅", "in-progress": "⚙️", "delivered": "🎯", "paid": "💰",
        "payment_review": "🕵️", "new": "🆕", "reviewing": "🔎", "engaged": "🤝",
        "recovering": "⚙️", "recovered": "🎉", "closed": "🔒", "rejected": "⛔",
    }.get((s or "").lower(), "•")

async def _fmt_order(order_id: str) -> Optional[str]:
    o = await db.orders.find_one({"id": order_id})
    if not o:
        return None
    lines = [
        f"<b>ORDER</b> <code>{o['id']}</code>",
        f"{_status_emoji(o.get('status', ''))} <b>{(o.get('status') or 'received').upper()}</b>",
        f"<b>Service:</b> {o.get('serviceName') or o.get('service') or '—'}",
    ]
    if o.get("amount"):
        sym = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}.get(o.get("currency", "INR"), "")
        lines.append(f"<b>Amount:</b> {sym}{o.get('amount')} {o.get('currency', '')}")
    if o.get("size"):
        lines.append(f"<b>Size:</b> {o['size']}")
    if o.get("target"):
        lines.append(f"<b>Target:</b> {o['target'][:80]}")
    if o.get("case_id"):
        lines.append(f"🔗 Linked recovery case: <code>{o['case_id']}</code>")
    return "\n".join(lines)

async def _fmt_case(case_id: str) -> Optional[str]:
    c = await db.recovery_cases.find_one({"id": case_id})
    if not c:
        return None
    lines = [
        f"<b>RECOVERY CASE</b> <code>{c['id']}</code>",
        f"{_status_emoji(c.get('status', ''))} <b>{(c.get('status') or 'new').upper()}</b>",
        f"<b>Service:</b> {c.get('service_name') or c.get('issue') or '—'}",
        f"<b>Platform:</b> {(c.get('platform') or '—').upper()}",
        f"<b>Urgency:</b> {(c.get('urgency') or 'medium').upper()}",
    ]
    if c.get("final_amount"):
        sym = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}.get(c.get("final_currency", "INR"), "")
        lines.append(f"💳 <b>Quote:</b> {sym}{c.get('final_amount')} {c.get('final_currency', '')}")
    elif c.get("estimated_price"):
        lines.append(f"💡 <b>Estimate:</b> ₹{c.get('estimated_price')}")
    if c.get("admin_note"):
        lines.append(f"\n📝 <i>{c['admin_note']}</i>")
    if c.get("linked_order_id"):
        lines.append(f"🔗 Linked order: <code>{c['linked_order_id']}</code>")
    return "\n".join(lines)

async def _send_welcome(bot_token: str, chat_id: int, bot_cfg: Optional[Dict[str, Any]] = None):
    """Single unified welcome card: header text + full 12-tile module grid (no second 'tap a button' bubble)."""
    bot_cfg = bot_cfg or await _get_bot_cfg()
    text = bot_cfg.get("welcome_message") or DEFAULT_BOT_CFG["welcome_message"]
    if "▸ MODULES" not in text:
        text = text + "\n\n<b>▸ MODULES</b>   tap any tile below"
    await _tg_send(bot_token, chat_id, text, _main_menu_kb())

async def _send_help(bot_token: str, chat_id: int):
    text = (
        "? <b>OPS CHEAT-SHEET</b>\n"
        "━━━━━━━━━━━━━━━\n\n"
        "<b>▸ Track a case</b>\n"
        "    Paste your ID — e.g. <code>REC-AB12CD3456</code> or <code>ORD-XYZ123</code>\n"
        "    or use:  <code>/track YOUR_ID</code>\n\n"
        "<b>◆ Payment info</b>\n"
        "    <code>/pay YOUR_ID</code>  — UPI / crypto details\n\n"
        "<b>⬢ Start a recovery</b>\n"
        "    <code>/recover</code>  — opens our secure web wizard\n\n"
        "<b>▰ Auto-DM alerts (optional)</b>\n"
        "    Want pings the moment status changes? Visit <a href=\"https://errorhacker.site/me\">/me</a> → <i>Connect Telegram</i>. Otherwise just chat — no login required."
    )
    await _tg_send(bot_token, chat_id, text)

async def _send_recover(bot_token: str, chat_id: int):
    text = (
        "⬢ <b>ACCOUNT RECOVERY</b>\n"
        "━━━━━━━━━━━━━━━\n\n"
        "Use our secure web wizard for the full 3-step intake (proofs upload, secure quote, Telegram updates).\n\n"
        "Tap the button below to open it."
    )
    await _tg_send(bot_token, chat_id, text, {"inline_keyboard": [[{"text": "⚡  Open Recovery Wizard", "url": "https://errorhacker.site/recovery"}]]})

async def _handle_track(bot_token: str, chat_id: int, raw_id: str):
    rid = (raw_id or "").strip().upper()
    if not rid:
        await _tg_send(bot_token, chat_id,
                       "▸ Send an ID like <code>/track ORD-XXXXXXXX</code> or <code>/track REC-XXXXXXXX</code>.")
        return
    if rid.startswith("REC-"):
        text = await _fmt_case(rid)
    else:
        text = await _fmt_order(rid)
    if not text:
        await _tg_send(bot_token, chat_id, f"✕ No order or recovery case found with ID <code>{rid}</code>.")
        return
    kb = {"inline_keyboard": [[{"text": "⟶  Open Live Tracker", "url": f"https://errorhacker.site/track?id={rid}"}]]}
    await _tg_send(bot_token, chat_id, text, kb)

async def _handle_orders(bot_token: str, chat_id: int):
    user = await db.users.find_one({"telegram_chat_id": chat_id})
    if not user:
        await _tg_send(bot_token, chat_id,
                       "▸ <b>No login needed to track an order</b>\n\n"
                       "Just paste your <b>ORD-XXXXXXXX</b> ID (or <b>REC-XXXXXXXX</b> for recovery) here and I'll show the live status instantly.\n\n"
                       "<i>For a list of <b>all</b> your orders or auto-DM alerts, that's optional — visit <a href=\"https://errorhacker.site/me\">errorhacker.site/me</a> → Connect Telegram. 5 sec, no password.</i>")
        return
    rows = await db.orders.find({"user_id": user.get("user_id")}).sort("createdAt", -1).to_list(10)
    if not rows:
        await _tg_send(bot_token, chat_id, "▸ No orders yet. Open the shop at errorhacker.site.")
        return
    lines = ["▸ <b>YOUR LATEST ORDERS</b>\n━━━━━━━━━━━━━━━"]
    buttons = []
    for o in rows[:8]:
        lines.append(f"{_status_emoji(o.get('status', ''))} <code>{o['id']}</code> · {(o.get('serviceName') or o.get('service') or '—')[:40]} · <b>{(o.get('status') or 'received').upper()}</b>")
        buttons.append([{"text": f"▸  {o['id']}", "callback_data": f"track_{o['id']}"}])
    await _tg_send(bot_token, chat_id, "\n".join(lines), {"inline_keyboard": buttons})

async def _handle_pay(bot_token: str, chat_id: int, order_id: str = ""):
    """Render the payment info screen. Uses the FULLY CUSTOMIZABLE payment_info block
    from `telegram_bot.payment_info` (managed in the admin webpanel).
    Falls back to the global site payments config for legacy installations.
    """
    bot_cfg = await _get_bot_cfg()
    pinfo = (bot_cfg.get("payment_info") or {})
    cfg = await _ensure_config()
    legacy_pay = (cfg.get("payments") or {})

    # Lookup order context if user supplied an ID
    order_text = None
    amount_hint = ""
    if order_id:
        order_text = await _fmt_order(order_id)
        try:
            ord_doc = await db.orders.find_one({"id": order_id})
            if ord_doc and ord_doc.get("amount"):
                amount_hint = f"₹{ord_doc['amount']}"
        except Exception:
            pass

    lines = []
    lines.append(pinfo.get("heading") or "◆ <b>PAYMENT GATEWAY</b>")
    lines.append("━━━━━━━━━━━━━━━")
    if pinfo.get("intro"):
        lines.append("")
        lines.append(pinfo["intro"])
    if order_text:
        lines.append("")
        lines.append(order_text)
    # UPI block
    upi_id = pinfo.get("upi_id") or legacy_pay.get("upi_id")
    if upi_id:
        lines.append("")
        lines.append(f"<b>▸ UPI</b>   <code>{upi_id}</code>")
        nm = pinfo.get("upi_name") or legacy_pay.get("upi_name")
        if nm:
            lines.append(f"     <i>{nm}</i>")
    # Crypto block
    cw = pinfo.get("crypto_wallets") or legacy_pay.get("crypto_wallets") or []
    if cw:
        lines.append("")
        lines.append("<b>▸ CRYPTO</b>")
        for w in cw[:6]:
            net = f" · {w.get('network')}" if w.get("network") else ""
            lines.append(f"   <b>{w.get('coin')}</b>{net}\n   <code>{w.get('address')}</code>")
    # Instructions (with {amount} / {order_id} placeholders)
    instr = (pinfo.get("instructions") or legacy_pay.get("instructions") or "")
    if instr:
        instr = instr.replace("{amount}", amount_hint or "your amount").replace("{order_id}", order_id or "your order")
        lines.append("")
        lines.append(f"<i>{instr}</i>")
    if pinfo.get("support_text"):
        lines.append("")
        lines.append(pinfo["support_text"])

    # Inline keyboard built from configurable buttons
    kb_rows: List[List[Dict[str, str]]] = []
    if pinfo.get("show_paid_button", True):
        paid_url = pinfo.get("paid_form_url") or "https://errorhacker.site/me/wallet"
        if order_id:
            paid_url = f"https://errorhacker.site/track?id={order_id}"
        kb_rows.append([{"text": pinfo.get("paid_button_label", "✅ I've Paid"), "url": paid_url}])
    if pinfo.get("show_quote_button", True) and pinfo.get("quote_url"):
        kb_rows.append([{"text": pinfo.get("quote_button_label", "💎 Get Free Quote"), "url": pinfo["quote_url"]}])
    if pinfo.get("show_support_button", True) and pinfo.get("support_url"):
        kb_rows.append([{"text": pinfo.get("support_button_label", "💬 Talk to Support"), "url": pinfo["support_url"]}])
    kb_rows.append([{"text": "❮  Main Menu", "callback_data": "menu_main"}])

    await _tg_send(bot_token, chat_id, "\n".join(lines), {"inline_keyboard": kb_rows})


# ====== Admin notifications + Approve/Decline (deposits) ===================
def _is_tg_admin(bot_cfg: Dict[str, Any], chat_id: int) -> bool:
    raw = bot_cfg.get("admin_chat_ids") or []
    try:
        return int(chat_id) in [int(x) for x in raw if x]
    except Exception:
        return False

async def _notify_admins_deposit_pending(deposit: Dict[str, Any]):
    """DM every admin chat with the deposit details + Approve/Decline buttons."""
    try:
        bot_token = await _get_bot_token()
        if not bot_token:
            return
        bot_cfg = await _get_bot_cfg()
        admin_ids = bot_cfg.get("admin_chat_ids") or []
        if not admin_ids:
            return
        user = await db.users.find_one({"user_id": deposit.get("user_id")}) or {}
        coin_line = ""
        if deposit.get("method") == "crypto":
            coin_line = f" · {deposit.get('coin', '')}"
        text = (
            f"⚡ <b>NEW DEPOSIT · review needed</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"<b>▸ User</b>     {user.get('email', '—')}\n"
            f"<b>▸ User ID</b>  <code>{deposit.get('user_id', '')}</code>\n"
            f"<b>▸ Amount</b>   <b>₹{deposit.get('amount', 0)}</b>\n"
            f"<b>▸ Method</b>   {(deposit.get('method') or 'manual').upper()}{coin_line}\n"
            f"<b>▸ Ref</b>      <code>{deposit.get('tx_reference') or '—'}</code>\n"
            f"<b>▸ Time</b>     {deposit.get('createdAt', '—')[:19].replace('T', ' ')}"
        )
        dep_id = deposit.get("id")
        kb = {"inline_keyboard": [[
            {"text": "✓ Approve & Credit", "callback_data": f"dep_approve_{dep_id}"},
            {"text": "✕ Decline",          "callback_data": f"dep_decline_{dep_id}"},
        ]]}
        for cid in admin_ids:
            try:
                await _tg_send(bot_token, int(cid), text, kb)
            except Exception as e:
                log.warning("notify_admin failed for %s: %s", cid, e)
    except Exception as e:
        log.error("notify_admins_deposit_pending failed: %s", e)


async def _approve_deposit_internal(deposit_id: str) -> Dict[str, Any]:
    """Shared approval logic — used by both the web admin endpoint AND the TG callback.
    Uses the existing `_wallet_txn` flow so the wallet ledger stays consistent."""
    dep = await db.wallet_deposits.find_one({"id": deposit_id})
    if not dep:
        return {"ok": False, "error": "Deposit not found"}
    if dep.get("status") == "approved":
        return {"ok": False, "error": "Already approved", "deposit": _clean(dep)}
    if dep.get("status") == "rejected":
        return {"ok": False, "error": "Already rejected", "deposit": _clean(dep)}
    amount = float(dep.get("amount") or 0)
    user_id = dep.get("user_id")
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        return {"ok": False, "error": "User not found"}

    await _wallet_txn(
        user_id, "credit", amount,
        note=f"Deposit approved · {dep.get('method', 'manual')} {dep.get('tx_reference', '') or ''}".strip(),
        ref={"deposit_id": deposit_id, "tx_reference": dep.get("tx_reference", ""), "method": dep.get("method", "manual")},
    )
    # fetch the just-created txn to send a clean receipt
    last_txn = await db.wallet_txns.find_one(
        {"user_id": user_id, "ref.deposit_id": deposit_id},
        sort=[("createdAt", -1)],
    )
    await db.wallet_deposits.update_one(
        {"id": deposit_id},
        {"$set": {"status": "approved", "approved_at": _now_iso()}},
    )
    wallet = await db.wallets.find_one({"user_id": user_id}) or {}
    new_balance = float(wallet.get("balance") or 0)

    if user.get("email"):
        try:
            asyncio.create_task(notify_wallet_credited(
                user["email"], user.get("name", ""), amount, new_balance,
            ))
            if last_txn:
                asyncio.create_task(send_wallet_receipt_email(
                    user["email"], user.get("name", ""), _clean(last_txn), new_balance,
                ))
        except Exception as e:
            log.warning("notify_wallet_credited dispatch failed: %s", e)
    user_chat = user.get("telegram_chat_id")
    if user_chat:
        try:
            tok = await _get_bot_token()
            if tok:
                await _tg_send(tok, int(user_chat),
                    f"✓ <b>Deposit approved</b>\n"
                    f"━━━━━━━━━━━━━━━\n\n"
                    f"<b>+₹{amount:,.0f}</b> credited to your wallet\n"
                    f"New balance · <b>₹{new_balance:,.2f}</b>\n\n"
                    f"<i>Tx Ref: {dep.get('tx_reference', '—')}</i>",
                    {"inline_keyboard": [[{"text": "◈  Open Wallet", "url": "https://errorhacker.site/me/wallet"}]]})
        except Exception:
            pass
    return {"ok": True, "deposit": {**_clean(dep), "status": "approved"}, "balance": new_balance}


async def _reject_deposit_internal(deposit_id: str, reason: str = "") -> Dict[str, Any]:
    dep = await db.wallet_deposits.find_one({"id": deposit_id})
    if not dep:
        return {"ok": False, "error": "Deposit not found"}
    if dep.get("status") == "approved":
        return {"ok": False, "error": "Already approved"}
    if dep.get("status") == "rejected":
        return {"ok": False, "error": "Already rejected", "deposit": _clean(dep)}
    await db.wallet_deposits.update_one(
        {"id": deposit_id},
        {"$set": {"status": "rejected", "rejected_at": _now_iso(), "reject_reason": reason or ""}},
    )
    user = await db.users.find_one({"user_id": dep.get("user_id")}) or {}
    user_chat = user.get("telegram_chat_id")
    if user_chat:
        try:
            tok = await _get_bot_token()
            if tok:
                await _tg_send(tok, int(user_chat),
                    f"✕ <b>Deposit declined</b>\n"
                    f"━━━━━━━━━━━━━━━\n\n"
                    f"₹{float(dep.get('amount') or 0):,.0f} top-up could not be verified.\n"
                    f"{('Reason: ' + reason) if reason else 'Please double-check your UPI/UTR or crypto TXID and re-submit.'}",
                    {"inline_keyboard": [[{"text": "◈  Re-submit", "url": "https://errorhacker.site/me/wallet"}]]})
        except Exception:
            pass
    return {"ok": True, "deposit": {**_clean(dep), "status": "rejected"}}

async def _handle_link(bot_token: str, chat_id: int, chat: Dict[str, Any], code: str):
    code = (code or "").strip().upper()
    if not code:
        await _send_welcome(bot_token, chat_id)
        return
    rec = await db.telegram_link_codes.find_one({"code": code})
    if not rec:
        await _tg_send(bot_token, chat_id, "❌ This link is invalid or expired. Generate a fresh one from your account page.")
        return
    if rec.get("expires_at") and rec["expires_at"] < _now_iso():
        await db.telegram_link_codes.delete_one({"code": code})
        await _tg_send(bot_token, chat_id, "⌛ This link expired. Generate a fresh one from your account page.")
        return
    user_id = rec.get("user_id")
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        await _tg_send(bot_token, chat_id, "❌ Linked account not found.")
        return
    await db.users.update_one({"user_id": user_id}, {"$set": {
        "telegram_chat_id": chat_id,
        "telegram_username": chat.get("username", ""),
        "telegram_first_name": chat.get("first_name", ""),
        "telegram_linked_at": _now_iso(),
    }})
    await db.telegram_link_codes.delete_one({"code": code})
    bot_cfg = await _get_bot_cfg()
    await _tg_send(bot_token, chat_id,
                   f"✅ <b>Connected!</b>\n\nThis Telegram chat is now linked to <code>{user.get('email')}</code>.\n"
                   f"You'll get instant DMs whenever your order or recovery case status changes.",
                   _bot_main_keyboard(bot_cfg.get("username", ""), bot_cfg.get("commands")))


# ============================================================================
# Telegram bot upgrade — interactive menu, AI tools, wallet, spin, news, AI chat
# ============================================================================

# ---- per-chat state (multi-step flows like /odds, /quote, /phishing) -------
async def _tg_state_set(chat_id: int, key: str, data: Dict[str, Any]):
    await db.tg_state.update_one(
        {"chat_id": chat_id},
        {"$set": {"chat_id": chat_id, "key": key, "data": data, "updated_at": _now_iso()}},
        upsert=True,
    )

async def _tg_state_get(chat_id: int) -> Dict[str, Any]:
    doc = await db.tg_state.find_one({"chat_id": chat_id}) or {}
    return doc

async def _tg_state_clear(chat_id: int):
    await db.tg_state.delete_one({"chat_id": chat_id})

# ---- AI free-chat rate-limit (per chat_id) ---------------------------------
AI_DAILY_LIMIT = 10
async def _tg_ai_quota(chat_id: int) -> tuple:
    """Returns (remaining, reset_iso)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rec = await db.tg_ai_quota.find_one({"chat_id": chat_id, "date": today}) or {}
    used = int(rec.get("count") or 0)
    return max(0, AI_DAILY_LIMIT - used), today

async def _tg_ai_bump(chat_id: int):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.tg_ai_quota.update_one(
        {"chat_id": chat_id, "date": today},
        {"$inc": {"count": 1}, "$setOnInsert": {"created_at": _now_iso()}},
        upsert=True,
    )

# ---- Main menu (rich button grid) ------------------------------------------
def _main_menu_kb() -> Dict[str, Any]:
    return {"inline_keyboard": [
        [{"text": "⬢  Recover Account", "url": "https://errorhacker.site/recovery"},
         {"text": "▸  My Orders",       "callback_data": "menu_orders"}],
        [{"text": "◈  Wallet",          "callback_data": "menu_wallet"},
         {"text": "✦  Daily Spin",      "callback_data": "menu_spin"}],
        [{"text": "⬡  Breach Scan",     "callback_data": "menu_breach"},
         {"text": "⚠  Phishing Scan",   "callback_data": "menu_phishing"}],
        [{"text": "▰  Recovery Odds",   "callback_data": "menu_odds_start"},
         {"text": "◆  Instant Quote",   "callback_data": "menu_quote_start"}],
        [{"text": "⌬  Latest Updates",  "callback_data": "menu_news"},
         {"text": "⇡  Refer & Earn",    "callback_data": "menu_refer"}],
        [{"text": "▌  Ask AI Anything", "callback_data": "menu_ai"},
         {"text": "?  Help",            "callback_data": "menu_help"}],
    ]}

async def _send_main_menu(bot_token: str, chat_id: int, intro: str = ""):
    text = intro or (
        "▌ <b>ERRORHACKER · CONSOLE</b>\n"
        "<i>tap a module · or type a question</i>\n"
        "━━━━━━━━━━━━━━━\n\n"
        "<b>▸ Quick paste</b>   drop a <code>REC-</code> or <code>ORD-</code> ID for instant status\n"
        "<b>▸ Quick chat</b>    just type — our AI replies in seconds"
    )
    await _tg_send(bot_token, chat_id, text, _main_menu_kb())

# ---- /breach ---------------------------------------------------------------
async def _handle_breach(bot_token: str, chat_id: int, email: str = ""):
    email = (email or "").strip().lower()
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        await _tg_state_set(chat_id, "awaiting_breach_email", {})
        await _tg_send(bot_token, chat_id,
                       "⬡ <b>BREACH SCAN</b>\n"
                       "━━━━━━━━━━━━━━━\n\n"
                       "Send the email you want scanned against the world's known data-leak archives.\n"
                       "<i>example: you@example.com</i>\n\n"
                       "▸ <i>We never store your email.</i>")
        return
    await _tg_state_clear(chat_id)
    await _tg_send(bot_token, chat_id, f"⌬ scanning <code>{email}</code> …")
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            r = await c.get("https://api.xposedornot.com/v1/breach-analytics", params={"email": email})
        if r.status_code == 404:
            await _tg_send(bot_token, chat_id, f"✓ <b>{email}</b> was NOT found in any known breach.\n\n<i>Stay vigilant — enable 2FA on every important account.</i>")
            return
        if r.status_code != 200:
            await _tg_send(bot_token, chat_id, "▰ Breach service temporarily unavailable. Try again in a minute.")
            return
        data = r.json() or {}
        bm = (data.get("BreachMetrics") or {})
        risk = ((bm.get("risk") or [{}])[0] or {})
        breaches_list = (data.get("ExposedBreaches") or {}).get("breaches_details") or []
        count = len(breaches_list)
        score = int(risk.get("risk_score") or 0)
        label = str(risk.get("risk_label") or "Low")
        lines = [
            f"▰ <b>FOUND IN {count} BREACH{'ES' if count != 1 else ''}</b>",
            "━━━━━━━━━━━━━━━",
            f"Exposure score · <b>{score}/100</b> · risk <b>{label}</b>",
            "",
            "<b>▸ Top exposures</b>",
        ]
        for b in breaches_list[:5]:
            name = b.get("breach") or "Unknown"
            date = b.get("xposed_date") or ""
            lines.append(f"   <code>{name}</code>{f' · {date}' if date else ''}")
        lines.append("")
        lines.append("<b>▸ What to do now</b>")
        lines.append("   1.  Change passwords on every site using this email")
        lines.append("   2.  Enable 2FA on an authenticator app (NOT SMS)")
        lines.append("   3.  Watch for phishing referencing these breaches")
        await _tg_send(bot_token, chat_id, "\n".join(lines),
                       {"inline_keyboard": [[{"text": "⬢  Get Pro Recovery Help", "url": "https://errorhacker.site/recovery"}],
                                            [{"text": "❮  Main Menu", "callback_data": "menu_main"}]]})
    except Exception as e:
        log.warning("tg breach failed: %s", e)
        await _tg_send(bot_token, chat_id, "▰ Couldn't scan right now. Try again shortly.")

# ---- /odds (interactive) ---------------------------------------------------
ODDS_PLATFORMS = [("instagram", "Instagram"), ("facebook", "Facebook"), ("tiktok", "TikTok"), ("snapchat", "Snapchat"), ("twitter", "Twitter / X")]
ODDS_ISSUES = [("hacked", "Hacked"), ("disabled", "Disabled"), ("locked_2fa", "2FA locked"), ("forgot_password", "Forgot password"), ("impersonation", "Impersonation"), ("shadowban", "Shadowban")]
ODDS_WHEN = [("today", "Today"), ("week", "This week"), ("month", "1–4 wks"), ("older", "1+ month")]

async def _handle_odds_start(bot_token: str, chat_id: int):
    await _tg_state_set(chat_id, "odds_pick_platform", {})
    kb = [[{"text": l, "callback_data": f"odds_p_{v}"}] for v, l in ODDS_PLATFORMS]
    await _tg_send(bot_token, chat_id,
                   "▰ <b>RECOVERY ODDS</b> · step 1/3\n━━━━━━━━━━━━━━━\n\nWhich platform?",
                   {"inline_keyboard": kb})

async def _handle_odds_pick_issue(bot_token: str, chat_id: int, platform: str):
    await _tg_state_set(chat_id, "odds_pick_issue", {"platform": platform})
    kb = [[{"text": l, "callback_data": f"odds_i_{v}"}] for v, l in ODDS_ISSUES]
    await _tg_send(bot_token, chat_id,
                   f"▰ <b>RECOVERY ODDS</b> · step 2/3\n━━━━━━━━━━━━━━━\nPlatform: <b>{platform.title()}</b>\n\nWhat happened?",
                   {"inline_keyboard": kb})

async def _handle_odds_pick_when(bot_token: str, chat_id: int, issue: str):
    state = await _tg_state_get(chat_id)
    data = state.get("data") or {}
    data["issue"] = issue
    await _tg_state_set(chat_id, "odds_pick_when", data)
    kb = [[{"text": l, "callback_data": f"odds_w_{v}"}] for v, l in ODDS_WHEN]
    await _tg_send(bot_token, chat_id,
                   "▰ <b>RECOVERY ODDS</b> · step 3/3\n━━━━━━━━━━━━━━━\n\nWhen did it happen?",
                   {"inline_keyboard": kb})

async def _handle_odds_finish(bot_token: str, chat_id: int, when: str):
    state = await _tg_state_get(chat_id)
    data = state.get("data") or {}
    platform = data.get("platform", "instagram")
    issue = data.get("issue", "hacked")
    await _tg_state_clear(chat_id)

    base = _BASE_ODDS.get(issue, {"odds": 50, "days": (5, 14)})
    odds = base["odds"] + _PLATFORM_MOD.get(platform, -5) + _WHEN_MOD.get(when, 0) + 8 + 6 + 5  # assume yes/yes/yes
    odds = max(5, min(95, odds))
    pro = min(95, odds + 25)
    dmin, dmax = base["days"]
    if when in ("month", "older"):
        dmin += 2; dmax += 5

    tier = "high" if odds >= 70 else "medium" if odds >= 45 else "low"
    tier_dot = {"high": "●", "medium": "◐", "low": "○"}[tier]

    await _tg_send(bot_token, chat_id,
        f"▰ <b>YOUR RECOVERY ODDS</b>\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"<b>▸ Self-recovery</b>      {odds}%\n"
        f"<b>▸ With ERRORHACKER</b>  {pro}% {tier_dot}\n"
        f"<b>▸ Estimated time</b>    {dmin}–{dmax} days\n\n"
        f"<i>Platform: {platform.title()} · Issue: {issue.replace('_', ' ')} · {when}</i>\n\n"
        f"⚡ <b>Pro tip</b> — never share OTP / password, even with someone claiming to be from the platform.",
        {"inline_keyboard": [
            [{"text": "⚡  Boost My Odds · Start Recovery", "url": "https://errorhacker.site/recovery"}],
            [{"text": "↻  Recalculate", "callback_data": "menu_odds_start"},
             {"text": "❮  Main Menu", "callback_data": "menu_main"}],
        ]})

# ---- /phishing -------------------------------------------------------------
async def _handle_phishing_start(bot_token: str, chat_id: int):
    await _tg_state_set(chat_id, "awaiting_phishing_text", {})
    await _tg_send(bot_token, chat_id,
                   "⚠ <b>PHISHING SCAN</b>\n"
                   "━━━━━━━━━━━━━━━\n\n"
                   "Forward or paste the suspicious message (DM / SMS / email body) here.\n"
                   "AI will analyse it in seconds.\n\n"
                   "▸ <i>We never store your message.</i>")

async def _handle_phishing_analyse(bot_token: str, chat_id: int, msg: str):
    await _tg_state_clear(chat_id)
    msg = (msg or "").strip()
    if len(msg) < 8:
        await _tg_send(bot_token, chat_id, "❗ message too short to analyse. Paste the full text.")
        return
    if len(msg) > 6000:
        msg = msg[:6000]

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        await _tg_send(bot_token, chat_id, "⚠ AI analysis unavailable right now.")
        return
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        await _tg_send(bot_token, chat_id, "⚠ AI key not configured.")
        return
    await _tg_send(bot_token, chat_id, "🔎 analysing …")
    sid = uuid.uuid4().hex
    try:
        chat = LlmChat(api_key=key, session_id=sid, system_message=PHISHING_PROMPT).with_model("anthropic", "claude-sonnet-4-5-20250929")
        reply = await chat.send_message(UserMessage(text=f"Channel: Telegram\n---message---\n{msg}\n---end---"))
    except Exception as e:
        log.warning("tg phishing LLM failed: %s", e)
        await _tg_send(bot_token, chat_id, "⚠ AI temporarily unavailable.")
        return

    import json as _json, re as _re
    parsed = None
    try:
        parsed = _json.loads(reply or "")
    except Exception:
        m = _re.search(r"\{[\s\S]*\}", reply or "")
        if m:
            try:    parsed = _json.loads(m.group(0))
            except Exception: parsed = None
    if not isinstance(parsed, dict):
        parsed = {"risk_level": "medium", "confidence": 50, "red_flags": [], "verdict": (reply or "")[:140], "action": "Treat with caution."}

    rl = str(parsed.get("risk_level", "medium")).lower()
    dot = {"safe": "○", "low": "●", "medium": "◐", "high": "◉", "critical": "▰"}.get(rl, "◐")
    lines = [
        f"{dot} <b>{rl.upper()} RISK</b>  ·  confidence {parsed.get('confidence', 0)}%",
        "━━━━━━━━━━━━━━━",
        "",
        f"<b>▸ Verdict</b>  {parsed.get('verdict', '—')}",
    ]
    flags = parsed.get("red_flags") or []
    if flags:
        lines.append("\n<b>▸ Red flags</b>")
        for f in flags[:6]:
            lines.append(f"   <code>·</code> {f}")
    if parsed.get("action"):
        lines.append(f"\n<b>⚡ Action</b>  {parsed['action']}")
    kb_rows = [[{"text": "❮  Main Menu", "callback_data": "menu_main"}]]
    if rl in ("high", "critical"):
        kb_rows.insert(0, [{"text": "⬢  I already clicked — recover me", "url": "https://errorhacker.site/recovery"}])
    await _tg_send(bot_token, chat_id, "\n".join(lines), {"inline_keyboard": kb_rows})

# ---- /quote (interactive) --------------------------------------------------
QUOTE_PLATFORMS = [("instagram", "Instagram"), ("facebook", "Facebook"), ("tiktok", "TikTok"), ("snapchat", "Snapchat")]
QUOTE_ISSUES = [("hacked", "Hacked"), ("disabled", "Disabled"), ("locked_2fa", "2FA Lock"), ("forgot_password", "Lost Password"), ("impersonation", "Impersonation")]
QUOTE_URGENCY = [("low", "Standard"), ("medium", "Priority"), ("high", "Urgent ⚡")]

# Indicative price table — adjust freely in admin in a future iteration
_QUOTE_PRICE = {
    "hacked":          {"low": 1499, "medium": 2499, "high": 3999},
    "disabled":        {"low": 1999, "medium": 2999, "high": 4999},
    "locked_2fa":      {"low":  999, "medium": 1499, "high": 2499},
    "forgot_password": {"low":  799, "medium": 1199, "high": 1999},
    "impersonation":   {"low": 1499, "medium": 2499, "high": 3999},
}
_QUOTE_PLATFORM_MULT = {"instagram": 1.0, "facebook": 1.05, "tiktok": 1.1, "snapchat": 1.15}

async def _handle_quote_start(bot_token: str, chat_id: int):
    await _tg_state_set(chat_id, "quote_pick_platform", {})
    kb = [[{"text": l, "callback_data": f"q_p_{v}"}] for v, l in QUOTE_PLATFORMS]
    await _tg_send(bot_token, chat_id,
                   "◆ <b>INSTANT QUOTE</b> · step 1/3\n━━━━━━━━━━━━━━━\n\nWhich platform?",
                   {"inline_keyboard": kb})

async def _handle_quote_pick_issue(bot_token: str, chat_id: int, platform: str):
    await _tg_state_set(chat_id, "quote_pick_issue", {"platform": platform})
    kb = [[{"text": l, "callback_data": f"q_i_{v}"}] for v, l in QUOTE_ISSUES]
    await _tg_send(bot_token, chat_id,
                   f"◆ <b>INSTANT QUOTE</b> · step 2/3\n━━━━━━━━━━━━━━━\nPlatform: <b>{platform.title()}</b>\n\nWhat happened?",
                   {"inline_keyboard": kb})

async def _handle_quote_pick_urgency(bot_token: str, chat_id: int, issue: str):
    state = await _tg_state_get(chat_id)
    data = state.get("data") or {}
    data["issue"] = issue
    await _tg_state_set(chat_id, "quote_pick_urgency", data)
    kb = [[{"text": l, "callback_data": f"q_u_{v}"}] for v, l in QUOTE_URGENCY]
    await _tg_send(bot_token, chat_id, "◆ <b>INSTANT QUOTE</b> · step 3/3\n━━━━━━━━━━━━━━━\n\nHow urgent?", {"inline_keyboard": kb})

async def _handle_quote_finish(bot_token: str, chat_id: int, urgency: str):
    state = await _tg_state_get(chat_id)
    data = state.get("data") or {}
    platform = data.get("platform", "instagram")
    issue = data.get("issue", "hacked")
    await _tg_state_clear(chat_id)
    price = _QUOTE_PRICE.get(issue, _QUOTE_PRICE["hacked"]).get(urgency, 2499)
    price = int(price * _QUOTE_PLATFORM_MULT.get(platform, 1.0))
    eta = {"low": "5–10 days", "medium": "3–6 days", "high": "24–72 hrs"}[urgency]
    await _tg_send(bot_token, chat_id,
        f"◆ <b>YOUR INSTANT QUOTE</b>\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"<b>▸ Platform</b>           {platform.title()}\n"
        f"<b>▸ Issue</b>              {issue.replace('_', ' ').title()}\n"
        f"<b>▸ Tier</b>               {urgency.title()}\n"
        f"<b>▸ Indicative price</b>   ₹{price:,}\n"
        f"<b>▸ ETA</b>                {eta}\n\n"
        f"<i>Final price is locked after our team reviews your case (1–2 hrs). No payment until you accept the quote.</i>",
        {"inline_keyboard": [
            [{"text": "⚡  Start Recovery Now", "url": "https://errorhacker.site/recovery"}],
            [{"text": "↻  New Quote", "callback_data": "menu_quote_start"},
             {"text": "❮  Main Menu", "callback_data": "menu_main"}],
        ]})

# ---- /wallet ---------------------------------------------------------------
async def _handle_wallet(bot_token: str, chat_id: int):
    user = await db.users.find_one({"telegram_chat_id": chat_id})
    if not user:
        await _tg_send(bot_token, chat_id,
                       "🔗 <b>Link your account first</b>\n\nVisit <a href=\"https://errorhacker.site/me\">errorhacker.site/me</a> → <i>Connect Telegram</i>. Takes 5 sec, no password.")
        return
    bal = float(user.get("balance") or 0)
    cur = user.get("currency") or "INR"
    sym = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}.get(cur, "")
    txs = await db.wallet_transactions.find({"user_id": user.get("user_id")}).sort("created_at", -1).to_list(5)
    lines = [f"💰 <b>WALLET BALANCE</b>\n\n<b>{sym}{bal:.2f}</b> {cur}", ""]
    if txs:
        lines.append("<b>Last 5 transactions:</b>")
        for t in txs:
            sign = "+" if (t.get("type") == "credit") else "−"
            amt = float(t.get("amount") or 0)
            lines.append(f"{sign} {sym}{amt:.2f} · {t.get('reason', '')[:40]}")
    else:
        lines.append("<i>No transactions yet — spin the wheel to earn your first coins!</i>")
    await _tg_send(bot_token, chat_id, "\n".join(lines),
                   {"inline_keyboard": [
                       [{"text": "🎰 Spin & Earn", "callback_data": "menu_spin"},
                        {"text": "💳 Top Up",     "url": "https://errorhacker.site/me"}],
                       [{"text": "❮  Main Menu", "callback_data": "menu_main"}]]})

# ---- /spin (daily) ---------------------------------------------------------
SPIN_PRIZES = [
    {"amount": 5,    "weight": 35, "label": "₹5"},
    {"amount": 10,   "weight": 28, "label": "₹10"},
    {"amount": 25,   "weight": 18, "label": "₹25"},
    {"amount": 50,   "weight": 10, "label": "₹50"},
    {"amount": 100,  "weight": 6,  "label": "₹100"},
    {"amount": 250,  "weight": 2,  "label": "₹250 🎉"},
    {"amount": 500,  "weight": 1,  "label": "₹500 💎"},
]
import random as _random  # noqa: E402

async def _handle_spin(bot_token: str, chat_id: int):
    user = await db.users.find_one({"telegram_chat_id": chat_id})
    if not user:
        await _tg_send(bot_token, chat_id,
                       "⟶ <b>Link your account to spin</b>\n\nVisit <a href=\"https://errorhacker.site/me\">errorhacker.site/me</a> → <i>Connect Telegram</i>.")
        return
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    spin_doc = await db.spin_history.find_one({"user_id": user["user_id"], "date": today})
    if spin_doc:
        await _tg_send(bot_token, chat_id,
                       f"○ <b>Come back tomorrow</b>\n\nYou already spun today and won <b>₹{spin_doc.get('amount', 0)}</b>.")
        return
    weights = [p["weight"] for p in SPIN_PRIZES]
    prize = _random.choices(SPIN_PRIZES, weights=weights, k=1)[0]
    amount = prize["amount"]
    # Credit
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"balance": amount}})
    await db.wallet_transactions.insert_one({
        "id": uuid.uuid4().hex, "user_id": user["user_id"], "type": "credit",
        "amount": amount, "reason": "Daily spin · Telegram", "created_at": _now_iso(),
    })
    await db.spin_history.insert_one({"user_id": user["user_id"], "date": today, "amount": amount, "via": "telegram", "created_at": _now_iso()})
    new_bal = float(user.get("balance") or 0) + amount
    await _tg_send(bot_token, chat_id,
        f"✦ <b>SPIN RESULT</b>\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"You won  <b>{prize['label']}</b>\n"
        f"New balance  <b>₹{new_bal:.2f}</b>\n\n"
        f"<i>Come back tomorrow for another spin.</i>",
        {"inline_keyboard": [[{"text": "◈  Wallet", "callback_data": "menu_wallet"},
                              {"text": "❮  Menu",  "callback_data": "menu_main"}]]})

# ---- /news -----------------------------------------------------------------
async def _handle_news(bot_token: str, chat_id: int):
    rows = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(3)
    if not rows:
        await _tg_send(bot_token, chat_id, "⌬ No updates yet — stay tuned.")
        return
    lines = ["⌬ <b>LATEST UPDATES</b>\n━━━━━━━━━━━━━━━"]
    for a in rows:
        lines.append(f"\n<b>▸ {a.get('title', '—')}</b>")
        body = (a.get("body") or "")[:160]
        lines.append(f"   {body}")
        if a.get("link"):
            lk = a["link"]
            if not lk.startswith("http"):
                lk = f"https://errorhacker.site{lk}"
            lines.append(f"   <code>⟶</code> {lk}")
    await _tg_send(bot_token, chat_id, "\n".join(lines),
                   {"inline_keyboard": [[{"text": "❮  Main Menu", "callback_data": "menu_main"}]]})

# ---- /refer ----------------------------------------------------------------
async def _handle_refer(bot_token: str, chat_id: int):
    user = await db.users.find_one({"telegram_chat_id": chat_id})
    if not user:
        await _tg_send(bot_token, chat_id,
                       "⟶ <b>Link your account first</b>\n\nVisit <a href=\"https://errorhacker.site/me\">errorhacker.site/me</a> → <i>Connect Telegram</i> to get your unique referral link.")
        return
    code = (user.get("referral_code") or user["user_id"][:8]).upper()
    if not user.get("referral_code"):
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"referral_code": code}})
    link = f"https://errorhacker.site/r/{code}"
    referrals = await db.users.count_documents({"referred_by": code})
    await _tg_send(bot_token, chat_id,
        f"⇡ <b>REFER &amp; EARN</b>\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"Share this link with anyone who needs account recovery:\n"
        f"<code>{link}</code>\n\n"
        f"<b>▸ You earn</b>    ₹100 wallet credit per friend who completes a paid recovery\n"
        f"<b>▸ They get</b>    ₹50 off their first order\n"
        f"<b>▸ Total refs</b>  {referrals}",
        {"inline_keyboard": [[{"text": "⇡  Share to a chat",
                               "switch_inline_query": f"Get your social account recovered fast. Use my link → {link}"}],
                             [{"text": "❮  Main Menu", "callback_data": "menu_main"}]]})

# ---- AI free-chat fallback (Claude Haiku, rate-limited) --------------------
async def _handle_ai_chat(bot_token: str, chat_id: int, text: str):
    remaining, _ = await _tg_ai_quota(chat_id)
    if remaining <= 0:
        await _tg_send(bot_token, chat_id,
                       "○ You've used all free AI questions for today (10/10). Resets at midnight UTC.\n\n"
                       "<i>Tip: use commands like /breach, /odds, /quote — they don't count against your AI quota.</i>",
                       {"inline_keyboard": [[{"text": "❮  Main Menu", "callback_data": "menu_main"}]]})
        return
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        await _tg_send(bot_token, chat_id, "▰ AI assistant unavailable right now.")
        return
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        await _tg_send(bot_token, chat_id, "▰ AI key not configured.")
        return
    await _tg_ai_bump(chat_id)
    sid = f"tg-{chat_id}"
    try:
        chat = LlmChat(api_key=key, session_id=sid, system_message=FAQ_SYSTEM_PROMPT).with_model("anthropic", "claude-haiku-4-5-20251001")
        reply = await chat.send_message(UserMessage(text=text))
    except Exception as e:
        log.warning("tg ai chat failed: %s", e)
        await _tg_send(bot_token, chat_id, "▰ AI temporarily unavailable. Try again in a moment.")
        return
    quota_line = f"\n\n<i>· {remaining - 1}/10 AI questions left today</i>" if remaining - 1 > 0 else "\n\n<i>· last AI question today — use commands for more</i>"
    await _tg_send(bot_token, chat_id, (reply or "—") + quota_line,
                   {"inline_keyboard": [[{"text": "❮  Main Menu", "callback_data": "menu_main"}]]})


async def _handle_callback(bot_token: str, chat_id: int, data: str):
    if data == "menu_main":
        await _send_main_menu(bot_token, chat_id)
    elif data == "menu_track":
        await _tg_send(bot_token, chat_id,
                       "▸ <b>Just paste your ID</b>\n\nLike <code>REC-AB12CD3456</code> or <code>ORD-XYZ123</code> — I'll fetch the live status instantly. No login needed.")
    elif data == "menu_orders":
        await _handle_orders(bot_token, chat_id)
    elif data == "menu_pay":
        await _handle_pay(bot_token, chat_id, "")
    elif data == "menu_help":
        await _send_help(bot_token, chat_id)
    # --- new menu actions ---
    elif data == "menu_breach":
        await _handle_breach(bot_token, chat_id, "")
    elif data == "menu_phishing":
        await _handle_phishing_start(bot_token, chat_id)
    elif data == "menu_odds_start":
        await _handle_odds_start(bot_token, chat_id)
    elif data == "menu_quote_start":
        await _handle_quote_start(bot_token, chat_id)
    elif data == "menu_wallet":
        await _handle_wallet(bot_token, chat_id)
    elif data == "menu_spin":
        await _handle_spin(bot_token, chat_id)
    elif data == "menu_news":
        await _handle_news(bot_token, chat_id)
    elif data == "menu_refer":
        await _handle_refer(bot_token, chat_id)
    elif data == "menu_ai":
        await _tg_state_set(chat_id, "awaiting_ai", {})
        rem, _ = await _tg_ai_quota(chat_id)
        await _tg_send(bot_token, chat_id,
                       f"▌ <b>ASK AI ANYTHING</b>\n"
                       f"━━━━━━━━━━━━━━━\n\n"
                       f"Type your question — pricing, recovery time, what to do if hacked, anything.\n\n"
                       f"<i>You have {rem}/10 AI questions left today.</i>")
    # --- odds flow ---
    elif data.startswith("odds_p_"):
        await _handle_odds_pick_issue(bot_token, chat_id, data[7:])
    elif data.startswith("odds_i_"):
        await _handle_odds_pick_when(bot_token, chat_id, data[7:])
    elif data.startswith("odds_w_"):
        await _handle_odds_finish(bot_token, chat_id, data[7:])
    # --- quote flow ---
    elif data.startswith("q_p_"):
        await _handle_quote_pick_issue(bot_token, chat_id, data[4:])
    elif data.startswith("q_i_"):
        await _handle_quote_pick_urgency(bot_token, chat_id, data[4:])
    elif data.startswith("q_u_"):
        await _handle_quote_finish(bot_token, chat_id, data[4:])
    # --- legacy ---
    elif data.startswith("track_"):
        await _handle_track(bot_token, chat_id, data[6:])
    elif data.startswith("pay_"):
        await _handle_pay(bot_token, chat_id, data[4:])
    # --- admin: approve / decline a wallet deposit ---
    elif data.startswith("dep_approve_") or data.startswith("dep_decline_"):
        bot_cfg = await _get_bot_cfg()
        if not _is_tg_admin(bot_cfg, chat_id):
            await _tg_send(bot_token, chat_id, "✕ <b>Not authorised.</b>\nOnly approved admin chats can approve/decline deposits.")
            return
        if data.startswith("dep_approve_"):
            dep_id = data[len("dep_approve_"):]
            res = await _approve_deposit_internal(dep_id)
            if res.get("ok"):
                dep = res["deposit"]
                await _tg_send(bot_token, chat_id,
                    f"✅ <b>APPROVED</b> · ₹{dep.get('amount', 0)} credited\n"
                    f"User <code>{dep.get('user_id', '')}</code> new balance: ₹{res.get('balance', 0):,.2f}")
            else:
                await _tg_send(bot_token, chat_id, f"⚠ {res.get('error', 'Failed')}")
        else:
            dep_id = data[len("dep_decline_"):]
            res = await _reject_deposit_internal(dep_id, reason="Declined by admin via Telegram")
            if res.get("ok"):
                await _tg_send(bot_token, chat_id, f"❌ <b>DECLINED</b> · deposit <code>{dep_id}</code> rejected. User has been notified.")
            else:
                await _tg_send(bot_token, chat_id, f"⚠ {res.get('error', 'Failed')}")

async def _process_update(update: Dict[str, Any]):
    """Async, fire-and-forget update handler — must never raise to caller."""
    try:
        bot_token = await _get_bot_token()
        if not bot_token:
            return
        # callback_query (inline button tap)
        if "callback_query" in update:
            cq = update["callback_query"]
            await _tg_call(bot_token, "answerCallbackQuery", {"callback_query_id": cq["id"]})
            chat_id = cq.get("message", {}).get("chat", {}).get("id")
            if chat_id is not None:
                await _handle_callback(bot_token, chat_id, cq.get("data") or "")
            return
        msg = update.get("message") or update.get("edited_message") or {}
        chat = msg.get("chat") or {}
        chat_id = chat.get("id")
        text = (msg.get("text") or "").strip()
        if chat_id is None or not text:
            return

        # ---- /commands (parsed first) ----
        if text.startswith("/start"):
            parts = text.split(maxsplit=1)
            payload = parts[1].strip() if len(parts) > 1 else ""
            if payload.lower().startswith("link_"):
                await _handle_link(bot_token, chat_id, chat, payload[5:])
            else:
                # Single unified welcome card (text + full 12-tile module grid).
                await _send_welcome(bot_token, chat_id)
            return
        if text.startswith("/menu"):
            await _send_main_menu(bot_token, chat_id)
            return
        if text.startswith("/track"):
            parts = text.split(maxsplit=1)
            await _handle_track(bot_token, chat_id, parts[1] if len(parts) > 1 else "")
            return
        if text.startswith("/orders"):
            await _handle_orders(bot_token, chat_id)
            return
        if text.startswith("/pay"):
            parts = text.split(maxsplit=1)
            await _handle_pay(bot_token, chat_id, parts[1].strip() if len(parts) > 1 else "")
            return
        if text.startswith("/help"):
            await _send_help(bot_token, chat_id)
            return
        if text.startswith("/recover"):
            await _send_recover(bot_token, chat_id)
            return
        if text.startswith("/refund"):
            parts = text.split(maxsplit=1)
            await _handle_refund_tg(bot_token, chat_id, parts[1] if len(parts) > 1 else "")
            return
        # ---- new commands ----
        if text.startswith("/breach"):
            parts = text.split(maxsplit=1)
            await _handle_breach(bot_token, chat_id, parts[1] if len(parts) > 1 else "")
            return
        if text.startswith("/odds"):
            await _handle_odds_start(bot_token, chat_id)
            return
        if text.startswith("/phishing") or text.startswith("/scam"):
            await _handle_phishing_start(bot_token, chat_id)
            return
        if text.startswith("/quote"):
            await _handle_quote_start(bot_token, chat_id)
            return
        if text.startswith("/wallet"):
            await _handle_wallet(bot_token, chat_id)
            return
        if text.startswith("/spin"):
            await _handle_spin(bot_token, chat_id)
            return
        if text.startswith("/news"):
            await _handle_news(bot_token, chat_id)
            return
        if text.startswith("/refer"):
            await _handle_refer(bot_token, chat_id)
            return
        if text.startswith("/ai") or text.startswith("/ask"):
            parts = text.split(maxsplit=1)
            if len(parts) > 1:
                await _handle_ai_chat(bot_token, chat_id, parts[1])
            else:
                await _tg_state_set(chat_id, "awaiting_ai", {})
                rem, _ = await _tg_ai_quota(chat_id)
                await _tg_send(bot_token, chat_id, f"🤖 Ask me anything! <i>{rem}/10 questions left today.</i>")
            return
        if text.startswith("/cancel"):
            await _tg_state_clear(chat_id)
            await _send_main_menu(bot_token, chat_id, "✕ cancelled.")
            return

        # ---- state-aware text (in the middle of a multi-step flow) ----
        state_doc = await _tg_state_get(chat_id)
        state_key = state_doc.get("key", "")
        if state_key == "awaiting_breach_email":
            await _handle_breach(bot_token, chat_id, text)
            return
        if state_key == "awaiting_phishing_text":
            await _handle_phishing_analyse(bot_token, chat_id, text)
            return
        if state_key == "awaiting_ai":
            await _tg_state_clear(chat_id)
            await _handle_ai_chat(bot_token, chat_id, text)
            return

        # ---- raw ID auto-detect (legacy) ----
        upper = text.upper().split()[0]
        if upper.startswith("ORD-") or upper.startswith("REC-"):
            await _handle_track(bot_token, chat_id, upper)
            return
        if upper.startswith("RFD-"):
            await _handle_refund_tg(bot_token, chat_id, upper)
            return

        # ---- catch-all → AI free-chat (rate-limited) ----
        await _handle_ai_chat(bot_token, chat_id, text)
    except Exception as e:
        log.warning("telegram bot process_update failed: %s", e)

async def _notify_user_order(order: Dict[str, Any], event: str = "status_change"):
    """DM the customer on their Telegram when their order/case status changes."""
    try:
        user_id = order.get("user_id")
        if not user_id:
            return
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            return
        chat_id = user.get("telegram_chat_id")
        if not chat_id:
            return
        bot_token = await _get_bot_token()
        if not bot_token:
            return
        text = await _fmt_order(order["id"]) or ""
        if not text:
            return
        kb = {"inline_keyboard": [[{"text": "🔗 Open Live Tracker", "url": f"https://errorhacker.site/track?id={order['id']}"}]]}
        await _tg_send(bot_token, chat_id, f"🔔 <b>Status update</b>\n\n{text}", kb)
    except Exception as e:
        log.warning("notify_user_order failed: %s", e)


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
    # If this order is linked to a recovery case, auto-bump the case timeline so
    # the customer sees their case progress without the admin doing two updates.
    case_id = row.get("case_id")
    if case_id:
        # Map order status → recovery case status. We only bump forward, never backward.
        ORDER_TO_CASE = {
            "in-progress": "recovering",
            "verified": "recovering",
            "paid": "recovering",
            "delivered": "recovered",
        }
        target = ORDER_TO_CASE.get(body.status)
        if target:
            case = await db.recovery_cases.find_one({"id": case_id})
            if case:
                # Forward-only progression: don't downgrade a case that's already past `target`.
                CASE_ORDER = ["new", "reviewing", "engaged", "recovering", "recovered", "closed"]
                cur = case.get("status") or "new"
                try:
                    if CASE_ORDER.index(target) > CASE_ORDER.index(cur):
                        await db.recovery_cases.update_one({"id": case_id}, {"$set": {"status": target}})
                except ValueError:
                    # `closed`/`rejected` or unknown status — leave as is
                    pass
    # Fire-and-forget Telegram DM + email — each in its own try/except so a
    # single failure doesn't suppress the rest (iter-12 testing-agent feedback).
    try: asyncio.create_task(_notify_user_order(row, event="status_change"))
    except Exception as e: log.warning("_notify_user_order dispatch failed: %s", e)
    try: asyncio.create_task(notify_order_status(
        row.get("email") or row.get("userEmail", ""),
        row.get("name", ""),
        order_id, body.status,
        row.get("serviceName") or row.get("service", "")
    ))
    except Exception as e: log.warning("notify_order_status dispatch failed: %s", e)
    # When admin marks the order verified/paid via manual proof flow, also send a receipt
    if body.status in ("verified", "paid"):
        amt = float(row.get("payment_amount") or row.get("amount") or 0)
        if amt > 0 and (row.get("email") or row.get("userEmail")):
            try: asyncio.create_task(send_order_receipt_email(
                row.get("email") or row.get("userEmail", ""),
                row.get("name", ""),
                row, amt,
                method=row.get("payment_method") or "manual",
            ))
            except Exception as e: log.warning("send_order_receipt_email dispatch failed: %s", e)
        # SMM panel auto-placement — fraud-safer trigger ("verified" only, never "received").
        # Each call is isolated so a panel outage can't block status updates.
        try:
            from smm_service import get_config as _smm_get_config, place_order_for_app_order as _smm_place
            _scfg = await _smm_get_config(db)
            if _scfg.get("enabled") and _scfg.get("auto_place_on_verified"):
                asyncio.create_task(_smm_place(db, row))
        except Exception as e:
            log.warning("smm auto-place dispatch failed: %s", e)
    return row

@api.delete("/orders")
async def clear_orders(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.orders.delete_many({})
    return {"deleted": res.deleted_count}

@api.post("/orders/{order_id}/set-quote")
async def order_set_quote(order_id: str, body: OrderQuoteIn, x_admin_token: Optional[str] = Header(None)):
    """Admin-only: set or update the quote amount on any order (cart-placed or admin-created).
    Persists payment_amount/currency/notes, fires a Telegram alert to the linked customer
    (when available) and an email with the secure pay link. Idempotent — re-sending updates
    the amount and re-pings the customer."""
    await _check_admin(x_admin_token)
    row = await db.orders.find_one({"id": order_id})
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    update = {
        "payment_amount": float(body.amount),
        "amount": float(body.amount),
        "payment_currency": body.currency or "INR",
        "currency": body.currency or "INR",
        "notes": body.note or row.get("notes", ""),
        "quote_sent_at": _now_iso(),
    }
    await db.orders.update_one({"id": order_id}, {"$set": update})
    row = await db.orders.find_one({"id": order_id})
    row.pop("_id", None)
    # Fire customer notifications (each isolated so a single failure doesn't kill the rest)
    try: asyncio.create_task(_notify_user_order(row, event="quote_sent"))
    except Exception as e: log.warning("_notify_user_order(quote_sent) dispatch failed: %s", e)
    try: asyncio.create_task(notify_quote_sent(
        row.get("email") or row.get("userEmail", ""),
        row.get("name", ""),
        order_id, float(body.amount), body.currency or "INR", body.note or ""
    ))
    except Exception as e: log.warning("notify_quote_sent dispatch failed: %s", e)
    return {"ok": True, "order": row}

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
    # Send "case received" email to customer
    asyncio.create_task(notify_case_received(case.get("email", ""), case.get("name", ""), case["id"], case.get("service_name") or case.get("issue") or "recovery"))
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
    # Email customer about status change
    asyncio.create_task(notify_case_status(row.get("email", ""), row.get("name", ""), case_id, body.status, body.admin_note or ""))
    return row

@api.delete("/recovery/cases/{case_id}")
async def recovery_delete_case(case_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.recovery_cases.delete_one({"id": case_id})
    return {"deleted": res.deleted_count}

@api.post("/recovery/cases/{case_id}/send-payment")
async def recovery_send_payment(case_id: str, body: RecoveryPaymentIn, x_admin_token: Optional[str] = Header(None)):
    """Admin-only: send a payment request for a recovery case.
    Creates a linked order with the finalised amount so the customer can pay
    through the existing UPI/Crypto PaymentBox on the /track page.
    Idempotent — if a linked order already exists, updates its amount/note
    instead of creating a new one and resends the alert."""
    await _check_admin(x_admin_token)
    case = await db.recovery_cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    existing_oid = case.get("linked_order_id")
    if existing_oid:
        existing = await db.orders.find_one({"id": existing_oid})
        if existing:
            await db.orders.update_one(
                {"id": existing_oid},
                {"$set": {"amount": body.amount, "currency": body.currency, "notes": body.note or existing.get("notes", "")}},
            )
            order = await db.orders.find_one({"id": existing_oid})
            order.pop("_id", None)
        else:
            existing_oid = None  # stale link, recreate below

    if not existing_oid:
        order = {
            "id": f"ORD-{uuid.uuid4().hex[:10].upper()}",
            "service": "recovery",
            "serviceName": f"Recovery · {case.get('service_name') or case.get('issue') or 'Case'}",
            "name": case.get("name") or "",
            "email": case.get("email") or "",
            "tg": case.get("telegram") or "",
            "size": case.get("urgency") or "",
            "target": case.get("account_url") or "",
            "notes": body.note or "",
            "amount": body.amount,
            "currency": body.currency,
            "status": "received",
            "case_id": case_id,
            "createdAt": datetime.utcnow().isoformat(),
        }
        if case.get("user_id"):
            order["user_id"] = case["user_id"]
            order["userEmail"] = case.get("userEmail") or case.get("email")
        await db.orders.insert_one(order)
        order.pop("_id", None)

    # update case: link the order, store final quote, bump status to engaged if still early
    case_upd: Dict[str, Any] = {
        "linked_order_id": order["id"],
        "final_amount": body.amount,
        "final_currency": body.currency,
        "payment_note": body.note or "",
        "payment_sent_at": _now_iso(),
    }
    if case.get("status") in (None, "", "new", "reviewing"):
        case_upd["status"] = "engaged"
    await db.recovery_cases.update_one({"id": case_id}, {"$set": case_upd})

    # fire telegram alerts so both team + customer get the heads-up
    case2 = await db.recovery_cases.find_one({"id": case_id})
    case2.pop("_id", None)
    asyncio.create_task(_notify_recovery_case({**case2, "_event": "payment_sent"}))

    # Email customer their quote with payment link
    asyncio.create_task(notify_quote_sent(
        case2.get("email", ""), case2.get("name", ""), case_id,
        body.amount, body.currency, body.note or ""
    ))

    return {"ok": True, "order": order, "case": case2}

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

# ---- Recovery: customer-submitted reviews (pending admin approval) --------
@api.get("/recovery/cases/{case_id}/can-review")
async def recovery_can_review(case_id: str):
    case = await db.recovery_cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    eligible = case.get("status") in ("recovered", "closed")
    already = await db.recovery_reviews.find_one({"case_id": case_id})
    return {
        "can_review": bool(eligible and not already),
        "eligible_status": eligible,
        "already_submitted": bool(already),
        "case_status": case.get("status"),
        "service_key": case.get("issue") or "",
        "service_name": case.get("service_name") or "",
        "name": case.get("name") or "",
        "email": case.get("email") or "",
    }

@api.post("/recovery/reviews/public")
async def recovery_submit_public_review(body: RecoveryReviewIn, request: Request):
    """Fully public — anyone (no auth, no case) can submit a review.
    All submissions are forced approved=false and must be admin-approved before going public.
    Soft-flagged with `source=public` so admin can filter them in the panel."""
    if not body.name.strip() or not body.quote.strip():
        raise HTTPException(status_code=400, detail="Name and review text are required")
    if len(body.quote.strip()) < 20:
        raise HTTPException(status_code=400, detail="Please write at least 20 characters")
    data = body.dict()
    data["approved"] = False
    # ignore any case_id from public form — must come from an authentic flow
    data["case_id"] = ""
    rev = {
        "id": f"REV-{uuid.uuid4().hex[:8]}",
        **data,
        "createdAt": _now_iso(),
        "source": "public",
        "submitter_ip": request.client.host if request.client else "",
    }
    await db.recovery_reviews.insert_one(rev)
    rev.pop("_id", None)
    # Telegram alert so admin knows a new review is waiting
    try:
        cfg = await _ensure_config()
        notif = (cfg.get("notifications") or {}).get("telegram") or {}
        if notif.get("enabled"):
            asyncio.create_task(_telegram_send(notif.get("bot_token", ""), notif.get("chat_id", ""),
                f"<b>NEW PUBLIC REVIEW // ERRORHACKER</b>\n<b>From:</b> {body.name}\n<b>Rating:</b> {'⭐' * body.rating}\n<b>Service:</b> {body.service_key or 'general'}\n\n<i>{body.quote[:200]}</i>\n\nApprove in webpanel → Recovery → Reviews."))
    except Exception:
        pass
    return rev

@api.post("/recovery/reviews/submit")
async def recovery_submit_review(body: RecoveryReviewIn):
    """Public endpoint — customers submit a review after their case is recovered/closed.
    Always saved with approved=false; admin must approve in the webpanel before it shows publicly."""
    if not body.case_id:
        raise HTTPException(status_code=400, detail="case_id is required")
    case = await db.recovery_cases.find_one({"id": body.case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.get("status") not in ("recovered", "closed"):
        raise HTTPException(status_code=400, detail="Reviews can be submitted only after a case is recovered or closed")
    existing = await db.recovery_reviews.find_one({"case_id": body.case_id})
    if existing:
        raise HTTPException(status_code=409, detail="A review has already been submitted for this case")
    data = body.dict()
    data["approved"] = False  # force pending — admin must approve
    # auto-fill service_key from case if not provided
    if not data.get("service_key"):
        data["service_key"] = case.get("issue") or ""
    rev = {
        "id": f"REV-{uuid.uuid4().hex[:8]}",
        **data,
        "createdAt": _now_iso(),
        "source": "customer",
    }
    await db.recovery_reviews.insert_one(rev)
    rev.pop("_id", None)
    return rev

@api.post("/recovery/reviews/upload-media")
async def recovery_review_upload_media(file: UploadFile = File(...)):
    """Public uploader for review media — accepts images (5MB) or videos (25MB)."""
    ct = file.content_type or ""
    is_video = ct.startswith("video/")
    is_image = ct.startswith("image/")
    if not (is_video or is_image):
        raise HTTPException(status_code=400, detail="Only image or video files allowed")
    raw = await file.read()
    limit = 25 * 1024 * 1024 if is_video else 5 * 1024 * 1024
    if len(raw) > limit:
        raise HTTPException(status_code=413, detail=f"File too large (max {limit // (1024*1024)}MB)")
    if is_image:
        # Burn watermark into the actual pixels — bulletproof anti-copy.
        # Even if someone hits /api/uploads/{id} directly, the bytes already
        # contain the ERRORHACKER diagonal text overlay. Removing it requires
        # manual photo editing per-image, which kills any practical theft.
        from watermark import watermark_image
        marked, new_ct = watermark_image(raw, ct)
        uid = uuid.uuid4().hex
        await db.uploads.insert_one({
            "_id": uid,
            "content_type": new_ct,
            "filename": file.filename or uid,
            "size": len(marked),
            "data": base64.b64encode(marked).decode("ascii"),
            "createdAt": datetime.utcnow().isoformat(),
            "kind": "recovery_review_media",
        })
        return {"url": f"/api/uploads/{uid}", "kind": "image", "content_type": new_ct, "size": len(marked)}
    grid_id = await fs_bucket.upload_from_stream(
        file.filename or f"review-{uuid.uuid4().hex}.mp4",
        io.BytesIO(raw),
        metadata={"content_type": ct, "size": len(raw), "kind": "recovery_review_media"},
    )
    sid = str(grid_id)
    return {"url": f"/api/feed/media/{sid}", "kind": "video", "content_type": ct, "size": len(raw)}

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

@api.post("/recovery/upload-proof")
async def recovery_upload_proof(file: UploadFile = File(...)):
    """Public proof uploader — images only, 5MB cap. No auth required so customers can submit."""
    ct = file.content_type or ""
    if not ct.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")
    file_id = await fs_bucket.upload_from_stream(file.filename or "proof.bin", raw, metadata={"content_type": ct, "kind": "recovery_proof"})
    return {"url": f"/api/feed/media/{file_id}"}

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

# ---- Telegram Bot (customer-facing) ---------------------------------------
class TelegramBotEnableIn(BaseModel):
    backend_url: str

class TelegramBotSettingsIn(BaseModel):
    welcome_message: Optional[str] = None
    commands: Optional[Dict[str, bool]] = None

class TelegramBroadcastIn(BaseModel):
    message: str

@api.post("/telegram/webhook/{secret}")
async def telegram_webhook(secret: str, request: Request, x_telegram_bot_api_secret_token: Optional[str] = Header(None)):
    """Public webhook called by Telegram. Path secret + optional header secret are both validated."""
    cfg = await _get_bot_cfg()
    expected = cfg.get("webhook_secret") or ""
    if not expected or secret != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")
    # also enforce header if Telegram sent it
    if x_telegram_bot_api_secret_token and x_telegram_bot_api_secret_token != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook header secret")
    try:
        update = await request.json()
    except Exception:
        return {"ok": True}
    # process async so we return 200 instantly (Telegram retries on slow responses)
    asyncio.create_task(_process_update(update))
    return {"ok": True}

@api.get("/admin/telegram/bot")
async def admin_bot_settings(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    cfg = await _get_bot_cfg()
    # never leak the webhook secret value over the wire to the admin UI
    safe = {**cfg, "webhook_secret_set": bool(cfg.get("webhook_secret"))}
    safe.pop("webhook_secret", None)
    linked_count = await db.users.count_documents({"telegram_chat_id": {"$exists": True, "$ne": None}})
    safe["linked_users"] = linked_count
    return safe

@api.put("/admin/telegram/bot")
async def admin_bot_settings_update(body: TelegramBotSettingsIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    upd: Dict[str, Any] = {}
    if body.welcome_message is not None:
        upd["welcome_message"] = body.welcome_message
    if body.commands is not None:
        upd["commands"] = body.commands
    cfg = await _save_bot_cfg(upd)
    cfg.pop("webhook_secret", None)
    return {"ok": True, "telegram_bot": cfg}


@api.get("/admin/telegram/admin-chats")
async def admin_tg_admin_chats(x_admin_token: Optional[str] = Header(None)):
    """List the Telegram chat IDs allowed to approve/decline wallet deposits via the bot."""
    await _check_admin(x_admin_token)
    cfg = await _get_bot_cfg()
    return {"admin_chat_ids": cfg.get("admin_chat_ids", [])}

@api.put("/admin/telegram/admin-chats")
async def admin_tg_admin_chats_set(body: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    raw = body.get("admin_chat_ids") or []
    cleaned: List[int] = []
    for v in raw:
        try:
            cleaned.append(int(str(v).strip()))
        except Exception:
            continue
    # de-dup, preserve order
    seen = set(); uniq = []
    for v in cleaned:
        if v not in seen: seen.add(v); uniq.append(v)
    cfg = await _save_bot_cfg({"admin_chat_ids": uniq})
    cfg.pop("webhook_secret", None)
    return {"ok": True, "admin_chat_ids": uniq, "telegram_bot": cfg}

@api.post("/admin/telegram/admin-chats/test")
async def admin_tg_admin_chats_test(x_admin_token: Optional[str] = Header(None)):
    """Send a test message to every configured admin chat — useful for verifying setup."""
    await _check_admin(x_admin_token)
    token = await _get_bot_token()
    cfg = await _get_bot_cfg()
    ids = cfg.get("admin_chat_ids") or []
    if not token or not ids:
        return {"ok": False, "sent": 0, "error": "Set bot token + at least one admin chat ID first"}
    sent = 0
    for cid in ids:
        try:
            r = await _tg_send(token, int(cid), "🔔 <b>Admin test ping</b>\nIf you see this, your Telegram chat is correctly authorised to approve wallet deposits.")
            if r.get("ok"): sent += 1
        except Exception:
            continue
    return {"ok": True, "sent": sent, "total": len(ids)}


@api.get("/admin/telegram/payment-info")
async def admin_tg_payment_info(x_admin_token: Optional[str] = Header(None)):
    """Return the customizable payment-info block sent by the bot's /pay command."""
    await _check_admin(x_admin_token)
    cfg = await _get_bot_cfg()
    return cfg.get("payment_info") or DEFAULT_BOT_CFG["payment_info"]

@api.put("/admin/telegram/payment-info")
async def admin_tg_payment_info_set(body: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    # Merge over current to preserve any fields the UI didn't send
    cur = (await _get_bot_cfg()).get("payment_info") or dict(DEFAULT_BOT_CFG["payment_info"])
    allowed = {
        "heading", "intro", "upi_id", "upi_name", "crypto_wallets",
        "instructions", "support_text",
        "show_paid_button", "show_support_button", "show_quote_button",
        "paid_button_label", "support_button_label", "quote_button_label",
        "support_url", "quote_url", "paid_form_url",
    }
    for k in allowed:
        if k in body:
            cur[k] = body[k]
    cfg = await _save_bot_cfg({"payment_info": cur})
    cfg.pop("webhook_secret", None)
    return {"ok": True, "payment_info": cur}

@api.post("/admin/telegram/payment-info/preview")
async def admin_tg_payment_info_preview(body: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    """Send a preview to the first admin chat so the operator can see what the bot will render."""
    await _check_admin(x_admin_token)
    cfg = await _get_bot_cfg()
    target = body.get("chat_id") or (cfg.get("admin_chat_ids") or [None])[0]
    if not target:
        raise HTTPException(status_code=400, detail="No chat_id supplied and no admin chats configured")
    # Persist a temporary copy so _handle_pay picks it up
    if body.get("payment_info"):
        await _save_bot_cfg({"payment_info": body["payment_info"]})
    token = await _get_bot_token()
    if not token:
        raise HTTPException(status_code=400, detail="Bot token not set")
    await _handle_pay(token, int(target), "")
    return {"ok": True}

@api.post("/admin/telegram/bot/enable")
async def admin_bot_enable(body: TelegramBotEnableIn, x_admin_token: Optional[str] = Header(None)):
    """Register the webhook with Telegram so the bot starts receiving customer messages."""
    await _check_admin(x_admin_token)
    token = await _get_bot_token()
    if not token:
        raise HTTPException(status_code=400, detail="Set BOT TOKEN in 'Telegram Alerts' first")
    base = (body.backend_url or "").rstrip("/")
    if not base.startswith("https://"):
        raise HTTPException(status_code=400, detail="backend_url must be HTTPS")
    cfg = await _get_bot_cfg()
    secret = cfg.get("webhook_secret") or uuid.uuid4().hex
    webhook_url = f"{base}/api/telegram/webhook/{secret}"
    # fetch bot username so we can build deep-links in the UI
    me = await _tg_call(token, "getMe", {})
    if not me.get("ok"):
        raise HTTPException(status_code=400, detail=f"Telegram getMe failed: {me.get('description') or me.get('error')}")
    bot_username = me.get("result", {}).get("username", "")
    # register webhook
    res = await _tg_call(token, "setWebhook", {
        "url": webhook_url,
        "secret_token": secret,
        "allowed_updates": ["message", "edited_message", "callback_query"],
        "drop_pending_updates": True,
    })
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=f"setWebhook failed: {res.get('description') or res.get('error')}")
    saved = await _save_bot_cfg({
        "enabled": True,
        "username": bot_username,
        "webhook_secret": secret,
        "webhook_url": webhook_url,
    })
    saved.pop("webhook_secret", None)
    return {"ok": True, "telegram_bot": saved}

@api.post("/admin/telegram/bot/disable")
async def admin_bot_disable(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    token = await _get_bot_token()
    if token:
        await _tg_call(token, "deleteWebhook", {"drop_pending_updates": False})
    cfg = await _save_bot_cfg({"enabled": False})
    cfg.pop("webhook_secret", None)
    return {"ok": True, "telegram_bot": cfg}

@api.get("/admin/telegram/bot/users")
async def admin_bot_linked_users(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.users.find(
        {"telegram_chat_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "user_id": 1, "email": 1, "name": 1, "telegram_chat_id": 1, "telegram_username": 1, "telegram_first_name": 1, "telegram_linked_at": 1},
    ).sort("telegram_linked_at", -1).to_list(500)
    return rows

@api.post("/admin/telegram/bot/broadcast")
async def admin_bot_broadcast(body: TelegramBroadcastIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    if not (body.message or "").strip():
        raise HTTPException(status_code=400, detail="Message is empty")
    token = await _get_bot_token()
    if not token:
        raise HTTPException(status_code=400, detail="Bot token is not set")
    cursor = db.users.find({"telegram_chat_id": {"$exists": True, "$ne": None}}, {"telegram_chat_id": 1})
    sent, failed = 0, 0
    async for u in cursor:
        cid = u.get("telegram_chat_id")
        if not cid:
            continue
        r = await _tg_send(token, cid, body.message)
        if r.get("ok"):
            sent += 1
        else:
            failed += 1
        await asyncio.sleep(0.05)  # ~20 msg/s — well under Telegram's 30/s global limit
    return {"ok": True, "sent": sent, "failed": failed}

# ---- Account ↔ Telegram linking (customer-side) ---------------------------
@api.post("/me/telegram/link-code")
async def me_telegram_link_code(request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    bot_cfg = await _get_bot_cfg()
    if not bot_cfg.get("enabled") or not bot_cfg.get("username"):
        raise HTTPException(status_code=503, detail="Telegram bot is not configured by the admin yet")
    # one active code per user
    await db.telegram_link_codes.delete_many({"user_id": user["user_id"]})
    code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.telegram_link_codes.insert_one({
        "code": code,
        "user_id": user["user_id"],
        "email": user.get("email"),
        "expires_at": expires,
        "createdAt": _now_iso(),
    })
    deep_link = f"https://t.me/{bot_cfg['username']}?start=link_{code}"
    return {"code": code, "deep_link": deep_link, "bot_username": bot_cfg["username"], "expires_at": expires}

@api.get("/me/telegram/status")
async def me_telegram_status(request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    bot_cfg = await _get_bot_cfg()
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "telegram_chat_id": 1, "telegram_username": 1, "telegram_first_name": 1, "telegram_linked_at": 1})
    return {
        "linked": bool((fresh or {}).get("telegram_chat_id")),
        "telegram_username": (fresh or {}).get("telegram_username"),
        "telegram_first_name": (fresh or {}).get("telegram_first_name"),
        "telegram_linked_at": (fresh or {}).get("telegram_linked_at"),
        "bot_enabled": bool(bot_cfg.get("enabled")),
        "bot_username": bot_cfg.get("username", ""),
    }

@api.delete("/me/telegram/unlink")
async def me_telegram_unlink(request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    await db.users.update_one({"user_id": user["user_id"]}, {"$unset": {
        "telegram_chat_id": "",
        "telegram_username": "",
        "telegram_first_name": "",
        "telegram_linked_at": "",
    }})
    return {"ok": True}


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

# ---- AI Tools Hub ----------------------------------------------------------
APPEAL_SYSTEM_PROMPT = (
    "You are an expert at writing polite, professional account-recovery appeal letters "
    "to social media platforms (Instagram, Facebook, TikTok). Your output must:\n"
    "- Be addressed to the platform's review team.\n"
    "- Be 4-6 short paragraphs, plain text, no markdown.\n"
    "- Acknowledge the alleged violation respectfully without admitting wrongdoing if the user denies it.\n"
    "- Emphasize good-faith use, account history, and impact on the user.\n"
    "- Ask for review/reinstatement.\n"
    "- Close with a courteous sign-off.\n"
    "Never invent specific dates, names, or account stats not given by the user."
)

FAQ_SYSTEM_PROMPT = (
    "You are ERR0R-HELP, the official AI assistant for ERRORHACKER (errorhacker.site) — an underground "
    "account-recovery & social-media intel service. Be concise, friendly, and lowercase-terminal styled. "
    "Reply in 2-4 sentences max unless the user asks for a step-by-step.\n\n"
    "Topics you handle: Instagram/Facebook/TikTok account recovery, disabled / hacked / 2FA-locked accounts, "
    "appeal process, recovery ETA (typical 2-7 days), pricing (from ₹999 for basic up to ₹15,000 for premium), "
    "manual UPI / crypto payment flow, order tracking (via /track), wallet & spin rewards, "
    "Telegram support bot, refund/refill policy.\n\n"
    "If asked something illegal/unethical, politely decline and suggest /recovery or our Telegram. "
    "If user wants a human, direct them to Telegram chat or team@errorhacker.site. "
    "Never invent prices or guarantees."
)


# ====== Tools rate-limit / wallet recharge gate ============================
#
# Each AI-powered tool has a free daily quota per IP (anonymous) or per user_id (logged-in).
# When the free quota is exhausted, logged-in users with sufficient wallet balance can
# continue using the tool — the per-call cost is debited from their wallet automatically.
# Anonymous users get a 429 with a clear "sign in & top up to continue" hint.
#
TOOLS_FREE_QUOTA: Dict[str, Dict[str, int]] = {
    "breach":   {"daily_free": 5,  "wallet_cost": 10},
    "phishing": {"daily_free": 3,  "wallet_cost": 15},
    "appeal":   {"daily_free": 2,  "wallet_cost": 49},
    "faq":      {"daily_free": 15, "wallet_cost": 3},
}

def _today_utc_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for") or ""
    if fwd:
        return fwd.split(",")[0].strip()
    real = request.headers.get("x-real-ip") or ""
    if real:
        return real.strip()
    return request.client.host if request.client else "0.0.0.0"

from pymongo import ReturnDocument

async def _tools_consume_quota(request: Request, tool_id: str) -> Dict[str, Any]:
    """Atomically check + decrement the daily quota for `tool_id`.

    Race-safe pattern: increment first (atomic upsert), then evaluate; if over the limit
    AND no wallet to cover, roll the increment back. The wallet debit itself is also
    guarded by `find_one_and_update({balance: {$gte: cost}})` so two concurrent calls
    can never overdraw the balance.

    Returns a dict describing what happened:
      {"source": "free" | "wallet" | "admin",
       "used":     <post-call count>,
       "free_limit": ...,
       "remaining_free": ...,
       "balance_after": ...,  # only when source=wallet
       "cost":         ...}   # only when source=wallet

    Raises HTTPException(429, ...structured detail...) when neither free quota nor wallet covers the call.
    """
    # Admin bypass — admins testing their own integration should never be metered.
    adm_tok = request.headers.get("x-admin-token") or ""
    if adm_tok and adm_tok == os.environ.get("ADMIN_TOKEN", ""):
        return {"source": "admin", "free_limit": -1, "used": 0, "remaining_free": -1, "cost": 0}

    conf = TOOLS_FREE_QUOTA.get(tool_id)
    if not conf:
        return {"source": "free", "free_limit": -1, "used": 0, "remaining_free": -1, "cost": 0}

    user = await _get_user_from_request(request)
    today = _today_utc_str()
    if user:
        ident = {"user_id": user["user_id"], "tool": tool_id, "date": today}
    else:
        ident = {"ip": _client_ip(request), "tool": tool_id, "date": today}

    # --- (1) ATOMIC: increment first, then evaluate ---
    after = await db.tools_usage.find_one_and_update(
        ident,
        {"$inc": {"count": 1},
         "$setOnInsert": {"created_at": _now_iso()},
         "$set": {"updated_at": _now_iso()}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    post_count = int((after or {}).get("count") or 1)

    # --- (2) within free tier ---
    if post_count <= conf["daily_free"]:
        await db.tools_usage.update_one(ident, {"$inc": {"free_count": 1}})
        return {
            "source": "free", "used": post_count,
            "free_limit": conf["daily_free"],
            "remaining_free": conf["daily_free"] - post_count,
            "cost": 0,
        }

    # --- (3) over free tier — must use wallet (or roll back the increment) ---
    cost = conf["wallet_cost"]
    if not user:
        # roll back to keep `used` accurate when the call wasn't actually allowed
        await db.tools_usage.update_one(ident, {"$inc": {"count": -1}})
        raise HTTPException(status_code=429, detail={
            "limit_reached": True,
            "tool": tool_id,
            "free_limit": conf["daily_free"],
            "used": conf["daily_free"],
            "wallet_cost": cost,
            "auth_required": True,
            "message": f"Free limit ({conf['daily_free']}/day) reached. Sign in and top up your wallet to keep using {tool_id}.",
        })

    # Atomic wallet debit — only succeeds if user.balance >= cost
    debited = await db.users.find_one_and_update(
        {"user_id": user["user_id"], "balance": {"$gte": cost}},
        {"$inc": {"balance": -cost}},
        return_document=ReturnDocument.AFTER,
    )
    if not debited:
        # roll back the tools_usage increment so `used` stays accurate
        await db.tools_usage.update_one(ident, {"$inc": {"count": -1}})
        balance = float(user.get("balance") or 0)
        raise HTTPException(status_code=429, detail={
            "limit_reached": True,
            "tool": tool_id,
            "free_limit": conf["daily_free"],
            "used": conf["daily_free"],
            "wallet_cost": cost,
            "balance": round(balance, 2),
            "needed": round(cost - balance, 2),
            "top_up_required": True,
            "message": f"You've used your {conf['daily_free']}/day free quota. Top up ₹{int(cost - balance)} or more to continue.",
        })
    await db.wallet_transactions.insert_one({
        "id": uuid.uuid4().hex, "user_id": user["user_id"], "type": "debit",
        "amount": cost, "reason": f"AI tool · {tool_id}", "tool_id": tool_id,
        "created_at": _now_iso(),
    })
    await db.tools_usage.update_one(ident, {"$inc": {"paid_count": 1}})
    return {
        "source": "wallet", "used": post_count,
        "free_limit": conf["daily_free"], "remaining_free": 0,
        "cost": cost, "balance_after": round(float(debited.get("balance") or 0), 2),
    }


@api.get("/tools/usage")
async def tools_usage_snapshot(request: Request):
    """Returns per-tool usage snapshot for the requesting client (user-aware)."""
    today = _today_utc_str()
    user = await _get_user_from_request(request)
    ip = _client_ip(request) if not user else None
    out: Dict[str, Any] = {
        "date": today,
        "user_id": user["user_id"] if user else None,
        "logged_in": bool(user),
        "balance": float(user.get("balance") or 0) if user else 0.0,
        "currency": (user.get("currency") if user else None) or "INR",
        "tools": {},
    }
    for tool_id, conf in TOOLS_FREE_QUOTA.items():
        ident = (
            {"user_id": user["user_id"], "tool": tool_id, "date": today}
            if user
            else {"ip": ip, "tool": tool_id, "date": today}
        )
        rec = await db.tools_usage.find_one(ident) or {}
        used = int(rec.get("count") or 0)
        out["tools"][tool_id] = {
            "used": used,
            "free_limit": conf["daily_free"],
            "remaining_free": max(0, conf["daily_free"] - used),
            "wallet_cost": conf["wallet_cost"],
            "paid_uses": int(rec.get("paid_count") or 0),
        }
    return out


@api.post("/tools/appeal")
async def tools_generate_appeal(body: ToolsAppealIn, request: Request):
    """Generate a polite social-media account appeal letter using the Emergent LLM key."""
    if not body.violation_reason.strip():
        raise HTTPException(status_code=400, detail="violation_reason required")
    quota = await _tools_consume_quota(request, "appeal")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        log.error("emergentintegrations import failed: %s", e)
        raise HTTPException(status_code=500, detail="AI assistant unavailable")
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="AI key not configured")

    facts = [
        f"Platform: {body.platform}",
        f"Reason given by platform: {body.violation_reason}",
    ]
    if body.account_handle: facts.append(f"Handle: @{body.account_handle.lstrip('@')}")
    if body.account_age:    facts.append(f"Account age: {body.account_age}")
    if body.followers:      facts.append(f"Followers: {body.followers}")
    if body.backstory:      facts.append(f"User's side of the story: {body.backstory}")
    facts.append(f"Tone: {body.tone}")
    facts.append(f"Language: {body.language}")

    user_msg = (
        "Please write a complete appeal letter using these facts. "
        "Output the letter only — no preamble.\n\n" + "\n".join(facts)
    )

    sid = uuid.uuid4().hex
    chat = LlmChat(api_key=key, session_id=sid, system_message=APPEAL_SYSTEM_PROMPT).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        reply = await chat.send_message(UserMessage(text=user_msg))
    except Exception as e:
        log.warning("appeal generation failed: %s", e)
        raise HTTPException(status_code=502, detail="AI temporarily unavailable")
    if not reply:
        raise HTTPException(status_code=502, detail="AI returned empty response")
    # log usage (best effort)
    try:
        await db.tool_usage.insert_one({
            "tool": "appeal",
            "platform": body.platform,
            "reason": body.violation_reason,
            "ts": _now_iso(),
        })
    except Exception:
        pass
    return {"letter": reply, "quota": quota}


@api.post("/tools/faq")
async def tools_faq_chat(body: ToolsFaqIn, request: Request):
    """Specialized FAQ chatbot for the /tools page (uses Emergent LLM)."""
    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Empty message")
    quota = await _tools_consume_quota(request, "faq")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        log.error("emergentintegrations import failed: %s", e)
        raise HTTPException(status_code=500, detail="AI assistant unavailable")
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="AI key not configured")

    await db.chat_history.insert_one({
        "session_id": body.session_id, "role": "user", "text": msg,
        "scope": "faq", "ts": _now_iso(),
    })
    chat = LlmChat(api_key=key, session_id=body.session_id, system_message=FAQ_SYSTEM_PROMPT).with_model("anthropic", "claude-haiku-4-5-20251001")
    try:
        reply = await chat.send_message(UserMessage(text=msg))
    except Exception as e:
        log.warning("faq chat send_message failed: %s", e)
        raise HTTPException(status_code=502, detail="AI temporarily unavailable")
    if not reply:
        raise HTTPException(status_code=502, detail="AI returned empty response")
    await db.chat_history.insert_one({
        "session_id": body.session_id, "role": "bot", "text": reply,
        "scope": "faq", "ts": _now_iso(),
    })
    return {"reply": reply, "quota": quota}


# ---- AI Tools Hub · Batch 2 -----------------------------------------------

@api.post("/tools/breach")
async def tools_breach_check(body: ToolsBreachIn, request: Request):
    """Public breach checker (no LLM). Queries XposedOrNot free API.
    Privacy: we only forward the email to XposedOrNot — never log it.
    """
    quota = await _tools_consume_quota(request, "breach")
    email = body.email.strip().lower()
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            r = await c.get(f"https://api.xposedornot.com/v1/breach-analytics", params={"email": email})
    except Exception as e:
        log.warning("breach api failed: %s", e)
        raise HTTPException(status_code=502, detail="Breach service is temporarily unavailable")

    if r.status_code == 404:
        # Not found = good news (no breaches)
        return {"breached": False, "count": 0, "breaches": [], "exposure_score": 0, "industries": [], "quota": quota}
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Breach service returned an error")
    data = r.json() or {}

    # Normalise XposedOrNot's response into something the frontend can render simply.
    bm = (data.get("BreachMetrics") or {})
    breaches_list = (data.get("ExposedBreaches") or {}).get("breaches_details") or []
    industry_arr = (bm.get("industry") or [[]])[0] if bm.get("industry") else []
    risk = ((bm.get("risk") or [{}])[0] or {})

    out = {
        "breached": bool(breaches_list),
        "count": len(breaches_list),
        "exposure_score": int(risk.get("risk_score") or 0),
        "risk_label": str(risk.get("risk_label") or "Low"),
        "breaches": [
            {
                "name": b.get("breach") or b.get("name") or "Unknown",
                "domain": b.get("domain") or "",
                "date": b.get("xposed_date") or b.get("breach_date") or "",
                "records": b.get("xposed_records") or b.get("xposed_count") or 0,
                "data": b.get("xposed_data") or "",
                "description": (b.get("details") or "")[:280],
                "logo": b.get("logo") or "",
            }
            for b in breaches_list[:25]
        ],
        "industries": [
            {"industry": x[0], "count": x[1]} for x in (industry_arr or []) if isinstance(x, list) and len(x) >= 2 and x[1]
        ][:8],
    }
    try:
        await db.tool_usage.insert_one({"tool": "breach", "count": out["count"], "ts": _now_iso()})
    except Exception:
        pass
    out["quota"] = quota
    return out


# --- Recovery Odds Calculator (rule-based) ---
_BASE_ODDS = {
    "hacked":           {"odds": 55, "days": (3, 7)},
    "disabled":         {"odds": 35, "days": (5, 14)},
    "locked_2fa":       {"odds": 70, "days": (2, 5)},
    "forgot_password":  {"odds": 85, "days": (1, 3)},
    "impersonation":    {"odds": 60, "days": (5, 21)},
    "shadowban":        {"odds": 50, "days": (14, 30)},
}
_PLATFORM_MOD = {"instagram": 0, "facebook": -5, "tiktok": -10, "snapchat": -8, "twitter": -3}
_WHEN_MOD = {"today": 12, "week": 5, "month": -8, "older": -20}

@api.post("/tools/recovery-odds")
async def tools_recovery_odds(body: ToolsOddsIn):
    base = _BASE_ODDS.get(body.issue.lower(), {"odds": 50, "days": (5, 14)})
    odds = base["odds"]
    odds += _PLATFORM_MOD.get(body.platform.lower(), -5)
    odds += _WHEN_MOD.get(body.when.lower(), 0)
    if body.has_email: odds += 8
    if body.has_phone: odds += 6
    if body.has_id:    odds += 5
    odds = max(5, min(95, odds))

    dmin, dmax = base["days"]
    if body.when in ("month", "older"):
        dmin += 2; dmax += 5
    if not body.has_email and not body.has_phone:
        dmin += 3; dmax += 7

    pro_uplift = min(95, odds + 25)  # what ERRORHACKER team adds on top of self-attempt odds
    if odds >= 70:    tier = "high"
    elif odds >= 45:  tier = "medium"
    else:             tier = "low"

    try:
        await db.tool_usage.insert_one({"tool": "odds", "issue": body.issue, "platform": body.platform, "ts": _now_iso()})
    except Exception:
        pass
    return {
        "self_odds": odds,
        "pro_odds":  pro_uplift,
        "days_min":  dmin,
        "days_max":  dmax,
        "tier":      tier,
        "note":      "Estimates are based on aggregate ERRORHACKER cases — your individual result may vary.",
    }


# --- Phishing/Smishing Detector (LLM) ---
PHISHING_PROMPT = (
    "You are a cyber-security analyst specializing in phishing, smishing, and social-engineering attacks. "
    "Analyse the message the user pastes and respond in STRICT JSON ONLY (no markdown), with these keys:\n"
    "  risk_level: one of \"safe\", \"low\", \"medium\", \"high\", \"critical\"\n"
    "  confidence: integer 0-100\n"
    "  red_flags: array of short strings (max 6) listing concrete suspicious indicators\n"
    "  green_flags: array of short strings (max 3) for any legitimate signals\n"
    "  verdict: one short sentence verdict (<= 120 chars)\n"
    "  action: a single sentence recommended action for the user.\n"
    "If it looks safe, set risk_level=\"safe\" and explain why. Never invent details not in the message."
)

@api.post("/tools/phishing-check")
async def tools_phishing_check(body: ToolsPhishingIn, request: Request):
    msg = (body.message or "").strip()
    if len(msg) < 8:
        raise HTTPException(status_code=400, detail="Paste the full suspicious message (at least 8 chars).")
    if len(msg) > 6000:
        raise HTTPException(status_code=400, detail="Message too long — paste under 6000 characters.")
    quota = await _tools_consume_quota(request, "phishing")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        log.error("emergentintegrations import failed: %s", e)
        raise HTTPException(status_code=500, detail="AI analysis unavailable")
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="AI key not configured")

    sid = uuid.uuid4().hex
    chat = LlmChat(api_key=key, session_id=sid, system_message=PHISHING_PROMPT).with_model("anthropic", "claude-sonnet-4-5-20250929")
    user_msg = f"Channel: {body.channel}\n---message---\n{msg}\n---end---"
    try:
        reply = await chat.send_message(UserMessage(text=user_msg))
    except Exception as e:
        log.warning("phishing check failed: %s", e)
        raise HTTPException(status_code=502, detail="AI temporarily unavailable")
    if not reply:
        raise HTTPException(status_code=502, detail="AI returned empty response")

    import json as _json, re as _re
    parsed = None
    try:
        parsed = _json.loads(reply)
    except Exception:
        # extract first {...} block in case the model wrapped it
        m = _re.search(r"\{[\s\S]*\}", reply)
        if m:
            try:
                parsed = _json.loads(m.group(0))
            except Exception:
                parsed = None
    if not isinstance(parsed, dict):
        # graceful fallback — give the user the raw text wrapped
        parsed = {"risk_level": "medium", "confidence": 50, "red_flags": [], "green_flags": [], "verdict": (reply or "")[:160], "action": "Treat the message with caution and verify with the official app/site."}

    parsed["risk_level"] = str(parsed.get("risk_level", "medium")).lower()
    if parsed["risk_level"] not in ("safe", "low", "medium", "high", "critical"):
        parsed["risk_level"] = "medium"
    try:
        parsed["confidence"] = max(0, min(100, int(parsed.get("confidence") or 0)))
    except Exception:
        parsed["confidence"] = 60

    try:
        await db.tool_usage.insert_one({"tool": "phishing", "risk": parsed["risk_level"], "ts": _now_iso()})
    except Exception:
        pass
    parsed["quota"] = quota
    return parsed


# --- Account Worth Estimator (rule-based) ---
_NICHE_CPM = {
    "finance":   {"min": 35.0, "max": 80.0},
    "tech":      {"min": 25.0, "max": 60.0},
    "fashion":   {"min": 22.0, "max": 55.0},
    "beauty":    {"min": 20.0, "max": 50.0},
    "fitness":   {"min": 18.0, "max": 45.0},
    "food":      {"min": 14.0, "max": 35.0},
    "travel":    {"min": 16.0, "max": 40.0},
    "gaming":    {"min": 10.0, "max": 28.0},
    "meme":      {"min": 6.0,  "max": 18.0},
    "other":     {"min": 8.0,  "max": 22.0},
}
_TIER_MULT = {"tier1": 1.0, "tier2": 0.38, "tier3": 0.22}
USD_TO_INR = 83.0

@api.post("/tools/account-worth")
async def tools_account_worth(body: ToolsAccountWorthIn):
    if body.followers < 100:
        raise HTTPException(status_code=400, detail="Followers must be at least 100 to estimate worth.")
    cpm = _NICHE_CPM.get(body.niche.lower(), _NICHE_CPM["other"])
    mult = _TIER_MULT.get(body.country_tier.lower(), _TIER_MULT["tier2"])
    # Engagement adjustment (industry rule of thumb)
    er = 0.0
    if body.followers > 0:
        er = ((body.avg_likes + body.avg_comments * 2) / body.followers) * 100
    er = max(0.0, min(20.0, er))
    er_mult = 0.6 + (er / 4.0)  # 1.0 at 1.6% ER, 1.6 at 4%, capped
    er_mult = max(0.6, min(2.5, er_mult))

    # Per-post sponsored estimate (USD)
    per_post_min_usd = (body.followers / 1000.0) * cpm["min"] * mult * er_mult
    per_post_max_usd = (body.followers / 1000.0) * cpm["max"] * mult * er_mult

    if body.verified:
        per_post_min_usd *= 1.35
        per_post_max_usd *= 1.45

    # Account market value (rule: 10–18× per-post sponsored)
    acc_min_usd = per_post_min_usd * 10
    acc_max_usd = per_post_max_usd * 18

    try:
        await db.tool_usage.insert_one({"tool": "account_worth", "platform": body.platform, "followers": body.followers, "ts": _now_iso()})
    except Exception:
        pass

    return {
        "per_post_usd_min": round(per_post_min_usd, 2),
        "per_post_usd_max": round(per_post_max_usd, 2),
        "account_usd_min":  round(acc_min_usd, 0),
        "account_usd_max":  round(acc_max_usd, 0),
        "per_post_inr_min": round(per_post_min_usd * USD_TO_INR, 0),
        "per_post_inr_max": round(per_post_max_usd * USD_TO_INR, 0),
        "account_inr_min":  round(acc_min_usd * USD_TO_INR, 0),
        "account_inr_max":  round(acc_max_usd * USD_TO_INR, 0),
        "engagement_rate":  round(er, 2),
        "niche": body.niche.lower(),
        "verified": body.verified,
        "country_tier": body.country_tier,
    }


# --- Video-Selfie Prep Coach (rule-based) ---
@api.post("/tools/selfie-coach")
async def tools_selfie_coach(body: ToolsSelfieIn):
    score = 100
    tips = []
    blockers = []

    if body.lighting == "dim":
        score -= 30
        blockers.append("Move to bright, even daylight (window light is best). Dim lighting is the #1 reason selfie verification fails.")
    elif body.lighting == "mixed":
        score -= 10
        tips.append("Try to find one consistent light source — mixed sun/lamp light creates harsh shadows.")

    if body.background == "busy":
        score -= 10
        tips.append("Stand in front of a plain wall — busy backgrounds confuse the AI verifier.")
    elif body.background == "unsafe":
        score -= 20
        blockers.append("Move to a private spot — never record with family/personal items visible in frame.")

    if not body.holding_id:
        score -= 15
        tips.append("If asked to hold ID, hold it next to your face — not in front of it.")
    if not body.matches_profile:
        score -= 25
        blockers.append("Your face/style must match the last few photos on your profile (same haircut, glasses, etc.).")

    score = max(0, min(100, score))
    if score >= 80:    tier = "ready"
    elif score >= 50:  tier = "needs-work"
    else:              tier = "high-risk"

    universal_dos = [
        "Look directly at the camera. No sunglasses, no hat, no filter.",
        "Hold the phone steady at eye level for the full recording.",
        "Say or do exactly what the on-screen prompt asks — no extra motions.",
        "Record in landscape or portrait as the prompt requests — do not flip.",
    ]
    universal_donts = [
        "Don't upload your selfie anywhere else — only inside the official Instagram app.",
        "Don't pay a 'recovery service' that asks you to send a selfie to them.",
        "Don't redo the verification more than once a day — repeated tries can blacklist you for 24h.",
    ]

    try:
        await db.tool_usage.insert_one({"tool": "selfie", "score": score, "ts": _now_iso()})
    except Exception:
        pass
    return {
        "score": score,
        "tier": tier,
        "blockers": blockers,
        "tips": tips,
        "universal_dos": universal_dos,
        "universal_donts": universal_donts,
    }


# ---- Announcement System (admin → Telegram + Resend blast) -----------------
@api.get("/announcements")
async def list_announcements_public():
    rows = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return rows

@api.get("/admin/announcements")
async def list_announcements_admin(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return rows

@api.get("/admin/announcements/audience")
async def announcement_audience_count(audience: str = "all", x_admin_token: Optional[str] = Header(None)):
    """Returns counts for the chosen audience — so admin can preview before BLAST IT."""
    await _check_admin(x_admin_token)
    f: Dict[str, Any] = {}
    if audience == "wallet":
        f = {"balance": {"$gt": 0}}
    elif audience == "paying":
        paid_uids = await db.orders.distinct("user_id", {"status": {"$in": ["paid", "completed", "delivered"]}})
        f = {"user_id": {"$in": paid_uids}} if paid_uids else {"user_id": "__none__"}
    total = await db.users.count_documents(f)
    tg = await db.users.count_documents({**f, "telegram_chat_id": {"$exists": True, "$ne": None}})
    email = await db.users.count_documents({**f, "email": {"$exists": True, "$ne": None}, "email_optout": {"$ne": True}})
    return {"audience": audience, "total": total, "telegram_reachable": tg, "email_reachable": email}


async def _run_announcement_blast(ann_id: str, doc: Dict[str, Any], audience_filter: Dict[str, Any], full_link: str):
    """Background worker — performs the actual TG + email blast and updates counters."""
    # Telegram
    if doc.get("send_telegram"):
        try:
            token = await _get_bot_token()
            if token:
                tg_filter = {**audience_filter, "telegram_chat_id": {"$exists": True, "$ne": None}}
                cursor = db.users.find(tg_filter, {"telegram_chat_id": 1})
                sent = 0; failed = 0
                tg_message = f"📣 *{doc['title']}*\n\n{doc['body']}"
                if full_link:
                    tg_message += f"\n\n🔗 {full_link}"
                async for u in cursor:
                    cid = u.get("telegram_chat_id")
                    if not cid: continue
                    r = await _tg_send(token, cid, tg_message)
                    if r.get("ok"): sent += 1
                    else:           failed += 1
                    await asyncio.sleep(0.05)
                await db.announcements.update_one({"id": ann_id}, {"$set": {"tg_sent": sent, "tg_failed": failed}})
        except Exception as e:
            log.error("announcement TG blast failed: %s", e)

    # Resend
    if doc.get("send_email"):
        try:
            from email_service import send_email, _wrap
            email_filter = {**audience_filter, "email": {"$exists": True, "$ne": None}, "email_optout": {"$ne": True}}
            cursor = db.users.find(email_filter, {"email": 1, "name": 1})
            sent = 0; failed = 0
            preheader = doc["body"][:120]
            html_body = f'<p style="margin:0 0 10px 0">{doc["body"].replace(chr(10), "<br>")}</p>'
            html = _wrap(doc["title"], preheader, html_body, cta_label="OPEN" if full_link else "", cta_url=full_link)
            async for u in cursor:
                em = u.get("email")
                if not em: continue
                r = await send_email(em, doc["title"], html)
                if r.get("ok"): sent += 1
                else:           failed += 1
            await db.announcements.update_one({"id": ann_id}, {"$set": {"email_sent": sent, "email_failed": failed}})
        except Exception as e:
            log.error("announcement email blast failed: %s", e)

    # Mark tool as NEW in config if tool_id was supplied (so the tile shows a NEW badge)
    if doc.get("tool_id"):
        await db.tool_meta.update_one(
            {"tool_id": doc["tool_id"]},
            {"$set": {"is_new": True, "marked_at": _now_iso(), "announcement_id": ann_id}},
            upsert=True,
        )
    await db.announcements.update_one({"id": ann_id}, {"$set": {"status": "sent", "finished_at": _now_iso()}})


@api.post("/admin/announcements")
async def create_announcement(body: AnnouncementIn, x_admin_token: Optional[str] = Header(None)):
    """Create an announcement + schedule a background blast. Returns immediately."""
    await _check_admin(x_admin_token)
    if not body.title.strip() or not body.body.strip():
        raise HTTPException(status_code=400, detail="title and body are required")

    ann_id = uuid.uuid4().hex
    doc = {
        "id": ann_id,
        "title": body.title.strip(),
        "body": body.body.strip(),
        "link": (body.link or "").strip(),
        "tool_id": (body.tool_id or "").strip(),
        "audience": body.audience or "all",
        "send_telegram": body.send_telegram,
        "send_email": body.send_email,
        "tg_sent": 0, "tg_failed": 0,
        "email_sent": 0, "email_failed": 0,
        "status": "sending",
        "created_at": _now_iso(),
    }
    await db.announcements.insert_one(doc)

    # Audience selector for email + telegram
    audience_filter: Dict[str, Any] = {}
    if body.audience == "wallet":
        audience_filter = {"balance": {"$gt": 0}}
    elif body.audience == "paying":
        paid_uids = await db.orders.distinct("user_id", {"status": {"$in": ["paid", "completed", "delivered"]}})
        audience_filter = {"user_id": {"$in": paid_uids}} if paid_uids else {"user_id": "__none__"}

    site_url = os.environ.get("SITE_URL", "https://errorhacker.site").rstrip("/")
    full_link = ""
    if doc["link"]:
        full_link = doc["link"] if doc["link"].startswith("http") else f"{site_url}{doc['link']}"

    # Fire-and-forget — the request returns immediately, the blast runs in the background.
    asyncio.create_task(_run_announcement_blast(ann_id, doc, audience_filter, full_link))

    return await db.announcements.find_one({"id": ann_id}, {"_id": 0})

@api.delete("/admin/announcements/{ann_id}")
async def delete_announcement(ann_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await db.announcements.delete_one({"id": ann_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


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
    # If a password was provided, set/reset it for both new and existing users
    pw = body.get("password") or ""
    if pw:
        if len(pw) < 6:
            raise HTTPException(status_code=400, detail="password must be 6+ chars")
        upd["password_hash"] = _hash_pw(pw)
    if not u:
        # Brand-new account requires a password
        if not pw:
            raise HTTPException(status_code=400, detail="password (6+ chars) required to create new mod")
        u = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": body.get("name") or email.split("@")[0],
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

# ---- Wallet --------------------------------------------------------------
async def _wallet_get_or_create(user_id: str) -> Dict[str, Any]:
    w = await db.wallets.find_one({"user_id": user_id})
    if not w:
        w = {
            "user_id": user_id,
            "balance": 0.0,
            "currency": "INR",
            "createdAt": _now_iso(),
        }
        await db.wallets.insert_one(w)
    return _clean(w)

async def _wallet_txn(user_id: str, type_: str, amount: float, note: str = "", ref: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Atomic wallet credit/debit + transaction log. `type_` in credit|debit|spin|cashback|refund."""
    w = await _wallet_get_or_create(user_id)
    sign = 1 if type_ in ("credit", "spin", "cashback", "refund") else -1
    new_bal = round((w.get("balance") or 0) + sign * float(amount), 2)
    if new_bal < 0:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    await db.wallets.update_one({"user_id": user_id}, {"$set": {"balance": new_bal, "updated_at": _now_iso()}})
    txn = {
        "id": f"WTX-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "type": type_,
        "amount": float(amount),
        "balance_after": new_bal,
        "note": note,
        "ref": ref or {},
        "createdAt": _now_iso(),
    }
    await db.wallet_txns.insert_one(txn)
    return {**txn, "_id": None, "balance": new_bal}

@api.get("/me/wallet")
async def me_wallet(request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    w = await _wallet_get_or_create(user["user_id"])
    return w

@api.get("/me/wallet/transactions")
async def me_wallet_txns(request: Request, limit: int = 50):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    rows = await db.wallet_txns.find({"user_id": user["user_id"]}).sort("createdAt", -1).to_list(min(limit, 200))
    return [_clean(r) for r in rows]

@api.get("/me/wallet/transactions/{txn_id}")
async def me_wallet_txn_one(txn_id: str, request: Request):
    """Fetch a single wallet transaction — used by the printable receipt page."""
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    txn = await db.wallet_txns.find_one({"id": txn_id, "user_id": user["user_id"]})
    if not txn:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return _clean(txn)

@api.post("/me/wallet/deposit")
async def me_wallet_deposit_request(body: WalletDepositRequestIn, request: Request):
    """Customer submits a deposit proof — admin must approve before crediting wallet.
    This is the manual path. Razorpay/Stripe will auto-credit via webhook later."""
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    dep = {
        "id": f"DEP-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user["user_id"],
        "user_email": user.get("email"),
        "amount": float(body.amount),
        "currency": "INR",
        "method": body.method,
        "coin": body.coin or "",
        "tx_reference": body.tx_reference or "",
        "proof_url": body.proof_url or "",
        "status": "pending",
        "createdAt": _now_iso(),
    }
    await db.wallet_deposits.insert_one(dep)
    dep.pop("_id", None)
    # Notify admins via Telegram bot with Approve/Decline inline buttons (new path).
    asyncio.create_task(_notify_admins_deposit_pending(dep))
    # Legacy generic alert (kept for backwards-compat with the old single-channel notifier).
    try:
        cfg = await _ensure_config()
        notif = (cfg.get("notifications") or {}).get("telegram") or {}
        if notif.get("enabled") and notif.get("bot_token") and notif.get("chat_id"):
            asyncio.create_task(_telegram_send(notif.get("bot_token", ""), notif.get("chat_id", ""),
                f"<b>WALLET DEPOSIT // ERRORHACKER</b>\n<b>User:</b> {user.get('email')}\n<b>Amount:</b> ₹{body.amount}\n<b>Method:</b> {body.method} {body.coin or ''}\n<b>Ref:</b> {body.tx_reference}\n<b>Proof:</b> {body.proof_url or '—'}"))
    except Exception:
        pass
    return dep

@api.get("/admin/wallet/deposits")
async def admin_wallet_deposits(x_admin_token: Optional[str] = Header(None), status: Optional[str] = None):
    await _check_admin(x_admin_token)
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    rows = await db.wallet_deposits.find(q).sort("createdAt", -1).to_list(500)
    return [_clean(r) for r in rows]

@api.post("/admin/wallet/deposits/{deposit_id}/approve")
async def admin_wallet_deposit_approve(deposit_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    res = await _approve_deposit_internal(deposit_id)
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error") or "Approval failed")
    return res

@api.post("/admin/wallet/deposits/{deposit_id}/reject")
async def admin_wallet_deposit_reject(deposit_id: str, x_admin_token: Optional[str] = Header(None), reason: Optional[str] = ""):
    await _check_admin(x_admin_token)
    res = await _reject_deposit_internal(deposit_id, reason=reason or "")
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error") or "Reject failed")
    return res

@api.post("/admin/wallet/{user_id}/adjust")
async def admin_wallet_adjust(user_id: str, body: WalletAdjustIn, x_admin_token: Optional[str] = Header(None)):
    """Admin can manually credit or debit a user's wallet (bonuses, refunds, corrections)."""
    await _check_admin(x_admin_token)
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    txn = await _wallet_txn(user_id, body.type, body.amount, note=body.note or f"Admin {body.type}")
    return txn

@api.get("/admin/wallets")
async def admin_wallets_list(x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    rows = await db.wallets.find().sort("balance", -1).to_list(500)
    out = []
    for r in rows:
        u = await db.users.find_one({"user_id": r["user_id"]}, {"_id": 0, "email": 1, "name": 1})
        out.append({**_clean(r), "email": (u or {}).get("email"), "name": (u or {}).get("name")})
    return out


# ---- Cashfree Payment Gateway -------------------------------------------
# All payment-creation routes live in /app/backend/routes/cashfree.py.
# Only the shared reconcile helper stays here because admin paths + other
# modules call it directly.
import cashfree_service as cf  # noqa: E402


async def _cashfree_reconcile(cf_order_id: str, latest: Dict[str, Any]):
    """Apply business effects exactly once for a Cashfree order that reaches PAID."""
    pending = await db.cashfree_orders.find_one({"id": cf_order_id})
    if not pending:
        return  # unknown — ignore
    new_status = latest.get("order_status")
    # Atomic transition: only credit/mark when previous status != PAID
    if new_status == "PAID" and pending.get("status") != "PAID":
        r = await db.cashfree_orders.find_one_and_update(
            {"id": cf_order_id, "status": {"$ne": "PAID"}},
            {"$set": {"status": "PAID", "paid_at": _now_iso(), "last_snapshot": latest}},
        )
        if not r:
            return  # someone else got here first
        try:
            if pending.get("purpose") == "wallet_topup":
                txn = await _wallet_txn(
                    pending["user_id"], "credit", float(pending.get("amount") or 0),
                    note=f"Cashfree top-up · {cf_order_id}",
                    ref={"cf_order_id": cf_order_id, "method": "cashfree"},
                )
                # email notify
                user = await db.users.find_one({"user_id": pending["user_id"]}) or {}
                wallet = await db.wallets.find_one({"user_id": pending["user_id"]}) or {}
                if user.get("email"):
                    try: asyncio.create_task(notify_wallet_credited(
                        user["email"], user.get("name", ""),
                        float(pending["amount"]), float(wallet.get("balance") or 0),
                    ))
                    except Exception as e: log.warning("notify_wallet_credited dispatch failed: %s", e)
                    if txn:
                        try: asyncio.create_task(send_wallet_receipt_email(
                            user["email"], user.get("name", ""), _clean(txn), float(wallet.get("balance") or 0),
                        ))
                        except Exception as e: log.warning("send_wallet_receipt_email dispatch failed: %s", e)
            elif pending.get("purpose") == "service_payment" and pending.get("app_order_id"):
                # Mark the app order verified
                await db.orders.find_one_and_update(
                    {"id": pending["app_order_id"], "status": {"$nin": ["verified", "paid", "in-progress", "delivered"]}},
                    {"$set": {
                        "status": "verified",
                        "payment_method": "cashfree",
                        "payment_amount": float(pending.get("amount") or 0),
                        "payment_submitted_at": _now_iso(),
                        "payment_verified_at": _now_iso(),
                        "cf_order_id": cf_order_id,
                    }},
                )
                user = await db.users.find_one({"user_id": pending["user_id"]}) or {}
                if user.get("email"):
                    ord_doc = await db.orders.find_one({"id": pending["app_order_id"]}) or {}
                    try: asyncio.create_task(notify_order_status(
                        user["email"], user.get("name", ""),
                        pending["app_order_id"], "paid",
                        ord_doc.get("serviceName") or ord_doc.get("service") or "",
                    ))
                    except Exception as e: log.warning("notify_order_status dispatch failed: %s", e)
                    try: asyncio.create_task(send_order_receipt_email(
                        user["email"], user.get("name", ""),
                        ord_doc, float(pending.get("amount") or 0), method="cashfree",
                    ))
                    except Exception as e: log.warning("send_order_receipt_email dispatch failed: %s", e)
        except Exception as e:
            log.warning("Cashfree reconcile side-effect failed: %s", e)
    elif new_status in ("EXPIRED", "TERMINATED", "FAILED") and pending.get("status") != new_status:
        await db.cashfree_orders.update_one(
            {"id": cf_order_id}, {"$set": {"status": new_status, "last_snapshot": latest}},
        )


# ---- Pay an order with wallet balance (one-tap) --------------------------
@api.post("/me/orders/{order_id}/pay-with-wallet")
async def me_pay_with_wallet(order_id: str, request: Request):
    """Atomic one-tap payment using wallet balance. Marks order paid + verified.
    Sends order-paid email + Telegram alert. Fails clean on insufficient balance."""
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("user_id") and order.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.get("status") in ("verified", "paid", "in-progress", "delivered"):
        raise HTTPException(status_code=400, detail="Order is already paid")
    # Figure out price — prefer admin-set payment_amount, fall back to service price
    amount = float(order.get("payment_amount") or order.get("amount") or 0)
    if amount <= 0:
        # Look up live service price for this order
        sid = order.get("service")
        if sid:
            svc = await db.services.find_one({"id": sid})
            if svc:
                amount = float(svc.get("price") or 0) * int(order.get("qty") or order.get("size") or 1)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Order price not set yet — ask admin to send a quote first")
    wallet = await _wallet_get_or_create(user["user_id"])
    if float(wallet.get("balance") or 0) < amount:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Need ₹{amount:.2f}, have ₹{float(wallet.get('balance') or 0):.2f}")
    # Atomic debit
    txn = await _wallet_txn(
        user["user_id"], "debit", amount,
        note=f"Order payment · {order.get('serviceName') or order.get('service') or order_id}",
        ref={"order_id": order_id},
    )
    await db.orders.update_one({"id": order_id}, {"$set": {
        "status": "verified",
        "payment_method": "wallet",
        "payment_amount": amount,
        "payment_currency": "INR",
        "payment_submitted_at": _now_iso(),
        "payment_verified_at": _now_iso(),
        "wallet_txn_id": txn.get("id"),
    }})
    updated = await db.orders.find_one({"id": order_id})
    # Fire-and-forget notifications
    if user.get("email"):
        # Each dispatch in its own try/except so a single Resend hiccup doesn't
        # swallow the others (iter-11 testing-agent recommendation).
        try: asyncio.create_task(notify_order_status(user["email"], user.get("name", ""), order_id, "paid", updated.get("serviceName") or updated.get("service") or ""))
        except Exception as e: log.warning("notify_order_status dispatch failed: %s", e)
        try: asyncio.create_task(send_wallet_receipt_email(user["email"], user.get("name", ""), txn, float(wallet.get("balance") or 0) - amount))
        except Exception as e: log.warning("send_wallet_receipt_email dispatch failed: %s", e)
        try: asyncio.create_task(send_order_receipt_email(user["email"], user.get("name", ""), updated, amount, method="wallet"))
        except Exception as e: log.warning("send_order_receipt_email dispatch failed: %s", e)
    return {"ok": True, "order": _clean(updated), "txn_id": txn.get("id"), "balance_after": float(wallet.get("balance") or 0) - amount}


# ---- Refund tracking system ---------------------------------------------
class RefundCreateIn(BaseModel):
    order_id: str = Field(..., min_length=3)
    reason: str = Field(..., min_length=8, max_length=2000)
    proof_url: Optional[str] = ""

class RefundUpdateIn(BaseModel):
    status: Optional[str] = None  # requested | reviewing | approved | rejected | processed | completed
    admin_note: Optional[str] = None
    refund_amount: Optional[float] = None
    refund_method: Optional[str] = None  # wallet | upi | bank | crypto

REFUND_STATUSES = ("requested", "reviewing", "approved", "rejected", "processed", "completed")

async def _notify_admins_refund(refund: Dict[str, Any]):
    try:
        bot_token = await _get_bot_token()
        if not bot_token:
            return
        bot_cfg = await _get_bot_cfg()
        admin_ids = bot_cfg.get("admin_chat_ids") or []
        if not admin_ids:
            return
        text = (
            f"↻ <b>REFUND REQUESTED</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"<b>▸ Refund ID</b>  <code>{refund.get('id')}</code>\n"
            f"<b>▸ Order</b>      <code>{refund.get('order_id')}</code>\n"
            f"<b>▸ User</b>       {refund.get('user_email', '—')}\n"
            f"<b>▸ Amount</b>     ₹{refund.get('order_amount', 0):,.2f}\n"
            f"<b>▸ Reason</b>     {(refund.get('reason') or '')[:200]}"
        )
        for cid in admin_ids:
            try: await _tg_send(bot_token, int(cid), text)
            except Exception: continue
    except Exception as e:
        log.error("notify_admins_refund failed: %s", e)

@api.post("/me/refunds")
async def me_refund_create(body: RefundCreateIn, request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    order = await db.orders.find_one({"id": body.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("user_id") and order.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    # one open refund per order
    existing = await db.refunds.find_one({"order_id": body.order_id, "status": {"$nin": ["rejected", "completed"]}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Refund already in progress · {existing.get('id')}")
    refund = {
        "id": f"RFD-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user["user_id"],
        "user_email": user.get("email"),
        "order_id": body.order_id,
        "order_amount": float(order.get("payment_amount") or order.get("amount") or 0),
        "order_service": order.get("serviceName") or order.get("service") or "",
        "reason": body.reason.strip(),
        "proof_url": body.proof_url or "",
        "status": "requested",
        "admin_note": "",
        "refund_amount": 0.0,
        "refund_method": "",
        "timeline": [{"status": "requested", "at": _now_iso(), "note": "Customer submitted refund request"}],
        "createdAt": _now_iso(),
    }
    await db.refunds.insert_one(refund)
    asyncio.create_task(_notify_admins_refund(refund))
    return _clean(refund)

@api.get("/me/refunds")
async def me_refunds_list(request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    rows = await db.refunds.find({"user_id": user["user_id"]}).sort("createdAt", -1).to_list(100)
    return [_clean(r) for r in rows]

@api.get("/me/refunds/{refund_id}")
async def me_refund_one(refund_id: str, request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    r = await db.refunds.find_one({"id": refund_id, "user_id": user["user_id"]})
    if not r:
        raise HTTPException(status_code=404, detail="Refund not found")
    return _clean(r)

@api.get("/refunds/track/{refund_id}")
async def refund_public_track(refund_id: str):
    """Public lightweight tracker — only returns non-PII fields. Lets users with the ID track without login."""
    r = await db.refunds.find_one({"id": refund_id})
    if not r:
        raise HTTPException(status_code=404, detail="Refund not found")
    return {
        "id": r.get("id"),
        "order_id": r.get("order_id"),
        "order_service": r.get("order_service"),
        "order_amount": r.get("order_amount"),
        "status": r.get("status"),
        "refund_amount": r.get("refund_amount"),
        "refund_method": r.get("refund_method"),
        "admin_note": r.get("admin_note"),
        "timeline": r.get("timeline") or [],
        "createdAt": r.get("createdAt"),
    }

@api.get("/admin/refunds")
async def admin_refunds_list(x_admin_token: Optional[str] = Header(None), status: Optional[str] = None):
    await _check_admin(x_admin_token)
    q: Dict[str, Any] = {}
    if status: q["status"] = status
    rows = await db.refunds.find(q).sort("createdAt", -1).to_list(500)
    return [_clean(r) for r in rows]

@api.get("/admin/refunds/lookup/{tracking_id}")
async def admin_refunds_lookup(tracking_id: str, x_admin_token: Optional[str] = Header(None)):
    """Admin-only: resolve any tracking ID (ORD-, REC-, RFD-) into a refundable target.
    Returns { kind, order, user, suggested_amount, existing_refunds }."""
    await _check_admin(x_admin_token)
    tid = (tracking_id or "").strip()
    if not tid:
        raise HTTPException(status_code=400, detail="Missing tracking_id")
    out: Dict[str, Any] = {"tracking_id": tid, "kind": None, "order": None, "user": None, "suggested_amount": 0.0, "existing_refunds": []}

    # 1) Try as refund
    rfd = await db.refunds.find_one({"id": tid})
    if rfd:
        out["kind"] = "refund"
        out["existing_refunds"] = [_clean(rfd)]
        ord_id = rfd.get("order_id")
        if ord_id:
            o = await db.orders.find_one({"id": ord_id})
            if o: out["order"] = _clean(o)
        out["suggested_amount"] = float(rfd.get("refund_amount") or rfd.get("order_amount") or 0)
    else:
        # 2) Try as order
        order = await db.orders.find_one({"id": tid})
        if not order:
            # 3) Try as recovery case → resolve to linked order
            case = await db.recovery_cases.find_one({"id": tid})
            if case and case.get("linked_order_id"):
                order = await db.orders.find_one({"id": case["linked_order_id"]})
                out["kind"] = "recovery_case"
            elif case:
                out["kind"] = "recovery_case_no_order"
                out["order"] = _clean(case)
                out["suggested_amount"] = float(case.get("final_amount") or case.get("estimated_price") or 0)
        if order:
            out["kind"] = out["kind"] or "order"
            out["order"] = _clean(order)
            out["suggested_amount"] = float(order.get("payment_amount") or order.get("amount") or 0)
            rl = await db.refunds.find({"order_id": order["id"]}).sort("createdAt", -1).to_list(20)
            out["existing_refunds"] = [_clean(r) for r in rl]

    # Resolve user
    target = out["order"] or {}
    user = None
    if target.get("user_id"):
        user = await db.users.find_one({"user_id": target["user_id"]})
    if not user:
        email = target.get("email") or target.get("userEmail") or target.get("contact_email")
        if email:
            user = await db.users.find_one({"email": email})
    if user:
        out["user"] = {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "balance": float(user.get("balance") or 0),
            "telegram_chat_id": user.get("telegram_chat_id"),
        }

    if not out["kind"]:
        raise HTTPException(status_code=404, detail=f"No order, recovery case, or refund found for {tid}")
    return out


@api.post("/admin/refunds/issue")
async def admin_refunds_issue(body: DirectRefundIn, x_admin_token: Optional[str] = Header(None)):
    """Admin-only: issue a refund directly for ANY tracking ID without waiting for a customer request."""
    await _check_admin(x_admin_token)
    tid = (body.tracking_id or "").strip()
    rfd_existing = await db.refunds.find_one({"id": tid})
    order: Dict[str, Any] = {}
    case: Dict[str, Any] = {}
    if rfd_existing:
        ord_id = rfd_existing.get("order_id")
        if ord_id:
            order = await db.orders.find_one({"id": ord_id}) or {}
    else:
        order = await db.orders.find_one({"id": tid}) or {}
        if not order:
            case = await db.recovery_cases.find_one({"id": tid}) or {}
            if case and case.get("linked_order_id"):
                order = await db.orders.find_one({"id": case["linked_order_id"]}) or {}

    if not (order or case or rfd_existing):
        raise HTTPException(status_code=404, detail=f"No refundable target for {tid}")

    user = None
    target = order or case or rfd_existing or {}
    if target.get("user_id"):
        user = await db.users.find_one({"user_id": target["user_id"]})
    if not user:
        email = target.get("email") or target.get("userEmail") or target.get("contact_email") or target.get("user_email")
        if email:
            user = await db.users.find_one({"email": email})

    method = (body.method or "wallet").lower()
    amount = float(body.amount)

    if rfd_existing:
        refund_id = rfd_existing["id"]
        timeline = list(rfd_existing.get("timeline") or [])
        timeline.append({"status": "approved", "at": _now_iso(), "note": f"Admin direct-issue ₹{amount} via {method}"})
        upd = {
            "refund_amount": amount,
            "refund_method": method,
            "admin_note": body.reason or rfd_existing.get("admin_note", ""),
            "timeline": timeline,
            "updated_at": _now_iso(),
        }
    else:
        refund_id = f"RFD-{uuid.uuid4().hex[:10].upper()}"
        record = {
            "id": refund_id,
            "user_id": (user or {}).get("user_id"),
            "user_email": (user or {}).get("email") or target.get("email") or target.get("contact_email") or "",
            "order_id": (order or {}).get("id") or (case or {}).get("linked_order_id") or "",
            "case_id": (case or {}).get("id") or "",
            "order_amount": float((order or {}).get("payment_amount") or (order or {}).get("amount") or (case or {}).get("final_amount") or 0),
            "order_service": (order or {}).get("serviceName") or (order or {}).get("service") or (case or {}).get("service_name") or "",
            "reason": body.reason or "Direct refund issued by admin",
            "proof_url": "",
            "status": "approved",
            "admin_note": body.reason or "Direct refund issued by admin",
            "refund_amount": amount,
            "refund_method": method,
            "timeline": [
                {"status": "requested", "at": _now_iso(), "note": "Direct issue by admin"},
                {"status": "approved", "at": _now_iso(), "note": f"Admin approved ₹{amount} via {method}"},
            ],
            "createdAt": _now_iso(),
            "direct_issue": True,
        }
        await db.refunds.insert_one(record)
        upd = {"timeline": list(record["timeline"])}  # carry forward so completed-append doesn't clobber audit trail

    final_status = "approved"
    if method == "wallet" and (user or {}).get("user_id"):
        try:
            await _wallet_txn(user["user_id"], "refund", amount,
                              note=f"Refund issued · {tid}",
                              ref={"refund_id": refund_id, "order_id": (order or {}).get("id"), "tracking_id": tid})
            final_status = "completed"
        except Exception as e:
            log.warning("direct refund wallet credit failed: %s", e)
            final_status = "approved"
    upd["status"] = final_status
    if final_status == "completed":
        upd["timeline"] = (upd.get("timeline") or []) + [{"status": "completed", "at": _now_iso(), "note": "Wallet credited"}]

    if upd:
        await db.refunds.update_one({"id": refund_id}, {"$set": upd})

    fresh = await db.refunds.find_one({"id": refund_id})

    try:
        if user and user.get("telegram_chat_id"):
            tok = await _get_bot_token()
            if tok:
                await _tg_send(tok, int(user["telegram_chat_id"]),
                    f"↻ <b>Refund processed</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"<b>▸ Amount</b>  ₹{amount:,.2f}\n"
                    f"<b>▸ Method</b>  {method.upper()}\n"
                    f"<b>▸ Ref</b>     <code>{refund_id}</code>\n"
                    f"<b>▸ Note</b>    {body.reason or '—'}",
                    {"inline_keyboard": [[{"text": "▸  Track Refund", "url": f"https://errorhacker.site/track?id={refund_id}"}]]})
    except Exception as e:
        log.warning("direct refund TG notify failed: %s", e)

    return {"ok": True, "refund": _clean(fresh), "user": ({"email": user.get("email")} if user else None)}

@api.patch("/admin/refunds/{refund_id}")
async def admin_refund_update(refund_id: str, body: RefundUpdateIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    r = await db.refunds.find_one({"id": refund_id})
    if not r:
        raise HTTPException(status_code=404, detail="Refund not found")
    upd: Dict[str, Any] = {}
    timeline = list(r.get("timeline") or [])
    if body.status and body.status in REFUND_STATUSES and body.status != r.get("status"):
        # On approve → instant wallet credit (if method is wallet, default)
        if body.status == "approved" and r.get("status") not in ("approved", "processed", "completed"):
            amount = float(body.refund_amount or r.get("order_amount") or 0)
            method = (body.refund_method or r.get("refund_method") or "wallet").lower()
            upd["refund_amount"] = amount
            upd["refund_method"] = method
            if method == "wallet" and amount > 0:
                try:
                    await _wallet_txn(r["user_id"], "refund", amount,
                                      note=f"Refund approved · order {r.get('order_id')}",
                                      ref={"refund_id": refund_id, "order_id": r.get("order_id")})
                    upd["status"] = "completed"
                    timeline.append({"status": "approved", "at": _now_iso(), "note": f"Approved ₹{amount} → wallet"})
                    timeline.append({"status": "completed", "at": _now_iso(), "note": "Wallet credited"})
                except Exception as e:
                    log.warning("refund wallet credit failed: %s", e)
                    upd["status"] = "approved"
                    timeline.append({"status": "approved", "at": _now_iso(), "note": f"Approved ₹{amount} · wallet credit failed: {e}"})
            else:
                upd["status"] = "approved"
                timeline.append({"status": "approved", "at": _now_iso(), "note": f"Approved ₹{amount} · payout via {method}"})
        else:
            upd["status"] = body.status
            timeline.append({"status": body.status, "at": _now_iso(), "note": body.admin_note or ""})
    if body.admin_note is not None:
        upd["admin_note"] = body.admin_note
    if body.refund_amount is not None:
        upd["refund_amount"] = float(body.refund_amount)
    if body.refund_method is not None:
        upd["refund_method"] = body.refund_method
    upd["timeline"] = timeline
    upd["updated_at"] = _now_iso()
    await db.refunds.update_one({"id": refund_id}, {"$set": upd})
    updated = await db.refunds.find_one({"id": refund_id})
    # Notify user via TG if linked + email
    try:
        user = await db.users.find_one({"user_id": r["user_id"]}) or {}
        if user.get("telegram_chat_id"):
            tok = await _get_bot_token()
            if tok:
                await _tg_send(tok, int(user["telegram_chat_id"]),
                    f"↻ <b>Refund update</b>\n"
                    f"━━━━━━━━━━━━━━━\n"
                    f"<b>▸ Refund</b>  <code>{refund_id}</code>\n"
                    f"<b>▸ Status</b>  <b>{(upd.get('status') or r.get('status') or '').upper()}</b>\n"
                    f"{('<i>' + (body.admin_note or '') + '</i>') if body.admin_note else ''}",
                    {"inline_keyboard": [[{"text": "▸  Open Tracker", "url": f"https://errorhacker.site/refund/{refund_id}"}]]})
    except Exception:
        pass
    return _clean(updated)

# ---- Telegram /refund command --------------------------------------------
async def _handle_refund_tg(bot_token: str, chat_id: int, raw_id: str = ""):
    rid = (raw_id or "").strip().upper()
    if not rid:
        await _tg_send(bot_token, chat_id,
                       "↻ <b>REFUND TRACKER</b>\n━━━━━━━━━━━━━━━\n\n"
                       "Send <code>/refund RFD-XXXXXXXXXX</code> to track a refund — or paste any <code>RFD-</code> ID here.\n\n"
                       "To open a new refund visit <a href=\"https://errorhacker.site/me\">errorhacker.site/me</a> → your order → <i>Request Refund</i>.")
        return
    r = await db.refunds.find_one({"id": rid})
    if not r:
        await _tg_send(bot_token, chat_id, f"✕ No refund found with ID <code>{rid}</code>.")
        return
    timeline = r.get("timeline") or []
    last_three = timeline[-3:]
    tl_text = "\n".join(f"  · {t.get('status','').upper()} {(t.get('at') or '')[:16].replace('T',' ')}" for t in last_three) or "  · (none)"
    text = (
        f"↻ <b>REFUND {rid}</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"<b>▸ Order</b>     <code>{r.get('order_id','—')}</code>\n"
        f"<b>▸ Service</b>   {(r.get('order_service') or '—')[:40]}\n"
        f"<b>▸ Amount</b>    ₹{float(r.get('order_amount') or 0):,.2f}\n"
        f"<b>▸ Status</b>    <b>{(r.get('status') or '').upper()}</b>\n"
        f"\n<b>▸ Timeline</b>\n{tl_text}\n"
        f"{('<i>' + (r.get('admin_note') or '') + '</i>') if r.get('admin_note') else ''}"
    )
    await _tg_send(bot_token, chat_id, text,
                   {"inline_keyboard": [[{"text": "▸  Open Web Tracker", "url": f"https://errorhacker.site/refund/{rid}"}],
                                        [{"text": "❮  Main Menu", "callback_data": "menu_main"}]]})

# ---- Spin Wheel ----------------------------------------------------------
DEFAULT_SPIN_PRIZES: List[Dict[str, Any]] = [
    {"id": "p1",  "label": "₹5",           "type": "credit",   "amount": 5,    "weight": 35, "color": "#00ff9d"},
    {"id": "p2",  "label": "₹10",          "type": "credit",   "amount": 10,   "weight": 25, "color": "#4de0ff"},
    {"id": "p3",  "label": "₹25",          "type": "credit",   "amount": 25,   "weight": 18, "color": "#ffd34d"},
    {"id": "p4",  "label": "Try Again",    "type": "nothing",  "amount": 0,    "weight": 12, "color": "#3a3f44"},
    {"id": "p5",  "label": "₹50",          "type": "credit",   "amount": 50,   "weight": 7,  "color": "#ff8a4d"},
    {"id": "p6",  "label": "₹100",         "type": "credit",   "amount": 100,  "weight": 2,  "color": "#ff4d6d"},
    {"id": "p7",  "label": "₹250",         "type": "credit",   "amount": 250,  "weight": 0.9, "color": "#c084fc"},
    {"id": "p8",  "label": "JACKPOT ₹500", "type": "credit",   "amount": 500,  "weight": 0.1, "color": "#ffd700"},
]

async def _spin_config() -> Dict[str, Any]:
    cfg = await _ensure_config()
    sw = cfg.get("spin_wheel") or {}
    if not sw.get("prizes"):
        sw["prizes"] = DEFAULT_SPIN_PRIZES
    if "enabled" not in sw:
        sw["enabled"] = True
    if "cooldown_hours" not in sw:
        sw["cooldown_hours"] = 24
    return sw

@api.get("/spin/config")
async def spin_config_public():
    sw = await _spin_config()
    return {"enabled": sw.get("enabled", True), "cooldown_hours": sw.get("cooldown_hours", 24),
            "prizes": [{k: v for k, v in p.items() if k != "weight"} for p in sw.get("prizes", [])]}

@api.put("/admin/spin/config")
async def spin_config_update(body: Dict[str, Any] = Body(...), x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    sw = await _spin_config()
    if "enabled" in body:
        sw["enabled"] = bool(body["enabled"])
    if "cooldown_hours" in body:
        sw["cooldown_hours"] = max(1, int(body["cooldown_hours"]))
    if "prizes" in body and isinstance(body["prizes"], list):
        # Harden: ensure every prize has a usable weight. If client restored from
        # the public GET (which strips 'weight'), default to 1 so odds aren't zeroed.
        normalised = []
        for p in body["prizes"]:
            if not isinstance(p, dict):
                continue
            w = p.get("weight")
            if w is None or w == "" or w == 0:
                p = {**p, "weight": 1}
            else:
                try: p = {**p, "weight": max(0.0001, float(w))}
                except Exception: p = {**p, "weight": 1}
            normalised.append(p)
        sw["prizes"] = normalised
    await db.site_config.update_one({"_id": "main"}, {"$set": {"spin_wheel": sw, "updated_at": _now_iso()}})
    return {"ok": True, "spin_wheel": sw}

@api.get("/me/spin/status")
async def me_spin_status(request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    sw = await _spin_config()
    last = await db.spin_history.find_one({"user_id": user["user_id"]}, sort=[("spun_at", -1)])
    can_spin = True
    next_at = None
    if last:
        next_at_dt = datetime.fromisoformat(last["spun_at"].replace("Z", "+00:00")) + timedelta(hours=sw.get("cooldown_hours", 24))
        if next_at_dt > datetime.now(timezone.utc):
            can_spin = False
            next_at = next_at_dt.isoformat()
    return {"can_spin": can_spin and sw.get("enabled", True), "next_at": next_at, "enabled": sw.get("enabled", True), "cooldown_hours": sw.get("cooldown_hours", 24)}

@api.post("/me/spin/spin")
async def me_spin_spin(body: SpinWheelSpinIn, request: Request):
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    sw = await _spin_config()
    if not sw.get("enabled", True):
        raise HTTPException(status_code=400, detail="Spin wheel is disabled")
    # cooldown check
    last = await db.spin_history.find_one({"user_id": user["user_id"]}, sort=[("spun_at", -1)])
    if last:
        next_at_dt = datetime.fromisoformat(last["spun_at"].replace("Z", "+00:00")) + timedelta(hours=sw.get("cooldown_hours", 24))
        if next_at_dt > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail=f"Next spin available at {next_at_dt.isoformat()}")
    # weighted pick
    prizes = sw.get("prizes", DEFAULT_SPIN_PRIZES)
    total = sum(float(p.get("weight", 1)) for p in prizes) or 1
    pick = random.uniform(0, total)
    cum = 0.0
    won = prizes[-1]
    for p in prizes:
        cum += float(p.get("weight", 1))
        if pick <= cum:
            won = p
            break
    # award
    txn = None
    if won.get("type") == "credit" and won.get("amount", 0) > 0:
        txn = await _wallet_txn(user["user_id"], "spin", float(won["amount"]), note=f"Spin win: {won.get('label')}", ref={"prize_id": won.get("id")})
    await db.spin_history.insert_one({
        "user_id": user["user_id"],
        "prize_id": won.get("id"),
        "label": won.get("label"),
        "type": won.get("type"),
        "amount": float(won.get("amount", 0)),
        "spun_at": _now_iso(),
    })
    return {"prize": {k: v for k, v in won.items() if k != "weight"}, "wallet": txn}

# ---- Live Order Ticker ---------------------------------------------------
def _mask_name(name: str) -> str:
    if not name:
        return "Operator"
    parts = (name or "").strip().split()
    first = parts[0]
    if len(first) <= 2:
        return first.title()
    return (first[0] + "•" * (len(first) - 2) + first[-1]).title()

@api.get("/feed-ticker")
async def feed_ticker():
    """Public ticker — masked recent activity for social proof."""
    out: List[Dict[str, Any]] = []
    # recent orders
    async for o in db.orders.find({}, {"_id": 0, "name": 1, "serviceName": 1, "service": 1, "createdAt": 1, "amount": 1}).sort("createdAt", -1).limit(15):
        if not o.get("serviceName") and not o.get("service"):
            continue
        out.append({
            "type": "order",
            "name": _mask_name(o.get("name") or "Op"),
            "label": (o.get("serviceName") or o.get("service") or "an order")[:50],
            "createdAt": o.get("createdAt"),
        })
    # recent recovered cases (social proof gold)
    async for c in db.recovery_cases.find({"status": "recovered"}, {"_id": 0, "name": 1, "service_name": 1, "platform": 1, "createdAt": 1}).sort("createdAt", -1).limit(8):
        out.append({
            "type": "recovery",
            "name": _mask_name(c.get("name") or "Op"),
            "label": f"recovered {c.get('platform') or c.get('service_name') or 'account'}",
            "createdAt": c.get("createdAt"),
        })
    # sort all by createdAt desc
    out.sort(key=lambda x: x.get("createdAt") or "", reverse=True)
    return out[:20]

# ---- Works With (admin-managed brand strip) ------------------------------
@api.get("/works-with")
async def works_with_get():
    cfg = await _ensure_config()
    ww = cfg.get("works_with") or {"enabled": True, "title": "WORKS WITH", "speed": 35, "items": []}
    # only return active items, sorted
    items = [i for i in (ww.get("items") or []) if i.get("active", True)]
    items.sort(key=lambda x: x.get("sort", 0))
    return {"enabled": ww.get("enabled", True), "title": ww.get("title", "WORKS WITH"), "speed": ww.get("speed", 35), "items": items}

@api.put("/admin/works-with")
async def works_with_update(body: Dict[str, Any] = Body(...), x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    cfg = await _ensure_config()
    ww = cfg.get("works_with") or {}
    if "enabled" in body:
        ww["enabled"] = bool(body["enabled"])
    if "title" in body:
        ww["title"] = str(body["title"])[:60]
    if "speed" in body:
        ww["speed"] = max(10, min(120, int(body["speed"])))
    if isinstance(body.get("items"), list):
        cleaned = []
        for it in body["items"]:
            if not isinstance(it, dict) or not (it.get("name") or "").strip():
                continue
            cleaned.append({
                "id": it.get("id") or f"ww_{uuid.uuid4().hex[:6]}",
                "name": str(it["name"]).strip()[:40],
                "icon_url": str(it.get("icon_url") or "").strip(),
                "link": str(it.get("link") or "").strip(),
                "active": bool(it.get("active", True)),
                "sort": int(it.get("sort", 0)),
            })
        ww["items"] = cleaned
    await db.site_config.update_one({"_id": "main"}, {"$set": {"works_with": ww, "updated_at": _now_iso()}})
    return {"ok": True, "works_with": ww}


# --------------------------------------------------------------------------
# --- External route modules (extracted from server.py) ---
# Imported here at the bottom so all shared symbols (db, helpers, models) are
# defined before the route modules attempt to bind to them.
from routes.cashfree import router as cashfree_router  # noqa: E402
api.include_router(cashfree_router)

from routes.smm import make_router as _make_smm_router  # noqa: E402
api.include_router(_make_smm_router(db, _check_admin))

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


# (startup/shutdown moved to lifespan handler above)
