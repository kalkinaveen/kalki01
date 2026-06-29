"""Cashfree Payment Gateway v3 (2025-01-01) integration.
Hosted-checkout flow — backend creates an order, returns a payment_session_id
which the frontend hands to the Cashfree JS SDK. Webhook + status polling are
the source of truth (never trust the browser redirect alone)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

log = logging.getLogger("cashfree")

_MODE = (os.environ.get("CASHFREE_MODE") or "sandbox").lower()
_CLIENT_ID = os.environ.get("CASHFREE_CLIENT_ID", "")
_CLIENT_SECRET = os.environ.get("CASHFREE_CLIENT_SECRET", "")
_API_VERSION = os.environ.get("CASHFREE_API_VERSION", "2025-01-01")
_BASE_URL = "https://sandbox.cashfree.com/pg" if _MODE != "production" else "https://api.cashfree.com/pg"

SITE_URL = os.environ.get("SITE_URL", "https://errorhacker.site")
BACKEND_PUBLIC_URL = os.environ.get("BACKEND_PUBLIC_URL", SITE_URL)


def is_configured() -> bool:
    return bool(_CLIENT_ID and _CLIENT_SECRET)


def mode() -> str:
    return _MODE


def _headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    h = {
        "x-client-id": _CLIENT_ID,
        "x-client-secret": _CLIENT_SECRET,
        "x-api-version": _API_VERSION,
        "content-type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


async def _request(method: str, path: str, json_body: Optional[Dict[str, Any]] = None,
                   idempotency_key: Optional[str] = None) -> Dict[str, Any]:
    """Issue a Cashfree REST call.

    `idempotency_key` MUST be deterministic per-business-action (use the order_id
    for create-order) so a network retry doesn't accidentally create twins.
    Defaults to a random key when caller didn't supply one (safe for GETs).
    """
    if not is_configured():
        raise RuntimeError("Cashfree is not configured — set CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET")
    async with httpx.AsyncClient(base_url=_BASE_URL, timeout=30) as client:
        resp = await client.request(
            method, path,
            headers=_headers({
                "x-request-id": str(uuid.uuid4()),
                "x-idempotency-key": idempotency_key or str(uuid.uuid4()),
            }),
            json=json_body,
        )
    if resp.status_code >= 400:
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        log.warning("Cashfree %s %s -> %s %s", method, path, resp.status_code, body)
        raise CashfreeError(resp.status_code, body)
    return resp.json()


class CashfreeError(Exception):
    def __init__(self, status: int, body: Any):
        super().__init__(f"Cashfree error {status}: {body}")
        self.status = status
        self.body = body


def verify_webhook_signature(raw_body: bytes, timestamp: str, signature: str) -> bool:
    """Webhook signature = base64(HMAC_SHA256(secret, timestamp + raw_body))."""
    if not (raw_body and timestamp and signature and _CLIENT_SECRET):
        return False
    signed_payload = (timestamp + raw_body.decode("utf-8")).encode()
    expected = base64.b64encode(hmac.new(_CLIENT_SECRET.encode(), signed_payload, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, signature)


async def create_order(
    *, order_id: str, amount: float, customer_id: str, customer_email: str,
    customer_phone: str = "9999999999", customer_name: str = "",
    purpose: str = "wallet_topup", order_note: str = "",
    return_url: Optional[str] = None,
    notify_url: Optional[str] = None,
    tags: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Create a Cashfree order and return the payment_session_id."""
    payload = {
        "order_id": order_id,
        "order_amount": round(float(amount), 2),
        "order_currency": "INR",
        "customer_details": {
            "customer_id": customer_id,
            "customer_phone": customer_phone or "9999999999",
            "customer_email": customer_email or "guest@errorhacker.site",
            "customer_name": customer_name or "Customer",
        },
        "order_note": order_note or purpose,
        "order_tags": {"purpose": purpose, "user_id": customer_id, **(tags or {})},
        "order_meta": {
            "return_url": return_url or f"{SITE_URL}/payments/return?order_id={{order_id}}",
            "notify_url": notify_url or f"{BACKEND_PUBLIC_URL}/api/payments/cashfree/webhook",
        },
    }
    # Deterministic idempotency key per app-side order — protects against
    # network retries silently double-creating Cashfree orders.
    return await _request("POST", "/orders", payload, idempotency_key=f"create:{order_id}")


async def fetch_order(order_id: str) -> Dict[str, Any]:
    return await _request("GET", f"/orders/{order_id}")


async def refund_order(*, order_id: str, refund_amount: float, refund_id: Optional[str] = None,
                       refund_note: str = "Customer refund", speed: str = "STANDARD") -> Dict[str, Any]:
    rid = refund_id or f"RF-{uuid.uuid4().hex[:18].upper()}"
    payload = {
        "refund_amount": round(float(refund_amount), 2),
        "refund_id": rid,
        "refund_note": refund_note,
        "refund_speed": speed,
    }
    return await _request("POST", f"/orders/{order_id}/refunds", payload, idempotency_key=f"refund:{rid}")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
