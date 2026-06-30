import React from 'react';
import { ShieldCheck, Sparkles, MessageCircle, Lock, BadgeCheck } from 'lucide-react';

/**
 * Premium wizard header that persists across all 3 recovery steps.
 * - Animated shield logo (concentric pulsing rings + orbiting sparkles + soft float)
 * - Step-contextual headline (changes per step so it stays friendly + relevant)
 * - 3 micro-chips: status · privacy · no-upfront — instant reassurance
 *
 * Strict black + neon-green theme.
 */
const STEP_COPY = {
  service: {
    kicker: '// STEP 1 OF 3',
    title: 'Choose what happened',
    sub: "Tap your situation below — we'll take it from there.",
  },
  details: {
    kicker: '// STEP 2 OF 3',
    title: "Give us the details",
    sub: "Brief context only. We'll never ask for your password.",
  },
  contact: {
    kicker: '// STEP 3 OF 3',
    title: "Where can we reach you?",
    sub: "We'll send a free quote within 24h — no payment yet.",
  },
};

const RecoveryWizardHeader = ({ step = 'service', teamOnline = true }) => {
  const c = STEP_COPY[step] || STEP_COPY.service;
  return (
    <div className="recovery-wizard-header relative overflow-hidden rounded-xl border border-[rgba(0,255,157,.25)] bg-[rgba(0,255,157,.035)] p-4 sm:p-6 mb-4 sm:mb-5">
      {/* subtle radial backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(60% 80% at 80% 20%, rgba(0,255,157,.10), transparent 70%)' }} />

      <div className="relative flex flex-col items-center text-center sm:grid sm:grid-cols-[auto_1fr] sm:items-center sm:text-left gap-3 sm:gap-5">
        {/* Animated shield logo */}
        <div className="rwh-logo relative shrink-0 grid place-items-center" data-testid="recovery-wizard-logo">
          <span className="rwh-ring rwh-ring-1" />
          <span className="rwh-ring rwh-ring-2" />
          <span className="rwh-spark rwh-spark-1">✦</span>
          <span className="rwh-spark rwh-spark-2">·</span>
          <span className="rwh-spark rwh-spark-3">✦</span>
          <div className="rwh-core relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl grid place-items-center bg-[#0d1115] border border-[rgba(0,255,157,.35)]" style={{ boxShadow: '0 0 24px rgba(0,255,157,.18), inset 0 0 12px rgba(0,255,157,.08)' }}>
            <ShieldCheck size={28} className="text-[var(--eh-green)] rwh-shield" strokeWidth={1.8} />
          </div>
        </div>

        {/* Title + sub */}
        <div className="min-w-0 w-full">
          <div className="eh-mono text-[10px] sm:text-[11px] tracking-[.4em] text-[var(--eh-green)] mb-1.5 flex items-center gap-2 justify-center sm:justify-start">
            <Sparkles size={11} className="rwh-sparkle-icon" />
            {c.kicker}
          </div>
          <h1 className="font-black leading-[1.15] mb-2" style={{ fontFamily: "'Space Grotesk', Inter, system-ui, sans-serif", letterSpacing: '-.02em', fontSize: 'clamp(1.5rem, 6vw, 2.2rem)' }} data-testid={`recovery-step-h1-${step}`}>
            {c.title}
          </h1>
          <p className="text-xs sm:text-sm opacity-80 leading-relaxed mx-auto sm:mx-0 max-w-md sm:max-w-xl" style={{ fontFamily: "'Space Grotesk', Inter, system-ui, sans-serif" }}>{c.sub}</p>
        </div>
      </div>

      {/* Reassurance chips — compact, friendly, persistent */}
      <div className="relative flex items-center gap-1.5 sm:gap-2 mt-4 flex-wrap justify-center sm:justify-start eh-mono text-[10px] sm:text-[11px]">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[rgba(0,255,157,.35)] bg-[rgba(0,255,157,.08)]">
          <span className="relative inline-flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[var(--eh-green)] eh-pulse-dot" />
          </span>
          {teamOnline ? 'Team online · 24/7' : 'Team responds within 1h'}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--eh-border)] opacity-90"><Lock size={10} /> Zero-logs</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--eh-border)] opacity-90"><BadgeCheck size={10} /> No-fix · no-fee</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--eh-border)] opacity-90 hidden sm:inline-flex"><MessageCircle size={10} /> Real engineers</span>
      </div>
    </div>
  );
};

export default RecoveryWizardHeader;
