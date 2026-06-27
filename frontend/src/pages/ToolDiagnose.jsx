import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, AlertTriangle, CheckCircle2, ArrowRight, MessageCircle } from 'lucide-react';

/**
 * Issue Checker — 5 dropdowns → rule-based diagnosis.
 * Pure client-side (no LLM). The output recommends our /recovery service or Telegram.
 */

const Q = [
  {
    key: 'platform',
    label: 'Platform',
    options: [
      ['instagram', 'Instagram'],
      ['facebook', 'Facebook'],
      ['tiktok', 'TikTok'],
      ['snapchat', 'Snapchat'],
      ['other', 'Other'],
    ],
  },
  {
    key: 'symptom',
    label: 'What happened?',
    options: [
      ['disabled', 'Account is disabled / banned'],
      ['hacked', 'Account is hacked / someone else has access'],
      ['locked', '2FA locked me out'],
      ['forgot', 'Forgot password / lost access to email'],
      ['suspicious', 'Suspicious-activity / temporary lock'],
      ['shadowban', 'Shadowbanned · reach dropped to zero'],
      ['impersonation', 'Impersonator stole my identity'],
    ],
  },
  {
    key: 'when',
    label: 'How long ago?',
    options: [
      ['today', 'Today'],
      ['week', 'Within last 7 days'],
      ['month', '1–4 weeks ago'],
      ['older', 'More than a month ago'],
    ],
  },
  {
    key: 'email_access',
    label: 'Do you still have access to the registered email?',
    options: [
      ['yes', 'Yes'],
      ['no', 'No'],
      ['unsure', 'Not sure'],
    ],
  },
  {
    key: 'phone_access',
    label: 'Do you still have the phone number on the account?',
    options: [
      ['yes', 'Yes'],
      ['no', 'No'],
      ['unsure', 'Not sure'],
    ],
  },
];

const buildDiagnosis = (a) => {
  const s = a.symptom;
  const out = { headline: '', risk: 'medium', steps: [], serviceKey: 'disabled' };

  if (s === 'disabled') {
    out.headline = 'Likely policy / community-guidelines action.';
    out.risk = 'high';
    out.serviceKey = 'disabled';
    out.steps = [
      'Open the app — do NOT log out. Tap the "Get Help" link on the disabled screen.',
      'Submit one (not multiple) clean appeal with a real selfie ID if asked.',
      'If denied, wait 24–48h and re-appeal from a different browser, never from a VPN.',
      'Avoid logging in repeatedly — that re-flags the account.',
    ];
  } else if (s === 'hacked') {
    out.headline = 'Active account-takeover. Speed matters.';
    out.risk = 'critical';
    out.serviceKey = 'hacked';
    out.steps = [
      'Go to instagram.com/hacked → "My account was hacked".',
      'Revoke active sessions from any device that still has your login.',
      'Reset password from the registered email if you still control it.',
      'Submit a video selfie to Instagram support and reply to their auto-email within 24h.',
    ];
  } else if (s === 'locked') {
    out.headline = 'Two-factor lockout — recoverable in most cases.';
    out.risk = 'medium';
    out.serviceKey = '2fa';
    out.steps = [
      'On the 2FA screen tap "Try another way" → "Get support".',
      'Pick "SMS code" or "Backup codes" — use any old backup code if you saved one.',
      'If both fail, request manual review — they will email a form for ID verification.',
    ];
  } else if (s === 'forgot') {
    out.headline = 'Credential recovery — usually solvable end-to-end.';
    out.risk = a.email_access === 'no' && a.phone_access === 'no' ? 'high' : 'low';
    out.serviceKey = 'password';
    out.steps = [
      'Open login → "Forgot password" → try every old email/phone you remember.',
      'If none work, tap "Need more help?" and submit identity verification.',
      'Check spam folder for "Verify it\'s you" emails — those expire in 24h.',
    ];
  } else if (s === 'suspicious') {
    out.headline = 'Temporary security lock — clears with quick verification.';
    out.risk = 'low';
    out.serviceKey = 'hacked';
    out.steps = [
      'Wait 24h before retrying — repeated logins extend the lock.',
      'Verify via SMS / email when prompted; use the original SIM / mail client.',
      'Avoid logging in from new countries via VPN — that\'s often what triggers the lock.',
    ];
  } else if (s === 'shadowban') {
    out.headline = 'Algorithmic reach restriction — usually fixable in 2–4 weeks.',
    out.risk = 'low';
    out.serviceKey = 'privacy';
    out.steps = [
      'Stop posting for 72 hours — completely.',
      'Audit your last 30 captions for banned hashtags (use a checker like displaypurposes).',
      'Switch to a Personal account for 7 days, then back to Creator.',
      'Resume with original content (no reposts) and only 3–5 hashtags per post.',
    ];
  } else if (s === 'impersonation') {
    out.headline = 'Impersonation takedown — formal report needed.';
    out.risk = 'medium';
    out.serviceKey = 'username';
    out.steps = [
      'Go to instagram.com/legal/report → "Impersonation".',
      'Submit a clear photo of your government ID matching your real name.',
      'In parallel, mass-report the imposter from 5–10 trusted accounts.',
    ];
  }

  // Modifiers
  if (a.when === 'older' && (s === 'disabled' || s === 'hacked')) {
    out.steps.push('Because this is older than a month, official self-recovery rarely works — professional recovery is often the only path forward.');
  }
  if (a.email_access === 'no' && a.phone_access === 'no') {
    out.steps.push('You\'ve lost both your email and phone — without those, identity-verified manual review is mandatory.');
  }

  return out;
};

