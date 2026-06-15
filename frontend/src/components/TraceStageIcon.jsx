import React from 'react';
import { CheckCircle2, Package, FileSearch, Handshake, Clock, ShieldCheck, Search } from 'lucide-react';

/**
 * Premium animated stage icon for the case trace timeline.
 *
 * Three distinct visual states — each with its own animation language:
 *
 *  1. DONE    (past stages)    → solid green tile · ✓ check · soft success-pulse
 *  2. CURRENT (live stage)     → pulsing halo + radar ping + orbiting sparkles
 *                                + a "// LIVE" tag in the trace row
 *  3. PENDING (future stages)  → dimmed dashed tile · gentle drift float
 *
 * Strict black + neon-green theme; we do not introduce extra colors.
 */
const STAGE_ICON_MAP = {
  // recovery
  new: Package,
  reviewing: FileSearch,
  engaged: Handshake,
  recovering: Clock,
  recovered: CheckCircle2,
  // order
  received: Package,
  verified: ShieldCheck,
  'in-progress': Clock,
  delivered: CheckCircle2,
};

const TraceStageIcon = ({ stageKey, icon, state = 'pending' }) => {
  const Icon = icon || STAGE_ICON_MAP[stageKey] || Search;
  // ── DONE ─────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="trace-stage trace-done relative w-10 h-10 sm:w-11 sm:h-11 rounded-full grid place-items-center shrink-0 border-[1.5px] border-[var(--eh-green)] bg-[rgba(0,255,157,.12)]" data-testid={`trace-stage-${stageKey}-done`}>
        <CheckCircle2 size={16} className="text-[var(--eh-green)] trace-done-icon" strokeWidth={2.4} />
      </div>
    );
  }
  // ── CURRENT ─────────────────────────────────────────────────
  if (state === 'current') {
    return (
      <div className="trace-stage trace-current relative w-10 h-10 sm:w-11 sm:h-11 rounded-full grid place-items-center shrink-0" data-testid={`trace-stage-${stageKey}-current`}>
        {/* radar ping — two staggered rings */}
        <span className="trace-ring trace-ring-1" />
        <span className="trace-ring trace-ring-2" />
        {/* orbiting sparkles */}
        <span className="trace-spark trace-spark-1">✦</span>
        <span className="trace-spark trace-spark-2">·</span>
        <span className="trace-spark trace-spark-3">✦</span>
        <div className="relative w-full h-full rounded-full grid place-items-center bg-[#0d1115] border-[1.5px] border-[var(--eh-green)]" style={{ boxShadow: '0 0 20px rgba(0,255,157,.55), inset 0 0 10px rgba(0,255,157,.18)' }}>
          <Icon size={17} className="text-[var(--eh-green)] trace-current-icon" strokeWidth={2} />
        </div>
      </div>
    );
  }
  // ── PENDING ─────────────────────────────────────────────────
  return (
    <div className="trace-stage trace-pending relative w-10 h-10 sm:w-11 sm:h-11 rounded-full grid place-items-center shrink-0 border border-dashed border-[var(--eh-border)] bg-transparent" data-testid={`trace-stage-${stageKey}-pending`}>
      <Icon size={15} className="opacity-30 trace-pending-icon" strokeWidth={1.8} />
    </div>
  );
};

export default TraceStageIcon;
