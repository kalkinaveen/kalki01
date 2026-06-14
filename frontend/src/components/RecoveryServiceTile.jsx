import React from 'react';
import { Instagram, Facebook, Youtube, Twitter, Linkedin, MessageCircle, Mail, Hash, Music2, Ghost, Send, Lock, Shield, Gamepad2, Phone, ShieldCheck, BadgeCheck, KeyRound, Globe, AtSign, CheckCircle2 } from 'lucide-react';

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

/**
 * Premium service tile.
 * - Animated brand badge (pulsing halo + floating motion + 4 orbiting sparkles)
 * - Gradient sweep on hover (Telegram-Premium-style shine)
 * - PREMIUM badge auto-shown when price_min >= ₹5,000
 * - Selected state: green border + soft fill + check icon
 * - Keeps the strict black + neon-green theme; brand color used only as accent
 */
const RecoveryServiceTile = ({ service: s, selected, onClick }) => {
  const { Icon, color } = resolveBrand(s.issue_key);
  const isPremium = (s.price_min || 0) >= 5000;
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

      {/* premium accent corner */}
      {isPremium && (
        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full eh-mono text-[8px] font-bold tracking-widest bg-[#ffd34d] text-black z-10" data-testid={`recovery-premium-${s.issue_key}`}>
          <span className="rt-star">✦</span> PREMIUM
        </span>
      )}

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start gap-3.5 mb-3">
          {/* Animated brand badge */}
          <div className="rt-badge relative shrink-0">
            {/* soft pulsing halo behind icon */}
            <span className="rt-halo" />
            {/* 4 orbiting sparkles, like premium emoji */}
            <span className="rt-spark rt-spark-1">✦</span>
            <span className="rt-spark rt-spark-2">·</span>
            <span className="rt-spark rt-spark-3">✦</span>
            <span className="rt-spark rt-spark-4">·</span>
            <div className="rt-icon relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl grid place-items-center bg-[#0d1115] border border-[var(--eh-border)] group-hover:border-[var(--brand-color)] transition-all">
              <Icon size={22} style={{ color }} className="rt-icon-img" strokeWidth={1.8} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-bold text-base leading-snug break-words flex-1 min-w-0" style={{ fontFamily: 'Inter, sans-serif' }}>{s.name}</div>
              {selected && <CheckCircle2 size={18} className="text-[var(--eh-green)] shrink-0 mt-0.5" />}
            </div>
            <div className="flex items-center gap-2 eh-mono text-[11px] opacity-75 mt-1 flex-wrap">
              <span>ETA {s.eta_min_days}–{s.eta_max_days}d</span>
              <span className="opacity-50">·</span>
              <span style={{ color: 'var(--eh-green)' }}>{s.success_rate}% success</span>
            </div>
          </div>
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
