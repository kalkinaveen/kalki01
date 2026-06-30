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
- **Iter-31 · P1 Security Hardening · SEC-001 (bcrypt admin) + SEC-002 (CORS allow-list)** 🛡 (Feb 2026)
  - **SEC-001 — Admin password is now bcrypt-hashed** (`/app/backend/server.py`):
    - `_ensure_admin()` now seeds `password_hash` via bcrypt (`$2b$12$…`), and auto-migrates any legacy plaintext `password` field on first read — zero ops needed on existing installs.
    - `admin_login` uses `_verify_pw()` (bcrypt compare) and `admin_change_password` writes via `_hash_pw()`. Plaintext `password` field is `$unset` everywhere.
    - **Brute-force lockout**: per-IP throttle via `admin_login_attempts` collection. 5 failed logins → HTTP 429 for 15 min. Correct password is also blocked during lockout. Cleared on successful login.
    - **Password change** now requires ≥ 8 chars (up from 4) and invalidates all active admin tokens (forces re-login).
    - ENV `ADMIN_PASSWORD_FORCE=1` still works as a one-shot rotation gate.
  - **SEC-002 — CORS allow-list** (`/app/backend/server.py` final lines):
    - Replaced `allow_origin_regex=".*"` with explicit `allow_origins=[…]` parsed from comma-separated `CORS_ORIGINS` env.
    - Wildcards (`*`) are explicitly stripped — credentialed CORS now requires explicit origin matches.
    - `.env` `CORS_ORIGINS = https://errorhacker.site, https://www.errorhacker.site, https://functionality-139.preview.emergentagent.com, http://localhost:3000`
    - User JWT cookie kept at `secure=True, samesite=none` (correct posture for cross-domain prod deploy; Lax would break the cross-domain frontend ↔ backend setup).
  - **Verified by testing agent** (`/app/test_reports/iteration_21.json`): all 10 backend tests pass. Bcrypt hash present + plaintext gone on disk; brute-force at 5 fails returns 429; CORS echoes the allow-listed origin only for allowed origins. Customer auth + Iter-30 daily-missions anti-cheat regression checks both pass. Admin UI smoke test confirms /admin login → dashboard works end-to-end.
  - **Files**: `/app/backend/server.py`, `/app/backend/.env` (CORS_ORIGINS), `/app/auth_testing.md` (test playbook), `/app/memory/test_credentials.md` (updated for bcrypt note), `/app/backend/tests/test_iter31_sec_admin_cors.py` (regression suite).

- **Iter-30 · Daily Missions Anti-Cheat Fix** 🛡 (Feb 2026)
  - **Bug reported**: User noticed they could tap CLAIM on any daily mission and get credited without actually doing the action (refer a friend, place an SMM order, use a tool, spin the wheel). The old `/api/me/missions/claim` only checked "already claimed today".
  - **Root cause**: The endpoint never verified the mission was actually completed before crediting the wallet.
  - **Fix** (`/app/backend/server.py`):
    - Added a `verify` key to each entry in `_DAILY_MISSIONS` (`login` / `referral` / `smm_week` / `tool_today` / `spin_today`) plus a user-facing `hint`.
    - New helper `_mission_completed(uid, verify)` runs the appropriate DB check: `db.referrals.count`, `db.orders` with `smm_service_id` in the last 7 days, `db.tool_usage` today, `db.spin_history` today.
    - `GET /api/me/missions` now returns `completed` + `ready_to_claim` flags per mission.
    - `POST /api/me/missions/claim` now refuses the credit with HTTP 400 + the mission's hint when `_mission_completed` returns false.
  - **Frontend** (`/app/frontend/src/pages/MyAccount.jsx`):
    - Mission card now renders three states: ✓ CLAIMED (dimmed), CLAIM button (only when `ready_to_claim`), or a brand-coloured outline "GO" button (OPEN TOOLS / SPIN NOW / ORDER SMM / COPY REF LINK) that takes the user to the right action.
    - Hint text appears under the title for not-yet-completed missions so the user knows what to do.
  - **Verified end-to-end** via curl: refer_friend / run_tool / spin all returned HTTP 400 with the mission-specific hint; place_smm (user had prior SMM orders) returned 200 and credited ₹50. UI now shows COPY REF LINK / OPEN TOOLS / SPIN NOW as outline buttons instead of plain CLAIM.

