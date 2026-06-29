# ERRORHACKER — PRD

## Original Problem Statement
Hacker-themed marketplace (books, services, memberships, recovery) with admin CMS, auth, cart, order tracking, payments, IG-style feed, referrals, GA4.

## Stack
- Frontend: React + TailwindCSS + shadcn/ui (Space Grotesk display, Inter body, JetBrains Mono)
- Backend: FastAPI + Motor (MongoDB) + GridFS + PyJWT
- Telegram bot (webhook customer-facing + admin alerts)
- **Resend** email service (domain `errorhacker.site` verified)
- Live at: https://errorhacker.site

## Implemented (recent)
- **Iter-9 · Cashfree LIVE PG + Tools Auto-TopUp + Public Refund Tracking** 🚀
  - **Cashfree Payments PG v3 (LIVE production)** integrated end-to-end:
    - Hosted checkout for wallet top-ups (`POST /api/me/wallet/topup/cashfree`) and direct order payments (`POST /api/me/orders/{id}/pay/cashfree`)
    - Webhook signature verification (HMAC-SHA256, base64) + idempotent atomic reconcile
    - Polling-based `/payments/return` page that auto-redirects on `PAID`
    - Deterministic `x-idempotency-key` derived from order_id (network retries no longer double-create)
    - Webhook returns 202 on transient reconcile failures so Cashfree redelivers
    - LIVE keys stored in `backend/.env` · merchant must whitelist deployed domain at `merchant.cashfree.com → developers → whitelist` for the SDK redirect to render (purely a dashboard step, not a code task)
  - **Embedded Cashfree top-up modal** (`<CashfreeTopupModal />`) — quick-amount chips + custom amount, opens hosted checkout in same tab. Used in:
    - `/me/wallet` as a primary cyber-mono "Add Money" CTA above the manual UPI/Crypto fallback
    - `LimitReachedDialog` when tools run out of balance — users top up inline and resume the tool without leaving the page
  - **Public refund tracking** — `/track` page now accepts `RFD-XXXXXXXX` alongside `ORD-` / `REC-`. Refund view renders the same stage-dot timeline + glow style as the order/recovery tracker (the visual the user said he loves) — using the existing `TraceStageIcon` component for perfect parity.
  - 16/16 backend pytest + 100% critical frontend flows verified by testing agent (iter-9). Only "issue" is merchant-dashboard domain whitelisting.
- **Iter-8 · Wallet Pay-with-One-Tap + Refund System + Spin Editor** 🎯
  - **Spin Wheel Admin Editor** — full ladder editor in `/admin → Spin Wheel`: add/remove prizes, set label/type/amount/weight/color, live-odds % column, expected-payout calculator. Backed by hardened `PUT /admin/spin/config` (auto-defaults missing weights to 1).
  - **Pay-with-Wallet One-Tap** — new `POST /api/me/orders/{id}/pay-with-wallet` (atomic debit → mark verified → email receipt → TG alert). Cart shows a wallet pill + `PAY ₹X INSTANTLY (WALLET)` primary CTA when balance covers total; otherwise prominent `TOP UP TO PAY INSTANTLY` button. OrderDetail page surfaces a large `WALLET CHECKOUT` panel for unpaid orders.
  - **Refund Tracking System** end-to-end:
    - Customer requests via "Request Refund" modal on any paid OrderDetail
    - Live tracker at `/refund/{RFD-id}` with stage timeline (REQUESTED → REVIEWING → APPROVED → COMPLETED, or REJECTED branch)
    - Admin manager at `/admin → Refunds` with status filter, detail drawer, one-click approve (instant wallet credit via `_wallet_txn` type='refund'), reject with reason
    - Public PII-safe track endpoint for shareable links
    - Telegram bot `/refund RFD-XXX` command + automatic admin-chat alert on new refund
  - Mobile fits: cart, order detail, refund tracker, wallet pay panel all responsive (sm:/md: breakpoints, `min-w-0` truncation, mobile dual-row CTAs).
  - 23/23 backend pytest + 5/5 critical frontend flows confirmed by testing agent (no bugs, 2 hardening tips applied).
- **Telegram Bot Cyber-Mono Refresh (Iter-7)** ⚡
  - Replaced every emoji across welcome, /menu, /pay, /help, /track, /orders, /breach, /phishing, /odds, /quote, /wallet, /spin, /news, /refer, /ai, /cancel and all inline button labels with a tight cyber palette: `⚡ ◆ ▰ ▸ ❯ ❮ ⬢ ⬡ ◈ ✦ ✕ ✓ ⌬ ⟶ ↻ ▌ ⇡ ⇣ ● ◐ ○ ◉`.
  - Added a consistent `━━━━━━━━━━━━━━━` section divider + structured `<b>▸ field</b>` rows for a terminal/elite look.
  - Rewrote the deposit admin alert + user-DM (approved/declined) using the same palette.
  - Reset stored welcome_message + payment_info heading + instructions to the new defaults so the user sees the new look immediately. Admin can still re-customize from the panel any time.
  - Bonus fix: removed a duplicate `p.on_event("shutdown")` typo (pre-existing) that was blocking backend startup on reload.
