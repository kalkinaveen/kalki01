"""
Backend tests for iteration-7:
  - Wallet deposit Telegram-approval flow
  - Customizable payment instructions (admin)
  - Admin chat-id list management
  - Receipt page endpoint (GET /api/me/wallet/transactions/{txn_id})

Runs HTTP against the public preview URL.
"""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "admin123"
TEST_EMAIL = f"test1+{uuid.uuid4().hex[:6]}@example.com"
TEST_PASSWORD = "hack123"


# ---------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"X-Admin-Token": admin_token}


@pytest.fixture(scope="module")
def user_session():
    """Register + login a test customer. Returns (token, user_id, session)."""
    s = requests.Session()
    # register; ignore if already exists
    r = s.post(f"{API}/auth/register", json={
        "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Test One"
    }, timeout=15)
    # login (works regardless of register status)
    r = s.post(f"{API}/auth/login", json={
        "email": TEST_EMAIL, "password": TEST_PASSWORD
    }, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    token = data.get("token") or data.get("access_token")
    user = data.get("user") or {}
    s.headers.update({"Authorization": f"Bearer {token}"})
    return {"session": s, "token": token, "user_id": user.get("user_id") or user.get("id"), "email": TEST_EMAIL}


# ---------------------------------------------------------------
# Admin Telegram admin-chats
# ---------------------------------------------------------------
class TestAdminChats:
    def test_get_admin_chats(self, admin_headers):
        r = requests.get(f"{API}/admin/telegram/admin-chats", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "admin_chat_ids" in data
        assert isinstance(data["admin_chat_ids"], list)

    def test_get_admin_chats_requires_auth(self):
        r = requests.get(f"{API}/admin/telegram/admin-chats", timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_put_admin_chats_dedupe_normalize(self, admin_headers):
        # Save originals
        orig = requests.get(f"{API}/admin/telegram/admin-chats", headers=admin_headers, timeout=15).json()
        orig_ids = orig.get("admin_chat_ids") or []
        try:
            payload = {"admin_chat_ids": [555555, "555555", "777777", "abc", 555555]}
            r = requests.put(f"{API}/admin/telegram/admin-chats",
                             headers=admin_headers, json=payload, timeout=15)
            assert r.status_code == 200, r.text
            saved = r.json()
            assert saved["ok"] is True
            assert saved["admin_chat_ids"] == [555555, 777777], f"Got {saved['admin_chat_ids']}"
            # Persistence
            r2 = requests.get(f"{API}/admin/telegram/admin-chats", headers=admin_headers, timeout=15)
            assert r2.json()["admin_chat_ids"] == [555555, 777777]
        finally:
            requests.put(f"{API}/admin/telegram/admin-chats",
                         headers=admin_headers, json={"admin_chat_ids": orig_ids}, timeout=15)

    def test_admin_chats_test_empty(self, admin_headers):
        # Set empty list, then call test -> should be ok:false (no chats) OR token missing
        orig = requests.get(f"{API}/admin/telegram/admin-chats", headers=admin_headers, timeout=15).json()
        orig_ids = orig.get("admin_chat_ids") or []
        try:
            requests.put(f"{API}/admin/telegram/admin-chats",
                         headers=admin_headers, json={"admin_chat_ids": []}, timeout=15)
            r = requests.post(f"{API}/admin/telegram/admin-chats/test", headers=admin_headers, timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("ok") is False, f"Expected ok:false for empty list, got {data}"
            assert "sent" in data
            assert data["sent"] == 0
        finally:
            requests.put(f"{API}/admin/telegram/admin-chats",
                         headers=admin_headers, json={"admin_chat_ids": orig_ids}, timeout=15)


# ---------------------------------------------------------------
# Admin Telegram payment-info
# ---------------------------------------------------------------
class TestPaymentInfo:
    def test_get_payment_info_default(self, admin_headers):
        r = requests.get(f"{API}/admin/telegram/payment-info", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # required keys
        expected_keys = {"heading", "intro", "upi_id", "upi_name", "crypto_wallets",
                        "instructions", "support_text",
                        "show_paid_button", "show_support_button", "show_quote_button",
                        "paid_button_label", "support_button_label", "quote_button_label",
                        "support_url", "quote_url", "paid_form_url"}
        missing = expected_keys - set(data.keys())
        assert not missing, f"Missing keys: {missing}"
        assert isinstance(data["crypto_wallets"], list)

    def test_put_payment_info_partial_merge(self, admin_headers):
        orig = requests.get(f"{API}/admin/telegram/payment-info", headers=admin_headers, timeout=15).json()
        try:
            unique_heading = f"TEST_HEADING_{uuid.uuid4().hex[:6]}"
            # Send only `heading` and an unknown key (should be ignored)
            r = requests.put(f"{API}/admin/telegram/payment-info",
                             headers=admin_headers,
                             json={"heading": unique_heading, "bogus_key": "ignored"},
                             timeout=15)
            assert r.status_code == 200, r.text
            saved = r.json()
            assert saved.get("ok") is True
            pi = saved["payment_info"]
            assert pi["heading"] == unique_heading
            # other fields preserved from orig
            assert pi["upi_id"] == orig["upi_id"]
            assert pi["intro"] == orig["intro"]
            assert "bogus_key" not in pi

            # GET round-trip
            r2 = requests.get(f"{API}/admin/telegram/payment-info", headers=admin_headers, timeout=15)
            assert r2.json()["heading"] == unique_heading
        finally:
            # restore (strip keys that aren't in the allowed set)
            allowed = {"heading", "intro", "upi_id", "upi_name", "crypto_wallets",
                       "instructions", "support_text",
                       "show_paid_button", "show_support_button", "show_quote_button",
                       "paid_button_label", "support_button_label", "quote_button_label",
                       "support_url", "quote_url", "paid_form_url"}
            restore = {k: v for k, v in orig.items() if k in allowed}
            requests.put(f"{API}/admin/telegram/payment-info",
                         headers=admin_headers, json=restore, timeout=15)


# ---------------------------------------------------------------
# Wallet deposit flow
# ---------------------------------------------------------------
class TestWalletDepositFlow:
    deposit_id = None

    def test_create_deposit_pending(self, user_session):
        s = user_session["session"]
        payload = {
            "amount": 100.0,
            "method": "manual",
            "tx_reference": f"TEST_REF_{uuid.uuid4().hex[:6]}",
            "proof_url": "",
        }
        r = s.post(f"{API}/me/wallet/deposit", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert data["amount"] == 100.0
        assert data["user_id"]
        assert data["id"].startswith("DEP-")
        TestWalletDepositFlow.deposit_id = data["id"]

    def test_admin_list_pending(self, admin_headers):
        r = requests.get(f"{API}/admin/wallet/deposits?status=pending", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert any(d["id"] == TestWalletDepositFlow.deposit_id for d in rows), \
            "newly created deposit not found in pending list"

    def test_approve_credits_wallet(self, admin_headers, user_session):
        dep_id = TestWalletDepositFlow.deposit_id
        assert dep_id, "deposit_id missing from prior test"
        r = requests.post(f"{API}/admin/wallet/deposits/{dep_id}/approve",
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "balance" in data
        assert float(data["balance"]) >= 100.0

        # verify a WTX-* wallet_txn was created and ownable
        s = user_session["session"]
        txr = s.get(f"{API}/me/wallet/transactions?limit=10", timeout=15)
        assert txr.status_code == 200, txr.text
        txns = txr.json()
        credit_txns = [t for t in txns if t.get("type") == "credit" and float(t.get("amount") or 0) >= 100.0]
        assert credit_txns, f"no matching credit txn found in {txns}"
        TestWalletDepositFlow._txn_id = credit_txns[0]["id"]
        assert TestWalletDepositFlow._txn_id.startswith("WTX-"), \
            f"txn id format unexpected: {TestWalletDepositFlow._txn_id}"

    def test_second_approve_fails(self, admin_headers):
        dep_id = TestWalletDepositFlow.deposit_id
        r = requests.post(f"{API}/admin/wallet/deposits/{dep_id}/approve",
                          headers=admin_headers, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_reject_after_approve_fails(self, admin_headers):
        """Approved deposits should never be rejectable (idempotency)."""
        dep_id = TestWalletDepositFlow.deposit_id
        r = requests.post(f"{API}/admin/wallet/deposits/{dep_id}/reject?reason=test",
                          headers=admin_headers, timeout=15)
        assert r.status_code == 400, f"approved->reject must 400, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------
# Reject flow (separate deposit)
# ---------------------------------------------------------------
class TestRejectFlow:
    dep_id = None

    def test_create_then_reject(self, user_session, admin_headers):
        s = user_session["session"]
        r = s.post(f"{API}/me/wallet/deposit", json={
            "amount": 50.0, "method": "manual", "tx_reference": f"TEST_R_{uuid.uuid4().hex[:6]}",
            "proof_url": ""
        }, timeout=15)
        assert r.status_code == 200, r.text
        TestRejectFlow.dep_id = r.json()["id"]

        r2 = requests.post(f"{API}/admin/wallet/deposits/{TestRejectFlow.dep_id}/reject?reason=bad+proof",
                           headers=admin_headers, timeout=15)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data.get("ok") is True
        # confirm status persisted
        rows = requests.get(f"{API}/admin/wallet/deposits?status=rejected",
                            headers=admin_headers, timeout=15).json()
        assert any(d["id"] == TestRejectFlow.dep_id for d in rows)

    def test_second_reject_does_not_credit(self, admin_headers, user_session):
        # Either fails 400 or returns ok with no additional credit
        s = user_session["session"]
        before_bal_row = s.get(f"{API}/me/wallet", timeout=15)
        before_bal = float(before_bal_row.json().get("balance") or 0) if before_bal_row.status_code == 200 else None

        r = requests.post(f"{API}/admin/wallet/deposits/{TestRejectFlow.dep_id}/reject?reason=again",
                          headers=admin_headers, timeout=15)
        # acceptable: 400 (already rejected) OR 200 idempotent
        assert r.status_code in (200, 400), r.text

        after_bal_row = s.get(f"{API}/me/wallet", timeout=15)
        after_bal = float(after_bal_row.json().get("balance") or 0) if after_bal_row.status_code == 200 else None
        if before_bal is not None and after_bal is not None:
            assert before_bal == after_bal, "Balance must not change on a re-reject"


# ---------------------------------------------------------------
# Receipt endpoint
# ---------------------------------------------------------------
class TestReceiptEndpoint:
    def test_get_own_txn(self, user_session):
        s = user_session["session"]
        # get last credit txn id
        txns = s.get(f"{API}/me/wallet/transactions?limit=10", timeout=15).json()
        assert txns, "No txns to test against"
        txn_id = txns[0]["id"]
        r = s.get(f"{API}/me/wallet/transactions/{txn_id}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == txn_id
        assert "_id" not in data
        assert "amount" in data
        assert "type" in data

    def test_get_unknown_returns_404(self, user_session):
        s = user_session["session"]
        r = s.get(f"{API}/me/wallet/transactions/WTX-UNKNOWN-ID-XYZ", timeout=15)
        assert r.status_code == 404, f"got {r.status_code}: {r.text}"

    def test_get_unauthenticated_returns_401(self):
        # plain session without auth
        r = requests.get(f"{API}/me/wallet/transactions/WTX-ANYTHING", timeout=15)
        assert r.status_code == 401, f"got {r.status_code}: {r.text}"

    def test_other_user_cannot_access(self, user_session):
        """Other user's txn returns 404 (we don't leak existence)."""
        # Register a second user
        s2 = requests.Session()
        email2 = f"test2+{uuid.uuid4().hex[:6]}@example.com"
        s2.post(f"{API}/auth/register", json={"email": email2, "password": "hack123", "name": "Two"}, timeout=15)
        r = s2.post(f"{API}/auth/login", json={"email": email2, "password": "hack123"}, timeout=15)
        assert r.status_code == 200
        token2 = r.json().get("token") or r.json().get("access_token")
        s2.headers.update({"Authorization": f"Bearer {token2}"})

        # Get user1's txn id and try with user2
        s1 = user_session["session"]
        txns = s1.get(f"{API}/me/wallet/transactions?limit=10", timeout=15).json()
        if txns:
            txn_id = txns[0]["id"]
            r3 = s2.get(f"{API}/me/wallet/transactions/{txn_id}", timeout=15)
            assert r3.status_code == 404, f"cross-user access leaked: {r3.status_code}: {r3.text}"


# ---------------------------------------------------------------
# Regression: legacy bot save still works
# ---------------------------------------------------------------
def test_regression_legacy_bot_save(admin_headers):
    # GET current
    r = requests.get(f"{API}/admin/telegram/bot", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    orig = r.json().get("telegram_bot") or {}

    # PUT a minimal change
    payload = {"welcome_message": orig.get("welcome_message") or "Hello"}
    r = requests.put(f"{API}/admin/telegram/bot", headers=admin_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
