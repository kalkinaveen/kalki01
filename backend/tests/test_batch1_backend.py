"""
Batch 1 backend tests for ERRORHACKER:
- Customer auth (register/login/me/logout)
- Google session (invalid)
- Coupons CRUD + apply
- AI chat (Claude Haiku via Emergent LLM key)
- Image uploads (multipart -> base64)
- Telegram test endpoint (no creds -> 400)
- Orders with/without user auth and /me/orders
- Existing endpoints: /api/config, /api/orders/{id}, /api/orders (admin)
"""
import os
import io
import time
import uuid
import pytest
import requests

def _load_backend_url():
    if "REACT_APP_BACKEND_URL" in os.environ:
        return os.environ["REACT_APP_BACKEND_URL"]
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"')
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE = _load_backend_url().rstrip("/")
API = f"{BASE}/api"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"X-Admin-Token": admin_token}


@pytest.fixture(scope="session")
def test_user(s):
    ts = int(time.time())
    email = f"qa+{ts}@example.com"
    password = "qa12345"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "QA Tester"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return {"email": email, "password": password, "token": data["token"], "user": data["user"]}


# ---------- Existing config ----------
def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "online"


def test_get_config():
    r = requests.get(f"{API}/config")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)
    # config should have at least one expected key
    assert "_id" not in body


# ---------- Auth ----------
class TestAuth:
    def test_register_returns_user_and_sets_cookie(self):
        ts = int(time.time() * 1000)
        email = f"qa+reg{ts}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "qa12345", "name": "Reg"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == email
        assert "password_hash" not in data["user"]
        assert data["user"]["provider"] == "password"
        assert data["user"]["referral_code"].startswith("EH")
        assert data.get("token")
        # cookie
        assert "eh_session" in r.cookies.get_dict()

    def test_register_duplicate_returns_409(self, test_user):
        r = requests.post(f"{API}/auth/register", json={"email": test_user["email"], "password": "qa12345"})
        assert r.status_code == 409

    def test_login_success(self, test_user):
        r = requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == test_user["email"]
        assert data.get("token")
        assert "eh_session" in r.cookies.get_dict()

    def test_login_wrong_password_401(self, test_user):
        r = requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": "wrong-pass"})
        assert r.status_code == 401

    def test_me_with_bearer(self, test_user):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == test_user["email"]

    def test_me_with_cookie(self, test_user):
        sess = requests.Session()
        lr = sess.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]})
        assert lr.status_code == 200
        r = sess.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["user"]["email"] == test_user["email"]

    def test_me_unauthenticated_returns_null(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json() == {"user": None}

    def test_logout_clears_cookie(self, test_user):
        sess = requests.Session()
        sess.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]})
        r = sess.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # cookie should be cleared/expired - subsequent /auth/me returns null
        me = sess.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json() == {"user": None}

    def test_google_session_invalid_returns_401(self):
        r = requests.post(f"{API}/auth/google/session", json={"session_id": "definitely-not-valid-xyz"})
        assert r.status_code == 401