- **Wallet Deposit Telegram Approval Flow + Receipt UI/Emails (Iter-7)** 🎯
  - Admin webpanel → Notifications tab now includes 3 new sections under the Telegram Bot:
    1. **Admin Chats** — managed list of TG chat IDs that receive the inline `✅ Approve & Credit / ❌ Decline` buttons whenever a customer submits a wallet deposit. "Ping All" test action verifies setup.
    2. **Bot Payment Info** — fully customizable `/pay` block sent by the bot (heading, intro, UPI ID + name, multiple crypto wallets, HTML instructions w/ `{amount}` `{order_id}` placeholders, per-button labels + URLs for Paid/Quote/Support). "Preview in TG" button sends a live preview to the first admin chat.
    3. **Wallet Deposits Manager** — pending/approved/rejected table with one-click Approve (credits wallet via shared `_wallet_txn`) and Reject (with optional reason → user is DMed via bot).
  - Telegram bot inline `dep_approve_{id}` / `dep_decline_{id}` callbacks call the same shared `_approve_deposit_internal` / `_reject_deposit_internal` so web-approval and TG-approval are 100% consistent.
  - On approval the user gets BOTH the existing wallet-credited email AND a new printable **receipt email** with all txn details + a deep link to the on-site Receipt page.
  - New `/receipt/:txn_id` printable page (`<Receipt />`) — brand header, big amount hero, full transaction details, PRINT / SAVE PDF button, auth-required (proxy 404 for cross-user IDs).
  - `MyWallet` transaction rows are now clickable Link cards → open the receipt.
  - 18/18 pytest suite at `/app/backend/tests/test_wallet_deposit_receipt.py`.
- **AI Tools Rate-Limit + Wallet Auto-Recharge** ⚡
  - Daily free quota per IP (anonymous) / per user_id (logged-in): breach 5/day · phishing 3/day · appeal 2/day · faq 15/day. Rule-based tools (odds, account-worth, selfie, security-score, diagnose) stay UNMETERED.
  - When the free quota is exhausted, logged-in users with sufficient wallet balance get **auto-debited** at the per-tool cost (₹10 / ₹15 / ₹49 / ₹3) — no manual top-up needed, no separate purchase flow.
  - Anonymous / low-balance users receive a structured **429** that the frontend renders as `<LimitReachedDialog>` with `Sign in` or `Top up wallet` CTAs.
  - `<ToolsUsageBar>` widget on every metered tool page shows `FREE TODAY · N/M` + wallet cost; updates live after every call.
  - **Race-safe** via atomic Mongo `find_one_and_update` (filter-on-balance for wallet debits, increment-then-evaluate-with-rollback for usage counts). Verified with 10-parallel-request burst — exactly N succeed, N+ fail. Atomic wallet debit guarantees a user with ₹10 can never have two concurrent ₹10 calls succeed.
  - Admin bypass via `X-Admin-Token` header matching the `ADMIN_TOKEN` env value.
  - New collection `tools_usage` (auto-rolls per UTC day · indexed by {user_id|ip, tool, date}).
  - 17/17 pytest cases at `/app/backend/tests/test_tools_rate_limit.py`.
- **AI Tools Hub (`/tools`) — 9 free tools** in animated 3-column tile grid (Space Grotesk + neon green) + global safety banner:
  1. **Issue Checker** (`/tools/diagnose`) — 5-dropdown rule-based Instagram diagnosis.
  2. **Breach Checker** (`/tools/breach`) — XposedOrNot free API; exposure score + breach list.
  3. **Recovery Odds Calculator** (`/tools/odds`) — self vs pro-assisted odds + day-range estimate.
  4. **Phishing/Smishing Detector** (`/tools/phishing`) — Claude Sonnet 4.5 strict-JSON risk analysis.
  5. **Appeal Generator** (`/tools/appeal`) — Claude Sonnet 4.5 writes a polite, platform-ready letter.
  6. **Security Score** (`/tools/security-score`) — 6-question audit → animated score ring.
  7. **Account Worth Estimator** (`/tools/account-worth`) — per-post + market value (INR/USD), Web-Share API.
  8. **Selfie Prep Coach** (`/tools/selfie-coach`) — rates camera setup before Instagram video verification.
  9. **AI FAQ Assistant** — Claude Haiku 4.5 floating chatbot bubble.
