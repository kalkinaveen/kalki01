import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, ArrowRight, CheckCircle2, XCircle, Sun, Moon, Image as ImgIcon } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import SafetyTipsCard from '../components/SafetyTipsCard';

const SelfieCoach = () => {
  const [f, setF] = useState({ lighting: 'bright', background: 'plain', holding_id: true, matches_profile: true });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setRes(null);
    try {
      const r = await api.toolsSelfieCoach(f);
      setRes(r);
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally { setBusy(false); }
  };

  const tierConf = res && ({
    ready:        { color: '#00ff9d', label: 'READY TO RECORD' },
    'needs-work': { color: '#ffd34d', label: 'NEEDS WORK FIRST' },
    'high-risk':  { color: '#ff3148', label: 'HIGH RISK — FIX BEFORE RECORDING' },
  }[res.tier]);

  const R = 92, CIRC = 2 * Math.PI * R;
  const offset = res ? CIRC - (CIRC * Math.min(res.score, 100) / 100) : CIRC;

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link to="/tools" className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest opacity-70 hover:opacity-100 mb-6">
          <ArrowLeft size={12} /> BACK TO TOOLS
        </Link>
        <div className="text-center mb-8">
          <div className="eh-kicker justify-center mb-3">// FREE TOOL · SELFIE PREP COACH</div>
          <h1 className="font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.7rem, 5vw, 2.8rem)' }}>
            Pass Instagram&apos;s <span className="eh-neon">video selfie</span> on the first try
          </h1>
          <p className="opacity-70 mt-3 text-sm max-w-xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Tell us about your setup — we&apos;ll tell you exactly what to fix before you hit record.
          </p>
        </div>

        <div className="eh-panel eh-brackets p-5 sm:p-7 space-y-5">
          <span className="br-bl" /><span className="br-br" />

          <div>
            <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Lighting</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['bright', 'Bright daylight', Sun],
                ['mixed', 'Mixed lighting', ImgIcon],
                ['dim', 'Dim / artificial', Moon],
              ].map(([v, l, I]) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`selfie-light-${v}`}
                  onClick={() => setF({ ...f, lighting: v })}
                  className={`eh-mono text-[10px] tracking-widest py-3 rounded border inline-flex flex-col items-center gap-1 ${f.lighting === v ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
                >
                  <I size={16} />
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Background</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['plain', 'Plain wall'],
                ['busy', 'Busy / cluttered'],
                ['unsafe', 'People / private items visible'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`selfie-bg-${v}`}
                  onClick={() => setF({ ...f, background: v })}
                  className={`eh-mono text-[10px] tracking-widest py-2.5 rounded border ${f.background === v ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
                >{l}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="selfie-holding-id"
              onClick={() => setF({ ...f, holding_id: !f.holding_id })}
              className={`eh-mono text-[11px] tracking-widest py-2.5 rounded border ${f.holding_id ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
            >{f.holding_id ? '✓ Holding ID' : 'No ID in frame'}</button>
            <button
              type="button"
              data-testid="selfie-matches-profile"
              onClick={() => setF({ ...f, matches_profile: !f.matches_profile })}
              className={`eh-mono text-[11px] tracking-widest py-2.5 rounded border ${f.matches_profile ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
            >{f.matches_profile ? '✓ Look matches profile' : 'Different from profile photos'}</button>
          </div>

          <button data-testid="selfie-submit" onClick={run} disabled={busy} className="eh-btn-primary w-full" style={{ opacity: busy ? .7 : 1 }}>
            {busy ? 'COACHING…' : <><Camera size={14} /> RATE MY SETUP <ArrowRight size={14} /></>}
          </button>
        </div>

        {res && tierConf && (
          <div className="mt-6 space-y-4" data-testid="selfie-result">
            <div className="eh-panel p-6 sm:p-8 text-center">
              <div className="score-ring-wrap mb-4">
                <svg viewBox="0 0 220 220" width="220" height="220" className="score-ring-svg">
                  <circle cx="110" cy="110" r={R} strokeWidth="14" fill="none" className="score-ring-bg" />
                  <circle
                    cx="110" cy="110" r={R} strokeWidth="14" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={offset}
                    className={`score-ring-fg ${res.tier === 'high-risk' ? 'is-poor' : res.tier === 'needs-work' ? 'is-okay' : ''}`}
                  />
                </svg>
                <div className="score-ring-label">
                  <div className={`score-ring-num ${res.tier === 'high-risk' ? 'is-poor' : res.tier === 'needs-work' ? 'is-okay' : ''}`} data-testid="selfie-score">
                    {res.score}
                  </div>
                  <div className="score-ring-sub">/ 100 · READINESS</div>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full eh-mono text-[11px] tracking-widest" style={{ background: 'rgba(255,255,255,.04)', color: tierConf.color, border: `1px solid ${tierConf.color}55` }}>
                <Camera size={12} /> {tierConf.label}
              </div>
            </div>

            {res.blockers?.length > 0 && (
              <div className="eh-panel p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle size={16} color="#ff3148" />
                  <span className="eh-mono text-[11px] tracking-widest opacity-80">// FIX THESE BLOCKERS FIRST</span>
                </div>
                <ul className="space-y-2.5">
                  {res.blockers.map((b, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: '#ff3148', boxShadow: '0 0 8px #ff3148' }} />
                      <span className="opacity-90">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {res.tips?.length > 0 && (
              <div className="eh-panel p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={16} color="#ffd34d" />
                  <span className="eh-mono text-[11px] tracking-widest opacity-80">// QUICK IMPROVEMENTS</span>
                </div>
                <ul className="space-y-2.5">
                  {res.tips.map((t, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: '#ffd34d', boxShadow: '0 0 8px #ffd34d' }} />
                      <span className="opacity-90">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="eh-panel p-5">
                <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-2" style={{ color: 'var(--eh-green)' }}>✓ ALWAYS DO</div>
                <ul className="space-y-1.5">
                  {res.universal_dos.map((d, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <CheckCircle2 size={12} className="text-[var(--eh-green)] shrink-0 mt-1" />
                      <span className="opacity-90">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="eh-panel p-5">
                <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-2" style={{ color: '#ff3148' }}>✗ NEVER DO</div>
                <ul className="space-y-1.5">
                  {res.universal_donts.map((d, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <XCircle size={12} className="text-[#ff3148] shrink-0 mt-1" />
                      <span className="opacity-90">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <SafetyTipsCard variant="warn" tips={[
              'Your selfie should ONLY be uploaded inside the official Instagram / Facebook app — no third-party site, no Telegram "agent", no email attachment.',
              'If the platform asks for a selfie WITH ID, hold the ID flat next to your face — never cover your face with it.',
              'Never reuse the same selfie video across multiple platforms — record fresh each time.',
              'If verification fails, wait 24h before retrying. Repeated submissions can blacklist you.',
            ]} />

            <Link to="/recovery" data-testid="selfie-cta-recovery" className="eh-btn-primary text-xs w-full justify-center">
              NEED HUMAN HELP WITH VERIFICATION? <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfieCoach;
