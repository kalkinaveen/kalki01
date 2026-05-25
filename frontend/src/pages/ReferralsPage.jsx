import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, ArrowLeft, Gift, Users, TrendingUp, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const Stat = ({ label, value, hint }) => (
  <div className="eh-panel p-4">
    <div className="eh-mono text-[10px] opacity-60 mb-1">{label}</div>
    <div className="eh-display text-3xl font-black eh-neon">{value}</div>
    {hint && <div className="eh-mono text-[10px] opacity-50 mt-1">{hint}</div>}
  </div>
);

const ReferralsPage = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [settings, setSettings] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) { nav('/login', { state: { from: '/me/referrals' } }); return; }
    if (!user) return;
    Promise.all([api.getReferralSettings(), api.myReferrals()])
      .then(([s, d]) => { setSettings(s); setData(d); })
      .catch((e) => toast.error(e.message))
      .finally(() => setBusy(false));
  }, [loading, user, nav]);

  if (loading || busy) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  if (!data) return null;

  const link = `${window.location.origin}/signup?ref=${data.referral_code}`;
  const copy = (text, label) => { navigator.clipboard.writeText(text); toast.success(`${label} copied`); };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Join ERRORHACKER', text: `Use my code ${data.referral_code} to join ERRORHACKER and get a signup bonus.`, url: link }); }
      catch (_) {}
    } else { copy(link, 'Link'); }
  };

  const sym = settings?.currency_symbol || '₹';
  return (
    <section className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
      <Link to="/me" className="inline-flex items-center gap-2 eh-mono text-xs opacity-70 hover:opacity-100 mb-6"><ArrowLeft size={12} /> back to account</Link>

      <div className="flex items-center gap-3 mb-6">
        <Gift size={22} className="text-[var(--eh-green)]" />
        <h1 className="eh-display text-3xl sm:text-4xl font-black">REFER & <span className="eh-neon">EARN</span></h1>
      </div>
      {settings?.description && <p className="eh-mono text-sm opacity-80 mb-6 leading-7">{settings.description}</p>}

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Stat label="CREDIT BALANCE" value={`${sym}${(data.credit_balance || 0).toFixed(0)}`} hint={`payout at ${sym}${settings?.min_payout || 0}`} />
        <Stat label="TOTAL EARNED"  value={`${sym}${(data.total_earned || 0).toFixed(0)}`} hint="lifetime" />
        <Stat label="REFERRED USERS" value={data.invited_count} hint="signups" />
      </div>

      <div className="eh-panel eh-brackets p-5 sm:p-6 mb-6">
        <span className="br-bl" /><span className="br-br" />
        <div className="eh-kicker mb-3">// YOUR REFERRAL</div>
        <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-center">
          <div className="eh-display text-3xl sm:text-4xl font-black eh-neon tracking-[.2em] px-4 py-3 border border-[var(--eh-border)] rounded inline-block">{data.referral_code}</div>
          <div className="flex-1 min-w-0">
            <div className="eh-mono text-[10px] opacity-60 mb-1">SHARE LINK</div>
            <div className="eh-mono text-xs break-all opacity-90">{link}</div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={() => copy(data.referral_code, 'Code')} data-testid="ref-copy-code" className="eh-btn-ghost text-xs"><Copy size={12} /> COPY CODE</button>
              <button onClick={() => copy(link, 'Link')} data-testid="ref-copy-link" className="eh-btn-ghost text-xs"><Copy size={12} /> COPY LINK</button>
              <button onClick={share} data-testid="ref-share" className="eh-btn-primary text-xs"><Share2 size={12} /> SHARE</button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <div className="eh-mono text-xs p-3 rounded border border-dashed border-[var(--eh-border)]"><span className="text-[var(--eh-green)]">{sym}{settings?.signup_reward}</span> per signup using your code</div>
          <div className="eh-mono text-xs p-3 rounded border border-dashed border-[var(--eh-border)]"><span className="text-[var(--eh-green)]">{settings?.order_percent}%</span> of their first order amount</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="eh-panel p-5">
          <div className="flex items-center gap-2 mb-3"><Users size={14} className="text-[var(--eh-green)]" /><div className="eh-kicker">// INVITED ({data.invited_count})</div></div>
          {data.invited.length === 0 && <div className="opacity-60 eh-mono text-xs text-center py-6">No referrals yet. Share your code to start earning.</div>}
          <div className="space-y-2">
            {data.invited.map(u => (
              <div key={u.user_id} className="flex items-center justify-between p-2.5 border border-[var(--eh-border)] rounded">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{ fontFamily: 'Inter,sans-serif' }}>{u.name || u.email.split('@')[0]}</div>
                  <div className="eh-mono text-[10px] opacity-60 truncate">{u.email}</div>
                </div>
                <div className="eh-mono text-[10px] opacity-70">{new Date(u.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="eh-panel p-5">
          <div className="flex items-center gap-2 mb-3"><TrendingUp size={14} className="text-[var(--eh-green)]" /><div className="eh-kicker">// EARNINGS HISTORY</div></div>
          {data.history.length === 0 && <div className="opacity-60 eh-mono text-xs text-center py-6">No earnings yet.</div>}
          <div className="space-y-2">
            {data.history.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2.5 border border-[var(--eh-border)] rounded">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{ fontFamily: 'Inter,sans-serif' }}>{r.type === 'signup' ? '+ Signup bonus' : '+ Order commission'}</div>
                  <div className="eh-mono text-[10px] opacity-60 truncate">{r.invitee_email}</div>
                </div>
                <div className="eh-mono text-sm font-bold text-[var(--eh-green)]">+{sym}{Number(r.amount || 0).toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReferralsPage;
