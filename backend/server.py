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
from fastapi import FastAPI, APIRouter, Header, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, uuid, logging, base64, asyncio
import httpx
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from defaults import DEFAULT_CONFIG

# --------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

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

# --------------------------------------------------------------------------
# Helpers
async def _ensure_config():
    doc = await db.site_config.find_one({"_id": "main"})
    if not doc:
        await db.site_config.insert_one({"_id": "main", **DEFAULT_CONFIG, "updated_at": datetime.utcnow().isoformat()})
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
async def create_order(body: OrderIn):
    order = {
        "id": f"ORD-{uuid.uuid4().hex[:10].upper()}",
        **body.dict(),
        "status": "received",
        "createdAt": datetime.utcnow().isoformat(),
    }
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
    return Response(content=base64.b64decode(doc["data"]), media_type=doc.get("content_type", "image/png"), headers={"Cache-Control": "public, max-age=31536000, immutable"})

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

# --------------------------------------------------------------------------
app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def on_startup():
    await _ensure_config()
    await _ensure_admin()
    log.info("ERRORHACKER API ready")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
