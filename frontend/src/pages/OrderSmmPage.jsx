import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search, ArrowRight, Bot, Zap, Loader2, Sparkles, RefreshCcw,
  Instagram, Youtube, Music2, Facebook, Twitter, Send, Globe2,
  Check, X, Tag,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Public customer-facing SMM catalog → place-order form.
 * Mounted at /smm — anyone can browse, but ordering requires email.
 *
 * Flow:
 *   1. Pick a platform chip (Instagram / YouTube / TikTok / …)
 *   2. Search + scroll the live catalog (priced in INR with admin markup)
 *   3. Pick a service card → inline link + qty inputs + live ₹ Charge
 *   4. PROCEED TO PAY → creates order + redirects to /track?id=&pay=1
 */

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

const OrderForm = ({ service, charge, quantity, setQuantity, link, setLink, contact, setContact, busy, onSubmit, onClear }) => {
  const meta = PLATFORM_META[service.platform] || PLATFORM_META.other;
  const Icon = meta.icon;
  return (
    <div
      data-testid="smm-order-form"
      className="eh-panel p-4 sm:p-5 relative overflow-hidden min-w-0 max-w-full"
      style={{ borderColor: `${meta.color}55`, background: 'linear-gradient(180deg, rgba(255,255,255,.015), transparent)' }}
    >
      <span aria-hidden className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />

      {/* Header */}
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
        <button onClick={onClear} className="opacity-60 hover:opacity-100 shrink-0" data-testid="smm-clear-service">
          <X size={16} />
        </button>
      </div>

      {/* Form grid */}
      <div className="space-y-3">
        <div>
          <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">
            TARGET LINK / USERNAME
          </label>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">YOUR EMAIL · for tracking</label>
            <input
              type="email"
              value={contact.email}
              onChange={e => setContact({ ...contact, email: e.target.value })}
              placeholder="> you@email.com"
              className="eh-input text-sm w-full"
              data-testid="smm-email-input"
            />
          </div>
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">TELEGRAM · optional</label>
            <input
              value={contact.tg}
              onChange={e => setContact({ ...contact, tg: e.target.value })}
              placeholder="> @yourhandle"
              className="eh-input text-sm w-full"
              data-testid="smm-telegram-input"
            />
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={busy || !link.trim() || !contact.email.trim() || !quantity || charge <= 0}
          className="w-full eh-btn-primary flex items-center justify-center gap-2 py-3.5 font-bold text-sm tracking-wider mt-1"
          data-testid="smm-submit-btn"
          style={{ background: meta.color, color: '#000', borderColor: meta.color }}
        >
          {busy ? (
            <><Loader2 size={16} className="animate-spin" /> CREATING ORDER...</>
          ) : (
            <>⚡ PAY {formatINR(charge)} · PROCEED <ArrowRight size={16} /></>
          )}
        </button>

        <div className="text-center eh-mono text-[10px] opacity-60 pt-1 leading-relaxed">
          Order locks in at this price. After payment, our SMM engine auto-places it on the panel in seconds — no manual wait.
        </div>
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
  const [contact, setContact] = useState({ email: '', tg: '' });
  const [busy, setBusy] = useState(false);

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

  useEffect(() => { load(false); }, []);
  useEffect(() => {
    if (user?.email && !contact.email) setContact(c => ({ ...c, email: user.email }));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered list (client-side filter on top of the cached catalog)
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
    }).slice(0, 200);
  }, [catalog, q, platform]);

  // Compute live INR charge for current selection
  const charge = useMemo(() => {
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
    // Smooth scroll to form on mobile
    setTimeout(() => {
      document.getElementById('smm-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const qty = parseInt(quantity || '0', 10) || 0;
    if (qty < (selected.min || 0) || qty > (selected.max || 0)) {
      toast.error(`Quantity must be between ${formatLargeNum(selected.min)} and ${formatLargeNum(selected.max)}`);
      return;
    }
    if (!link.trim()) { toast.error('Target link / username is required'); return; }
    if (!contact.email.trim()) { toast.error('Email is required for the tracking link'); return; }
    setBusy(true);
    try {
      const out = await api.smmPublicOrder({
        smm_service_id: selected.id,
        quantity: qty,
        link: link.trim(),
        email: contact.email.trim(),
        tg: contact.tg.trim(),
        name: user?.name || '',
        notes: `Auto-placed via /smm public form · ${selected.category}`,
      });
      toast.success(`Order created · ${out.order.id}`);
      navigate(out.redirect || `/track?id=${out.order.id}&pay=1`);
    } catch (e) {
      toast.error(e.message || 'Failed to create order');
    } finally {
      setBusy(false);
    }
  };

  // Build platform list in featured order, then any extras
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

  return (
    <div className="min-h-screen px-3 sm:px-6 py-8 sm:py-12 max-w-7xl mx-auto overflow-x-hidden" data-testid="order-smm-page">
      {/* Hero */}
      <div className="mb-6 sm:mb-8 relative">
        <div className="eh-mono text-[10px] sm:text-[11px] tracking-[0.3em] opacity-60 mb-2">// SMM_AUTO_PANEL</div>
        <h1 className="eh-display text-3xl sm:text-5xl font-black leading-tight">
          <span className="text-[var(--eh-text)]">Buy </span>
          <span className="eh-neon">SMM Services</span>
          <span className="text-[var(--eh-text)]"> instantly</span>
        </h1>
        <div className="mt-3 text-sm sm:text-base opacity-75 max-w-2xl" style={{ fontFamily: 'Inter,sans-serif' }}>
          Pick from {formatLargeNum((catalog.rows || []).length)}+ live services across Instagram, YouTube, TikTok, Telegram and more — priced in <b className="text-[var(--eh-green)]">INR</b>, auto-placed on our panel the moment your payment clears.
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="eh-mono text-[10px] px-2 py-1 rounded border border-[var(--eh-border)] inline-flex items-center gap-1.5"><Zap size={11} className="text-[var(--eh-green)]" /> Auto-placement</span>
          <span className="eh-mono text-[10px] px-2 py-1 rounded border border-[var(--eh-border)] inline-flex items-center gap-1.5"><Bot size={11} className="text-[#4de0ff]" /> 24×7 fulfillment</span>
          <span className="eh-mono text-[10px] px-2 py-1 rounded border border-[var(--eh-border)] inline-flex items-center gap-1.5"><Sparkles size={11} className="text-[#ffd34d]" /> Refill guarantee on supported services</span>
        </div>
      </div>

      {/* Catalog error banner */}
      {catalog.error && (
        <div className="eh-panel p-3 mb-4 border-[#ff3148] text-sm">
          <b className="text-[#ff3148]">Catalog unavailable:</b> <span className="opacity-80">{catalog.error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_420px] gap-5 sm:gap-6 min-w-0">
        {/* LEFT: catalog browse */}
        <div className="min-w-0">
          {/* Search + refresh */}
          <div className="eh-panel p-3 sm:p-4 mb-4">
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
            {/* Platform chips */}
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
                  // {filtered.length} services shown
                  {filtered.length === 200 && <span className="opacity-50"> · refine your search to see more</span>}
                </div>
                <div className="eh-mono text-[10px] opacity-50 hidden sm:flex items-center gap-1.5">
                  <Tag size={10} /> markup {catalog.markup_percent}% · min {formatINR(catalog.min_order_inr)}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                {filtered.map(r => (
                  <ServiceCard key={r.id} row={r} selected={selected?.id === r.id} onSelect={handleSelect} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: order form (sticky on desktop) */}
        <div className="lg:sticky lg:top-20 self-start">
          <div id="smm-form-anchor" />
          {!selected ? (
            <div className="eh-panel p-5 text-center" data-testid="smm-empty-form">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full grid place-items-center" style={{ background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)' }}>
                <Bot size={24} className="text-[var(--eh-green)]" />
              </div>
              <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1">// AWAITING_SELECTION</div>
              <div className="text-sm font-semibold" style={{ fontFamily: 'Inter,sans-serif' }}>Pick a service from the catalog</div>
              <div className="text-xs opacity-60 mt-1.5 leading-relaxed">
                Browse by platform, search by keyword, then tap any card to configure quantity, paste your link, and pay instantly.
              </div>
            </div>
          ) : (
            <OrderForm
              service={selected}
              charge={charge}
              quantity={quantity}
              setQuantity={setQuantity}
              link={link}
              setLink={setLink}
              contact={contact}
              setContact={setContact}
              busy={busy}
              onSubmit={handleSubmit}
              onClear={() => { setSelected(null); setLink(''); setQuantity(''); }}
            />
          )}

          {/* Trust strip */}
          <div className="mt-3 eh-mono text-[10px] opacity-55 leading-relaxed px-1">
            Powered by Peakerr-style auto-placement · INR rate locked at checkout · refunds available on undeliverable orders.
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSmmPage;
