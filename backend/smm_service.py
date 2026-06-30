"""
SMM Panel client — generic adapter for any standard SMM reseller API
(Peakerr, JAP, SMMRaja, etc. — they all share the same schema).

The full spec is just a single POST endpoint at /api/v2 with form-encoded
params and 4 actions: `services`, `add`, `status`, `balance`.

Config + state lives in the `smm_config` Mongo collection (single doc with
_id="main"). Service-to-panel mapping lives on each service doc in the
`services` collection under `smm_service_id` / `smm_price_per_1000_usd`.

Per-order placement results live on the order doc itself under the
`smm_*` namespace so admins can see history at a glance.
"""
from __future__ import annotations
import os
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

log = logging.getLogger("smm")

DEFAULT_PANEL_URL = "https://peakerr.com/api/v2"
DEFAULT_INR_RATE = 88.0  # USD → INR fallback if admin hasn't set one (panel quotes rates in USD)
DEFAULT_LOW_BALANCE_INR = 500.0  # admin gets a Telegram nudge when wallet drops below this
DEFAULT_MARKUP_PERCENT = 40.0    # your profit added on top of panel cost
DEFAULT_MIN_ORDER_INR = 10.0     # below this, the order can't be placed (panel fees would eat margin)
DEFAULT_PLATFORM_WHITELIST = [
    "instagram", "youtube", "tiktok", "telegram",
    "twitter", "x ", "facebook", "spotify",
]
DEFAULT_CATALOG_TTL_SEC = 600  # 10 min — Peakerr prices change rarely; refetch every 10 min


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SmmClient:
    """Thin async wrapper around any standard SMM panel REST API."""

    def __init__(self, url: str, key: str, timeout: float = 25.0):
        self.url = url
        self.key = key
        self.timeout = timeout

    async def _call(self, action: str, **extra: Any) -> Any:
        payload = {"key": self.key, "action": action, **extra}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.url, data=payload)
            try:
                data = resp.json()
            except Exception:
                raise RuntimeError(f"SMM panel returned non-JSON ({resp.status_code}): {resp.text[:200]}")
        if isinstance(data, dict) and data.get("error"):
            raise RuntimeError(f"SMM panel error: {data['error']}")
        return data

    async def balance(self) -> Dict[str, Any]:
        return await self._call("balance")

    async def services(self) -> List[Dict[str, Any]]:
        out = await self._call("services")
        return out if isinstance(out, list) else []

    async def add_order(self, service_id: int, link: str, quantity: int, **extra: Any) -> Dict[str, Any]:
        return await self._call("add", service=service_id, link=link, quantity=quantity, **extra)

    async def status(self, panel_order_id: int) -> Dict[str, Any]:
        return await self._call("status", order=panel_order_id)

    async def multi_status(self, panel_order_ids: List[int]) -> Dict[str, Any]:
        if not panel_order_ids:
            return {}
        return await self._call("status", orders=",".join(str(i) for i in panel_order_ids))


# ----- DB helpers -------------------------------------------------------

async def get_config(db) -> Dict[str, Any]:
    """Read SMM config from Mongo, seeding sane defaults on first access.
    NOTE: api key is allowed to be empty — the admin UI handles activation."""
    doc = await db.smm_config.find_one({"_id": "main"})
    if not doc:
        doc = {
            "_id": "main",
            "enabled": False,
            "url": DEFAULT_PANEL_URL,
            "api_key": "",
            "inr_rate": DEFAULT_INR_RATE,
            "low_balance_inr": DEFAULT_LOW_BALANCE_INR,
            "markup_percent": DEFAULT_MARKUP_PERCENT,
            "min_order_inr": DEFAULT_MIN_ORDER_INR,
            "platforms_whitelist": DEFAULT_PLATFORM_WHITELIST,
            "auto_place_on_verified": True,
            "last_balance_usd": 0.0,
            "last_balance_at": None,
            "updated_at": _now_iso(),
        }
        await db.smm_config.insert_one(doc)
    # Backfill defaults on existing configs created before these fields existed
    backfill = {}
    if doc.get("markup_percent") is None:
        backfill["markup_percent"] = DEFAULT_MARKUP_PERCENT
    if doc.get("min_order_inr") is None:
        backfill["min_order_inr"] = DEFAULT_MIN_ORDER_INR
    if not doc.get("platforms_whitelist"):
        backfill["platforms_whitelist"] = DEFAULT_PLATFORM_WHITELIST
    if backfill:
        await db.smm_config.update_one({"_id": "main"}, {"$set": backfill})
        doc.update(backfill)
    return doc


