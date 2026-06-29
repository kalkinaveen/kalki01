"""Iteration 14 — User-reported production bug verification.

Covers:
- BUG #1: PaymentBox blank when /api/payments/settings returns null —
  asserts /api/payments/settings always returns a non-null doc and
  /api/payments/cashfree/config returns the expected production shape.
- BUG #2: Quote email body blank in Gmail — asserts notify_quote_sent
  emits flat HTML (no nested <table> inside the body div), contains
  "QUOTE TOTAL", "Payment options", and CTA url ends with "&pay=1".
- Regression: PaymentBox manual + crypto config still toggles correctly
  via PUT /api/payments/settings (admin).
- Smoke: admin login, customer login, recovery case + send-payment
  flow end-to-end.
"""
import os
import re
import sys
import asyncio
import importlib
import pytest
import requests

# Make backend package importable for unit-test on email_service
sys.path.insert(0, "/app/backend")

def _read_frontend_env():
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
ADMIN_PASSWORD = "admin123"
TEST_EMAIL = "test1@example.com"
TEST_PASSWORD = "hack123"


# ---------------------------- fixtures --------------------------------------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        # try register-then-login (idempotent fallback)
        requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Test One"},
            timeout=20,
        )
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=20,
        )
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------------- BUG #1: payment settings + cashfree config ----------------

