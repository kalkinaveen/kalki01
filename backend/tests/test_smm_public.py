"""Regression tests for the public SMM catalog + order flow.

Run with: cd /app/backend && pytest tests/test_smm_public.py -v
Requires backend to be running.
"""
from __future__ import annotations
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"


def _first_catalog_row():
    r = requests.get(f"{API}/public/smm/catalog?limit=5", timeout=30)
    assert r.status_code == 200, r.text
    rows = r.json().get("rows") or []
    if not rows:
        pytest.skip("Panel returned an empty catalog — skip live integration tests")
    return rows[0]


def test_public_catalog_returns_inr_with_markup():
    r = requests.get(f"{API}/public/smm/catalog?limit=5", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "rows" in data
    assert data["markup_percent"] > 0, "markup must be > 0"
    assert "platforms" in data
    if data["rows"]:
        sample = data["rows"][0]
        assert "rate_inr_per_1000" in sample
        assert "cost_usd_per_1000" in sample
        if sample["cost_usd_per_1000"] > 0:
            assert sample["rate_inr_per_1000"] >= sample["cost_usd_per_1000"] * 80


def test_public_quote_rejects_invalid_qty():
    row = _first_catalog_row()
    r = requests.post(f"{API}/public/smm/quote", json={
        "smm_service_id": row["id"],
        "quantity": max(row["min"] - 1, 0),
        "link": "test",
    }, timeout=30)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_public_order_creates_order_with_smm_binding():
    row = _first_catalog_row()
    r = requests.post(f"{API}/public/smm/order", json={
        "smm_service_id": row["id"],
        "quantity": row["min"],
        "link": "https://example.com/test",
        "email": "pytest@smoke.com",
        "name": "pytest",
    }, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    order = body["order"]
    assert order["id"].startswith("ORD-")
    assert order["smm_service_id"] == row["id"]
    assert order["status"] == "received"
    assert order["amount"] > 0
    assert body["redirect"].startswith(f"/track?id={order['id']}")

    r2 = requests.get(f"{API}/orders/{order['id']}", timeout=30)
    assert r2.status_code == 200
    assert r2.json()["smm_service_id"] == row["id"]


def test_public_order_requires_email():
    row = _first_catalog_row()
    r = requests.post(f"{API}/public/smm/order", json={
        "smm_service_id": row["id"],
        "quantity": row["min"],
        "link": "https://example.com/test",
    }, timeout=30)
    assert r.status_code == 400, f"Expected 400 for missing email, got {r.status_code}"


def test_public_service_lookup_returns_row():
    row = _first_catalog_row()
    r = requests.get(f"{API}/public/smm/service/{row['id']}", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["service"]["id"] == row["id"]
    assert data["min_order_inr"] >= 0
