import React from 'react';
import { Instagram, Facebook, Youtube, Twitter, Linkedin, MessageCircle, Mail, Hash, Music2, Ghost, Send, Lock, Shield, Gamepad2, Phone, ShieldCheck, BadgeCheck, KeyRound, Globe, AtSign, CheckCircle2, ArrowRight, Flame, Zap, Sparkles, Crown } from 'lucide-react';

/**
 * Maps a service.issue_key (or platform key) → { Icon, color, ring }
 * `color` drives the icon stroke, glow ring, and tint of the soft halo.
 * Falls back to a generic globe with neon green when unknown.
 */
const BRAND_MAP = {
  // issue_key → brand
  disabled:    { Icon: ShieldCheck,  color: '#ff6b6b' },
  hacked:      { Icon: Shield,       color: '#4de0ff' },
  '2fa':       { Icon: KeyRound,     color: '#ffd34d' },
  gmail:       { Icon: Mail,         color: '#ea4335' },
  whatsapp:    { Icon: MessageCircle, color: '#25d366' },
  telegram:    { Icon: Send,         color: '#229ed9' },
  discord:     { Icon: Hash,         color: '#5865f2' },
  tiktok:      { Icon: Music2,       color: '#fe2c55' },
  twitter:     { Icon: Twitter,      color: '#1da1f2' },
  snapchat:    { Icon: Ghost,        color: '#fffc00' },
  linkedin:    { Icon: Linkedin,     color: '#0a66c2' },
  gaming:      { Icon: Gamepad2,     color: '#a78bfa' },
  simswap:     { Icon: Phone,        color: '#fb923c' },
  privacy:     { Icon: Lock,         color: '#00ff9d' },
  username:    { Icon: AtSign,       color: '#00ff9d' },
  verification:{ Icon: BadgeCheck,   color: '#00d4ff' },
  password:    { Icon: KeyRound,     color: '#facc15' },
  instagram:   { Icon: Instagram,    color: '#e1306c' },
  facebook:    { Icon: Facebook,     color: '#1877f2' },
  youtube:     { Icon: Youtube,      color: '#ff0000' },
};

const resolveBrand = (key) => BRAND_MAP[(key || '').toLowerCase()] || { Icon: Globe, color: '#00ff9d' };

const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Renders the animated TAG badge on the tile.
 * Each tag has its own colour + icon + bespoke micro-animation so users
 * instantly read the intent (PREMIUM vs HOT vs LIMITED etc).
 */
const TAG_THEMES = {
  PREMIUM:    { Icon: Crown,    bg: '#ffd34d', fg: '#000', anim: 'tag-premium',    label: 'PREMIUM' },
  HOT:        { Icon: Flame,    bg: '#ff6b3a', fg: '#fff', anim: 'tag-hot',        label: 'HOT' },
  NEW:        { Icon: Sparkles, bg: '#00ff9d', fg: '#000', anim: 'tag-new',        label: 'NEW' },
  BESTSELLER: { Icon: Sparkles, bg: '#c084fc', fg: '#fff', anim: 'tag-bestseller', label: 'BESTSELLER' },
  LIMITED:    { Icon: Zap,      bg: '#4de0ff', fg: '#000', anim: 'tag-limited',    label: 'LIMITED' },
  FAST:       { Icon: Zap,      bg: '#facc15', fg: '#000', anim: 'tag-fast',       label: 'FAST' },
  SECURE:     { Icon: Shield,   bg: '#22d3ee', fg: '#000', anim: 'tag-secure',     label: 'SECURE' },
};

const TagBadge = ({ tag }) => {
  const t = TAG_THEMES[String(tag || '').toUpperCase()];
  if (!t) return null;
  const { Icon, bg, fg, anim, label } = t;
  return (
    <span
      className={`tag-badge ${anim} absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full eh-mono text-[9px] font-bold tracking-widest z-10`}
      style={{ background: bg, color: fg, '--tag-bg': bg }}
      data-testid={`recovery-tag-${label.toLowerCase()}`}
    >
      <Icon size={9} strokeWidth={2.6} className="tag-badge-icon" />
      <span>{label}</span>
    </span>
  );
};

