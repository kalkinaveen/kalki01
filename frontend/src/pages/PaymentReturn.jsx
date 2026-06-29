import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle, ArrowRight, Wallet as WalletIcon } from 'lucide-react';
import { api } from '../lib/api';

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

const PaymentReturn = () => {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const cfOrderId = params.get('order_id') || params.get('cf');
  const [status, setStatus] = useState('CHECKING');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!cfOrderId) { setStatus('NO_ID'); return; }
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      try {
        const r = await api.cashfreeStatus(cfOrderId);
        if (stop) return;
        setStatus(r.order_status || 'CHECKING');
        if (['PAID', 'EXPIRED', 'TERMINATED', 'FAILED'].includes(r.order_status)) return;
      } catch (_e) { /* noop */ }
      setElapsed(Date.now() - started);
      if (Date.now() - started > POLL_TIMEOUT_MS) { setStatus('TIMEOUT'); return; }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
    return () => { stop = true; };
  }, [cfOrderId]);

  // Auto-redirect on success
  useEffect(() => {
    if (status !== 'PAID') return;
    let next;
    try { next = sessionStorage.getItem('eh_payment_redirect'); sessionStorage.removeItem('eh_payment_redirect'); } catch (_e) { /* noop */ }
    const t = setTimeout(() => nav(next || '/me/wallet'), 2200);
    return () => clearTimeout(t);
  }, [status, nav]);

  const headline = status === 'PAID'
    ? 'Payment received — wallet updated'
    : status === 'CHECKING'
      ? 'Confirming your payment…'
      : status === 'TIMEOUT'
        ? 'Still confirming — check back in a moment'
        : status === 'NO_ID'
          ? 'Missing order id'
          : `Payment ${status}`;

  const Icon = status === 'PAID' ? CheckCircle2 : ['EXPIRED', 'TERMINATED', 'FAILED'].includes(status) ? XCircle : Loader2;
  const color = status === 'PAID' ? 'var(--eh-green)' : ['EXPIRED', 'TERMINATED', 'FAILED'].includes(status) ? '#ff6b6b' : 'var(--eh-green)';

  return (
    <section className="min-h-[60vh] grid place-items-center px-4">
      <div className="eh-panel eh-brackets p-8 max-w-md w-full text-center" data-testid="payment-return">
        <span className="br-bl" /><span className="br-br" />
        <div className="mx-auto w-16 h-16 rounded-full grid place-items-center mb-5" style={{ background: 'rgba(0,255,157,.08)', border: `1px solid ${color}`, boxShadow: `0 0 24px ${color}33` }}>
          <Icon size={28} color={color} className={status === 'CHECKING' ? 'animate-spin' : ''} />
        </div>
        <h1 className="eh-display text-xl font-black mb-2">{headline}</h1>
        <p className="eh-mono text-[11px] opacity-70 mb-5">Order ID · <code>{cfOrderId || '—'}</code></p>
        {status === 'PAID' && <p className="eh-mono text-[11px] opacity-60 mb-4">Redirecting in a moment…</p>}
        <div className="flex flex-col gap-2">
          <Link to="/me/wallet" className="eh-btn-primary text-xs inline-flex items-center justify-center gap-1.5" data-testid="payment-return-wallet">
            <WalletIcon size={12} /> OPEN MY WALLET
          </Link>
          <Link to="/" className="eh-btn-ghost text-xs">BACK TO HOME</Link>
        </div>
      </div>
    </section>
  );
};

export default PaymentReturn;
