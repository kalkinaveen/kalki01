"""
Iteration 25 — /api/whats-new public + admin CRUD endpoints

Coverage:
 - GET /api/whats-new returns 5 seeded items (first call & idempotent)
 - Admin endpoints require X-Admin-Token (401/403 without)
 - POST/PUT/DELETE admin CRUD lifecycle
 - active=false hides from public feed
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://functionality-139.preview.emergentagent.com").rstrip("/")
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"X-Admin-Token": admin_token, "Content-Type": "application/json"}


# ----- public feed -----
class TestWhatsNewPublic:
    def test_public_feed_returns_items(self):
        r = requests.get(f"{BASE_URL}/api/whats-new", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        items = data["items"]
        assert isinstance(items, list)
        assert len(items) >= 5, f"expected >=5 seeded posts, got {len(items)}"

    def test_each_item_has_required_fields(self):
        r = requests.get(f"{BASE_URL}/api/whats-new", timeout=15)
        items = r.json()["items"]
        required = {"id", "title", "body", "tag", "color", "link", "sort", "active", "created_at"}
        for it in items:
            missing = required - set(it.keys())
            assert not missing, f"item {it.get('id')} missing fields: {missing}"

    def test_seeded_ids_present(self):
        r = requests.get(f"{BASE_URL}/api/whats-new", timeout=15)
        ids = {it["id"] for it in r.json()["items"]}
        for expected_id in ("wn-smm-launch", "wn-tools-9", "wn-recovery-rate", "wn-mobile-redesign", "wn-membership-off"):
            assert expected_id in ids, f"missing seeded id: {expected_id}"

    def test_no_duplicate_seeding_on_subsequent_calls(self):
        a = requests.get(f"{BASE_URL}/api/whats-new", timeout=15).json()["items"]
        b = requests.get(f"{BASE_URL}/api/whats-new", timeout=15).json()["items"]
        # Same set of seeded IDs (filter out anything dynamic from this test run)
        ids_a = sorted([i["id"] for i in a if i["id"].startswith("wn-")])
        ids_b = sorted([i["id"] for i in b if i["id"].startswith("wn-")])
        assert ids_a == ids_b


# ----- admin auth gate -----
class TestWhatsNewAdminAuth:
    def test_admin_list_requires_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/whats-new", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_admin_create_requires_token(self):
        r = requests.post(f"{BASE_URL}/api/admin/whats-new", json={"title": "x", "body": "y"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_update_requires_token(self):
        r = requests.put(f"{BASE_URL}/api/admin/whats-new/wn-smm-launch", json={"title": "x", "body": "y"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_delete_requires_token(self):
        r = requests.delete(f"{BASE_URL}/api/admin/whats-new/wn-smm-launch", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_list_with_token(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/whats-new", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 5


# ----- admin CRUD lifecycle -----
class TestWhatsNewCRUD:
    def test_create_update_active_toggle_delete(self, admin_headers):
        # CREATE
        payload = {
            "title": "TEST_iter25_entry",
            "body": "test body content",
            "tag": "TEST",
            "color": "#abcdef",
            "link": "/test",
            "sort": 999,
            "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/admin/whats-new", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
        created = r.json()
        assert created["title"] == payload["title"]
        assert created["active"] is True
        assert created["id"].startswith("wn-")
        wid = created["id"]

        # VERIFY in public (active=True)
        pub = requests.get(f"{BASE_URL}/api/whats-new", timeout=15).json()["items"]
        assert any(it["id"] == wid for it in pub), "new active entry should appear in public feed"

        # UPDATE → active=False
        upd_payload = {**payload, "title": "TEST_iter25_updated", "active": False}
        r = requests.put(f"{BASE_URL}/api/admin/whats-new/{wid}", headers=admin_headers, json=upd_payload, timeout=15)
        assert r.status_code == 200
        updated = r.json()
        assert updated["title"] == "TEST_iter25_updated"
        assert updated["active"] is False

        # VERIFY hidden from public feed
        pub2 = requests.get(f"{BASE_URL}/api/whats-new", timeout=15).json()["items"]
        assert not any(it["id"] == wid for it in pub2), "inactive entry must be hidden from public feed"

        # VERIFY visible in admin list
        adm = requests.get(f"{BASE_URL}/api/admin/whats-new", headers=admin_headers, timeout=15).json()["items"]
        assert any(it["id"] == wid for it in adm)

        # DELETE
        r = requests.delete(f"{BASE_URL}/api/admin/whats-new/{wid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # VERIFY removed
        adm2 = requests.get(f"{BASE_URL}/api/admin/whats-new", headers=admin_headers, timeout=15).json()["items"]
        assert not any(it["id"] == wid for it in adm2)

    def test_update_nonexistent_returns_404(self, admin_headers):
        r = requests.put(
            f"{BASE_URL}/api/admin/whats-new/wn-does-not-exist-xyz",
            headers=admin_headers,
            json={"title": "x", "body": "y"},
            timeout=15,
        )
        assert r.status_code == 404
