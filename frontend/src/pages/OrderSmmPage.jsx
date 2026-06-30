import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search, ArrowRight, Bot, Zap, Loader2, Sparkles, RefreshCcw,
  Instagram, Youtube, Music2, Facebook, Twitter, Send, Globe2,
  Check, X, Tag, ChevronUp, Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import RelatedServicesStrip from '../components/RelatedServicesStrip';

/**
 * Public customer-facing SMM catalog → place-order form.
 * Mounted at /smm — login is required, payment is wallet-only.
 *
 * Flow (Iter-28 · wallet-only):
 *   1. Pick a platform chip (Instagram / YouTube / TikTok / …)
 *   2. Search + scroll the live catalog (priced in INR with admin markup)
 *   3. Pick a service card → inline link + qty inputs + live ₹ Charge
 *   4. Live quote: base charge − Operative Pass discount = wallet debit amount
 *   5. PAY FROM WALLET → atomic debit + immediate Peakerr placement,
 *      redirect to /track?id=ORD-XXX (no Cashfree round-trip).
 *
 *   If wallet is short, the CTA flips to "TOP UP ₹X → instant" pointing at
 *   /me/wallet. No order is created until wallet has enough money.
 */

const PAGE_SIZE = 24;

const PLATFORM_META = {
  instagram: { color: '#ff6b9d', icon: Instagram, label: 'Instagram' },
  youtube:   { color: '#ff3148', icon: Youtube,   label: 'YouTube'   },
  tiktok:    { color: '#4de0ff', icon: Music2,    label: 'TikTok'    },
  facebook:  { color: '#3b82f6', icon: Facebook,  label: 'Facebook'  },
  twitter:   { color: '#22d3ee', icon: Twitter,   label: 'Twitter/X' },
  x:         { color: '#c0c0c0', icon: Twitter,   label: 'X'         },
  telegram:  { color: '#22d3ee', icon: Send,      label: 'Telegram'  },
  spotify:   { color: '#1db954', icon: Music2,    label: 'Spotify'   },
  other:     { color: '#c084fc', icon: Globe2,    label: 'Other'     },
};
const FEATURED_ORDER = ['instagram', 'youtube', 'tiktok', 'telegram', 'twitter', 'x', 'facebook', 'spotify'];

const formatINR = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatLargeNum = (n) => Number(n || 0).toLocaleString('en-IN');

const PlatformChip = ({ slug, count, active, onClick }) => {
  const isAll = !slug;
  const meta = isAll
    ? { color: '#00ff9d', icon: Sparkles, label: 'All' }
    : (PLATFORM_META[slug] || PLATFORM_META.other);
  const Icon = meta.icon;
  return (
    <button
      data-testid={`smm-platform-chip-${slug || 'all'}`}
      onClick={onClick}
      className="group relative flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all shrink-0"
      style={{
        borderColor: active ? meta.color : 'var(--eh-border)',
        background: active ? `${meta.color}18` : 'transparent',
        color: active ? meta.color : 'var(--eh-text)',
      }}
    >
      <Icon size={14} />
      <span className="eh-mono text-[11px] tracking-wider uppercase font-bold">{meta.label}</span>
      <span className="eh-mono text-[10px] opacity-60">{count}</span>
    </button>
  );
};

