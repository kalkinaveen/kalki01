import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Package, CheckCircle2, Circle, Clock, ShieldCheck, ArrowLeft, Wallet as WalletIcon, RotateCcw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import PaymentBox from '../components/PaymentBox';
import RefundRequestModal from '../components/RefundRequestModal';

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
  const [wallet, setWallet] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [o, w, rs] = await Promise.all([
        api.getOrder(id),
        api.walletGet().catch(() => null),
        api.refundsMine().catch(() => []),
      ]);
      setOrder(o);
      setWallet(w);
      setRefunds((rs || []).filter(r => r.order_id === id));
    } catch (e) { setOrder(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!authLoading && !user) { nav('/login', { state: { from: `/me/orders/${id}` } }); return; }
    if (user) loadAll();
  }, [authLoading, user, id]);

  if (loading || authLoading) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  if (!order) return <section className="min-h-[60vh] grid place-items-center"><div className="text-center"><div className="opacity-70 mb-4">Order not found.</div><Link to="/me" className="eh-btn-ghost text-xs"><ArrowLeft size={12} /> back</Link></div></section>;

  const price = Number(order.payment_amount || order.amount || 0);
  const balance = Number(wallet?.balance || 0);
  const isPaid = ['verified', 'paid', 'in-progress', 'delivered'].includes(order.status);
  const canWalletPay = !isPaid && price > 0 && balance >= price;
  const activeRefund = refunds.find(r => !['rejected', 'completed'].includes(r.status)) || refunds[0];
  const canRequestRefund = isPaid && !activeRefund;

  const payWithWallet = async () => {
    if (!window.confirm(`Pay ₹${price} from wallet?\nNew balance: ₹${(balance - price).toFixed(2)}`)) return;
    setPaying(true);
    try {
      await api.payOrderWithWallet(order.id);
      toast.success('Paid from wallet · order verified', { description: 'Our team will start work shortly' });
      await loadAll();
    } catch (e) { toast.error(e.message); }
    finally { setPaying(false); }
  };

  const idx = STAGES.findIndex(s => s.key === order.status);
  return (
    <section className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
      <Link to="/me" className="inline-flex items-center gap-2 eh-mono text-xs opacity-70 hover:opacity-100 mb-6"><ArrowLeft size={12} /> back to account</Link>

      <div className="eh-panel eh-brackets p-5 sm:p-7 mb-6 overflow-hidden">
        <span className="br-bl" /><span className="br-br" />
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div className="min-w-0 flex-1">
            <div className="eh-mono text-[10px] opacity-60">ORDER_ID</div>
            <div className="eh-neon-soft eh-mono text-sm break-all">{order.id}</div>
          </div>
          <div className="text-right min-w-0 max-w-full sm:max-w-[60%]">
            <div className="eh-mono text-[10px] opacity-60">PACKAGE</div>
            <div className="text-sm font-semibold break-words">{order.serviceName || order.service || '—'}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-sm">
          {order.size && <div className="eh-panel p-3 min-w-0"><div className="eh-mono text-[10px] opacity-60">SIZE</div><div className="break-words">{order.size}</div></div>}
          {order.target && <div className="eh-panel p-3 min-w-0 overflow-hidden"><div className="eh-mono text-[10px] opacity-60">TARGET</div><div className="truncate" title={order.target}>{order.target}</div></div>}
          {order.tg && <div className="eh-panel p-3 min-w-0 overflow-hidden"><div className="eh-mono text-[10px] opacity-60">TELEGRAM</div><div className="truncate">{order.tg}</div></div>}
        </div>
        <div>
          {STAGES.map((s, i) => { const I = s.icon; const active = i <= idx; const current = i === idx; return (
            <div key={s.key} className="flex gap-4 pb-5 relative">
              {i < STAGES.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px" style={{ background: active ? 'var(--eh-green)' : 'var(--eh-border)' }} />}
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 relative" style={{ background: active ? 'rgba(0,255,157,.12)' : 'transparent', border: `1px solid ${active ? 'var(--eh-green)' : 'var(--eh-border)'}`, boxShadow: current ? '0 0 12px rgba(0,255,157,.4)' : 'none' }}>
                {active ? <I size={16} color="var(--eh-green)" /> : <Circle size={14} className="opacity-40" />}
              </div>
              <div className="flex-1 pt-1">
                <div className={`font-semibold ${active ? '' : 'opacity-60'}`}>{s.label}</div>
              </div>
            </div>
          );})}
        </div>
      </div>

      {/* PAY WITH WALLET — front and center if balance covers cost */}
      {!isPaid && price > 0 && (
        <div className="eh-panel p-5 mb-6 bg-[rgba(0,255,157,.04)] border-[rgba(0,255,157,.25)]" data-testid="wallet-pay-section">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <div className="eh-mono text-[10px] opacity-60 flex items-center gap-1.5 mb-1"><WalletIcon size={11} className="text-[var(--eh-green)]" /> // WALLET CHECKOUT</div>
              <div className="eh-display text-lg sm:text-xl font-black">Pay ₹{price.toLocaleString('en-IN')} instantly</div>
              <div className="eh-mono text-[11px] opacity-70 mt-1">Balance · <b className={balance >= price ? 'eh-neon' : 'text-amber-300'}>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>{balance < price && <span className="opacity-60"> · need ₹{(price - balance).toLocaleString('en-IN')} more</span>}</div>
            </div>
            {canWalletPay ? (
              <button onClick={payWithWallet} disabled={paying} className="eh-btn-primary text-sm inline-flex items-center gap-2 px-5 py-3" data-testid="wallet-pay-btn">
                {paying ? <Loader2 size={14} className="animate-spin" /> : <WalletIcon size={14} />} {paying ? 'PAYING…' : 'PAY FROM WALLET'}
              </button>
            ) : (
              <Link to="/me/wallet" className="eh-btn-primary text-sm inline-flex items-center gap-2 px-5 py-3 !bg-[#ffd34d] !text-black hover:!bg-[#ffd34d]/90" data-testid="wallet-topup-btn">
                <Plus size={14} /> TOP UP WALLET
              </Link>
            )}
          </div>
          <div className="eh-mono text-[10px] opacity-50 leading-5">▸ Instant. No screenshots, no waiting. The minute you tap pay, your order moves to <b className="text-[var(--eh-green)]">VERIFIED</b> and our team starts work.</div>
        </div>
      )}

      {/* fallback: manual / crypto */}
      <PaymentBox order={order} onUpdated={setOrder} />

      {/* REFUND SECTION (post-payment) */}
      {isPaid && (
        <div className="eh-panel p-5 mt-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="eh-mono text-xs tracking-widest opacity-70 flex items-center gap-2">
              <RotateCcw size={12} className="text-[var(--eh-green)]" /> // NEED A REFUND?
            </div>
            {activeRefund ? (
              <Link to={`/refund/${activeRefund.id}`} className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="refund-tracker-link">
                ▸ Track {activeRefund.id} · <span className="eh-neon-soft">{activeRefund.status?.toUpperCase()}</span>
              </Link>
            ) : (
              canRequestRefund && (
                <button onClick={() => setRefundOpen(true)} className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="refund-request-btn">
                  <RotateCcw size={11} /> REQUEST REFUND
                </button>
              )
            )}
          </div>
          <p className="eh-mono text-[11px] opacity-70 leading-6">If approved, refund is credited instantly to your wallet. Average review time: 12-24 hrs.</p>
        </div>
      )}

      {refundOpen && (
        <RefundRequestModal
          order={order}
          onClose={() => setRefundOpen(false)}
          onCreated={() => loadAll()}
        />
      )}
    </section>
  );
};

export default OrderDetail;