- **Iter-29 · SMM Live-Charge Instant Update + MyWallet Multi-Color Redesign** 🎨 (Feb 2026)
  - **What you asked for**: (1) The SMM order page's "LIVE CHARGE" box lagged behind keystrokes — every digit typed waited on a 150ms-debounced server quote round-trip. (2) `MyWallet.jsx` looked too green-on-green; needed the same premium multi-color tile aesthetic used on MissionHub / AuthShell.
  - **Fix 1 — Instant client-side quote** (`/app/frontend/src/pages/OrderSmmPage.jsx`):
    - `renderedQuote` now uses the `instantQuote` useMemo unconditionally, so every quantity change recomputes synchronously (`rate × qty / 1000 × (1 - tierDiscount)` clamped to `min_order_inr`). The visible ₹ value updates in the same render frame as the keystroke.
    - The `/api/public/smm/quote` call still fires in the background (150ms debounce + AbortController) but now only refreshes `walletBalance`. It never overrides the visible charge, eliminating the stale-flicker.
    - Removed the now-dead `quote` state.
  - **Fix 2 — MyWallet redesign** (`/app/frontend/src/pages/MyWallet.jsx`, ~440 lines, full rewrite):
    - Hero grid: neon-green balance tile + yellow Daily Spin tile side-by-side.
    - 3-tile method picker: Cashfree (`#00ff9d`), Manual UPI/Bank (`#ff2d92`), Crypto (`#4de0ff`). Each tile transitions into a colour-matched form via a shared `activeColor` driving borders, quick-amount chips, and submit button.
    - Ambient gradient blobs (green/pink/cyan) for depth — same pattern as `AuthShell`.
    - Includes `wallet-method-back` to return to picker, `wallet-done-state` for post-submit success, and clean transactions list at the bottom.
  - **Verified by testing agent** (`/app/test_reports/iteration_20.json`): all 5 review items pass 100%. Typing `5000` shows ₹59.37 instantly; rapid retypes (`1000`→₹11.87, `100`→₹10) confirm no stale values. MyWallet testids all wired correctly; CashfreeTopupModal still opens; manual deposit success flow verified.

- **Iter-28 · Operative Pass Subscription + Wallet-Only SMM Flow** 👑 (Feb 2026)
  - **What you asked for**: a public, customer-facing place-order form so anyone can browse the 5800+ Peakerr services (priced in INR with the 40% markup already applied) and check out instantly without going through admin.
  - **Backend new endpoints** (in `/app/backend/routes/smm.py`):
    - `GET /api/public/smm/catalog?q=&platform=&category=&refresh=0` — returns rows with `rate_inr_per_1000`, `cost_usd_per_1000`, min/max, refill/dripfeed/cancel flags + `markup_percent`, `min_order_inr`, `platform_counts`. In-memory cached ~10min via `get_customer_catalog()`.
    - `GET /api/public/smm/service/{smm_id}` — single row lookup.
    - `POST /api/public/smm/quote` — returns live `charge_inr` for `{smm_service_id, quantity}` applying min-order floor; 400 for out-of-range qty.
    - `POST /api/public/smm/order` — creates a full app order pre-bound with `smm_service_id`, `smm_quantity`, `payment_amount` and returns `{redirect: '/track?id=ORD-XXX&pay=1'}`. Email required; user_id auto-attached if logged in. Source tag = `public_smm_form`. On Cashfree payment + admin verify, the existing `place_order_for_app_order()` pipeline fires automatically.
  - **Backend admin extras**: `SmmConfigIn` now accepts `markup_percent` + `min_order_inr` + `platforms_whitelist`. Admin SMM panel UI got matching `markup_percent` and `min_order_inr` inputs.
  - **Backend bug fix**: `smm_service.place_order_for_app_order` previously referenced an undefined `service_doc` variable (would crash with NameError on auto-place). Replaced with the already-resolved `smm_service_id` + `smm_price_usd_per_1000` locals.
  - **Frontend new page** `/app/frontend/src/pages/OrderSmmPage.jsx` (mounted at `/smm`):
    - Hero with live service count, premium tile theme, platform chips (Instagram/YouTube/TikTok/Telegram/Twitter-X/Facebook/Spotify) with per-platform counts and brand colors.
    - 200-result virtualized list of `ServiceCard` (name, category, REFILL/DRIP/CANCEL flags, min/max, big ₹/1k price).
    - Sticky right-side `OrderForm` (link + qty + live INR charge + email/telegram), color-tinted per selected platform, big PROCEED button that hits `/api/public/smm/order` and navigates to OrderTracker.
    - Mobile-first: chips horizontally scrollable, single-column cards, `overflow-x-hidden` + `min-w-0` constraints so nothing leaks past the viewport.
  - **Navbar**: new "SMM" entry between Services and Books, auto-injected for existing site_config docs.
  - **Regression tests**: 5 in `/app/backend/tests/test_smm_public.py` (catalog/quote/order/email-required/service-lookup) — all pass. Testing agent added 14 more in `test_iter15_smm_public_extra.py` covering markup PUT/refresh, cache flag, smm-place no-NameError, etc. Final score: **backend 19/19 · frontend 100% functional**.