async def update_config(db, patch: Dict[str, Any]) -> Dict[str, Any]:
    patch = dict(patch)
    patch["updated_at"] = _now_iso()
    await db.smm_config.update_one({"_id": "main"}, {"$set": patch}, upsert=True)
    return await get_config(db)


async def get_client(db) -> Optional[SmmClient]:
    cfg = await get_config(db)
    if not cfg.get("enabled") or not cfg.get("api_key"):
        return None
    return SmmClient(cfg["url"], cfg["api_key"])


# ----- Customer-facing catalog ------------------------------------------
# In-memory cache to avoid hammering the panel on every page load. Peakerr
# returns ~5,900 entries which is ~1.5 MB JSON; we filter + reshape it once
# every DEFAULT_CATALOG_TTL_SEC.
_CATALOG_CACHE: Dict[str, Any] = {"at": 0.0, "rows": [], "categories": []}


def _platform_of(name: str, category: str, whitelist: List[str]) -> Optional[str]:
    """Return the platform slug if either name or category contains a whitelisted token."""
    blob = f"{name} {category}".lower()
    for p in whitelist:
        if p.lower().strip() in blob:
            return p.lower().strip()
    return None


def _customer_price_inr(usd_per_1000: float, inr_rate: float, markup_pct: float) -> float:
    """Cost → customer-facing rate per 1000, INR, including markup. Always >= 0."""
    if usd_per_1000 <= 0:
        return 0.0
    cost_inr = usd_per_1000 * inr_rate
    return round(cost_inr * (1.0 + (markup_pct or 0) / 100.0), 4)


def compute_charge_inr(price_per_1000_inr: float, quantity: int, min_order_inr: float) -> float:
    """Customer-facing total INR for `quantity` units. Honors the minimum order floor."""
    raw = (price_per_1000_inr * max(quantity, 0)) / 1000.0
    return round(max(raw, float(min_order_inr or 0)), 2)


async def get_customer_catalog(db, force_refresh: bool = False) -> Dict[str, Any]:
    """Return the customer-facing catalog: services filtered by platform whitelist,
    priced in INR with markup, grouped categories. Cached for DEFAULT_CATALOG_TTL_SEC."""
    import time
    cfg = await get_config(db)
    now = time.time()
    cache_age = now - float(_CATALOG_CACHE.get("at", 0))
    if not force_refresh and cache_age < DEFAULT_CATALOG_TTL_SEC and _CATALOG_CACHE.get("rows"):
        return {
            "rows": _CATALOG_CACHE["rows"],
            "categories": _CATALOG_CACHE["categories"],
            "inr_rate": float(cfg.get("inr_rate") or DEFAULT_INR_RATE),
            "markup_percent": float(cfg.get("markup_percent") or DEFAULT_MARKUP_PERCENT),
            "min_order_inr": float(cfg.get("min_order_inr") or DEFAULT_MIN_ORDER_INR),
            "cached": True,
            "age_sec": int(cache_age),
        }
    if not cfg.get("enabled") or not cfg.get("api_key"):
        return {"rows": [], "categories": [], "inr_rate": 0, "markup_percent": 0, "min_order_inr": 0, "cached": False, "error": "panel disabled"}
    inr_rate = float(cfg.get("inr_rate") or DEFAULT_INR_RATE)
    markup_pct = float(cfg.get("markup_percent") or DEFAULT_MARKUP_PERCENT)
    min_order = float(cfg.get("min_order_inr") or DEFAULT_MIN_ORDER_INR)
    whitelist = list(cfg.get("platforms_whitelist") or DEFAULT_PLATFORM_WHITELIST)
    client = SmmClient(cfg["url"], cfg["api_key"])
    try:
        raw = await client.services()
    except Exception as e:
        log.warning("catalog refresh failed: %s", e)
        return {"rows": _CATALOG_CACHE.get("rows", []), "categories": _CATALOG_CACHE.get("categories", []), "inr_rate": inr_rate, "markup_percent": markup_pct, "min_order_inr": min_order, "cached": True, "error": str(e)}
    rows = []
    for s in raw:
        name = str(s.get("name") or "")
        category = str(s.get("category") or "")
        platform = _platform_of(name, category, whitelist)
        if not platform:
            continue
        try:
            cost_usd = float(s.get("rate") or 0)
        except Exception:
            cost_usd = 0.0
        rate_inr = _customer_price_inr(cost_usd, inr_rate, markup_pct)
        rows.append({
            "id": int(s.get("service")),
            "name": name,
            "category": category,
            "platform": platform,
            "type": s.get("type") or "Default",
            "min": int(s.get("min") or 0),
            "max": int(s.get("max") or 0),
            "dripfeed": bool(s.get("dripfeed")),
            "refill": bool(s.get("refill")),
            "cancel": bool(s.get("cancel")),
            "rate_inr_per_1000": rate_inr,
            "cost_usd_per_1000": cost_usd,
        })
    categories = sorted({r["category"] for r in rows if r["category"]})
    _CATALOG_CACHE["at"] = now
    _CATALOG_CACHE["rows"] = rows
    _CATALOG_CACHE["categories"] = categories
    return {
        "rows": rows,
        "categories": categories,
        "inr_rate": inr_rate,
        "markup_percent": markup_pct,
        "min_order_inr": min_order,
        "cached": False,
        "age_sec": 0,
    }


