import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogOut, Copy, Package, Loader2, Gift, Wallet as WalletIcon, Sparkles, ArrowRight,
  Crown, Stethoscope, Zap, ShieldCheck, Flame, Clock, Check, Calendar, BookOpen, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import TelegramAccountCard from '../components/TelegramAccountCard';
import TierBadge from '../components/TierBadge';

/**
 * Royal Dashboard at /me — Iter-27.
 *
 * Layout (top → bottom):
 *  1. CINEMATIC HERO — avatar with animated tier-coloured halo ring, name,
 *     animated TierBadge, "X days left on your pass" countdown, streak fire.
 *  2. STATS GRID — 4 brand-coloured tiles (Active Orders · Recovery Cases ·
 *     Wallet · AI Uses Today). Each tile auto-counts up on mount.
 *  3. QUICK-ACTION FAB GRID — 4 big tiles (SMM · Recovery · Tools · Top up).
 *  4. MISSIONS PANEL — daily quests with claim buttons.
 *  5. OPERATIVE PASS card — upgrade ladder (or "manage" if subscribed).
 *  6. ORDER TIMELINE — vertical, animated, replaces the old table.
 *  7. REFERRAL + LIBRARY + TELEGRAM cards.
 */

const MISSION_ICON = { calendar: Calendar, gift: Gift, zap: Zap, stethoscope: Stethoscope, sparkles: Sparkles };

const StatTile = ({ Icon, label, value, suffix = '', color, to, testId }) => {
  const Wrap = to ? Link : 'div';
  const wrapProps = to ? { to } : {};
  return (
    <Wrap
      {...wrapProps}
      className="stat-tile relative overflow-hidden rounded-xl border p-4 sm:p-5 group transition-all"
      style={{ borderColor: `${color}55`, background: `linear-gradient(135deg, ${color}10, transparent 65%)` }}
      data-testid={testId}
    >
      <span aria-hidden className="absolute top-0 left-0 right-0 h-[2px] opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: `${color}1a`, border: `1px solid ${color}55`, color }}>
          <Icon size={14} strokeWidth={2} />
        </div>
        <div className="eh-mono text-[10px] tracking-widest opacity-70">{label}</div>
      </div>
      <div className="font-black text-2xl sm:text-3xl" style={{ fontFamily: "'Cinzel', serif", color }}>
        {value}{suffix && <span className="text-base opacity-60 ml-1">{suffix}</span>}
      </div>
      {to && (
        <div className="eh-mono text-[10px] opacity-50 group-hover:opacity-100 mt-2 flex items-center gap-1">
          OPEN <ArrowRight size={10} />
        </div>
      )}
    </Wrap>
  );
};

const QuickAction = ({ Icon, label, hint, color, to, testId }) => (
  <Link
    to={to}
    className="qa-tile relative overflow-hidden rounded-2xl border p-4 sm:p-5 flex flex-col items-start group transition-all"
    style={{
      borderColor: `${color}55`,
      background: `linear-gradient(160deg, ${color}14 0%, transparent 60%)`,
    }}
    data-testid={testId}
  >
    <div
      className="w-11 h-11 rounded-xl grid place-items-center mb-3 transition-transform group-hover:scale-110 group-hover:rotate-6"
      style={{ background: `${color}1a`, border: `1px solid ${color}55`, color }}
    >
      <Icon size={20} strokeWidth={1.8} />
    </div>
    <div className="font-bold text-sm" style={{ fontFamily: 'Inter,sans-serif', color }}>{label}</div>
    <div className="eh-mono text-[10px] opacity-65 mt-0.5">{hint}</div>
    <ArrowRight size={14} className="absolute top-4 right-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" style={{ color }} />
  </Link>
);

const StatusPill = ({ status }) => {
  const c = {
    paid: '#00ff9d', verified: '#00ff9d', delivered: '#00ff9d', completed: '#00ff9d',
    received: '#ffd34d', in_progress: '#4de0ff', pending_review: '#ffd34d',
    cancelled: '#9ca3af', refunded: '#9ca3af', failed: '#ff3148',
  }[String(status || '').toLowerCase()] || '#9ca3af';
  return (
    <span className="eh-mono text-[9px] tracking-widest font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${c}1a`, color: c, border: `1px solid ${c}55` }}>
      {String(status || '').replace(/_/g, ' ')}
    </span>
  );
};

