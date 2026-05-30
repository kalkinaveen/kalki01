import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, CheckCircle2, Circle, Clock, Package, ShieldCheck, AlertCircle, ShieldAlert, FileSearch, Handshake, Send as TgIcon, RefreshCcw, X } from 'lucide-react';
import { api } from '../lib/api';
import PaymentBox from '../components/PaymentBox';
import RecoveryReviewForm from '../components/RecoveryReviewForm';

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

const inferKind = (id) => {
  const u = (id || '').trim().toUpperCase();
  if (u.startsWith('REC-')) return 'recovery';
  return 'order';
};

const RecoveryView = ({ recCase, onRefresh, refreshing, teamTgUrl }) => {
  const status = recCase.status || 'new';
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
        <div className="relative">
          {RECOVERY_STAGES.map((s, i) => {
            const I = s.icon;
            const active = i <= stageIdx;
            const current = i === stageIdx;
            return (
              <div key={s.key} className="flex gap-4 pb-6 relative">
                {i < RECOVERY_STAGES.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px" style={{ background: active ? 'var(--eh-green)' : 'var(--eh-border)' }} />}
                <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 relative" style={{ background: active ? 'rgba(0,255,157,.12)' : 'transparent', border: `1px solid ${active ? 'var(--eh-green)' : 'var(--eh-border)'}`, boxShadow: current ? '0 0 12px rgba(0,255,157,.4)' : 'none' }}>
                  {active ? <I size={16} color="var(--eh-green)" /> : <Circle size={14} className="opacity-40" />}
                </div>
                <div className="flex-1 pt-1 min-w-0">
                  <div className={`font-semibold ${active ? '' : 'opacity-60'}`} style={{ fontFamily: 'Inter,sans-serif' }}>{s.label}</div>
                  <div className="text-sm opacity-70 leading-6">{s.desc}</div>
                  {current && <div className="mt-2 eh-mono text-[11px] eh-neon-soft inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> live</div>}
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
      <div className="relative">
        {ORDER_STAGES.map((s, i) => {
          const I = s.icon; const active = i <= idx; const current = i === idx;
          return (
            <div key={s.key} className="flex gap-4 pb-6 relative">
              {i < ORDER_STAGES.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px" style={{ background: active ? 'var(--eh-green)' : 'var(--eh-border)' }} />}
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 relative" style={{ background: active ? 'rgba(0,255,157,.12)' : 'transparent', border: `1px solid ${active ? 'var(--eh-green)' : 'var(--eh-border)'}`, boxShadow: current ? '0 0 12px rgba(0,255,157,.4)' : 'none' }}>
                {active ? <I size={16} color="var(--eh-green)" /> : <Circle size={14} className="opacity-40" />}
              </div>
              <div className="flex-1 pt-1 min-w-0">
                <div className={`font-semibold ${active ? '' : 'opacity-60'}`} style={{ fontFamily: 'Inter,sans-serif' }}>{s.label}</div>
                <div className="text-sm opacity-70 leading-6">{s.desc}</div>
                {current && <div className="mt-2 eh-mono text-[11px] eh-neon-soft inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> in progress</div>}
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
    setErr(''); setOrder(null); setRecCase(null);
    const trimmed = (rawId || '').trim();
    if (!trimmed) return;
    if (trimmed.toUpperCase() === 'DEMO') {
      setOrder({ id: 'ORD-DEMO-7142', serviceName: 'YouTube Subscribers - 1000', name: 'Demo Operator', size: '1000', target: 'https://youtu.be/demo', status: 'in-progress', createdAt: new Date().toISOString() });
      return;
    }
    setLoading(true);
    try {
      if (inferKind(trimmed) === 'recovery') {
        const c = await api.recoveryGetCase(trimmed);
        setRecCase(c);
      } else {
        const o = await api.getOrder(trimmed);
        setOrder({ ...o, status: o.status || 'received' });
      }
    } catch (e2) {
      setErr(e2.status === 404 ? 'No order or recovery case found with that ID.' : (e2.message || 'Lookup failed'));
    } finally {
      setLoading(false);
    }
  };

  // Auto-lookup if ?id=... in URL
  useEffect(() => {
    const q = params.get('id');
    if (q && q !== id) { setId(q); lookup(q); }
    if (q && q === id && !order && !recCase && !err) lookup(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Auto-refresh open recovery cases every 30s
  useEffect(() => {
    if (!recCase) return;
    if (['recovered', 'closed', 'rejected'].includes(recCase.status)) return;
    const t = setInterval(async () => {
      try {
        const c = await api.recoveryGetCase(recCase.id);
        setRecCase(c);
      } catch {}
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
    try { const c = await api.recoveryGetCase(recCase.id); setRecCase(c); } catch {}
    finally { setRefreshing(false); }
  };

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="eh-kicker justify-center mb-3">// TRACE_OPERATION</div>
          <h1 className="eh-display font-black" style={{ fontSize: 'clamp(1.6rem, 5.5vw, 3.5rem)' }}>OPERATION <span className="eh-neon">TRACKER</span></h1>
          <p className="opacity-70 mt-4 text-sm">Track orders <span className="eh-neon-soft eh-mono">ORD-XXX</span> or recovery cases <span className="eh-neon-soft eh-mono">REC-XXX</span>. Type <span className="eh-neon-soft eh-mono">DEMO</span> to preview.</p>
        </div>
        <form onSubmit={submit} className="eh-panel eh-brackets p-5 sm:p-6 mb-6 flex gap-3 flex-col sm:flex-row">
          <span className="br-bl" /><span className="br-br" />
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={16} />
            <input data-testid="track-input" value={id} onChange={e=>setId(e.target.value)} placeholder="> ORD-XXXXXXXX or REC-XXXXXXXX" className="eh-input pl-9" />
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
        {!recCase && !order && !err && id === '' && (
          <div className="eh-panel p-5 text-center eh-mono text-xs opacity-60">
            Submitted a recovery case? <Link to="/recovery" className="eh-neon underline">Start a new case →</Link>
          </div>
        )}
      </div>
    </div>
  );
};
export default OrderTracker;
