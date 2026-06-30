import React, { useEffect, useState } from 'react';
import { Bot, Zap, RefreshCcw, Search, Link2, AlertTriangle, CheckCircle2, Loader2, Wallet, Settings as SettingsIcon, X, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

/**
 * Admin SMM panel — config + balance + service mapping.
 * Mounted as a tab in AdminPanel.jsx.
 */
const StatTile = ({ label, value, sub, color = '#00ff9d', icon: Icon, danger }) => (
  <div className="eh-panel p-4 relative overflow-hidden" style={{ borderColor: danger ? '#ff3148' : `${color}55` }}>
    <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${danger ? '#ff3148' : color}, transparent)`, opacity: .6 }} />
    <div className="flex items-center justify-between mb-1">
      <div className="eh-mono text-[10px] tracking-widest opacity-60">{label}</div>
      {Icon && <Icon size={14} style={{ color: danger ? '#ff3148' : color }} />}
    </div>
    <div className="eh-display text-2xl font-black" style={{ color: danger ? '#ff3148' : color }}>{value}</div>
    {sub && <div className="eh-mono text-[10px] opacity-55 mt-1">{sub}</div>}
  </div>
);

const ServicePickerModal = ({ open, onClose, appService, onLinked }) => {
  const [q, setQ] = useState(appService?.platform || appService?.name?.split(' ')?.[0] || '');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState({ total: 0, rows: [], inr_rate: 88 });
  const [linking, setLinking] = useState(null);

  const search = async () => {
    setSearching(true);
    try { setResults(await api.smmSearchServices(q, 80)); } catch (e) { toast.error(e.message); }
    finally { setSearching(false); }
  };

  useEffect(() => { if (open) search(); }, [open]); // eslint-disable-line

  const link = async (row) => {
    setLinking(row.service);
    try {
      await api.smmLinkService(appService.id, { smm_service_id: row.service, smm_price_per_1000_usd: parseFloat(row.rate) || 0, smm_service_name: row.name });
      toast.success(`Linked "${appService.name}" → panel #${row.service}`);
      onLinked?.();
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setLinking(null); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/85 flex items-end sm:items-center justify-center p-4" onClick={onClose} data-testid="smm-picker-modal">
      <div onClick={e => e.stopPropagation()} className="eh-panel max-w-3xl w-full max-h-[85vh] overflow-hidden bg-[#0a0d10] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--eh-border)]">
          <div>
            <div className="eh-mono text-[10px] opacity-60 tracking-widest">// MAP_PANEL_SERVICE</div>
            <div className="eh-display font-black text-lg truncate">{appService?.name}</div>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 border-b border-[var(--eh-border)] flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="> instagram followers, youtube views, tiktok likes…" className="eh-input text-sm flex-1" data-testid="smm-picker-search" />
          <button onClick={search} disabled={searching} className="eh-btn-primary text-xs inline-flex items-center gap-1.5 px-4">{searching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} SEARCH</button>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {results.rows.length === 0 && !searching && <div className="text-center py-10 eh-mono text-xs opacity-60">No services match — try different keywords</div>}
          {results.rows.map(r => (
            <div key={r.service} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-[var(--eh-border)] hover:bg-white/5 transition-colors items-center">
              <div className="col-span-1 eh-mono text-[10px] eh-neon-soft">#{r.service}</div>
              <div className="col-span-6 min-w-0">
                <div className="text-xs leading-snug">{r.name}</div>
                <div className="eh-mono text-[9px] opacity-50 mt-0.5">{r.category}</div>
              </div>
              <div className="col-span-2 text-right">
                <div className="eh-mono text-[11px] font-bold text-[var(--eh-green)]">₹{r.rate_inr_per_1000?.toLocaleString('en-IN')}/1k</div>
                <div className="eh-mono text-[9px] opacity-50">${r.rate}</div>
              </div>
              <div className="col-span-2 text-right eh-mono text-[10px] opacity-60">
                <div>min {r.min}</div>
                <div>max {Number(r.max).toLocaleString('en-IN')}</div>
              </div>
              <div className="col-span-1 text-right">
                <button onClick={() => link(r)} disabled={linking === r.service} className="text-[10px] eh-mono px-2 py-1 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] disabled:opacity-50" data-testid={`smm-picker-link-${r.service}`}>
                  {linking === r.service ? <Loader2 size={11} className="animate-spin" /> : 'LINK'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-[var(--eh-border)] eh-mono text-[10px] opacity-60 text-center">
          {results.total} matches · INR conversion @ ₹{results.inr_rate}/USD
        </div>
      </div>
    </div>
  );
};

const AdminSmmPanel = () => {
  const [cfg, setCfg] = useState(null);
  const [balance, setBalance] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [picking, setPicking] = useState(null);
  const [form, setForm] = useState({ enabled: false, url: '', api_key: '', inr_rate: 88, low_balance_inr: 500, markup_percent: 40, min_order_inr: 10, auto_place_on_verified: true });

  const load = async () => {
    setLoading(true);
    try {
      const [c, b, conf] = await Promise.all([
        api.smmGetConfig(),
        api.smmBalance().catch(() => null),
        api.getConfig().catch(() => ({ services: [] })),
      ]);
      setCfg(c);
      setBalance(b);
      setServices(conf?.services || []);
      setForm({
        enabled: !!c.enabled,
        url: c.url || '',
        api_key: '',
        inr_rate: c.inr_rate || 88,
        low_balance_inr: c.low_balance_inr || 500,
        markup_percent: c.markup_percent ?? 40,
        min_order_inr: c.min_order_inr ?? 10,
        auto_place_on_verified: c.auto_place_on_verified !== false,
      });
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = { ...form };
      // Don't overwrite the stored key with empty when admin is editing without re-entering
      if (!payload.api_key) delete payload.api_key;
      await api.smmUpdateConfig(payload);
      toast.success('Saved');
      setEditing(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const refreshBalance = async () => {
    try {
      const b = await api.smmBalance();
      setBalance(b);
      toast.success(`₹${b.inr?.toLocaleString('en-IN')} live · $${b.usd?.toFixed(4)}`);
    } catch (e) { toast.error(e.message); }
  };

  const unlink = async (sid) => {
    if (!window.confirm('Unlink this service from the panel?')) return;
    try { await api.smmUnlinkService(sid); toast.success('Unlinked'); load(); } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="animate-spin inline-block" /></div>;

  const mappedCount = services.filter(s => s.smm_service_id).length;
  const isLow = balance && balance.enabled && balance.inr <= (cfg?.low_balance_inr || 500);

  return (
    <div className="space-y-5" data-testid="admin-smm-panel">
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="STATUS" value={cfg?.enabled ? 'LIVE' : 'OFF'} color={cfg?.enabled ? '#00ff9d' : '#666'} icon={Bot} sub={cfg?.enabled && cfg?.api_key ? 'panel connected' : 'awaiting config'} />
        <StatTile label="PANEL BALANCE" value={balance?.enabled ? `₹${(balance?.inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'} color="#4de0ff" icon={Wallet} sub={balance?.enabled ? `$${(balance?.usd || 0).toFixed(4)} USD · low @ ₹${cfg?.low_balance_inr}` : 'enable panel first'} danger={isLow} />
        <StatTile label="MAPPED SERVICES" value={mappedCount} color="#ffd34d" icon={Link2} sub={`of ${services.length} total`} />
        <StatTile label="AUTO-PLACE" value={cfg?.auto_place_on_verified ? 'ON' : 'OFF'} color="#c084fc" icon={Sparkles} sub="fires on `verified`" />
      </div>

      {isLow && (
        <div className="eh-panel p-3 flex items-center gap-3" style={{ borderColor: '#ff314866', background: 'rgba(255,49,72,.05)' }}>
          <AlertTriangle size={18} className="text-[#ff3148] shrink-0" />
          <div className="text-sm flex-1">
            <b className="text-[#ff3148]">Panel balance is below your low-balance threshold.</b> Top up at <a href="https://peakerr.com/funds" target="_blank" rel="noreferrer" className="underline">peakerr.com/funds</a> to keep auto-placement running.
          </div>
        </div>
      )}

      {/* Config card */}
      <div className="eh-panel p-5 relative">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="eh-mono text-[10px] tracking-widest opacity-60">// PANEL_CONFIG</div>
            <div className="eh-display font-black text-lg flex items-center gap-2"><Bot size={18} className="text-[var(--eh-green)]" /> Peakerr-style SMM automation</div>
          </div>
          <div className="flex gap-2">
            <button onClick={refreshBalance} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> SYNC BALANCE</button>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="eh-btn-ghost text-xs" data-testid="smm-config-edit">EDIT</button>
            ) : (
              <>
                <button onClick={() => { setEditing(false); load(); }} className="eh-btn-ghost text-xs">CANCEL</button>
                <button onClick={save} className="eh-btn-primary text-xs" data-testid="smm-config-save">SAVE</button>
              </>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">PANEL ENDPOINT</label>
            <input value={form.url} disabled={!editing} onChange={e => setForm({ ...form, url: e.target.value })} className="eh-input text-sm w-full" />
          </div>
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 flex items-center gap-2 justify-between"><span>API KEY</span>{cfg?.api_key && <span className="text-[var(--eh-green)]">✓ {cfg?.api_key_masked}</span>}</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={form.api_key} disabled={!editing} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder={cfg?.api_key ? '(leave blank to keep current)' : '> paste your panel API key'} className="eh-input text-sm w-full pr-9" data-testid="smm-config-key" />
              {editing && <button onClick={() => setShowKey(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100">{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>}
            </div>
          </div>
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">USD → INR RATE</label>
            <input type="number" step="any" value={form.inr_rate} disabled={!editing} onChange={e => setForm({ ...form, inr_rate: parseFloat(e.target.value) || 0 })} className="eh-input text-sm w-full" />
          </div>
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">LOW BALANCE ALERT @ (₹)</label>
            <input type="number" step="any" value={form.low_balance_inr} disabled={!editing} onChange={e => setForm({ ...form, low_balance_inr: parseFloat(e.target.value) || 0 })} className="eh-input text-sm w-full" />
          </div>
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">PROFIT MARKUP (%)</label>
            <input type="number" step="any" value={form.markup_percent} disabled={!editing} onChange={e => setForm({ ...form, markup_percent: parseFloat(e.target.value) || 0 })} className="eh-input text-sm w-full" data-testid="smm-config-markup" />
            <div className="eh-mono text-[9px] opacity-50 mt-1">Added on top of panel cost · shown to customer at /smm</div>
          </div>
          <div>
            <label className="eh-mono text-[10px] tracking-widest opacity-60 mb-1 block">MIN ORDER FLOOR (₹)</label>
            <input type="number" step="any" value={form.min_order_inr} disabled={!editing} onChange={e => setForm({ ...form, min_order_inr: parseFloat(e.target.value) || 0 })} className="eh-input text-sm w-full" data-testid="smm-config-min-order" />
            <div className="eh-mono text-[9px] opacity-50 mt-1">Below this, the charge is rounded up to floor (covers panel fees)</div>
          </div>
          <label className={`eh-panel p-3 flex items-center gap-3 cursor-${editing ? 'pointer' : 'default'} col-span-1 sm:col-span-2`}>
            <input type="checkbox" checked={form.enabled} disabled={!editing} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4 accent-[var(--eh-green)]" data-testid="smm-config-enabled" />
            <div className="flex-1">
              <div className="eh-mono text-xs tracking-widest font-bold">ENABLE PANEL AUTOMATION</div>
              <div className="eh-mono text-[10px] opacity-60 mt-0.5">Master switch — off = no auto-placement, no polling. Existing orders untouched.</div>
            </div>
          </label>
          <label className={`eh-panel p-3 flex items-center gap-3 cursor-${editing ? 'pointer' : 'default'} col-span-1 sm:col-span-2`}>
            <input type="checkbox" checked={form.auto_place_on_verified} disabled={!editing} onChange={e => setForm({ ...form, auto_place_on_verified: e.target.checked })} className="w-4 h-4 accent-[var(--eh-green)]" />
            <div className="flex-1">
              <div className="eh-mono text-xs tracking-widest font-bold">AUTO-PLACE ON `verified`</div>
              <div className="eh-mono text-[10px] opacity-60 mt-0.5">Safer flow — order only fires on the panel when you mark it verified (after payment review). Turn off for hands-on control.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Service mapping */}
      <div className="eh-panel p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="eh-mono text-[10px] tracking-widest opacity-60">// SERVICE_MAPPING</div>
            <div className="eh-display font-black text-lg">Link your services to panel services</div>
          </div>
          <div className="eh-mono text-[11px] opacity-60">{mappedCount}/{services.length} mapped</div>
        </div>
        {services.length === 0 ? (
          <div className="text-center py-8 eh-mono text-xs opacity-60">No app services yet — create one under Services first.</div>
        ) : (
          <div className="space-y-2">
            {services.map(s => {
              const mapped = !!s.smm_service_id;
              return (
                <div key={s.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded border border-[var(--eh-border)] hover:border-[rgba(0,255,157,.4)] transition-colors" data-testid={`smm-service-row-${s.id}`}>
                  <div className="col-span-12 sm:col-span-5 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ fontFamily: 'Inter,sans-serif' }}>{s.name}</div>
                    <div className="eh-mono text-[10px] opacity-50 truncate">{s.id} · {s.platform || '—'}</div>
                  </div>
                  <div className="col-span-7 sm:col-span-5 min-w-0">
                    {mapped ? (
                      <div>
                        <div className="eh-mono text-[11px] eh-neon-soft truncate">↪ #{s.smm_service_id} {s.smm_service_name ? `· ${s.smm_service_name}` : ''}</div>
                        {s.smm_price_per_1000_usd && <div className="eh-mono text-[10px] opacity-60">${s.smm_price_per_1000_usd}/1k · ₹{(s.smm_price_per_1000_usd * (cfg?.inr_rate || 88)).toFixed(2)}/1k cost</div>}
                      </div>
                    ) : (
                      <div className="eh-mono text-[10px] opacity-50">not linked — orders will need manual placement</div>
                    )}
                  </div>
                  <div className="col-span-5 sm:col-span-2 flex justify-end gap-1">
                    {mapped && <button onClick={() => unlink(s.id)} className="text-[10px] eh-mono px-2 py-1 rounded border border-[var(--eh-border)] hover:border-[#ff3148] hover:text-[#ff3148]" data-testid={`smm-unlink-${s.id}`}>UNLINK</button>}
                    <button onClick={() => setPicking(s)} className="text-[10px] eh-mono px-2 py-1 rounded border border-[var(--eh-green)] text-[var(--eh-green)] hover:bg-[rgba(0,255,157,.08)]" data-testid={`smm-link-btn-${s.id}`}>{mapped ? 'CHANGE' : 'LINK'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ServicePickerModal open={!!picking} onClose={() => setPicking(null)} appService={picking} onLinked={load} />
    </div>
  );
};

export default AdminSmmPanel;
