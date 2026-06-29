import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, LogIn, X, Sparkles, Clock, Zap } from 'lucide-react';
import CashfreeTopupModal from './CashfreeTopupModal';

/**
 * Modal shown when a tool returns 429. The `detail` shape is from backend:
 *   {
 *     limit_reached: true,
 *     tool: "breach" | "phishing" | "appeal" | "faq",
 *     free_limit: int, used: int, wallet_cost: int,
 *     auth_required?: true,
 *     top_up_required?: true,
 *     balance?: number, needed?: number, message: str
 *   }
 */
const TOOL_LABEL = {
  breach:   'Breach Checker',
  phishing: 'Phishing Detector',
  appeal:   'Appeal Generator',
  faq:      'AI FAQ Assistant',
};

const LimitReachedDialog = ({ open, detail, onClose }) => {
  const [topupOpen, setTopupOpen] = useState(false);
  if (!open || !detail) return null;

  const toolName = TOOL_LABEL[detail.tool] || 'this tool';
  const needTopUp = detail.top_up_required;
  const needAuth  = detail.auth_required;
  const need      = Math.ceil(detail.needed ?? (detail.wallet_cost ?? 0) - (detail.balance ?? 0));
  // Sensible default top-up: enough for 10 more uses, rounded to ₹50
  const suggested = Math.max(50, Math.ceil((Number(detail.wallet_cost || 5) * 10) / 50) * 50);

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-md eh-panel eh-brackets p-5 sm:p-7" onClick={e => e.stopPropagation()} data-testid="limit-reached-dialog">
        <span className="br-bl" /><span className="br-br" />
        <button onClick={onClose} className="absolute top-3 right-3 opacity-60 hover:opacity-100" aria-label="close">
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(255,211,77,.08)', border: '1px solid rgba(255,211,77,.4)' }}>
            <Clock size={22} color="#ffd34d" />
          </div>
          <div>
            <div className="eh-kicker mb-1">// FREE QUOTA USED</div>
            <h3 className="eh-display text-lg font-black leading-tight">
              You&apos;ve hit today&apos;s free limit for <span className="eh-neon">{toolName}</span>
            </h3>
          </div>
        </div>

        <div className="space-y-2 rounded-lg p-4 bg-[#0d1115] border border-[var(--eh-border)] mb-4">
          <div className="flex items-center justify-between text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            <span className="opacity-70">Free uses today</span>
            <span className="eh-mono font-bold">{detail.used}/{detail.free_limit}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-70">Cost per extra use</span>
            <span className="eh-mono font-bold" style={{ color: 'var(--eh-green)' }}>₹{detail.wallet_cost}</span>
          </div>
          {!needAuth && (
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-70">Your balance</span>
              <span className="eh-mono font-bold">₹{Number(detail.balance ?? 0).toFixed(0)}</span>
            </div>
          )}
        </div>

        <p className="text-[13px] opacity-80 mb-5 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
          {needAuth ? (
            <>Sign in to your ERRORHACKER account, top up your wallet, and keep using the tool with no daily cap.</>
          ) : needTopUp ? (
            <>Top up <b>₹{need}</b> or more to your wallet — extra uses are then auto-debited at <b>₹{detail.wallet_cost}</b> each, no separate purchase needed.</>
          ) : (
            <>Top up your wallet to continue, or wait until midnight UTC for your free quota to reset.</>
          )}
        </p>

        <div className="space-y-2">
          {needAuth ? (
            <>
              <Link to="/login" onClick={onClose} className="eh-btn-primary w-full justify-center text-xs" data-testid="limit-signin">
                <LogIn size={12} /> SIGN IN
              </Link>
              <Link to="/register" onClick={onClose} className="eh-btn-ghost w-full justify-center text-xs" data-testid="limit-register">
                <Sparkles size={12} /> CREATE ACCOUNT (FREE)
              </Link>
            </>
          ) : (
            <>
              <button onClick={() => setTopupOpen(true)} className="eh-btn-primary w-full justify-center text-xs inline-flex items-center gap-1.5" data-testid="limit-topup">
                <Zap size={12} /> ADD MONEY · CARD / UPI (INSTANT)
              </button>
              <Link to="/me/wallet" onClick={onClose} className="eh-btn-ghost w-full justify-center text-xs" data-testid="limit-topup-manual">
                <Wallet size={12} /> OPEN WALLET PAGE
              </Link>
              <button onClick={onClose} className="eh-btn-ghost w-full justify-center text-xs" data-testid="limit-wait">
                <Clock size={12} /> WAIT — RESETS AT MIDNIGHT UTC
              </button>
            </>
          )}
        </div>

        <p className="text-[10px] opacity-50 eh-mono text-center mt-4">
          · daily free quota resets at midnight UTC · wallet balance never expires
        </p>
      </div>

      <CashfreeTopupModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        suggested={suggested}
        title="QUICK TOP-UP"
        subtitle={`Add ₹${suggested} → unlocks ~${Math.floor(suggested / (Number(detail.wallet_cost) || 5))} more uses of ${toolName}.`}
        redirectBackTo={window.location.pathname}
      />
    </div>
  );
};

export default LimitReachedDialog;
