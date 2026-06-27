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
