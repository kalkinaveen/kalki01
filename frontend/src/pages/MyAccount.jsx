import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Copy, Package, Loader2, Gift } from 'lucide-react';
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

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        <div className="eh-panel p-5">
          <div className="eh-mono text-xs tracking-widest opacity-60 mb-2">// REFERRAL</div>
          <div className="eh-display text-2xl font-black eh-neon mb-2">{user.referral_code || '—'}</div>
          <p className="eh-mono text-xs opacity-70 mb-3 leading-6">Share your code. Earn rewards on every signup that uses it.</p>
          <div className="flex gap-2">
            <button onClick={copyRef} data-testid="copy-referral" className="eh-btn-ghost text-xs"><Copy size={12} /> COPY LINK</button>
            <Link to="/me/referrals" className="eh-btn-primary text-xs"><Gift size={12} /> EARNINGS</Link>
          </div>
        </div>
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
