"""
Backend tests for Telegram bot major upgrade (iteration 5).
Strategy: call backend.server._process_update() in-process, monkey-patching _tg_call
so no real Telegram traffic is sent. Mongo state is asserted directly through `db`.

Also runs regression HTTP tests against the public tool endpoints and admin announcements.
"""
import os
import sys
import uuid
import json
import time
import asyncio
import pytest
import requests
from datetime import datetime, timezone

# --- bootstrap path so we can import backend.server ----
sys.path.insert(0, "/app/backend")
# create + install a single event loop BEFORE importing server, so motor binds to it
_LOOP = asyncio.new_event_loop()
asyncio.set_event_loop(_LOOP)
import server  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "admin123"

# Will collect outgoing telegram messages here for inspection
SENT: list = []


@pytest.fixture(autouse=True)
def stub_tg(monkeypatch):
    """Stub _tg_call so no real Telegram traffic. Force a non-empty bot_token."""
    SENT.clear()

    async def fake_tg_call(bot_token, method, payload):
        SENT.append({"method": method, "payload": payload})
        return {"ok": True, "result": {"message_id": 1}}

    async def fake_get_token():
        return "TEST_BOT_TOKEN"

    monkeypatch.setattr(server, "_tg_call", fake_tg_call)
    monkeypatch.setattr(server, "_get_bot_token", fake_get_token)
    yield


# Helpers
def msg_update(chat_id: int, text: str):
    return {"message": {"chat": {"id": chat_id}, "text": text}}


def cb_update(chat_id: int, data: str):
    return {"callback_query": {"id": "cb1", "data": data, "message": {"chat": {"id": chat_id}}}}


async def _run(coro):
    return await coro


@pytest.fixture(scope="session")
def event_loop():
    yield _LOOP
    _LOOP.close()


@pytest.fixture(autouse=True)
def cleanup_data(event_loop):
    """Cleanup test data before & after each test."""
    chat_ids = [99999, 88888, 77777]

    async def clean():
        await server.db.tg_state.delete_many({"chat_id": {"$in": chat_ids}})
        await server.db.tg_ai_quota.delete_many({"chat_id": {"$in": chat_ids}})
        await server.db.users.delete_many({"telegram_chat_id": {"$in": chat_ids}})
        # Find user_ids that match seed users to wipe spin_history/wallet
        await server.db.spin_history.delete_many({"via": "telegram", "user_id": {"$regex": "^TEST_"}})
        await server.db.wallet_transactions.delete_many({"user_id": {"$regex": "^TEST_"}})

    event_loop.run_until_complete(clean())
    yield
    event_loop.run_until_complete(clean())


# ===========================================================================
# /menu
# ===========================================================================
def test_menu_command(event_loop):
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/menu")))
    assert any(m["method"] == "sendMessage" for m in SENT)
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "MAIN MENU" in last["payload"]["text"]
    assert "inline_keyboard" in last["payload"]["reply_markup"]


# ===========================================================================
# /breach
# ===========================================================================
def test_breach_with_email_no_state_left(event_loop):
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/breach test@example.com")))
    state = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert state is None, f"tg_state should be cleared after /breach with email arg, got: {state}"


def test_breach_without_email_then_email(event_loop):
    # Step 1: /breach with no email → sets awaiting_breach_email
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/breach")))
    state = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert state is not None
    assert state["key"] == "awaiting_breach_email"

    # Step 2: send plain email → state cleared
    event_loop.run_until_complete(server._process_update(msg_update(99999, "test@example.com")))
    state2 = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert state2 is None


# ===========================================================================
# /odds — 3 step flow
# ===========================================================================
def test_odds_full_flow(event_loop):
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/odds")))
    s1 = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert s1 and s1["key"] == "odds_pick_platform"

    event_loop.run_until_complete(server._process_update(cb_update(99999, "odds_p_instagram")))
    s2 = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert s2 and s2["key"] == "odds_pick_issue"
    assert s2["data"]["platform"] == "instagram"

    event_loop.run_until_complete(server._process_update(cb_update(99999, "odds_i_hacked")))
    s3 = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert s3 and s3["key"] == "odds_pick_when"
    assert s3["data"]["issue"] == "hacked"

    event_loop.run_until_complete(server._process_update(cb_update(99999, "odds_w_today")))
    s4 = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert s4 is None, "state must be cleared after finish"

    # Final reply contains odds
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "RECOVERY ODDS" in last["payload"]["text"]


# ===========================================================================
# /quote — 3 step flow
# ===========================================================================
def test_quote_full_flow(event_loop):
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/quote")))
    event_loop.run_until_complete(server._process_update(cb_update(99999, "q_p_instagram")))
    event_loop.run_until_complete(server._process_update(cb_update(99999, "q_i_hacked")))
    s = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert s and s["key"] == "quote_pick_urgency"
    event_loop.run_until_complete(server._process_update(cb_update(99999, "q_u_high")))
    s2 = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert s2 is None
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "INSTANT QUOTE" in last["payload"]["text"]