- **Iter-23 · Peakerr SMM Auto-Placement Pipeline (INR)** 🤖 (Feb 2026)
  - **What you asked for**: full automation of the SMM order flow with Peakerr API key `…201f`, INR display, safer fraud-review trigger (auto-place only when admin marks `verified`).
  - **Backend new files**:
    - `/app/backend/smm_service.py` — generic SMM panel client (works with ANY standard SMM API — Peakerr, JAP, SMMRaja — they all share the same schema: POST `/api/v2` with `key/action/service/link/quantity`). Methods: `balance()`, `services()`, `add_order()`, `status()`, `multi_status()`. Plus orchestrators: `place_order_for_app_order()` (idempotent, records all failures to `smm_error` on the order), `poll_order_status()`, `refresh_balance()` (with low-threshold detection).
    - `/app/backend/routes/smm.py` — admin REST surface: `GET/PUT /admin/smm/config`, `GET /admin/smm/balance`, `GET /admin/smm/services?q=...&limit=`, `POST/DELETE /admin/services/{id}/smm-link`, `POST /admin/orders/{id}/smm-place`, `POST /admin/orders/{id}/smm-poll`.
  - **Backend integration**: hook in `PATCH /api/orders/{id}` — when admin sets `status=verified` AND `auto_place_on_verified` is on, async `place_order_for_app_order()` fires (isolated try/except so panel outages can't block status updates). New lifespan background loop polls all in-progress panel orders every 5min and auto-advances `verified → in-progress → delivered`. API key is stored encrypted; only the last 4 chars (`…201f`) are ever sent back to the client.
  - **Frontend new admin tab** (`/app/frontend/src/pages/admin/AdminSmmPanel.jsx` + sidebar link "SMM Auto" with `Bot` icon):
    - 4 colored stat tiles: STATUS (LIVE/OFF) · PANEL BALANCE (₹ + $ + low-threshold) · MAPPED SERVICES · AUTO-PLACE
    - Live red danger banner when balance < threshold with deep-link to peakerr.com/funds
    - Config card with show/hide API key toggle, USD→INR rate, low-balance threshold, master enable + auto-place toggles
    - Service mapping: every app-side service in `site_config.services` gets a LINK button → opens picker modal that searches Peakerr's 5943 services with INR-converted pricing inline (₹X/1k cost)
    - Existing admin Orders detail modal now shows an inline **SmmPlacementPanel** with panel order ID, live status (Pending/In progress/Completed/Partial), remains count, start count, cost in ₹+$, plus RE-PLACE and ↻ REFRESH buttons
  - **Verified end-to-end**:
    - `PUT /admin/smm/config` saves config, masks key as `…201f`
    - `GET /admin/smm/balance` returns live `{usd: 0, inr: 0, low_threshold_inr: 500}` (panel currently empty)
    - `GET /admin/smm/services?q=instagram+followers` returns 660 services with INR conversion (₹33.26/1k for $0.378/1k)
    - `POST /admin/services/yt-subs/smm-link` persists mapping inside `site_config.services`
    - `PATCH /orders/{id}` with `status=verified` correctly fires auto-place; panel rejection ("Not enough funds") gets cleanly recorded as `smm_error` without breaking the status update.
  - **What admin needs to do once**: 1) Top up Peakerr · 2) Open SMM Auto tab, link each service to a Peakerr service ID · 3) From then on every `verified` order auto-fires.