const ServiceCard = ({ row, selected, onSelect }) => {
  const meta = PLATFORM_META[row.platform] || PLATFORM_META.other;
  const Icon = meta.icon;
  return (
    <button
      data-testid={`smm-service-card-${row.id}`}
      onClick={() => onSelect(row)}
      className="text-left w-full min-w-0 group relative overflow-hidden rounded-xl border transition-all p-4"
      style={{
        borderColor: selected ? meta.color : 'var(--eh-border)',
        background: selected ? `linear-gradient(135deg, ${meta.color}14, transparent 60%)` : 'rgba(255,255,255,0.015)',
        boxShadow: selected ? `0 0 0 1px ${meta.color}55, 0 14px 38px -22px ${meta.color}aa` : 'none',
      }}
    >
      <span aria-hidden className="absolute top-0 left-0 right-0 h-[2px] opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg grid place-items-center shrink-0"
          style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}55`, color: meta.color }}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] sm:text-sm font-semibold leading-snug line-clamp-2" style={{ fontFamily: 'Inter,sans-serif' }}>
            {row.name}
          </div>
          <div className="eh-mono text-[10px] opacity-50 mt-1 truncate">{row.category}</div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {row.refill && <span className="eh-mono text-[9px] tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${meta.color}1a`, color: meta.color }}>REFILL</span>}
            {row.dripfeed && <span className="eh-mono text-[9px] tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#ffd34d1a', color: '#ffd34d' }}>DRIP</span>}
            {row.cancel && <span className="eh-mono text-[9px] tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#4de0ff1a', color: '#4de0ff' }}>CANCEL</span>}
            <span className="eh-mono text-[9px] opacity-60">min {formatLargeNum(row.min)}</span>
            <span className="eh-mono text-[9px] opacity-50">·</span>
            <span className="eh-mono text-[9px] opacity-60">max {formatLargeNum(row.max)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="eh-display font-black text-base" style={{ color: meta.color }}>
            {formatINR(row.rate_inr_per_1000)}
          </div>
          <div className="eh-mono text-[9px] opacity-50">/ 1k</div>
          {selected ? (
            <div className="mt-2 eh-mono text-[9px] tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: `${meta.color}22`, color: meta.color }}>
              <Check size={9} /> SELECTED
            </div>
          ) : (
            <div className="mt-2 eh-mono text-[9px] tracking-wider opacity-50">CHOOSE →</div>
          )}
        </div>
      </div>
    </button>
  );
};

/**
 * Order form body — used in both the sticky right-side card (desktop)
 * AND inside the bottom-sheet modal (mobile).
 */
const OrderFormBody = ({ service, quantity, setQuantity, link, setLink, busy, onSubmit, onClear, inSheet = false, quote, loggedIn, onLogin, walletBalance, onTopUp }) => {
  const meta = PLATFORM_META[service.platform] || PLATFORM_META.other;
  const Icon = meta.icon;
  const charge = quote?.charge_inr ?? 0;
  const baseCharge = quote?.base_charge_inr ?? charge;
  const discountPct = quote?.discount_pct ?? 0;
  const discountAmt = quote?.discount_amount_inr ?? 0;
  const tierName = quote?.tier_name || 'Rookie';
  const walletShort = Math.max(0, charge - walletBalance);
  const canPay = loggedIn && walletShort <= 0 && link.trim() && quantity && charge > 0;

  return (
    <div className={`relative ${inSheet ? '' : 'eh-panel p-4 sm:p-5 overflow-hidden min-w-0 max-w-full'}`}
         style={!inSheet ? { borderColor: `${meta.color}55`, background: 'linear-gradient(180deg, rgba(255,255,255,.015), transparent)' } : {}}
         data-testid="smm-order-form">
      {!inSheet && <span aria-hidden className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />}

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}55`, color: meta.color }}>
            <Icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-0.5">// CONFIGURE_ORDER</div>
            <div className="font-semibold text-sm leading-snug" style={{ fontFamily: 'Inter,sans-serif' }}>{service.name}</div>
            <div className="eh-mono text-[10px] opacity-50 mt-0.5 truncate">{service.category}</div>
          </div>
        </div>
        {!inSheet && (
          <button onClick={onClear} className="opacity-60 hover:opacity-100 shrink-0" data-testid="smm-clear-service">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">TARGET LINK / USERNAME</label>
          <input
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder={`> https://${service.platform === 'instagram' ? 'instagram.com/yourhandle' : service.platform === 'youtube' ? 'youtube.com/watch?v=...' : service.platform + '.com/...'}`}
            className="eh-input text-sm w-full"
            data-testid="smm-link-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">
              QUANTITY · {formatLargeNum(service.min)} – {formatLargeNum(service.max)}
            </label>
            <input
              type="number"
              min={service.min}
              max={service.max}
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="eh-input text-sm w-full"
              data-testid="smm-quantity-input"
            />
          </div>
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">LIVE CHARGE</label>
            <div
              className="h-[42px] flex items-center justify-end px-3 rounded-md border eh-display font-black text-lg"
              style={{ borderColor: `${meta.color}55`, background: `${meta.color}0d`, color: meta.color }}
              data-testid="smm-charge-display"
            >
              {formatINR(charge)}
            </div>
          </div>
        </div>

        {/* Quote breakdown — base · tier discount · payable */}
        {loggedIn && charge > 0 && (
          <div className="rounded-md border border-[var(--eh-border)] p-3 space-y-1.5" data-testid="smm-quote-breakdown">
            <div className="flex items-center justify-between text-[11px]" style={{ fontFamily: 'Inter,sans-serif' }}>
              <span className="opacity-70">Base charge</span>
              <span className="eh-mono">{formatINR(baseCharge)}</span>
            </div>
            {discountPct > 0 && (
              <div className="flex items-center justify-between text-[11px]" style={{ color: '#00ff9d' }}>
                <span className="opacity-90">Operative Pass · {tierName} (−{discountPct}%)</span>
                <span className="eh-mono">−{formatINR(discountAmt)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[12px] font-bold border-t border-[var(--eh-border)] pt-1.5 mt-1">
              <span>Payable from wallet</span>
              <span className="eh-mono" style={{ color: meta.color }}>{formatINR(charge)}</span>
            </div>
          </div>
        )}

        {/* Wallet pay panel — primary action area */}
        {!loggedIn ? (
          <div className="rounded-md border border-[rgba(255,211,77,.5)] p-3.5 bg-[rgba(255,211,77,.05)]" data-testid="smm-login-gate">
            <div className="text-[12.5px] font-semibold mb-1.5" style={{ fontFamily: 'Inter,sans-serif' }}>
              Sign in to pay from your wallet
            </div>
            <div className="text-[11px] opacity-75 leading-relaxed mb-3" style={{ fontFamily: 'Inter,sans-serif' }}>
              SMM orders are wallet-only. One sign-in, top up once, then every future order is a single tap.
            </div>
            <button
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-2 py-3 font-bold text-sm tracking-wider rounded-md"
              style={{ background: '#ffd34d', color: '#000' }}
              data-testid="smm-login-cta"
            >
              <Wallet size={14} /> SIGN IN TO ORDER <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-[11px] eh-mono">
              <span className="opacity-65 inline-flex items-center gap-1.5"><Wallet size={11} className="text-[var(--eh-green)]" /> WALLET BALANCE</span>
              <span className={walletShort > 0 ? 'text-[#ffd34d] font-bold' : 'eh-neon font-bold'} data-testid="smm-wallet-balance">{formatINR(walletBalance)}</span>
            </div>

            {walletShort > 0 ? (
              <>
                <div className="rounded-md border border-[rgba(255,49,72,.45)] bg-[rgba(255,49,72,.05)] p-3 text-[11px] leading-relaxed" data-testid="smm-wallet-short">
                  <b className="text-[#ff7a3d]">Wallet short by {formatINR(walletShort)}.</b><span className="opacity-80"> Add money now — your order will sit ready for one tap when you come back.</span>
                </div>
                <button
                  onClick={onTopUp}
                  className="w-full flex items-center justify-center gap-2 py-3.5 font-bold text-sm tracking-wider rounded-md transition-all"
                  style={{ background: '#ffd34d', color: '#000' }}
                  data-testid="smm-topup-cta"
                >
                  <Wallet size={14} /> TOP UP {formatINR(walletShort)} → INSTANT <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={onSubmit}
                disabled={busy || !canPay}
                className="w-full flex items-center justify-center gap-2 py-3.5 font-bold text-sm tracking-wider rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: meta.color, color: '#000' }}
                data-testid="smm-submit-btn"
              >
                {busy ? (
                  <><Loader2 size={16} className="animate-spin" /> PLACING ORDER…</>
                ) : (
                  <><Zap size={14} /> PAY {formatINR(charge)} FROM WALLET · INSTANT <ArrowRight size={16} /></>
                )}
              </button>
            )}
          </>
        )}

        <div className="text-center eh-mono text-[10px] opacity-60 pt-1 leading-relaxed">
          Wallet debits instantly · Peakerr places your order within seconds · live tracker updates by itself.
        </div>
      </div>
    </div>
  );
};

/** Mobile bottom-sheet modal wrapper */
const BottomSheet = ({ open, onClose, children }) => {
  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] lg:hidden" data-testid="smm-bottom-sheet">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in"
        style={{ animation: 'eh-fade-in .25s ease-out' }}
      />
      {/* Sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-2xl border-t-2 eh-panel"
        style={{
          borderColor: 'var(--eh-green)',
          background: 'var(--eh-panel)',
          boxShadow: '0 -24px 60px -10px rgba(0,255,157,0.25)',
          animation: 'eh-slide-up .28s cubic-bezier(.2,.9,.3,1)',
        }}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 pt-2 pb-1 flex flex-col items-center bg-[var(--eh-panel)] border-b border-[var(--eh-border)]">
          <div className="w-12 h-1.5 rounded-full bg-white/20 mb-2" />
          <button
            onClick={onClose}
            className="absolute right-3 top-2 opacity-70 hover:opacity-100 p-1"
            data-testid="smm-sheet-close"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 pb-8">{children}</div>
      </div>
    </div>
  );
};

const OrderSmmPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalog, setCatalog] = useState({ rows: [], platforms: [], platform_counts: {}, markup_percent: 0, min_order_inr: 0, error: null });
  const [platform, setPlatform] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showTopBtn, setShowTopBtn] = useState(false);
  // Wallet-only flow state: live quote from /api/public/smm/quote
  const [quote, setQuote] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const filterBarRef = useRef(null);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await api.smmCatalog({ refresh: refresh ? 1 : 0 });
      setCatalog(data);
    } catch (e) {
      toast.error(e.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial catalog load + react to wallet changes (e.g. user just topped up
  // in another tab) so the wallet balance pill stays accurate.
  useEffect(() => { load(false); }, []);
  useEffect(() => {
    const refreshWallet = () => {
      if (!user) { setWalletBalance(0); return; }
      api.walletGet().then(w => setWalletBalance(w?.balance ?? 0)).catch(() => {});
    };
    refreshWallet();
    window.addEventListener('eh:wallet-changed', refreshWallet);
    return () => window.removeEventListener('eh:wallet-changed', refreshWallet);
  }, [user]);

  // Live quote — re-fetch whenever the user changes service or quantity. Debounced
  // 300ms so we don't spam the backend on every keystroke.
  useEffect(() => {
    if (!selected) { setQuote(null); return; }
    const qty = parseInt(quantity || '0', 10) || 0;
    if (qty < (selected.min || 0)) { setQuote(null); return; }
    const t = setTimeout(async () => {
      try {
        const out = await api.smmPublicQuote({
          smm_service_id: selected.id,
          quantity: qty,
          link: link || 'placeholder',
        });
        setQuote(out);
        if (out.wallet_balance_inr != null) setWalletBalance(out.wallet_balance_inr);
      } catch { /* ignore — let the user keep typing */ }
    }, 300);
    return () => clearTimeout(t);
  }, [selected, quantity, link, user]);

  // Reset pagination whenever filters change
  useEffect(() => { setPageSize(PAGE_SIZE); }, [q, platform]);

  // Scroll → back-to-top FAB
  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const pl = platform.trim().toLowerCase();
    return (catalog.rows || []).filter(r => {
      if (pl && r.platform !== pl) return false;
      if (ql) {
        const blob = `${r.name} ${r.category} ${r.platform}`.toLowerCase();
        if (!blob.includes(ql)) return false;
      }
      return true;
    });
  }, [catalog, q, platform]);

  const visible = useMemo(() => filtered.slice(0, pageSize), [filtered, pageSize]);

  // Local fallback charge for the small "₹ Charge" pill before the server quote
  // round-trips. Once the quote returns, the form prefers quote.charge_inr.
  const localCharge = useMemo(() => {
    if (!selected) return 0;
    const qty = parseInt(quantity || '0', 10) || 0;
    if (qty <= 0) return 0;
    const raw = (Number(selected.rate_inr_per_1000) || 0) * qty / 1000;
    return Math.max(raw, Number(catalog.min_order_inr) || 0);
  }, [selected, quantity, catalog.min_order_inr]);

  const handleSelect = (row) => {
    setSelected(row);
    setQuantity(String(row.min || 100));
    setLink('');
    // On mobile, open the bottom-sheet (no awkward bottom-of-page scroll).
    // On desktop, the right-side sticky panel updates in place; scroll to it
    // only if it's currently out of view.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setSheetOpen(true);
    } else {
      setTimeout(() => {
        const anchor = document.getElementById('smm-form-anchor');
        if (anchor) {
          const rect = anchor.getBoundingClientRect();
          if (rect.top < 60 || rect.top > window.innerHeight - 200) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 60);
    }
  };

  const clearSelection = () => {
    setSelected(null);
    setLink('');
    setQuantity('');
    setSheetOpen(false);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    if (!user) { navigate('/login?next=' + encodeURIComponent('/smm')); return; }
    const qty = parseInt(quantity || '0', 10) || 0;
    if (qty < (selected.min || 0) || qty > (selected.max || 0)) {
      toast.error(`Quantity must be between ${formatLargeNum(selected.min)} and ${formatLargeNum(selected.max)}`);
      return;
    }
    if (!link.trim()) { toast.error('Target link / username is required'); return; }
    setBusy(true);
    try {
      const out = await api.smmPublicOrder({
        smm_service_id: selected.id,
        quantity: qty,
        link: link.trim(),
        notes: `Wallet-paid · ${selected.category}`,
      });
      toast.success(`Order placed · ${out.order.id} · ${formatINR(out.order.payment_amount || 0)} debited from wallet`);
      // Tell the rest of the app the wallet just moved so badges refresh.
      window.dispatchEvent(new CustomEvent('eh:wallet-changed'));
      navigate(out.redirect || `/track?id=${out.order.id}`);
    } catch (e) {
      // The 402 "wallet_insufficient" error carries structured detail with the
      // exact amount short — surface it as a top-up CTA instead of a raw toast.
      const detail = e.detail;
      if (detail && (detail.code === 'wallet_insufficient' || detail.needed_inr)) {
        toast.error(detail.message || 'Wallet too low — top up first');
        navigate('/me/wallet');
      } else if (e.status === 401 || /sign in/i.test(e.message || '')) {
        navigate('/login?next=' + encodeURIComponent('/smm'));
      } else {
        toast.error(e.message || 'Failed to create order');
      }
    } finally {
      setBusy(false);
    }
  };

  const platformList = useMemo(() => {
    const counts = catalog.platform_counts || {};
    const seen = new Set();
    const out = [];
    for (const p of FEATURED_ORDER) {
      if (counts[p]) { out.push([p, counts[p]]); seen.add(p); }
    }
    for (const [p, c] of Object.entries(counts)) {
      if (!seen.has(p)) out.push([p, c]);
    }
    return out;
  }, [catalog.platform_counts]);

  const selectedMeta = selected ? (PLATFORM_META[selected.platform] || PLATFORM_META.other) : null;

  return (
    <div className="min-h-screen px-3 sm:px-6 py-8 sm:py-12 max-w-7xl mx-auto overflow-x-hidden" data-testid="order-smm-page">
      {/* Hero — centered, premium tile-themed badge with red ERROR glow */}
      <div className="mb-8 sm:mb-10 relative text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-5 eh-error-badge"
          data-testid="smm-hero-badge"
        >
          <span className="eh-error-dot" />
          <span className="eh-mono text-[10px] sm:text-[11px] tracking-[0.35em] font-bold">
            <span className="eh-error-text">// ERROR</span>
            <span className="opacity-75">_SMM_PANEL</span>
          </span>
        </div>

        <h1 className="eh-display text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
          <span className="text-[var(--eh-text)]">Buy </span>
          <span className="eh-neon">SMM Services</span>
          <span className="text-[var(--eh-text)]"> instantly</span>
        </h1>

        <p
          className="mt-4 mx-auto text-sm sm:text-base opacity-75 max-w-2xl leading-relaxed"
          style={{ fontFamily: 'Inter,sans-serif' }}
        >
          Pick from <b className="text-[var(--eh-green)]">{formatLargeNum((catalog.rows || []).length)}+</b> live services across Instagram, YouTube, TikTok, Telegram and more — priced in <b className="text-[var(--eh-green)]">INR</b>, auto-placed the moment your payment clears.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2 items-center">
          <span className="eh-mono text-[10px] px-2.5 py-1 rounded border border-[var(--eh-border)] inline-flex items-center gap-1.5"><Zap size={11} className="text-[var(--eh-green)]" /> Auto-placement</span>
          <span className="eh-mono text-[10px] px-2.5 py-1 rounded border border-[var(--eh-border)] inline-flex items-center gap-1.5"><Bot size={11} className="text-[#4de0ff]" /> 24×7 fulfillment</span>
          <span className="eh-mono text-[10px] px-2.5 py-1 rounded border border-[var(--eh-border)] inline-flex items-center gap-1.5"><Sparkles size={11} className="text-[#ffd34d]" /> Refill guarantee on supported services</span>
        </div>
      </div>

      {catalog.error && (
        <div className="eh-panel p-3 mb-4 border-[#ff3148] text-sm">
          <b className="text-[#ff3148]">Catalog unavailable:</b> <span className="opacity-80">{catalog.error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_420px] gap-5 sm:gap-6 min-w-0">
        {/* LEFT: catalog browse */}
        <div className="min-w-0">
          {/* Sticky compact filter bar — stays pinned as the user scrolls the catalog */}
          <div
            ref={filterBarRef}
            className="eh-panel p-3 sm:p-4 mb-4 sticky top-3 z-30 backdrop-blur"
            style={{ background: 'color-mix(in srgb, var(--eh-panel) 92%, transparent)' }}
            data-testid="smm-filter-bar"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="> search 5000+ services — instagram followers, youtube views, tiktok likes…"
                  className="eh-input text-sm w-full pl-9"
                  data-testid="smm-search-input"
                />
                {q && (
                  <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100" data-testid="smm-search-clear">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="eh-btn-ghost text-xs inline-flex items-center gap-1.5 shrink-0"
                data-testid="smm-refresh-btn"
                title="Force-refresh from panel"
              >
                {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                <span className="hidden sm:inline">REFRESH</span>
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              <PlatformChip slug="" count={catalog.rows?.length || 0} active={!platform} onClick={() => setPlatform('')} />
              {platformList.map(([p, c]) => (
                <PlatformChip key={p} slug={p} count={c} active={platform === p} onClick={() => setPlatform(p)} />
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 size={28} className="animate-spin inline-block opacity-70" />
              <div className="eh-mono text-[11px] opacity-60 mt-3">Loading live catalog…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="eh-panel p-8 text-center">
              <div className="eh-mono text-[11px] opacity-60 mb-2">// NO_MATCH</div>
              <div className="text-sm">No services match your search.</div>
              <div className="text-xs opacity-60 mt-1">Try a different platform or shorter keyword.</div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="eh-mono text-[10px] opacity-60 tracking-widest">
                  // showing {visible.length} of {filtered.length}
                </div>
                <div className="eh-mono text-[10px] opacity-50 hidden sm:flex items-center gap-1.5">
                  <Tag size={10} /> markup {catalog.markup_percent}% · min {formatINR(catalog.min_order_inr)}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                {visible.map(r => (
                  <ServiceCard key={r.id} row={r} selected={selected?.id === r.id} onSelect={handleSelect} />
                ))}
              </div>

              {/* Load more */}
              {visible.length < filtered.length && (
                <button
                  onClick={() => setPageSize(p => p + PAGE_SIZE)}
                  className="mt-4 w-full eh-btn-ghost py-3 text-xs tracking-widest flex items-center justify-center gap-2"
                  data-testid="smm-load-more"
                >
                  <ArrowRight size={12} className="rotate-90" />
                  LOAD {Math.min(PAGE_SIZE, filtered.length - visible.length)} MORE · {filtered.length - visible.length} remaining
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: desktop-only sticky order panel */}
        <div className="hidden lg:block lg:sticky lg:top-20 self-start">
          <div id="smm-form-anchor" />
          {!selected ? (
            <div className="eh-panel p-5 text-center" data-testid="smm-empty-form">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full grid place-items-center" style={{ background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)' }}>
                <Bot size={24} className="text-[var(--eh-green)]" />
              </div>
              <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1">// AWAITING_SELECTION</div>
              <div className="text-sm font-semibold" style={{ fontFamily: 'Inter,sans-serif' }}>Pick a service from the catalog</div>
              <div className="text-xs opacity-60 mt-1.5 leading-relaxed">
                Browse by platform, search by keyword, then click any card to configure and pay instantly.
              </div>
            </div>
          ) : (
            <OrderFormBody
              service={selected}
              quantity={quantity}
              setQuantity={setQuantity}
              link={link}
              setLink={setLink}
              busy={busy}
              onSubmit={handleSubmit}
              onClear={clearSelection}
              quote={quote || (selected ? { charge_inr: localCharge, base_charge_inr: localCharge, discount_pct: 0, discount_amount_inr: 0, tier_name: 'Rookie' } : null)}
              loggedIn={!!user}
              onLogin={() => navigate('/login?next=' + encodeURIComponent('/smm'))}
              walletBalance={walletBalance}
              onTopUp={() => navigate('/me/wallet')}
            />
          )}

          <div className="mt-3 eh-mono text-[10px] opacity-55 leading-relaxed px-1">
            INR rate locked at checkout · refunds available on undeliverable orders.
          </div>
        </div>
      </div>

      {/* Mobile bottom-sheet modal */}
      <BottomSheet open={sheetOpen && !!selected} onClose={() => setSheetOpen(false)}>
        {selected && (
          <OrderFormBody
            service={selected}
            quantity={quantity}
            setQuantity={setQuantity}
            link={link}
            setLink={setLink}
            busy={busy}
            onSubmit={handleSubmit}
            onClear={clearSelection}
            quote={quote || { charge_inr: localCharge, base_charge_inr: localCharge, discount_pct: 0, discount_amount_inr: 0, tier_name: 'Rookie' }}
            loggedIn={!!user}
            onLogin={() => navigate('/login?next=' + encodeURIComponent('/smm'))}
            walletBalance={walletBalance}
            onTopUp={() => navigate('/me/wallet')}
            inSheet
          />
        )}
      </BottomSheet>

      {/* Mobile floating mini-bar — appears when a service is selected but sheet is closed.
          Lets the user keep browsing yet always have one-tap access back to the order form. */}
      {selected && !sheetOpen && (
        <div
          className="lg:hidden fixed bottom-3 left-3 right-3 z-40 rounded-xl border shadow-2xl"
          style={{
            background: 'var(--eh-panel)',
            borderColor: selectedMeta?.color || 'var(--eh-green)',
            boxShadow: `0 16px 50px -10px ${selectedMeta?.color || '#00ff9d'}55`,
            animation: 'eh-slide-up .25s ease-out',
          }}
          data-testid="smm-mini-bar"
        >
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full flex items-center gap-3 p-3 text-left"
          >
            <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
                 style={{ background: `${selectedMeta?.color}1a`, border: `1px solid ${selectedMeta?.color}55`, color: selectedMeta?.color }}>
              <Check size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="eh-mono text-[9px] tracking-widest opacity-60">SELECTED · TAP TO PAY</div>
              <div className="text-[12px] font-semibold truncate" style={{ fontFamily: 'Inter,sans-serif' }}>{selected.name}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="eh-display font-black text-base" style={{ color: selectedMeta?.color }}>{formatINR(quote?.charge_inr ?? localCharge)}</div>
              <div className="eh-mono text-[9px] opacity-60">PROCEED →</div>
            </div>
          </button>
        </div>
      )}

      {/* Floating "Back to Top" FAB */}
      {showTopBtn && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 lg:bottom-6 right-3 lg:right-6 z-30 w-11 h-11 rounded-full grid place-items-center border-2 transition-all hover:scale-110"
          style={{
            background: 'var(--eh-panel)',
            borderColor: 'var(--eh-green)',
            color: 'var(--eh-green)',
            boxShadow: '0 8px 30px -6px rgba(0,255,157,0.45)',
          }}
          aria-label="Back to top"
          data-testid="smm-back-to-top"
        >
          <ChevronUp size={20} />
        </button>
      )}

      <RelatedServicesStrip />

      {/* Page-local keyframes (no CSS file edit needed). */}
      <style>{`
        @keyframes eh-slide-up { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes eh-fade-in  { from { opacity: 0; } to { opacity: 1; } }
        /* ERROR_SMM_PANEL badge — brand-pink glitch pulse */
        @keyframes eh-error-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,45,146,0.55), inset 0 0 12px rgba(255,45,146,0.08); }
          50%      { box-shadow: 0 0 0 6px rgba(255,45,146,0.0),  inset 0 0 18px rgba(255,45,146,0.18); }
        }
        @keyframes eh-error-flicker {
          0%, 92%, 100% { opacity: 1; }
          93%           { opacity: 0.35; }
          94%           { opacity: 1; }
          96%           { opacity: 0.6; }
          97%           { opacity: 1; }
        }
        @keyframes eh-error-dot-blink {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.35); opacity: 0.6; }
        }
        .eh-error-badge {
          border-color: rgba(255,45,146,0.55);
          background: linear-gradient(180deg, rgba(255,45,146,0.12), rgba(255,45,146,0.02));
          animation: eh-error-pulse 2.4s ease-in-out infinite;
          backdrop-filter: blur(8px);
        }
        .eh-error-dot {
          width: 7px; height: 7px; border-radius: 999px;
          background: #ff2d92;
          box-shadow: 0 0 10px #ff2d92, 0 0 22px rgba(255,45,146,0.6);
          animation: eh-error-dot-blink 1.1s ease-in-out infinite;
        }
        .eh-error-text {
          color: #ff2d92;
          text-shadow:
            0 0 8px rgba(255,45,146,0.85),
            0 0 18px rgba(255,45,146,0.35),
            1px 0 0 rgba(0,229,255,0.35),
            -1px 0 0 rgba(255,200,0,0.25);
          animation: eh-error-flicker 4.2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default OrderSmmPage;
