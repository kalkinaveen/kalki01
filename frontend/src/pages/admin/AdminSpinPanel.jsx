import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Save, Sparkles, Power } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

const PRIZE_TYPES = [
  { value: 'credit', label: 'Credit (₹ to wallet)' },
  { value: 'nothing', label: 'Try Again (no win)' },
];

const PALETTE = ['#00ff9d', '#4de0ff', '#ffd34d', '#3a3f44', '#ff8a4d', '#ff4d6d', '#c084fc', '#ffd700'];

const AdminSpinPanel = () => {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await api.spinConfig();
      // Public endpoint strips weights — fetch admin view by combining with site config call
      const adminCfg = await api.getConfig();
      const sw = adminCfg?.spin_wheel || {};
      const prizes = (sw.prizes && sw.prizes.length) ? sw.prizes : (r.prizes || []);
      setCfg({
        enabled: sw.enabled !== false,
        cooldown_hours: sw.cooldown_hours || 24,
        prizes,
      });
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading || !cfg) return <div className="eh-panel p-5 grid place-items-center min-h-[200px]"><Loader2 className="animate-spin" /></div>;

  const totalWeight = (cfg.prizes || []).reduce((s, p) => s + (parseFloat(p.weight) || 0), 0) || 1;

  const setPrize = (idx, key, val) => setCfg(c => {
    const ps = [...c.prizes];
    ps[idx] = { ...ps[idx], [key]: val };
    return { ...c, prizes: ps };
  });
  const addPrize = () => setCfg(c => ({
    ...c,
    prizes: [...c.prizes, {
      id: `p${Date.now()}`, label: '₹10', type: 'credit', amount: 10,
      weight: 5, color: PALETTE[c.prizes.length % PALETTE.length],
    }],
  }));
  const removePrize = (idx) => setCfg(c => ({ ...c, prizes: c.prizes.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!cfg.prizes.length) { toast.error('Add at least one prize'); return; }
    setBusy(true);
    try {
      const payload = {
        enabled: !!cfg.enabled,
        cooldown_hours: Math.max(1, parseInt(cfg.cooldown_hours) || 24),
        prizes: cfg.prizes.map(p => ({
          id: p.id, label: p.label || '—', type: p.type || 'credit',
          amount: parseFloat(p.amount) || 0,
          weight: Math.max(0, parseFloat(p.weight) || 0),
          color: p.color || '#00ff9d',
        })),
      };
      await api.spinConfigUpdate(payload);
      toast.success('Spin wheel saved · live for the next spin');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="eh-panel p-5 space-y-4" data-testid="admin-spin-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="eh-mono text-xs tracking-widest opacity-70 flex items-center gap-2">
          <Sparkles size={12} className="text-[var(--eh-green)]" /> // SPIN WHEEL  ({cfg.prizes.length} prizes)
        </div>
        <button onClick={save} disabled={busy} className="eh-btn-primary text-xs inline-flex items-center gap-1.5" data-testid="admin-spin-save">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} SAVE
        </button>
      </div>
      <p className="eh-mono text-[11px] opacity-70 leading-6">
        Set your prize ladder. <b>Weight</b> is the relative chance (higher = wins more often). Live odds shown next to each row.
      </p>

      {/* Global toggles */}
      <div className="grid grid-cols-2 gap-3">
        <label className={`eh-mono text-xs cursor-pointer p-3 rounded border inline-flex items-center gap-2 ${cfg.enabled ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.05)]' : 'border-[var(--eh-border)]'}`}>
          <input type="checkbox" checked={!!cfg.enabled} onChange={e => setCfg(c => ({ ...c, enabled: e.target.checked }))} className="accent-[var(--eh-green)]" data-testid="admin-spin-enabled" />
          <Power size={11} /> ENABLED
        </label>
        <div>
          <div className="eh-mono text-[10px] opacity-60 mb-1">COOLDOWN (HOURS)</div>
          <input type="number" min="1" value={cfg.cooldown_hours} onChange={e => setCfg(c => ({ ...c, cooldown_hours: e.target.value }))} className="eh-input text-sm" data-testid="admin-spin-cooldown" />
        </div>
      </div>

      {/* Prize ladder */}
      <div className="overflow-x-auto">
        <table className="w-full eh-mono text-xs min-w-[640px]">
          <thead className="bg-[rgba(255,255,255,.03)] text-[10px] tracking-widest opacity-70">
            <tr>
              <th className="text-left p-2">LABEL</th>
              <th className="text-left p-2 w-24">TYPE</th>
              <th className="text-left p-2 w-24">AMOUNT (₹)</th>
              <th className="text-left p-2 w-24">WEIGHT</th>
              <th className="text-left p-2 w-20">ODDS</th>
              <th className="text-left p-2 w-16">COLOR</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {cfg.prizes.map((p, idx) => (
              <tr key={p.id || idx} className="border-t border-[var(--eh-border)]" data-testid={`admin-spin-row-${idx}`}>
                <td className="p-2"><input value={p.label || ''} onChange={e => setPrize(idx, 'label', e.target.value)} className="eh-input text-xs" /></td>
                <td className="p-2">
                  <select value={p.type || 'credit'} onChange={e => setPrize(idx, 'type', e.target.value)} className="eh-input text-xs py-1">
                    {PRIZE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </td>
                <td className="p-2"><input type="number" min="0" value={p.amount ?? 0} onChange={e => setPrize(idx, 'amount', e.target.value)} className="eh-input text-xs" disabled={p.type === 'nothing'} /></td>
                <td className="p-2"><input type="number" min="0" step="0.1" value={p.weight ?? 0} onChange={e => setPrize(idx, 'weight', e.target.value)} className="eh-input text-xs" /></td>
                <td className="p-2 eh-neon-soft">{((parseFloat(p.weight) || 0) / totalWeight * 100).toFixed(2)}%</td>
                <td className="p-2"><input type="color" value={p.color || '#00ff9d'} onChange={e => setPrize(idx, 'color', e.target.value)} className="w-10 h-7 rounded cursor-pointer bg-transparent" /></td>
                <td className="p-2 text-right">
                  <button onClick={() => removePrize(idx)} className="text-red-400 hover:text-red-300" data-testid={`admin-spin-remove-${idx}`}><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-[var(--eh-border)]">
        <button onClick={addPrize} className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="admin-spin-add"><Plus size={12} /> ADD PRIZE</button>
        <div className="eh-mono text-[11px] opacity-70">
          ▰ <b className="text-[var(--eh-green)]">Total weight</b> {totalWeight} · expected payout per spin: <b className="text-[var(--eh-green)]">₹{((cfg.prizes || []).reduce((s, p) => s + ((parseFloat(p.weight) || 0) * (parseFloat(p.amount) || 0)), 0) / totalWeight).toFixed(2)}</b>
        </div>
      </div>
    </div>
  );
};

export default AdminSpinPanel;
