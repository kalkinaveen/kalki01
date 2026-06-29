import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, CheckCircle2, Circle, Clock, Package, ShieldCheck, AlertCircle, ShieldAlert, FileSearch, Handshake, Send as TgIcon, RefreshCcw, X, CreditCard, Bell, RotateCcw, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import PaymentBox from '../components/PaymentBox';
import RecoveryReviewForm from '../components/RecoveryReviewForm';
import TelegramAccountCard from '../components/TelegramAccountCard';
import TraceStageIcon from '../components/TraceStageIcon';

const CURRENCY_SYM = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

/**
 * Soft Telegram connect prompt that surfaces in /track once a result is shown.
 *  - Logged-in users → reuse TelegramAccountCard (full link flow)
 *  - Anonymous users → CTA to sign in so they can link Telegram
 *  - If bot is not enabled, render nothing (TelegramAccountCard handles that gracefully)
 */
const TrackConnectTelegramCTA = () => {
  const { user, loading } = useAuth();
  const [botEnabled, setBotEnabled] = useState(true);
  useEffect(() => {
    if (user) return; // logged-in path uses the card and fetches status itself
    api.recoveryConfig().catch(() => {}); // warm cache, no-op
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/me/telegram/status`).then(() => {}).catch(() => {});
  }, [user]);
  if (loading) return null;
  if (user) return <div className="mt-6"><TelegramAccountCard /></div>;
  if (!botEnabled) return null;
  return (
    <div className="eh-panel p-5 mt-6 bg-[rgba(0,255,157,.04)] border border-[rgba(0,255,157,.25)]" data-testid="track-tg-cta-anon">
      <div className="flex items-start gap-3">
        <Bell size={18} className="text-[var(--eh-green)] mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="eh-display text-base font-bold mb-1">Get live Telegram alerts</div>
          <p className="eh-mono text-[11px] opacity-80 leading-6 mb-3">
            Sign in to your ERRORHACKER account and link <span className="eh-neon-soft">@errorhackerbot</span> — we&apos;ll DM you the moment your status changes (no more refreshing this page).
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/login" className="eh-btn-primary text-xs inline-flex items-center gap-1.5" data-testid="track-tg-cta-login"><TgIcon size={12} /> SIGN IN TO CONNECT</Link>
            <Link to="/signup" className="eh-btn-ghost text-xs">CREATE ACCOUNT</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const ORDER_STAGES = [
  { key: 'received', icon: Package, label: 'Order Received', desc: 'Encrypted handshake complete. Order queued.' },
  { key: 'verified', icon: ShieldCheck, label: 'Target Verified', desc: 'Operator confirmed target link & package size.' },
  { key: 'in-progress', icon: Clock, label: 'In Progress', desc: 'Manual delivery in motion. Drip-feed enabled.' },
  { key: 'delivered', icon: CheckCircle2, label: 'Delivered', desc: 'Package fully delivered. Refill window active for 30-60 days.' },
];

const RECOVERY_STAGES = [
  { key: 'new', icon: Package, label: 'Case Received', desc: 'Encrypted intake complete. Reviewer assigned within 24 hours.' },
  { key: 'reviewing', icon: FileSearch, label: 'Under Review', desc: 'Specialist analysing your case, proofs, and platform history.' },
  { key: 'engaged', icon: Handshake, label: 'Engagement Confirmed', desc: 'Quote accepted. Secure channel opened for recovery ops.' },
  { key: 'recovering', icon: Clock, label: 'Recovery In Progress', desc: 'Active recovery ops running. Updates posted here daily.' },
  { key: 'recovered', icon: CheckCircle2, label: 'Recovered', desc: 'Account back in your control. Verify access and confirm closure.' },
];
const RECOVERY_TERMINAL = { rejected: { label: 'Case Rejected', color: '#ff6b6b', desc: 'Case did not pass review. Reach out on Telegram for clarification.' }, closed: { label: 'Case Closed', color: 'var(--eh-green)', desc: 'Case finalised. Thanks for trusting ERRORHACKER.' } };

const REFUND_STAGES = [
  { key: 'requested', icon: RotateCcw, label: 'Refund Requested', desc: 'Customer submitted refund. Sit tight — our team is on it.' },
  { key: 'reviewing', icon: FileSearch, label: 'Under Review', desc: 'Specialist checking the order, payment trail and reason given.' },
  { key: 'approved',  icon: ShieldCheck, label: 'Approved', desc: 'Approved by the team — money is being moved.' },
  { key: 'completed', icon: CheckCircle2, label: 'Completed', desc: 'Refund applied to wallet (or original method). All done.' },
];
const REFUND_REJECTED = { label: 'Refund Rejected', color: '#ff6b6b', desc: 'Couldn\'t approve this refund. See note from the team below.' };

const inferKind = (id) => {
  const u = (id || '').trim().toUpperCase();
  if (u.startsWith('REC-')) return 'recovery';
  if (u.startsWith('RFD-')) return 'refund';
  return 'order';
};

const RefundView = ({ refund, onRefresh, refreshing }) => {
  const isRejected = refund.status === 'rejected';
  const stageIdx = REFUND_STAGES.findIndex(s => s.key === refund.status);
  const terminal = isRejected ? REFUND_REJECTED : null;

  return (
    <div className="eh-panel eh-brackets p-5 sm:p-7" data-testid="refund-track-card">
      <span className="br-bl" /><span className="br-br" />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="eh-mono text-xs opacity-60">REFUND_ID</div>
          <div className="eh-neon-soft eh-mono text-sm break-all">{refund.id}</div>
        </div>
        <div className="text-right min-w-0 max-w-full sm:max-w-[60%]">
          <div className="eh-mono text-xs opacity-60">FOR ORDER</div>
          <div className="text-sm font-semibold break-words" style={{ fontFamily: 'Inter,sans-serif' }}>
            {refund.order_id} {refund.order_service ? <span className="opacity-60">· {refund.order_service}</span> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-sm">
        <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">ORDER AMOUNT</div><div>₹{Number(refund.order_amount || 0).toLocaleString('en-IN')}</div></div>
        {refund.refund_amount > 0
          ? <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">REFUND</div><div className="eh-neon font-bold">+₹{Number(refund.refund_amount).toLocaleString('en-IN')}</div><div className="eh-mono text-[10px] opacity-50">via {refund.refund_method || 'wallet'}</div></div>
          : <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">REFUND</div><div className="opacity-60">awaiting decision</div></div>}
        <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">OPENED</div><div className="eh-mono text-xs">{(refund.createdAt || '').slice(0, 10)}</div></div>
      </div>

      {/* Status hero — mirrors recovery/order */}
      <div className="eh-panel p-4 mb-5 flex items-center justify-between flex-wrap gap-3" style={{ borderColor: terminal ? `${terminal.color}66` : 'rgba(0,255,157,.4)' }}>
        <div className="min-w-0 flex-1">
          <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1">// CURRENT STATUS</div>
          <div className="eh-display text-xl font-black" style={{ color: terminal?.color || 'var(--eh-green)' }}>{terminal ? terminal.label : (REFUND_STAGES[stageIdx]?.label || 'Pending')}</div>
          <div className="text-sm opacity-80 leading-6 mt-1">{terminal ? terminal.desc : (REFUND_STAGES[stageIdx]?.desc || 'Awaiting review.')}</div>
          {refund.admin_note && <div className="mt-2 eh-mono text-[11px] opacity-90 bg-[rgba(0,255,157,.06)] border border-[rgba(0,255,157,.2)] rounded p-2.5">// NOTE FROM TEAM: {refund.admin_note}</div>}
        </div>
        {onRefresh && <button onClick={onRefresh} disabled={refreshing} data-testid="refund-refresh-btn" className="text-xs eh-mono px-3 py-2 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] flex items-center gap-1.5 disabled:opacity-50"><RefreshCcw size={12} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'SYNCING' : 'REFRESH'}</button>}
      </div>

      {!terminal ? (
        <div className="relative" data-testid="refund-trace-timeline">
          {REFUND_STAGES.map((s, i) => {
            const state = i < stageIdx ? 'done' : i === stageIdx ? 'current' : 'pending';
            const connectorClass = i < stageIdx ? 'done' : i === stageIdx ? 'live' : '';
            return (
              <div key={s.key} className="flex gap-4 pb-7 relative">
                {i < REFUND_STAGES.length - 1 && <div className={`trace-connector ${connectorClass}`} />}
                <TraceStageIcon stageKey={s.key} icon={s.icon} state={state} />
                <div className="flex-1 pt-1 min-w-0">
                  <div className={`font-semibold ${state !== 'pending' ? '' : 'opacity-55'}`} style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{s.label}</div>
                  <div className={`text-sm leading-6 ${state === 'pending' ? 'opacity-55' : 'opacity-80'}`}>{s.desc}</div>
                  {state === 'current' && <div className="mt-2 eh-mono text-[11px] eh-neon-soft inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[rgba(0,255,157,.4)] bg-[rgba(0,255,157,.06)]"><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> LIVE</div>}
                  {state === 'done' && <div className="mt-2 eh-mono text-[10px] tracking-widest text-[var(--eh-green)] opacity-80">✓ COMPLETED</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="eh-panel p-5 text-center" style={{ borderColor: `${terminal.color}66`, background: 'rgba(255,107,107,.04)' }}>
          <XCircle size={36} className="mx-auto mb-2" color={terminal.color} />
          <div className="eh-display font-black mb-1" style={{ color: terminal.color }}>{terminal.label}</div>
          <div className="text-sm opacity-80 leading-6">{terminal.desc}</div>
        </div>
      )}
    </div>
  );
};

const RecoveryView = ({ recCase, onRefresh, refreshing, teamTgUrl }) => {
  const status = recCase.status || 'new';
  const [linkedOrder, setLinkedOrder] = useState(null);

  useEffect(() => {
    if (recCase.linked_order_id) {
      api.getOrder(recCase.linked_order_id).then(setLinkedOrder).catch(() => setLinkedOrder(null));
    } else {
      setLinkedOrder(null);
    }
  }, [recCase.linked_order_id]);

  const paySym = CURRENCY_SYM[recCase.final_currency] || '';
  const terminal = RECOVERY_TERMINAL[status];
  const stageIdx = RECOVERY_STAGES.findIndex(s => s.key === status);
  return (
    <div className="eh-panel eh-brackets p-5 sm:p-7" data-testid="recovery-track-card">
      <span className="br-bl" /><span className="br-br" />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="eh-mono text-xs opacity-60">CASE_ID</div>
          <div className="eh-neon-soft eh-mono text-sm break-all">{recCase.id}</div>
        </div>
        <div className="text-right min-w-0 max-w-full sm:max-w-[60%]">
          <div className="eh-mono text-xs opacity-60">SERVICE</div>
          <div className="text-sm font-semibold break-words" style={{ fontFamily: 'Inter,sans-serif' }}>{recCase.service_name || '—'}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-sm">
        <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">PLATFORM</div><div className="capitalize">{recCase.platform || '—'}</div></div>
        <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">URGENCY</div><div className="capitalize">{recCase.urgency || '—'}</div></div>
        <div className="eh-panel p-3 min-w-0 overflow-hidden"><div className="eh-mono text-[10px] opacity-60">QUOTE</div><div className="eh-neon">₹{Number(recCase.estimated_price || 0).toLocaleString('en-IN')}</div></div>
      </div>

      {/* Hacker-style status hero */}
      <div className="eh-panel p-4 mb-5 flex items-center justify-between flex-wrap gap-3" style={{ borderColor: terminal ? `${terminal.color}66` : 'rgba(0,255,157,.4)' }}>
        <div className="min-w-0 flex-1">
          <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1">// CURRENT STATUS</div>
          <div className="eh-display text-xl font-black" style={{ color: terminal?.color || 'var(--eh-green)' }}>{terminal ? terminal.label : (RECOVERY_STAGES[stageIdx]?.label || 'Pending')}</div>
          <div className="text-sm opacity-80 leading-6 mt-1">{terminal ? terminal.desc : (RECOVERY_STAGES[stageIdx]?.desc || 'Awaiting first review.')}</div>
          {recCase.admin_note && <div className="mt-2 eh-mono text-[11px] opacity-90 bg-[rgba(0,255,157,.06)] border border-[rgba(0,255,157,.2)] rounded p-2.5">// NOTE FROM TEAM: {recCase.admin_note}</div>}
        </div>
        <button onClick={onRefresh} disabled={refreshing} data-testid="recovery-refresh-btn" className="text-xs eh-mono px-3 py-2 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] flex items-center gap-1.5 disabled:opacity-50"><RefreshCcw size={12} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'SYNCING' : 'REFRESH'}</button>
      </div>

      {!terminal ? (
        <div className="relative" data-testid="recovery-trace-timeline">
          {RECOVERY_STAGES.map((s, i) => {
            const state = i < stageIdx ? 'done' : i === stageIdx ? 'current' : 'pending';
            const connectorClass = i < stageIdx ? 'done' : i === stageIdx ? 'live' : '';
            return (
              <div key={s.key} className="flex gap-4 pb-7 relative">
                {i < RECOVERY_STAGES.length - 1 && <div className={`trace-connector ${connectorClass}`} />}
                <TraceStageIcon stageKey={s.key} icon={s.icon} state={state} />
                <div className="flex-1 pt-1 min-w-0">
                  <div className={`font-semibold ${state !== 'pending' ? '' : 'opacity-55'}`} style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{s.label}</div>
                  <div className={`text-sm leading-6 ${state === 'pending' ? 'opacity-55' : 'opacity-80'}`}>{s.desc}</div>
                  {state === 'current' && <div className="mt-2 eh-mono text-[11px] eh-neon-soft inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[rgba(0,255,157,.4)] bg-[rgba(0,255,157,.06)]"><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> LIVE</div>}
                  {state === 'done' && <div className="mt-2 eh-mono text-[10px] tracking-widest text-[var(--eh-green)] opacity-80">✓ COMPLETED</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="eh-panel p-5 text-center" style={{ borderColor: `${terminal.color}66`, background: status === 'closed' ? 'rgba(0,255,157,.04)' : 'rgba(255,107,107,.04)' }}>
          {status === 'closed' ? <CheckCircle2 size={36} className="mx-auto mb-2" color={terminal.color} /> : <ShieldAlert size={36} className="mx-auto mb-2" color={terminal.color} />}
          <div className="eh-display font-black mb-1" style={{ color: terminal.color }}>{terminal.label}</div>
          <div className="text-sm opacity-80 leading-6">{terminal.desc}</div>
        </div>
      )}

      {recCase.linked_order_id && (
        <div className="mt-6 eh-panel p-5 border border-[rgba(0,255,157,.35)] bg-[rgba(0,255,157,.05)]" data-testid="recovery-payment-banner">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div className="eh-mono text-[10px] tracking-widest text-[var(--eh-green)] flex items-center gap-1.5"><CreditCard size={12} /> // QUOTE READY · COMPLETE PAYMENT</div>
            <div className="eh-mono text-[10px] opacity-50">ORDER {recCase.linked_order_id}</div>
          </div>
          {recCase.final_amount ? (
            <div className="flex items-baseline gap-2 mb-1">
              <div className="eh-display text-3xl sm:text-4xl font-black eh-neon">{paySym}{Number(recCase.final_amount).toLocaleString('en-IN')}</div>
              <div className="eh-mono text-[10px] opacity-60">{recCase.final_currency}</div>
            </div>
          ) : null}
          {recCase.payment_note && <div className="eh-mono text-[11px] opacity-80 leading-5 mt-1">// {recCase.payment_note}</div>}
        </div>
      )}
      {linkedOrder && <PaymentBox order={linkedOrder} onUpdated={setLinkedOrder} />}

      <div className="mt-6 pt-5 border-t border-[var(--eh-border)] flex flex-wrap gap-3 items-center justify-between">
        <div className="eh-mono text-[10px] opacity-50">// AUTO-REFRESH EVERY 30s · CASE OPENED {recCase.createdAt ? new Date(recCase.createdAt).toLocaleString() : ''}</div>
        <a href={teamTgUrl || '#'} target="_blank" rel="noreferrer" data-testid="recovery-contact-team-btn" className={`eh-btn-primary text-xs flex items-center gap-1.5 ${!teamTgUrl ? 'opacity-50 pointer-events-none' : ''}`}><TgIcon size={12} /> CONTACT TEAM</a>
      </div>
    </div>
  );
};

const OrderView = ({ order, setOrder }) => {
  const idx = ORDER_STAGES.findIndex(s => s.key === order.status);
  return (
    <div className="eh-panel eh-brackets p-5 sm:p-7">
      <span className="br-bl" /><span className="br-br" />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="eh-mono text-xs opacity-60">ORDER_ID</div>
          <div className="eh-neon-soft eh-mono text-sm break-all">{order.id}</div>
        </div>
        <div className="text-right min-w-0 max-w-full sm:max-w-[60%]">
          <div className="eh-mono text-xs opacity-60">PACKAGE</div>
          <div className="text-sm font-semibold break-words" style={{ fontFamily: 'Inter,sans-serif' }}>{order.serviceName}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-sm">
        <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">CLIENT</div><div className="break-words">{order.name}</div></div>
        <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">SIZE</div><div className="break-words">{order.size}</div></div>
        <div className="eh-panel p-3 min-w-0 overflow-hidden"><div className="eh-mono text-[10px] opacity-60">TARGET</div><div className="truncate" title={order.target}>{order.target}</div></div>
      </div>
      <div className="relative" data-testid="order-trace-timeline">
        {ORDER_STAGES.map((s, i) => {
          const state = i < idx ? 'done' : i === idx ? 'current' : 'pending';
          const connectorClass = i < idx ? 'done' : i === idx ? 'live' : '';
          return (
            <div key={s.key} className="flex gap-4 pb-7 relative">
              {i < ORDER_STAGES.length - 1 && <div className={`trace-connector ${connectorClass}`} />}
              <TraceStageIcon stageKey={s.key} icon={s.icon} state={state} />
              <div className="flex-1 pt-1 min-w-0">
                <div className={`font-semibold ${state !== 'pending' ? '' : 'opacity-55'}`} style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{s.label}</div>
                <div className={`text-sm leading-6 ${state === 'pending' ? 'opacity-55' : 'opacity-80'}`}>{s.desc}</div>
                {state === 'current' && <div className="mt-2 eh-mono text-[11px] eh-neon-soft inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[rgba(0,255,157,.4)] bg-[rgba(0,255,157,.06)]"><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> LIVE</div>}
                {state === 'done' && <div className="mt-2 eh-mono text-[10px] tracking-widest text-[var(--eh-green)] opacity-80">✓ COMPLETED</div>}
              </div>
            </div>
          );
        })}
      </div>
      <PaymentBox order={order} onUpdated={setOrder} />
    </div>
  );
};

const OrderTracker = () => {
  const [params, setParams] = useSearchParams();
  const [id, setId] = useState(params.get('id') || '');
  const [order, setOrder] = useState(null);
  const [recCase, setRecCase] = useState(null);
  const [refund, setRefund] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [teamTgUrl, setTeamTgUrl] = useState('');

  useEffect(() => {
    // Pull the team Telegram URL the owner configured in Webpanel → Recovery → Hero & Trust.
    // This replaces the previously hardcoded `https://t.me/errorhacker` link on the
    // "CONTACT TEAM" button so it always matches the admin's current handle.
    api.recoveryConfig().then(r => setTeamTgUrl(r?.hero?.telegram_url || '')).catch(() => {});
  }, []);

  const lookup = async (rawId) => {
    setErr(''); setOrder(null); setRecCase(null); setRefund(null);
    const trimmed = (rawId || '').trim();
    if (!trimmed) return;
    if (trimmed.toUpperCase() === 'DEMO') {
      setOrder({ id: 'ORD-DEMO-7142', serviceName: 'YouTube Subscribers - 1000', name: 'Demo Operator', size: '1000', target: 'https://youtu.be/demo', status: 'in-progress', createdAt: new Date().toISOString() });
      return;
    }
    setLoading(true);
    try {
      const kind = inferKind(trimmed);
      if (kind === 'recovery') {
        const c = await api.recoveryGetCase(trimmed);
        setRecCase(c);
      } else if (kind === 'refund') {
        const r = await api.refundPublic(trimmed);
        setRefund(r);
      } else {
        const o = await api.getOrder(trimmed);
        setOrder({ ...o, status: o.status || 'received' });
      }
    } catch (e2) {
      setErr(e2.status === 404 ? 'No order, recovery case or refund found with that ID.' : (e2.message || 'Lookup failed'));
    } finally {
      setLoading(false);
    }
  };

  // Auto-lookup if ?id=... in URL
  useEffect(() => {
    const q = params.get('id');
    if (q && q !== id) { setId(q); lookup(q); }
    if (q && q === id && !order && !recCase && !err) lookup(q);
      }, [params]);

  // Auto-refresh open recovery cases every 30s
  useEffect(() => {
    if (!recCase) return;
    if (['recovered', 'closed', 'rejected'].includes(recCase.status)) return;
    const t = setInterval(async () => {
      try {
        const c = await api.recoveryGetCase(recCase.id);
        setRecCase(c);
      } catch (_e) { /* noop */ }
    }, 30000);
    return () => clearInterval(t);
  }, [recCase]);

  const submit = (e) => {
    e.preventDefault();
    setParams(id.trim() ? { id: id.trim() } : {});
    lookup(id);
  };

  const refreshRec = async () => {
    if (!recCase) return;
    setRefreshing(true);
    try { const c = await api.recoveryGetCase(recCase.id); setRecCase(c); } catch (_e) { /* noop */ }
    finally { setRefreshing(false); }
  };

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-3 sm:px-6">
        <div className="text-center mb-10">
          <div className="eh-kicker justify-center mb-3">// TRACE_OPERATION</div>
          <h1 className="eh-display font-black" style={{ fontSize: 'clamp(1.6rem, 5.5vw, 3.5rem)' }}>OPERATION <span className="eh-neon">TRACKER</span></h1>
          <p className="opacity-70 mt-4 text-sm">Track orders <span className="eh-neon-soft eh-mono">ORD-XXX</span>, recovery cases <span className="eh-neon-soft eh-mono">REC-XXX</span> or refunds <span className="eh-neon-soft eh-mono">RFD-XXX</span>. Type <span className="eh-neon-soft eh-mono">DEMO</span> to preview.</p>
        </div>
        <form onSubmit={submit} className="eh-panel eh-brackets p-5 sm:p-6 mb-6 flex gap-3 flex-col sm:flex-row">
          <span className="br-bl" /><span className="br-br" />
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={16} />
            <input data-testid="track-input" value={id} onChange={e=>setId(e.target.value)} placeholder="> ORD-XXX · REC-XXX · RFD-XXX" className="eh-input pl-9" />
          </div>
          <button data-testid="track-submit" disabled={loading} className="eh-btn-primary text-xs">{loading ? 'TRACING…' : 'TRACE'}</button>
        </form>
        {err && (
          <div className="eh-panel p-4 flex items-center gap-3 mb-6" style={{ borderColor: 'rgba(255,49,72,.4)' }}>
            <AlertCircle size={16} color="var(--eh-red)" /><span className="text-sm">{err}</span>
          </div>
        )}
        {recCase && <RecoveryView recCase={recCase} onRefresh={refreshRec} refreshing={refreshing} teamTgUrl={teamTgUrl} />}
        {recCase && ['recovered', 'closed'].includes(recCase.status) && <RecoveryReviewForm caseId={recCase.id} />}
        {order && <OrderView order={order} setOrder={setOrder} />}
        {refund && <RefundView refund={refund} onRefresh={async () => { setRefreshing(true); try { const r = await api.refundPublic(refund.id); setRefund(r); } catch (_e) { /* noop */ } finally { setRefreshing(false); } }} refreshing={refreshing} />}
        {(recCase || order || refund) && <TrackConnectTelegramCTA />}
        {!recCase && !order && !refund && !err && id === '' && (
          <div className="eh-panel p-5 text-center eh-mono text-xs opacity-60">
            Submitted a recovery case? <Link to="/recovery" className="eh-neon underline">Start a new case →</Link>
          </div>
        )}
      </div>
    </div>
  );
};
export default OrderTracker;
