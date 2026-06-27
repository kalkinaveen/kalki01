import React from 'react';
import { Zap, Wallet } from 'lucide-react';

/**
 * Compact usage bar shown above an AI tool's form.
 * Props: { used, freeLimit, walletCost, balance, paidUses, loading }
 */
const ToolsUsageBar = ({ used = 0, freeLimit = 0, walletCost = 0, balance = null, paidUses = 0, loading = false }) => {
  const remaining = Math.max(0, freeLimit - used);
  const pct = freeLimit ? Math.min(100, (used / freeLimit) * 100) : 0;
  const colour = remaining === 0 ? '#ff3148' : remaining <= 1 ? '#ffd34d' : '#00ff9d';

  if (loading) {
    return (
      <div className="rounded-md p-3 mb-4 eh-mono text-[11px] tracking-widest opacity-50 border border-[var(--eh-border)] bg-[#0d1115]" data-testid="usage-bar-loading">
        // checking your daily quota …
      </div>
    );
  }

  return (
    <div
      className="rounded-md p-3 mb-4 border bg-[#0d1115]"
      style={{ borderColor: `${colour}55`, borderLeft: `3px solid ${colour}` }}
      data-testid="usage-bar"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Zap size={13} color={colour} />
          <span className="eh-mono text-[11px] tracking-widest font-bold" style={{ color: colour }}>
            FREE TODAY · {remaining}/{freeLimit}
          </span>
          {paidUses > 0 && (
            <span className="eh-mono text-[10px] tracking-widest opacity-60">
              +{paidUses} wallet-paid
            </span>
          )}
        </div>
        {walletCost > 0 && (
          <div className="flex items-center gap-2 eh-mono text-[10px] tracking-widest opacity-75">
            <Wallet size={11} />
            <span>AFTER FREE · <b style={{ color: 'var(--eh-green)' }}>₹{walletCost}</b> / use</span>
            {balance !== null && balance !== undefined && (
              <span className="opacity-70">· balance ₹{Number(balance).toFixed(0)}</span>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 h-1 rounded-full overflow-hidden bg-[var(--eh-border)]">
        <div style={{ width: `${pct}%`, background: colour, height: '100%', boxShadow: `0 0 6px ${colour}` }} />
      </div>
    </div>
  );
};

export default ToolsUsageBar;