class TestBug1PaymentBoxRendersWithFreshSettings:
    """PaymentBox previously returned null when settings was null. Verify the
    API always returns a non-null doc (auto-created by _ensure_payment_settings)
    AND cashfree config reports configured=true production."""

    def test_payments_settings_never_null(self):
        r = requests.get(f"{BASE_URL}/api/payments/settings", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Must be a dict so the frontend `safeSettings` path never collapses.
        assert isinstance(data, dict)
        # Keys the PaymentBox UI relies on
        for key in ("manual_enabled", "crypto_enabled"):
            assert key in data, f"missing key {key}"
        # crypto_wallets must be a list (PaymentBox iterates it)
        assert isinstance(data.get("crypto_wallets", []), list)

    def test_cashfree_config_production(self):
        r = requests.get(f"{BASE_URL}/api/payments/cashfree/config", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("configured") is True, data
        assert data.get("mode") == "production", data

    def test_settings_after_disable_all_manual(self, admin_token):
        """Even with manual_enabled=false AND crypto_enabled=false the response
        must still be a non-null dict — so the React early-null bug stays
        unreproducible at the API layer."""
        # snapshot current to restore after
        before = requests.get(f"{BASE_URL}/api/payments/settings", timeout=15).json()
        payload_off = {"manual_enabled": False, "crypto_enabled": False}
        r = requests.put(
            f"{BASE_URL}/api/payments/settings",
            json=payload_off,
            headers={"X-Admin-Token": admin_token},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        after = requests.get(f"{BASE_URL}/api/payments/settings", timeout=15).json()
        assert isinstance(after, dict)
        assert after["manual_enabled"] is False
        assert after["crypto_enabled"] is False

        # restore
        restore = {
            "manual_enabled": bool(before.get("manual_enabled", True)),
            "crypto_enabled": bool(before.get("crypto_enabled", True)),
            "upi_id": before.get("upi_id", "errorhacker@upi"),
        }
        requests.put(
            f"{BASE_URL}/api/payments/settings",
            json=restore,
            headers={"X-Admin-Token": admin_token},
            timeout=20,
        )


# ---------------- Regression: manual UPI toggle still works ----------------

class TestPaymentSettingsRegression:
    def test_admin_can_enable_manual_with_upi(self, admin_token):
        body = {
            "manual_enabled": True,
            "upi_id": "test@upi",
            "upi_name": "TEST",
            "crypto_enabled": True,
        }
        r = requests.put(
            f"{BASE_URL}/api/payments/settings",
            json=body,
            headers={"X-Admin-Token": admin_token},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        got = requests.get(f"{BASE_URL}/api/payments/settings", timeout=15).json()
        assert got["manual_enabled"] is True
        assert got["upi_id"] == "test@upi"
        assert got["crypto_enabled"] is True

        # restore default
        requests.put(
            f"{BASE_URL}/api/payments/settings",
            json={"upi_id": "errorhacker@upi", "upi_name": "ERRORHACKER"},
            headers={"X-Admin-Token": admin_token},
            timeout=20,
        )


# ---------------- BUG #2: quote email body Gmail-safe ----------------------

class TestBug2QuoteEmailFlatHTML:
    """Unit-test the notify_quote_sent renderer by monkey-patching send_email
    so we can capture the final HTML body and assert it is Gmail-safe."""

    def test_quote_email_html_is_flat_and_renders_all_markers(self, monkeypatch):
        email_service = importlib.import_module("email_service")
        captured = {}

        async def fake_send_email(to, subject, html):
            captured["to"] = to
            captured["subject"] = subject
            captured["html"] = html
            return {"ok": True}

        monkeypatch.setattr(email_service, "send_email", fake_send_email)

        asyncio.get_event_loop().run_until_complete(
            email_service.notify_quote_sent(
                "buyer@example.com",
                "Alice",
                "CASE-DEMO-001",
                4999.0,
                "INR",
                "Recover stolen IG account",
            )
        )

        html = captured.get("html") or ""
        assert html, "notify_quote_sent did not call send_email"
        # Recognizable markers
        assert "QUOTE TOTAL" in html
        assert "Payment options" in html
        # CTA url must end with &pay=1 so the PaymentBox auto-scrolls
        assert "&pay=1" in html
        # Subject must include the amount
        assert "4,999" in captured.get("subject", "") or "4999" in captured.get("subject", "")
        # The customer-facing body div must NOT contain a nested <table>
        # (the wrapper itself uses tables for layout, but the inner body div
        # should be flat per Gmail-safety fix).
        m = re.search(
            r'<div style="font-size:14px;line-height:1\.7;color:#cbd5e1;">(.*?)</div>\s*</td></tr>',
            html,
            re.DOTALL,
        )
        assert m, "body inner div not found in wrapper output"
        inner_body = m.group(1)
        assert "<table" not in inner_body.lower(), (
            "Inner body must be flat HTML — found nested <table> which Gmail strips:\n"
            + inner_body[:400]
        )
        # Must have an explicit color on heading text (not the bare default
        # which Gmail dark-mode could invert to invisible).
        assert 'color:#00ff9d' in inner_body  # neon accent on totals
        assert 'color:#cbd5e1' in inner_body or 'color:#e5e7eb' in inner_body


# ---------------- BUG #2 integration: recovery send-payment ----------------

class TestRecoverySendPaymentTriggersQuote:
    """Hit the real admin endpoint that fires notify_quote_sent. We can't
    capture the email from outside the process, but we CAN verify a linked
    order is created with the quoted amount and the case stored final_amount.
    Combined with the unit test above this proves the full path."""

    def test_admin_send_payment_creates_linked_order(self, admin_token, user_token):
        # Create a recovery case as the customer
        case_payload = {
            "name": "Test One",
            "email": TEST_EMAIL,
            "telegram": "@test1",
            "issue": "TEST_iter14 Instagram account locked",
            "service_name": "Instagram Recovery",
            "service_id": "instagram-recovery",
            "platform": "instagram",
            "account_url": "https://instagram.com/test1",
            "urgency": "high",
        }
        r = requests.post(
            f"{BASE_URL}/api/recovery/cases",
            json=case_payload,
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        case = r.json()
        case_id = case["id"]

        # Admin sends payment / quote for this case
        quote = {"amount": 499.0, "currency": "INR", "note": "TEST_iter14 quote"}
        r2 = requests.post(
            f"{BASE_URL}/api/recovery/cases/{case_id}/send-payment",
            json=quote,
            headers={"X-Admin-Token": admin_token},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data.get("ok") is True
        order = data["order"]
        assert order["amount"] == 499.0
        assert order["currency"] == "INR"
        assert order["case_id"] == case_id
        # Status must be 'received' (pre-payment, so PaymentBox is rendered)
        assert order["status"] == "received"
        # Case must have final_amount stored
        assert data["case"]["final_amount"] == 499.0

        # Verify the linked order is reachable via GET /orders/{id}
        r3 = requests.get(f"{BASE_URL}/api/orders/{order['id']}", timeout=15)
        assert r3.status_code == 200, r3.text
        fetched = r3.json()
        assert fetched["amount"] == 499.0
        assert fetched["status"] == "received"

        # cleanup
        requests.delete(
            f"{BASE_URL}/api/recovery/cases/{case_id}",
            headers={"X-Admin-Token": admin_token},
            timeout=15,
        )


# ---------------- Smoke: customer can see PaymentBox-renderable order -----

class TestCustomerOrderShape:
    def test_customer_order_has_payment_amount_and_unpaid_status(self, admin_token, user_token):
        # create case + quote, then verify shape the OrderDetail page consumes
        case_payload = {
            "name": "Test One",
            "email": TEST_EMAIL,
            "telegram": "@test1",
            "issue": "TEST_iter14 shape check",
            "service_name": "Recovery",
            "service_id": "instagram-recovery",
            "platform": "instagram",
            "account_url": "https://example.com/u",
            "urgency": "med",
        }
        r = requests.post(
            f"{BASE_URL}/api/recovery/cases",
            json=case_payload,
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        case_id = r.json()["id"]
        try:
            r2 = requests.post(
                f"{BASE_URL}/api/recovery/cases/{case_id}/send-payment",
                json={"amount": 1234.0, "currency": "INR", "note": "TEST_iter14"},
                headers={"X-Admin-Token": admin_token},
                timeout=30,
            )
            assert r2.status_code == 200, r2.text
            order_id = r2.json()["order"]["id"]

            # Customer fetches their orders
            r3 = requests.get(
                f"{BASE_URL}/api/me/orders",
                headers={"Authorization": f"Bearer {user_token}"},
                timeout=15,
            )
            assert r3.status_code == 200, r3.text
            mine = r3.json()
            this_order = next((o for o in mine if o["id"] == order_id), None)
            assert this_order is not None, "linked order not visible to customer"
            # PaymentBox key conditions
            assert this_order["status"] not in ("delivered", "paid", "verified", "in-progress")
            assert float(this_order.get("amount") or this_order.get("payment_amount") or 0) > 0
        finally:
            requests.delete(
                f"{BASE_URL}/api/recovery/cases/{case_id}",
                headers={"X-Admin-Token": admin_token},
                timeout=15,
            )
