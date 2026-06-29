"""Iter-12 refactor regression tests.

Covers:
  - Cashfree routes work after extraction to routes/cashfree.py
  - No deprecated `on_event` markers left in server.py
  - Each asyncio.create_task in target blocks is wrapped in its OWN try/except
  - routes package skeleton present
  - Only cashfree leftovers in server.py are `import cashfree_service` + _cashfree_reconcile helper
"""
from __future__ import annotations
import os
import re
import subprocess
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
SERVER_PY = Path("/app/backend/server.py")
ROUTES_DIR = Path("/app/backend/routes")


# -------------------------------------------------------------------------
# 1. Startup / lifespan behaviour
# -------------------------------------------------------------------------
class TestLifespanStartup:
    def test_backend_root_alive(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200

    def test_cashfree_config_proves_startup_initialised(self):
        """If startup wiring (config/admin/cashfree env) broke, config would 503/500."""
        r = requests.get(f"{BASE_URL}/api/payments/cashfree/config", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("configured") is True
        assert data.get("mode") == "production"

    def test_no_on_event_decorator_in_server(self):
        """on_event is deprecated. Refactor claim: migrated to lifespan."""
        src = SERVER_PY.read_text()
        assert "on_event" not in src, "server.py still contains deprecated @app.on_event"

    def test_no_deprecation_warning_in_recent_logs(self):
        """Scan latest startup window for FastAPI on_event DeprecationWarning."""
        try:
            out = subprocess.check_output(
                ["tail", "-n", "300", "/var/log/supervisor/backend.err.log"],
                stderr=subprocess.STDOUT, timeout=5,
            ).decode("utf-8", errors="ignore")
        except Exception:
            pytest.skip("supervisor log not readable")
        # We don't care about other warnings, just on_event deprecation
        assert "on_event is deprecated" not in out.lower()
        assert "deprecationwarning" not in out.lower() or "on_event" not in out.lower()


# -------------------------------------------------------------------------
# 2. routes/ package & extraction
# -------------------------------------------------------------------------
class TestRoutesPackage:
    def test_routes_init_exists(self):
        assert (ROUTES_DIR / "__init__.py").is_file()

    def test_routes_cashfree_exists(self):
        assert (ROUTES_DIR / "cashfree.py").is_file()

    def test_server_includes_cashfree_router(self):
        src = SERVER_PY.read_text()
        assert "from routes.cashfree import router as cashfree_router" in src
        assert "api.include_router(cashfree_router)" in src

    def test_server_no_longer_defines_cashfree_routes(self):
        """The 5 cashfree HTTP endpoints must NOT be defined in server.py anymore."""
        src = SERVER_PY.read_text()
        forbidden = [
            '@api.get("/payments/cashfree/config")',
            '@api.post("/me/wallet/topup/cashfree")',
            '@api.post("/me/orders/{order_id}/pay/cashfree")',
            '@api.get("/payments/cashfree/orders/{cf_order_id}/status")',
            '@api.post("/payments/cashfree/webhook")',
        ]
        leftovers = [d for d in forbidden if d in src]
        assert not leftovers, f"Cashfree route decorators still in server.py: {leftovers}"

    def test_server_keeps_cf_import_and_reconcile_helper(self):
        src = SERVER_PY.read_text()
        assert "import cashfree_service as cf" in src
        assert "_cashfree_reconcile" in src

    def test_cashfree_module_uses_lazy_srv(self):
        cf_src = (ROUTES_DIR / "cashfree.py").read_text()
        assert "def _srv" in cf_src
        assert "import server" in cf_src


# -------------------------------------------------------------------------
# 3. Try/except isolation on asyncio.create_task dispatches
# -------------------------------------------------------------------------
class TestCreateTaskIsolation:
    """Each asyncio.create_task in the 3 target blocks must have its OWN
    try/except, not a single bulk one. Grep-based proof."""

    def test_me_pay_with_wallet_has_three_isolated_dispatches(self):
        src = SERVER_PY.read_text().splitlines()
        # Look at me_pay_with_wallet body — locate the post-order-update block.
        # We grep the structure: 3 occurrences of `try: asyncio.create_task(`
        # followed by `except Exception` within the function.
        import re
        # extract the function body
        m = re.search(
            r"async def me_pay_with_wallet\([^)]*\):.*?(?=\n# ---- Refund|\nasync def |\n@api\.|\nclass )",
            "\n".join(src), flags=re.DOTALL,
        )
        assert m, "me_pay_with_wallet body not found"
        body = m.group(0)
        try_dispatch = re.findall(r"try:\s*asyncio\.create_task\(", body)
        assert len(try_dispatch) == 3, (
            f"Expected 3 isolated `try: asyncio.create_task(` in me_pay_with_wallet, found {len(try_dispatch)}"
        )
        # And matching excepts within same block region
        excepts = re.findall(r"except Exception as e:\s*log\.warning\(", body)
        assert excepts and len(excepts) >= 3, "matching except clauses missing in me_pay_with_wallet"

    def test_cashfree_reconcile_wallet_topup_isolated(self):
        src = SERVER_PY.read_text()
        # The wallet_topup branch lives inside _cashfree_reconcile
        m = re.search(
            r"async def _cashfree_reconcile\(.*?(?=\n# ----|\nasync def |\n@api\.|\nclass )",
            src, flags=re.DOTALL,
        )
        assert m, "_cashfree_reconcile body not found"
        body = m.group(0)
        wallet_section = body.split("elif pending.get(\"purpose\") == \"service_payment\"")[0]
        try_dispatch = re.findall(r"try:\s*asyncio\.create_task\(", wallet_section)
        assert len(try_dispatch) >= 2, (
            f"Wallet-topup branch should isolate notify_wallet_credited + send_wallet_receipt_email, found {len(try_dispatch)}"
        )

    def test_cashfree_reconcile_service_payment_isolated(self):
        src = SERVER_PY.read_text()
        m = re.search(
            r"async def _cashfree_reconcile\(.*?(?=\n# ----|\nasync def |\n@api\.|\nclass )",
            src, flags=re.DOTALL,
        )
        assert m
        body = m.group(0)
        # service_payment branch
        parts = body.split("elif pending.get(\"purpose\") == \"service_payment\"")
        assert len(parts) == 2, "service_payment branch not found"
        svc_section = parts[1]
        try_dispatch = re.findall(r"try:\s*asyncio\.create_task\(", svc_section)
        assert len(try_dispatch) >= 2, (
            f"service_payment branch should isolate notify_order_status + send_order_receipt_email, found {len(try_dispatch)}"
        )


# -------------------------------------------------------------------------
# 4. Routed Cashfree endpoints still work (behavioural regression)
# -------------------------------------------------------------------------
class TestExtractedRoutesBehaviour:
    def test_config_200(self):
        r = requests.get(f"{BASE_URL}/api/payments/cashfree/config", timeout=10)
        assert r.status_code == 200
        assert r.json()["configured"] is True

    def test_topup_unauth_401(self):
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/cashfree",
            json={"amount": 50}, timeout=10,
        )
        assert r.status_code == 401

    def test_pay_order_unauth_401(self):
        r = requests.post(
            f"{BASE_URL}/api/me/orders/some-random-id/pay/cashfree",
            json={}, timeout=10,
        )
        assert r.status_code == 401

    def test_webhook_missing_sig_401(self):
        r = requests.post(
            f"{BASE_URL}/api/payments/cashfree/webhook",
            data=b'{"data":{}}',
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_status_unknown_order_502(self):
        # cashfree returns 404 for unknown order which our route maps to 502
        r = requests.get(
            f"{BASE_URL}/api/payments/cashfree/orders/WTU-DOES-NOT-EXIST-XYZ/status",
            timeout=15,
        )
        assert r.status_code == 502
