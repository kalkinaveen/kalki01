import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, LogIn, X, Sparkles, Clock, Zap, ShieldCheck, ArrowRight } from 'lucide-react';
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
 *
 * UX promise (Iter-25):
 * — Logged-in user with low balance → BOTH instant top-up and manual top-up are visible
 *   (so a Cashfree outage can never dead-end them).
 * — Anonymous user → can sign in, but ALSO sees a "Skip the cap" CTA to /recovery
 *   so they aren't forced to pay just to keep moving forward.
 */
const TOOL_LABEL = {
  breach:   'Breach Checker',
  phishing: 'Phishing Detector',
  appeal:   'Appeal Generator',
  faq:      'AI FAQ Assistant',
};

// Map each AI tool to the recovery service slug it most naturally hands off to.
// Used for the "escape hatch" CTA that takes a paywalled user straight to a free
// human-handled recovery flow instead of a dead end.
const TOOL_TO_RECOVERY = {
  breach:   'hacked',     // exposed credentials → likely account takeover risk
  phishing: 'hacked',     // got a phishy message → recovery sweep
  appeal:   'disabled',   // generating an appeal → disabled account
  faq:      'disabled',
};

const LimitReachedDialog = ({ open, detail, onClose, formStateKey = null, formState = null }) => {
  const [topupOpen, setTopupOpen] = useState(false);
  if (!open || !detail) return null;

  const toolName = TOOL_LABEL[detail.tool] || 'this tool';
  const needAuth  = detail.auth_required;
  const need      = Math.ceil(detail.needed ?? (detail.wallet_cost ?? 0) - (detail.balance ?? 0));
  const suggested = Math.max(50, Math.ceil((Number(detail.wallet_cost || 5) * 10) / 50) * 50);
  const recoveryService = TOOL_TO_RECOVERY[detail.tool] || 'disabled';

  // Stash the user's typed form state to localStorage before redirecting.
  // The tool page reads this back on mount, so users never lose work just because
  // they hit a paywall and had to sign in / top up first.
  const persistFormState = () => {
    if (formStateKey && formState) {
      try { localStorage.setItem(formStateKey, JSON.stringify(formState)); } catch { /* swallow */ }
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-md eh-panel eh-brackets p-5 sm:p-7 max-h-[92vh] overflow-y-auto relative" onClick={e => e.stopPropagation()} data-testid="limit-reached-dialog">
        <span className="br-bl" /><span className="br-br" />
        <button onClick={onClose} className="absolute top-3 right-3 opacity-60 hover:opacity-100 z-10" aria-label="close">
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

        {/* PRIMARY ACTIONS — context aware */}
        {needAuth ? (
          <>
            <p className="text-[13px] opacity-80 mb-4 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Sign in to your ERRORHACKER account, top up your wallet, and keep using this tool with no daily cap.
            </p>
            <div className="space-y-2">
              <Link to="/login" onClick={() => { persistFormState(); onClose(); }} className="eh-btn-primary w-full justify-center text-xs" data-testid="limit-signin">
                <LogIn size={12} /> SIGN IN — YOUR INPUTS ARE SAVED
              </Link>
              <Link to="/register" onClick={() => { persistFormState(); onClose(); }} className="eh-btn-ghost w-full justify-center text-xs" data-testid="limit-register">
                <Sparkles size={12} /> CREATE ACCOUNT (FREE)
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] opacity-80 mb-4 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Top up <b>₹{need > 0 ? need : suggested}</b> or more to your wallet — extra uses are then auto-debited at <b>₹{detail.wallet_cost}</b> each, no separate purchase needed.
            </p>
            {/* Two top-up paths — instant card/UPI + manual wallet page. Always BOTH visible
                so a Cashfree outage or unsupported card can never strand the user. */}
            <div className="space-y-2 mb-4">
              <button onClick={() => setTopupOpen(true)} className="eh-btn-primary w-full justify-center text-xs inline-flex items-center gap-1.5" data-testid="limit-topup">
                <Zap size={12} /> ADD MONEY · CARD / UPI · INSTANT
              </button>
              <Link to="/me/wallet" onClick={() => { persistFormState(); onClose(); }} className="eh-btn-ghost w-full justify-center text-xs" data-testid="limit-topup-manual">
                <Wallet size={12} /> MANUAL TOP-UP · UPI / CRYPTO
              </Link>
            </div>
          </>
        )}

        {/* ESCAPE HATCH — free recovery flow, regardless of auth/balance */}
        <div className="mt-4 rounded-lg p-3.5 border border-[rgba(0,255,157,.35)] bg-[rgba(0,255,157,.04)]">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-[var(--eh-green)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold leading-snug" style={{ fontFamily: 'Inter, sans-serif' }}>
                Skip the cap — let an expert take over for free.
              </div>
              <div className="text-[11px] opacity-70 mt-0.5 leading-snug">
                Submit your case to our recovery team. Free quote in 24h, pay only on success.
              </div>
              <Link
                to={`/recovery?service=${recoveryService}&from=${detail.tool || 'tool'}`}
                onClick={() => { persistFormState(); onClose(); }}
                className="mt-2.5 inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest font-bold text-black bg-[var(--eh-green)] px-3 py-1.5 rounded hover:brightness-110"
                data-testid="limit-recovery-escape"
              >
                GET FREE EXPERT HELP <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </div>

        {/* Wait + footer */}
        {!needAuth && (
          <button onClick={onClose} className="w-full mt-3 eh-mono text-[11px] tracking-widest opacity-60 hover:opacity-100 py-1.5" data-testid="limit-wait">
            <Clock size={11} className="inline -mt-0.5 mr-1.5" /> or wait — resets at midnight UTC
          </button>
        )}

        <p className="text-[10px] opacity-50 eh-mono text-center mt-3">
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
