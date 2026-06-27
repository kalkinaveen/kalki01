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
- **AI Tools Hub (`/tools`)** — 4 free tools in animated tile grid (Space Grotesk + neon green):
  1. **Issue Checker** (`/tools/diagnose`) — 5-dropdown rule-based Instagram diagnosis → tailored roadmap + risk badge + recovery CTA.
  2. **Appeal Generator** (`/tools/appeal`) — Claude Sonnet 4.5 via Emergent LLM key writes a polite, platform-ready appeal letter; copy & mailto handoff.
  3. **Security Score** (`/tools/security-score`) — 6-question audit → animated score ring (0–100) with weak-spots list.
  4. **AI FAQ Assistant** — Claude Haiku 4.5 chatbot, floating bubble bottom-right (also reachable from the hub tile).
- **FloatingStack** — single fixed bottom-right cluster (AI chat → Mail → Telegram) replacing the older overlapping `FloatingTelegram` + `FloatingMail` positioning bug; safe-area-inset padding for iOS notch.
- Customer Telegram bot (webhook, /track /pay /recover /help, account linking)
- Wallet · daily Spin · live ticker
- "Works With" admin-managed brand marquee
- Recovery flow: 17 services, animated brand tiles (Telegram-Premium feel), price pills, inline NEXT, premium animated tag badges (PREMIUM/HOT/NEW/BESTSELLER/LIMITED/FAST/SECURE) controlled in webpanel
- Service ↔ platform smart filter in Step 2
- Friendly wizard header replaces bulky empathy hero
- Public reviews open to anyone; chat-bubble carousel (TestimonialsCarousel) with proof media + anti-copy watermark
- Mobile-tight Recovery flow (compact stepper progress bar, single-card testimonials)
- Brand watermark inline with @errorhacker on reels (no top-left pill)
- Animated case-trace timeline (radar + sparkles + flowing connector)
- **Resend transactional emails** — case received, status changes, quote sent, order updates, wallet deposit approved
  - HTML template, premium neon theme, inline-CSS, email-client safe
  - Domain `errorhacker.site` verified · sender `team@errorhacker.site`
  - Non-blocking via `asyncio.to_thread`, silent fail with logger
  - Auto-fallback to `onboarding@resend.dev` if domain not verified

## Backlog
- 4 more AI tools: Scam Detector, Recovery Time Predictor, Recovery Checklist, Instagram Safety Report (lead-gen email)
- New-tool announcement system: admin toggle "NEW" → Telegram broadcast + Resend email blast
- Stripe payment gateway (alongside Razorpay)
- Multi-currency UI auto-switch (backend supports it)
- Feed moderator "Hide/Trash" UI (delete → hide for `feed_mod` role)
- 30-day auto-purge trashed feed posts (cron)
- Refactor: split `server.py` (~2,900 lines) into `routes/auth.py`, `routes/recovery.py`, `routes/wallet.py`, `routes/tools.py`, `routes/feed.py`
- DRY the LLM bootstrap (extract `get_llm_chat()` helper)
- IP/session rate-limit on `/api/tools/*` to guard Emergent LLM key budget
- Razorpay auto-credit wallet on deposit
- WhatsApp Business notifications (Twilio or Meta)
- VIP tiers / cashback on orders
- Leaderboard / achievements / streak multipliers on spin
- PWA / add-to-home-screen
- Admin 2FA login
- Honeypot + rate-limit on public review form
- Customer email opt-out toggle

## Critical Notes
- `RESEND_API_KEY`, `SENDER_EMAIL=team@errorhacker.site`, `SENDER_NAME=ERRORHACKER` set in `/app/backend/.env`
- All emails fire via `asyncio.create_task(...)` from server.py hooks — never block API responses
- DO NOT refactor `FeedPage.jsx` autoplay logic (iOS/Brave tuned)
- Preview vs Production: errorhacker.site is the production deploy
