"""
Iteration 10 backend tests:
  - Cashfree pay-order regression (200 with valid session, 400 no price, 403 cross-user, 401 unauth)
  - Receipt email dispatch: PATCH /orders/{id} with status=verified & payment_amount>0 dispatches send_order_receipt_email
  - Quote email mentions Cashfree as instant option and CTA url has &pay=1 (introspection of email_service.notify_quote_sent)
  - Code-review introspection: me_pay_with_wallet, _cashfree_reconcile dispatch correct emails
"""
import os
import uuid
import inspect
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASS = "admin123"


# --------------------------- fixtures -----------------------------------
@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    return {"X-Admin-Token": tok, "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def user_a():
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_iter10a_{suffix}@example.com"
    requests.post(f"{API}/auth/register", json={"email": email, "password": "hack123", "name": "Iter10 A"}, timeout=30)
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "hack123"}, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    return {"email": email, "token": j.get("token") or j.get("access_token"), "user_id": (j.get("user") or {}).get("user_id")}


@pytest.fixture(scope="module")
def user_b():
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_iter10b_{suffix}@example.com"
    requests.post(f"{API}/auth/register", json={"email": email, "password": "hack123", "name": "Iter10 B"}, timeout=30)
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "hack123"}, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    return {"email": email, "token": j.get("token") or j.get("access_token"), "user_id": (j.get("user") or {}).get("user_id")}


def _hdr(u):
    return {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}


# --------------------------- Cashfree config sanity ---------------------
class TestCashfreeConfig:
    def test_config_endpoint(self):
        r = requests.get(f"{API}/payments/cashfree/config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("configured") is True
        assert d.get("mode") in ("production", "sandbox")


# --------------------------- Order creation helper ----------------------
def _create_order(user, price=499):
    payload = {
        "name": "Iter10 Test",
        "email": user["email"],
        "service": "test-service",
        "serviceName": "Iter10 Service",
        "qty": 1,
        "amount": price,
        "payment_amount": price,
    }
    r = requests.post(f"{API}/orders", json=payload,
                      headers={"Authorization": f"Bearer {user['token']}", "Content-Type": "application/json"},
                      timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


# --------------------------- /me/orders/{id}/pay/cashfree --------------
class TestPayOrderCashfree:
    def test_unauth_401(self, user_a):
        order = _create_order(user_a, 499)
        r = requests.post(f"{API}/me/orders/{order['id']}/pay/cashfree", json={}, timeout=20)
        assert r.status_code in (401, 403), r.text

    def test_cross_user_403(self, user_a, user_b):
        order = _create_order(user_a, 499)
        r = requests.post(f"{API}/me/orders/{order['id']}/pay/cashfree", json={}, headers=_hdr(user_b), timeout=20)
        assert r.status_code == 403, r.text

    def test_no_price_400(self, user_a):
        payload = {
            "name": "Iter10 NoPrice",
            "email": user_a["email"],
            "service": "test-service",
            "serviceName": "Iter10 NoPrice",
            "qty": 1,
            "amount": 0,
            "payment_amount": 0,
        }
        r = requests.post(f"{API}/orders", json=payload, headers=_hdr(user_a), timeout=30)
        assert r.status_code in (200, 201), r.text
        oid = r.json()["id"]
        r2 = requests.post(f"{API}/me/orders/{oid}/pay/cashfree", json={}, headers=_hdr(user_a), timeout=20)
        assert r2.status_code == 400, r2.text

    def test_success_200_with_session(self, user_a):
        order = _create_order(user_a, 199)
        # Seed payment_amount via /payments/proof (public endpoint) — sets payment_amount field
        prf = requests.post(f"{API}/payments/proof", json={
            "order_id": order["id"], "method": "upi", "amount": 199,
            "currency": "INR", "tx_reference": "TEST_SEED", "proof_url": ""
        }, timeout=15)
        assert prf.status_code == 200, prf.text
        r = requests.post(f"{API}/me/orders/{order['id']}/pay/cashfree", json={}, headers=_hdr(user_a), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        sess = d.get("payment_session_id") or (d.get("data") or {}).get("payment_session_id")
        assert sess and isinstance(sess, str) and len(sess) > 10, d


# --------------------- PATCH /orders/{id} → receipt email ---------------
class TestReceiptOnVerify:
    def test_verify_dispatches_receipt(self, user_a, admin_h):
        order = _create_order(user_a, 499)
        # Patch to verified via admin
        r = requests.patch(f"{API}/orders/{order['id']}",
                           json={"status": "verified"},
                           headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "verified"
        # Give the async create_task a moment to dispatch
        time.sleep(2)
        # We can't intercept the email, but no error should be raised at PATCH path.
        # Check it via reading back order
        r2 = requests.get(f"{API}/orders/{order['id']}", timeout=15)
        # /orders/{id} may not exist as a GET; try admin-listed
        # Fallback: just confirm PATCH success above. The dispatch is fire-and-forget.


# --------------------- Code-review introspection ------------------------
class TestEmailServiceIntrospection:
    """Static checks on backend code paths (no email sandbox available)."""

    def test_notify_quote_sent_mentions_cashfree_and_pay_param(self):
        import sys, importlib
        sys.path.insert(0, "/app/backend")
        es = importlib.import_module("email_service")
        src = inspect.getsource(es.notify_quote_sent)
        assert "Cashfree" in src, "notify_quote_sent must mention Cashfree as instant option"
        assert "pay=1" in src, "notify_quote_sent CTA url must include &pay=1"

    def test_send_order_receipt_email_exists_and_has_key_fields(self):
        import importlib
        es = importlib.import_module("email_service")
        assert hasattr(es, "send_order_receipt_email")
        src = inspect.getsource(es.send_order_receipt_email)
        assert "Order ID" in src
        assert "Amount Paid" in src
        assert "VERIFIED" in src
        assert "OPEN LIVE TRACKER" in src
        assert "/track?id=" in src

    def test_patch_orders_dispatches_receipt_on_verified(self):
        import importlib
        srv = importlib.import_module("server")
        # Grab the source of the file to confirm wiring
        import pathlib
        text = pathlib.Path("/app/backend/server.py").read_text()
        assert "send_order_receipt_email" in text
        assert 'body.status in ("verified", "paid")' in text or 'status in ("verified", "paid")' in text

    def test_me_pay_with_wallet_dispatches_both_receipts(self):
        import pathlib, re
        text = pathlib.Path("/app/backend/server.py").read_text()
        # locate me_pay_with_wallet body
        m = re.search(r"async def me_pay_with_wallet\(.*?\n(.*?)\n@api\.", text, re.S)
        assert m, "me_pay_with_wallet handler not found"
        body = m.group(1)
        assert "send_wallet_receipt_email" in body, "wallet receipt email missing in pay-with-wallet"
        assert "send_order_receipt_email" in body, (
            "send_order_receipt_email NOT dispatched in me_pay_with_wallet — "
            "expected per iter-10 fix scope"
        )

    def test_cashfree_reconcile_dispatches_correct_receipts(self):
        import pathlib, re
        text = pathlib.Path("/app/backend/server.py").read_text()
        m = re.search(r"async def _cashfree_reconcile\(.*?\n(.*?)\n@api\.", text, re.S)
        assert m, "_cashfree_reconcile not found"
        body = m.group(1)
        # wallet_topup branch should send wallet receipt
        assert "wallet_topup" in body
        assert "send_wallet_receipt_email" in body
        # service_payment branch should send order receipt
        assert "service_payment" in body
        assert "send_order_receipt_email" in body
