import React from 'react';
import { ShieldAlert, Info, ShieldCheck } from 'lucide-react';

/**
 * SafetyTipsCard — reusable warning/info card.
 * variant: "warn" (amber) | "info" (cyan) | "ok" (green)
 */
const STYLES = {
  warn: {
    Icon: ShieldAlert,
    color: '#ffd34d',
    label: 'SAFETY PRECAUTIONS',
  },
  info: {
    Icon: Info,
    color: '#4de0ff',
    label: 'GOOD TO KNOW',
  },
  ok: {
    Icon: ShieldCheck,
    color: '#00ff9d',
    label: 'BEST PRACTICES',
  },
};

const SafetyTipsCard = ({ tips = [], variant = 'warn', title }) => {
  const conf = STYLES[variant] || STYLES.warn;
  const Icon = conf.Icon;
  if (!tips.length) return null;
  return (
    <div
      className="rounded-lg p-4 sm:p-5 mt-5"
      style={{
        background: `linear-gradient(135deg, ${conf.color}0d 0%, transparent 100%)`,
        border: `1px solid ${conf.color}55`,
        borderLeft: `3px solid ${conf.color}`,
      }}
      data-testid={`safety-card-${variant}`}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={16} color={conf.color} />
        <span className="eh-mono text-[10px] tracking-widest font-bold" style={{ color: conf.color }}>
          {title || conf.label}
        </span>
      </div>
      <ul className="space-y-1.5">
        {tips.map((t, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed opacity-90" style={{ fontFamily: 'Inter, sans-serif' }}>
            <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full" style={{ background: conf.color, boxShadow: `0 0 6px ${conf.color}` }} />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SafetyTipsCard;
