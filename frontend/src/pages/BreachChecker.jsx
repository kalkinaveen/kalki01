import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, AlertTriangle, ShieldCheck, ArrowRight, Mail, Database } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import SafetyTipsCard from '../components/SafetyTipsCard';
import ToolsUsageBar from '../components/ToolsUsageBar';
import LimitReachedDialog from '../components/LimitReachedDialog';

const BreachChecker = () => {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState(null);
  const [limitDialog, setLimitDialog] = useState(null);

  const refreshUsage = () => api.toolsUsage().then(setUsage).catch(() => {});
  useEffect(() => { refreshUsage(); }, []);

  const run = async () => {
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      toast.error('Enter a valid email');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await api.toolsBreach(email.trim().toLowerCase());
      setResult(r);
      refreshUsage();
    } catch (e) {
      if (e.status === 429 && e.detail?.limit_reached) {
        setLimitDialog(e.detail);
        refreshUsage();
      } else {
        toast.error(e.message || 'Lookup failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const isClean = result && !result.breached;
  const score = result?.exposure_score || 0;

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link to="/tools" className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest opacity-70 hover:opacity-100 mb-6">
          <ArrowLeft size={12} /> BACK TO TOOLS
        </Link>

        <div className="text-center mb-8">
          <div className="eh-kicker justify-center mb-3">// FREE TOOL · BREACH CHECKER</div>
          <h1 className="font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.7rem, 5vw, 2.8rem)' }}>
            Was your email <span className="eh-neon">leaked?</span>
          </h1>
          <p className="opacity-70 mt-3 text-sm max-w-xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            We scan your email across known data breaches. Powered by XposedOrNot.
          </p>
        </div>

        <div className="eh-panel eh-brackets p-5 sm:p-7">
          <span className="br-bl" /><span className="br-br" />
          <ToolsUsageBar
            used={usage?.tools?.breach?.used ?? 0}
            freeLimit={usage?.tools?.breach?.free_limit ?? 5}
            walletCost={usage?.tools?.breach?.wallet_cost ?? 10}
            balance={usage?.logged_in ? usage?.balance : null}
            paidUses={usage?.tools?.breach?.paid_uses ?? 0}
            loading={!usage}
          />
          <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Email to check</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              data-testid="breach-email-input"
              type="email"
              className="eh-input flex-1"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
            <button
              data-testid="breach-submit"
              onClick={run}
              disabled={busy || !email}
              className="eh-btn-primary text-xs justify-center"
              style={{ opacity: (busy || !email) ? .6 : 1 }}
            >
              {busy ? 'SCANNING…' : <><Search size={14} /> SCAN</>}
            </button>
          </div>
          <p className="text-[11px] opacity-50 mt-2.5 eh-mono">
            <Mail size={10} className="inline -mt-0.5 mr-1" />
            we never store or log your email — query is forwarded to xposedornot.com
          </p>
        </div>

        {result && (
          <div className="mt-6 space-y-4" data-testid="breach-result">
            <div className="eh-panel p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-3">
                {isClean ? (
                  <div className="w-14 h-14 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(0,255,157,.1)', border: '1px solid rgba(0,255,157,.4)' }}>
                    <ShieldCheck size={26} color="var(--eh-green)" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(255,49,72,.08)', border: '1px solid rgba(255,49,72,.4)' }}>
                    <AlertTriangle size={26} color="#ff3148" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1">// RESULT</div>
                  <div className="text-lg sm:text-xl font-bold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {isClean ? 'No breaches found' : `Found in ${result.count} breach${result.count === 1 ? '' : 'es'}`}
                  </div>
                  <div className="text-xs opacity-65 mt-1">
                    Exposure score <span className="eh-mono font-bold" style={{ color: isClean ? '#00ff9d' : score >= 60 ? '#ff3148' : '#ffd34d' }}>{score}/100</span> · risk <span className="eh-mono font-bold">{result.risk_label || 'Low'}</span>
                  </div>
                </div>
              </div>
            </div>

            {!isClean && (
              <div className="eh-panel p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Database size={15} color="var(--eh-green)" />
                  <span className="eh-mono text-[11px] tracking-widest opacity-80">// BREACHES INCLUDING YOUR EMAIL</span>
                </div>
                <div className="space-y-3">
                  {result.breaches.map((b, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg border border-[var(--eh-border)] bg-[#0d1115]">
                      <div className="shrink-0 w-10 h-10 rounded-md grid place-items-center" style={{ background: 'rgba(255,49,72,.08)', border: '1px solid rgba(255,49,72,.25)' }}>
                        <AlertTriangle size={16} color="#ff3148" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{b.name}</div>
                        <div className="eh-mono text-[10px] opacity-60 mt-0.5">
                          {b.date && `${b.date}`}{b.domain && ` · ${b.domain}`}{b.records ? ` · ${Number(b.records).toLocaleString()} records` : ''}
                        </div>
                        {b.data && <div className="text-xs opacity-75 mt-1.5 leading-relaxed">Exposed: <span className="eh-mono">{b.data}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <SafetyTipsCard
              variant={isClean ? 'ok' : 'warn'}
              tips={isClean ? [
                'Keep your password unique to each site — reuse is the #1 attack vector.',
                'Enable 2FA via an authenticator app (not SMS) on every important account.',
                'Re-scan after any high-profile breach announcement.',
              ] : [
                'Change your password on EVERY site that uses this email immediately. Start with bank, email, and social accounts.',
                'Make each new password unique — 14+ characters with numbers and symbols.',
                'Enable 2FA via an authenticator app (Google/Authy) — never just SMS, which can be SIM-swapped.',
                'Watch for phishing emails referencing these breaches — attackers love to spoof "we noticed unusual activity" messages.',
                'Never click "secure your account" links inside any email — always go directly to the site.',
              ]}
            />

            <Link to="/recovery" data-testid="breach-cta-recovery" className="eh-btn-primary text-xs w-full justify-center">
              ALREADY COMPROMISED? GET RECOVERY HELP <ArrowRight size={12} />
            </Link>
          </div>
        )}
        <LimitReachedDialog open={!!limitDialog} detail={limitDialog} onClose={() => setLimitDialog(null)} />
      </div>
    </div>
  );
};

export default BreachChecker;
