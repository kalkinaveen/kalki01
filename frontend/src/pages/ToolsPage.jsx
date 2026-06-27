import React from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, FileText, ShieldCheck, Bot, ArrowRight, Sparkles } from 'lucide-react';

/**
 * AI Tools Hub — landing page for the suite of free recovery / security tools.
 * Each tile follows the brand language used by RecoveryServiceTile.
 */
const TOOLS = [
  {
    to: '/tools/diagnose',
    icon: Stethoscope,
    color: '#00ff9d',
    title: 'Issue Checker',
    desc: 'Tell us what happened to your Instagram in 5 quick dropdowns and get an instant diagnosis plus recovery roadmap.',
    badge: 'NEW',
    cta: 'CHECK MY ISSUE',
    testId: 'tool-tile-diagnose',
  },
  {
    to: '/tools/appeal',
    icon: FileText,
    color: '#ffd34d',
    title: 'Appeal Generator',
    desc: 'AI-written, polite, platform-ready appeal letter. Drop a few facts about your account and let our model do the heavy lifting.',
    badge: 'AI',
    cta: 'GENERATE LETTER',
    testId: 'tool-tile-appeal',
  },
  {
    to: '/tools/security-score',
    icon: ShieldCheck,
    color: '#4de0ff',
    title: 'Security Score',
    desc: 'Six-question audit of your Instagram hygiene with an animated score, weak-spots breakdown, and easy fixes.',
    badge: 'FREE',
    cta: 'RUN AUDIT',
    testId: 'tool-tile-security',
  },
  {
    to: '#chat',
    icon: Bot,
    color: '#c084fc',
    title: 'AI FAQ Assistant',
    desc: 'Chat with err0r-help — answers about recovery ETA, pricing, payments, order status. Live in the bottom-right corner.',
    badge: 'LIVE',
    cta: 'OPEN CHAT',
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
          <div className="eh-kicker justify-center mb-3">// FREE AI ARSENAL</div>
          <h1 className="eh-display font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2rem, 6vw, 4rem)' }}>
            RECOVERY <span className="eh-neon">TOOLS</span>
          </h1>
          <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            Free utilities to diagnose, appeal, and harden your account before — or while — we recover it for you.
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full border border-[var(--eh-border)] bg-[#0d1115] eh-mono text-[10px] tracking-widest">
            <Sparkles size={11} className="text-[var(--eh-green)]" />
            <span className="opacity-80">POWERED BY · CLAUDE SONNET 4.5 · NO SIGNUP NEEDED</span>
          </div>
        </div>

        {/* Tile grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-5">
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

        {/* Coming-soon strip */}
        <div className="mt-12 eh-panel eh-brackets p-6">
          <span className="br-bl" /><span className="br-br" />
          <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-2">// ROADMAP · COMING SOON</div>
          <div className="flex flex-wrap gap-2">
            {['Scam Detector', 'Recovery Time Predictor', 'Recovery Checklist', 'Instagram Safety Report'].map(n => (
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
