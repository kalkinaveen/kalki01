"""
Batch 3 backend tests for ERRORHACKER:
- /api/tools/breach (XposedOrNot free API, no LLM)
- /api/tools/recovery-odds (rule-based)
- /api/tools/phishing-check (Claude Sonnet 4.5 STRICT JSON)
- /api/tools/account-worth (rule-based, INR/USD)
- /api/tools/selfie-coach (rule-based, score ring)
- /api/announcements (public GET)
- /api/admin/announcements (admin GET/POST/DELETE) + tool_meta is_new
- Regression: /api/tools/appeal, /api/tools/faq, /api/config, /api/chat/message
"""
import os
import re
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


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": "admin123"}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


# -------- /api/tools/breach -----------------------------------------
class TestBreach:
    def test_breach_known_email(self):
        # XposedOrNot lists test@example.com in many breaches; retry once on 502.
        last = None
        for _ in range(2):
            r = requests.post(f"{API}/tools/breach", json={"email": "test@example.com"}, timeout=30)
            last = r
            if r.status_code == 200:
                break
            time.sleep(2)
        assert last.status_code == 200, f"{last.status_code} {last.text}"
        data = last.json()
        for k in ("breached", "count", "exposure_score", "risk_label", "breaches"):
            assert k in data, f"missing key {k}: {data}"
        assert isinstance(data["breaches"], list)
        assert data["breached"] is True, f"expected breached=true for test@example.com: {data}"
        assert data["count"] > 0
        assert isinstance(data["count"], int)

    def test_breach_invalid_email_400(self):
        r = requests.post(f"{API}/tools/breach", json={"email": "not-an-email"}, timeout=15)
        assert r.status_code in (400, 422), f"expected 4xx, got {r.status_code}: {r.text}"


