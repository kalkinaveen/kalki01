"""
Iteration 8 backend tests:
  • pay-with-wallet endpoint
  • full refund lifecycle (user + admin)
  • public refund tracker (non-PII)
  • spin wheel prize ladder + weight-respecting RNG
  • TG /refund webhook reachability
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASS = "admin123"


# --------------------------- fixtures ------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"X-Admin-Token": admin_token, "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def user_bearer():
    """Register-or-login a fresh customer for this test run."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_iter8_{suffix}@example.com"
    pw = "hack123"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": f"Iter8 {suffix}"}, timeout=30)
    if r.status_code not in (200, 201, 400, 409):
        pytest.skip(f"register failed: {r.status_code} {r.text}")
    r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r2.status_code == 200, r2.text
    data = r2.json()
    return {"email": email, "token": data.get("token") or data.get("access_token"), "user_id": data.get("user", {}).get("user_id")}


@pytest.fixture(scope="module")
def auth_h(user_bearer):
    return {"Authorization": f"Bearer {user_bearer['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def credited_wallet(user_bearer, admin_h):
    """Top up the test user wallet via admin adjust."""
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_bearer['token']}"}, timeout=30)
    assert me.status_code == 200, me.text
    mj = me.json()
    uid = (mj.get("user") or {}).get("user_id") or mj.get("user_id") or user_bearer.get("user_id")
    r = requests.post(f"{API}/admin/wallet/{uid}/adjust",
                      json={"type": "credit", "amount": 500, "note": "test credit"},
                      headers=admin_h, timeout=30)
    assert r.status_code == 200, r.text
    return uid


