import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Clock, BadgeCheck, ChevronRight, ChevronLeft, Loader2, CheckCircle2, AlertTriangle, Send as TgIcon, Phone, Upload, X, Star, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import RecoveryServiceTile from '../components/RecoveryServiceTile';
import RecoveryWizardHeader from '../components/RecoveryWizardHeader';
import PublicReviewForm from '../components/PublicReviewForm';
import TestimonialsCarousel from '../components/TestimonialsCarousel';

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
      <div className="eh-panel p-5 lg:sticky lg:top-24">
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
    <div className="eh-panel p-5 lg:sticky lg:top-24" data-testid="recovery-price-card">
      <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-2">// PRICE ESTIMATE</div>
      <div className="eh-display text-2xl sm:text-3xl font-black eh-neon mb-1 break-all">{sym}{fmt(min)} – {sym}{fmt(max)}</div>
      <div className="eh-mono text-[10px] opacity-50 mb-4">{currency}</div>
      <div className="space-y-2.5 eh-mono text-xs">
        <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[var(--eh-green)] shrink-0" /> <span className="break-words">Highest Priority Processing</span></div>
        <div className="flex items-center gap-2"><Lock size={14} className="text-[var(--eh-green)] shrink-0" /> <span className="break-words">Secure Transfer Protocol</span></div>
        <div className="flex items-center gap-2"><Clock size={14} className="text-[var(--eh-green)] shrink-0" /> <span className="break-words">ETA: {service.eta_min_days}–{service.eta_max_days} days</span></div>
        <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-[var(--eh-green)] shrink-0" /> <span className="break-words">Payment On Delivery</span></div>
        <div className="flex items-center gap-2 opacity-80"><BadgeCheck size={14} className="text-[#4de0ff] shrink-0" /> <span className="break-words">Success rate: {service.success_rate}%</span></div>
      </div>
    </div>
  );
};

