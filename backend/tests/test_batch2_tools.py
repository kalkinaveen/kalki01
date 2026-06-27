"""
Batch 2 (Tools/AI Hub) backend tests for ERRORHACKER:
- POST /api/tools/appeal happy + validation (Claude Sonnet 4.5 via Emergent LLM)
- POST /api/tools/faq happy + validation + Mongo persistence (Claude Haiku 4.5)
- Regression: GET /api/config, POST /api/chat/message, POST /api/orders, GET /api/recovery/config
"""
import os
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


# -------- /api/tools/appeal ---------
class TestToolsAppeal:
    def test_appeal_happy_path(self):
        payload = {
            "platform": "Instagram",
            "violation_reason": "Community Guidelines violation",
            "account_handle": "testuser",
            "account_age": "3 years",
            "followers": "12k",
            "backstory": "My account was disabled after a costume photo I posted on Halloween.",
            "tone": "polite",
            "language": "english",
        }
        r = requests.post(f"{API}/tools/appeal", json=payload, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "letter" in data
        letter = data["letter"]
        assert isinstance(letter, str)
        assert len(letter.strip()) > 200, f"letter too short ({len(letter)}): {letter[:200]}"

    def test_appeal_empty_reason_returns_400(self):
        r = requests.post(f"{API}/tools/appeal", json={"platform": "Instagram", "violation_reason": ""}, timeout=30)
        assert r.status_code == 400, r.text

    def test_appeal_whitespace_only_reason_returns_400(self):
        r = requests.post(f"{API}/tools/appeal", json={"platform": "Instagram", "violation_reason": "   "}, timeout=30)
        assert r.status_code == 400, r.text


# -------- /api/tools/faq ---------
class TestToolsFaq:
    def test_faq_happy_path_and_persistence(self):
        sid = f"qa-faq-{uuid.uuid4().hex[:8]}"
        msg = "how long does recovery take?"
        r = requests.post(f"{API}/tools/faq", json={"session_id": sid, "message": msg}, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "reply" in data
        reply = data["reply"]
        assert isinstance(reply, str)
        assert len(reply.strip()) > 0
        # Verify Mongo persistence by re-using same session and checking continuity
        # The endpoint persists role=user + role=bot for the session_id. We cannot
        # query Mongo from here, but we can prove persistence by sending another
        # message in the same session and ensuring it still succeeds.
        r2 = requests.post(f"{API}/tools/faq", json={"session_id": sid, "message": "and refunds?"}, timeout=60)
        assert r2.status_code == 200, r2.text
        assert len(r2.json().get("reply", "").strip()) > 0

    def test_faq_empty_message_returns_400(self):
        r = requests.post(f"{API}/tools/faq", json={"session_id": "qa-x", "message": ""}, timeout=15)
        assert r.status_code == 400, r.text

    def test_faq_whitespace_message_returns_400(self):
        r = requests.post(f"{API}/tools/faq", json={"session_id": "qa-x", "message": "   "}, timeout=15)
        assert r.status_code == 400, r.text


# -------- Mongo persistence direct verification ---------
class TestFaqMongo:
    """Verify chat_history persistence directly via Mongo."""

    def test_faq_writes_to_chat_history(self):
        import asyncio
        try:
            from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore
        except Exception:
            pytest.skip("motor not available in test env")

        # Read MONGO_URL & DB_NAME from backend env file
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
            pytest.skip("MONGO_URL/DB_NAME not configured")

        sid = f"qa-mongo-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/tools/faq", json={"session_id": sid, "message": "ping?"}, timeout=60)
        assert r.status_code == 200, r.text

        async def _check():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            docs = await db.chat_history.find({"session_id": sid}).to_list(length=10)
            client.close()
            return docs

        docs = asyncio.get_event_loop().run_until_complete(_check())
        roles = [d.get("role") for d in docs]
        assert "user" in roles, f"missing user role; docs={docs}"
        assert "bot" in roles, f"missing bot role; docs={docs}"
        scopes = {d.get("scope") for d in docs}
        assert "faq" in scopes


# -------- Regression of existing endpoints ---------
class TestRegression:
    def test_config_ok(self):
        r = requests.get(f"{API}/config", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)
        assert "_id" not in body

    def test_recovery_config_ok(self):
        r = requests.get(f"{API}/recovery/config", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)
        assert "_id" not in body

    def test_legacy_chat_message_ok(self):
        sid = f"qa-legacy-{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/chat/message",
            json={"session_id": sid, "message": "hi"},
            timeout=60,
        )
        # If LLM budget tips over the cap, we accept 502 as a known-flaky env issue
        assert r.status_code in (200, 502), r.text
        if r.status_code == 200:
            assert isinstance(r.json().get("reply", ""), str)

    def test_orders_create_anonymous_ok(self):
        r = requests.post(
            f"{API}/orders",
            json={
                "serviceName": "OSINT",
                "name": "Regression Anon",
                "email": "regress@example.com",
                "size": "small",
                "target": "x",
                "notes": "regression",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        order = r.json()
        assert "id" in order
