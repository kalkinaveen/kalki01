import React from 'react';
import { ShieldCheck, Zap, BookOpen, Sparkles, Lock } from 'lucide-react';
import Logo from './Logo';

/**
 * AuthShell — shared friendly layout for /login + /signup pages.
 *
 * Design rules (Iter-26 · "no more access-terminal scare"):
 * - Left column = warm welcome hero with 3 brand-coloured benefit tiles
 *   so users immediately see WHY they should join (recovery / growth / learning).
 * - Right column = the actual form, clean and quiet.
 * - Floating ambient gradient blobs (green / pink / cyan) for depth, low opacity
 *   so they read as atmosphere instead of noise.
 * - On mobile the benefit tiles compress into a 3-up strip BELOW the form,
 *   keeping the primary action above the fold.
 */
const BENEFITS = [
  { Icon: ShieldCheck, color: '#00ff9d', title: 'Recover lost accounts', sub: 'Pay only on success' },
  { Icon: Zap,         color: '#ff2d92', title: '5,800+ SMM services',  sub: 'INR · auto-placed' },
  { Icon: BookOpen,    color: '#4de0ff', title: 'Hacking eBook library', sub: 'Instant download'    },
];

const AuthShell = ({ kicker, title, subtitle, footer, children }) => {
  // Mobile-only quality of life: tapping any benefit tile when the form is
  // already off-screen scrolls back up to it. On desktop the tiles and form
  // are side-by-side so this is a no-op (we don't bind the click handler).
  const scrollToForm = (e) => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
    const target = document.getElementById('auth-form-anchor');
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative eh-grid-bg px-3 sm:px-6 py-8 sm:py-14 overflow-hidden">
      {/* Ambient gradient blobs — friendly, soft, never aggressive */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-30 blur-3xl" style={{ background: '#00ff9d' }} />
      <div aria-hidden className="pointer-events-none absolute top-12 right-0 w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background: '#ff2d92' }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 w-72 h-72 rounded-full opacity-15 blur-3xl" style={{ background: '#4de0ff' }} />

      <div className="max-w-6xl mx-auto relative grid lg:grid-cols-[1fr_440px] gap-7 lg:gap-12 items-center">
        {/* LEFT — welcome + benefit tiles */}
        <div className="relative order-2 lg:order-1">
          <div className="flex items-center gap-3 mb-5 sm:mb-6">
            <Logo size={42} />
            <div>
              <div className="eh-mono text-[10px] sm:text-[11px] tracking-[0.3em]" style={{ color: 'var(--eh-green)' }}>// {kicker}</div>
              <div className="eh-mono text-[10px] opacity-55 mt-0.5">errorhacker · safe · friendly</div>
            </div>
          </div>

          <h1
            className="eh-display font-black leading-[1.08] mb-3"
            style={{ fontSize: 'clamp(1.7rem, 5.5vw, 3rem)', letterSpacing: '-.02em' }}
            data-testid="auth-title"
          >
            {title}
          </h1>
          <p className="text-sm sm:text-base opacity-78 mb-6 sm:mb-7 max-w-md leading-relaxed" style={{ fontFamily: 'Inter,sans-serif' }}>
            {subtitle}
          </p>

          {/* Multi-color benefit tiles — stacked on desktop, 3-up strip on mobile */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-2.5 sm:gap-3 max-w-md" data-testid="auth-benefits">
            {BENEFITS.map(({ Icon, color, title: t, sub }, i) => (
              <button
                type="button"
                key={i}
                onClick={scrollToForm}
                aria-label={`${t} — tap to go to the form`}
                data-testid={`auth-benefit-${i}`}
                className="auth-benefit-tile relative overflow-hidden rounded-xl border p-3 lg:p-4 transition-all text-left lg:cursor-default"
                style={{
                  borderColor: `${color}55`,
                  background: `linear-gradient(135deg, ${color}12, transparent 65%)`,
                  animationDelay: `${i * 90}ms`,
                  '--c': color,
                }}
              >
                <span
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                />
                <div
                  className="w-9 h-9 rounded-lg grid place-items-center mb-2"
                  style={{ background: `${color}1a`, border: `1px solid ${color}55`, color }}
                >
                  <Icon size={16} strokeWidth={1.8} />
                </div>
                <div className="text-[12px] sm:text-sm font-bold leading-tight" style={{ fontFamily: 'Inter,sans-serif' }}>{t}</div>
                <div className="eh-mono text-[9px] sm:text-[10px] opacity-65 mt-0.5">{sub}</div>
                <div className="lg:hidden eh-mono text-[9px] opacity-50 mt-1.5">↑ tap to sign in</div>
              </button>
            ))}
          </div>

          {/* Friendly social-proof + safety chip */}
          <div className="flex flex-wrap items-center gap-2 mt-5 sm:mt-7 opacity-90">
            <span className="eh-mono text-[10px] sm:text-[11px] tracking-widest inline-flex items-center gap-1.5">
              <Sparkles size={12} className="text-[var(--eh-green)]" /> 12,000+ creators on board
            </span>
            <span className="eh-mono text-[10px] sm:text-[11px] tracking-widest inline-flex items-center gap-1.5 opacity-80">
              <Lock size={12} className="text-[#4de0ff]" /> Zero-log policy
            </span>
          </div>
        </div>

        {/* RIGHT — friendly form panel */}
        <div className="relative order-1 lg:order-2">
          <div id="auth-form-anchor" aria-hidden className="absolute -top-3 left-0 right-0 h-0" />
          <div
            className="eh-panel eh-brackets p-5 sm:p-7"
            style={{ background: 'rgba(8,10,12,.92)', backdropFilter: 'blur(10px)' }}
          >
            <span className="br-bl" /><span className="br-br" />
            {children}
            {footer && (
              <div
                className="mt-6 text-center text-xs sm:text-sm opacity-90"
                style={{ fontFamily: 'Inter,sans-serif' }}
              >
                {footer}
              </div>
            )}
          </div>
          <div className="mt-3 px-1 eh-mono text-[10px] opacity-55 text-center leading-relaxed">
            By continuing you agree to our terms · we never share your data
          </div>
        </div>
      </div>

      <style>{`
        .auth-benefit-tile { animation: eh-fade-up .55s cubic-bezier(.2,.9,.3,1) backwards; }
        .auth-benefit-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px -14px var(--c);
        }
        @keyframes eh-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
};

export default AuthShell;