# ---------- Coupons ----------
class TestCoupons:
    def _cleanup(self, admin_headers, code):
        requests.delete(f"{API}/coupons/{code}", headers=admin_headers)

    def test_create_hack20_percent(self, admin_headers):
        self._cleanup(admin_headers, "HACK20")
        r = requests.post(f"{API}/coupons", headers=admin_headers, json={
            "code": "HACK20", "type": "percent", "value": 20, "max_uses": -1, "active": True
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["code"] == "HACK20"
        assert data["type"] == "percent"
        assert data["value"] == 20

    def test_create_hack50_flat(self, admin_headers):
        self._cleanup(admin_headers, "HACK50")
        r = requests.post(f"{API}/coupons", headers=admin_headers, json={
            "code": "HACK50", "type": "flat", "value": 50, "max_uses": -1, "active": True
        })
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == "HACK50"
        assert data["type"] == "flat"

    def test_list_coupons(self, admin_headers):
        r = requests.get(f"{API}/coupons", headers=admin_headers)
        assert r.status_code == 200
        codes = {c["code"] for c in r.json()}
        assert {"HACK20", "HACK50"}.issubset(codes)

    def test_apply_hack20_percent(self):
        r = requests.post(f"{API}/coupons/apply", json={"code": "HACK20", "amount": 100})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["discount"] == 20
        assert data["total"] == 80
        assert data["valid"] is True

    def test_apply_hack50_flat(self):
        r = requests.post(f"{API}/coupons/apply", json={"code": "HACK50", "amount": 100})
        assert r.status_code == 200
        data = r.json()
        assert data["discount"] == 50
        assert data["total"] == 50

    def test_apply_invalid_returns_404(self):
        r = requests.post(f"{API}/coupons/apply", json={"code": "NOPE-NOTREAL", "amount": 100})
        assert r.status_code == 404

    def test_patch_toggle_active(self, admin_headers):
        r = requests.patch(f"{API}/coupons/HACK20", headers=admin_headers, json={"active": False})
        assert r.status_code == 200
        assert r.json()["active"] is False
        # now apply should fail
        r2 = requests.post(f"{API}/coupons/apply", json={"code": "HACK20", "amount": 100})
        assert r2.status_code == 404
        # re-enable
        requests.patch(f"{API}/coupons/HACK20", headers=admin_headers, json={"active": True})

    def test_delete_coupon(self, admin_headers):
        # create a throwaway coupon then delete
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        requests.post(f"{API}/coupons", headers=admin_headers, json={
            "code": code, "type": "flat", "value": 5, "active": True
        })
        r = requests.delete(f"{API}/coupons/{code}", headers=admin_headers)
        assert r.status_code == 200
        # ensure gone
        r2 = requests.post(f"{API}/coupons/apply", json={"code": code, "amount": 50})
        assert r2.status_code == 404


# ---------- Chat ----------
class TestChat:
    def test_single_chat_message(self):
        sid = f"qa-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/chat/message", json={"session_id": sid, "message": "how long does delivery take?"}, timeout=60)
        assert r.status_code == 200, r.text
        reply = r.json().get("reply", "")
        assert isinstance(reply, str)
        assert len(reply.strip()) > 0

    def test_multi_turn_chat(self):
        sid = f"qa-{uuid.uuid4().hex[:8]}"
        r1 = requests.post(f"{API}/chat/message", json={"session_id": sid, "message": "do you offer refunds?"}, timeout=60)
        assert r1.status_code == 200
        time.sleep(1)
        r2 = requests.post(f"{API}/chat/message", json={"session_id": sid, "message": "what about for instagram growth?"}, timeout=60)
        assert r2.status_code == 200
        reply = r2.json().get("reply", "")
        assert len(reply.strip()) > 0


# ---------- Uploads ----------
class TestUploads:
    PNG_BYTES = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa3\x35\x81\x84"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    def test_upload_get_delete(self, admin_headers):
        files = {"file": ("test.png", io.BytesIO(self.PNG_BYTES), "image/png")}
        r = requests.post(f"{API}/uploads", headers=admin_headers, files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        uid = body["id"]
        assert body["url"] == f"/api/uploads/{uid}"
        # fetch
        rg = requests.get(f"{API}/uploads/{uid}")
        assert rg.status_code == 200
        assert rg.headers.get("content-type", "").startswith("image/")
        assert rg.content == self.PNG_BYTES
        # delete
        rd = requests.delete(f"{API}/uploads/{uid}", headers=admin_headers)
        assert rd.status_code == 200
        # gone
        rg2 = requests.get(f"{API}/uploads/{uid}")
        assert rg2.status_code == 404

    def test_upload_requires_admin(self):
        files = {"file": ("test.png", io.BytesIO(self.PNG_BYTES), "image/png")}
        r = requests.post(f"{API}/uploads", files=files)
        assert r.status_code == 401

    def test_upload_rejects_non_image(self, admin_headers):
        files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(f"{API}/uploads", headers=admin_headers, files=files)
        assert r.status_code == 400


# ---------- Telegram ----------
class TestTelegram:
    def test_telegram_no_creds_returns_400(self, admin_headers):
        # clear cfg telegram first to be safe
        requests.patch(f"{API}/config", headers=admin_headers, json={"notifications": {"telegram": {"enabled": False, "bot_token": "", "chat_id": ""}}})
        r = requests.post(f"{API}/admin/telegram/test", headers=admin_headers, json={"bot_token": "", "chat_id": "", "message": "test"})
        assert r.status_code == 400

    def test_telegram_requires_admin(self):
        r = requests.post(f"{API}/admin/telegram/test", json={"bot_token": "", "chat_id": ""})
        assert r.status_code == 401


# ---------- Orders + auth integration ----------
class TestOrders:
    def test_order_without_auth_has_no_user_id(self):
        r = requests.post(f"{API}/orders", json={
            "serviceName": "OSINT", "name": "Anon", "email": "anon@example.com",
            "tg": "", "size": "small", "target": "x", "notes": "n"
        })
        assert r.status_code == 200, r.text
        order = r.json()
        assert "id" in order
        assert order.get("user_id") is None or "user_id" not in order

    def test_order_with_bearer_attaches_user_id(self, test_user):
        r = requests.post(f"{API}/orders",
                          headers={"Authorization": f"Bearer {test_user['token']}"},
                          json={"serviceName": "OSINT", "name": test_user["user"]["name"], "email": test_user["email"]})
        assert r.status_code == 200, r.text
        order = r.json()
        assert order.get("user_id") == test_user["user"]["user_id"]
        assert order.get("userEmail") == test_user["email"]
        # Confirm GET orders/{id} works too (existing endpoint)
        oid = order["id"]
        rg = requests.get(f"{API}/orders/{oid}")
        assert rg.status_code == 200
        assert rg.json()["id"] == oid

    def test_me_orders_requires_auth(self):
        r = requests.get(f"{API}/me/orders")
        assert r.status_code == 401

    def test_me_orders_returns_only_user_orders(self, test_user):
        # Ensure at least one order exists for this user
        requests.post(f"{API}/orders",
                      headers={"Authorization": f"Bearer {test_user['token']}"},
                      json={"serviceName": "OSINT", "name": "u", "email": test_user["email"]})
        r = requests.get(f"{API}/me/orders", headers={"Authorization": f"Bearer {test_user['token']}"})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 1
        for row in rows:
            assert row.get("user_id") == test_user["user"]["user_id"]

    def test_admin_orders_list(self, admin_headers):
        r = requests.get(f"{API}/orders", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
