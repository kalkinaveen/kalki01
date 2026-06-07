# ERRORHACKER — PRD

## Original Problem Statement
Hacker-themed marketplace (books, services, memberships, recovery) with admin CMS, auth, cart, order tracking, payments, Instagram-style feed, referrals, Google Analytics. Now adding wallet/spin/social-proof for engagement.

## Stack
- Frontend: React + TailwindCSS + shadcn/ui
- Backend: FastAPI + Motor (MongoDB) + GridFS + PyJWT
- Telegram bot (customer-facing webhook + admin alerts)
- Live at: https://errorhacker.site (preview: emergent preview URL)

## Implemented (Feb–Jun 2026 CHANGELOG)
- 2026-02 → mobile fixes, Instagram-style feed, iOS video, HTTP 206 streaming
- 2026-02 → Account Recovery (3-step wizard, file upload, dashboard, admin manager)
- 2026-02 → Feed Moderator role
- 2026-02 → Customer review submission on recovery (admin approval)
- 2026-02 → Service tile typography bump for mobile
- 2026-05 → "Send Payment Request" admin action (auto-creates linked order)
- 2026-05 → Forward-only auto-bump: order status → linked recovery case status
- 2026-05 → Favicon set (16/32/192/512/apple-touch)
- 2026-05 → Telegram URL config respected on "CONTACT TEAM" button
- 2026-06 → **Customer Telegram Bot** (webhook mode):
  - Commands: /start, /track, /orders, /pay, /recover, /help
  - Inline keyboards + callback queries
  - Account ↔ Telegram link flow via 6-digit deep-link code
  - Auto DM to customer on order/case status change
  - Admin Webpanel → Notifications → Customer Bot panel (enable/disable, welcome, command toggles, broadcast, linked-users table)
- 2026-06 → "Connect Telegram" CTA inside `/track` (logged-in card + anon sign-in nudge)
- 2026-06 → **💰 Wallet system**:
  - `/me/wallet` page (balance, top-up flow with UPI/Crypto, transaction history)
  - Manual deposit → admin approval → auto-credit + customer Telegram DM
  - Admin endpoints for adjust, list, approve/reject deposits
- 2026-06 → **🎰 Spin Wheel** (`/me/spin`):
  - 8-slice animated conic-gradient wheel (₹5 → ₹500 jackpot, "Try Again")
  - 24h cooldown, weighted server-side prize pick, auto-credit to wallet
  - Live countdown when on cooldown, admin can edit prizes/cooldown via `/admin/spin/config`
- 2026-06 → **⚡ Live Order Ticker**: green marquee under main marquee, masked recent orders + recovered cases ("B••P recovered Instagram · 8d ago"), auto-refresh 30s
- 2026-06 → Navbar wallet pill (₹balance) + spin link in user dropdown

## Key Endpoints (latest additions)
- `GET/POST /api/me/wallet`, `GET /api/me/wallet/transactions`, `POST /api/me/wallet/deposit`
- `GET/POST/POST /api/admin/wallet/deposits[?status=pending]`, `/{id}/approve`, `/{id}/reject`
- `POST /api/admin/wallet/{user_id}/adjust`, `GET /api/admin/wallets`
- `GET /api/spin/config`, `PUT /api/admin/spin/config`
- `GET /api/me/spin/status`, `POST /api/me/spin/spin`
- `GET /api/feed-ticker` (public, masked names)
- `POST /api/telegram/webhook/{secret}` (Telegram-only)
- `GET/PUT /api/admin/telegram/bot`, `POST /api/admin/telegram/bot/enable|disable|broadcast`, `GET /api/admin/telegram/bot/users`
- `GET /api/me/telegram/status`, `POST /api/me/telegram/link-code`, `DELETE /api/me/telegram/unlink`

## DB Collections (latest additions)
- `wallets` (user_id, balance, currency, createdAt, updated_at)
- `wallet_txns` (id, user_id, type: credit|debit|spin|cashback|refund, amount, balance_after, note, ref, createdAt)
- `wallet_deposits` (id, user_id, amount, method, coin, tx_reference, proof_url, status: pending|approved|rejected, createdAt)
- `spin_history` (user_id, prize_id, label, type, amount, spun_at)
- `telegram_link_codes` (code, user_id, expires_at)

## Backlog

### P0
- Razorpay integration (auto-credit wallet on deposit, replaces manual approval) — user wanted
- Resend integration (email receipts, status updates, recovery confirmations) — user wanted

### P1
- VIP Tier system (Bronze → Diamond by spend, cashback %)
- Cashback on orders to wallet
- Wallet-based order checkout (auto-deduct on place order)
- Stripe alongside Razorpay
- Multi-currency UI hookup

### P2
- 30-day auto-purge trashed feed posts
- Hall of Fame leaderboard
- Achievement badges
- PWA / add-to-home-screen
- Admin 2FA
- Streak multipliers on spin wheel (Day 7 = bigger prizes)
- Auto-suggest "leave a review" Telegram nudge on case recovered

## Critical Notes
- Preview vs Production: deploy URL is `errorhacker.site` — user must hit Deploy after each session
- DO NOT refactor `FeedPage.jsx` autoplay/unmute logic (iOS/Brave tuned)
- All credentials from `.env` (REACT_APP_BACKEND_URL, MONGO_URL, DB_NAME)
- Telegram bot uses webhook mode (zero polling); webhook secret stored in DB, validated on every Telegram POST