const Stepper = ({ active }) => {
  const labels = ['Service', 'Details', 'Contact'];
  const fullLabels = ['Pick Service', 'Case Details', 'Contact Info'];
  const idx = STEPS.indexOf(active);
  return (
    <>
      {/* Compact mobile progress bar — visible only < sm */}
      <div className="sm:hidden mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="eh-mono text-[10px] tracking-widest text-[var(--eh-green)]">STEP {idx + 1} of {labels.length}</div>
          <div className="eh-mono text-[10px] opacity-60">{fullLabels[idx]}</div>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--eh-border)] overflow-hidden">
          <div className="h-full bg-[var(--eh-green)] transition-all duration-500" style={{ width: `${((idx + 1) / labels.length) * 100}%`, boxShadow: '0 0 8px rgba(0,255,157,.6)' }} />
        </div>
      </div>
      {/* Desktop pill stepper */}
      <div className="hidden sm:flex items-center gap-2 mb-6 -mx-1 px-1 overflow-x-auto eh-no-scrollbar">
        {fullLabels.map((l, i) => {
          const isActive = i === idx;
          const isDone = i < idx;
          return (
            <React.Fragment key={l}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded eh-mono text-[11px] tracking-widest uppercase shrink-0 whitespace-nowrap ${isActive ? 'bg-[rgba(0,255,157,.12)] text-[var(--eh-green)] border border-[var(--eh-green)]' : isDone ? 'opacity-90' : 'opacity-50'}`}>
                <span className={`w-5 h-5 grid place-items-center rounded-full text-[10px] font-bold shrink-0 ${isActive || isDone ? 'bg-[var(--eh-green)] text-[#001a10]' : 'border border-[var(--eh-border)]'}`}>{isDone ? '✓' : i + 1}</span>
                <span>{l}</span>
              </div>
              {i < fullLabels.length - 1 && <ChevronRight size={12} className="opacity-40 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>
    </>
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

const StepService = ({ services, value, onChange, onNext }) => (
  <div className="space-y-2.5">
    <div className="eh-kicker mb-1">// SELECT THE ISSUE</div>
    <div className="grid sm:grid-cols-2 gap-3 sm:gap-3">
      {services.filter(s => s.active !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(s => (
        <RecoveryServiceTile key={s.id} service={s} selected={value === s.id} onClick={() => onChange(s.id)} onNext={onNext} />
      ))}
    </div>
  </div>
);

// Maps each service's issue_key → list of platform keys that make sense for it.
// 'ALL' means show every platform (used for cross-platform services).
const SERVICE_PLATFORM_MAP = {
  // Single-platform services
  gmail:        ['gmail'],
  whatsapp:     ['whatsapp'],
  telegram:     ['telegram'],
  discord:      ['discord'],
  tiktok:       ['tiktok'],
  twitter:      ['twitter'],
  snapchat:     ['snapchat'],
  linkedin:     ['linkedin'],
  // Multi-platform clusters
  gaming:       ['steam', 'psn', 'xbox', 'other'],
  // Universal services
  disabled:     'ALL',
  hacked:       'ALL',
  '2fa':        'ALL',
  simswap:      'ALL',
  privacy:      'ALL',
  password:     'ALL',
  username:     ['instagram', 'twitter', 'tiktok', 'youtube', 'snapchat', 'telegram', 'discord', 'gmail', 'other'],
  verification: ['instagram', 'twitter', 'tiktok', 'youtube', 'facebook', 'linkedin'],
};

// Per-service placeholders so the form *talks* like a specialist for that case.
const SERVICE_HINTS = {
  gmail:    { url: 'yourname@gmail.com', story: "My Gmail was disabled on May 14 — I still have my recovery phone and the original sign-up date." },
  whatsapp: { url: '+91 9876543210', story: "My WhatsApp number got banned after a group I joined was flagged. I never violated terms." },
  telegram: { url: '@yourhandle or +91 9876543210', story: "My Telegram says 'this account is restricted' since last week. I have my SIM and cloud password." },
  discord:  { url: 'username#0000 or yourhandle', story: "My Discord was terminated. I own a server with 5K members — please help recover." },
  tiktok:   { url: '@yourhandle', story: "My TikTok account was permanently banned. 18K followers, 0 violations, IDs ready." },
  twitter:  { url: '@yourhandle', story: "My X account was suspended. I have email access and 2FA backup codes." },
  snapchat: { url: '@yourhandle', story: "My Snapchat is locked permanently. I have streaks to save and ID ready." },
  linkedin: { url: 'linkedin.com/in/yourname', story: "My LinkedIn was restricted unfairly. I have a premium subscription and want connections preserved." },
  gaming:   { url: 'Steam ID, PSN ID, or Riot username', story: "My account was banned for cheating but I never installed any cheat. ~₹X spent on skins/games." },
  simswap:  { url: '+91 9876543210', story: "My SIM was hijacked on May 14. All linked accounts (bank, social) are at risk. Carrier is X." },
  privacy:  { url: 'yourname.com or yourname@email.com', story: "My personal info / leaked photos / old criminal records are showing on Google — I want them removed." },
  username: { url: '@desiredhandle  or  the dormant handle URL', story: "Username @target_handle on Instagram is dormant for 5 years. I want to claim it legitimately." },
  verification: { url: '@yourhandle  or  profile URL', story: "I want a blue tick on Instagram. I have notable press mentions, business KYC, and matching ID." },
  password: { url: '@yourhandle or email', story: "Lost password to my account. No recovery email/phone access — last logged in March 2024." },
  disabled: { url: 'instagram.com/yourhandle  or  @yourhandle', story: "My Instagram was disabled on May 14 after a flag for impersonation. I have my ID card and original email." },
  hacked:   { url: 'instagram.com/yourhandle', story: "My Instagram was hacked on May 14 — attacker changed email & phone. I have my login proofs ready." },
  '2fa':    { url: '@yourhandle or email', story: "I lost access to my 2FA device. Backup codes also lost. Have ID + linked phone history." },
};

const StepDetails = ({ platforms, value, onPatch, onUploadProof, uploadBusy, serviceKey }) => {
  const map = SERVICE_PLATFORM_MAP[serviceKey];
  const visiblePlatforms = !serviceKey || map === 'ALL' || !map
    ? platforms
    : platforms.filter(p => map.includes(p.key));
  const hints = SERVICE_HINTS[serviceKey] || SERVICE_HINTS.disabled;
  const lockedPlatform = visiblePlatforms.length === 1 ? visiblePlatforms[0] : null;
  return (
  <div className="space-y-4">
    <div className="eh-kicker mb-1">// CASE INFORMATION</div>
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <div className="eh-mono text-xs opacity-70 mb-1.5 flex items-center gap-1.5">PLATFORM {lockedPlatform && <span className="text-[var(--eh-green)] text-[10px]">· auto-set</span>}</div>
        {lockedPlatform ? (
          <div className="eh-input flex items-center justify-between" data-testid="recovery-platform-locked">
            <span>{lockedPlatform.label}</span>
            <span className="eh-mono text-[10px] opacity-50">LOCKED</span>
          </div>
        ) : (
          <select className="eh-input" data-testid="recovery-platform" value={value.platform || ''} onChange={e => onPatch({ platform: e.target.value })}>
            <option value="">Select platform…</option>
            {visiblePlatforms.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        )}
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
        <input className="eh-input" data-testid="recovery-account" placeholder={hints.url} value={value.account_url || ''} onChange={e => onPatch({ account_url: e.target.value })} />
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
        <textarea rows={5} className="eh-textarea" data-testid="recovery-desc" value={value.description || ''} onChange={e => onPatch({ description: e.target.value })} placeholder={hints.story} />
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
};

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

const SuccessScreen = ({ caseId, hero }) => {
  const nav = useNavigate();
  // Auto-redirect to tracker after 4s so the customer always knows where to check status next time
  useEffect(() => {
    const t = setTimeout(() => nav(`/track?id=${caseId}`), 4000);
    return () => clearTimeout(t);
  }, [caseId, nav]);
  return (
  <div className="eh-panel p-6 sm:p-8 text-center" data-testid="recovery-success">
    <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-4 bg-[rgba(0,255,157,.12)]">
      <CheckCircle2 size={32} className="text-[var(--eh-green)]" />
    </div>
    <div className="eh-kicker mb-2 justify-center">// CASE SUBMITTED</div>
    <h3 className="eh-display text-2xl font-black mb-2">Your Case Will Be Reviewed Within 24h</h3>
    <div className="eh-mono text-xs opacity-70 mb-1">Case ID</div>
    <div className="eh-neon eh-mono font-bold text-lg mb-5 break-all" data-testid="recovery-case-id">{caseId}</div>
    <div className="eh-panel p-3 mb-6 bg-[rgba(0,255,157,.06)] border border-[rgba(0,255,157,.25)] flex items-center justify-center gap-2 eh-mono text-[11px]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--eh-green)] animate-pulse" /> // REDIRECTING TO LIVE TRACKER IN 4s
    </div>
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
    <div className="flex flex-col sm:flex-row gap-2 justify-center">
      <Link to={`/track?id=${caseId}`} className="eh-btn-primary inline-flex items-center justify-center gap-2" data-testid="recovery-go-track"><ArrowRight size={14} /> TRACK MY CASE NOW</Link>
      {hero?.telegram_url && (
        <a href={hero.telegram_url} target="_blank" rel="noreferrer" className="eh-mono text-xs px-4 py-2.5 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] inline-flex items-center justify-center gap-2" data-testid="recovery-success-tg">
          <TgIcon size={14} /> CONTINUE ON TELEGRAM
        </a>
      )}
    </div>
    <div className="mt-6 eh-mono text-[11px] opacity-50">// Bookmark your case URL — you can revisit anytime</div>
  </div>
  );
};

const ReviewMedia = ({ items = [] }) => {
  if (!items.length) return null;
  return (
    <div className={`grid gap-1.5 mb-3 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {items.slice(0, 4).map((m, i) => (
        <div key={i} className="block aspect-square rounded overflow-hidden border border-[var(--eh-border)] bg-black/40 relative group eh-protected-media" onContextMenu={(e) => e.preventDefault()}>
          {m.kind === 'video' ? (
            <video src={m.url} muted playsInline preload="metadata" controlsList="nodownload" disablePictureInPicture className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
          ) : (
            <img src={m.url} alt="" className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
          )}
          {/* anti-copy diagonal watermark overlay */}
          <div className="eh-watermark-overlay" aria-hidden="true">
            <span>ERRORHACKER · ERRORHACKER.SITE · VERIFIED · </span>
            <span>ERRORHACKER · ERRORHACKER.SITE · VERIFIED · </span>
            <span>ERRORHACKER · ERRORHACKER.SITE · VERIFIED · </span>
            <span>ERRORHACKER · ERRORHACKER.SITE · VERIFIED · </span>
          </div>
          {m.kind === 'video' && (
            <div className="absolute inset-0 grid place-items-center bg-black/30 group-hover:bg-black/10 transition-colors pointer-events-none">
              <div className="w-9 h-9 rounded-full bg-black/60 grid place-items-center"><div className="w-0 h-0 ml-0.5" style={{ borderLeft: '8px solid var(--eh-green)', borderTop: '6px solid transparent', borderBottom: '6px solid transparent' }} /></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const ReviewsSection = ({ reviews, services }) => {
  return (
    <section className="mt-12" data-testid="recovery-reviews-section">
      <TestimonialsCarousel reviews={reviews} />
      {reviews.length === 0 && (
        <div className="eh-panel p-8 text-center" data-testid="recovery-no-reviews">
          <Star size={28} className="mx-auto mb-2 text-[var(--eh-green)]" />
          <div className="font-bold text-base mb-1" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>No reviews yet — be the first!</div>
          <div className="eh-mono text-[11px] opacity-70">Share your experience to help others choose with confidence.</div>
        </div>
      )}
      <PublicReviewForm services={services} />
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

  // When the chosen service changes, auto-reconcile the picked platform.
  // - If the service only supports one platform → lock & set it automatically.
  // - If the user already picked one that is no longer valid → clear it so they re-pick.
  useEffect(() => {
    if (!service) return;
    const map = SERVICE_PLATFORM_MAP[service.issue_key];
    if (!map || map === 'ALL') return;
    const valid = cfg.platforms.filter(p => map.includes(p.key));
    if (valid.length === 1) {
      setData(d => (d.platform === valid[0].key ? d : { ...d, platform: valid[0].key }));
    } else if (data.platform && !map.includes(data.platform)) {
      setData(d => ({ ...d, platform: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.issue_key, cfg.platforms]);

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
      const { absoluteUrl } = await api.recoveryUploadProof(file);
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
    <section className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-12">
      <RecoveryWizardHeader step={step} teamOnline />

      <div id="case-form" className="grid lg:grid-cols-[1fr_320px] gap-3 sm:gap-6">
        <div className="eh-panel p-3 sm:p-7 min-w-0 overflow-hidden">
          <Stepper active={step} />

          {step === 'service' && <StepService services={cfg.services} value={data.service_id} onChange={(id) => patch({ service_id: id })} onNext={next} />}
          {step === 'details' && <StepDetails platforms={cfg.platforms} value={data} onPatch={patch} onUploadProof={uploadProof} uploadBusy={uploadBusy} serviceKey={service?.issue_key} />}
          {step === 'contact' && <StepContact value={data} onPatch={patch} hero={cfg.hero} />}

          <div className="flex items-center justify-between gap-2 mt-6 pt-4 sm:pt-5 border-t border-[var(--eh-border)]">
            {STEPS.indexOf(step) > 0 ? (
              <button onClick={back} className="eh-mono text-xs px-3 sm:px-4 py-2.5 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] flex items-center gap-1.5" data-testid="recovery-back-btn"><ChevronLeft size={14} /> BACK</button>
            ) : <span />}
            {step !== 'contact' ? (
              <button onClick={next} className="eh-btn-primary text-xs flex items-center gap-1.5 px-4 sm:px-5 py-2.5" data-testid="recovery-next-btn">NEXT <ChevronRight size={14} /></button>
            ) : (
              <button onClick={submit} disabled={submitting} className="eh-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-60 px-4 sm:px-5 py-2.5" data-testid="recovery-submit-btn">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send2 />} {submitting ? 'SUBMITTING…' : 'SUBMIT CASE'}
              </button>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <PriceCard service={service} urgency={data.urgency} currency={data.currency} />
          <div className="eh-panel p-3 sm:p-4 mt-3 hidden sm:block">
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
