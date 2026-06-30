"""Iteration 15 — additional regression for the public SMM catalog/order flow.

Covers gaps not exercised by tests/test_smm_public.py:
- catalog filters (q, platform, category) and platform_counts shape
- catalog no-auth (truly public)
- catalog cache (cached:true on 2nd hit)
- public quote 404 / 400 / happy-path floor
- public order DB persistence + missing-email 400
- service lookup 404
- admin PUT /admin/smm/config accepts markup_percent + min_order_inr and refresh=1 reflects new pricing
- admin POST /orders/{oid}/smm-place against a public order: no NameError, sets smm_error (panel has $0)

Run: cd /app/backend && pytest tests/test_iter15_smm_public_extra.py -v
"""
from __future__ import annotations
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def first_row():
    r = requests.get(f"{API}/public/smm/catalog?limit=5", timeout=30)
    assert r.status_code == 200
    rows = r.json().get("rows") or []
    if not rows:
        pytest.skip("Empty catalog")
    return rows[0]


# ---------- catalog ----------
class TestPublicCatalog:
    def test_no_auth_required(self):
        r = requests.get(f"{API}/public/smm/catalog?limit=3", timeout=30)
        assert r.status_code == 200
        body = r.json()
        for k in ("rows", "platforms", "platform_counts", "categories",
                  "markup_percent", "min_order_inr", "inr_rate"):
            assert k in body, f"missing key: {k}"
        assert isinstance(body["platform_counts"], dict)
        assert isinstance(body["categories"], list)
        # markup default 40
        assert body["markup_percent"] >= 0

    def test_filter_platform_instagram(self):
        r = requests.get(f"{API}/public/smm/catalog?platform=instagram", timeout=30)
        assert r.status_code == 200
        rows = r.json()["rows"]
        if rows:
            for row in rows[:20]:
                assert row.get("platform", "").lower() == "instagram"

    def test_filter_q_followers(self):
        r = requests.get(f"{API}/public/smm/catalog?q=followers", timeout=30)
        assert r.status_code == 200
        rows = r.json()["rows"]
        if rows:
            blob = (rows[0].get("name", "") + rows[0].get("category", "") + rows[0].get("platform", "")).lower()
            assert "followers" in blob

    def test_filter_category(self):
        r = requests.get(f"{API}/public/smm/catalog?category=likes", timeout=30)
        assert r.status_code == 200
        for row in r.json()["rows"][:10]:
            assert "likes" in row.get("category", "").lower()

    def test_cached_flag_on_second_call(self):
        # First call may be cached already from earlier requests — request fresh once then verify cache.
        requests.get(f"{API}/public/smm/catalog?refresh=1&limit=2", timeout=30)
        r2 = requests.get(f"{API}/public/smm/catalog?limit=2", timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("cached") is True


# ---------- quote ----------
class TestPublicQuote:
    def test_quote_404_unknown_service(self):
        r = requests.post(f"{API}/public/smm/quote", json={
            "smm_service_id": 999999999, "quantity": 100, "link": "x"
        }, timeout=15)
        assert r.status_code == 404, r.text

    def test_quote_400_below_min(self, first_row):
        r = requests.post(f"{API}/public/smm/quote", json={
            "smm_service_id": first_row["id"], "quantity": max(first_row["min"] - 1, 0), "link": "x"
        }, timeout=15)
        assert r.status_code == 400

    def test_quote_400_above_max(self, first_row):
        r = requests.post(f"{API}/public/smm/quote", json={
            "smm_service_id": first_row["id"], "quantity": int(first_row["max"]) + 1, "link": "x"
        }, timeout=15)
        assert r.status_code == 400

    def test_quote_applies_min_order_floor(self, first_row):
        r = requests.post(f"{API}/public/smm/quote", json={
            "smm_service_id": first_row["id"], "quantity": first_row["min"], "link": "x"
        }, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["charge_inr"] >= body["min_order_inr"]
        assert body["service"]["id"] == first_row["id"]


# ---------- service lookup ----------
class TestPublicServiceLookup:
    def test_service_lookup_404(self):
        r = requests.get(f"{API}/public/smm/service/999999999", timeout=15)
        assert r.status_code == 404


# ---------- order ----------
class TestPublicOrder:
    def test_order_missing_email_400(self, first_row):
        r = requests.post(f"{API}/public/smm/order", json={
            "smm_service_id": first_row["id"], "quantity": first_row["min"], "link": "https://x.test/y"
        }, timeout=20)
        assert r.status_code == 400

    def test_order_persists_smm_fields(self, first_row):
        payload = {
            "smm_service_id": first_row["id"],
            "quantity": first_row["min"],
            "link": "https://example.com/TEST_iter15",
            "email": "TEST_iter15@smoke.com",
            "name": "TEST_iter15",
        }
        r = requests.post(f"{API}/public/smm/order", json=payload, timeout=30)
        assert r.status_code == 200
        body = r.json()
        order = body["order"]
        assert order["id"].startswith("ORD-")
        assert body["redirect"] == f"/track?id={order['id']}&pay=1"
        # GET full doc and assert fields
        g = requests.get(f"{API}/orders/{order['id']}", timeout=15)
        assert g.status_code == 200
        doc = g.json()
        assert doc["smm_service_id"] == first_row["id"]
        assert int(doc["smm_quantity"]) == int(first_row["min"])
        assert doc["payment_amount"] == order["amount"]
        assert doc.get("currency") == "INR"
        assert doc.get("target") == payload["link"]
        assert str(doc.get("size")) == str(payload["quantity"])
        assert doc.get("source") == "public_smm_form"
        assert "smm_cost_usd_per_1000" in doc
        # Stash for the smm-place test
        pytest.shared_order_id = order["id"]


# ---------- admin config ----------
class TestAdminConfig:
    def test_put_config_accepts_new_fields_and_refresh_reflects(self, admin_token):
        # snapshot current
        cur = requests.get(f"{API}/admin/smm/config",
                           headers={"X-Admin-Token": admin_token}, timeout=15).json()
        orig_markup = float(cur.get("markup_percent") or 40)
        orig_min = float(cur.get("min_order_inr") or 10)
        try:
            new_markup = orig_markup + 5.0
            new_min = orig_min + 1.0
            r = requests.put(f"{API}/admin/smm/config",
                             headers={"X-Admin-Token": admin_token},
                             json={"markup_percent": new_markup, "min_order_inr": new_min},
                             timeout=15)
            assert r.status_code == 200, r.text
            updated = r.json()
            assert float(updated["markup_percent"]) == new_markup
            assert float(updated["min_order_inr"]) == new_min
            # Refresh public catalog and confirm new markup_percent is reflected
            cat = requests.get(f"{API}/public/smm/catalog?refresh=1&limit=3", timeout=30).json()
            assert float(cat["markup_percent"]) == new_markup
            assert float(cat["min_order_inr"]) == new_min
        finally:
            # restore
            requests.put(f"{API}/admin/smm/config",
                         headers={"X-Admin-Token": admin_token},
                         json={"markup_percent": orig_markup, "min_order_inr": orig_min}, timeout=15)
            requests.get(f"{API}/public/smm/catalog?refresh=1&limit=1", timeout=30)


# ---------- admin smm-place (bug-fix regression) ----------
class TestSmmPlaceBugfix:
    def test_smm_place_uses_smm_service_id_no_nameerror(self, admin_token, first_row):
        # Create a fresh public order
        payload = {
            "smm_service_id": first_row["id"],
            "quantity": first_row["min"],
            "link": "https://example.com/TEST_iter15_place",
            "email": "TEST_iter15_place@smoke.com",
            "name": "TEST_iter15_place",
        }
        r = requests.post(f"{API}/public/smm/order", json=payload, timeout=30)
        assert r.status_code == 200
        order_id = r.json()["order"]["id"]

        pl = requests.post(f"{API}/admin/orders/{order_id}/smm-place",
                           headers={"X-Admin-Token": admin_token}, timeout=30)
        # Should not 500 with NameError. Either 200 with smm_error (panel $0)
        # or 200 with ok:true (if panel funds). Anything except 500 is acceptable.
        assert pl.status_code == 200, pl.text
        body = pl.json()
        assert "order" in body
        # When panel has $0, smm_error should be set; when it succeeds, ok=True.
        if not body.get("ok"):
            assert body["order"].get("smm_error"), "smm_error must be populated on failure"
            # NameError would surface as a generic exception message with "service_doc"
            assert "service_doc" not in str(body["order"].get("smm_error", "")).lower()
