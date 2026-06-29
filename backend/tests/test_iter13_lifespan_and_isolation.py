"""
Iter-13 retest: verify two fixes from iter-12 feedback have landed.
  (a) HIGH:  Real `@asynccontextmanager lifespan` migration with index creation.
  (b) MED:   PATCH /orders/{id} has 3 separate try/except blocks around
             _notify_user_order, notify_order_status, send_order_receipt_email.

Plus a behavioural smoke test: admin PATCH order to status='verified' with
payment_amount → server still 200 OK (means none of the 3 dispatches blew up).
"""
import os, re, subprocess, time, uuid
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://functionality-139.preview.emergentagent.com",
).rstrip("/")
SERVER_PY = Path("/app/backend/server.py")
SRC = SERVER_PY.read_text()


# ------------------------------------------------------------------ Static / code-level checks
class TestLifespanLanded:
    def test_lifespan_imports_and_decorator_present(self):
        # Required pieces: import + decorator + def + FastAPI kwarg
        assert "from contextlib import asynccontextmanager" in SRC
        assert re.search(r"^@asynccontextmanager\s*$", SRC, flags=re.MULTILINE), \
            "missing @asynccontextmanager decorator line"
        assert re.search(r"^async def lifespan\(", SRC, flags=re.MULTILINE), \
            "missing `async def lifespan(...)` definition"
        assert "lifespan=lifespan" in SRC, "FastAPI(...) is not wired with lifespan=lifespan"

    def test_grep_returns_at_least_four_lifespan_hits(self):
        # Mirror the brief's explicit check (≥4 hits).
        hits = re.findall(r"lifespan|asynccontextmanager", SRC)
        assert len(hits) >= 4, f"expected ≥4 lifespan/asynccontextmanager hits, got {len(hits)}"

    def test_create_index_count_at_least_13(self):
        idx_calls = re.findall(r"await\s+db\.[A-Za-z_]+\.create_index", SRC)
        assert len(idx_calls) >= 13, f"expected ≥13 await db.*.create_index calls, got {len(idx_calls)}"

    def test_no_on_event_decorator_lines(self):
        bad = re.findall(r"^\s*@\w[\w\.]*\.on_event\s*\(", SRC, flags=re.MULTILINE)
        assert not bad, f"deprecated @app.on_event decorators still present: {bad}"


class TestLifespanRanAtStartup:
    """Tail backend log; the lifespan body must have logged 'ERRORHACKER API ready'."""

    def test_ready_log_present(self):
        try:
            out = subprocess.check_output(
                ["tail", "-n", "400", "/var/log/supervisor/backend.err.log"],
                stderr=subprocess.STDOUT, timeout=5,
            ).decode("utf-8", errors="ignore")
        except Exception:
            pytest.skip("supervisor log not readable")
        assert "ERRORHACKER API ready" in out, \
            "lifespan body did not log 'ERRORHACKER API ready' on most recent startup"


# ------------------------------------------------------------------ Try/except isolation
class TestPatchOrdersIsolation:
    def test_three_isolated_try_except_blocks_present(self):
        # Pull the body of patch_order(...) — start at `def patch_order` and stop at
        # next top-level `@api.` or `@app.` route.
        # The handler is registered as `@api.patch("/orders/{order_id}")` and
        # the function is `async def update_order(...)`.
        start = SRC.find("async def update_order(")
        assert start != -1, "update_order (PATCH /orders) handler not found"
        end_match = re.search(r"\n@(api|app)\.", SRC[start + 1:])
        end = start + 1 + end_match.start() if end_match else len(SRC)
        body = SRC[start:end]

        # The three dispatched fns must each appear in their own try-block.
        for fn in ("_notify_user_order", "notify_order_status", "send_order_receipt_email"):
            # Look for `try:` followed (within ~3 lines) by `asyncio.create_task(<fn>(`
            pat = re.compile(
                r"try:\s*[\r\n]+\s*[^\n]*asyncio\.create_task\(\s*" + re.escape(fn) + r"\(",
                re.MULTILINE,
            )
            # Single-line `try: asyncio.create_task(_notify_user_order(...))` is also acceptable.
            pat_single = re.compile(r"try:\s*asyncio\.create_task\(\s*" + re.escape(fn) + r"\(")
            assert pat.search(body) or pat_single.search(body), \
                f"asyncio.create_task({fn}(...)) is not wrapped in its own try/except inside patch_order"

        # And we expect at least 3 `except Exception` lines within patch_order body.
        excepts = re.findall(r"except\s+Exception", body)
        assert len(excepts) >= 3, f"expected ≥3 except-Exception blocks in patch_order, got {len(excepts)}"


# ------------------------------------------------------------------ Behavioural smoke
ADMIN_TOKEN_CACHE = {}


def _admin_token():
    if ADMIN_TOKEN_CACHE.get("t"):
        return ADMIN_TOKEN_CACHE["t"]
    # Per /app/memory/test_credentials.md: POST /api/admin/login with {"password": "admin123"}
    try:
        r = requests.post(f"{BASE_URL}/api/admin/login",
                          json={"password": "admin123"}, timeout=10)
        if r.status_code == 200:
            tok = r.json().get("token")
            if tok:
                ADMIN_TOKEN_CACHE["t"] = tok
                return tok
    except Exception:
        pass
    return None


class TestPatchOrderBehavioural:
    def test_admin_can_patch_order_to_verified_without_500(self):
        tok = _admin_token()
        if not tok:
            pytest.skip("Could not obtain admin token via known endpoints — skipping behavioural smoke")

        headers = {"X-Admin-Token": tok, "Authorization": f"Bearer {tok}"}

        # Seed an order via admin (POST /api/orders is admin-creatable, otherwise fall back)
        order_payload = {
            "name": "Iter13 Smoke",
            "email": f"iter13_{uuid.uuid4().hex[:8]}@example.com",
            "phone": "9999999999",
            "service": "Test Service",
            "serviceName": "Test Service",
            "amount": 499,
            "payment_amount": 499,
            "status": "pending",
        }
        created = requests.post(f"{BASE_URL}/api/orders", json=order_payload, headers=headers, timeout=15)
        if created.status_code not in (200, 201):
            pytest.skip(f"could not create order to patch (status {created.status_code}): {created.text[:200]}")
        order = created.json()
        oid = order.get("id") or order.get("_id") or order.get("orderId")
        assert oid, f"order create response missing id: {order}"

        # Patch to verified with payment_amount — should fire all 3 dispatches.
        r = requests.patch(
            f"{BASE_URL}/api/orders/{oid}",
            json={"status": "verified", "payment_amount": 499},
            headers=headers, timeout=20,
        )
        assert r.status_code == 200, f"PATCH /orders failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("status") == "verified"

        # Give async dispatches a brief moment, then peek the log.
        time.sleep(2)
        try:
            log = subprocess.check_output(
                ["tail", "-n", "200", "/var/log/supervisor/backend.err.log"],
                stderr=subprocess.STDOUT, timeout=5,
            ).decode("utf-8", errors="ignore")
        except Exception:
            log = ""
        # If any of the 3 raised, we'd see `log.warning("X dispatch failed: ...")`.
        # We don't fail on warnings — we only assert the request itself did not 500.
        # Just record observed dispatch-warning lines for visibility.
        for marker in ("_notify_user_order dispatch failed",
                       "notify_order_status dispatch failed",
                       "send_order_receipt_email dispatch failed"):
            if marker in log:
                print(f"[INFO] observed isolated-warning: {marker}")
