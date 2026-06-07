import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Copy, Package, Loader2, Gift, Wallet as WalletIcon, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import TelegramAccountCard from '../components/TelegramAccountCard';

const MyAccount = () => {
  const { user, loading, logout, exchangeGoogleSession } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [spinStatus, setSpinStatus] = useState(null);

  // Handle Google OAuth callback: #session_id=...
  useEffect(() => {
    const h = window.location.hash || '';
    const m = h.match(/session_id=([^&]+)/);
    if (m && !exchanging) {
      setExchanging(true);
      exchangeGoogleSession(m[1])
        .then(() => { toast.success('Signed in with Google'); window.history.replaceState(null, '', '/me'); })
        .catch((e) => toast.error(e.message || 'Google sign-in failed'))
        .finally(() => setExchanging(false));
    }
  }, [exchangeGoogleSession, exchanging]);

  // Redirect to login if not authenticated (after loading completes)
  useEffect(() => {
    if (!loading && !user && !exchanging) {
      const h = window.location.hash || '';
      if (!h.includes('session_id=')) nav('/login');
    }
  }, [loading, user, exchanging, nav]);

  useEffect(() => {
    if (!user) return;
    setLoadingOrders(true);
    api.myOrders().then(setOrders).catch(() => {}).finally(() => setLoadingOrders(false));
    api.walletGet().then(setWallet).catch(() => {});
    api.spinStatus().then(setSpinStatus).catch(() => {});
  }, [user]);

  if (loading || exchanging) return (
    <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>
  );
  if (!user) return null;

  const copyRef = () => {
    const url = `${window.location.origin}/signup?ref=${user.referral_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Referral link copied');
  };

  return (
    <section className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <div className="eh-kicker mb-2">// OPERATOR</div>
          <h1 className="eh-display text-3xl sm:text-4xl font-black">{user.name || user.email}</h1>
          <div className="eh-mono text-xs opacity-70 mt-1">{user.email}</div>
        </div>
        <button onClick={async () => { await logout(); nav('/'); }} data-testid="logout-btn" className="eh-btn-ghost text-xs"><LogOut size={14} /> LOGOUT</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link to="/me/wallet" data-testid="account-wallet-card" className="eh-panel p-5 hover:border-[var(--eh-green)] transition-colors group">
          <div className="eh-mono text-xs tracking-widest opacity-60 mb-2 flex items-center gap-2"><WalletIcon size={12} className="text-[var(--eh-green)]" /> // WALLET</div>
          <div className="eh-display text-2xl font-black eh-neon mb-1">₹{Number(wallet?.balance || 0).toLocaleString('en-IN')}</div>
          <div className="eh-mono text-[10px] opacity-60 group-hover:opacity-100 flex items-center gap-1">TOP UP & SPEND <ArrowRight size={10} /></div>
        </Link>
        <Link to="/me/spin" data-testid="account-spin-card" className={`eh-panel p-5 hover:border-[#ffd34d] transition-colors group ${spinStatus?.can_spin ? 'bg-[rgba(255,211,77,.05)] border-[rgba(255,211,77,.3)]' : ''}`}>
          <div className="eh-mono text-xs tracking-widest opacity-60 mb-2 flex items-center gap-2"><Sparkles size={12} className="text-[#ffd34d]" /> // DAILY SPIN</div>
          <div className="eh-display text-lg font-black mb-1" style={{ color: spinStatus?.can_spin ? '#ffd34d' : undefined }}>{spinStatus?.can_spin ? 'SPIN NOW' : 'TOMORROW'}</div>
          <div className="eh-mono text-[10px] opacity-60 leading-5">{spinStatus?.can_spin ? 'Up to ₹500 free credit' : 'Come back daily'}</div>
        </Link>
        <div className="eh-panel p-5">
          <div className="eh-mono text-xs tracking-widest opacity-60 mb-2">// REFERRAL</div>
          <div className="eh-display text-lg font-black eh-neon mb-1 break-all">{user.referral_code || '—'}</div>
          <div className="flex gap-1.5 mt-1">
            <button onClick={copyRef} data-testid="copy-referral" className="eh-btn-ghost text-[10px]"><Copy size={10} /> COPY</button>
            <Link to="/me/referrals" className="eh-btn-ghost text-[10px]"><Gift size={10} /> EARNINGS</Link>
          </div>
        </div>
        <div className="eh-panel p-5">
          <div className="eh-mono text-xs tracking-widest opacity-60 mb-2">// PROVIDER</div>
          <div className="eh-display text-lg font-black eh-neon mb-1">{(user.provider || 'password').toUpperCase()}</div>
          <p className="eh-mono text-[10px] opacity-70">Joined {new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mb-10">
        <TelegramAccountCard />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Package size={16} className="text-[var(--eh-green)]" />
          <h2 className="eh-display text-xl font-black tracking-wide">MY ORDERS</h2>
        </div>
        <div className="eh-panel overflow-x-auto">
          <table className="w-full eh-mono text-sm min-w-[640px]">
            <thead><tr className="text-left border-b border-[var(--eh-border)]">
              <th className="p-3 text-xs tracking-widest opacity-70">ID</th>
              <th className="p-3 text-xs">SERVICE</th>
              <th className="p-3 text-xs">STATUS</th>
              <th className="p-3 text-xs">DATE</th>
            </tr></thead>
            <tbody>
              {loadingOrders && <tr><td colSpan={4} className="p-6 text-center opacity-60">Loading…</td></tr>}
              {!loadingOrders && orders.length === 0 && <tr><td colSpan={4} className="p-6 text-center opacity-60">No orders yet. Place one from /services.</td></tr>}
              {orders.map(o => (
                <tr key={o.id} onClick={() => nav(`/me/orders/${o.id}`)} data-testid={`my-order-row-${o.id}`} className="border-b border-[var(--eh-border)] cursor-pointer hover:bg-white/[.03] transition-colors">
                  <td className="p-3 eh-neon-soft">{o.id}</td>
                  <td className="p-3">{o.serviceName || o.service || '—'}</td>
                  <td className="p-3"><span className="px-2 py-1 rounded text-[11px]" style={{ background:'rgba(0,255,157,.1)', color:'var(--eh-green)' }}>{o.status}</span></td>
                  <td className="p-3 opacity-70 text-xs">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default MyAccount;