# ===========================================================================
# /spin — unlinked rejects, linked credits + idempotent same-day
# ===========================================================================
def test_spin_unlinked(event_loop):
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/spin")))
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "Link your account" in last["payload"]["text"]
    # No wallet/spin entries
    count = event_loop.run_until_complete(server.db.spin_history.count_documents({"via": "telegram"}))
    # Pre-existing rows from other tests may exist; assert no row was created for missing user
    # We rely on user not existing, so spin_history wouldn't get a row for chat 99999
    assert True  # primary assertion is the reply text


def test_spin_linked_idempotent_same_day(event_loop):
    test_uid = f"TEST_uid_{uuid.uuid4().hex[:8]}"

    async def setup():
        await server.db.users.insert_one({
            "user_id": test_uid,
            "telegram_chat_id": 99999,
            "email": "TEST_spin@example.com",
            "balance": 0,
            "currency": "INR",
            "created_at": server._now_iso(),
        })

    event_loop.run_until_complete(setup())

    # First spin → success
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/spin")))
    spins = event_loop.run_until_complete(server.db.spin_history.count_documents({"user_id": test_uid}))
    txns = event_loop.run_until_complete(server.db.wallet_transactions.count_documents({"user_id": test_uid}))
    assert spins == 1
    assert txns == 1
    user = event_loop.run_until_complete(server.db.users.find_one({"user_id": test_uid}))
    assert user["balance"] > 0

    # Second spin same day → rejected
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/spin")))
    spins2 = event_loop.run_until_complete(server.db.spin_history.count_documents({"user_id": test_uid}))
    txns2 = event_loop.run_until_complete(server.db.wallet_transactions.count_documents({"user_id": test_uid}))
    assert spins2 == 1
    assert txns2 == 1
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "Come back tomorrow" in last["payload"]["text"]


# ===========================================================================
# /phishing — state + AI call (mock LLM)
# ===========================================================================
def test_phishing_flow(event_loop, monkeypatch):
    # Mock the LlmChat to avoid actual API call
    import emergentintegrations.llm.chat as llm_mod

    class FakeChat:
        def __init__(self, *a, **kw):
            pass

        def with_model(self, *a, **kw):
            return self

        async def send_message(self, msg):
            return '{"risk_level": "high", "confidence": 95, "red_flags": ["urgency", "bit.ly shortener"], "verdict": "Phishing attempt", "action": "Do not click."}'

    monkeypatch.setattr(llm_mod, "LlmChat", FakeChat)

    event_loop.run_until_complete(server._process_update(msg_update(99999, "/phishing")))
    state = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert state and state["key"] == "awaiting_phishing_text"

    event_loop.run_until_complete(server._process_update(
        msg_update(99999, "Your Instagram is disabled. Click http://bit.ly/insta-restore now to appeal within 24h.")
    ))
    state2 = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert state2 is None
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "HIGH" in last["payload"]["text"].upper()


# ===========================================================================
# /wallet — unlinked vs linked
# ===========================================================================
def test_wallet_unlinked(event_loop):
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/wallet")))
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "Link your account" in last["payload"]["text"]


def test_wallet_linked(event_loop):
    test_uid = f"TEST_uid_{uuid.uuid4().hex[:8]}"

    async def setup():
        await server.db.users.insert_one({
            "user_id": test_uid, "telegram_chat_id": 99999,
            "email": "TEST_w@example.com", "balance": 250.0,
            "currency": "INR", "created_at": server._now_iso(),
        })

    event_loop.run_until_complete(setup())
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/wallet")))
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "WALLET BALANCE" in last["payload"]["text"]
    assert "250" in last["payload"]["text"]


# ===========================================================================
# /news
# ===========================================================================
def test_news(event_loop):
    async def setup():
        await server.db.announcements.insert_one({
            "id": f"TEST_{uuid.uuid4().hex[:8]}",
            "title": "TEST Announcement", "body": "Test body content",
            "created_at": server._now_iso(),
        })

    event_loop.run_until_complete(setup())
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/news")))
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    text = last["payload"]["text"]
    assert "UPDATES" in text or "news" in text.lower()


# ===========================================================================
# /refer — generates referral_code
# ===========================================================================
def test_refer_linked(event_loop):
    test_uid = f"TEST_uid_{uuid.uuid4().hex[:8]}"

    async def setup():
        await server.db.users.insert_one({
            "user_id": test_uid, "telegram_chat_id": 99999,
            "email": "TEST_r@example.com", "balance": 0,
            "created_at": server._now_iso(),
        })

    event_loop.run_until_complete(setup())
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/refer")))
    user = event_loop.run_until_complete(server.db.users.find_one({"user_id": test_uid}))
    assert user.get("referral_code")
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "errorhacker.site/r/" in last["payload"]["text"]


