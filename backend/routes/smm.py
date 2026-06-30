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
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from smm_service import (
    get_config,
    update_config,
    refresh_balance,
    place_order_for_app_order,
    poll_order_status,
    SmmClient,
    get_customer_catalog,
    find_catalog_service,
    compute_charge_inr,
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
    markup_percent: Optional[float] = None
    min_order_inr: Optional[float] = None
    platforms_whitelist: Optional[List[str]] = None


class ServiceLinkIn(BaseModel):
    smm_service_id: int
    smm_price_per_1000_usd: Optional[float] = None
    smm_service_name: Optional[str] = None


class PublicSmmOrderIn(BaseModel):
    smm_service_id: int
    quantity: int
    link: str
    name: Optional[str] = ""
    email: Optional[str] = ""
    tg: Optional[str] = ""
    notes: Optional[str] = ""


def make_router(db, check_admin, get_user_from_request=None):
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

    # ------------- Public customer-facing endpoints -------------
    @router.get("/public/smm/catalog")
    async def public_catalog(q: Optional[str] = None, platform: Optional[str] = None, category: Optional[str] = None, refresh: int = 0):
        """Browsable customer catalog with INR pricing + markup already applied.
        Filtered + cached in-memory for ~10 minutes (see DEFAULT_CATALOG_TTL_SEC)."""
        cat = await get_customer_catalog(db, force_refresh=bool(refresh))
        rows = cat.get("rows", [])
        ql = (q or "").lower().strip()
        pl = (platform or "").lower().strip()
        cg = (category or "").lower().strip()
        def matches(r):
            if pl and r.get("platform", "").lower() != pl:
                return False
            if cg and cg not in r.get("category", "").lower():
                return False
            if ql:
                blob = f"{r.get('name','')} {r.get('category','')} {r.get('platform','')}".lower()
                if ql not in blob:
                    return False
            return True
        filtered = [r for r in rows if matches(r)]
        # Group platforms with counts so the UI can render top-level chips quickly
        platform_counts: Dict[str, int] = {}
        for r in rows:
            p = r.get("platform") or "other"
            platform_counts[p] = platform_counts.get(p, 0) + 1
        return {
            "rows": filtered,
            "total": len(filtered),
            "categories": cat.get("categories", []),
            "platforms": sorted(platform_counts.keys()),
            "platform_counts": platform_counts,
            "inr_rate": cat.get("inr_rate"),
            "markup_percent": cat.get("markup_percent"),
            "min_order_inr": cat.get("min_order_inr"),
            "cached": cat.get("cached", False),
            "age_sec": cat.get("age_sec", 0),
            "error": cat.get("error"),
        }

    @router.get("/public/smm/service/{smm_id}")
    async def public_service(smm_id: int):
        row = await find_catalog_service(db, int(smm_id))
        if not row:
            raise HTTPException(status_code=404, detail="Service not found in catalog")
        cfg = await get_config(db)
        return {
            "service": row,
            "min_order_inr": float(cfg.get("min_order_inr") or 0),
            "markup_percent": float(cfg.get("markup_percent") or 0),
        }

    @router.post("/public/smm/quote")
    async def public_quote(body: PublicSmmOrderIn, request: Request):
        """Compute the live INR charge for {service, qty} without creating an order.
        Also returns the user's wallet balance + auto-applied OPERATIVE PASS discount
        so the frontend can render a "pay from wallet" CTA accurately."""
        row = await find_catalog_service(db, int(body.smm_service_id))
        if not row:
            raise HTTPException(status_code=404, detail="Service not found in catalog")
        cfg = await get_config(db)
        if body.quantity < row.get("min", 0) or body.quantity > row.get("max", 0):
            raise HTTPException(status_code=400, detail=f"Quantity must be between {row.get('min')} and {row.get('max')}")
        base_charge = compute_charge_inr(row.get("rate_inr_per_1000", 0), body.quantity, float(cfg.get("min_order_inr") or 0))
        # Resolve user + tier (optional)
        user = None
        if get_user_from_request:
            try: user = await get_user_from_request(request)
            except Exception: user = None
        discount_pct = 0
        tier_name = "Rookie"
        wallet_balance = 0.0
        if user:
            try:
                from tiers import user_tier
                full_user = await db.users.find_one({"user_id": user["user_id"]}) or {}
                tier = user_tier(full_user)
                discount_pct = float(tier.get("smm_discount_pct") or 0)
                tier_name = tier.get("name", "Rookie")
            except Exception:
                pass
            try:
                import server as _server
                wallet = await _server._wallet_get_or_create(user["user_id"])
                wallet_balance = float(wallet.get("balance", 0))
            except Exception:
                pass
        discount_amount = round(base_charge * discount_pct / 100, 2)
        final_charge = max(round(base_charge - discount_amount, 2), float(cfg.get("min_order_inr") or 0))
        return {
            "service": row,
            "quantity": body.quantity,
            "base_charge_inr": base_charge,
            "discount_pct": discount_pct,
            "discount_amount_inr": discount_amount,
            "charge_inr": final_charge,
            "tier_name": tier_name,
            "wallet_balance_inr": wallet_balance,
            "wallet_sufficient": wallet_balance >= final_charge,
            "min_order_inr": float(cfg.get("min_order_inr") or 0),
            "logged_in": bool(user),
        }

    @router.post("/public/smm/order")
    async def public_create_order(body: PublicSmmOrderIn, request: Request):
        """Wallet-only flow (Iter-28). Anonymous orders are rejected — users
        must sign in and pay from their wallet balance. On success the order
        is created with status='verified', wallet is atomically debited, and
        Peakerr placement fires immediately in the background.

        Errors:
          401 → not logged in
          402 → wallet balance too low (response includes needed_inr + current_balance_inr)
        """
        import uuid
        from datetime import datetime, timezone
        # Step 1 — require authentication
        if not get_user_from_request:
            raise HTTPException(status_code=500, detail="Auth resolver unavailable")
        try:
            user = await get_user_from_request(request)
        except Exception:
            user = None
        if not user:
            raise HTTPException(status_code=401, detail="Please sign in to place an SMM order")

        # Step 2 — validate the service + quantity
        row = await find_catalog_service(db, int(body.smm_service_id))
        if not row:
            raise HTTPException(status_code=404, detail="Service not found in catalog")
        cfg = await get_config(db)
        if body.quantity < row.get("min", 0) or body.quantity > row.get("max", 0):
            raise HTTPException(status_code=400, detail=f"Quantity must be between {row.get('min')} and {row.get('max')}")
        if not (body.link or "").strip():
            raise HTTPException(status_code=400, detail="A valid target link / username is required")

        # Step 3 — compute final charge with OPERATIVE PASS discount applied
        base_charge = compute_charge_inr(row.get("rate_inr_per_1000", 0), body.quantity, float(cfg.get("min_order_inr") or 0))
        discount_pct = 0
        tier_name = "Rookie"
        try:
            from tiers import user_tier
            full_user = await db.users.find_one({"user_id": user["user_id"]}) or {}
            tier = user_tier(full_user)
            discount_pct = float(tier.get("smm_discount_pct") or 0)
            tier_name = tier.get("name", "Rookie")
        except Exception:
            pass
        discount_amount = round(base_charge * discount_pct / 100, 2)
        final_charge = max(round(base_charge - discount_amount, 2), float(cfg.get("min_order_inr") or 0))

        # Step 4 — check wallet balance BEFORE creating the order so we never
        # leave orphaned half-paid records lying around.
        import server as _server
        wallet = await _server._wallet_get_or_create(user["user_id"])
        balance = float(wallet.get("balance", 0))
        if balance < final_charge:
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "wallet_insufficient",
                    "message": f"Add ₹{int(final_charge - balance)} to your wallet to place this order.",
                    "needed_inr": float(final_charge - balance),
                    "current_balance_inr": balance,
                    "charge_inr": final_charge,
                },
            )

        # Step 5 — atomic wallet debit + order creation
        now = datetime.now(timezone.utc).isoformat()
        order_id = f"ORD-{uuid.uuid4().hex[:10].upper()}"
        try:
            txn = await _server._wallet_txn(
                user["user_id"],
                "debit",
                float(final_charge),
                note=f"SMM order · {row.get('platform','').upper()} · {body.quantity} units",
                ref={"type": "smm_order", "order_id": order_id, "smm_service_id": int(row.get("id"))},
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Wallet debit failed: {e}")

        order_doc = {
            "id": order_id,
            "service": f"smm-{row.get('id')}",
            "serviceName": f"{row.get('platform','SMM').upper()} · {row.get('name','')}"[:200],
            "name": (body.name or user.get("name") or "Customer").strip(),
            "email": (body.email or user.get("email") or "").strip(),
            "tg": (body.tg or "").strip(),
            "size": str(body.quantity),
            "target": body.link.strip(),
            "notes": (body.notes or "").strip(),
            "amount": final_charge,
            "payment_amount": final_charge,
            "base_charge_inr": base_charge,
            "discount_pct": discount_pct,
            "discount_amount_inr": discount_amount,
            "tier_at_order": tier_name,
            "currency": "INR",
            "payment_currency": "INR",
            "payment_method": "wallet",
            "payment_status": "paid",
            "wallet_txn_id": txn.get("id"),
            # Wallet-paid orders skip the "received → verified" loop and go straight
            # to verified so place_order_for_app_order fires immediately.
            "status": "verified",
            "createdAt": now,
            "smm_service_id": int(row.get("id")),
            "smm_cost_usd_per_1000": float(row.get("cost_usd_per_1000") or 0),
            "smm_service_name": row.get("name", ""),
            "smm_quantity": int(body.quantity),
            "source": "public_smm_form",
            "user_id": user["user_id"],
            "userEmail": user.get("email"),
        }
        await db.orders.insert_one(order_doc)
        order_doc.pop("_id", None)

        # Step 6 — fire panel placement + admin notification (best-effort, background)
        import asyncio as _asyncio
        async def _bg_place_and_notify():
            try:
                await place_order_for_app_order(db, order_doc)
            except Exception:
                pass
            try:
                if hasattr(_server, "_notify_order"):
                    await _server._notify_order(order_doc)
            except Exception:
                pass
        _asyncio.create_task(_bg_place_and_notify())

        return {
            "ok": True,
            "order": order_doc,
            "wallet_txn": txn,
            "new_wallet_balance_inr": balance - final_charge,
            # No `&pay=1` — already paid from wallet, the tracker just shows progress.
            "redirect": f"/track?id={order_id}",
        }

    # ---------- Admin SMM Orders Inbox ----------
    @router.post("/admin/smm/seed-test-catalog")
    async def admin_seed_test_catalog(x_admin_token: Optional[str] = Header(None)):
        """Testing-only — inject a fixed set of rows into the in-memory catalog cache
        so end-to-end tests can run without depending on the live Peakerr key.
        Safe to call in production too; it just makes the catalog show these rows
        until the next live refresh."""
        await check_admin(x_admin_token)
        import time
        from smm_service import _CATALOG_CACHE as cache  # noqa: WPS433
        cache["at"] = time.time()
        cache["rows"] = [
            {
                "id": 999001, "name": "TEST · Instagram Followers (real)", "category": "Instagram Followers",
                "platform": "instagram", "type": "Default", "min": 50, "max": 100000,
                "dripfeed": False, "refill": True, "cancel": False,
                "rate_inr_per_1000": 12.50, "cost_usd_per_1000": 0.10,
            },
            {
                "id": 999002, "name": "TEST · YouTube Views (cheap)", "category": "YouTube Views",
                "platform": "youtube", "type": "Default", "min": 100, "max": 500000,
                "dripfeed": True, "refill": False, "cancel": True,
                "rate_inr_per_1000": 5.00, "cost_usd_per_1000": 0.04,
            },
            {
                "id": 999003, "name": "TEST · TikTok Likes (premium)", "category": "TikTok Likes",
                "platform": "tiktok", "type": "Default", "min": 20, "max": 50000,
                "dripfeed": False, "refill": True, "cancel": True,
                "rate_inr_per_1000": 18.00, "cost_usd_per_1000": 0.16,
            },
        ]
        cache["categories"] = sorted({r["category"] for r in cache["rows"]})
        return {"ok": True, "seeded": len(cache["rows"])}

    # ---------- Admin SMM Orders Inbox ----------
    @router.get("/admin/smm/orders")
    async def admin_smm_orders(x_admin_token: Optional[str] = Header(None), limit: int = 100, status: Optional[str] = None, has_error: int = 0):
        """List every order that's wired to the SMM panel. Used by the admin panel
        to replace the old manual 'link service' UI with a live order inbox."""
        await check_admin(x_admin_token)
        q: Dict[str, Any] = {"smm_service_id": {"$exists": True}}
        if status:
            q["smm_status"] = status
        if has_error:
            q["smm_error"] = {"$nin": [None, ""]}
        cur = db.orders.find(q).sort("createdAt", -1).limit(int(limit))
        rows = []
        async for o in cur:
            o.pop("_id", None)
            rows.append(o)
        # Summary counts so the UI can show pill totals at the top
        all_rows = await db.orders.count_documents({"smm_service_id": {"$exists": True}})
        pending = await db.orders.count_documents({"smm_service_id": {"$exists": True}, "smm_status": {"$in": ["Pending", "In progress", "Processing", "Starting", None]}})
        errored = await db.orders.count_documents({"smm_service_id": {"$exists": True}, "smm_error": {"$nin": [None, ""]}})
        completed = await db.orders.count_documents({"smm_service_id": {"$exists": True}, "smm_status": "Completed"})
        return {
            "rows": rows,
            "total": all_rows,
            "pending": pending,
            "errored": errored,
            "completed": completed,
        }

    return router
