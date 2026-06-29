"""Resend email service for ERRORHACKER.
- Non-blocking via asyncio.to_thread
- Premium neon-themed HTML templates inline-CSS (email-client safe)
- Falls back to onboarding@resend.dev when SENDER_EMAIL domain isn't verified yet
"""
import os
import asyncio
import logging
from typing import Optional, Dict, Any

import resend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("email")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
SENDER_NAME = os.environ.get("SENDER_NAME", "ERRORHACKER")
SITE_URL = "https://errorhacker.site"

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _wrap(title: str, preheader: str, body_html: str, cta_label: str = "", cta_url: str = "") -> str:
    """Premium neon-themed HTML wrapper (inline-CSS, tables for layout)."""
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f'''
        <tr><td style="padding:28px 32px 8px 32px;" align="center">
          <a href="{cta_url}" style="display:inline-block;padding:13px 28px;border-radius:8px;background:#00ff9d;color:#001a10;text-decoration:none;font-weight:800;font-family:Inter,Arial,sans-serif;font-size:13px;letter-spacing:.05em;">
            {cta_label} →
          </a>
        </td></tr>'''
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:#050608;font-family:Inter,Arial,sans-serif;color:#e5e7eb;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{preheader}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#050608;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#0a0d10;border:1px solid #1f2937;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:24px 32px;border-bottom:1px solid #1f2937;background:#070a0d;">
        <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-weight:900;font-size:18px;color:#00ff9d;letter-spacing:.08em;">⚡ ERRORHACKER</div>
      </td></tr>
      <tr><td style="padding:32px 32px 12px 32px;">
        <h1 style="margin:0 0 12px 0;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-weight:800;font-size:24px;line-height:1.25;color:#ffffff;letter-spacing:-.01em;">{title}</h1>
        <div style="font-size:14px;line-height:1.7;color:#cbd5e1;">{body_html}</div>
      </td></tr>
      {cta_block}
      <tr><td style="padding:24px 32px;border-top:1px solid #1f2937;background:#070a0d;font-size:11px;color:#64748b;line-height:1.6;">
        <div>You're receiving this because you used ERRORHACKER. We never share your info.</div>
        <div style="margin-top:8px;"><a href="{SITE_URL}" style="color:#00ff9d;text-decoration:none;">errorhacker.site</a> · <a href="{SITE_URL}/track" style="color:#00ff9d;text-decoration:none;">Track</a> · <a href="{SITE_URL}/recovery" style="color:#00ff9d;text-decoration:none;">Recovery</a></div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>'''


def _receipt_url(txn_id: str) -> str:
    return f"{SITE_URL}/receipt/{txn_id}"


async def send_wallet_receipt_email(email: str, name: str, txn: Dict[str, Any], new_balance: Optional[float] = None):
    """Send a clean printable receipt email for any wallet transaction (deposit, spin, debit)."""
    if not email or not txn:
        return
    is_credit = txn.get("type") in ("credit", "spin", "cashback", "refund")
    sign = "+" if is_credit else "−"
    color = "#00ff9d" if is_credit else "#ff5577"
    type_label = {
        "credit": "Wallet Top-up",
        "debit": "Wallet Debit",
        "spin": "Spin Reward",
        "cashback": "Cashback",
        "refund": "Refund",
    }.get(txn.get("type", ""), str(txn.get("type", "")).title())
    ref = txn.get("ref") or {}
    method = (ref.get("method") or "").upper()
    tx_ref = ref.get("tx_reference") or ""
    bal_after = txn.get("balance_after", new_balance) or 0.0
    rows_html = f"""
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;">Type</td><td style="padding:8px 0;text-align:right;color:#e5e7eb;font-size:13px;font-weight:600;">{type_label}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Amount</td><td style="padding:8px 0;text-align:right;color:{color};font-family:'Space Grotesk',Inter,sans-serif;font-size:18px;font-weight:800;border-top:1px dashed #1f2937;">{sign}₹{float(txn.get("amount", 0)):,.2f}</td></tr>
      {f'<tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Method</td><td style="padding:8px 0;text-align:right;color:#e5e7eb;font-size:13px;border-top:1px dashed #1f2937;">{method}</td></tr>' if method else ''}
      {f'<tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Reference</td><td style="padding:8px 0;text-align:right;color:#e5e7eb;font-family:JetBrains Mono,monospace;font-size:11px;word-break:break-all;border-top:1px dashed #1f2937;">{tx_ref}</td></tr>' if tx_ref else ''}
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Balance After</td><td style="padding:8px 0;text-align:right;color:#00ff9d;font-family:'Space Grotesk',Inter,sans-serif;font-size:14px;font-weight:700;border-top:1px dashed #1f2937;">₹{float(bal_after):,.2f}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Receipt ID</td><td style="padding:8px 0;text-align:right;color:#e5e7eb;font-family:JetBrains Mono,monospace;font-size:11px;border-top:1px dashed #1f2937;">{txn.get("id", "—")}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Date</td><td style="padding:8px 0;text-align:right;color:#e5e7eb;font-family:JetBrains Mono,monospace;font-size:11px;border-top:1px dashed #1f2937;">{(txn.get("createdAt") or "")[:19].replace("T", " ")}</td></tr>
    """
    body = f"""
      <p>Hey {name or 'there'},</p>
      <p>Here's your receipt for the transaction below.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:10px;background:#10141a;border:1px solid #1f2937;border-radius:10px;padding:18px 22px;">
        {rows_html}
      </table>
      <p style="margin-top:18px;font-size:12px;color:#64748b;">Keep this receipt for your records. You can also view it any time on your account.</p>
    """
    subject = f"[ERRORHACKER] Receipt · {sign}₹{float(txn.get('amount', 0)):,.0f} · {txn.get('id', '')}"
    html = _wrap(f"Receipt · {sign}₹{float(txn.get('amount', 0)):,.0f}", f"Wallet receipt {txn.get('id', '')}", body, "VIEW RECEIPT", _receipt_url(txn.get("id", "")))
    await send_email(email, subject, html)


async def send_order_receipt_email(email: str, name: str, order: Dict[str, Any], amount: float, method: str = "online"):
    """Send a printable receipt email after a service/recovery order is paid."""
    if not email or not order:
        return
    order_id = order.get("id", "")
    svc = order.get("serviceName") or order.get("service") or "Service"
    paid_at = (order.get("payment_verified_at") or order.get("payment_submitted_at") or "")[:19].replace("T", " ")
    method_label = {
        "cashfree": "Cashfree · Card/UPI",
        "wallet":   "Wallet Balance",
        "manual":   "Manual UPI / Bank",
        "crypto":   "Crypto",
    }.get(method, method.title())
    rows = f"""
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;">Order ID</td><td style="padding:8px 0;text-align:right;color:#00ff9d;font-family:JetBrains Mono,monospace;font-size:12px;">{order_id}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Service</td><td style="padding:8px 0;text-align:right;color:#e5e7eb;font-size:13px;font-weight:600;border-top:1px dashed #1f2937;">{svc}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Amount Paid</td><td style="padding:8px 0;text-align:right;color:#00ff9d;font-family:'Space Grotesk',Inter,sans-serif;font-size:20px;font-weight:800;border-top:1px dashed #1f2937;">₹{amount:,.2f}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Method</td><td style="padding:8px 0;text-align:right;color:#e5e7eb;font-size:13px;border-top:1px dashed #1f2937;">{method_label}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Status</td><td style="padding:8px 0;text-align:right;color:#00ff9d;font-size:13px;font-weight:700;border-top:1px dashed #1f2937;">VERIFIED · WORK STARTED</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:12px;border-top:1px dashed #1f2937;">Date</td><td style="padding:8px 0;text-align:right;color:#e5e7eb;font-family:JetBrains Mono,monospace;font-size:11px;border-top:1px dashed #1f2937;">{paid_at or '—'}</td></tr>
    """
    body = f"""
      <p>Hey {name or 'there'},</p>
      <p>Payment received — your order is officially in our queue. Receipt below for your records.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:10px;background:#10141a;border:1px solid #1f2937;border-radius:10px;padding:18px 22px;">
        {rows}
      </table>
      <p style="margin-top:18px;font-size:13px;color:#cbd5e1;">You'll get live status updates via email + Telegram bot as your order moves through each stage.</p>
      <p style="margin-top:6px;font-size:12px;color:#64748b;">Need anything? Just reply to this email or ping us on the bot.</p>
    """
    subject = f"[ERRORHACKER] Receipt · ₹{amount:,.0f} · Order {order_id}"
    html = _wrap(f"Payment received · ₹{amount:,.0f}", f"Receipt for order {order_id}", body, "OPEN LIVE TRACKER", f"{SITE_URL}/track?id={order_id}")
    await send_email(email, subject, html)


async def send_email(to: str, subject: str, html: str) -> Dict[str, Any]:
    """Non-blocking send. Logs and swallows errors so caller flow never breaks."""
    if not RESEND_API_KEY or not to:
        logger.warning("send_email skipped: missing key or recipient")
        return {"ok": False, "skipped": True}
    params = {"from": f"{SENDER_NAME} <{SENDER_EMAIL}>", "to": [to], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"resend ok id={result.get('id')} to={to}")
        return {"ok": True, "id": result.get("id")}
    except Exception as e:
        msg = str(e)
        logger.error(f"resend fail to={to}: {msg}")
        # If sender domain not verified, retry with fallback test sender so emails still flow
        if "not verified" in msg.lower() or "domain" in msg.lower():
            try:
                params["from"] = "ERRORHACKER <onboarding@resend.dev>"
                result = await asyncio.to_thread(resend.Emails.send, params)
                return {"ok": True, "id": result.get("id"), "fallback": True}
            except Exception as e2:
                logger.error(f"resend fallback also failed: {e2}")
                return {"ok": False, "error": str(e2)}
        return {"ok": False, "error": msg}


# ---- High-level event-specific helpers ----

CASE_STATUS_COPY = {
    "new":        ("Case received — quote in 24h", "We've received your case", "Our team will review the details you submitted and send a free quote within <b>24 hours</b>. You don't pay a rupee until we confirm we can help."),
    "reviewing":  ("Your case is under review", "We're reviewing your case", "A specialist is digging into the details. Expect an update within <b>12 hours</b>."),
    "engaged":    ("Engagement confirmed — work has started", "We're on it 🚀", "Your case is now <b>actively being worked on</b>. Our specialist will keep you posted via Telegram & email."),
    "recovering": ("Active recovery in progress", "Active recovery in progress ⚙️", "We're communicating with the platform on your behalf. This stage typically takes <b>1–7 days</b>."),
    "recovered":  ("Your account is back 🎉", "We did it 🎉", "Your account has been successfully recovered. Please log in and re-secure it (change password + enable 2FA). We'd love your honest review."),
    "closed":     ("Case closed", "Case closed", "We've closed this case. If anything resurfaces, just reply to this email and we'll re-open it."),
    "rejected":   ("Sorry — we can't help on this one", "Sorry, this one wasn't possible", "After a careful review we don't believe we can recover this case. No charge has been made. Reply for more info."),
}

async def notify_case_received(email: str, name: str, case_id: str, service_name: str):
    if not email:
        return
    body = f"""
      <p>Hey {name or 'there'},</p>
      <p>Thanks for trusting us with your <b>{service_name}</b> case. We've created your case ID:</p>
      <p style="background:#10141a;border:1px solid #1f2937;border-radius:8px;padding:14px 18px;font-family:JetBrains Mono,monospace;color:#00ff9d;font-size:16px;letter-spacing:.05em;">🆔 {case_id}</p>
      <p>You'll get a <b>free quote within 24h</b>. Track your case any time using the button below.</p>
    """
    html = _wrap("Case received", f"Your case {case_id} is in good hands", body, "TRACK YOUR CASE", f"{SITE_URL}/track?id={case_id}")
    await send_email(email, f"[ERRORHACKER] Case {case_id} received — quote in 24h", html)

async def notify_case_status(email: str, name: str, case_id: str, status: str, admin_note: str = ""):
    if not email:
        return
    meta = CASE_STATUS_COPY.get(status)
    if not meta:
        return
    subject_tag, title, default_body = meta
    note_block = f'<p style="background:#10141a;border-left:3px solid #00ff9d;padding:12px 16px;color:#cbd5e1;font-style:italic;">"{admin_note}"</p>' if admin_note else ""
    body = f"""
      <p>Hey {name or 'there'},</p>
      <p>{default_body}</p>
      {note_block}
      <p style="margin-top:18px;color:#64748b;font-size:12px;">Case <b style="color:#00ff9d;">{case_id}</b> — status: <b>{status.upper()}</b></p>
    """
    cta_label = "LEAVE A REVIEW" if status == "recovered" else "OPEN LIVE TRACKER"
    cta_url = f"{SITE_URL}/track?id={case_id}"
    html = _wrap(title, f"Status update for {case_id}", body, cta_label, cta_url)
    await send_email(email, f"[ERRORHACKER] {subject_tag} · {case_id}", html)

async def notify_quote_sent(email: str, name: str, case_id: str, amount: float, currency: str, note: str = ""):
    if not email:
        return
    sym = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}.get(currency, "")
    note_block = f'<p style="background:#10141a;border-left:3px solid #00ff9d;padding:12px 16px;color:#cbd5e1;font-style:italic;">"{note}"</p>' if note else ""
    body = f"""
      <p>Hey {name or 'there'},</p>
      <p>Your recovery quote is ready — work starts the moment you pay:</p>
      <p style="background:#10141a;border:1px solid #00ff9d33;border-radius:10px;padding:18px 22px;font-family:'Space Grotesk',Inter,sans-serif;color:#00ff9d;font-size:32px;font-weight:800;text-align:center;">{sym}{amount:,.0f} <span style="color:#64748b;font-size:14px;font-weight:400;">{currency}</span></p>
      {note_block}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;background:#0d1115;border:1px solid #1f2937;border-radius:10px;padding:14px 18px;">
        <tr>
          <td style="padding:8px 0;">
            <div style="color:#00ff9d;font-family:JetBrains Mono,monospace;font-size:11px;letter-spacing:.1em;">// PAYMENT OPTIONS</div>
            <ul style="margin:8px 0 0 0;padding-left:20px;color:#cbd5e1;font-size:13px;line-height:24px;">
              <li><b style="color:#00ff9d;">Instant</b> — Card / UPI / Netbanking (Cashfree, secured)</li>
              <li>Manual UPI / Bank transfer</li>
              <li>Crypto (USDT &amp; more)</li>
            </ul>
          </td>
        </tr>
      </table>
      <p style="margin-top:18px;font-size:13px;color:#cbd5e1;">Tap the button below — pick your method and you're done in &lt; 30 sec.</p>
    """
    html = _wrap("Your quote is ready 💳", f"Pay {sym}{amount:,.0f} to start recovery", body, "PAY NOW · OPEN CASE", f"{SITE_URL}/track?id={case_id}&pay=1")
    await send_email(email, f"[ERRORHACKER] Quote ready · {sym}{amount:,.0f} for {case_id}", html)

async def notify_order_status(email: str, name: str, order_id: str, status: str, service_name: str = ""):
    if not email:
        return
    titles = {
        "received":      ("Order received", "We've received your order and will start verification."),
        "payment_review":("Payment under review", "We're verifying your payment. Usually takes 5–15 minutes."),
        "verified":      ("Payment verified ✓", "Payment confirmed. Work has started."),
        "in-progress":   ("Order in progress ⚙️", "Active work is underway."),
        "delivered":     ("Order delivered 🎉", "Your order has been delivered. Thanks for choosing us!"),
        "paid":          ("Payment received", "Payment received and confirmed."),
        "cancelled":     ("Order cancelled", "This order has been cancelled. Reply if you need anything."),
    }
    t = titles.get(status)
    if not t:
        return
    title, body_msg = t
    body = f"""
      <p>Hey {name or 'there'},</p>
      <p>{body_msg}</p>
      <p style="background:#10141a;border:1px solid #1f2937;border-radius:8px;padding:14px 18px;color:#cbd5e1;">
        <b style="color:#00ff9d;font-family:JetBrains Mono,monospace;">{order_id}</b>{f' · {service_name}' if service_name else ''}<br>
        Status: <b>{status.upper()}</b>
      </p>
    """
    html = _wrap(title, f"Update for order {order_id}", body, "OPEN LIVE TRACKER", f"{SITE_URL}/track?id={order_id}")
    await send_email(email, f"[ERRORHACKER] {title} · {order_id}", html)

async def notify_wallet_credited(email: str, name: str, amount: float, balance_after: float):
    if not email:
        return
    body = f"""
      <p>Hey {name or 'there'},</p>
      <p>Your wallet has been topped up:</p>
      <p style="background:#10141a;border:1px solid #00ff9d33;border-radius:10px;padding:18px 22px;font-family:'Space Grotesk',Inter,sans-serif;color:#00ff9d;font-size:28px;font-weight:800;text-align:center;">
        +₹{amount:,.2f}
        <div style="font-size:12px;color:#64748b;font-weight:400;margin-top:6px;">New balance: ₹{balance_after:,.2f}</div>
      </p>
      <p>You can use this balance instantly across any service.</p>
    """
    html = _wrap("Wallet credited 💰", f"+₹{amount:,.0f} added", body, "OPEN WALLET", f"{SITE_URL}/me/wallet")
    await send_email(email, f"[ERRORHACKER] +₹{amount:,.0f} credited to your wallet", html)
