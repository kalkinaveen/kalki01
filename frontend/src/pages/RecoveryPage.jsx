import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Clock, BadgeCheck, ChevronRight, ChevronLeft, Loader2, CheckCircle2, AlertTriangle, Send as TgIcon, Phone, Upload, X, Star, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const STEPS = ['service', 'details', 'contact'];

const URGENCY_MULTIPLIER = { low: 0.85, medium: 1.0, high: 1.4 };
const FOLLOWER_TIERS = [
  { v: '0-1k', label: 'Under 1,000' },
  { v: '1k-10k', label: '1,000 – 9,999' },
  { v: '10k-100k', label: '10,000 – 99,999' },
  { v: '100k-500k', label: '100,000 – 499,999' },
  { v: '500k+', label: '500,000+' },
];

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

const PriceCard = ({ service, urgency, currency = 'INR' }) => {
  if (!service) {
    return (
      <div className="eh-panel p-5 sticky top-24">
        <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-2">// PRICE ESTIMATE</div>
        <div className="eh-display text-2xl font-black eh-neon mb-2">{currency === 'USD' ? '$' : '₹'}—</div>
        <div className="eh-mono text-xs opacity-60">Select a service to see your price range.</div>
      </div>
    );
  }
  const mult = URGENCY_MULTIPLIER[urgency] || 1;
  const min = Math.round(service.price_min * mult);
  const max = Math.round(service.price_max * mult);
  const sym = currency === 'USD' ? '$' : '₹';
  return (
    <div className="eh-panel p-5 sticky top-24" data-testid="recovery-price-card">
      <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-2">// PRICE ESTIMATE</div>
      <div className="eh-display text-2xl sm:text-3xl font-black eh-neon mb-1 break-all">{sym}{fmt(min)} – {sym}{fmt(max)}</div>
      <div className="eh-mono text-[10px] opacity-50 mb-4">{currency}</div>
      <div className="space-y-2.5 eh-mono text-xs">
        <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[var(--eh-green)] shrink-0" /> Highest Priority Processing</div>
        <div className="flex items-center gap-2"><Lock size={14} className="text-[var(--eh-green)] shrink-0" /> Secure Transfer Protocol</div>
        <div className="flex items-center gap-2"><Clock size={14} className="text-[var(--eh-green)] shrink-0" /> ETA: {service.eta_min_days}–{service.eta_max_days} days</div>
        <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-[var(--eh-green)] shrink-0" /> Payment On Delivery</div>
        <div className="flex items-center gap-2 opacity-80"><BadgeCheck size={14} className="text-[#4de0ff] shrink-0" /> Success rate: {service.success_rate}%</div>
      </div>
    </div>
  );
};