/**
 * Premium service tile.
 * - Animated brand badge (pulsing halo + floating motion + 4 orbiting sparkles)
 * - "FROM ₹X" price pill always visible
 * - Inline NEXT arrow when selected — no scrolling to find a global Next button
 * - Animated TAG badge driven by service.tag (admin-controlled from webpanel)
 *   Falls back to auto-PREMIUM if price_min >= ₹5,000 and no explicit tag is set
 * - Strict black + neon-green theme; brand color used only as accent
 */
const RecoveryServiceTile = ({ service: s, selected, onClick, onNext }) => {
  const { Icon, color } = resolveBrand(s.issue_key);
  const effectiveTag = s.tag || ((s.price_min || 0) >= 5000 ? 'PREMIUM' : '');
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`recovery-svc-${s.issue_key}`}
      className={`recovery-tile group relative text-left rounded-lg border min-w-0 overflow-hidden transition-all duration-300 ${selected ? 'border-[var(--eh-green)] bg-[rgba(0,255,157,.06)]' : 'border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
      style={{ '--brand-color': color }}
    >
      {/* hover gradient sweep — only fires on hover */}
      <span className="rt-shine pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Animated TAG badge (admin-controlled) */}
      <TagBadge tag={effectiveTag} />

      <div className="relative p-3.5 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-3.5 mb-3">
          {/* Animated brand badge */}
          <div className="rt-badge relative shrink-0">
            <span className="rt-halo" />
            <span className="rt-spark rt-spark-1">✦</span>
            <span className="rt-spark rt-spark-2">·</span>
            <span className="rt-spark rt-spark-3">✦</span>
            <span className="rt-spark rt-spark-4">·</span>
            <div className="rt-icon relative w-11 h-11 sm:w-14 sm:h-14 rounded-xl grid place-items-center bg-[#0d1115] border border-[var(--eh-border)] group-hover:border-[var(--brand-color)] transition-all">
              <Icon size={20} style={{ color }} className="rt-icon-img sm:!w-[22px] sm:!h-[22px]" strokeWidth={1.8} />
            </div>
          </div>

          <div className="min-w-0 flex-1 pr-16 sm:pr-20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-bold text-[15px] sm:text-base leading-snug break-words flex-1 min-w-0" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{s.name}</div>
              {selected && <CheckCircle2 size={16} className="text-[var(--eh-green)] shrink-0 mt-0.5" />}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 eh-mono text-[10px] sm:text-[11px] opacity-75 mt-1 flex-wrap">
              <span>ETA {s.eta_min_days}–{s.eta_max_days}d</span>
              <span className="opacity-50">·</span>
              <span style={{ color: 'var(--eh-green)' }}>{s.success_rate}% success</span>
            </div>
          </div>
        </div>

        {/* Price pill + inline next button row */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border border-[var(--eh-border)] bg-[#0d1115]" data-testid={`recovery-price-${s.issue_key}`}>
            <span className="eh-mono text-[9px] opacity-60 tracking-widest">FROM</span>
            <span className="font-black text-base eh-neon" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{formatINR(s.price_min)}</span>
            {s.price_max && s.price_max !== s.price_min && (
              <span className="eh-mono text-[10px] opacity-50">– {formatINR(s.price_max)}</span>
            )}
          </div>
          {/* Inline NEXT arrow — only shows when this tile is selected. */}
          {selected && onNext && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onNext(); } }}
              data-testid={`recovery-tile-next-${s.issue_key}`}
              className="rt-next inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md eh-mono text-[11px] font-bold tracking-widest text-black bg-[var(--eh-green)] hover:brightness-110 cursor-pointer"
            >
              NEXT <ArrowRight size={12} />
            </span>
          )}
        </div>

        <div className="space-y-1.5 pl-1">
          {(s.bullets || []).slice(0, 3).map((b, i) => (
            <div key={i} className="eh-mono text-[12px] opacity-80 flex gap-1.5 leading-[1.45] break-words">
              <span className="text-[var(--eh-green)] shrink-0">›</span>
              <span className="min-w-0">{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* bottom strip for selected/hover signal */}
      <span className={`block h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--brand-color)] to-transparent transition-opacity duration-300 ${selected ? 'opacity-90' : 'opacity-0 group-hover:opacity-70'}`} />
    </button>
  );
};

export default RecoveryServiceTile;
