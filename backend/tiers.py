"""
ERRORHACKER — OPERATIVE PASS tier definitions.

The single source of truth for the 4-tier priority membership.
Frontend reads this via GET /api/subscription/tiers; backend uses it
to multiply AI quotas, discount SMM, and sort the recovery queue.

Activation today is wallet-debit (one-shot 30-day pass). Cashfree direct
subscription tokens are a future enhancement.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

# Order matters — higher index = higher priority. The first entry is the
# implicit default for every new user (no subscription required).
TIERS: List[Dict[str, Any]] = [
    {
        "id": "rookie",
        "rank": 0,
        "name": "Rookie",
        "tagline": "Where every operator starts.",
        "price_inr": 0,
        "color": "#9ca3af",
        "accent": "#9ca3af",
        "icon": "user",
        "tool_uses_per_day": 3,
        "recovery_sla_hours": 24,
        "smm_discount_pct": 0,
        "perks": [
            "3 free AI tool uses / day",
            "24h recovery review",
            "Daily spin for free wallet credit",
            "Access to the public ebook library",
        ],
    },
    {
        "id": "operative",
        "rank": 1,
        "name": "Operative",
        "tagline": "Free is good. Priority is better.",
        "price_inr": 299,
        "color": "#4de0ff",
        "accent": "#4de0ff",
        "icon": "shield",
        "tool_uses_per_day": 8,
        "recovery_sla_hours": 12,
        "smm_discount_pct": 5,
        "perks": [
            "8 free AI tool uses / day",
            "12h recovery review · priority queue",
            "5% discount on every SMM order",
            "1 daily mission for bonus wallet credit",
            "Animated tier badge next to your name",
        ],
    },
    {
        "id": "shadow",
        "rank": 2,
        "name": "Shadow",
        "tagline": "Some operators wait. You don't.",
        "price_inr": 799,
        "color": "#ffd34d",
        "accent": "#ffd34d",
        "icon": "crown",
        "tool_uses_per_day": 20,
        "recovery_sla_hours": 3,
        "smm_discount_pct": 10,
        "perks": [
            "20 free AI tool uses / day",
            "3h recovery review · top of queue",
            "10% discount on every SMM order",
            "3 daily missions",
            "Full ebook library unlocked",
            "Private Telegram channel access",
        ],
    },
    {
        "id": "ghost",
        "rank": 3,
        "name": "Ghost",
        "tagline": "The line doesn't apply to you.",
        "price_inr": 1999,
        "color": "#ff2d92",
        "accent": "#ff2d92",
        "icon": "flame",
        "tool_uses_per_day": 999,
        "recovery_sla_hours": 0,   # "instant" — pinged in real time
        "smm_discount_pct": 15,
        "perks": [
            "Unlimited AI tool uses",
            "Instant recovery — real engineer DMs you",
            "15% discount on every SMM order",
            "All missions, every day",
            "Lifetime ebook library",
            "Monthly AMA with the team",
            "Leaderboard slot for the year",
        ],
    },
]

TIER_BY_ID = {t["id"]: t for t in TIERS}


def get_tier(tier_id: str | None) -> Dict[str, Any]:
    """Resolve a tier id (or None / unknown) to a tier definition.
    Defaults to ROOKIE so consumers can always trust the result."""
    return TIER_BY_ID.get((tier_id or "").lower(), TIERS[0])


def user_tier(user_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Returns the *effective* tier for a user — honors expiry.
    Falls back to Rookie if the subscription has expired or is missing."""
    sub = (user_doc or {}).get("subscription") or {}
    if not sub.get("active"):
        return TIERS[0]
    # Check expiry
    expires = sub.get("expires_at")
    if expires:
        try:
            exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if exp_dt < datetime.now(timezone.utc):
                return TIERS[0]
        except Exception:
            pass
    return get_tier(sub.get("tier_id"))


def build_subscription_record(tier_id: str, amount_paid: int, days: int = 30) -> Dict[str, Any]:
    """Create the subscription sub-document we attach to the user.
    Renew == replace this record on every successful payment."""
    now = datetime.now(timezone.utc)
    return {
        "tier_id": tier_id,
        "active": True,
        "started_at": now.isoformat(),
        "expires_at": (now + timedelta(days=days)).isoformat(),
        "amount_paid_inr": amount_paid,
        "auto_renew": False,
        "history": [],  # filled by the payment route on each renewal
    }
