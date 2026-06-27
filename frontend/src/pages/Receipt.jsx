import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Printer, Download, ArrowLeft, Check, X, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const TYPE_LABEL = {
  credit: 'Wallet Top-up',
  debit: 'Wallet Debit',
  spin: 'Spin Reward',
  cashback: 'Cashback',
  refund: 'Refund',
};

const Receipt = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [txn, setTxn] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const r = await api.walletTxn(id);
        setTxn(r);
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, [id, user, authLoading]);

  if (authLoading || loading) {
    return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  }
  if (!user) {
    return (
      <section className="min-h-[60vh] grid place-items-center">
        <Link to={`/login?next=/receipt/${id}`} className="eh-btn-primary" data-testid="receipt-login">Sign in to view receipt</Link>
      </section>
    );
  }
  if (err || !txn) {
    return (
      <section className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="eh-display text-2xl font-black mb-2">Receipt not found</div>
        <p className="eh-mono text-xs opacity-70 mb-6">{err || 'This transaction does not exist or does not belong to your account.'}</p>
        <Link to="/me/wallet" className="eh-btn-primary text-xs" data-testid="receipt-back">← BACK TO WALLET</Link>
      </section>
    );
  }

  const isCredit = ['credit', 'spin', 'cashback', 'refund'].includes(txn.type);
  const sign = isCredit ? '+' : '−';
  const amt = Number(txn.amount || 0);
  const ref = txn.ref || {};

  return (
    <section className="max-w-2xl mx-auto px-4 py-8 sm:py-12 print:py-2" data-testid="receipt-page">
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <Link to="/me/wallet" className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="receipt-back-btn">
          <ArrowLeft size={12} /> BACK TO WALLET
        </Link>
        <button onClick={() => window.print()} className="eh-btn-primary text-xs inline-flex items-center gap-1.5" data-testid="receipt-print">
          <Printer size={12} /> PRINT / SAVE PDF
        </button>
      </div>

      <div className="eh-panel eh-brackets p-6 sm:p-9 bg-[rgba(0,255,157,.03)] border border-[rgba(0,255,157,.18)]">
        <span className="br-bl" /><span className="br-br" />

        {/* Brand header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-5 border-b border-[var(--eh-border)]">
          <div>
            <div className="eh-mono text-[10px] tracking-widest opacity-60">// RECEIPT</div>
            <div className="eh-display text-2xl font-black eh-neon-soft">ERRORHACKER</div>
            <div className="eh-mono text-[10px] opacity-50">errorhacker.site</div>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded eh-mono text-[10px] tracking-widest font-bold ${isCredit ? 'bg-[rgba(0,255,157,.12)] text-[var(--eh-green)] border border-[rgba(0,255,157,.3)]' : 'bg-red-400/10 text-red-300 border border-red-400/30'}`}>
              {isCredit ? <Check size={11} /> : <X size={11} />} {isCredit ? 'CREDIT' : 'DEBIT'}
            </div>
            <div className="eh-mono text-[11px] opacity-60 mt-1.5">{(txn.createdAt || '').slice(0, 19).replace('T', ' ')}</div>
          </div>
        </div>

        {/* Amount hero */}
        <div className="text-center py-7 border-b border-[var(--eh-border)]">
          <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-2">{TYPE_LABEL[txn.type] || txn.type?.toUpperCase()}</div>
          <div className={`eh-display font-black ${isCredit ? 'eh-neon' : 'text-red-300'}`} style={{ fontSize: 'clamp(2.6rem, 9vw, 4.5rem)', lineHeight: 1 }}>
            {sign}₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          {txn.note && <div className="eh-mono text-[11px] opacity-70 mt-3 max-w-md mx-auto leading-6">{txn.note}</div>}
        </div>

        {/* Details */}
        <div className="py-5 space-y-3 eh-mono text-xs">
          <Row k="Receipt ID" v={txn.id} mono />
          <Row k="Account" v={user.email} />
          <Row k="Transaction Type" v={TYPE_LABEL[txn.type] || txn.type} />
          {ref.method && <Row k="Payment Method" v={String(ref.method).toUpperCase()} />}
          {ref.tx_reference && <Row k="Reference / UTR" v={ref.tx_reference} mono breakAll />}
          {ref.deposit_id && <Row k="Deposit ID" v={ref.deposit_id} mono />}
          <Row k="Balance After" v={`₹${Number(txn.balance_after || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} highlight />
        </div>

        {/* Footer */}
        <div className="pt-5 border-t border-[var(--eh-border)] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 eh-mono text-[10px] opacity-70">
            <ShieldCheck size={12} className="text-[var(--eh-green)]" />
            <span>Computer-generated receipt · No signature required</span>
          </div>
          <div className="eh-mono text-[10px] opacity-50">support@errorhacker.site</div>
        </div>
      </div>

      <p className="eh-mono text-[10px] opacity-50 text-center mt-4 print:hidden">
        Need help with this transaction? Reply to your wallet credited email or DM us on Telegram.
      </p>
    </section>
  );
};

const Row = ({ k, v, mono, highlight, breakAll }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-dashed border-[var(--eh-border)]/60 last:border-0">
    <span className="opacity-60 shrink-0">{k}</span>
    <span className={`text-right ${mono ? 'font-mono' : ''} ${highlight ? 'eh-neon font-bold' : ''} ${breakAll ? 'break-all' : ''}`}>{v || '—'}</span>
  </div>
);

export default Receipt;
