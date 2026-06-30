import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Zap, BookOpen, ArrowRight } from 'lucide-react';

/**
 * Mission Hub — the "What do you need today?" single-decision funnel.
 * Replaces a navbar maze with one fork that routes users to the right service.
 *
 * Three doors, brand-coloured:
 *   🛡 RECOVER  · neon green   → /recovery (also serves Tools via cross-strip)
 *   ⚡ GROW     · hot pink     → /smm
 *   📚 LEARN    · cyan         → /books
 *
 * Mounted on the Home page below the existing Hero.
 */

const DOORS = [
  {
    key: 'recover',
    to: '/recovery',
    Icon: ShieldCheck,
    color: '#00ff9d',
    label: 'MY ACCOUNT IS IN TROUBLE',
    sub: 'Disabled · hacked · banned · 2FA lockout · password lost',
    cta: 'OPEN RECOVERY',
    extra: 'Pay only on success · 24h human review',
    testId: 'mission-recover',
  },
  {
    key: 'grow',
    to: '/smm',
    Icon: Zap,
    color: '#ff2d92',
    label: 'I WANT TO GROW',
    sub: 'Followers · views · likes · 5,800+ verified services · INR',
    cta: 'OPEN SMM PANEL',
    extra: 'Auto-placed · refill guarantee · ₹10 minimum',
    testId: 'mission-grow',
  },
  {
    key: 'learn',
    to: '/books',
    Icon: BookOpen,
    color: '#4de0ff',
    label: 'I WANT TO LEARN',
    sub: 'Hacking eBooks · pentest playbooks · OSINT field manuals',
    cta: 'OPEN LIBRARY',
    extra: 'Instant download · pay once · lifetime access',
    testId: 'mission-learn',
  },
];

const MissionHub = () => {
  return (
    <section className="py-14 sm:py-20 relative" data-testid="mission-hub">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-9 sm:mb-12">
          <div className="eh-kicker justify-center mb-3">// MISSION_HUB · ONE DECISION</div>
          <h2 className="eh-display font-black leading-tight" style={{ fontSize: 'clamp(1.7rem, 5.5vw, 3.3rem)' }}>
            What do you need <span className="eh-neon">today</span>?
          </h2>
          <p className="opacity-70 mt-3 max-w-xl mx-auto text-sm" style={{ fontFamily: 'Inter,sans-serif' }}>
            Three doors. One mission. Pick where you are right now — we'll take it from there.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
          {DOORS.map(({ key, to, Icon, color, label, sub, cta, extra, testId }) => (
            <Link
              key={key}
              to={to}
              data-testid={testId}
              className="mh-door group relative overflow-hidden rounded-2xl border-2 p-5 sm:p-6 flex flex-col h-full transition-all"
              style={{
                borderColor: `${color}55`,
                background: `linear-gradient(160deg, ${color}10 0%, transparent 60%)`,
                '--door-color': color,
              }}
            >
              {/* Top accent line */}
              <span
                aria-hidden
                className="absolute top-0 left-0 right-0 h-[3px] opacity-80"
                style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
              />
              {/* Hover glow blob */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(50% 60% at 50% 30%, ${color}22, transparent 70%)` }}
              />

              <div className="relative flex items-start justify-between mb-4 sm:mb-5">
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl grid place-items-center transition-transform group-hover:scale-110"
                  style={{ background: `${color}1a`, border: `1px solid ${color}55`, color }}
                >
                  <Icon size={24} strokeWidth={1.8} />
                </div>
                <span
                  className="eh-mono text-[10px] tracking-widest opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                  style={{ color }}
                >
                  →
                </span>
              </div>

              <div className="relative flex-1">
                <div
                  className="eh-mono text-[11px] sm:text-[12px] tracking-[0.18em] font-bold leading-tight mb-2"
                  style={{ color }}
                >
                  {label}
                </div>
                <div className="text-[12.5px] sm:text-sm opacity-75 leading-relaxed mb-4" style={{ fontFamily: 'Inter,sans-serif' }}>
                  {sub}
                </div>
              </div>

              <div className="relative mt-auto">
                <div
                  className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest font-bold px-3 py-2 rounded-md transition-all group-hover:brightness-110"
                  style={{ background: color, color: '#000' }}
                >
                  {cta} <ArrowRight size={12} />
                </div>
                <div className="eh-mono text-[10px] opacity-50 mt-2 leading-snug">
                  {extra}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .mh-door:hover { border-color: var(--door-color) !important; transform: translateY(-4px); box-shadow: 0 18px 50px -16px color-mix(in srgb, var(--door-color) 60%, transparent); }
        .mh-door { transition: transform .35s cubic-bezier(.2,.9,.3,1), border-color .25s ease, box-shadow .35s ease; }
      `}</style>
    </section>
  );
};

export default MissionHub;
