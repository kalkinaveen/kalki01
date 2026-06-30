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
            "auto_place_on_verified": True,
            "last_balance_usd": 0.0,
            "last_balance_at": None,
            "updated_at": _now_iso(),
        }
        await db.smm_config.insert_one(doc)
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

    # Lookup the linked panel service id on the app-side service.
    # Services live as an array inside site_config.services (not their own collection).
    service_doc = None
    if order.get("service"):
        cfg_doc = await db.site_config.find_one({"_id": "main"}) or {}
        for s in (cfg_doc.get("services") or []):
            if s.get("id") == order["service"]:
                service_doc = s
                break
    if not service_doc or not service_doc.get("smm_service_id"):
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
        placed = await client.add_order(int(service_doc["smm_service_id"]), link, qty)
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
    rate_usd_per_1000 = float(service_doc.get("smm_price_per_1000_usd") or 0)
    charge_usd = (rate_usd_per_1000 * qty) / 1000.0 if rate_usd_per_1000 else 0.0
    out_fields.update({
        "smm_panel_order_id": int(panel_oid),
        "smm_status": "Pending",
        "smm_placed_at": _now_iso(),
        "smm_charge_usd": round(charge_usd, 4),
        "smm_charge_inr": round(charge_usd * inr_rate, 2),
        "smm_service_id_used": int(service_doc["smm_service_id"]),
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