const RISK = {
  low:      { color: '#00ff9d', label: 'Low risk · self-recoverable' },
  medium:   { color: '#ffd34d', label: 'Medium risk · expert help recommended' },
  high:     { color: '#ff8a3a', label: 'High risk · move fast' },
  critical: { color: '#ff3148', label: 'Critical · act within 24h' },
};

const ToolDiagnose = () => {
  const [a, setA] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const ready = useMemo(() => Q.every(q => a[q.key]), [a]);
  const result = useMemo(() => (submitted && ready ? buildDiagnosis(a) : null), [submitted, ready, a]);

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link to="/tools" className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest opacity-70 hover:opacity-100 mb-6">
          <ArrowLeft size={12} /> BACK TO TOOLS
        </Link>

        <div className="text-center mb-8">
          <div className="eh-kicker justify-center mb-3">// FREE TOOL · ISSUE CHECKER</div>
          <h1 className="font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.7rem, 5vw, 2.8rem)' }}>
            Diagnose Your <span className="eh-neon">Instagram</span> Issue
          </h1>
          <p className="opacity-70 mt-3 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            Answer 5 quick questions to get a tailored recovery roadmap.
          </p>
        </div>

        {!result && (
          <div className="eh-panel eh-brackets p-5 sm:p-7 space-y-5">
            <span className="br-bl" /><span className="br-br" />
            {Q.map(q => (
              <div key={q.key}>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">{q.label}</label>
                <select
                  data-testid={`diagnose-${q.key}`}
                  className="eh-input"
                  value={a[q.key] || ''}
                  onChange={(e) => setA({ ...a, [q.key]: e.target.value })}
                >
                  <option value="">— select —</option>
                  {q.options.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            ))}

            <button
              onClick={() => setSubmitted(true)}
              disabled={!ready}
              data-testid="diagnose-submit"
              className="eh-btn-primary w-full"
              style={{ opacity: ready ? 1 : 0.5, cursor: ready ? 'pointer' : 'not-allowed' }}
            >
              RUN DIAGNOSIS <ArrowRight size={14} />
            </button>
          </div>
        )}

        {result && (
          <div className="space-y-5" data-testid="diagnose-result">
            <div className="eh-panel eh-brackets p-5 sm:p-7">
              <span className="br-bl" /><span className="br-br" />
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(0,255,157,.08)', border: '1px solid rgba(0,255,157,.3)' }}>
                  <Stethoscope size={20} color="var(--eh-green)" />
                </div>
                <div className="min-w-0">
                  <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1">// DIAGNOSIS</div>
                  <h2 className="text-lg sm:text-xl font-bold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{result.headline}</h2>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full eh-mono text-[11px] tracking-widest" style={{ background: 'rgba(255,255,255,.04)', color: RISK[result.risk].color, border: `1px solid ${RISK[result.risk].color}55` }}>
                <AlertTriangle size={12} /> {RISK[result.risk].label}
              </div>

              <div className="mt-5 eh-mono text-[10px] tracking-widest opacity-60 mb-2">// YOUR ROADMAP</div>
              <ol className="space-y-2.5">
                {result.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <span className="shrink-0 w-6 h-6 rounded-md grid place-items-center eh-mono text-[10px] font-bold" style={{ background: 'rgba(0,255,157,.12)', color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.3)' }}>{i + 1}</span>
                    <span className="opacity-90">{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="eh-panel p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="min-w-0">
                <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1">// NEED A HAND?</div>
                <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Skip the trial-and-error — let our team handle it from here.
                </div>
                <div className="text-xs opacity-65 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                  ETA 2–7 days · 24/7 case updates · pay only on success.
                </div>
              </div>
              <div className="flex gap-2 flex-wrap shrink-0">
                <Link to={`/recovery?service=${result.serviceKey}`} data-testid="diagnose-cta-recovery" className="eh-btn-primary text-xs">
                  START RECOVERY <ArrowRight size={12} />
                </Link>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); setA({}); }}
                  data-testid="diagnose-restart"
                  className="eh-btn-ghost text-xs"
                >
                  RUN AGAIN
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const btn = document.querySelector('[data-testid="floating-faq-chat-toggle"]');
                if (btn) btn.click();
              }}
              data-testid="diagnose-open-chat"
              className="w-full eh-mono text-xs py-3 border border-[var(--eh-border)] rounded-md opacity-80 hover:opacity-100 hover:border-[var(--eh-green)] transition-colors inline-flex items-center justify-center gap-2"
            >
              <MessageCircle size={12} /> ASK ERR0R-HELP — OUR AI ASSISTANT
            </button>

            <p className="text-center text-[11px] opacity-50 eh-mono pt-2">
              <CheckCircle2 size={10} className="inline -mt-0.5 mr-1" /> auto-generated · no data stored
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolDiagnose;
