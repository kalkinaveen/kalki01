import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, ShieldCheck, ArrowRight, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import SafetyTipsCard from '../components/SafetyTipsCard';

const CHANNELS = ['DM', 'SMS', 'Email', 'Comment'];

const RISK_THEME = {
  safe:     { color: '#00ff9d', label: 'LOOKS SAFE',    Icon: ShieldCheck },
  low:      { color: '#9ae6b4', label: 'LOW RISK',      Icon: ShieldCheck },
  medium:   { color: '#ffd34d', label: 'SUSPICIOUS',    Icon: ShieldAlert },
  high:     { color: '#ff8a3a', label: 'HIGH RISK',     Icon: ShieldAlert },
  critical: { color: '#ff3148', label: 'CRITICAL · DO NOT ENGAGE', Icon: ShieldAlert },
};

const PhishingDetector = () => {
  const [text, setText] = useState('');
  const [channel, setChannel] = useState('DM');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (text.trim().length < 8) {
      toast.error('Paste the suspicious message (at least 8 characters)');
      return;
    }
    setBusy(true); setRes(null);
    try {
      const r = await api.toolsPhishing({ message: text.trim(), channel });
      setRes(r);
    } catch (e) {
      toast.error(e.message || 'Analysis failed');
    } finally { setBusy(false); }
  };

  const theme = res && (RISK_THEME[res.risk_level] || RISK_THEME.medium);

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link to="/tools" className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest opacity-70 hover:opacity-100 mb-6">
          <ArrowLeft size={12} /> BACK TO TOOLS
        </Link>
        <div className="text-center mb-8">
          <div className="eh-kicker justify-center mb-3">// AI TOOL · PHISHING DETECTOR</div>
          <h1 className="font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.7rem, 5vw, 2.8rem)' }}>
            Is this DM a <span className="eh-neon">scam?</span>
          </h1>
          <p className="opacity-70 mt-3 text-sm max-w-xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Paste any suspicious DM, SMS, email or comment — our AI flags red-flags &amp; rates the risk in seconds.
          </p>
        </div>

        <div className="eh-panel eh-brackets p-5 sm:p-7 space-y-4">
          <span className="br-bl" /><span className="br-br" />
          <div>
            <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Channel</label>
            <div className="grid grid-cols-4 gap-2">
              {CHANNELS.map(c => (
                <button
                  key={c}
                  type="button"
                  data-testid={`phish-ch-${c.toLowerCase()}`}
                  onClick={() => setChannel(c)}
                  className={`eh-mono text-[11px] tracking-widest py-2 rounded border transition-colors ${channel === c ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
                >{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Paste the suspicious message</label>
            <textarea
              data-testid="phish-input"
              className="eh-textarea"
              rows={6}
              placeholder={'e.g. "Hello, this is from Instagram support. Your account violates copyright. Click here to appeal within 24 hours..."'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="eh-mono text-[10px] opacity-50 mt-1.5">
              {text.length}/6000 chars · we never store your message
            </div>
          </div>
          <button data-testid="phish-submit" onClick={run} disabled={busy} className="eh-btn-primary w-full" style={{ opacity: busy ? .7 : 1 }}>
            {busy ? 'ANALYSING…' : <>ANALYSE MESSAGE <ArrowRight size={14} /></>}
          </button>
        </div>

        {res && theme && (
          <div className="mt-6 space-y-4" data-testid="phishing-result">
            <div className="eh-panel p-5 sm:p-7" data-testid="phish-risk-badge">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl grid place-items-center shrink-0" style={{ background: `${theme.color}14`, border: `1px solid ${theme.color}66` }}>
                  <theme.Icon size={26} color={theme.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="eh-mono text-[10px] tracking-widest" style={{ color: theme.color }}>{theme.label}</div>
                  <div className="font-bold text-lg sm:text-xl leading-snug mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {res.verdict}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
                      <div style={{ width: `${res.confidence}%`, background: theme.color, height: '100%', boxShadow: `0 0 8px ${theme.color}` }} />
                    </div>
                    <div className="eh-mono text-[11px] tracking-widest opacity-80">{res.confidence}% confidence</div>
                  </div>
                </div>
              </div>
            </div>

            {res.red_flags?.length > 0 && (
              <div className="eh-panel p-5 sm:p-6">
                <div className="eh-mono text-[11px] tracking-widest opacity-80 mb-3">// RED FLAGS DETECTED</div>
                <ul className="space-y-2">
                  {res.red_flags.map((f, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: '#ff3148', boxShadow: '0 0 8px #ff3148' }} />
                      <span className="opacity-90">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {res.green_flags?.length > 0 && (
              <div className="eh-panel p-5 sm:p-6">
                <div className="eh-mono text-[11px] tracking-widest opacity-80 mb-3">// LEGITIMATE SIGNALS</div>
                <ul className="space-y-2">
                  {res.green_flags.map((g, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: '#00ff9d', boxShadow: '0 0 8px #00ff9d' }} />
                      <span className="opacity-90">{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {res.action && (
              <div className="eh-panel p-5 sm:p-6" style={{ borderLeft: `3px solid ${theme.color}` }}>
                <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1.5" style={{ color: theme.color }}>// RECOMMENDED ACTION</div>
                <div className="text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>{res.action}</div>
              </div>
            )}

            <SafetyTipsCard variant="warn" tips={[
              'Never click links in suspicious messages — even to "appeal" or "verify". Open the official app directly instead.',
              'Instagram, Meta, banks, and govt agencies will NEVER ask for your password, OTP, or 2FA code via DM/SMS.',
              'Real "blue badge" outreach happens inside the app — never via DM links from external accounts.',
              'If you already clicked or shared info: change your password immediately and enable 2FA on an authenticator app.',
              'Report &amp; block the sender — and tell one friend so they don\'t fall for the same script.',
            ]} />

            <div className="flex gap-2">
              <button onClick={() => { setRes(null); setText(''); }} data-testid="phish-restart" className="eh-btn-ghost flex-1 justify-center text-xs">
                <RotateCcw size={12} /> CHECK ANOTHER
              </button>
              {(res.risk_level === 'high' || res.risk_level === 'critical') && (
                <Link to="/recovery" data-testid="phish-cta-recovery" className="eh-btn-primary flex-1 justify-center text-xs">
                  ALREADY CLICKED? RECOVER NOW <ArrowRight size={12} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhishingDetector;
