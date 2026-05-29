# ERRORHACKER — PRD

## Original Problem Statement
Build a hacker-themed e-commerce/services platform (clone-inspired by `bd71zone.com`) with a pure black + neon green UI, a full Admin CMS Panel, user auth, shopping cart, order tracking, manual (UPI/Bank) + crypto payment flows, an Instagram-style verified Feed (posts + reels with MP4 upload), referral tracking, Account Recovery workflow, and Google Analytics.

## Stack
- Frontend: React + TailwindCSS + shadcn/ui (Context API for site config, auth, cart)
- Backend: FastAPI + Motor (async MongoDB) + GridFS (video) + PyJWT
- Integrations: Telegram Bot API (alerts), Google Analytics 4
- Deployed at: `https://errorhacker.site` (preview: emergent preview URL)

## Architecture (high level)
```
/app
├── frontend/src
│   ├── components/         # Navbar, PaymentBox, RecoveryReviewForm, Layout, …
│   ├── contexts/           # SiteConfigContext, AuthContext, CartContext
│   ├── lib/                # api.js, analytics.js
│   └── pages/              # Home, AdminPanel, OrderTracker, FeedPage, RecoveryPage
│       └── admin/          # RecoveryManager, TeamManager
├── backend
│   ├── server.py           # FastAPI app
│   └── defaults.py
└── memory/
    └── test_credentials.md
```

## Implemented (CHANGELOG)
- 2026-02 · Mobile OrderDetail overflow fix
- 2026-02 · Instagram-style share buttons + native Web Share API
- 2026-02 · Feed revamp → 3-column infinite-scroll grid (posts + reels unified)
- 2026-02 · iOS Safari / Brave video autoplay-unmute fix via IntersectionObserver
- 2026-02 · HTTP 206 Partial Content streaming for GridFS videos
- 2026-02 · Admin control of Feed Follow + Message buttons
- 2026-02 · Account Recovery feature (3-step wizard, file upload, Telegram alerts, dashboard)
- 2026-02 · Recovery integrated into `/track`
- 2026-02 · Feed Moderator role (daily upload + size caps, hide vs delete)
- 2026-02 · Blog section removed from Admin Webpanel
- 2026-02 · **Customer review submission flow on Recovery** — after a case is `recovered` / `closed`, OrderTracker shows a review form (rating + quote + up to 4 image/video media). Submissions are saved with `approved=false` and require admin approval in webpanel before going public. Admin Reviews tab now has Pending / Approved / All filters with media previews and an APPROVE one-click button.
- 2026-02 · **Service tile typography bumped for mobile** — service name `text-sm` → `text-base`, bullets → `text-[12px]`, ETA line → `text-[11px]`, padding `p-3.5` → `p-4`, icon 16px → 18px.

## Key Backend Endpoints
- `GET/PUT /api/recovery/config`, `POST /api/recovery/cases`, `GET/PATCH /api/recovery/cases/{id}`
- `GET /api/recovery/cases/{id}/can-review` (public)
- `POST /api/recovery/reviews/submit` (public — customer, forces `approved=false`)
- `POST /api/recovery/reviews/upload-media` (public — image 5MB / video 25MB)
- `GET /api/recovery/reviews` (public, approved only) · `?all=true` (admin)
- `POST/PATCH/DELETE /api/recovery/reviews` (admin)
- `GET /api/feed/media/{id}` — HTTP 206 streamer
- `POST /api/feed/posts/hide` · `POST /api/feed/posts/restore` · `GET /api/feed/posts/trash`

## DB Collections
- `site_config` (singleton CMS doc)
- `users`, `recovery_cases`, `recovery_reviews` (now with `media_urls`, `case_id`, `source`, `approved`)
- `feed_posts`, `feed_reels`, `comments`, `orders`, `coupons`, `referrals`, `uploads` (base64), GridFS for video

## Backlog / Roadmap

### P0 (next up)
- Feed Moderator UI: swap "Delete" trash icon → "Hide" eye-slash for `feed_mod` role + add Trash tab for owner.

### P1
- Auto-create order when admin sets Recovery Case → `engaged` (closes payment loop).
- Stripe payment gateway alongside Manual/Crypto.
- Multi-currency live auto-switch UI (backend ready).

### P2
- 30-day auto-purge cron for trashed feed posts.
- Resend integration → email auto-receipts, moderator welcome email, review-approval notifications.
- Moderator self-serve password change UI.
- Leaderboard / Hall of Fame for top customers.
- PWA / add-to-home-screen.
- Admin 2FA login.

## Critical Notes
- Preview vs Production: user has a deployed copy at `errorhacker.site`. Always disambiguate which environment a bug report is from.
- Do NOT refactor the `FeedPage.jsx` video autoplay/unmute logic — it was painstakingly tuned for iOS Safari + Brave.
- `MONGO_URL`, `DB_NAME`, `REACT_APP_BACKEND_URL` come from `.env` only.
