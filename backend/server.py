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
from fastapi import FastAPI, APIRouter, Header, HTTPException, status, UploadFile, File, Request, Response, Depends, Cookie
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

# ---- Auth models ----
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=100)
    name: Optional[str] = None

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
    if updates:
        updates["updated_at"] = datetime.utcnow().isoformat()
        await db.site_config.update_one({"_id": "main"}, {"$set": updates})
        doc = await db.site_config.find_one({"_id": "main"})
    return doc

async def _ensure_admin():
    doc = await db.admin.find_one({"_id": "creds"})
    if not doc:
        await db.admin.insert_one({"_id": "creds", "password": "admin123", "tokens": []})
        doc = await db.admin.find_one({"_id": "creds"})
    return doc

async def _check_admin(token: Optional[str]):
    if not token:
        raise HTTPException(status_code=401, detail="Missing admin token")
    creds = await _ensure_admin()
    if token not in (creds.get("tokens") or []):
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return True

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
    user = {
        "user_id": user_id,
        "email": email,
        "name": (body.name or email.split("@")[0]).strip(),
        "picture": None,
        "password_hash": _hash_pw(body.password),
        "role": "user",
        "provider": "password",
        "referral_code": _gen_ref_code(),
        "referred_by": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
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
    try:
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as e:
        log.warning("chat send_message failed: %s", e)
        raise HTTPException(status_code=502, detail="AI assistant temporarily unavailable")
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
async def feed_upload_media(file: UploadFile = File(...), x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    ct = file.content_type or ""
    is_video = ct.startswith("video/")
    is_image = ct.startswith("image/")
    if not (is_video or is_image):
        raise HTTPException(status_code=400, detail="Only image or video allowed")
    raw = await file.read()
    limit = 50 * 1024 * 1024 if is_video else 5 * 1024 * 1024
    if len(raw) > limit:
        raise HTTPException(status_code=413, detail=f"File too large (max {limit // (1024*1024)}MB)")
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
    async def gen():
        while True:
            chunk = await stream.readchunk()
            if not chunk:
                break
            yield chunk
    return StreamingResponse(gen(), media_type=ct, headers={"Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "bytes"})

# Posts CRUD (admin)
@api.post("/feed/posts")
async def feed_create_post(body: PostIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    doc = {
        "id": f"POST-{uuid.uuid4().hex[:10]}",
        "image_url": body.image_url,
        "caption": body.caption or "",
        "location": body.location or "",
        "likes_base": int(body.likes_base or 0),
        "views_base": int(body.views_base or 0),
        "pinned": bool(body.pinned),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feed_posts.insert_one(doc)
    return await _enrich_feed_item(doc, "post", None)

@api.patch("/feed/posts/{post_id}")
async def feed_update_post(post_id: str, body: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    body.pop("_id", None); body.pop("id", None); body.pop("created_at", None)
    res = await db.feed_posts.update_one({"id": post_id}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    doc = await db.feed_posts.find_one({"id": post_id})
    return await _enrich_feed_item(doc, "post", None)

@api.delete("/feed/posts/{post_id}")
async def feed_delete_post(post_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    await db.feed_posts.delete_one({"id": post_id})
    await db.feed_likes.delete_many({"post_id": post_id})
    await db.feed_comments.delete_many({"post_id": post_id})
    await db.feed_views.delete_many({"post_id": post_id})
    return {"ok": True}

@api.get("/feed/posts")
async def feed_list_posts(request: Request, limit: int = 30):
    user = await _get_user_from_request(request)
    rows = await db.feed_posts.find().sort([("pinned", -1), ("created_at", -1)]).to_list(min(max(limit, 1), 100))
    return [await _enrich_feed_item(r, "post", user) for r in rows]

@api.get("/feed/posts/{post_id}")
async def feed_get_post(post_id: str, request: Request):
    user = await _get_user_from_request(request)
    doc = await db.feed_posts.find_one({"id": post_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    return await _enrich_feed_item(doc, "post", user)

# Reels CRUD (admin)
@api.post("/feed/reels")
async def feed_create_reel(body: ReelIn, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    doc = {
        "id": f"REEL-{uuid.uuid4().hex[:10]}",
        "video_url": body.video_url,
        "thumb_url": body.thumb_url or "",
        "caption": body.caption or "",
        "likes_base": int(body.likes_base or 0),
        "views_base": int(body.views_base or 0),
        "pinned": bool(body.pinned),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feed_reels.insert_one(doc)
    return await _enrich_feed_item(doc, "reel", None)

@api.patch("/feed/reels/{reel_id}")
async def feed_update_reel(reel_id: str, body: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    body.pop("_id", None); body.pop("id", None); body.pop("created_at", None)
    res = await db.feed_reels.update_one({"id": reel_id}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reel not found")
    doc = await db.feed_reels.find_one({"id": reel_id})
    return await _enrich_feed_item(doc, "reel", None)

@api.delete("/feed/reels/{reel_id}")
async def feed_delete_reel(reel_id: str, x_admin_token: Optional[str] = Header(None)):
    await _check_admin(x_admin_token)
    await db.feed_reels.delete_one({"id": reel_id})
    await db.feed_likes.delete_many({"reel_id": reel_id})
    await db.feed_comments.delete_many({"reel_id": reel_id})
    await db.feed_views.delete_many({"reel_id": reel_id})
    return {"ok": True}

@api.get("/feed/reels")
async def feed_list_reels(request: Request, limit: int = 30):
    user = await _get_user_from_request(request)
    rows = await db.feed_reels.find().sort([("pinned", -1), ("created_at", -1)]).to_list(min(max(limit, 1), 100))
    return [await _enrich_feed_item(r, "reel", user) for r in rows]

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
