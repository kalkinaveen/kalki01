import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Activity, ArrowRight, TrendingUp, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import SafetyTipsCard from '../components/SafetyTipsCard';

const PLATFORMS = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['snapchat', 'Snapchat'], ['twitter', 'Twitter / X']];
const ISSUES = [
  ['hacked', 'Account hacked'],
  ['disabled', 'Account disabled / banned'],
  ['locked_2fa', '2FA lockout'],
  ['forgot_password', 'Forgot password'],
  ['impersonation', 'Impersonation'],
  ['shadowban', 'Shadowban / reach loss'],
];
const WHEN = [['today', 'Today'], ['week', 'Within 7 days'], ['month', '1–4 weeks ago'], ['older', 'More than a month']];

const RecoveryOdds = () => {
  const [f, setF] = useState({ platform: 'instagram', issue: 'hacked', when: 'today', has_email: true, has_phone: true, has_id: true });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const calc = async () => {
    setBusy(true);
    try {
      const r = await api.toolsOdds(f);
      setRes(r);
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally { setBusy(false); }
  };

  const tierColor = res && (res.tier === 'high' ? '#00ff9d' : res.tier === 'medium' ? '#ffd34d' : '#ff3148');

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link to="/tools" className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest opacity-70 hover:opacity-100 mb-6">
          <ArrowLeft size={12} /> BACK TO TOOLS
        </Link>
        <div className="text-center mb-8">
          <div className="eh-kicker justify-center mb-3">// FREE TOOL · RECOVERY ODDS</div>
          <h1 className="font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.7rem, 5vw, 2.8rem)' }}>
            Your <span className="eh-neon">recovery odds</span>, in 5 seconds
          </h1>
          <p className="opacity-70 mt-3 text-sm max-w-xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Honest estimate based on aggregate ERRORHACKER cases — what you can do alone vs with us.
          </p>
        </div>

        <div className="eh-panel eh-brackets p-5 sm:p-7 space-y-4">
          <span className="br-bl" /><span className="br-br" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Platform</label>
              <select data-testid="odds-platform" className="eh-input" value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })}>
                {PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">When did it happen?</label>
              <select data-testid="odds-when" className="eh-input" value={f.when} onChange={e => setF({ ...f, when: e.target.value })}>
                {WHEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">What happened?</label>
              <select data-testid="odds-issue" className="eh-input" value={f.issue} onChange={e => setF({ ...f, issue: e.target.value })}>
                {ISSUES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              ['has_email', 'Email access', f.has_email],
              ['has_phone', 'Phone access', f.has_phone],
              ['has_id',    'Govt ID',     f.has_id],
            ].map(([k, lbl, v]) => (
              <button
                key={k}
                type="button"
                data-testid={`odds-toggle-${k}`}
                onClick={() => setF({ ...f, [k]: !v })}
                className={`eh-mono text-[11px] tracking-widest py-2.5 rounded border transition-colors ${v ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
              >
                {v ? '✓ ' : ''}{lbl}
              </button>
            ))}
          </div>
          <button data-testid="odds-submit" onClick={calc} disabled={busy} className="eh-btn-primary w-full" style={{ opacity: busy ? .7 : 1 }}>
            {busy ? 'CALCULATING…' : <>CALCULATE ODDS <ArrowRight size={14} /></>}
          </button>
        </div>

        {res && (
          <div className="mt-6 space-y-4" data-testid="odds-result">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="eh-panel p-5 sm:p-6 text-center">
                <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-2">// IF YOU DO IT ALONE</div>
                <div className="font-black mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2.4rem, 8vw, 4rem)', color: tierColor, textShadow: `0 0 12px ${tierColor}55` }} data-testid="odds-self-value">
                  {res.self_odds}%
                </div>
                <div className="eh-mono text-[10px] tracking-widest opacity-60">SELF-RECOVERY ODDS</div>
              </div>
              <div className="eh-panel p-5 sm:p-6 text-center" style={{ borderColor: 'rgba(0,255,157,.4)' }}>
                <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-2">// WITH ERRORHACKER</div>
                <div className="font-black mb-1 eh-neon" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2.4rem, 8vw, 4rem)' }} data-testid="odds-pro-value">
                  {res.pro_odds}%
                </div>
                <div className="eh-mono text-[10px] tracking-widest opacity-60">PRO-ASSISTED ODDS</div>
              </div>
            </div>

            <div className="eh-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock size={14} color="var(--eh-green)" />
                  <span className="eh-mono text-[11px] tracking-widest opacity-80">EST. TIMELINE</span>
                </div>
                <div className="font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{res.days_min}–{res.days_max} days</div>
                <div className="flex items-center gap-2 ml-auto">
                  <Activity size={14} color={tierColor} />
                  <span className="eh-mono text-[11px] tracking-widest" style={{ color: tierColor }}>{res.tier.toUpperCase()} CONFIDENCE</span>
                </div>
              </div>
              <p className="text-[11px] opacity-50 eh-mono mt-3">{res.note}</p>
            </div>

            <SafetyTipsCard variant="warn" tips={[
              'Never share your password, OTP, or recovery code with ANYONE — including someone claiming to be from the platform.',
              'Don\'t pay any "agent" on Telegram/Discord who DMs you first promising recovery — that\'s the scam.',
              'Only run official recovery flows from your registered device — never via a VPN that hides your usual location.',
              'If a tool/service asks for your password to "recover" the account, walk away. Legit recovery never needs your password.',
            ]} />

            <Link to="/recovery" data-testid="odds-cta-recovery" className="eh-btn-primary text-xs w-full justify-center">
              <TrendingUp size={12} /> START PRO RECOVERY · BOOST MY ODDS <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecoveryOdds;