const Stepper = ({ active }) => {
  const labels = ['Pick Service', 'Case Details', 'Contact Info'];
  return (
    <div className="flex items-center gap-1 sm:gap-2 mb-6 overflow-x-auto eh-no-scrollbar">
      {labels.map((l, i) => {
        const idx = STEPS.indexOf(active);
        const isActive = i === idx;
        const isDone = i < idx;
        return (
          <React.Fragment key={l}>
            <div className={`flex items-center gap-2 px-3 py-2 rounded eh-mono text-[11px] tracking-widest uppercase shrink-0 ${isActive ? 'bg-[rgba(0,255,157,.12)] text-[var(--eh-green)] border border-[var(--eh-green)]' : isDone ? 'opacity-90' : 'opacity-50'}`}>
              <span className={`w-5 h-5 grid place-items-center rounded-full text-[10px] font-bold ${isActive || isDone ? 'bg-[var(--eh-green)] text-[#001a10]' : 'border border-[var(--eh-border)]'}`}>{isDone ? '✓' : i + 1}</span>
              <span>{l}</span>
            </div>
            {i < labels.length - 1 && <ChevronRight size={14} className="opacity-40 shrink-0" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const TrustBar = ({ trust, stats }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
    <div className="eh-panel p-4">
      <div className="eh-mono text-[10px] opacity-60">RECOVERED</div>
      <div className="eh-display text-xl font-black eh-neon">{fmt((stats?.recovered || 0) + (trust?.claim_recovered_total || 0))}+</div>
      <div className="eh-mono text-[10px] opacity-50">cases</div>
    </div>
    <div className="eh-panel p-4">
      <div className="eh-mono text-[10px] opacity-60">SUCCESS</div>
      <div className="eh-display text-xl font-black eh-neon">{stats?.success_rate || 92}%</div>
      <div className="eh-mono text-[10px] opacity-50">avg rate</div>
    </div>
    <div className="eh-panel p-4">
      <div className="eh-mono text-[10px] opacity-60">AVG ETA</div>
      <div className="eh-display text-xl font-black">{trust?.avg_eta || '1–30 days'}</div>
      <div className="eh-mono text-[10px] opacity-50">turnaround</div>
    </div>
    <div className="eh-panel p-4">
      <div className="eh-mono text-[10px] opacity-60">SECURITY</div>
      <div className="eh-display text-base font-black break-words">{trust?.encryption || 'AES-256'}</div>
      <div className="eh-mono text-[10px] opacity-50">{trust?.guarantee || 'Payment On Delivery'}</div>
    </div>
  </div>
);

const StepService = ({ services, value, onChange }) => (
  <div className="space-y-2.5">
    <div className="eh-kicker mb-1">// SELECT THE ISSUE</div>
    <div className="grid sm:grid-cols-2 gap-3">
      {services.filter(s => s.active !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(s => {
        const sel = value === s.id;
        return (
          <button key={s.id} type="button" onClick={() => onChange(s.id)} data-testid={`recovery-svc-${s.issue_key}`}
            className={`text-left p-4 rounded-md border transition-colors ${sel ? 'border-[var(--eh-green)] bg-[rgba(0,255,157,.05)]' : 'border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-bold text-sm">{s.name}</div>
              {sel && <CheckCircle2 size={16} className="text-[var(--eh-green)] shrink-0" />}
            </div>
            <div className="flex items-center gap-3 eh-mono text-[10px] opacity-70 mb-2">
              <span>ETA {s.eta_min_days}–{s.eta_max_days}d</span>
              <span>·</span>
              <span>{s.success_rate}% success</span>
            </div>
            <div className="space-y-1">
              {(s.bullets || []).slice(0, 3).map((b, i) => (
                <div key={i} className="eh-mono text-[11px] opacity-70 flex gap-1.5"><span className="text-[var(--eh-green)]">›</span> {b}</div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const StepDetails = ({ platforms, value, onPatch, onUploadProof, uploadBusy }) => (
  <div className="space-y-4">
    <div className="eh-kicker mb-1">// CASE INFORMATION</div>
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <div className="eh-mono text-xs opacity-70 mb-1.5">PLATFORM</div>
        <select className="eh-input" data-testid="recovery-platform" value={value.platform || ''} onChange={e => onPatch({ platform: e.target.value })}>
          <option value="">Select platform…</option>
          {platforms.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <div className="eh-mono text-xs opacity-70 mb-1.5">URGENCY</div>
        <select className="eh-input" data-testid="recovery-urgency" value={value.urgency || 'medium'} onChange={e => onPatch({ urgency: e.target.value })}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <div className="eh-mono text-xs opacity-70 mb-1.5">ACCOUNT URL / HANDLE</div>
        <input className="eh-input" data-testid="recovery-account" placeholder="instagram.com/yourhandle  or  @yourhandle" value={value.account_url || ''} onChange={e => onPatch({ account_url: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <div className="eh-mono text-xs opacity-70 mb-1.5">FOLLOWER COUNT</div>
        <select className="eh-input" data-testid="recovery-followers" value={value.follower_tier || ''} onChange={e => onPatch({ follower_tier: e.target.value })}>
          <option value="">Select follower count…</option>
          {FOLLOWER_TIERS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <div className="eh-mono text-xs opacity-70 mb-1.5">WHAT HAPPENED? (be specific — when, how, last login)</div>
        <textarea rows={5} className="eh-textarea" data-testid="recovery-desc" value={value.description || ''} onChange={e => onPatch({ description: e.target.value })} placeholder="My Instagram was disabled on May 14 after a flag for impersonation. I have my ID card and original email…" />
      </div>
      <div className="sm:col-span-2">
        <div className="eh-mono text-xs opacity-70 mb-1.5">PROOF / SCREENSHOTS (optional, up to 5)</div>
        <label className="eh-panel p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--eh-green)] border border-dashed border-[var(--eh-border)] rounded transition-colors" data-testid="recovery-proof-upload">
          {uploadBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <span className="eh-mono text-xs">{uploadBusy ? 'Uploading…' : 'Drop or pick screenshots'}</span>
          <input type="file" accept="image/*" multiple hidden disabled={uploadBusy} onChange={async (e) => {
            const files = Array.from(e.target.files || []).slice(0, 5 - (value.proof_urls?.length || 0));
            e.target.value = '';
            for (const f of files) await onUploadProof(f);
          }} />
        </label>
        {!!value.proof_urls?.length && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
            {value.proof_urls.map((u, i) => (
              <div key={i} className="relative aspect-square rounded overflow-hidden border border-[var(--eh-border)]">
                <img src={u} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => onPatch({ proof_urls: value.proof_urls.filter((_, idx) => idx !== i) })} className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-full bg-black/70 text-white hover:bg-black"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="eh-mono text-[10px] opacity-50 mt-2">// uploads encrypted & used only for your case review</div>
      </div>
    </div>
  </div>
);

const StepContact = ({ value, onPatch, hero }) => (
  <div className="space-y-4">
    <div className="eh-kicker mb-1">// CONTACT INFO</div>
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <div className="eh-mono text-xs opacity-70 mb-1.5">NAME</div>
        <input className="eh-input" required data-testid="recovery-name" value={value.name || ''} onChange={e => onPatch({ name: e.target.value })} placeholder="Your full name" />
      </div>
      <div>
        <div className="eh-mono text-xs opacity-70 mb-1.5">EMAIL</div>
        <input className="eh-input" type="email" required data-testid="recovery-email" value={value.email || ''} onChange={e => onPatch({ email: e.target.value })} placeholder="you@example.com" />
      </div>
      <div>
        <div className="eh-mono text-xs opacity-70 mb-1.5 flex items-center gap-1.5"><TgIcon size={11} /> TELEGRAM <span className="opacity-50 normal-case">(fastest reply)</span></div>
        <input className="eh-input" data-testid="recovery-telegram" value={value.telegram || ''} onChange={e => onPatch({ telegram: e.target.value })} placeholder="@yourhandle" />
      </div>
      <div>
        <div className="eh-mono text-xs opacity-70 mb-1.5 flex items-center gap-1.5"><Phone size={11} /> WHATSAPP / PHONE</div>
        <input className="eh-input" data-testid="recovery-whatsapp" value={value.whatsapp || ''} onChange={e => onPatch({ whatsapp: e.target.value })} placeholder="+91 99999 99999" />
      </div>
    </div>
    <div className="eh-panel p-4 bg-[rgba(0,255,157,.04)]">
      <div className="eh-mono text-[10px] opacity-70 mb-1">// PREFERRED CONTACT METHOD</div>
      <div className="flex flex-wrap gap-2">
        {[{ k: 'telegram', l: 'Telegram' }, { k: 'whatsapp', l: 'WhatsApp' }, { k: 'email', l: 'Email' }].map(o => (
          <button key={o.k} type="button" onClick={() => onPatch({ contact_pref: o.k })} className={`px-3 py-2 rounded text-xs eh-mono tracking-widest border ${value.contact_pref === o.k ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}>{o.l}</button>
        ))}
      </div>
    </div>
    {hero?.telegram_url && (
      <a href={hero.telegram_url} target="_blank" rel="noreferrer" className="block text-center eh-mono text-xs opacity-70 hover:opacity-100 underline">
        // Need urgent help? Message us on Telegram now →
      </a>
    )}
  </div>
);

const SuccessScreen = ({ caseId, hero }) => (
  <div className="eh-panel p-6 sm:p-8 text-center" data-testid="recovery-success">
    <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-4 bg-[rgba(0,255,157,.12)]">
      <CheckCircle2 size={32} className="text-[var(--eh-green)]" />
    </div>
    <div className="eh-kicker mb-2">// CASE SUBMITTED</div>
    <h3 className="eh-display text-2xl font-black mb-2">Your Case Will Be Reviewed Within 24h</h3>
    <div className="eh-mono text-xs opacity-70 mb-1">Case ID</div>
    <div className="eh-neon eh-mono font-bold text-lg mb-6 break-all">{caseId}</div>
    <div className="grid sm:grid-cols-2 gap-3 text-left mb-6">
      {[
        { n: 1, t: 'Case Review', d: 'Your case is reviewed by our expert team within 24 hours.' },
        { n: 2, t: 'Qualification', d: 'We confirm if your case qualifies for premium recovery service.' },
        { n: 3, t: 'Engagement', d: 'Once aligned, we finalize details and initiate the recovery.' },
        { n: 4, t: 'Verification', d: 'Most cases resolved within 1–30 days. Pay on delivery.' },
      ].map(s => (
        <div key={s.n} className="eh-panel p-4">
          <div className="text-[var(--eh-green)] font-bold text-2xl mb-1">{s.n}</div>
          <div className="font-bold text-sm mb-1">{s.t}</div>
          <div className="eh-mono text-[11px] opacity-70 leading-5">{s.d}</div>
        </div>
      ))}
    </div>
    {hero?.telegram_url && (
      <a href={hero.telegram_url} target="_blank" rel="noreferrer" className="eh-btn-primary inline-flex items-center gap-2" data-testid="recovery-success-tg">
        <TgIcon size={14} /> CONTINUE ON TELEGRAM
      </a>
    )}
    <div className="mt-6 eh-mono text-[11px] opacity-50">256-bit encrypted · Used only for your case review</div>
  </div>
);

const ReviewsSection = ({ reviews, services }) => {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? reviews : reviews.filter(r => r.service_key === filter);
  if (!reviews.length) return null;
  return (
    <section className="mt-14">
      <div className="eh-kicker mb-3">// HIGHLIGHTED REVIEWS</div>
      <h2 className="eh-display text-2xl sm:text-3xl font-black mb-5">From People Who Chose Recovery</h2>
      <div className="flex gap-2 overflow-x-auto eh-no-scrollbar pb-3 mb-4">
        <button onClick={() => setFilter('all')} className={`shrink-0 px-3 py-1.5 rounded text-[11px] eh-mono tracking-widest uppercase border ${filter === 'all' ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)]'}`}>ALL</button>
        {services.filter(s => s.active !== false).map(s => (
          <button key={s.id} onClick={() => setFilter(s.issue_key)} className={`shrink-0 px-3 py-1.5 rounded text-[11px] eh-mono tracking-widest uppercase border ${filter === s.issue_key ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)]'}`}>{s.name}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="eh-mono text-xs opacity-60 text-center py-10">No reviews for this category yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <div key={r.id} className="eh-panel p-5" data-testid={`recovery-review-${r.id}`}>
              <div className="flex gap-0.5 mb-3 text-[var(--eh-green)]">{Array.from({ length: r.rating || 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
              <div className="text-sm leading-6 mb-4 opacity-90">"{r.quote}"</div>
              <div className="flex items-center gap-3 pt-3 border-t border-[var(--eh-border)]">
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full grid place-items-center text-xs eh-mono" style={{ background: 'rgba(0,255,157,.15)', color: 'var(--eh-green)' }}>{(r.name || 'A')[0].toUpperCase()}</div>
                )}
                <div>
                  <div className="font-bold text-sm">{r.name}</div>
                  {r.handle && <div className="eh-mono text-[10px] opacity-60">{r.handle}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const RecoveryPage = () => {
  const { config } = useSiteConfig();
  const nav = useNavigate();
  const [step, setStep] = useState('service');
  const [cfg, setCfg] = useState({ services: [], platforms: [], hero: {}, trust: {} });
  const [stats, setStats] = useState({});
  const [reviews, setReviews] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [data, setData] = useState({
    service_id: '', service_name: '', platform: '', account_url: '', follower_tier: '',
    urgency: 'medium', description: '', proof_urls: [],
    name: '', email: '', phone: '', telegram: '', whatsapp: '',
    contact_pref: 'telegram', currency: 'INR',
  });

  useEffect(() => {
    api.recoveryConfig().then(setCfg).catch(() => {});
    api.recoveryStats().then(setStats).catch(() => {});
    api.recoveryListReviews().then(setReviews).catch(() => setReviews([]));
  }, []);

  // sync currency from server config
  useEffect(() => { if (cfg.default_currency) setData(d => ({ ...d, currency: cfg.default_currency })); }, [cfg.default_currency]);

  const service = useMemo(() => cfg.services.find(s => s.id === data.service_id), [cfg.services, data.service_id]);

  const estimatedPrice = useMemo(() => {
    if (!service) return 0;
    const mult = URGENCY_MULTIPLIER[data.urgency] || 1;
    return Math.round(((service.price_min + service.price_max) / 2) * mult);
  }, [service, data.urgency]);

  const patch = (p) => setData(d => ({ ...d, ...p }));

  const uploadProof = async (file) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large', { description: 'Max 5MB per image' }); return; }
    setUploadBusy(true);
    try {
      const { absoluteUrl } = await api.feedUploadMedia(file);
      setData(d => ({ ...d, proof_urls: [...(d.proof_urls || []), absoluteUrl] }));
    } catch (e) { toast.error('Upload failed', { description: e.message }); }
    finally { setUploadBusy(false); }
  };

  const next = () => {
    if (step === 'service') {
      if (!data.service_id) { toast.error('Please pick a service'); return; }
      setData(d => ({ ...d, service_name: service?.name || '' }));
      setStep('details');
    } else if (step === 'details') {
      if (!data.platform) { toast.error('Please select a platform'); return; }
      if (!data.description || data.description.trim().length < 10) { toast.error('Please describe what happened (10+ characters)'); return; }
      setStep('contact');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    if (!data.name.trim() || !data.email.trim()) { toast.error('Name and email are required'); return; }
    if (!/^\S+@\S+\.\S+$/.test(data.email)) { toast.error('Invalid email address'); return; }
    setSubmitting(true);
    try {
      const payload = { ...data, service_name: service?.name || data.service_name, issue: service?.issue_key, estimated_price: estimatedPrice };
      const res = await api.recoveryCreateCase(payload);
      setSubmitted(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast.error('Submission failed', { description: e.message }); }
    finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-10">
        <SuccessScreen caseId={submitted.id} hero={cfg.hero} />
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <div className="eh-kicker mb-2">{cfg.hero?.kicker || '// ACCOUNT RECOVERY · LIVE OPS'}</div>
        <h1 className="eh-display text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.05] mb-3" data-testid="recovery-h1">{cfg.hero?.title || 'Submit Your Case To Our Recovery Desk'}</h1>
        <p className="text-sm sm:text-base opacity-80 max-w-3xl leading-7">{cfg.hero?.subtitle || 'Hacked, disabled, locked out, or chasing a dormant username — our team reviews every case within 24 hours and gives you an exact quote before any payment.'}</p>
      </div>

      <TrustBar trust={cfg.trust} stats={stats} />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="eh-panel p-5 sm:p-7">
          <Stepper active={step} />

          {step === 'service' && <StepService services={cfg.services} value={data.service_id} onChange={(id) => patch({ service_id: id })} />}
          {step === 'details' && <StepDetails platforms={cfg.platforms} value={data} onPatch={patch} onUploadProof={uploadProof} uploadBusy={uploadBusy} />}
          {step === 'contact' && <StepContact value={data} onPatch={patch} hero={cfg.hero} />}

          <div className="flex items-center justify-between gap-3 mt-7 pt-5 border-t border-[var(--eh-border)]">
            {STEPS.indexOf(step) > 0 ? (
              <button onClick={back} className="eh-mono text-xs px-4 py-2.5 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] flex items-center gap-1.5" data-testid="recovery-back-btn"><ChevronLeft size={14} /> BACK</button>
            ) : <span />}
            {step !== 'contact' ? (
              <button onClick={next} className="eh-btn-primary text-xs flex items-center gap-1.5" data-testid="recovery-next-btn">NEXT <ChevronRight size={14} /></button>
            ) : (
              <button onClick={submit} disabled={submitting} className="eh-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-60" data-testid="recovery-submit-btn">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send2 />} {submitting ? 'SUBMITTING…' : 'SUBMIT CASE'}
              </button>
            )}
          </div>
        </div>
        <div>
          <PriceCard service={service} urgency={data.urgency} currency={data.currency} />
          <div className="eh-panel p-4 mt-3">
            <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-2">// PRIVACY</div>
            <div className="eh-mono text-[11px] opacity-80 leading-5">All information is kept strictly confidential and used only for your case review. We never share data with third parties.</div>
          </div>
        </div>
      </div>

      <ReviewsSection reviews={reviews} services={cfg.services} />

      {/* FAQ-ish trust footer */}
      <div className="grid sm:grid-cols-3 gap-4 mt-12">
        {[
          { i: <AlertTriangle size={18} className="text-[var(--eh-green)]" />, t: 'No upfront payment', d: 'You pay only after we confirm we can take your case. No deposit, no setup fee.' },
          { i: <ShieldCheck size={18} className="text-[var(--eh-green)]" />, t: 'Zero-log policy', d: 'Your data and account credentials are wiped after the case is resolved.' },
          { i: <Clock size={18} className="text-[var(--eh-green)]" />, t: '24h response time', d: 'Every case gets a human review within 24 hours, including weekends.' },
        ].map((b, i) => (
          <div key={i} className="eh-panel p-5">
            <div className="mb-2">{b.i}</div>
            <div className="font-bold text-sm mb-1">{b.t}</div>
            <div className="eh-mono text-[11px] opacity-70 leading-5">{b.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const Send2 = () => <ArrowRight size={14} />;

export default RecoveryPage;
