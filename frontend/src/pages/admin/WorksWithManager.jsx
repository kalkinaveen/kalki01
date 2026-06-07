import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Save, Upload, GripVertical, Globe, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const resolveIcon = (u) => (!u ? null : u.startsWith('http') ? u : `${BACKEND_URL}${u}`);

const newRow = () => ({ id: `ww_${Math.random().toString(36).slice(2, 8)}`, name: '', icon_url: '', link: '', active: true, sort: 0 });

/**
 * Admin manager for the "Works With" brand strip on Home page.
 * - Toggle the whole strip on/off
 * - Edit title (// WORKS WITH)
 * - Tune scroll speed (10-120s per loop)
 * - Add/remove brand rows
 * - Upload brand icon (5MB, /api/uploads admin endpoint)
 * - Set optional click-through link per brand
 * - Drag to reorder via sort number
 */
const WorksWithManager = () => {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Public /config returns the full config doc (including inactive works_with items)
        const full = await api.getConfig();
        setCfg(full.works_with || { enabled: true, title: 'WORKS WITH', speed: 35, items: [] });
      } catch (e) {
        toast.error('Failed to load Works With config');
      } finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await api.worksWithUpdate(cfg);
      setCfg(r.works_with);
      toast.success('Works With saved');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const addRow = () => setCfg(c => ({ ...c, items: [...(c.items || []), { ...newRow(), sort: (c.items?.length || 0) + 1 }] }));
  const removeRow = (id) => setCfg(c => ({ ...c, items: (c.items || []).filter(x => x.id !== id) }));
  const patchRow = (id, p) => setCfg(c => ({ ...c, items: (c.items || []).map(x => x.id === id ? { ...x, ...p } : x) }));

  const uploadIcon = async (id, file) => {
    if (!file.type.startsWith('image/')) { toast.error('Image files only'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setUploadingId(id);
    try {
      const r = await api.uploadImage(file);
      patchRow(id, { icon_url: r.url });
      toast.success('Icon uploaded');
    } catch (e) { toast.error(e.message); }
    finally { setUploadingId(''); }
  };

  if (loading || !cfg) return <div className="py-6 text-center"><Loader2 className="animate-spin inline-block" /></div>;
  const items = (cfg.items || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));

  return (
    <div className="space-y-5" data-testid="admin-works-with">
      <div className="eh-panel p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="eh-mono text-[10px] tracking-widest opacity-60">// HOME · WORKS WITH STRIP</div>
            <div className="eh-display text-xl font-black">Brand Marquee</div>
            <div className="eh-mono text-[11px] opacity-70 mt-1 leading-6">Scrolling row of brand logos on the home page. Upload your own icons or leave blank for the built-in fallback.</div>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 eh-mono text-xs cursor-pointer">
              <input type="checkbox" checked={!!cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} className="accent-[var(--eh-green)]" data-testid="ww-enabled" />
              <span className={cfg.enabled ? 'text-[var(--eh-green)]' : 'opacity-60'}>ENABLED</span>
            </label>
            <button onClick={save} disabled={saving} data-testid="ww-save" className="eh-btn-primary text-xs inline-flex items-center gap-1.5">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} SAVE
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1">TITLE</div>
            <input value={cfg.title || ''} onChange={e => setCfg({ ...cfg, title: e.target.value })} className="eh-input" placeholder="WORKS WITH" data-testid="ww-title" />
          </div>
          <div>
            <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1">SCROLL SPEED · {cfg.speed || 35}s per loop</div>
            <input type="range" min="10" max="120" value={cfg.speed || 35} onChange={e => setCfg({ ...cfg, speed: Number(e.target.value) })} className="w-full accent-[var(--eh-green)]" data-testid="ww-speed" />
            <div className="flex justify-between eh-mono text-[10px] opacity-50 mt-1"><span>FAST · 10s</span><span>SLOW · 120s</span></div>
          </div>
        </div>
      </div>

      <div className="eh-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="eh-mono text-xs tracking-widest opacity-70">// BRANDS ({items.length})</div>
          <button onClick={addRow} data-testid="ww-add" className="eh-btn-ghost text-xs"><Plus size={12} /> ADD BRAND</button>
        </div>

        {items.length === 0 ? (
          <div className="eh-mono text-xs opacity-60 text-center py-8">No brands yet — click ADD BRAND to start.</div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => {
              const icon = resolveIcon(it.icon_url);
              return (
                <div key={it.id} className={`grid grid-cols-[auto_64px_1fr_1fr_56px_36px] sm:grid-cols-[auto_72px_1fr_1.4fr_72px_44px] items-center gap-2 sm:gap-3 p-3 border rounded ${it.active ? 'border-[var(--eh-border)]' : 'border-[var(--eh-border)] opacity-50'}`} data-testid={`ww-row-${idx}`}>
                  <GripVertical size={14} className="opacity-30" />

                  {/* Icon preview / upload */}
                  <label className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded grid place-items-center bg-[#0d1115] border border-[var(--eh-border)] cursor-pointer hover:border-[var(--eh-green)] overflow-hidden">
                    {uploadingId === it.id ? <Loader2 size={18} className="animate-spin text-[var(--eh-green)]" />
                      : icon ? <img src={icon} alt={it.name} className="w-full h-full object-contain p-2" />
                      : <ImageIcon size={20} className="opacity-40" />}
                    <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadIcon(it.id, f); }} data-testid={`ww-upload-${idx}`} />
                    {icon && <button type="button" onClick={(e) => { e.preventDefault(); patchRow(it.id, { icon_url: '' }); }} title="Remove icon" className="absolute top-0.5 right-0.5 w-5 h-5 grid place-items-center rounded-full bg-black/70 text-white hover:bg-black"><X size={10} /></button>}
                  </label>

                  <input value={it.name} onChange={e => patchRow(it.id, { name: e.target.value })} className="eh-input text-sm py-2" placeholder="Brand name (e.g. Instagram)" data-testid={`ww-name-${idx}`} />
                  <input value={it.link} onChange={e => patchRow(it.id, { link: e.target.value })} className="eh-input text-xs py-2" placeholder="https://link (optional)" />
                  <input type="number" value={it.sort} onChange={e => patchRow(it.id, { sort: Number(e.target.value) })} className="eh-input text-xs py-2 text-center" title="Sort order" />

                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex items-center gap-1 cursor-pointer" title="Active">
                      <input type="checkbox" checked={!!it.active} onChange={e => patchRow(it.id, { active: e.target.checked })} className="accent-[var(--eh-green)] w-3.5 h-3.5" />
                    </label>
                    <button onClick={() => removeRow(it.id)} className="text-red-400 hover:text-red-300 grid place-items-center" data-testid={`ww-remove-${idx}`} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 eh-mono text-[10px] opacity-50 leading-5">// Upload max 5MB. PNG with transparent background recommended. Sort number controls display order.</div>
      </div>
    </div>
  );
};

export default WorksWithManager;
