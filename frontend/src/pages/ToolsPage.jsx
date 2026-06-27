import React from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, FileText, ShieldCheck, Bot, ArrowRight, Sparkles, Database, TrendingUp, ShieldAlert, Crown, Camera } from 'lucide-react';

/**
 * AI Tools Hub — landing page for the suite of free recovery / security tools.
 * 9 tiles total. Each follows the brand language used by RecoveryServiceTile.
 */
const TOOLS = [
  {
    to: '/tools/diagnose', icon: Stethoscope, color: '#00ff9d',
    title: 'Issue Checker',
    desc: 'Tell us what happened to your Instagram in 5 quick dropdowns and get an instant diagnosis plus recovery roadmap.',
    badge: 'POPULAR', cta: 'CHECK MY ISSUE', testId: 'tool-tile-diagnose',
  },
  {
    to: '/tools/breach', icon: Database, color: '#ff3148',
    title: 'Breach Checker',
    desc: 'Was your email leaked? We scan it against thousands of public data breaches in seconds.',
    badge: 'NEW', cta: 'SCAN MY EMAIL', testId: 'tool-tile-breach',
  },
  {
    to: '/tools/odds', icon: TrendingUp, color: '#4de0ff',
    title: 'Recovery Odds',
    desc: 'Honest % chance you can recover your account alone vs with professional help, with timeline.',
    badge: 'NEW', cta: 'CALCULATE ODDS', testId: 'tool-tile-odds',
  },
  {
    to: '/tools/phishing', icon: ShieldAlert, color: '#ff8a3a',
    title: 'Phishing Detector',
    desc: 'Paste a suspicious DM, SMS, or email. AI flags scam tells and rates the risk instantly.',
    badge: 'AI', cta: 'CHECK MESSAGE', testId: 'tool-tile-phishing',
  },
  {
    to: '/tools/appeal', icon: FileText, color: '#ffd34d',
    title: 'Appeal Generator',
    desc: 'AI-written, polite, platform-ready appeal letter. A few facts in, a winning appeal out.',
    badge: 'AI', cta: 'GENERATE LETTER', testId: 'tool-tile-appeal',
  },
  {
    to: '/tools/security-score', icon: ShieldCheck, color: '#22d3ee',
    title: 'Security Score',
    desc: 'Six-question audit with an animated score, weak-spots breakdown, and easy fixes.',
    badge: 'FREE', cta: 'RUN AUDIT', testId: 'tool-tile-security',
  },
  {
    to: '/tools/account-worth', icon: Crown, color: '#c084fc',
    title: 'Account Worth',
    desc: 'Estimate your account&apos;s per-post sponsored rate &amp; total market value — share-friendly.',
    badge: 'VIRAL', cta: 'ESTIMATE WORTH', testId: 'tool-tile-worth',
  },
  {
    to: '/tools/selfie-coach', icon: Camera, color: '#f472b6',
    title: 'Selfie Prep Coach',
    desc: 'Pass Instagram&apos;s video-selfie verification on the first try. Lighting, angle, do&apos;s &amp; don&apos;ts.',
    badge: 'NEW', cta: 'CHECK MY SETUP', testId: 'tool-tile-selfie',
  },
  {
    to: '#chat', icon: Bot, color: '#00ff9d',
    title: 'AI FAQ Assistant',
    desc: 'Chat with err0r-help — recovery ETA, pricing, payments, orders. Live in the bottom-right.',
    badge: 'LIVE', cta: 'OPEN CHAT',
    onClick: () => {
      const btn = document.querySelector('[data-testid="floating-faq-chat-toggle"]');
      if (btn) btn.click();
    },
    testId: 'tool-tile-faq',
  },
];

const ToolsPage = () => {
  return (
    <div className="pt-10 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="eh-kicker justify-center mb-3">// FREE AI ARSENAL · 9 TOOLS</div>
          <h1 className="eh-display font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2rem, 6vw, 4rem)' }}>
            RECOVERY <span className="eh-neon">TOOLS</span>
          </h1>
          <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            Free utilities to diagnose, protect, recover and grow your account — built by recovery specialists, powered by AI.
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full border border-[var(--eh-border)] bg-[#0d1115] eh-mono text-[10px] tracking-widest">
            <Sparkles size={11} className="text-[var(--eh-green)]" />
            <span className="opacity-80">100% FREE · NO SIGNUP · NO DATA STORED</span>
          </div>
        </div>

        {/* Tile grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const Inner = (
              <>
                <span className="shine" />
                {t.badge && <span className="badge">{t.badge}</span>}
                <div className="icon-wrap"><Icon size={26} color={t.color} strokeWidth={1.8} /></div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
                <span className="open-row">{t.cta} <ArrowRight size={12} /></span>
              </>
            );
            if (t.onClick) {
              return (
                <button
                  key={t.title}
                  type="button"
                  onClick={t.onClick}
                  data-testid={t.testId}
                  className="tools-tile w-full"
                  style={{ '--tile-color': t.color, border: 'none', cursor: 'pointer', font: 'inherit' }}
                >
                  {Inner}
                </button>
              );
            }
            return (
              <Link
                key={t.title}
                to={t.to}
                data-testid={t.testId}
                className="tools-tile"
                style={{ '--tile-color': t.color }}
              >
                {Inner}
              </Link>
            );
          })}
        </div>

        {/* Safety banner */}
        <div className="mt-10 rounded-lg p-5 sm:p-6" style={{
          background: 'linear-gradient(135deg, rgba(255,211,77,0.06) 0%, transparent 100%)',
          border: '1px solid rgba(255,211,77,0.35)', borderLeft: '3px solid #ffd34d',
        }}>
          <div className="eh-mono text-[10px] tracking-widest font-bold mb-2" style={{ color: '#ffd34d' }}>// GENERAL SAFETY · READ BEFORE USING ANY TOOL</div>
          <ul className="space-y-1.5 text-[12.5px] opacity-90" style={{ fontFamily: 'Inter, sans-serif' }}>
            <li>· We <strong>never</strong> ask for your password, OTP, 2FA code, or recovery code. No legit tool ever needs these.</li>
            <li>· Anything asking you to upload your Instagram login outside the official app is a <strong>scam</strong>.</li>
            <li>· Submit your appeal, selfie, ID only through the platform&apos;s own app — never through DM &quot;agents&quot;.</li>
            <li>· If you&apos;re in active recovery, prefer the official Telegram bot or our /track page for updates.</li>
          </ul>
        </div>

        {/* Coming-soon strip */}
        <div className="mt-6 eh-panel eh-brackets p-6">
          <span className="br-bl" /><span className="br-br" />
          <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-2">// ROADMAP · COMING SOON</div>
          <div className="flex flex-wrap gap-2">
            {['Banned-Hashtag Checker', 'Bio Policy Checker', 'DMCA Takedown', 'Cease-and-Desist', 'Impersonator Hunter'].map(n => (
              <span key={n} className="eh-mono text-[11px] px-2.5 py-1 rounded-full border border-[var(--eh-border)] bg-[#0d1115] opacity-80">
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;