async def find_catalog_service(db, smm_service_id: int) -> Optional[Dict[str, Any]]:
    """Return a single catalog row for a Peakerr service id (used at order-creation
    time to compute the authoritative INR price)."""
    cat = await get_customer_catalog(db)
    for r in cat.get("rows", []):
        if int(r.get("id") or 0) == int(smm_service_id):
            return r
    return None


# ----- Order auto-placement --------------------------------------------

async def place_order_for_app_order(db, order: Dict[str, Any]) -> Dict[str, Any]:
    """Place this app order on the panel. Returns the updated order doc.

    Pre-conditions checked here:
      • smm_config enabled and api_key set
      • service is mapped (`smm_service_id` set on the linked service doc)
      • this order hasn't already been placed (idempotent)
      • the order's target/quantity are present

    Failure modes are recorded on the order doc under `smm_error` so they
    surface in the admin panel — we never throw to the caller (so the
    status-update flow can't be blocked by a panel outage).
    """
    order_id = order.get("id")
    out_fields: Dict[str, Any] = {"smm_last_attempt_at": _now_iso()}

    if order.get("smm_panel_order_id"):
        out_fields["smm_error"] = ""
        out_fields["smm_skip_reason"] = "already_placed"
        await db.orders.update_one({"id": order_id}, {"$set": out_fields})
        return {**order, **out_fields}

    cfg = await get_config(db)
    if not cfg.get("enabled") or not cfg.get("api_key"):
        out_fields["smm_error"] = "panel disabled"
        await db.orders.update_one({"id": order_id}, {"$set": out_fields})
        return {**order, **out_fields}

    # Lookup the linked panel service id.
    # Priority: order's own `smm_service_id` (set by /order direct flow) →
    # then fall back to the service mapping in site_config.services (admin-mapped curated services).
    smm_service_id = None
    smm_price_usd_per_1000 = None
    if order.get("smm_service_id"):
        smm_service_id = int(order["smm_service_id"])
        smm_price_usd_per_1000 = float(order.get("smm_cost_usd_per_1000") or 0)
    else:
        if order.get("service"):
            cfg_doc = await db.site_config.find_one({"_id": "main"}) or {}
            for s in (cfg_doc.get("services") or []):
                if s.get("id") == order["service"] and s.get("smm_service_id"):
                    smm_service_id = int(s["smm_service_id"])
                    smm_price_usd_per_1000 = float(s.get("smm_price_per_1000_usd") or 0)
                    break
    if not smm_service_id:
        out_fields["smm_error"] = "service not mapped to a panel service"
        await db.orders.update_one({"id": order_id}, {"$set": out_fields})
        return {**order, **out_fields}

    link = (order.get("target") or "").strip()
    qty = 0
    try:
        qty = int(str(order.get("size") or "0").strip())
    except Exception:
        qty = 0
    if not link or qty <= 0:
        out_fields["smm_error"] = "missing target link or quantity"
        await db.orders.update_one({"id": order_id}, {"$set": out_fields})
        return {**order, **out_fields}

    # Place the order
    client = SmmClient(cfg["url"], cfg["api_key"])
    try:
        placed = await client.add_order(smm_service_id, link, qty)
    except Exception as e:
        out_fields["smm_error"] = f"panel call failed: {e}"
        await db.orders.update_one({"id": order_id}, {"$set": out_fields})
        return {**order, **out_fields}

    panel_oid = placed.get("order")
    if not panel_oid:
        out_fields["smm_error"] = f"panel did not return an order id (raw: {placed})"
        await db.orders.update_one({"id": order_id}, {"$set": out_fields})
        return {**order, **out_fields}

    inr_rate = float(cfg.get("inr_rate") or DEFAULT_INR_RATE)
    rate_usd_per_1000 = float(smm_price_usd_per_1000 or 0)
    charge_usd = (rate_usd_per_1000 * qty) / 1000.0 if rate_usd_per_1000 else 0.0
    out_fields.update({
        "smm_panel_order_id": int(panel_oid),
        "smm_status": "Pending",
        "smm_placed_at": _now_iso(),
        "smm_charge_usd": round(charge_usd, 4),
        "smm_charge_inr": round(charge_usd * inr_rate, 2),
        "smm_service_id_used": smm_service_id,
        "smm_quantity": qty,
        "smm_error": "",
    })
    # status side-effect: auto-bump to in-progress
    if order.get("status") in (None, "received", "verified", "paid"):
        out_fields["status"] = "in-progress"

    await db.orders.update_one({"id": order_id}, {"$set": out_fields})
    return {**order, **out_fields}