# --------------------------- helpers -------------------------------------
def _new_order(auth_h, name="Iter8 Service", amount=100):
    payload = {"service": "test-service-iter8", "serviceName": name,
               "name": "Test User", "email": "TEST_iter8@example.com",
               "notes": "TEST"}
    r = requests.post(f"{API}/orders", json=payload, headers=auth_h, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# =========================================================================
# 1. SPIN CONFIG
# =========================================================================
class TestSpin:
    def test_public_config_no_weights(self):
        r = requests.get(f"{API}/spin/config", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "prizes" in body and isinstance(body["prizes"], list) and len(body["prizes"]) > 0
        for p in body["prizes"]:
            assert "weight" not in p, "public endpoint must NOT leak weights"
            assert "id" in p and "label" in p

    def test_admin_update_prize_ladder_and_forced_winner(self, admin_h, auth_h):
        # Snapshot original ladder
        orig = requests.get(f"{API}/spin/config", timeout=30).json()

        # Force one winner deterministically: single prize w weight 100
        forced = [{"id": "px", "label": "TEST_FORCED", "type": "credit",
                   "amount": 7, "weight": 100, "color": "#ff00ff"}]
        r = requests.put(f"{API}/admin/spin/config",
                         json={"enabled": True, "cooldown_hours": 1, "prizes": forced},
                         headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["spin_wheel"]["prizes"][0]["label"] == "TEST_FORCED"

        # Spin once - should always land on the only prize
        sr = requests.post(f"{API}/me/spin/spin", json={}, headers=auth_h, timeout=30)
        # NOTE: cooldown_hours may apply across runs; tolerate 429 here
        if sr.status_code == 429:
            pytest.skip("spin under cooldown for this user — skipping forced-winner check")
        assert sr.status_code == 200, sr.text
        prize = sr.json().get("prize") or {}
        assert prize.get("label") == "TEST_FORCED", f"weight=100 should always win, got {prize}"

        # restore
        requests.put(f"{API}/admin/spin/config",
                     json={"enabled": True, "cooldown_hours": orig.get("cooldown_hours", 24),
                           "prizes": orig.get("prizes")},
                     headers=admin_h, timeout=30)

    def test_admin_requires_token(self):
        r = requests.put(f"{API}/admin/spin/config", json={"prizes": []}, timeout=30)
        assert r.status_code in (401, 403)


# =========================================================================
# 2. PAY-WITH-WALLET
# =========================================================================
class TestPayWithWallet:
    def test_full_flow(self, auth_h, admin_h, credited_wallet):
        order = _new_order(auth_h, amount=50)
        oid = order["id"]
        # Set order price via public payment-proof endpoint (sets payment_amount + status='payment_review')
        proof = requests.post(f"{API}/payments/proof",
                              json={"order_id": oid, "method": "manual", "amount": 50, "currency": "INR"},
                              timeout=30)
        assert proof.status_code == 200, proof.text
        balance_before = float(requests.get(f"{API}/me/wallet", headers=auth_h, timeout=30).json().get("balance") or 0)
        pay = requests.post(f"{API}/me/orders/{oid}/pay-with-wallet", json={}, headers=auth_h, timeout=30)
        assert pay.status_code == 200, pay.text
        body = pay.json()
        assert body.get("ok") is True
        assert body.get("txn_id", "").startswith("WTX-")
        assert abs(float(body.get("balance_after")) - (balance_before - 50)) < 0.01
        # GET order back
        og = requests.get(f"{API}/orders/{oid}", timeout=30).json()
        assert og.get("status") == "verified"
        assert og.get("payment_method") == "wallet"
        # wallet debited
        bal_after = float(requests.get(f"{API}/me/wallet", headers=auth_h, timeout=30).json().get("balance") or 0)
        assert bal_after < balance_before
        # Double-pay must 400
        pay2 = requests.post(f"{API}/me/orders/{oid}/pay-with-wallet", json={}, headers=auth_h, timeout=30)
        assert pay2.status_code == 400, pay2.text

    def test_unauthenticated_401(self):
        r = requests.post(f"{API}/me/orders/ORD-FAKE/pay-with-wallet", json={}, timeout=30)
        assert r.status_code == 401

    def test_unknown_order_404(self, auth_h):
        r = requests.post(f"{API}/me/orders/ORD-DOESNOTEXIST/pay-with-wallet", json={}, headers=auth_h, timeout=30)
        assert r.status_code == 404

    def test_cross_user_403(self, auth_h, admin_h):
        # Create another user, make their order, try to pay from auth_h
        suffix = uuid.uuid4().hex[:6]
        em = f"TEST_iter8_other_{suffix}@example.com"
        requests.post(f"{API}/auth/register", json={"email": em, "password": "hack123", "name": "Other"}, timeout=30)
        tok = requests.post(f"{API}/auth/login", json={"email": em, "password": "hack123"}, timeout=30).json().get("token")
        other_h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        order = _new_order(other_h)
        r = requests.post(f"{API}/me/orders/{order['id']}/pay-with-wallet", json={}, headers=auth_h, timeout=30)
        assert r.status_code == 403, r.text


# =========================================================================
# 3. REFUND CREATE + LIST + PUBLIC TRACK
# =========================================================================
class TestRefundUser:
    refund_id = None
    order_id = None

    def test_create_refund(self, auth_h):
        order = _new_order(auth_h)
        TestRefundUser.order_id = order["id"]
        body = {"order_id": order["id"], "reason": "Service did not arrive on time at all"}
        r = requests.post(f"{API}/me/refunds", json=body, headers=auth_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("id", "").startswith("RFD-")
        assert data.get("status") == "requested"
        assert isinstance(data.get("timeline"), list) and len(data["timeline"]) == 1
        TestRefundUser.refund_id = data["id"]

    def test_create_refund_dup_blocked(self, auth_h):
        body = {"order_id": TestRefundUser.order_id, "reason": "Service did not arrive on time at all"}
        r = requests.post(f"{API}/me/refunds", json=body, headers=auth_h, timeout=30)
        assert r.status_code == 400
        assert "in progress" in r.text.lower() or "already" in r.text.lower()

    def test_short_reason_422(self, auth_h):
        order = _new_order(auth_h)
        body = {"order_id": order["id"], "reason": "bad"}
        r = requests.post(f"{API}/me/refunds", json=body, headers=auth_h, timeout=30)
        assert r.status_code == 422

    def test_list_mine(self, auth_h):
        r = requests.get(f"{API}/me/refunds", headers=auth_h, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert any(x.get("id") == TestRefundUser.refund_id for x in rows)

    def test_get_one_mine(self, auth_h):
        r = requests.get(f"{API}/me/refunds/{TestRefundUser.refund_id}", headers=auth_h, timeout=30)
        assert r.status_code == 200
        assert r.json()["id"] == TestRefundUser.refund_id

    def test_get_one_wrong_id(self, auth_h):
        r = requests.get(f"{API}/me/refunds/RFD-DOESNOTEXIST", headers=auth_h, timeout=30)
        assert r.status_code == 404

    def test_cross_user_refund_get_404(self):
        suffix = uuid.uuid4().hex[:6]
        em = f"TEST_iter8_xuser_{suffix}@example.com"
        requests.post(f"{API}/auth/register", json={"email": em, "password": "hack123", "name": "X"}, timeout=30)
        tok = requests.post(f"{API}/auth/login", json={"email": em, "password": "hack123"}, timeout=30).json().get("token")
        h = {"Authorization": f"Bearer {tok}"}
        r = requests.get(f"{API}/me/refunds/{TestRefundUser.refund_id}", headers=h, timeout=30)
        assert r.status_code == 404

    def test_public_track_no_pii(self):
        r = requests.get(f"{API}/refunds/track/{TestRefundUser.refund_id}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == TestRefundUser.refund_id
        assert "user_id" not in data and "user_email" not in data, "Public track must not leak PII"
        assert "timeline" in data

    def test_public_track_unknown(self):
        r = requests.get(f"{API}/refunds/track/RFD-NOPE", timeout=30)
        assert r.status_code == 404


# =========================================================================
# 4. ADMIN REFUND FLOW
# =========================================================================
class TestRefundAdmin:
    refund_id = None
    user_id = None
    order_id = None

    def test_setup_request(self, auth_h, user_bearer):
        order = _new_order(auth_h)
        TestRefundAdmin.order_id = order["id"]
        # determine user_id
        mj = requests.get(f"{API}/auth/me", headers=auth_h, timeout=30).json()
        TestRefundAdmin.user_id = (mj.get("user") or {}).get("user_id") or mj.get("user_id")
        body = {"order_id": order["id"], "reason": "Wrong service delivered totally"}
        r = requests.post(f"{API}/me/refunds", json=body, headers=auth_h, timeout=30)
        assert r.status_code == 200, r.text
        TestRefundAdmin.refund_id = r.json()["id"]

    def test_admin_list_and_filter(self, admin_h):
        r = requests.get(f"{API}/admin/refunds", headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert any(x["id"] == TestRefundAdmin.refund_id for x in r.json())
        rf = requests.get(f"{API}/admin/refunds?status=requested", headers=admin_h, timeout=30)
        assert rf.status_code == 200
        ids = [x["id"] for x in rf.json()]
        assert TestRefundAdmin.refund_id in ids

    def test_admin_approve_credits_wallet(self, admin_h, auth_h):
        bal_before = float(requests.get(f"{API}/me/wallet", headers=auth_h, timeout=30).json().get("balance") or 0)
        body = {"status": "approved", "refund_amount": 100, "refund_method": "wallet"}
        r = requests.patch(f"{API}/admin/refunds/{TestRefundAdmin.refund_id}", json=body, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        upd = r.json()
        assert upd["status"] == "completed"
        assert len(upd["timeline"]) >= 3  # initial requested + approved + completed
        statuses = [t["status"] for t in upd["timeline"]]
        assert "approved" in statuses and "completed" in statuses
        # verify wallet credited
        bal_after = float(requests.get(f"{API}/me/wallet", headers=auth_h, timeout=30).json().get("balance") or 0)
        assert bal_after >= bal_before + 100 - 0.01, f"wallet expected +100, got {bal_before}->{bal_after}"
        # verify WTX row exists with refund type
        txns = requests.get(f"{API}/me/wallet/transactions", headers=auth_h, timeout=30).json()
        refund_txn = [t for t in txns if t.get("type") == "refund" and float(t.get("amount") or 0) == 100]
        assert refund_txn, "Expected at least one WTX-* refund row of ₹100"

    def test_admin_reject_flow(self, admin_h, auth_h):
        order = _new_order(auth_h)
        rr = requests.post(f"{API}/me/refunds",
                           json={"order_id": order["id"], "reason": "Will be rejected here"},
                           headers=auth_h, timeout=30)
        assert rr.status_code == 200
        rid = rr.json()["id"]
        bal_before = float(requests.get(f"{API}/me/wallet", headers=auth_h, timeout=30).json().get("balance") or 0)
        body = {"status": "rejected", "admin_note": "Not eligible"}
        r = requests.patch(f"{API}/admin/refunds/{rid}", json=body, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "rejected"
        assert r.json()["admin_note"] == "Not eligible"
        bal_after = float(requests.get(f"{API}/me/wallet", headers=auth_h, timeout=30).json().get("balance") or 0)
        assert abs(bal_after - bal_before) < 0.01, "Reject must NOT credit wallet"


# =========================================================================
# 5. TG /refund webhook reachability
# =========================================================================
class TestTGRefund:
    def test_webhook_doesnt_500(self, admin_h):
        # find webhook_secret via admin endpoint
        r = requests.get(f"{API}/admin/telegram/bot", headers=admin_h, timeout=30)
        assert r.status_code == 200
        cfg = r.json()
        secret = cfg.get("webhook_secret") or ""
        if not secret:
            # try registering
            reg = requests.post(f"{API}/admin/telegram/webhook/register", headers=admin_h, timeout=30)
            if reg.status_code == 200:
                secret = reg.json().get("webhook_secret") or ""
        if not secret:
            pytest.skip("No webhook secret available")
        url = f"{API}/telegram/webhook/{secret}"
        payload = {"message": {"chat": {"id": 999999}, "text": "/refund RFD-XXX"}}
        r = requests.post(url, json=payload, timeout=30)
        # Telegram webhook usually returns 200 even on failure inside
        assert r.status_code < 500, f"webhook crashed: {r.status_code} {r.text}"


# =========================================================================
# 6. REGRESSION
# =========================================================================
class TestRegression:
    def test_admin_tg_bot_ok(self, admin_h):
        r = requests.get(f"{API}/admin/telegram/bot", headers=admin_h, timeout=30)
        assert r.status_code == 200

    def test_me_wallet_ok(self, auth_h):
        r = requests.get(f"{API}/me/wallet", headers=auth_h, timeout=30)
        assert r.status_code == 200
        assert "balance" in r.json()

    def test_orders_get_ok(self, auth_h):
        order = _new_order(auth_h)
        r = requests.get(f"{API}/orders/{order['id']}", timeout=30)
        assert r.status_code == 200
        assert r.json()["id"] == order["id"]
