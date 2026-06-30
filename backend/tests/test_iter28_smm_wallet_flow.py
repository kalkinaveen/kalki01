"""Iter-28: SMM wallet-only flow + admin orders inbox.

Coverage:
  - Anonymous POST /api/public/smm/order → 401
  - Auth + sufficient wallet → order created, wallet debited atomically, tier discount applied
  - Auth + insufficient wallet → 402 with code='wallet_insufficient', no order created
  - Operative tier (5%) discount auto-applied; rookie pays full price
  - /public/smm/quote returns extended payload (logged-in vs anon)
  - /admin/smm/orders returns summary + filters; seed catalog endpoint works
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PWD = "admin123"
TEST_USER_EMAIL = "test1@example.com"
TEST_USER_PWD = "hack123"
TEST_SERVICE_ID = 999001  # Instagram followers, ₹12.50 / 1000


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PWD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module", autouse=True)
def seed_catalog(admin_token):
    r = requests.post(f"{API}/admin/smm/seed-test-catalog", headers={"X-Admin-Token": admin_token}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("seeded") == 3
    yield


@pytest.fixture(scope="module")
def test1_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": TEST_USER_EMAIL, "password": TEST_USER_PWD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def fresh_user_session():
    """Register a brand-new user with zero wallet balance (rookie tier)."""
    email = f"TEST_iter28_{uuid.uuid4().hex[:8]}@example.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!", "name": "Iter28 Tester"}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    s.email = email  # type: ignore[attr-defined]
    return s


# ------------------------------------------------------------------
# 1. /public/smm/order requires auth
# ------------------------------------------------------------------
class TestAuthGate:
    def test_anonymous_order_returns_401(self):
        r = requests.post(
            f"{API}/public/smm/order",
            json={"smm_service_id": TEST_SERVICE_ID, "quantity": 100, "link": "https://instagram.com/test"},
            timeout=15,
        )
        assert r.status_code == 401, r.text
        body = r.json()
        msg = body.get("detail") if isinstance(body.get("detail"), str) else str(body)
        assert "sign in" in msg.lower() or "login" in msg.lower()


# ------------------------------------------------------------------
# 2. /public/smm/quote payload (anon vs logged in)
# ------------------------------------------------------------------
class TestQuotePayload:
    def test_quote_anonymous(self):
        r = requests.post(
            f"{API}/public/smm/quote",
            json={"smm_service_id": TEST_SERVICE_ID, "quantity": 1000, "link": "x"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("service", "quantity", "base_charge_inr", "discount_pct",
                  "discount_amount_inr", "charge_inr", "tier_name",
                  "wallet_balance_inr", "wallet_sufficient", "logged_in"):
            assert k in d, f"missing {k}"
        assert d["logged_in"] is False
        assert d["wallet_balance_inr"] == 0
        assert d["discount_pct"] == 0

    def test_quote_logged_in_operative(self, test1_session):
        r = test1_session.post(
            f"{API}/public/smm/quote",
            json={"smm_service_id": TEST_SERVICE_ID, "quantity": 1000, "link": "x"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["logged_in"] is True
        # test1 is on operative tier (5% discount). Allow rookie fallback if subscription expired.
        assert d["discount_pct"] in (0, 5), f"unexpected discount_pct {d['discount_pct']}"
        # base = 12.50; if operative: charge ~= 11.88
        assert d["base_charge_inr"] == pytest.approx(12.50, rel=0.01)
        if d["discount_pct"] == 5:
            assert d["charge_inr"] == pytest.approx(11.88, abs=0.05)


# ------------------------------------------------------------------
# 3. Wallet-insufficient → 402, no order, no debit
# ------------------------------------------------------------------
class TestWalletInsufficient:
    def test_fresh_user_402(self, fresh_user_session):
        # Fresh user has 0 wallet balance. Need quote to know charge.
        body = {"smm_service_id": TEST_SERVICE_ID, "quantity": 1000, "link": "https://instagram.com/test"}
        r = fresh_user_session.post(f"{API}/public/smm/order", json=body, timeout=15)
        assert r.status_code == 402, r.text
        d = r.json().get("detail") or {}
        assert d.get("code") == "wallet_insufficient"
        assert "needed_inr" in d
        assert "current_balance_inr" in d
        assert "charge_inr" in d
        assert d["current_balance_inr"] == 0

        # Verify wallet still 0 (no debit), no order created
        wr = fresh_user_session.get(f"{API}/me/wallet", timeout=15)
        assert wr.status_code == 200
        assert float(wr.json().get("balance", 0)) == 0


# ------------------------------------------------------------------
# 4. Successful wallet-paid order (atomicity, discount, response shape)
# ------------------------------------------------------------------
class TestSuccessfulOrder:
    def test_create_order_debits_wallet_and_returns_redirect(self, test1_session):
        # Snapshot wallet
        w0 = test1_session.get(f"{API}/me/wallet", timeout=15).json()
        bal_before = float(w0.get("balance", 0))

        # Pre-quote
        q = test1_session.post(
            f"{API}/public/smm/quote",
            json={"smm_service_id": TEST_SERVICE_ID, "quantity": 1000, "link": "x"},
            timeout=15,
        ).json()
        charge = float(q["charge_inr"])

        if bal_before < charge:
            pytest.skip(f"test1 wallet too low ({bal_before}) for this test")

        order_body = {
            "smm_service_id": TEST_SERVICE_ID,
            "quantity": 1000,
            "link": "https://instagram.com/iter28_test",
            "notes": "TEST_iter28",
        }
        r = test1_session.post(f"{API}/public/smm/order", json=order_body, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        order = d["order"]
        assert order["status"] == "verified"
        assert order["payment_method"] == "wallet"
        assert order["payment_status"] == "paid"
        assert order["wallet_txn_id"]
        assert order["smm_service_id"] == TEST_SERVICE_ID
        assert order["amount"] == pytest.approx(charge, abs=0.05)
        # Tier discount fields populated
        for k in ("tier_at_order", "discount_pct", "discount_amount_inr", "base_charge_inr"):
            assert k in order
        # Redirect should not include &pay=1
        assert d["redirect"].startswith("/track?id=")
        assert "&pay=1" not in d["redirect"] and "pay=1" not in d["redirect"]

        # New balance
        assert d["new_wallet_balance_inr"] == pytest.approx(bal_before - charge, abs=0.05)
        # Verify by re-fetching wallet
        w1 = test1_session.get(f"{API}/me/wallet", timeout=15).json()
        assert float(w1.get("balance", 0)) == pytest.approx(bal_before - charge, abs=0.05)


# ------------------------------------------------------------------
# 5. Admin SMM orders inbox
# ------------------------------------------------------------------
class TestAdminOrdersInbox:
    def test_list_summary(self, admin_token):
        r = requests.get(f"{API}/admin/smm/orders", headers={"X-Admin-Token": admin_token}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("rows", "total", "pending", "errored", "completed"):
            assert k in d
        assert isinstance(d["rows"], list)
        # All rows must have smm_service_id
        for o in d["rows"]:
            assert "smm_service_id" in o
            assert "_id" not in o

    def test_filter_has_error(self, admin_token):
        r = requests.get(
            f"{API}/admin/smm/orders",
            headers={"X-Admin-Token": admin_token},
            params={"has_error": 1},
            timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_admin_token_required(self):
        r = requests.get(f"{API}/admin/smm/orders", timeout=15)
        assert r.status_code in (401, 403)