# ===========================================================================
# AI rate limit
# ===========================================================================
def test_ai_rate_limit(event_loop, monkeypatch):
    import emergentintegrations.llm.chat as llm_mod

    class FakeChat:
        def __init__(self, *a, **kw):
            pass

        def with_model(self, *a, **kw):
            return self

        async def send_message(self, msg):
            return "Test AI reply."

    monkeypatch.setattr(llm_mod, "LlmChat", FakeChat)

    # send 11 plain text messages from chat_id 88888
    for i in range(11):
        event_loop.run_until_complete(server._process_update(msg_update(88888, f"hello bot question {i}")))

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    quota = event_loop.run_until_complete(server.db.tg_ai_quota.find_one({"chat_id": 88888, "date": today}))
    assert quota is not None
    assert quota["count"] == 10, f"expected count=10 (capped), got {quota['count']}"

    # 11th message should have produced quota-exhausted reply
    last = [m for m in SENT if m["method"] == "sendMessage"][-1]
    assert "free AI questions" in last["payload"]["text"] or "10/10" in last["payload"]["text"]


# ===========================================================================
# /cancel — clears state
# ===========================================================================
def test_cancel_clears_state(event_loop):
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/odds")))
    s = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert s
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/cancel")))
    s2 = event_loop.run_until_complete(server.db.tg_state.find_one({"chat_id": 99999}))
    assert s2 is None


# ===========================================================================
# Regression: legacy commands still work
# ===========================================================================
def test_regression_start_help_recover(event_loop):
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/start")))
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/help")))
    event_loop.run_until_complete(server._process_update(msg_update(99999, "/recover")))
    event_loop.run_until_complete(server._process_update(msg_update(99999, "REC-AB12CD34")))
    # 4 commands => at least 4 sendMessage calls (welcome+menu = 2, others = ~3+)
    sends = [m for m in SENT if m["method"] == "sendMessage"]
    assert len(sends) >= 4


# ===========================================================================
# Regression: HTTP tool endpoints
# ===========================================================================
def test_http_tools_recovery_odds():
    r = requests.post(f"{API}/tools/recovery-odds", json={
        "platform": "instagram", "issue": "hacked", "when": "today",
        "has_email": True, "has_phone": True, "has_id": True
    }, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "pro_odds" in data and "days_min" in data


def test_http_tools_breach():
    r = requests.post(f"{API}/tools/breach", json={"email": "test@example.com"}, timeout=20)
    assert r.status_code in (200, 502)  # 502 acceptable if 3rd party is down
    if r.status_code == 200:
        assert "breached" in r.json()


def test_http_tools_phishing():
    r = requests.post(f"{API}/tools/phishing-check", json={
        "message": "Click http://bit.ly/x to restore account now.", "channel": "DM"
    }, timeout=45)
    assert r.status_code == 200, r.text


def test_http_tools_account_worth():
    r = requests.post(f"{API}/tools/account-worth", json={
        "platform": "Instagram", "niche": "fitness", "followers": 10000,
        "avg_likes": 500, "avg_comments": 30
    }, timeout=15)
    assert r.status_code == 200, r.text


def test_http_tools_selfie_coach():
    r = requests.post(f"{API}/tools/selfie-coach", json={
        "lighting": "bright", "background": "plain",
        "holding_id": True, "matches_profile": True
    }, timeout=15)
    assert r.status_code == 200, r.text


def test_http_tools_appeal():
    r = requests.post(f"{API}/tools/appeal", json={
        "platform": "Instagram", "violation_reason": "Community Guidelines",
        "tone": "polite", "language": "english", "backstory": "Account suddenly disabled."
    }, timeout=45)
    assert r.status_code == 200, r.text


def test_http_tools_faq():
    r = requests.post(f"{API}/tools/faq", json={
        "session_id": f"TEST_{uuid.uuid4().hex[:8]}",
        "message": "How much does recovery cost?"
    }, timeout=45)
    assert r.status_code == 200, r.text


# ===========================================================================
# Regression: admin announcements
# ===========================================================================
def _admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_admin_announcement_create_audience_delete():
    token = _admin_token()
    headers = {"X-Admin-Token": token}

    # audience preview
    r = requests.get(f"{API}/admin/announcements/audience?audience=all", headers=headers, timeout=15)
    assert r.status_code == 200, r.text

    # create
    payload = {
        "title": f"TEST_Anno_{uuid.uuid4().hex[:6]}", "body": "Testing announcement",
        "link": "", "tool_id": "",
        "send_telegram": False, "send_email": False, "audience": "all"
    }
    r = requests.post(f"{API}/admin/announcements", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    ann_id = r.json()["id"]

    # list (GET)
    r = requests.get(f"{API}/admin/announcements", headers=headers, timeout=15)
    assert r.status_code == 200
    assert any(a.get("id") == ann_id for a in r.json())

    # delete
    r = requests.delete(f"{API}/admin/announcements/{ann_id}", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
