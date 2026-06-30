"""Iter-31 backend tests: SEC-001 (bcrypt admin auth + brute force) and SEC-002 (CORS allow-list).
Plus regressions: customer auth & daily missions anti-cheat.
"""
import os
import time
import pytest
import requests
import subprocess
import json

PUBLIC_BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
LOCAL_BASE = "http://localhost:8001"

DB = "test_database"


def _mongo_eval(js: str) -> str:
    r = subprocess.run(["mongosh", DB, "--quiet", "--eval", js], capture_output=True, text=True, timeout=15)
    return (r.stdout or "") + (r.stderr or "")


@pytest.fixture(autouse=True)
def _clear_brute_lockouts():
    # Always start clean so brute test is deterministic; cleanup after to leave env usable.
    _mongo_eval("db.admin_login_attempts.deleteMany({})")
    yield
    _mongo_eval("db.admin_login_attempts.deleteMany({})")


# ---------------- SEC-001: bcrypt at rest ----------------

class TestAdminBcrypt:
    def test_admin_doc_has_bcrypt_hash_no_plaintext(self):
        out = _mongo_eval('JSON.stringify(db.admin.findOne({_id:"creds"}, {password:1, password_hash:1}))')
        # parse last json-looking line
        line = [l for l in out.splitlines() if l.strip().startswith("{")][-1]
        doc = json.loads(line)
        assert "password" not in doc, f"plaintext password leaked: {doc}"
        assert doc.get("password_hash", "").startswith("$2b$12$"), doc

    def test_admin_login_correct_returns_token(self):
        r = requests.post(f"{PUBLIC_BASE}/api/admin/login", json={"password": "admin123"}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert isinstance(body.get("token"), str) and len(body["token"]) >= 16

    def test_admin_login_wrong_returns_401(self):
        r = requests.post(f"{PUBLIC_BASE}/api/admin/login", json={"password": "wrong-pass"}, timeout=15)
        assert r.status_code == 401, r.text
        assert "Access denied" in r.text


# ---------------- SEC-001: brute force lockout ----------------

class TestAdminBruteForce:
    def test_lockout_after_5_fails_blocks_even_correct(self):
        # 5 wrong attempts
        codes = []
        for i in range(5):
            r = requests.post(f"{PUBLIC_BASE}/api/admin/login", json={"password": f"bad{i}"}, timeout=15)
            codes.append(r.status_code)
        # First 4 should be 401; the 5th (or onward) triggers 429.
        assert codes.count(401) >= 4, codes
        # 6th attempt — must be 429
        r6 = requests.post(f"{PUBLIC_BASE}/api/admin/login", json={"password": "another-bad"}, timeout=15)
        assert r6.status_code == 429, (codes, r6.status_code, r6.text)
        assert "Too many failed admin logins" in r6.text

        # Correct password is ALSO blocked during lockout
        r_correct = requests.post(f"{PUBLIC_BASE}/api/admin/login", json={"password": "admin123"}, timeout=15)
        assert r_correct.status_code == 429, r_correct.text

        # Clear lockout → correct password works again immediately
        _mongo_eval("db.admin_login_attempts.deleteMany({})")
        r_after = requests.post(f"{PUBLIC_BASE}/api/admin/login", json={"password": "admin123"}, timeout=15)
        assert r_after.status_code == 200, r_after.text


# ---------------- SEC-001: change-password validation (NON-destructive) ----------------

class TestAdminChangePassword:
    def test_short_password_rejected_400(self):
        login = requests.post(f"{PUBLIC_BASE}/api/admin/login", json={"password": "admin123"}, timeout=15)
        assert login.status_code == 200, login.text
        tok = login.json()["token"]
        r = requests.post(
            f"{PUBLIC_BASE}/api/admin/password",
            headers={"X-Admin-Token": tok, "Content-Type": "application/json"},
            json={"new_password": "short"},
            timeout=15,
        )
        assert r.status_code == 400, r.text


# ---------------- SEC-002: CORS allow-list (direct backend) ----------------

class TestCorsAllowList:
    def test_allowed_origin_echoed(self):
        # Use OPTIONS preflight to be deterministic about CORS headers
        r = requests.options(
            f"{LOCAL_BASE}/api/config",
            headers={
                "Origin": "https://errorhacker.site",
                "Access-Control-Request-Method": "GET",
            },
            timeout=10,
        )
        h = {k.lower(): v for k, v in r.headers.items()}
        assert h.get("access-control-allow-origin") == "https://errorhacker.site", h
        assert h.get("access-control-allow-credentials", "").lower() == "true", h

    def test_disallowed_origin_blocked(self):
        r = requests.options(
            f"{LOCAL_BASE}/api/config",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "GET",
            },
            timeout=10,
        )
        h = {k.lower(): v for k, v in r.headers.items()}
        # Allow-origin must NOT be present (or not equal to the evil origin)
        assert h.get("access-control-allow-origin") in (None, ""), h


# ---------------- Regression: customer auth + cookie + /auth/me ----------------

class TestCustomerAuthRegression:
    def test_login_sets_cookie_and_me_works(self):
        s = requests.Session()
        r = s.post(
            f"{PUBLIC_BASE}/api/auth/login",
            json={"email": "test1@example.com", "password": "hack123"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # eh_session cookie should be set
        assert any(c.name == "eh_session" for c in s.cookies), [c.name for c in s.cookies]
        body = r.json()
        token = body.get("token") or body.get("access_token")

        # /auth/me via cookie
        r2 = s.get(f"{PUBLIC_BASE}/api/auth/me", timeout=15)
        assert r2.status_code == 200, r2.text
        me = r2.json()
        user = me.get("user") or me
        assert user.get("email") == "test1@example.com", me
        # Also confirm Bearer works (handy for further tests)
        if token:
            r3 = requests.get(
                f"{PUBLIC_BASE}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            assert r3.status_code == 200, r3.text


# ---------------- Regression: daily missions anti-cheat ----------------

def _customer_session():
    s = requests.Session()
    r = s.post(
        f"{PUBLIC_BASE}/api/auth/login",
        json={"email": "test1@example.com", "password": "hack123"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return s


class TestDailyMissions:
    def test_missions_list_has_flags(self):
        s = _customer_session()
        r = s.get(f"{PUBLIC_BASE}/api/me/missions", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Accept either { missions: [...] } or a bare list
        missions = data.get("items") or data.get("missions") if isinstance(data, dict) else data
        assert isinstance(missions, list) and len(missions) > 0, data
        keys = set()
        for m in missions:
            keys.update(m.keys())
        # require completed + ready_to_claim flags per mission
        assert "completed" in keys, missions[0]
        assert "ready_to_claim" in keys, missions[0]

    def test_refer_friend_claim_rejected_no_referrals(self):
        s = _customer_session()
        r = s.post(
            f"{PUBLIC_BASE}/api/me/missions/claim",
            json={"mission_id": "refer_friend"},
            timeout=15,
        )
        # user has zero referrals → must NOT be allowed to claim
        assert r.status_code == 400, (r.status_code, r.text)
