"""Cashfree Payment Gateway routes (extracted from server.py).

Endpoints:
  GET   /api/payments/cashfree/config
  POST  /api/me/wallet/topup/cashfree
  POST  /api/me/orders/{order_id}/pay/cashfree
  GET   /api/payments/cashfree/orders/{cf_order_id}/status
  POST  /api/payments/cashfree/webhook
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import cashfree_service as cf

router = APIRouter()
log = logging.getLogger("eh.cashfree")

# Cache the server module after first lookup. Avoids the import-time cycle and
# keeps each call fast (one dict lookup vs. a real import).
_S: Any = None


def _srv():
    global _S
    if _S is None:
        import server as _server  # late import: server has finished loading
        _S = _server
    return _S


class CashfreeTopupIn(BaseModel):
    amount: float = Field(..., gt=0, le=1000000)
    phone: Optional[str] = ""


class CashfreeOrderPayIn(BaseModel):
    phone: Optional[str] = ""


@router.get("/payments/cashfree/config")
async def cashfree_pub_config():
    return {"configured": cf.is_configured(), "mode": cf.mode()}


@router.post("/me/wallet/topup/cashfree")
async def me_wallet_topup_cashfree(body: CashfreeTopupIn, request: Request):
    s = _srv()
    user = await s._get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    if not cf.is_configured():
        raise HTTPException(status_code=503, detail="Cashfree is not configured yet")
    amount = round(float(body.amount), 2)
    if amount < 1:
        raise HTTPException(status_code=400, detail="Minimum top-up is ₹1")
    cf_order_id = f"WTU-{uuid.uuid4().hex[:18].upper()}"
    try:
        result = await cf.create_order(
            order_id=cf_order_id,
            amount=amount,
            customer_id=user["user_id"],
            customer_email=user.get("email", ""),
            customer_phone=(body.phone or user.get("phone") or "9999999999"),
            customer_name=user.get("name", ""),
            purpose="wallet_topup",
            order_note=f"Wallet top-up · {user.get('email','')}",
            return_url=f"{cf.SITE_URL}/payments/return?order_id={{order_id}}",
        )
    except cf.CashfreeError as e:
        log.warning("Cashfree create_order failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Cashfree error: {e.body}")
    await s.db.cashfree_orders.insert_one({
        "id": cf_order_id,
        "user_id": user["user_id"],
        "user_email": user.get("email"),
        "purpose": "wallet_topup",
        "amount": amount,
        "status": result.get("order_status", "ACTIVE"),
        "payment_session_id": result.get("payment_session_id"),
        "cf_order_id": result.get("cf_order_id"),
        "createdAt": s._now_iso(),
    })
    return {
        "ok": True,
        "order_id": cf_order_id,
        "payment_session_id": result.get("payment_session_id"),
        "mode": cf.mode(),
    }


@router.post("/me/orders/{order_id}/pay/cashfree")
async def me_pay_order_cashfree(order_id: str, body: CashfreeOrderPayIn, request: Request):
    """Create a Cashfree session for paying a specific service order directly."""
    s = _srv()
    user = await s._get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    if not cf.is_configured():
        raise HTTPException(status_code=503, detail="Cashfree not configured")
    order = await s.db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("user_id") and order.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.get("status") in ("verified", "paid", "in-progress", "delivered"):
        raise HTTPException(status_code=400, detail="Order already paid")
    amount = float(order.get("payment_amount") or order.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Order price not set — ask admin to send a quote first")
    cf_order_id = f"OPY-{order_id[-8:]}-{uuid.uuid4().hex[:6].upper()}"
    try:
        result = await cf.create_order(
            order_id=cf_order_id,
            amount=amount,
            customer_id=user["user_id"],
            customer_email=user.get("email", ""),
            customer_phone=(body.phone or user.get("phone") or "9999999999"),
            customer_name=user.get("name", ""),
            purpose="service_payment",
            order_note=f"Order {order_id} · {order.get('serviceName') or order.get('service') or ''}",
            return_url=f"{cf.SITE_URL}/me/orders/{order_id}?cf={{order_id}}",
            tags={"app_order_id": order_id},
        )
    except cf.CashfreeError as e:
        raise HTTPException(status_code=502, detail=f"Cashfree error: {e.body}")
    await s.db.cashfree_orders.insert_one({
        "id": cf_order_id,
        "user_id": user["user_id"],
        "user_email": user.get("email"),
        "purpose": "service_payment",
        "amount": amount,
        "app_order_id": order_id,
        "status": result.get("order_status", "ACTIVE"),
        "payment_session_id": result.get("payment_session_id"),
        "cf_order_id": result.get("cf_order_id"),
        "createdAt": s._now_iso(),
    })
    return {"ok": True, "order_id": cf_order_id, "payment_session_id": result.get("payment_session_id"), "mode": cf.mode()}


@router.get("/payments/cashfree/orders/{cf_order_id}/status")
async def cashfree_order_status(cf_order_id: str):
    if not cf.is_configured():
        raise HTTPException(status_code=503, detail="Cashfree not configured")
    try:
        data = await cf.fetch_order(cf_order_id)
    except cf.CashfreeError as e:
        raise HTTPException(status_code=502, detail=f"Cashfree error: {e.body}")
    await _srv()._cashfree_reconcile(cf_order_id, data)
    return {
        "order_id": cf_order_id,
        "order_status": data.get("order_status"),
        "order_amount": data.get("order_amount"),
    }


@router.post("/payments/cashfree/webhook")
async def cashfree_webhook(request: Request):
    s = _srv()
    raw = await request.body()
    ts = request.headers.get("x-webhook-timestamp") or ""
    sig = request.headers.get("x-webhook-signature") or ""
    if not cf.verify_webhook_signature(raw, ts, sig):
        log.warning("Cashfree webhook signature failed (ts=%s)", ts)
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    order_id = (
        (payload.get("data") or {}).get("order", {}).get("order_id")
        or (payload.get("data") or {}).get("order_id")
        or payload.get("order_id")
        or (payload.get("order") or {}).get("order_id")
    )
    if order_id:
        try:
            latest = await cf.fetch_order(order_id)
            await s._cashfree_reconcile(order_id, latest)
        except Exception as e:
            log.warning("Cashfree webhook reconcile failed for %s: %s", order_id, e)
            return JSONResponse({"ok": False, "error": "reconcile_failed"}, status_code=202)
    else:
        log.warning("Cashfree webhook missing order_id in payload: %s", str(payload)[:300])
        return JSONResponse({"ok": False, "error": "no_order_id"}, status_code=202)
    return {"ok": True}
