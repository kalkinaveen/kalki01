import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ArrowRight, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

/**
 * Instagram Security Score — 6 yes/no questions, weighted scoring → animated ring.
 */

const QUESTIONS = [
  {
    key: 'two_fa',
    q: 'Do you have 2-factor authentication (2FA) enabled with an authenticator app — not just SMS?',
    weight: 22,
    fix: 'Turn on 2FA via an authenticator app (Google Authenticator / Authy). SMS-only 2FA is vulnerable to SIM-swap.',
  },
  {
    key: 'unique_password',
    q: 'Is your password unique to Instagram (used nowhere else) and 12+ characters long?',
    weight: 18,
    fix: 'Reset your password to a unique 12+ character one. Reuse is the #1 cause of takeovers.',
  },
  {
    key: 'recovery_email',
    q: 'Is your recovery email a separate, secured inbox you actively control?',
    weight: 15,
    fix: 'Add a clean Gmail/Proton inbox as your recovery email and 2FA-protect it too.',
  },
  {
    key: 'no_3p_apps',
    q: 'Have you revoked all 3rd-party apps connected to your Instagram in the last 90 days?',
    weight: 12,
    fix: 'Go to Settings → Apps & Websites and remove anything you don\'t recognise.',
  },
  {
    key: 'login_alerts',
    q: 'Are login alerts turned on — and do you actually read them?',
    weight: 10,
    fix: 'Enable login alerts in Settings → Security so you catch unauthorized logins.',
  },
  {
    key: 'no_phishing',
    q: 'Have you avoided clicking suspicious "blue badge / copyright strike" DMs in the last 30 days?',
    weight: 23,
    fix: 'Never click DM-links that ask you to "verify" or "appeal" — that\'s 90% of takeovers.',
  },
];

const ToolSecurityScore = () => {
  const [a, setA] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const allDone = QUESTIONS.every(q => a[q.key] !== undefined);

  const { score, weakSpots } = useMemo(() => {
    let s = 0;
    const ws = [];
    for (const q of QUESTIONS) {
      if (a[q.key] === true) s += q.weight;
      else if (a[q.key] === false) ws.push(q);
    }
    return { score: s, weakSpots: ws };
  }, [a]);

  const tier = score >= 80 ? 'good' : score >= 50 ? 'okay' : 'poor';
  const tierConf = {
    good: { label: 'Fortified', color: '#00ff9d', msg: 'Your account is well-protected. Stay on guard for phishing DMs.' },
    okay: { label: 'Exposed',   color: '#ffd34d', msg: 'You\'re partially protected — close the gaps below.' },
    poor: { label: 'At risk',   color: '#ff3148', msg: 'High risk of takeover. Fix the items below immediately.' },
  }[tier];

  // Ring math
  const R = 92;
  const CIRC = 2 * Math.PI * R;
  const offset = submitted ? CIRC - (CIRC * Math.min(score, 100) / 100) : CIRC;

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link to="/tools" className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest opacity-70 hover:opacity-100 mb-6">
          <ArrowLeft size={12} /> BACK TO TOOLS
        </Link>

        <div className="text-center mb-8">
          <div className="eh-kicker justify-center mb-3">// FREE TOOL · SECURITY SCORE</div>
          <h1 className="font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.7rem, 5vw, 2.8rem)' }}>
            Your <span className="eh-neon">Instagram</span> Security Audit
          </h1>
          <p className="opacity-70 mt-3 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            Six honest questions. One score. Actionable fixes.
          </p>
        </div>

        {!submitted && (
          <div className="eh-panel eh-brackets p-5 sm:p-7 space-y-5">
            <span className="br-bl" /><span className="br-br" />
            {QUESTIONS.map((q, idx) => (
              <div key={q.key} className="pb-4 border-b border-[var(--eh-border)] last:border-0 last:pb-0">
                <div className="flex gap-3 mb-3">
                  <span className="shrink-0 w-6 h-6 rounded-md grid place-items-center eh-mono text-[10px] font-bold" style={{ background: 'rgba(0,255,157,.12)', color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.3)' }}>{idx + 1}</span>
                  <div className="text-sm leading-snug" style={{ fontFamily: 'Inter, sans-serif' }}>{q.q}</div>
                </div>
                <div className="flex gap-2 pl-9">
                  {[['yes', true], ['no', false]].map(([label, v]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setA({ ...a, [q.key]: v })}
                      data-testid={`security-${q.key}-${label}`}
                      className={`eh-mono text-[11px] tracking-widest px-4 py-2 rounded-md border transition-colors ${a[q.key] === v ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
                    >
                      {label.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => setSubmitted(true)}
              disabled={!allDone}
              data-testid="security-submit"
              className="eh-btn-primary w-full"
              style={{ opacity: allDone ? 1 : .5, cursor: allDone ? 'pointer' : 'not-allowed' }}
            >
              CALCULATE MY SCORE <ArrowRight size={14} />
            </button>
          </div>
        )}

        {submitted && (
          <div className="space-y-5" data-testid="security-result">
            <div className="eh-panel eh-brackets p-6 sm:p-8 text-center">
              <span className="br-bl" /><span className="br-br" />
              <div className="score-ring-wrap mb-4">
                <svg viewBox="0 0 220 220" width="220" height="220" className="score-ring-svg">
                  <circle cx="110" cy="110" r={R} strokeWidth="14" fill="none" className="score-ring-bg" />
                  <circle
                    cx="110" cy="110" r={R} strokeWidth="14" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={offset}
                    className={`score-ring-fg ${tier === 'poor' ? 'is-poor' : tier === 'okay' ? 'is-okay' : ''}`}
                  />
                </svg>
                <div className="score-ring-label">
                  <div className={`score-ring-num ${tier === 'poor' ? 'is-poor' : tier === 'okay' ? 'is-okay' : ''}`} data-testid="security-score-value">
                    {score}
                  </div>
                  <div className="score-ring-sub">/ 100 · {tierConf.label.toUpperCase()}</div>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full eh-mono text-[11px] tracking-widest" style={{ background: 'rgba(255,255,255,.04)', color: tierConf.color, border: `1px solid ${tierConf.color}55` }}>
                <ShieldCheck size={12} /> {tierConf.msg}
              </div>
            </div>

            {weakSpots.length > 0 && (
              <div className="eh-panel eh-brackets p-5 sm:p-6">
                <span className="br-bl" /><span className="br-br" />
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={16} className="text-[#ffd34d]" />
                  <span className="eh-mono text-[11px] tracking-widest opacity-80">// WEAK SPOTS · {weakSpots.length} TO FIX</span>
                </div>
                <ul className="space-y-3">
                  {weakSpots.map(w => (
                    <li key={w.key} className="flex gap-3 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: '#ffd34d', boxShadow: '0 0 8px #ffd34d' }} />
                      <span className="opacity-90">{w.fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {weakSpots.length === 0 && (
              <div className="eh-panel p-6 text-center">
                <CheckCircle2 size={28} className="mx-auto text-[var(--eh-green)] mb-2" />
                <div className="font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>You&apos;re fully fortified. Stay sharp on DMs.</div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => { setSubmitted(false); setA({}); }}
                data-testid="security-restart"
                className="eh-btn-ghost flex-1 justify-center text-xs"
              >
                <RefreshCw size={12} /> RUN AGAIN
              </button>
              <Link to="/recovery" data-testid="security-cta-recovery" className="eh-btn-primary flex-1 justify-center text-xs">
                NEED ACCOUNT RECOVERY? <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolSecurityScore;