async def poll_order_status(db, order: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Pull the latest status from the panel for one order. Returns the
    updated fields (or None if nothing to do)."""
    panel_oid = order.get("smm_panel_order_id")
    if not panel_oid:
        return None
    client = await get_client(db)
    if not client:
        return None
    try:
        st = await client.status(int(panel_oid))
    except Exception as e:
        log.warning("smm poll failed for %s/%s: %s", order.get("id"), panel_oid, e)
        return None
    upd: Dict[str, Any] = {
        "smm_status": st.get("status") or "",
        "smm_remains": st.get("remains"),
        "smm_start_count": st.get("start_count"),
        "smm_last_poll_at": _now_iso(),
    }
    # Map panel status → app order status
    panel_status = (st.get("status") or "").strip().lower()
    if panel_status in ("completed",) and order.get("status") != "delivered":
        upd["status"] = "delivered"
    elif panel_status in ("partial",) and order.get("status") != "delivered":
        upd["status"] = "delivered"  # treat partial as delivered (admin can adjust)
    elif panel_status in ("canceled", "cancelled") and order.get("status") not in ("delivered", "refunded"):
        # leave order status as-is, just mark the panel state. Refunds handled separately.
        pass
    await db.orders.update_one({"id": order.get("id")}, {"$set": upd})
    return upd


async def refresh_balance(db) -> Dict[str, Any]:
    """Refresh and persist the latest panel balance. Returns {usd, inr, currency}.
    Triggers low-balance Telegram alert when crossing below threshold."""
    client = await get_client(db)
    if not client:
        return {"usd": 0.0, "inr": 0.0, "currency": "USD", "enabled": False}
    cfg = await get_config(db)
    prev_balance = float(cfg.get("last_balance_usd") or 0)
    try:
        data = await client.balance()
    except Exception as e:
        log.warning("balance refresh failed: %s", e)
        return {"usd": prev_balance, "inr": prev_balance * float(cfg.get("inr_rate") or DEFAULT_INR_RATE), "currency": "USD", "enabled": True, "error": str(e)}
    usd = float(data.get("balance") or 0)
    inr_rate = float(cfg.get("inr_rate") or DEFAULT_INR_RATE)
    inr = usd * inr_rate
    await db.smm_config.update_one({"_id": "main"}, {"$set": {"last_balance_usd": usd, "last_balance_at": _now_iso()}})
    # Cross-threshold alert (only fires when crossing from above → below)
    low_inr = float(cfg.get("low_balance_inr") or DEFAULT_LOW_BALANCE_INR)
    crossed = (prev_balance * inr_rate) > low_inr and inr <= low_inr
    return {"usd": usd, "inr": inr, "currency": data.get("currency") or "USD", "enabled": True, "low_crossed": crossed, "low_threshold_inr": low_inr}