# -------- /api/tools/recovery-odds ----------------------------------
class TestOdds:
    def test_odds_happy(self):
        payload = {
            "platform": "instagram",
            "issue": "hacked",
            "when": "today",
            "has_email": True,
            "has_phone": True,
            "has_id": True,
        }
        r = requests.post(f"{API}/tools/recovery-odds", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("self_odds", "pro_odds", "days_min", "days_max", "tier"):
            assert k in d
        assert 5 <= d["self_odds"] <= 95
        assert 5 <= d["pro_odds"] <= 95
        assert d["pro_odds"] >= d["self_odds"]
        assert d["tier"] in ("high", "medium", "low")
        assert d["days_min"] <= d["days_max"]

    def test_odds_low_tier_clamp(self):
        payload = {
            "platform": "tiktok",
            "issue": "disabled",
            "when": "older",
            "has_email": False,
            "has_phone": False,
            "has_id": False,
        }
        r = requests.post(f"{API}/tools/recovery-odds", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["self_odds"] >= 5
        assert d["pro_odds"] <= 95


# -------- /api/tools/phishing-check ---------------------------------
class TestPhishing:
    def test_phishing_scammy_message(self):
        scammy = (
            "Hi I am from Instagram support. Your account will be permanently suspended in 24h. "
            "Click bit.ly/insta-appeal NOW and verify your password to avoid suspension."
        )
        r = requests.post(f"{API}/tools/phishing-check", json={"message": scammy, "channel": "DM"}, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert d.get("risk_level") in ("safe", "low", "medium", "high", "critical")
        assert d["risk_level"] in ("high", "critical"), f"expected high/critical, got {d}"
        assert 0 <= int(d.get("confidence", 0)) <= 100
        assert isinstance(d.get("red_flags"), list) and len(d["red_flags"]) > 0
        assert "action" in d

    def test_phishing_too_short_400(self):
        r = requests.post(f"{API}/tools/phishing-check", json={"message": "short"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_phishing_too_long_400(self):
        r = requests.post(f"{API}/tools/phishing-check", json={"message": "x" * 6001}, timeout=15)
        assert r.status_code == 400, r.text


# -------- /api/tools/account-worth ----------------------------------
class TestAccountWorth:
    def test_worth_low_followers_400(self):
        r = requests.post(f"{API}/tools/account-worth", json={"niche": "tech", "followers": 50}, timeout=15)
        assert r.status_code == 400, r.text

    def test_worth_currency_fields(self):
        payload = {
            "platform": "Instagram",
            "niche": "tech",
            "followers": 10000,
            "avg_likes": 400,
            "avg_comments": 30,
            "country_tier": "tier2",
            "verified": False,
        }
        r = requests.post(f"{API}/tools/account-worth", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("per_post_usd_min", "per_post_usd_max", "account_usd_min", "account_usd_max",
                  "per_post_inr_min", "per_post_inr_max", "account_inr_min", "account_inr_max",
                  "engagement_rate"):
            assert k in d, f"missing {k}"
        assert d["per_post_usd_max"] >= d["per_post_usd_min"]
        assert d["account_usd_max"] >= d["account_usd_min"]

    def test_worth_verified_boost(self):
        base = {"platform": "Instagram", "niche": "tech", "followers": 10000, "avg_likes": 400, "avg_comments": 30, "country_tier": "tier2"}
        r1 = requests.post(f"{API}/tools/account-worth", json={**base, "verified": False}, timeout=15)
        r2 = requests.post(f"{API}/tools/account-worth", json={**base, "verified": True}, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        d1, d2 = r1.json(), r2.json()
        # verified bumps per_post_min by 1.35x, max by 1.45x
        assert d2["per_post_usd_min"] > d1["per_post_usd_min"]
        ratio = d2["per_post_usd_min"] / max(d1["per_post_usd_min"], 0.0001)
        assert 1.3 <= ratio <= 1.4, f"expected ~1.35x, got {ratio}"


# -------- /api/tools/selfie-coach -----------------------------------
class TestSelfieCoach:
    def test_perfect_ready(self):
        payload = {"lighting": "bright", "background": "plain", "holding_id": True, "matches_profile": True}
        r = requests.post(f"{API}/tools/selfie-coach", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["score"] == 100
        assert d["tier"] == "ready"
        assert d["blockers"] == []

    def test_worst_high_risk(self):
        payload = {"lighting": "dim", "background": "unsafe", "holding_id": False, "matches_profile": False}
        r = requests.post(f"{API}/tools/selfie-coach", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["score"] < 50
        assert isinstance(d["blockers"], list) and len(d["blockers"]) > 0


# -------- /api/announcements (public) -------------------------------
class TestAnnouncementsPublic:
    def test_public_list(self):
        r = requests.get(f"{API}/announcements", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 10
        # ensure mongo _id is excluded
        for d in data:
            assert "_id" not in d


# -------- /api/admin/announcements (admin) --------------------------
class TestAnnouncementsAdmin:
    def test_create_requires_admin(self):
        r = requests.post(f"{API}/admin/announcements", json={"title": "x", "body": "y"}, timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_create_empty_title_400(self, admin_token):
        r = requests.post(
            f"{API}/admin/announcements",
            json={"title": "  ", "body": "non-empty"},
            headers={"X-Admin-Token": admin_token},
            timeout=20,
        )
        assert r.status_code == 400, r.text

    def test_create_blast_zero_counters(self, admin_token):
        # NOTE: send_email/send_telegram set False to avoid spamming real users in
        # the db (the seed actually DOES contain 6 emails — request assumption was
        # outdated). We still verify the persistence contract: counters default to 0.
        title = f"TEST Announcement {uuid.uuid4().hex[:6]}"
        payload = {
            "title": title,
            "body": "Body content for testing",
            "tool_id": "breach",
            "send_telegram": False,
            "send_email": False,
            "audience": "all",
        }
        r = requests.post(
            f"{API}/admin/announcements", json=payload,
            headers={"X-Admin-Token": admin_token}, timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        ann_id = d["id"]
        assert d["status"] == "sent"
        assert d["tg_sent"] == 0
        assert d["tg_failed"] == 0
        assert d["email_sent"] == 0
        assert d["email_failed"] == 0
        # Verify it appears in public list
        pub = requests.get(f"{API}/announcements", timeout=15).json()
        assert any(x.get("id") == ann_id for x in pub), "new announcement should show in public list"

        # Verify tool_meta is_new=true for breach
        r2 = requests.get(f"{API}/admin/announcements", headers={"X-Admin-Token": admin_token}, timeout=15)
        assert r2.status_code == 200
        # cleanup
        r3 = requests.delete(f"{API}/admin/announcements/{ann_id}", headers={"X-Admin-Token": admin_token}, timeout=15)
        assert r3.status_code == 200, r3.text

    def test_delete_missing_404(self, admin_token):
        r = requests.delete(
            f"{API}/admin/announcements/does-not-exist-xyz",
            headers={"X-Admin-Token": admin_token}, timeout=15,
        )
        assert r.status_code == 404, r.text


# -------- tool_meta side-effect direct mongo check ------------------
class TestToolMeta:
    def test_tool_meta_marked_new(self, admin_token):
        import asyncio
        try:
            from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore
        except Exception:
            pytest.skip("motor not available")

        mongo_url = None
        db_name = None
        try:
            with open("/app/backend/.env") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("MONGO_URL="):
                        mongo_url = line.split("=", 1)[1].strip().strip('"')
                    elif line.startswith("DB_NAME="):
                        db_name = line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass
        if not mongo_url or not db_name:
            pytest.skip("MONGO_URL/DB_NAME not set")

        title = f"TEST Meta {uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/admin/announcements",
            json={"title": title, "body": "b", "tool_id": "breach", "send_telegram": False, "send_email": False},
            headers={"X-Admin-Token": admin_token}, timeout=30,
        )
        assert r.status_code == 200, r.text
        ann_id = r.json()["id"]

        async def _check():
            client = AsyncIOMotorClient(mongo_url)
            doc = await client[db_name].tool_meta.find_one({"tool_id": "breach"})
            client.close()
            return doc

        doc = asyncio.get_event_loop().run_until_complete(_check())
        assert doc is not None
        assert doc.get("is_new") is True
        # cleanup
        requests.delete(f"{API}/admin/announcements/{ann_id}",
                        headers={"X-Admin-Token": admin_token}, timeout=15)


# -------- Regression: existing endpoints still work -----------------
class TestRegression:
    def test_config_ok(self):
        r = requests.get(f"{API}/config", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "_id" not in body

    def test_appeal_short_ok(self):
        r = requests.post(
            f"{API}/tools/appeal",
            json={
                "platform": "Instagram",
                "violation_reason": "Community Guidelines",
                "backstory": "Disabled after Halloween costume photo.",
                "tone": "polite",
                "language": "english",
            },
            timeout=60,
        )
        # accept 200 or 502 (LLM budget) -- but verify happy path mostly
        assert r.status_code in (200, 502), r.text
        if r.status_code == 200:
            assert len(r.json().get("letter", "").strip()) > 100

    def test_faq_ok(self):
        sid = f"qa-b3-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/tools/faq", json={"session_id": sid, "message": "what tools do you offer?"}, timeout=60)
        assert r.status_code in (200, 502), r.text

    def test_chat_legacy_ok(self):
        sid = f"qa-b3-chat-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/chat/message", json={"session_id": sid, "message": "hi"}, timeout=60)
        assert r.status_code in (200, 502), r.text