- **SafetyTipsCard** component — every tool ships with built-in safety/precaution tips (warn / info / ok variants).
- **FloatingStack** — single fixed bottom-right cluster (AI chat → Mail → Telegram); fixed mobile overlap.
- **Admin Broadcast Center** (`/admin → Broadcast`) — create announcement, **audience preview** (total + TG-reachable + email-reachable) before the blast; blast runs as a **background task** so the response is instant; email-opt-out users skipped; ledger of TG/email sent vs failed per announcement; auto-marks tool as NEW.
- **Telegram Customer Bot — Major Upgrade ✨**
  - `/menu` rich inline-button hub (Recovery · Order · Wallet · Spin · Breach · Phishing · Odds · Quote · News · Refer · Ask AI · Help)
  - `/breach <email>` — XposedOrNot scan inside chat with safety steps
  - `/odds` — interactive 3-step recovery-odds calculator
  - `/phishing` — forward suspicious text → Claude Sonnet 4.5 strict-JSON verdict
  - `/quote` — interactive 3-step instant price quote
  - `/wallet` — balance + last 5 transactions
  - `/spin` — daily wheel · auto-credits wallet · idempotent per UTC day
  - `/news` — latest 3 announcements from Broadcast Center
  - `/refer` — personal referral link + counter (auto-generates `referral_code`)
  - 🤖 **AI Free-Chat fallback** — any non-command message routes to Claude Haiku 4.5; rate-limited **10 msgs/chat/day** in `tg_ai_quota`
  - `/cancel` to abort multi-step flows; state stored in new `tg_state` collection
  - Pytest at `/app/backend/tests/test_tg_bot_upgrade.py` — 23/23 green
- Customer Telegram bot (webhook, /track /pay /recover /help, account linking)
- Wallet · daily Spin · live ticker
- "Works With" admin-managed brand marquee
- Recovery flow: 17 services, animated brand tiles, price pills, inline NEXT, premium tag badges (PREMIUM/HOT/NEW/BESTSELLER/LIMITED/FAST/SECURE)
- Service ↔ platform smart filter in Step 2
- Public reviews open to anyone; chat-bubble carousel with proof media + anti-copy watermark
- Mobile-tight Recovery flow
- Brand watermark inline with @errorhacker on reels
- Animated case-trace timeline (radar + sparkles + flowing connector)
- **Resend transactional emails** (case received, status changes, quote sent, order updates, wallet deposit approved) — domain `errorhacker.site` verified, sender `team@errorhacker.site`

## Backlog
- Race-condition guard on `_approve_deposit_internal` (use atomic `findOneAndUpdate({id,status:'pending'},{$set:{status:'approved'}})` so two parallel approves can't double-credit).
- Move `reject` reason from query param to JSON body for consistency.
- Mobile audit pass on Wallet, Transactions, Receipt, Tools Hub, Order Tracker.
- 5 more roadmapped tools: Banned-Hashtag Checker, Bio/Caption Policy Checker, DMCA Takedown Generator, Cease-and-Desist Generator, Impersonator Hunter (interactive flow)
- Stripe payment gateway (alongside Razorpay)
- Multi-currency UI auto-switch (backend supports it)
- Feed moderator "Hide/Trash" UI (delete → hide for `feed_mod` role)
- 30-day auto-purge trashed feed posts (cron)
- Refactor: split `server.py` (~3,400 lines) into `routes/auth.py`, `routes/recovery.py`, `routes/wallet.py`, `routes/tools.py`, `routes/announcements.py`, `routes/feed.py`
- DRY the LLM bootstrap (extract `get_llm_chat()` helper — duplicated across appeal/faq/phishing endpoints)
- IP/session rate-limit on `/api/tools/*` to guard Emergent LLM key budget
- Email opt-out toggle on user profile (currently `email_optout=true` field respected but no UI yet)
- Customer-facing "What's new?" feed showing latest announcements (public GET endpoint already exists)
- Razorpay auto-credit wallet on deposit
- WhatsApp Business notifications (Twilio or Meta)
- VIP tiers / cashback on orders
- Leaderboard / achievements / streak multipliers on spin
- PWA / add-to-home-screen
- Admin 2FA login
- Honeypot + rate-limit on public review form

## Critical Notes
- `RESEND_API_KEY`, `SENDER_EMAIL=team@errorhacker.site`, `SENDER_NAME=ERRORHACKER` set in `/app/backend/.env`
- All emails fire via `asyncio.create_task(...)` from server.py hooks — never block API responses
- DO NOT refactor `FeedPage.jsx` autoplay logic (iOS/Brave tuned)
- Preview vs Production: errorhacker.site is the production deploy
