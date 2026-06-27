import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, ArrowRight, Share2, Crown } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import SafetyTipsCard from '../components/SafetyTipsCard';

const NICHES = ['fitness', 'fashion', 'food', 'tech', 'finance', 'travel', 'gaming', 'beauty', 'meme', 'other'];
const TIERS = [
  ['tier1', 'Tier-1 (US / UK / EU / CA / AU)'],
  ['tier2', 'Tier-2 (IN / BR / MX / AE)'],
  ['tier3', 'Tier-3 (Other)'],
];

const fmtINR = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtUSD = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

const AccountWorth = () => {
  const [f, setF] = useState({ platform: 'Instagram', niche: 'fitness', followers: 10000, avg_likes: 500, avg_comments: 30, country_tier: 'tier2', verified: false });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState('INR');

  const calc = async () => {
    if (!f.followers || f.followers < 100) {
      toast.error('Followers must be at least 100');
      return;
    }
    setBusy(true); setRes(null);
    try {
      const r = await api.toolsAccountWorth(f);
      setRes(r);
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally { setBusy(false); }
  };

  const share = async () => {
    if (!res) return;
    const txt = `My @${f.platform} account is worth ${currency === 'INR' ? `${fmtINR(res.account_inr_min)} – ${fmtINR(res.account_inr_max)}` : `${fmtUSD(res.account_usd_min)} – ${fmtUSD(res.account_usd_max)}`} 🚀\nCalculated free at errorhacker.site/tools/account-worth`;
    if (navigator.share) {
      try { await navigator.share({ text: txt }); } catch { /* ignore */ }
    } else {
      try { await navigator.clipboard.writeText(txt); toast.success('Result copied — paste it anywhere'); } catch { toast.error('Could not copy'); }
    }
  };

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link to="/tools" className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest opacity-70 hover:opacity-100 mb-6">
          <ArrowLeft size={12} /> BACK TO TOOLS
        </Link>
        <div className="text-center mb-8">
          <div className="eh-kicker justify-center mb-3">// FREE TOOL · ACCOUNT WORTH</div>
          <h1 className="font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.7rem, 5vw, 2.8rem)' }}>
            What&apos;s your <span className="eh-neon">@handle</span> worth?
          </h1>
          <p className="opacity-70 mt-3 text-sm max-w-xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Per-post sponsored estimate &amp; total account market value — based on industry CPM tables.
          </p>
        </div>

        <div className="eh-panel eh-brackets p-5 sm:p-7 space-y-4">
          <span className="br-bl" /><span className="br-br" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Niche</label>
              <select data-testid="worth-niche" className="eh-input" value={f.niche} onChange={e => setF({ ...f, niche: e.target.value })}>
                {NICHES.map(n => <option key={n} value={n}>{n[0].toUpperCase() + n.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Audience country</label>
              <select data-testid="worth-tier" className="eh-input" value={f.country_tier} onChange={e => setF({ ...f, country_tier: e.target.value })}>
                {TIERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Followers</label>
              <input data-testid="worth-followers" type="number" min="100" className="eh-input" value={f.followers} onChange={e => setF({ ...f, followers: parseInt(e.target.value || '0', 10) })} />
            </div>
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Avg likes per post</label>
              <input data-testid="worth-likes" type="number" min="0" className="eh-input" value={f.avg_likes} onChange={e => setF({ ...f, avg_likes: parseInt(e.target.value || '0', 10) })} />
            </div>
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Avg comments per post</label>
              <input data-testid="worth-comments" type="number" min="0" className="eh-input" value={f.avg_comments} onChange={e => setF({ ...f, avg_comments: parseInt(e.target.value || '0', 10) })} />
            </div>
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Verified (blue tick)?</label>
              <button
                type="button"
                data-testid="worth-verified"
                onClick={() => setF({ ...f, verified: !f.verified })}
                className={`w-full eh-mono text-[11px] tracking-widest py-2.5 rounded border transition-colors ${f.verified ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
              >
                {f.verified ? '✓ VERIFIED' : 'NOT VERIFIED'}
              </button>
            </div>
          </div>
          <button data-testid="worth-submit" onClick={calc} disabled={busy} className="eh-btn-primary w-full" style={{ opacity: busy ? .7 : 1 }}>
            {busy ? 'CALCULATING…' : <>ESTIMATE WORTH <ArrowRight size={14} /></>}
          </button>
        </div>

        {res && (
          <div className="mt-6 space-y-4" data-testid="worth-result">
            <div className="eh-panel p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="eh-mono text-[11px] tracking-widest opacity-80">// MARKET VALUE</div>
                <div className="inline-flex rounded-md border border-[var(--eh-border)] overflow-hidden">
                  {['INR', 'USD'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      data-testid={`worth-currency-${c.toLowerCase()}`}
                      className={`eh-mono text-[10px] tracking-widest px-2.5 py-1 ${currency === c ? 'bg-[var(--eh-green)] text-black' : 'opacity-70 hover:opacity-100'}`}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-[var(--eh-border)] bg-[#0d1115]">
                  <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1">PER SPONSORED POST</div>
                  <div className="font-black eh-neon" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.4rem, 4vw, 2rem)' }} data-testid="worth-per-post">
                    {currency === 'INR' ? `${fmtINR(res.per_post_inr_min)} – ${fmtINR(res.per_post_inr_max)}` : `${fmtUSD(res.per_post_usd_min)} – ${fmtUSD(res.per_post_usd_max)}`}
                  </div>
                </div>
                <div className="p-4 rounded-lg border" style={{ borderColor: 'rgba(0,255,157,.4)', background: 'rgba(0,255,157,.04)' }}>
                  <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 inline-flex items-center gap-1">
                    <Crown size={10} /> ACCOUNT MARKET VALUE
                  </div>
                  <div className="font-black eh-neon" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.4rem, 4vw, 2rem)' }} data-testid="worth-account-value">
                    {currency === 'INR' ? `${fmtINR(res.account_inr_min)} – ${fmtINR(res.account_inr_max)}` : `${fmtUSD(res.account_usd_min)} – ${fmtUSD(res.account_usd_max)}`}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 eh-mono text-[10px] tracking-widest opacity-70">
                <span>ENGAGEMENT · <span style={{ color: 'var(--eh-green)' }}>{res.engagement_rate}%</span></span>
                <span>NICHE · {res.niche.toUpperCase()}</span>
                <span>TIER · {res.country_tier.toUpperCase()}</span>
                {res.verified && <span style={{ color: 'var(--eh-green)' }}>✓ VERIFIED</span>}
              </div>
            </div>

            <SafetyTipsCard variant="warn" tips={[
              'Don\'t broadcast your account value publicly — high-value handles are #1 hacker targets.',
              'Move your bio, contact email, and DMs behind 2FA before any "buy account" offers reach you.',
              'Treat unsolicited "we want to buy your account" DMs as scams — they are 99% phishing leads.',
              'If you DO sell, never share login first — escrow only, and always change the email + 2FA at handover.',
            ]} />

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={share} data-testid="worth-share" className="eh-btn-ghost flex-1 justify-center text-xs">
                <Share2 size={12} /> SHARE THIS RESULT
              </button>
              <Link to="/recovery" data-testid="worth-cta-recovery" className="eh-btn-primary flex-1 justify-center text-xs">
                <TrendingUp size={12} /> PROTECT MY ASSET <ArrowRight size={12} />
              </Link>
            </div>
            <p className="text-[10px] opacity-50 eh-mono text-center pt-1">
              · estimates only · actual rates vary by brand, region &amp; campaign
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountWorth;
