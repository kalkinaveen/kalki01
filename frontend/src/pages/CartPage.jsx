import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Loader2, Wallet as WalletIcon, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const CartPage = () => {
  const { items, total, updateQty, remove, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    if (user) api.walletGet().then(setWallet).catch(() => {});
  }, [user]);

  const balance = Number(wallet?.balance || 0);
  const totalInr = Number(total || 0);
  const canPayInstant = !!user && balance >= totalInr && totalInr > 0;

  const checkout = async (autoPayWithWallet = false) => {
    if (!items.length) return;
    if (!user) { toast.error('Please login to checkout'); nav('/login', { state: { from: '/cart' } }); return; }
    setPlacing(true);
    try {
      const orderIds = [];
      for (const it of items) {
        const o = await api.createOrder({
          service: it.id,
          serviceName: it.title || it.name,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          size: String(it.qty || 1),
          target: it.type === 'book' ? `book:${it.id}` : (it.target || ''),
          notes: it.type === 'book' ? `Digital book purchase` : '',
        });
        orderIds.push(o.id);
      }
      clear();
      if (autoPayWithWallet) {
        let paid = 0;
        for (const oid of orderIds) {
          try { await api.payOrderWithWallet(oid); paid++; } catch (e) { /* keep going */ }
        }
        if (paid === orderIds.length) {
          toast.success(`Paid instantly · ${paid} order(s) verified`);
        } else {
          toast.success(`${paid}/${orderIds.length} paid from wallet — open the others to complete payment`);
        }
      } else {
        toast.success('Order placed', { description: `${orderIds.length} item(s) — complete payment to confirm` });
      }
      nav(`/me/orders/${orderIds[0]}`);
    } catch (e) { toast.error(e.message); }
    finally { setPlacing(false); }
  };

  return (
    <section className="max-w-4xl mx-auto px-4 py-8 sm:py-10 min-h-[70vh]">
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <ShoppingBag size={20} className="text-[var(--eh-green)]" />
        <h1 className="eh-display text-2xl sm:text-3xl font-black">YOUR <span className="eh-neon">CART</span></h1>
        <div className="ml-auto eh-mono text-xs opacity-70">{items.length} item(s)</div>
      </div>

      {user && items.length > 0 && (
        <Link to="/me/wallet" className="eh-panel p-3 mb-4 flex items-center gap-3 hover:border-[rgba(0,255,157,.4)] transition-colors" data-testid="cart-wallet-pill">
          <WalletIcon size={16} className="text-[var(--eh-green)] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="eh-mono text-[10px] opacity-60">// YOUR WALLET</div>
            <div className="eh-mono text-sm"><b className="eh-neon">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b> available</div>
          </div>
          <span className="eh-mono text-[10px] opacity-50 hidden sm:inline">TAP TO TOP UP →</span>
        </Link>
      )}

      {items.length === 0 ? (
        <div className="eh-panel p-10 text-center" data-testid="cart-empty">
          <div className="opacity-70 mb-4">Your cart is empty.</div>
          <Link to="/books" className="eh-btn-ghost text-xs">BROWSE BOOKS</Link>
          <Link to="/services" className="eh-btn-ghost text-xs ml-2">SEE SERVICES</Link>
        </div>
      ) : (
        <>
          <div className="eh-panel overflow-hidden mb-5">
            {items.map(it => (
              <div key={`${it.type}-${it.id}`} className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 border-b border-[var(--eh-border)] last:border-0" data-testid={`cart-row-${it.id}`}>
                {it.cover && <img src={it.cover} alt="" className="w-12 h-16 sm:w-16 sm:h-24 object-cover rounded shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-snug truncate">{it.title || it.name}</div>
                  <div className="eh-mono text-[10px] opacity-60 mt-0.5 truncate">{it.type === 'book' ? `${it.author || ''} · ${it.pages || ''} pages` : it.short || ''}</div>
                  <div className="eh-mono text-[11px] mt-1 eh-neon">₹{Number(it.price || 0)} each</div>
                </div>
                <div className="flex items-center gap-1 eh-mono text-xs shrink-0">
                  <button onClick={() => updateQty(it.id, it.type, (it.qty || 1) - 1)} disabled={(it.qty || 1) <= 1} className="w-7 h-7 grid place-items-center border border-[var(--eh-border)] rounded disabled:opacity-40"><Minus size={12} /></button>
                  <span className="w-7 text-center">{it.qty || 1}</span>
                  <button onClick={() => updateQty(it.id, it.type, (it.qty || 1) + 1)} className="w-7 h-7 grid place-items-center border border-[var(--eh-border)] rounded"><Plus size={12} /></button>
                </div>
                <div className="hidden sm:block w-20 text-right eh-mono text-sm font-bold">₹{(Number(it.price || 0) * (it.qty || 1)).toFixed(2)}</div>
                <button onClick={() => remove(it.id, it.type)} className="text-red-400 hover:text-red-300 w-7 h-7 grid place-items-center shrink-0"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>

          <div className="eh-panel p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <div className="eh-mono text-xs opacity-60">SUBTOTAL</div>
                <div className="eh-display text-3xl sm:text-4xl font-black eh-neon">₹{totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                {!user && <div className="eh-mono text-[10px] opacity-60 mt-1">login required at checkout</div>}
              </div>
              {user && (
                <div className="text-right eh-mono text-[11px]">
                  <div className="opacity-60">After this purchase</div>
                  <div className={canPayInstant ? 'eh-neon' : 'text-amber-300'}>Wallet · ₹{Math.max(0, balance - totalInr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              {canPayInstant ? (
                <button onClick={() => checkout(true)} disabled={placing} data-testid="cart-pay-wallet" className="eh-btn-primary inline-flex items-center justify-center gap-2 py-3">
                  {placing ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />} PAY ₹{totalInr.toLocaleString('en-IN')} INSTANTLY (WALLET)
                </button>
              ) : user && totalInr > 0 ? (
                <Link to="/me/wallet" data-testid="cart-topup" className="eh-btn-primary !bg-[#ffd34d] !text-black hover:!bg-[#ffd34d]/90 inline-flex items-center justify-center gap-2 py-3">
                  <Plus size={14} /> TOP UP TO PAY INSTANTLY
                </Link>
              ) : null}
              <button onClick={() => checkout(false)} disabled={placing} data-testid="cart-checkout" className="eh-btn-ghost inline-flex items-center justify-center gap-2 py-3">
                {placing ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />} {placing ? 'PLACING…' : 'PLACE ORDER · PAY LATER'}
              </button>
            </div>
            {canPayInstant && (
              <p className="eh-mono text-[10px] opacity-50 mt-3 leading-5">▸ <b className="text-[var(--eh-green)]">Instant pay</b> auto-debits your wallet and moves the order straight to <i>VERIFIED</i>. No screenshots, no waiting.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default CartPage;
