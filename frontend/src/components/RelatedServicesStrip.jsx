import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Stethoscope, ShieldCheck, Zap, ArrowRight } from 'lucide-react';

/**
 * Subtle cross-service hand-off strip mounted at the bottom of every
 * service-oriented page (Tools, Recovery, SMM, Tool Diagnose, etc).
 *
 * Behaviour:
 * - 3 chips: DIAGNOSE · RECOVER · GROW
 * - Active chip = the route the user is currently on (dimmed + tag "you are here")
 * - Other two chips render as bright animated CTAs nudging the user to the next service.
 *
 * Design rules (Iter-25 cross-service flow):
 * - One subtle strip per page — never more than one cross-promo block.
 * - No popups, no toasts, no floating overlay. It lives in the natural page flow.
 * - Each chip carries the brand colour of the service it leads to.
 */
const ITEMS = [
  {
    key: 'tools',
    to: '/tools',
    matchPrefix: ['/tools'],
    label: 'DIAGNOSE',
    sub: 'Free AI utilities · breach scan, security score, issue checker',
    color: '#4de0ff',
    Icon: Stethoscope,
  },
  {
    key: 'recovery',
    to: '/recovery',
    matchPrefix: ['/recovery'],
    label: 'RECOVER',
    sub: 'Get a real engineer on your case · pay only on success',
    color: '#00ff9d',
    Icon: ShieldCheck,
  },
  {
    key: 'smm',
    to: '/smm',
    matchPrefix: ['/smm'],
    label: 'GROW',
    sub: '5,800+ verified SMM services · INR · auto-placed',
    color: '#ff2d92',
    Icon: Zap,
  },
];

const isActive = (pathname, prefixes) => prefixes.some(p => pathname.startsWith(p));

const RelatedServicesStrip = ({ title = '// RELATED SERVICES' }) => {
  const { pathname } = useLocation();
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 mt-10 sm:mt-14" data-testid="related-services-strip">
      <div className="eh-mono text-[10px] sm:text-[11px] tracking-[0.35em] opacity-55 mb-3 text-center">
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ITEMS.map(({ key, to, matchPrefix, label, sub, color, Icon }) => {
          const active = isActive(pathname, matchPrefix);
          return (
            <Link
              key={key}
              to={to}
              data-testid={`related-${key}`}
              aria-current={active ? 'page' : undefined}
              className="group relative overflow-hidden rounded-xl border transition-all p-4 flex items-start gap-3"
              style={{
                borderColor: active ? 'var(--eh-border)' : `${color}55`,
                background: active
                  ? 'rgba(255,255,255,.015)'
                  : `linear-gradient(135deg, ${color}10, transparent 70%)`,
                opacity: active ? 0.55 : 1,
                cursor: active ? 'default' : 'pointer',
                pointerEvents: active ? 'none' : 'auto',
              }}
            >
              <span
                aria-hidden
                className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
              />
              <div
                className="w-10 h-10 rounded-lg grid place-items-center shrink-0"
                style={{ background: `${color}1a`, border: `1px solid ${color}55`, color }}
              >
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="eh-mono text-[11px] sm:text-[12px] tracking-[0.25em] font-bold" style={{ color: active ? 'var(--eh-text)' : color }}>
                    {label}
                  </span>
                  {active && (
                    <span className="eh-mono text-[9px] tracking-widest px-1.5 py-0.5 rounded border border-[var(--eh-border)] opacity-80">
                      YOU ARE HERE
                    </span>
                  )}
                </div>
                <div className="text-[12px] opacity-75 leading-snug" style={{ fontFamily: 'Inter,sans-serif' }}>
                  {sub}
                </div>
              </div>
              {!active && (
                <span className="shrink-0 self-center opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color }}>
                  <ArrowRight size={16} />
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default RelatedServicesStrip;
