"""
Iter-27 OPERATIVE PASS — Backend tests
Covers: subscription tiers, /me/subscription, /me/subscribe, /me/dashboard,
streak check-in, missions list/claim, /me/subscription/cancel.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PW = "admin123"


# ------------- Fixtures ----------------------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PW}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def fresh_user():
    """Register a fresh user, top up wallet via admin, return session+meta."""
    email = f"TEST_iter27_{int(time.time())}_{uuid.uuid4().hex[:6]}@example.com"
    pw = "Test1234!"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Iter27 Tester"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    user_id = data["user"]["user_id"]
    # Admin top up the wallet 3000
    ar = requests.post(f"{API}/admin/login", json={"password": ADMIN_PW}, timeout=30)
    atok = ar.json()["token"]
    tr = requests.post(
        f"{API}/admin/wallet/{user_id}/adjust",
        json={"amount": 3000, "type": "credit", "note": "iter27 test seed"},
        headers={"X-Admin-Token": atok},
        timeout=30,
    )
    assert tr.status_code == 200, tr.text
    return {"session": s, "email": email, "password": pw, "user_id": user_id}


# ------------- Tier definitions endpoint -----------------------------------
class TestTiers:
    def test_list_tiers_public(self):
        r = requests.get(f"{API}/subscription/tiers", timeout=30)
        assert r.status_code == 200
        tiers = r.json()["tiers"]
        assert isinstance(tiers, list) and len(tiers) == 4
        ids = [t["id"] for t in tiers]
        assert ids == ["rookie", "operative", "shadow", "ghost"]
        prices = {t["id"]: t["price_inr"] for t in tiers}
        assert prices == {"rookie": 0, "operative": 299, "shadow": 799, "ghost": 1999}
        for t in tiers:
            for k in ("id", "rank", "name", "tagline", "color", "icon", "tool_uses_per_day", "recovery_sla_hours", "smm_discount_pct", "perks"):
                assert k in t, f"missing {k} in tier {t['id']}"
            assert isinstance(t["perks"], list) and len(t["perks"]) > 0
        # quotas
        quotas = {t["id"]: t["tool_uses_per_day"] for t in tiers}
        assert quotas["operative"] == 8 and quotas["shadow"] == 20 and quotas["ghost"] == 999


# ------------- /me/subscription + subscribe flow ---------------------------
class TestSubscriptionFlow:
    def test_default_tier_rookie(self, fresh_user):
        s = fresh_user["session"]
        r = s.get(f"{API}/me/subscription", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["tier"]["id"] == "rookie"
        assert body["wallet_balance"] >= 3000

    def test_subscribe_rookie_rejected(self, fresh_user):
        s = fresh_user["session"]
        r = s.post(f"{API}/me/subscribe", json={"tier_id": "rookie"}, timeout=30)
        assert r.status_code == 400
        assert "rookie" in r.text.lower() or "default" in r.text.lower()

    def test_subscribe_unknown_tier(self, fresh_user):
        s = fresh_user["session"]
        # Unknown tier resolves to rookie via get_tier -> should hit rookie-reject
        r = s.post(f"{API}/me/subscribe", json={"tier_id": "ultra-mega"}, timeout=30)
        # Either 400 (default fallback) or 404. Accept any 4xx.
        assert 400 <= r.status_code < 500, r.text

    def test_subscribe_operative_success(self, fresh_user):
        s = fresh_user["session"]
        # ensure starting balance
        bal0 = s.get(f"{API}/me/subscription", timeout=30).json()["wallet_balance"]
        r = s.post(f"{API}/me/subscribe", json={"tier_id": "operative"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["tier"]["id"] == "operative"
        assert body["subscription"]["active"] is True
        assert body["subscription"]["expires_at"]
        assert body["wallet_txn"]["type"] == "debit"
        # Wallet debited
        bal1 = s.get(f"{API}/me/subscription", timeout=30).json()["wallet_balance"]
        assert bal1 == bal0 - 299

    def test_dashboard_quota_after_subscribe(self, fresh_user):
        s = fresh_user["session"]
        r = s.get(f"{API}/me/dashboard", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tier"]["id"] == "operative"
        assert d["stats"]["tool_uses_quota"] == 8
        # Expected keys exist
        for k in ("user", "wallet", "tier", "subscription", "stats", "recent_orders", "library", "streak"):
            assert k in d
        stats = d["stats"]
        for k in ("total_orders", "status_counts", "active_orders", "recovery_cases", "tool_uses_today", "tool_uses_quota"):
            assert k in stats
        assert isinstance(d["recent_orders"], list)
        assert len(d["recent_orders"]) <= 10

    def test_subscribe_insufficient_balance(self, admin_token):
        """Register a brand-new user with empty wallet, attempt to subscribe."""
        email = f"TEST_iter27_poor_{int(time.time())}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!", "name": "Poor Op"}, timeout=30)
        assert r.status_code == 200
        token = r.json().get("token") or r.json().get("access_token")
        if token:
            s.headers.update({"Authorization": f"Bearer {token}"})
        r = s.post(f"{API}/me/subscribe", json={"tier_id": "operative"}, timeout=30)
        assert r.status_code == 400
        assert "insufficient" in r.text.lower() or "balance" in r.text.lower()

    def test_subscription_cancel(self, fresh_user):
        s = fresh_user["session"]
        r = s.post(f"{API}/me/subscription/cancel", timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        sub = s.get(f"{API}/me/subscription", timeout=30).json()["subscription"]
        assert sub.get("auto_renew") is False
        assert sub.get("cancelled_at")
        # still active until expiry
        assert sub.get("active") is True


# ------------- Streak check-in ---------------------------------------------
class TestStreak:
    def test_streak_idempotent_first_call(self, fresh_user):
        s = fresh_user["session"]
        r1 = s.post(f"{API}/me/streak/checkin", timeout=30)
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["streak"]["current"] >= 1
        # Second call same day
        r2 = s.post(f"{API}/me/streak/checkin", timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["credited"] is False
        assert d2["streak"]["current"] == d1["streak"]["current"]


# ------------- Missions ----------------------------------------------------
class TestMissions:
    def test_missions_list(self, fresh_user):
        s = fresh_user["session"]
        r = s.get(f"{API}/me/missions", timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {m["id"] for m in items}
        expected = {"login_daily", "refer_friend", "place_smm", "run_tool", "spin"}
        assert expected.issubset(ids)
        for m in items:
            for k in ("id", "title", "reward_inr", "icon", "color", "claimed_today", "ready_to_claim"):
                assert k in m

    def test_mission_claim_idempotent(self, fresh_user):
        s = fresh_user["session"]
        bal0 = s.get(f"{API}/me/subscription", timeout=30).json()["wallet_balance"]
        # claim login_daily (reward 5)
        r1 = s.post(f"{API}/me/missions/claim", json={"mission_id": "login_daily"}, timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json()["credited_inr"] == 5
        bal1 = s.get(f"{API}/me/subscription", timeout=30).json()["wallet_balance"]
        assert bal1 == bal0 + 5
        # Second claim same day → 400
        r2 = s.post(f"{API}/me/missions/claim", json={"mission_id": "login_daily"}, timeout=30)
        assert r2.status_code == 400