const daysLeft = (iso) => {
  if (!iso) return null;
  try {
    const dt = new Date(iso);
    const diff = Math.ceil((dt.getTime() - Date.now()) / 86400000);
    return diff;
  } catch { return null; }
};

const MyAccount = () => {
  const { user, loading, logout, exchangeGoogleSession } = useAuth();
  const nav = useNavigate();
  const [exchanging, setExchanging] = useState(false);
  const [dash, setDash] = useState(null);
  const [missions, setMissions] = useState([]);
  const [streakInfo, setStreakInfo] = useState(null);
  const [busyMissionId, setBusyMissionId] = useState(null);

  // Google OAuth callback (unchanged)
  useEffect(() => {
    const h = window.location.hash || '';
    const m = h.match(/session_id=([^&]+)/);
    if (m && !exchanging) {
      setExchanging(true);
      exchangeGoogleSession(m[1])
        .then(() => { toast.success('Signed in with Google'); window.history.replaceState(null, '', '/me'); })
        .catch(e => toast.error(e.message || 'Google sign-in failed'))
        .finally(() => setExchanging(false));
    }
  }, [exchangeGoogleSession, exchanging]);

  // Redirect if not authed
  useEffect(() => {
    if (!loading && !user && !exchanging) {
      const h = window.location.hash || '';
      if (!h.includes('session_id=')) nav('/login');
    }
  }, [loading, user, exchanging, nav]);

  const loadDashboard = async () => {
    try {
      const [d, m, s] = await Promise.all([api.myDashboard(), api.myMissions(), api.myStreakCheckin().catch(() => null)]);
      setDash(d);
      setMissions(m.items || []);
      if (s) setStreakInfo(s);
    } catch { /* swallow */ }
  };

  useEffect(() => { if (user) loadDashboard(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || exchanging || (!dash && user)) {
    return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  }
  if (!user) return null;

  const tier = dash?.tier || { id: 'rookie', name: 'Rookie', color: '#9ca3af', icon: 'user', rank: 0 };
  const sub = dash?.subscription || {};
  const tierExpiresIn = sub.expires_at ? daysLeft(sub.expires_at) : null;
  const stats = dash?.stats || {};
  const streak = streakInfo?.streak || dash?.streak || { current: 0, best: 0 };

  const copyRef = () => {
    const url = `${window.location.origin}/signup?ref=${user.referral_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Referral link copied');
  };

  const claimMission = async (id) => {
    setBusyMissionId(id);
    try {
      const out = await api.claimMission(id);
      toast.success(`+₹${out.credited_inr} credited to your wallet`);
      await loadDashboard();
    } catch (e) {
      toast.error(e.message || 'Could not claim');
    } finally {
      setBusyMissionId(null);
    }
  };

  return (
    <section className="relative max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
      {/* Royal ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[28rem] h-[28rem] rounded-full opacity-20 blur-3xl" style={{ background: tier.color }} />
        <div className="absolute top-8 right-0 w-[22rem] h-[22rem] rounded-full opacity-10 blur-3xl" style={{ background: '#ff2d92' }} />
      </div>

      {/* HERO */}
      <div className="relative mb-8 sm:mb-10" data-testid="dashboard-hero">
        <div className="eh-kicker mb-3" style={{ color: tier.color }}>
          <Crown size={11} /> {tier.id === 'rookie' ? 'OPERATOR' : 'OPERATIVE PASS'}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Animated avatar halo */}
            <div className="avatar-wrap relative shrink-0">
              <div
                className="avatar-halo absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0deg, ${tier.color} 80deg, transparent 180deg, ${tier.color}55 270deg, transparent 360deg)`,
                  filter: 'blur(.3px)',
                }}
              />
              <div
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full grid place-items-center font-black text-3xl"
                style={{
                  background: `radial-gradient(circle at 30% 25%, ${tier.color}33, #0d1115 65%)`,
                  border: `2px solid ${tier.color}`,
                  color: tier.color,
                  fontFamily: "'Cinzel', serif",
                  boxShadow: `inset 0 0 18px ${tier.color}33`,
                }}
              >
                {(user.name || user.email || '?').charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="min-w-0">
              <h1
                className="font-black leading-tight"
                style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.6rem, 5vw, 2.6rem)' }}
                data-testid="dashboard-name"
              >
                {user.name || user.email.split('@')[0]}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <TierBadge tier={tier} size="md" />
                {streak?.current > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border eh-mono text-[10px] tracking-widest font-bold"
                    style={{ borderColor: '#ff7a3d55', color: '#ff7a3d', background: '#ff7a3d10' }}
                    data-testid="streak-fire"
                  >
                    <Flame size={11} className="streak-fire-icon" /> {streak.current}-DAY STREAK
                  </span>
                )}
              </div>
              <div className="eh-mono text-[11px] opacity-65 mt-1.5">
                {tier.tagline}
              </div>
              {tierExpiresIn != null && tier.id !== 'rookie' && (
                <div className="eh-mono text-[10px] opacity-70 mt-1" data-testid="tier-expiry">
                  <Clock size={10} className="inline -mt-0.5" /> {tierExpiresIn > 0 ? `${tierExpiresIn} days left on your pass` : 'Pass expires today — renew to keep priority'}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={async () => { await logout(); nav('/'); }}
            data-testid="logout-btn"
            className="eh-btn-ghost text-xs self-start sm:self-end shrink-0"
          >
            <LogOut size={13} /> SIGN OUT
          </button>
        </div>

        {/* Hero quote */}
        <blockquote
          className="mt-5 sm:mt-6 max-w-xl text-[13px] sm:text-base italic opacity-85 leading-relaxed"
          style={{ fontFamily: "'Cinzel', serif" }}
          data-testid="dashboard-quote"
        >
          <span className="text-[var(--eh-green)] mr-1.5">&ldquo;</span>
          You don't just have an account. You have a <span className="eh-neon not-italic font-bold">war room</span>.
          <span className="text-[var(--eh-green)] ml-1.5">&rdquo;</span>
        </blockquote>
      </div>

      {/* STATS GRID */}
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8" data-testid="dashboard-stats">
        <StatTile Icon={Package}      label="// ACTIVE ORDERS"  value={stats.active_orders || 0}                color="#00ff9d" to="/me/orders" testId="stat-orders" />
        <StatTile Icon={ShieldCheck} label="// RECOVERY CASES" value={stats.recovery_cases || 0}                 color="#4de0ff" to="/recovery"  testId="stat-recovery" />
        <StatTile Icon={WalletIcon}  label="// WALLET (₹)"     value={Number(dash?.wallet?.balance || 0).toLocaleString('en-IN')} color="#ffd34d" to="/me/wallet" testId="stat-wallet" />
        <StatTile Icon={Stethoscope} label="// AI USES TODAY"  value={stats.tool_uses_today || 0} suffix={`/ ${stats.tool_uses_quota === 999 ? '∞' : stats.tool_uses_quota}`} color="#ff2d92" to="/tools" testId="stat-tools" />
      </div>

      {/* QUICK ACTIONS */}
      <div className="relative mb-8" data-testid="dashboard-quick-actions">
        <div className="eh-mono text-[10px] tracking-[0.3em] opacity-60 mb-3">// QUICK ACTIONS</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <QuickAction Icon={Zap}          label="Order SMM"        hint="5,800+ services" color="#ff2d92" to="/smm"        testId="qa-smm" />
          <QuickAction Icon={ShieldCheck}  label="Request Recovery" hint="Pay only on win"  color="#00ff9d" to="/recovery"   testId="qa-recovery" />
          <QuickAction Icon={Stethoscope}  label="Run AI Tools"     hint="Diagnose · appeal" color="#4de0ff" to="/tools"     testId="qa-tools" />
          <QuickAction Icon={WalletIcon}   label="Top up wallet"    hint="UPI · card · crypto" color="#ffd34d" to="/me/wallet" testId="qa-wallet" />
        </div>
      </div>

      {/* MISSIONS PANEL */}
      <div className="relative mb-8" data-testid="dashboard-missions">
        <div className="flex items-center justify-between mb-3">
          <div className="eh-mono text-[10px] tracking-[0.3em] opacity-60">// DAILY MISSIONS · EARN WALLET CREDIT</div>
          {streakInfo?.credited && (
            <span className="eh-mono text-[10px] text-[#ff7a3d]" data-testid="streak-bonus-toast">
              <Check size={10} className="inline -mt-0.5" /> 7-day streak bonus credited
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {missions.map(m => {
            const Icon = MISSION_ICON[m.icon] || Sparkles;
            return (
              <div
                key={m.id}
                className="relative overflow-hidden rounded-xl border p-4"
                style={{
                  borderColor: m.claimed_today ? 'var(--eh-border)' : `${m.color}55`,
                  background: m.claimed_today ? 'rgba(255,255,255,.015)' : `linear-gradient(135deg, ${m.color}10, transparent 60%)`,
                  opacity: m.claimed_today ? 0.55 : 1,
                }}
                data-testid={`mission-${m.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: `${m.color}1a`, border: `1px solid ${m.color}55`, color: m.color }}>
                    <Icon size={15} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold leading-snug" style={{ fontFamily: 'Inter,sans-serif' }}>{m.title}</div>
                    <div className="eh-mono text-[10px] mt-1" style={{ color: m.color }}>+ ₹{m.reward_inr}</div>
                  </div>
                  {m.claimed_today ? (
                    <span className="eh-mono text-[9px] tracking-widest px-2 py-1 rounded border border-[var(--eh-border)] opacity-70" data-testid={`mission-${m.id}-claimed`}>
                      ✓ CLAIMED
                    </span>
                  ) : (
                    <button
                      onClick={() => claimMission(m.id)}
                      disabled={busyMissionId === m.id}
                      className="eh-mono text-[10px] tracking-widest font-bold px-2.5 py-1.5 rounded hover:brightness-110 disabled:opacity-50"
                      style={{ background: m.color, color: '#000' }}
                      data-testid={`mission-${m.id}-claim`}
                    >
                      {busyMissionId === m.id ? '…' : 'CLAIM'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OPERATIVE PASS upgrade ladder */}
      <Link
        to="/subscribe"
        className="relative overflow-hidden rounded-2xl border-2 p-5 sm:p-7 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 group transition-all hover:-translate-y-1"
        style={{
          borderColor: tier.id === 'rookie' ? '#ffd34d' : tier.color,
          background: `linear-gradient(120deg, ${tier.color}14 0%, transparent 60%), linear-gradient(300deg, #ff2d9214 0%, transparent 60%)`,
        }}
        data-testid="dashboard-pass-card"
      >
        <span aria-hidden className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #4de0ff, #ffd34d, #ff2d92, #4de0ff)' }} />
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: '#ffd34d1a', border: '1px solid #ffd34d55', color: '#ffd34d' }}>
            <Crown size={22} />
          </div>
          <div className="min-w-0">
            <div className="eh-mono text-[10px] tracking-[0.3em] opacity-70 mb-1">// OPERATIVE PASS</div>
            <div className="font-bold text-base sm:text-lg leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
              {tier.id === 'rookie'
                ? 'Skip the queue · cut every bill · wear the badge'
                : `You're on ${tier.name}. Priority active.`}
            </div>
            <div className="eh-mono text-[11px] opacity-65 mt-1">
              {tier.id === 'rookie' ? 'Free is good. Priority is better. From ₹299/30 days.' : `Tagline: ${tier.tagline}`}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest font-bold px-4 py-2.5 rounded-md shrink-0" style={{ background: tier.id === 'rookie' ? '#ffd34d' : tier.color, color: '#000' }}>
          {tier.id === 'rookie' ? 'EXPLORE PASSES' : 'MANAGE PASS'} <ChevronRight size={12} />
        </span>
      </Link>

      {/* ORDER TIMELINE */}
      <div className="relative mb-8" data-testid="dashboard-orders">
        <div className="flex items-center gap-2 mb-3">
          <Package size={14} className="text-[var(--eh-green)]" />
          <h2 className="eh-display font-black text-base sm:text-lg tracking-wide">MY ORDERS</h2>
          <span className="eh-mono text-[10px] opacity-50 ml-1">({stats.total_orders || 0})</span>
        </div>
        {!dash.recent_orders?.length ? (
          <div className="eh-panel p-8 text-center text-sm opacity-65">
            No orders yet. <Link to="/smm" className="text-[var(--eh-green)] underline">Place your first SMM order →</Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {dash.recent_orders.map(o => (
              <Link
                key={o.id}
                to={`/track?id=${o.id}`}
                className="order-row block rounded-xl border border-[var(--eh-border)] p-3 sm:p-4 hover:border-[var(--eh-green)] transition-all"
                data-testid={`order-row-${o.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span aria-hidden className="w-1.5 h-10 rounded-full" style={{ background: 'var(--eh-green)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="eh-mono text-[11px] tracking-widest" style={{ color: 'var(--eh-green)' }}>{o.id}</span>
                      <StatusPill status={o.status} />
                    </div>
                    <div className="text-[13px] font-semibold truncate mt-0.5" style={{ fontFamily: 'Inter,sans-serif' }}>
                      {o.serviceName || o.service || '—'}
                    </div>
                    <div className="eh-mono text-[10px] opacity-55 mt-0.5">{new Date(o.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {o.amount != null && (
                      <div className="eh-display font-black text-sm" style={{ color: 'var(--eh-green)' }}>
                        ₹{Number(o.amount).toLocaleString('en-IN')}
                      </div>
                    )}
                    <ChevronRight size={14} className="opacity-50 ml-auto" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Secondary rows */}
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        {/* Referral */}
        <div className="eh-panel p-5" data-testid="dashboard-referral">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={14} className="text-[var(--eh-green)]" />
            <h3 className="font-bold text-sm" style={{ fontFamily: 'Inter,sans-serif' }}>Earn ₹100 per friend you refer</h3>
          </div>
          <div className="eh-display font-black eh-neon text-2xl break-all mb-3">{user.referral_code || '—'}</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyRef} data-testid="copy-referral" className="eh-btn-ghost text-[10px]"><Copy size={10} /> COPY LINK</button>
            <Link to="/me/referrals" className="eh-btn-ghost text-[10px]"><Gift size={10} /> EARNINGS</Link>
            <Link to="/me/spin" className="eh-btn-ghost text-[10px]"><Sparkles size={10} /> DAILY SPIN</Link>
          </div>
        </div>

        {/* Library */}
        <div className="eh-panel p-5" data-testid="dashboard-library">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-[#4de0ff]" />
            <h3 className="font-bold text-sm" style={{ fontFamily: 'Inter,sans-serif' }}>My library</h3>
            <span className="eh-mono text-[10px] opacity-50 ml-1">({dash.library?.length || 0})</span>
          </div>
          {!dash.library?.length ? (
            <div className="eh-mono text-[11px] opacity-65 leading-relaxed">
              No books yet — <Link to="/books" className="text-[var(--eh-green)] underline">browse the library →</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {dash.library.slice(0, 4).map(b => (
                <div key={b.id} className="text-[12.5px] flex items-center justify-between" style={{ fontFamily: 'Inter,sans-serif' }}>
                  <span className="truncate">{b.title || b.book_title || b.book_slug}</span>
                  <Link to={`/books/${b.book_slug || b.id}`} className="eh-mono text-[10px] text-[var(--eh-green)]">READ →</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-10">
        <TelegramAccountCard />
      </div>

      <style>{`
        @keyframes eh-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .avatar-wrap { width: 80px; height: 80px; }
        @media (min-width: 640px) { .avatar-wrap { width: 96px; height: 96px; } }
        .avatar-halo { animation: eh-rotate 7s linear infinite; }
        .streak-fire-icon { animation: streak-flicker 1.2s ease-in-out infinite alternate; }
        @keyframes streak-flicker { from { transform: scale(1) rotate(-3deg); filter: drop-shadow(0 0 2px #ff7a3d); } to { transform: scale(1.12) rotate(3deg); filter: drop-shadow(0 0 6px #ff7a3d); } }
        .stat-tile:hover { transform: translateY(-2px); }
        .qa-tile { transition: transform .3s cubic-bezier(.2,.9,.3,1); }
        .qa-tile:hover { transform: translateY(-3px); box-shadow: 0 14px 32px -16px currentColor; }
        .order-row:hover { transform: translateX(2px); }
      `}</style>
    </section>
  );
};

export default MyAccount;
