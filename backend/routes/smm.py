"""
Admin-only routes for SMM panel automation.

Mounted under /api by server.py's `app.include_router(smm_router)`.

  GET    /api/admin/smm/config           — current panel config (no api_key returned plaintext)
  PUT    /api/admin/smm/config           — set url/key/inr_rate/low_balance/enabled/auto_place_on_verified
  GET    /api/admin/smm/balance          — live balance from the panel (USD + INR)
  GET    /api/admin/smm/services         — search panel services (q, platform)
  POST   /api/admin/services/{sid}/smm-link   — link an app service to a panel service id
  DELETE /api/admin/services/{sid}/smm-link   — unlink
  POST   /api/admin/orders/{oid}/smm-place    — manual (re)trigger placement
  POST   /api/admin/orders/{oid}/smm-poll     — manual refresh of a single order's panel status
"""
from __future__ import annotations
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from smm_service import (
    get_config,
    update_config,
    refresh_balance,
    place_order_for_app_order,
    poll_order_status,
    SmmClient,
)


# Pydantic models must live at module level so FastAPI's body parser
# can introspect them. Defining them inside the factory caused
# "Field required" on `body` because they were treated as query params.
class SmmConfigIn(BaseModel):
    enabled: Optional[bool] = None
    url: Optional[str] = None
    api_key: Optional[str] = None
    inr_rate: Optional[float] = None
    low_balance_inr: Optional[float] = None
    auto_place_on_verified: Optional[bool] = None


class ServiceLinkIn(BaseModel):
    smm_service_id: int
    smm_price_per_1000_usd: Optional[float] = None
    smm_service_name: Optional[str] = None


def make_router(db, check_admin):
    router = APIRouter()

    def _strip_secret(cfg: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(cfg)
        out.pop("_id", None)
        k = out.get("api_key") or ""
        out["api_key_masked"] = f"…{k[-4:]}" if k else ""
        out["api_key"] = bool(k)
        return out

    @router.get("/admin/smm/config")
    async def smm_get_config(x_admin_token: Optional[str] = Header(None)):
        await check_admin(x_admin_token)
        cfg = await get_config(db)
        return _strip_secret(cfg)

    @router.put("/admin/smm/config")
    async def smm_update_config(body: SmmConfigIn, x_admin_token: Optional[str] = Header(None)):
        await check_admin(x_admin_token)
        patch = {k: v for k, v in body.dict().items() if v is not None}
        if patch.get("api_key") == "":
            patch.pop("api_key", None)
        cfg = await update_config(db, patch)
        return _strip_secret(cfg)

    @router.get("/admin/smm/balance")
    async def smm_balance(x_admin_token: Optional[str] = Header(None)):
        await check_admin(x_admin_token)
        return await refresh_balance(db)

    @router.get("/admin/smm/services")
    async def smm_services(q: Optional[str] = None, platform: Optional[str] = None, limit: int = 60, x_admin_token: Optional[str] = Header(None)):
        await check_admin(x_admin_token)
        cfg = await get_config(db)
        if not cfg.get("api_key"):
            raise HTTPException(status_code=400, detail="SMM panel not configured")
        client = SmmClient(cfg["url"], cfg["api_key"])
        try:
            all_services = await client.services()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Panel error: {e}")
        # In-memory filter — Peakerr has ~6k services, so filtering server-side is fine.
        ql = (q or "").lower().strip()
        pl = (platform or "").lower().strip()
        def matches(s):
            name = (s.get("name") or "").lower()
            cat = (s.get("category") or "").lower()
            if ql and ql not in name and ql not in cat:
                return False
            if pl and pl not in name and pl not in cat:
                return False
            return True
        rows = [s for s in all_services if matches(s)]
        inr_rate = float(cfg.get("inr_rate") or 88)
        # Augment each service with INR pricing
        for s in rows[:limit]:
            try:
                usd_per_1000 = float(s.get("rate") or 0)
                s["rate_inr_per_1000"] = round(usd_per_1000 * inr_rate, 2)
            except Exception:
                s["rate_inr_per_1000"] = 0
        return {"total": len(rows), "rows": rows[:limit], "inr_rate": inr_rate}

    @router.post("/admin/services/{sid}/smm-link")
    async def link_service(sid: str, body: ServiceLinkIn, x_admin_token: Optional[str] = Header(None)):
        await check_admin(x_admin_token)
        cfg_doc = await db.site_config.find_one({"_id": "main"})
        if not cfg_doc:
            raise HTTPException(status_code=404, detail="Config not initialised")
        services = list(cfg_doc.get("services") or [])
        idx = next((i for i, s in enumerate(services) if s.get("id") == sid), -1)
        if idx == -1:
            raise HTTPException(status_code=404, detail="Service not found")
        services[idx] = {
            **services[idx],
            "smm_service_id": int(body.smm_service_id),
            "smm_price_per_1000_usd": float(body.smm_price_per_1000_usd or 0),
            "smm_service_name": body.smm_service_name or "",
        }
        await db.site_config.update_one({"_id": "main"}, {"$set": {"services": services}})
        return {"ok": True, "service": services[idx]}

    @router.delete("/admin/services/{sid}/smm-link")
    async def unlink_service(sid: str, x_admin_token: Optional[str] = Header(None)):
        await check_admin(x_admin_token)
        cfg_doc = await db.site_config.find_one({"_id": "main"})
        if not cfg_doc:
            return {"ok": True}
        services = list(cfg_doc.get("services") or [])
        idx = next((i for i, s in enumerate(services) if s.get("id") == sid), -1)
        if idx >= 0:
            cleaned = {k: v for k, v in services[idx].items() if k not in ("smm_service_id", "smm_price_per_1000_usd", "smm_service_name")}
            services[idx] = cleaned
            await db.site_config.update_one({"_id": "main"}, {"$set": {"services": services}})
        return {"ok": True}

    @router.post("/admin/orders/{oid}/smm-place")
    async def manual_place(oid: str, x_admin_token: Optional[str] = Header(None)):
        await check_admin(x_admin_token)
        order = await db.orders.find_one({"id": oid})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        order.pop("_id", None)
        # Allow retry: clear any existing panel order id so the placement runs again.
        if order.get("smm_panel_order_id"):
            await db.orders.update_one({"id": oid}, {"$unset": {"smm_panel_order_id": "", "smm_skip_reason": ""}})
            order.pop("smm_panel_order_id", None)
        updated = await place_order_for_app_order(db, order)
        return {"ok": not updated.get("smm_error"), "order": updated}

    @router.post("/admin/orders/{oid}/smm-poll")
    async def manual_poll(oid: str, x_admin_token: Optional[str] = Header(None)):
        await check_admin(x_admin_token)
        order = await db.orders.find_one({"id": oid})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        order.pop("_id", None)
        upd = await poll_order_status(db, order)
        fresh = await db.orders.find_one({"id": oid})
        fresh.pop("_id", None)
        return {"updated": upd, "order": fresh}

    return router
