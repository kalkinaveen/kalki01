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
- Razorpay auto-credit wallet on deposit
- Stripe alongside Razorpay (international)
- WhatsApp Business notifications (Twilio or Meta)
- Multi-currency UI hookup
- 30-day auto-purge trashed feed posts
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
