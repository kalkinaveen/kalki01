import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Package, CheckCircle2, Circle, Clock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import PaymentBox from '../components/PaymentBox';

const STAGES = [
  { key: 'received', icon: Package, label: 'Order Received' },
  { key: 'payment_review', icon: ShieldCheck, label: 'Payment Review' },
  { key: 'verified', icon: ShieldCheck, label: 'Verified' },
  { key: 'in-progress', icon: Clock, label: 'In Progress' },
  { key: 'delivered', icon: CheckCircle2, label: 'Delivered' },
];

const OrderDetail = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { nav('/login', { state: { from: `/me/orders/${id}` } }); return; }
    if (!user) return;
    setLoading(true);
    api.getOrder(id).then(setOrder).catch(() => setOrder(null)).finally(() => setLoading(false));
  }, [authLoading, user, id, nav]);

  if (loading || authLoading) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  if (!order) return <section className="min-h-[60vh] grid place-items-center"><div className="text-center"><div className="opacity-70 mb-4">Order not found.</div><Link to="/me" className="eh-btn-ghost text-xs"><ArrowLeft size={12} /> back</Link></div></section>;

  const idx = STAGES.findIndex(s => s.key === order.status);
  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      <Link to="/me" className="inline-flex items-center gap-2 eh-mono text-xs opacity-70 hover:opacity-100 mb-6"><ArrowLeft size={12} /> back to account</Link>
      <div className="eh-panel eh-brackets p-5 sm:p-7 mb-6">
        <span className="br-bl" /><span className="br-br" />
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="eh-mono text-[10px] opacity-60">ORDER_ID</div>
            <div className="eh-neon-soft eh-mono text-sm">{order.id}</div>
          </div>
          <div className="text-right">
            <div className="eh-mono text-[10px] opacity-60">PACKAGE</div>
            <div className="text-sm font-semibold" style={{ fontFamily: 'Inter,sans-serif' }}>{order.serviceName || order.service || '—'}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mb-6 text-sm">
          {order.size && <div className="eh-panel p-3"><div className="eh-mono text-[10px] opacity-60">SIZE</div><div>{order.size}</div></div>}
          {order.target && <div className="eh-panel p-3 overflow-hidden"><div className="eh-mono text-[10px] opacity-60">TARGET</div><div className="truncate">{order.target}</div></div>}
          {order.tg && <div className="eh-panel p-3"><div className="eh-mono text-[10px] opacity-60">TELEGRAM</div><div>{order.tg}</div></div>}
        </div>
        <div>
          {STAGES.map((s, i) => { const I = s.icon; const active = i <= idx; const current = i === idx; return (
            <div key={s.key} className="flex gap-4 pb-5 relative">
              {i < STAGES.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px" style={{ background: active ? 'var(--eh-green)' : 'var(--eh-border)' }} />}
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 relative" style={{ background: active ? 'rgba(0,255,157,.12)' : 'transparent', border: `1px solid ${active ? 'var(--eh-green)' : 'var(--eh-border)'}`, boxShadow: current ? '0 0 12px rgba(0,255,157,.4)' : 'none' }}>
                {active ? <I size={16} color="var(--eh-green)" /> : <Circle size={14} className="opacity-40" />}
              </div>
              <div className="flex-1 pt-1">
                <div className={`font-semibold ${active ? '' : 'opacity-60'}`} style={{ fontFamily: 'Inter,sans-serif' }}>{s.label}</div>
              </div>
            </div>
          );})}
        </div>
      </div>
      <PaymentBox order={order} onUpdated={setOrder} />
    </section>
  );
};

export default OrderDetail;
