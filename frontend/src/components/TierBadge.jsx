import React from 'react';
import { User, ShieldCheck, Crown, Flame } from 'lucide-react';

/**
 * TierBadge — small animated pill showing the user's OPERATIVE PASS tier.
 * Used everywhere a user is identified: dashboard hero, tracker, smm cart,
 * recovery case, comments. Each tier has its own colour and icon.
 *
 * - size="sm" : compact inline next-to-name version (default, 22px tall)
 * - size="md" : profile/card version (32px tall)
 * - size="lg" : hero/celebration version (44px tall, with halo)
 *
 * The halo is only shown for paid tiers (rank >= 1) — keeps the badge from
 * pulsing on Rookie users (who haven't paid for the flex).
 */
const ICONS = { user: User, shield: ShieldCheck, crown: Crown, flame: Flame };

const TierBadge = ({ tier, size = 'sm', withHalo = true, withName = true, testIdSuffix = '' }) => {
  if (!tier) return null;
  const Icon = ICONS[tier.icon] || User;
  const color = tier.color || tier.accent || '#9ca3af';
  const isPaid = (tier.rank ?? 0) >= 1;
  const showHalo = withHalo && isPaid;

  const sizes = {
    sm: { h: 22, fs: 10, pad: '0 8px', icon: 11 },
    md: { h: 32, fs: 12, pad: '0 12px', icon: 14 },
    lg: { h: 44, fs: 14, pad: '0 16px', icon: 18 },
  };
  const s = sizes[size] || sizes.sm;

  return (
    <span
      className="tier-badge relative inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-widest whitespace-nowrap"
      style={{
        height: s.h,
        padding: s.pad,
        fontSize: s.fs,
        fontFamily: "'Cinzel', 'Space Grotesk', serif",
        color,
        borderColor: `${color}88`,
        background: `linear-gradient(135deg, ${color}1a, ${color}05 80%)`,
        boxShadow: showHalo ? `0 0 16px ${color}55, inset 0 0 8px ${color}22` : 'none',
        letterSpacing: '0.15em',
      }}
      data-testid={`tier-badge${testIdSuffix}`}
    >
      {showHalo && (
        <span
          aria-hidden
          className="tier-badge-halo absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: `0 0 0 1px ${color}33`,
            animation: 'eh-tier-pulse 2.6s ease-in-out infinite',
          }}
        />
      )}
      <Icon size={s.icon} strokeWidth={2} />
      {withName && <span>{tier.name}</span>}
      <style>{`
        @keyframes eh-tier-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${color}55; }
          50%      { box-shadow: 0 0 0 5px ${color}00; }
        }
      `}</style>
    </span>
  );
};

export default TierBadge;