- **Iter-22 · Auto-Scroll · Inline Pay · Animated Stage Connectors** ✨ (Feb 2026)
  - **User pain**: "when we refresh it should auto scroll to that update · in card upi / manual upi space is there right add pay option there only dont need extra scroll down · try to do some unique animation arrow mark from case received"
  - **Auto-scroll on status refresh** (`OrderTracker.jsx`): new `useStatusScroll(status)` hook tracks the previous status via `useRef`. When refresh delivers a new status, the hook smooth-scrolls the new `current` StageTile into view (`block: 'center'`) and tags it with `.is-just-updated` for a 3.4s pulsing focus ring. Initial mount is skipped so first-time loads don't auto-scroll past order details.
  - **Inline PAY action in each PayTile** (`PaymentBox.jsx`): refactored `PayTile` to accept `children`. When the tile is active, a new `.pay-action` slot expands inline with the payment CTA + helper info — no scrolling required:
    - **Card/UPI** (green, FAST): big `⚡ PAY ₹X →` CTA + "Powered by Cashfree" footer right inside the tile
    - **Manual UPI** (cyan): UPI ID + COPY button + "Pay ₹X · then submit proof below" instruction + "Verified within 30 min" footer
    - **Crypto** (yellow): coin pill picker + address + COPY button + "1 confirmation required" footer
    - The old standalone Cashfree/Manual/Crypto panes were removed (replaced by inline content). Only the shared "SUBMIT PROOF" section stays at the bottom for manual paths.
  - **Animated stage connectors** (`index.css`): new keyframes `eh-arrow-pulse` (vertical pulse line flowing downward between done stages) + `eh-arrow-bob` (bobbing chevron arrowhead under each done stage's icon). Both inherit the stage's `--tile-color` so the cascade reads cyan → orange → yellow → green → purple as it animates.
  - **Verified on 390×844 (iPhone)**: Card/UPI tile active = green PAY ₹5,747 → button inside the tile, no scroll needed. Manual UPI tile click expands inline with cyan UPI ID + COPY. Stages have bobbing arrows tying done steps together visually.
- **Iter-21 · Premium Multi-Color Theme · Tracker Stages + Payment Methods** 🎨 (Feb 2026)
  - **User pain** (verbatim): "operation tracker theme is not good complete green is not good and payment info theme is also not friendly user i want premium icons which you created in tools section same theme i want in that change entire theme of track section payment section users should feel good and pleasant with animation"
  - **Fixes shipped**:
    1. **New CSS module** in `index.css`: `.eh-stage-tile` (premium colored stage card) + `.eh-pay-tile` (payment-method tile) + `.eh-status-hero` (animated data-stream backdrop). All driven by a per-tile `--tile-color` CSS variable, mirroring the existing `.tools-tile` DNA — float, glow, shine, hover lift, badge styling.
    2. **Stage color palette** added to `ORDER_STAGES`, `RECOVERY_STAGES`, `REFUND_STAGES`:
       - received/new → `#4de0ff` (cyan)
       - reviewing → `#ff8a3a` (orange)
       - verified/engaged → `#00ff9d` (neon green) / `#ffd34d` (yellow)
       - in-progress/recovering → `#ffd34d` / `#00ff9d`
       - delivered/recovered/completed → `#c084fc` (purple)
       - rejected/closed → `#ff3148` (red) / `#c084fc`
    3. **`<StageTile>` shared component** replaces the flat connector-line timeline in OrderView, RecoveryView, RefundView. Each step is a full premium card with:
       - Colored left accent strip (intensifies on done/current)
       - Animated icon-wrap (subtle float, pulse-ring glow on current step)
       - Color-tinted label + chip (`● LIVE` pulse on current, `✓ COMPLETED` on done)
       - Staggered entrance animation (`70ms * index` delay) so stages cascade in
    4. **Animated Status Hero** in RecoveryView + RefundView: data-stream backdrop (CSS keyframe), pulsing colored dot, colored heading + soft tinted note block — all driven by the current stage's color (no more monotone green).
    5. **PaymentBox tab picker → 3 premium `<PayTile>` cards**: replaced the tiny TabBtn pills with full tools-tile-styled cards:
       - **Card / UPI** — green (#00ff9d) icon, **FAST** badge, "Instant · auto-verify"
       - **Manual UPI** — cyan (#4de0ff) icon, "Pay & upload proof"
       - **Crypto** — yellow (#ffd34d) icon, "USDT · BTC · ETH"
       - Hover/active state: lift + glow + animated shine sweep, icon-wrap gets the pulse-glow ring. Active card shows `▸ SELECTED`, others show `CHOOSE →`
  - **Verified on 390×844 (iPhone-size) viewport**: tracker shows the 4-color stage cards with cyan-current/yellow/green/purple-pending palette, current step has pulsing LIVE chip + animated icon-wrap ring. PaymentBox renders the 3 color-coded payment-method tiles stacked on mobile. Brand-consistent — pure black + colored neon accents + Space Grotesk.
- **Iter-20 · Mobile-First Redesign · OrderTracker + PaymentBox + Login + Signup** 📱 (Feb 2026)
  - **User pain** (verbatim): "ui interface is not good and its not fit properly to mobile ios & android please fix this properly... in payment section change some theme like tools section... in login section also its like desktop version i want priority to mobile version please do the best version for me recovery section everything"
  - **Fixes shipped**:
    1. **OrderView / RecoveryView / RefundView headers** (`OrderTracker.jsx`): the right-aligned `PACKAGE` / `SERVICE` / `FOR ORDER` label was wrapping awkwardly on phones (the long "CLOUD 50 Top Speed, Performance, And Resources Available" service name spilled across an unreadable right column). Now stacks vertically on mobile, side-by-side on desktop, with tighter typography (text-[13.5px] on mobile, text-sm on desktop).
    2. **OrderView info grid**: replaced `grid-cols-1 sm:grid-cols-3` (3 full-width rows on mobile, too tall) with `grid-cols-2 sm:grid-cols-3` — CLIENT + SIZE side-by-side, TARGET below them full-width. Compact `p-2.5` mobile / `p-3` desktop.
    3. **PaymentBox Cashfree panel — tools-tile theme**: replaced the cramped icon-beside-text layout (which forced "Pay & start work — right now" to wrap to 3 lines) with a tools-page-inspired card:
       - Top accent strip with pulsing green dot + `RECOMMENDED` badge on the left + `INSTANT · PCI-DSS L1` chip on the right
       - Tighter icon (9×9 mobile, 11×11 desktop) on a soft neon background
       - Compact headline (text-[15px] mobile, text-lg desktop) with `leading-snug` so it never breaks past 2 lines
       - One-line sub-text and a button with responsive label (mobile shows `PAY ₹X →`, desktop shows `PAY ₹X · OPEN CHECKOUT`)
    4. **PaymentBox top header**: replaced single-line `// COMPLETE_PAYMENT · ₹5,747` (which wrapped on small screens) with a flex split — `// COMPLETE_PAYMENT` label on the left, big `₹5,747` neon display number on the right, ellipsis-truncated.
    5. **Login.jsx + Signup.jsx mobile-first hero**: stacked logo + heading vertically on mobile (centered) and horizontally on desktop, added two ambient green radial halos as background depth, tall thumb-friendly inputs (`text-base py-3.5`), bigger CTA button (`py-3.5 font-bold`), `backdrop-filter: blur(8px)` glassmorphism on the panel.
  - **Verified on 390×844 (iPhone-size) viewport**:
    - `/track?id=ORD-MOBTEST-001` → OrderView header stacks cleanly, CLIENT + SIZE side-by-side, TARGET below ✓
    - PaymentBox renders the new tools-tile Cashfree card with pulsing RECOMMENDED badge ✓
    - `/login` shows centered hero with floating halos and big tap targets ✓
- **Iter-19 · Direct Refund by Any Tracking ID** 💸 (Feb 2026)
  - **Pain solved**: Admin previously could only act on customer-filed refund requests. No way to issue a refund proactively for any order/case from the webpanel — every refund required the customer to file first. The user explicitly asked: "in webpanel refund section all tracking id should be available so i can refund there everything what i want".
  - **New backend endpoints** (`server.py`):
    - `GET /api/admin/refunds/lookup/{tracking_id}` — resolves ORD-, REC-, or RFD- IDs into a refundable target. Returns `{ kind, order, user (incl. balance + tg link), suggested_amount, existing_refunds }`. Falls back from order → linked recovery case → existing refund record.
    - `POST /api/admin/refunds/issue` — body `{ tracking_id, amount, reason, method }`. Idempotent — if a refund already exists for the target it updates the latest record instead of duplicating. Wallet path credits instantly via `_wallet_txn`; UPI/Crypto/Manual stay `approved` for offline payout. Fires Telegram DM to customer (when linked) with refund ref + track link. Full timeline audit trail preserved.
  - **Frontend redesign** (`RefundsManager.jsx`): new `IssueByTrackingPanel` at top of the Refunds page:
    - Sticky lookup box (Enter key triggers search)
    - Resolved target preview grid: KIND · SUGGESTED · SERVICE · ORDER STATUS · CUSTOMER · WALLET BALANCE
    - Yellow warning chip listing pre-existing refunds for this order with their statuses (prevents accidental duplication)
    - Amount auto-fills from suggested; currency dropdown; method picker (WALLET instant / UPI / CRYPTO / MANUAL); customer-visible reason textarea
    - Single big "⚡ ISSUE ₹X REFUND" CTA — confirms via `window.confirm`, then toasts the new RFD-ID
    - Existing Refund Requests list rebuilds via `onIssued` callback
  - **Verified end-to-end**:
    - Seeded ORD-RFTEST-001 (₹999, user with `user_id`, balance ₹0)
    - `lookup` → returned kind=order, suggested=999, user balance ₹0
    - `issue {amount:500, method:'wallet'}` → wallet credit instant, status `completed`, timeline `requested → approved → completed`
    - Re-issue on same order → correctly updated existing record (yellow warning chip rendered with "RFD-XXX·completed·₹500")
    - All visual elements (lookup grid, warning, form, CTA) verified on 1440px desktop with screenshot
- **Iter-18 · Admin Orders Inbox v2 + Quote Editor** 🎛️ (Feb 2026)
  - **New backend endpoint** `POST /api/orders/{order_id}/set-quote` (`server.py`): admin-only, takes `{ amount, currency, note }`, persists `payment_amount/currency/notes/quote_sent_at`, fires customer email (`notify_quote_sent`) + Telegram DM (`_notify_user_order(event='quote_sent')`). Idempotent — re-sending updates the price and re-pings the customer.
  - **Frontend admin redesign** (`AdminPanel.jsx`): replaced the flat orders table with a polished inbox matching the Recovery/Payments style:
    - **4 stat tiles**: TOTAL ORDERS · AWAITING QUOTE (yellow when >0, "needs price") · PAYMENT REVIEW (cyan, "verify proof") · REVENUE LOCKED (₹ verified+)
    - **Filter chips**: ALL · RECEIVED · PAYMENT REVIEW · VERIFIED · IN PROGRESS · DELIVERED · PAID with live counts
    - **Search**: by ID, email, name, or service name
    - **Row+detail-modal** pattern (clickable rows open a full-context modal)
    - **`SetOrderQuotePanel`** inside modal: edit/set quote amount + currency (INR/USD/EUR/GBP) + customer note, with primary "SEND QUOTE TO CUSTOMER" CTA. When a quote already exists, it shows the locked summary with an "UPDATE & RESEND" button → toggle back to edit form.
    - **Customer payment block**: shows method, amount paid, TX ref, screenshot when a customer has submitted proof
    - **Status updater** row with all status chips
    - **Footer actions**: OPEN PUBLIC TRACKER (deep-link with `?pay=1` when amount set) + CONTACT ON TELEGRAM
  - **Verified end-to-end on preview**:
    - `POST /api/orders/ORD-QTEST-001/set-quote {amount:1499}` → 200, persists `payment_amount=1499`
    - `/track?id=ORD-QTEST-001&pay=1` → customer sees active "PAY ₹1,499 · OPEN CHECKOUT" Cashfree button
    - Admin Orders panel on desktop (1440px) and mobile (390px) both render the new UI cleanly
- **Iter-17 · "Awaiting Quote" Lockout Fix + Beautiful Pending UX** ✨ (Feb 2026)
  - **Root cause #1 (revenue blocker)**: Cart-created orders went into MongoDB with NO price field. `OrderIn` Pydantic model didn't even accept one, so `api.createOrder({...})` from `CartPage.jsx` dropped the cart total on the floor. `PaymentBox` then read `order.amount === 0` and rendered the Cashfree button as a permanently-disabled "AWAITING QUOTE" — every cart customer was locked out of paying.
  - **Fix #1 (backend, `server.py`)**: `OrderIn` now accepts optional `amount` + `currency`. Cart-created orders flow these through `**body.dict()` into the order doc → `PaymentBox` reads the real total instantly.
  - **Fix #2 (frontend, `CartPage.jsx`)**: Checkout now passes `amount: it.price * it.qty, currency: 'INR'` per line-item.
  - **Fix #3 (PaymentBox redesign, `PaymentBox.jsx`)**: When `amount <= 0` (legit admin-quoted services like recovery/custom work), the locked-button is replaced with a beautiful mobile-first **awaiting-quote panel**:
    - Pulsing neon dot + `// QUOTE_IN_REVIEW` status strip, `EST · UNDER 4 HRS` timing
    - Spinning clock icon hero + headline "Your operator is preparing the quote"
    - Contextual sub-line that references the customer's service name
    - 3-step mini-timeline: PLACED ✓ → PRICING (LIVE NOW pulse) → PAY (—)
    - Stacked CTAs on mobile: "PING TEAM ON TELEGRAM" (primary) + "CHECK FOR QUOTE" (ghost, hits `/api/orders/{id}` and updates inline + toasts the new amount)
    - Reassurance footer: "No charge will be made until you approve the quote. This page auto-updates."
  - **Verified end-to-end on preview**: `ORD-AWAIT-001` (no amount) → new pending panel renders cleanly; `ORD-READY-001` (amount=2499) → full Cashfree/UPI/Crypto payment UI with active "PAY ₹2,499 · OPEN CHECKOUT" button.
- **Iter-16 · Real Blank-Screen Fix on /track (Email PAY NOW links)** 🔥 (Feb 2026)
  - **Root cause**: `OrderTracker.jsx` line 237 inside `RecoveryView` referenced `shouldAutoScroll` — a variable that only exists in the parent `OrderTracker` scope. `RecoveryView` only receives `autoScroll` as a prop. This threw `ReferenceError: shouldAutoScroll is not defined` at render time → entire tracker blanked out.
  - **Trigger condition**: Looking up a recovery case (`REC-XXX`) that has `linked_order_id` set (i.e., quote was sent and the customer received a "PAY NOW" email). Exactly the production email-link flow.
  - **Why DEMO/non-existent IDs worked**: They never set `linkedOrder`, so the broken `<PaymentBox>` line was guarded out by `{linkedOrder && ...}` and never executed.
  - **Fix**: Changed `autoScroll={shouldAutoScroll}` → `autoScroll={autoScroll}` (use the in-scope prop).
  - **Verified**: Seeded a real `REC-FIXTEST-001` with `linked_order_id` in preview MongoDB and visited `/track?id=REC-FIXTEST-001&pay=1` — full QUOTE READY card + PaymentBox renders with zero JS errors.
- **Iter-15 · BootScreen Deep-Link Fix** 🐛 (Feb 2026)
  - **Root cause**: `BootGate` in `App.js` only auto-skipped boot for `/admin`, `/login`, `/signup`, `/me`, `/fonts`. Email "PAY NOW" links land on `/track?id=X&pay=1` (NOT in the skip list), so the 2.6s boot animation played. On mobile (background tab throttling, iOS low-power mode, Safari private mode with sessionStorage failures) the `setInterval` could stall — leaving users frozen on "INITIALIZING SYSTEM..." forever, unable to pay.
  - **Fix in `BootGate`** (`/app/frontend/src/App.js`): Auto-skip boot for ANY non-home route OR any URL with query params (email deep-links always carry `?pay=1`, `?id=`, etc.). `sessionStorage` calls wrapped in try/catch for iOS private mode.
  - **Fix in `BootScreen.jsx`**: Added a hard 4s safety-net `setTimeout` that calls `onDone()` even if the interval stalls. Idempotent via `done` flag — interval-completion path and safety path are mutually exclusive.
  - **Verified**: `/` plays + unmounts boot cleanly (~3s); `/track?id=test&pay=1` skips boot entirely and renders Operation Tracker immediately.
- **Iter-12/13 · FastAPI Lifespan + Try/Except Isolation + Cashfree Route Extraction** 🔧
  - **Lifespan migration**: `@app.on_event` deprecation gone — replaced with proper `@asynccontextmanager` lifespan that re-creates all 13 MongoDB unique + perf indexes on every startup. Forward-references resolved lazily so the lifespan body can be defined before its callees.
  - **Per-task try/except isolation** across all 8 email/Telegram dispatch sites — `me_pay_with_wallet`, both branches of `_cashfree_reconcile`, and PATCH /orders. A single Resend hiccup can no longer suppress the rest.
  - **Cashfree extraction**: 5 routes moved out of `server.py` into `/app/backend/routes/cashfree.py` (APIRouter pattern, lazy `_srv()` resolver to dodge circular imports). server.py shrank from 4968 → 4837 lines. Pattern is proven and reusable — Refunds + Spin + Wallet splits can follow in a focused next iteration.
  - **52/52 backend tests green** across iter-9/10/12/13 suites. 0 frontend changes, no regressions.
- **Iter-10/11 · Cashfree EVERYWHERE + Receipt Emails + Quote-Pay Deep-Link** 📧
  - `PaymentBox` rewritten to default to **Cashfree (FAST badge)** with Manual UPI + Crypto as secondary tabs. Now used on `/me/orders/{id}`, public `/track`, AND inside recovery cases when a quote is sent (`linked_order_id` branch) — Cashfree available everywhere a customer can pay.
  - **`send_order_receipt_email`** — new printable receipt with Order ID + Service + Amount + Method + VERIFIED badge + "OPEN LIVE TRACKER" button. Dispatched on:
    - Cashfree service-payment reconcile
    - Wallet pay-with-balance (iter-11 fix)
    - Admin marks manual UPI/Crypto payment verified
    - Side-by-side with existing wallet receipt for completeness
  - **Quote email upgrade** (`notify_quote_sent`) — now lists Cashfree as the instant option, CTA reads "PAY NOW · OPEN CASE" and links to `/track?id={case}&pay=1`.
  - **`?pay=1` deep-link** — `OrderTracker` reads the flag and threads `autoScroll` through `RecoveryView`/`OrderView` to `PaymentBox`, which scrolls into view + flashes a 2-cycle neon pulse (`.eh-pulse-once` keyframe) drawing the eye straight to the Pay button.
  - Final iter-11 retest: **27/27 backend tests green**, frontend 100% critical paths from iter-10. Domain whitelisting on Cashfree dashboard is the only remaining customer-side step.
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
