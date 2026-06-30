import React, { useEffect } from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import TierBadge from './TierBadge';

/**
 * TierUpCelebration — fullscreen modal that fires when a user upgrades their
 * OPERATIVE PASS. CSS-only confetti (~30 absolutely-positioned divs) keeps
 * the bundle slim while still feeling royal.
 *
 * Auto-dismisses after ~5s if the user doesn't click.
 */
const COLORS = ['#00ff9d', '#4de0ff', '#ffd34d', '#ff2d92', '#c084fc', '#ff7a3d'];

const TierUpCelebration = ({ tier, onClose }) => {
  useEffect(() => {
    if (!tier) return;
    const t = setTimeout(onClose, 5500);
    return () => clearTimeout(t);
  }, [tier, onClose]);

  if (!tier) return null;
  const color = tier.color || '#00ff9d';

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/85 backdrop-blur-md"
      onClick={onClose}
      data-testid="tier-up-celebration"
    >
      {/* Confetti shower */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-0 block tu-piece"
            style={{
              left: `${(i * 2.7) % 100}%`,
              width: 8,
              height: 14,
              background: COLORS[i % COLORS.length],
              opacity: 0.9,
              borderRadius: 2,
              animationDelay: `${(i % 10) * 0.18}s`,
              animationDuration: `${2.4 + ((i * 13) % 9) / 10}s`,
              transform: `rotate(${(i * 47) % 360}deg)`,
            }}
          />
        ))}
      </div>

      {/* Center card */}
      <div
        className="relative max-w-md mx-3 rounded-2xl border-2 p-6 sm:p-9 text-center"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, rgba(20,18,28,.95), rgba(8,10,12,.97))',
          borderColor: color,
          boxShadow: `0 0 60px ${color}88, 0 0 130px ${color}33`,
        }}
      >
        <div className="grid place-items-center mb-4">
          <div
            className="w-20 h-20 rounded-full grid place-items-center tu-trophy"
            style={{ background: `${color}22`, border: `2px solid ${color}`, color }}
          >
            <Trophy size={36} strokeWidth={2.2} />
          </div>
        </div>
        <div className="eh-mono text-[11px] tracking-[0.4em] mb-2" style={{ color }}>// TIER UNLOCKED</div>
        <h2 className="font-black text-3xl sm:text-4xl mb-2" style={{ fontFamily: "'Cinzel', serif", color }}>
          {tier.name.toUpperCase()}
        </h2>
        <p className="text-sm opacity-80 mb-4" style={{ fontFamily: 'Inter,sans-serif' }}>
          {tier.tagline || "Welcome to the next floor."}
        </p>
        <div className="flex justify-center mb-5">
          <TierBadge tier={tier} size="lg" testIdSuffix="-celebration" />
        </div>
        <p className="eh-mono text-[11px] opacity-65 leading-relaxed">
          The queue just lost you. Recovery SLA dropped to <b style={{ color }}>{tier.recovery_sla_hours === 0 ? 'instant' : `${tier.recovery_sla_hours}h`}</b>, SMM orders auto-discount <b style={{ color }}>{tier.smm_discount_pct}%</b>, AI tools refreshed to <b style={{ color }}>{tier.tool_uses_per_day >= 999 ? 'unlimited' : tier.tool_uses_per_day}/day</b>.
        </p>
        <button
          onClick={onClose}
          className="mt-6 eh-mono text-[11px] tracking-[0.3em] font-bold px-6 py-2.5 rounded-md transition-all hover:brightness-110"
          style={{ background: color, color: '#000' }}
          data-testid="tier-up-dismiss"
        >
          <Sparkles size={12} className="inline -mt-0.5 mr-1.5" />
          ENTER THE WAR ROOM
        </button>
      </div>

      <style>{`
        .tu-piece {
          animation: tu-fall linear forwards;
        }
        @keyframes tu-fall {
          0%   { transform: translateY(-10vh) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(720deg); }
        }
        .tu-trophy {
          animation: tu-pop .6s cubic-bezier(.2,.9,.3,1.4) backwards, tu-spin 6s linear infinite 1s;
        }
        @keyframes tu-pop  { from { transform: scale(0) rotate(-30deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes tu-spin { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
      `}</style>
    </div>
  );
};

export default TierUpCelebration;
