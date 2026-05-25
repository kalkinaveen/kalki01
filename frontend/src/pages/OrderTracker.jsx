import React, { useState } from 'react';
import { Search, CheckCircle2, Circle, Clock, Package, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import PaymentBox from '../components/PaymentBox';

const SAMPLE_STATUS = ['received', 'verified', 'in-progress', 'delivered'];
const STAGES = [
  { key: 'received', icon: Package, label: 'Order Received', desc: 'Encrypted handshake complete. Order queued.' },
  { key: 'verified', icon: ShieldCheck, label: 'Target Verified', desc: 'Operator confirmed target link & package size.' },
  { key: 'in-progress', icon: Clock, label: 'In Progress', desc: 'Manual delivery in motion. Drip-feed enabled.' },
  { key: 'delivered', icon: CheckCircle2, label: 'Delivered', desc: 'Package fully delivered. Refill window active for 30-60 days.' },
];

const OrderTracker = () => {
  const [id, setId] = useState('');
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr(''); setOrder(null);
    const trimmed = id.trim();
    if (!trimmed) return;
    if (trimmed.toUpperCase() === 'DEMO') {
      setOrder({ id: 'ORD-DEMO-7142', serviceName: 'YouTube Subscribers - 1000', name: 'Demo Operator', size: '1000', target: 'https://youtu.be/demo', status: 'in-progress', createdAt: new Date().toISOString() });
      return;
    }
    setLoading(true);
    try {
      const o = await api.getOrder(trimmed);
      setOrder({ ...o, status: o.status || 'received' });
    } catch (e2) {
      setErr(e2.status === 404 ? 'Order not found. Try ID "DEMO" to preview tracker.' : (e2.message || 'Lookup failed'));
    } finally { setLoading(false); }
  };
  const idx = order ? SAMPLE_STATUS.indexOf(order.status) : -1;
  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="eh-kicker justify-center mb-3">// TRACE_ORDER</div>
          <h1 className="eh-display font-black" style={{ fontSize: 'clamp(1.8rem, 6vw, 3.5rem)' }}>ORDER <span className="eh-neon">TRACKER</span></h1>
          <p className="opacity-70 mt-4 text-sm">Enter your order ID. Tip: type <span className="eh-neon-soft eh-mono">DEMO</span> to preview the tracker UI.</p>
        </div>
        <form onSubmit={submit} className="eh-panel eh-brackets p-5 sm:p-6 mb-6 flex gap-3 flex-col sm:flex-row">
          <span className="br-bl" /><span className="br-br" />
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={16} />
            <input value={id} onChange={e=>setId(e.target.value)} placeholder="> ORD-XXXXXXXX" className="eh-input pl-9" />
          </div>
          <button disabled={loading} className="eh-btn-primary text-xs">{loading ? 'TRACING...' : 'TRACE'}</button>
        </form>
        {err && (
          <div className="eh-panel p-4 flex items-center gap-3 mb-6" style={{ borderColor: 'rgba(255,49,72,.4)' }}>
            <AlertCircle size={16} color="var(--eh-red)" /><span className="text-sm">{err}</span>
          </div>
        )}
        {order && (
          <div className="eh-panel eh-brackets p-5 sm:p-7">
            <span className="br-bl" /><span className="br-br" />
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="eh-mono text-xs opacity-60">ORDER_ID</div>
                <div className="eh-neon-soft eh-mono text-sm">{order.id}</div>
              </div>
              <div className="text-right">
                <div className="eh-mono text-xs opacity-60">PACKAGE</div>
                <div className="text-sm font-semibold" style={{ fontFamily: 'Inter,sans-serif' }}>{order.serviceName}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-6 text-sm">
              <div className="eh-panel p-3"><div className="eh-mono text-[10px] opacity-60">CLIENT</div><div>{order.name}</div></div>
              <div className="eh-panel p-3"><div className="eh-mono text-[10px] opacity-60">SIZE</div><div>{order.size}</div></div>
              <div className="eh-panel p-3 overflow-hidden"><div className="eh-mono text-[10px] opacity-60">TARGET</div><div className="truncate">{order.target}</div></div>
            </div>
            <div className="relative">
              {STAGES.map((s, i) => { const I = s.icon; const active = i <= idx; const current = i === idx; return (
                <div key={s.key} className="flex gap-4 pb-6 relative">
                  {i < STAGES.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px" style={{ background: active ? 'var(--eh-green)' : 'var(--eh-border)' }} />}
                  <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 relative" style={{ background: active ? 'rgba(0,255,157,.12)' : 'transparent', border: `1px solid ${active ? 'var(--eh-green)' : 'var(--eh-border)'}`, boxShadow: current ? '0 0 12px rgba(0,255,157,.4)' : 'none' }}>
                    {active ? <I size={16} color="var(--eh-green)" /> : <Circle size={14} className="opacity-40" />}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className={`font-semibold ${active ? '' : 'opacity-60'}`} style={{ fontFamily: 'Inter,sans-serif' }}>{s.label}</div>
                    <div className="text-sm opacity-70 leading-6">{s.desc}</div>
                    {current && <div className="mt-2 eh-mono text-[11px] eh-neon-soft inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> in progress</div>}
                  </div>
                </div>
              );})}
            </div>
            <PaymentBox order={order} onUpdated={setOrder} />
          </div>
        )}
      </div>
    </div>
  );
};
export default OrderTracker;
