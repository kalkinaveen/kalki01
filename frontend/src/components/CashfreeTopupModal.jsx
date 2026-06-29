import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, X, ShieldCheck, Wallet as WalletIcon, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { openCashfreeCheckout, getCashfreeConfig } from '../lib/cashfree';

const PRESETS = [100, 250, 500, 1000, 2000, 5000];

/**
 * Reusable Cashfree top-up modal. Opens hosted checkout in the same tab.
 * Props:
 *   open        : boolean
 *   onClose     : fn
 *   suggested   : number      (preselects this amount if provided)
 *   minAmount   : number      (default 1)
 *   title       : string
 *   subtitle    : string
 *   redirectBackTo : string   (optional path to land on after payment)
 */
const CashfreeTopupModal = ({ open, onClose, suggested = 100, minAmount = 1, title = 'ADD MONEY', subtitle, redirectBackTo }) => {
  const [amount, setAmount] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('sandbox');
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (open) {
      setAmount(Math.max(minAmount, Number(suggested) || minAmount));
      getCashfreeConfig().then(c => { setMode(c.mode); setConfigured(!!c.configured); });
    }
  }, [open, suggested, minAmount]);

  const pay = async () => {
    if (!amount || amount < minAmount) { toast.error(`Minimum ₹${minAmount}`); return; }
    setBusy(true);
    try {
      const r = await api.cashfreeTopup({ amount: Number(amount) });
      if (!r.payment_session_id) throw new Error('Could not open checkout');
      if (redirectBackTo) {
        try { sessionStorage.setItem('eh_payment_redirect', redirectBackTo); } catch (_e) { /* noop */ }
      }
      await openCashfreeCheckout(r.payment_session_id);
      // SDK does redirect target _self, so this only continues on cancel
    } catch (e) { toast.error(e.message || 'Payment error'); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm grid place-items-center p-3" onClick={onClose}>
      <div className="w-full max-w-md eh-panel eh-brackets p-5 sm:p-6" onClick={e => e.stopPropagation()} data-testid="cashfree-topup-modal">
        <span className="br-bl" /><span className="br-br" />
        <button onClick={onClose} className="absolute top-3 right-3 opacity-60 hover:opacity-100"><X size={16} /></button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0 bg-[rgba(0,255,157,.08)] border border-[rgba(0,255,157,.4)]">
            <WalletIcon size={20} color="var(--eh-green)" />
          </div>
          <div className="min-w-0">
            <div className="eh-kicker mb-1">// {title}</div>
            <div className="eh-display text-lg font-black leading-tight">Top up your <span className="eh-neon">wallet</span></div>
            {subtitle && <div className="eh-mono text-[11px] opacity-70 mt-1 leading-5">{subtitle}</div>}
          </div>
        </div>

        {!configured && (
          <div className="eh-panel p-3 mb-4 border-amber-400/30 bg-amber-400/5">
            <div className="eh-mono text-[11px] opacity-80">Cashfree not configured yet — please use the manual UPI / Crypto option below.</div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              data-testid={`cashfree-preset-${p}`}
              className={`eh-mono text-sm py-2.5 rounded border transition-all ${amount == p ? 'border-[var(--eh-green)] bg-[rgba(0,255,157,.1)] text-[var(--eh-green)]' : 'border-[var(--eh-border)] hover:border-[rgba(0,255,157,.4)]'}`}
            >₹{p.toLocaleString('en-IN')}</button>
          ))}
        </div>

        <label className="eh-mono text-[10px] opacity-60 block mb-1.5">CUSTOM AMOUNT (₹)</label>
        <input
          type="number"
          min={minAmount}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="eh-input text-base mb-4"
          inputMode="numeric"
          data-testid="cashfree-amount"
        />

        <button
          onClick={pay}
          disabled={busy || !configured || !amount || Number(amount) < minAmount}
          className="eh-btn-primary w-full justify-center py-3 text-sm inline-flex items-center gap-2 disabled:opacity-50"
          data-testid="cashfree-pay-btn"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {busy ? 'OPENING SECURE CHECKOUT…' : `PAY ₹${Number(amount).toLocaleString('en-IN')} · CARD / UPI / NETBANKING`}
        </button>

        <div className="mt-4 flex items-center gap-2 text-[11px] eh-mono opacity-60">
          <ShieldCheck size={11} className="text-[var(--eh-green)]" />
          <span>Powered by <b>Cashfree</b> · PCI-DSS L1 · {mode === 'production' ? 'live' : 'sandbox'} mode</span>
        </div>
      </div>
    </div>
  );
};

export default CashfreeTopupModal;
