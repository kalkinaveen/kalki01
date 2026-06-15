import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, Plus, Save, Star, Edit3, Check, X, Eye, BadgeCheck, Send as TgIcon, Phone, Image as ImageIcon, IndianRupee, ExternalLink, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

const STATUSES = [
  { v: 'new', label: 'NEW', cls: 'text-[var(--eh-green)]' },
  { v: 'reviewing', label: 'REVIEWING', cls: 'text-[#4de0ff]' },
  { v: 'engaged', label: 'ENGAGED', cls: 'text-[#ffd34d]' },
  { v: 'recovering', label: 'RECOVERING', cls: 'text-[#ffd34d]' },
  { v: 'recovered', label: 'RECOVERED', cls: 'text-[var(--eh-green)]' },
  { v: 'closed', label: 'CLOSED', cls: 'opacity-60' },
  { v: 'rejected', label: 'REJECTED', cls: 'text-[#ff6b6b]' },
];

const Tabs = ({ active, setActive }) => (
  <div className="flex gap-2 overflow-x-auto eh-no-scrollbar mb-5">
    {[
      { k: 'cases', l: 'Cases' },
      { k: 'services', l: 'Services' },
      { k: 'reviews', l: 'Reviews' },
      { k: 'stats', l: 'Stats' },
      { k: 'hero', l: 'Hero & Trust' },
    ].map(t => (
      <button key={t.k} onClick={() => setActive(t.k)} data-testid={`recovery-admin-tab-${t.k}`} className={`shrink-0 px-3 py-2 rounded text-[11px] eh-mono tracking-widest uppercase ${active === t.k ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>{t.l}</button>
    ))}
  </div>
);

const CasesTab = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try { setRows(await api.recoveryListCases()); } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filter === 'all' ? rows : rows.filter(r => r.status === filter), [rows, filter]);

  const setStatus = async (id, status) => {
    try {
      const r = await api.recoveryUpdateCase(id, { status });
      setRows(prev => prev.map(x => x.id === id ? r : x));
      if (selected?.id === id) setSelected(r);
      toast.success(`Marked ${status}`);
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm(`Delete case ${id}?`)) return;
    try {
      await api.recoveryDeleteCase(id);
      setRows(prev => prev.filter(x => x.id !== id));
      setSelected(null);
      toast.success('Case deleted');
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="animate-spin inline-block" /></div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('all')} className={`text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border ${filter === 'all' ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)]'}`}>ALL ({rows.length})</button>
        {STATUSES.map(s => {
          const n = rows.filter(r => r.status === s.v).length;
          return <button key={s.v} onClick={() => setFilter(s.v)} className={`text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border ${filter === s.v ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)]'}`}>{s.label} ({n})</button>;
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="eh-panel p-10 text-center eh-mono text-xs opacity-60">No cases in this view.</div>
      ) : (
        <div className="eh-panel overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[rgba(255,255,255,.03)] eh-mono text-[10px] tracking-widest uppercase opacity-70">
              <tr>
                <th className="text-left p-3">Case</th>
                <th className="text-left p-3">Service</th>
                <th className="text-left p-3">Platform</th>
                <th className="text-left p-3">Urgency</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Quote</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const st = STATUSES.find(s => s.v === r.status) || STATUSES[0];
                return (
                  <tr key={r.id} className="border-t border-[var(--eh-border)] hover:bg-white/5 cursor-pointer" onClick={() => setSelected(r)} data-testid={`recovery-case-row-${r.id}`}>
                    <td className="p-3"><div className="eh-mono text-xs">{r.id}</div><div className="text-[10px] opacity-50">{new Date(r.createdAt).toLocaleString()}</div></td>
                    <td className="p-3">{r.service_name || r.service_id}</td>
                    <td className="p-3 eh-mono text-xs uppercase">{r.platform}</td>
                    <td className="p-3 eh-mono text-xs uppercase">{r.urgency}</td>
                    <td className="p-3 text-xs"><div>{r.name}</div><div className="opacity-60">{r.email}</div>{r.telegram && <div className="opacity-60">{r.telegram}</div>}</td>
                    <td className="p-3 eh-mono">₹{Number(r.estimated_price || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3"><span className={`eh-mono text-[10px] font-bold tracking-widest ${st.cls}`}>{st.label}</span></td>
                    <td className="p-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setSelected(r); }} className="text-xs underline opacity-80 hover:opacity-100">View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} className="eh-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-[#0d1115]" data-testid="recovery-case-detail">
            <div className="flex items-center justify-between p-4 border-b border-[var(--eh-border)] sticky top-0 bg-[#0d1115]">
              <div>
                <div className="eh-mono text-[10px] opacity-60">CASE</div>
                <div className="eh-neon eh-mono font-bold">{selected.id}</div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="close"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field l="Service" v={selected.service_name} />
                <Field l="Platform" v={selected.platform} />
                <Field l="Urgency" v={selected.urgency} />
                <Field l="Estimate" v={`₹${Number(selected.estimated_price || 0).toLocaleString('en-IN')}`} />
                <Field l="Account URL" v={selected.account_url} link />
                <Field l="Follower tier" v={selected.follower_tier} />
                <Field l="Name" v={selected.name} />
                <Field l="Email" v={selected.email} />
                <Field l="Telegram" v={selected.telegram} link={selected.telegram ? `https://t.me/${selected.telegram.replace(/^@/, '')}` : null} />
                <Field l="WhatsApp" v={selected.whatsapp} link={selected.whatsapp ? `https://wa.me/${selected.whatsapp.replace(/\D/g, '')}` : null} />
                <Field l="Contact pref" v={selected.contact_pref} />
                <Field l="Created" v={new Date(selected.createdAt).toLocaleString()} />
              </div>
              <div>
                <div className="eh-mono text-[10px] opacity-60 mb-1">DESCRIPTION</div>
                <div className="eh-panel p-3 text-sm whitespace-pre-wrap leading-6 max-h-48 overflow-y-auto">{selected.description || '—'}</div>
              </div>
              {!!(selected.proof_urls || []).length && (
                <div>
                  <div className="eh-mono text-[10px] opacity-60 mb-1">PROOFS ({selected.proof_urls.length})</div>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.proof_urls.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer" className="aspect-square block rounded overflow-hidden border border-[var(--eh-border)] hover:border-[var(--eh-green)]">
                        <img src={u} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <SendPaymentPanel selected={selected} onUpdated={(c) => { setSelected(c); setRows(prev => prev.map(x => x.id === c.id ? c : x)); }} />
              <div>
                <div className="eh-mono text-[10px] opacity-60 mb-1">UPDATE STATUS</div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map(s => (
                    <button key={s.v} onClick={() => setStatus(selected.id, s.v)} className={`text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border ${selected.status === s.v ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between pt-3 border-t border-[var(--eh-border)]">
                <button onClick={() => remove(selected.id)} className="text-xs eh-mono text-red-400 hover:text-red-300 flex items-center gap-1.5"><Trash2 size={12} /> DELETE</button>
                <a href={selected.telegram ? `https://t.me/${selected.telegram.replace(/^@/, '')}` : '#'} target="_blank" rel="noreferrer" className="eh-btn-primary text-xs flex items-center gap-1.5"><TgIcon size={12} /> CONTACT</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ l, v, link }) => (
  <div>
    <div className="eh-mono text-[10px] opacity-60 tracking-widest">{l}</div>
    {link === true ? (
      <a href={v} target="_blank" rel="noreferrer" className="text-sm text-[var(--eh-green)] hover:underline break-all">{v || '—'}</a>
    ) : link ? (
      <a href={link} target="_blank" rel="noreferrer" className="text-sm text-[var(--eh-green)] hover:underline break-all">{v || '—'}</a>
    ) : (
      <div className="text-sm break-all">{v || '—'}</div>
    )}
  </div>
);

const CURRENCY_SYM = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

const SendPaymentPanel = ({ selected, onUpdated }) => {
  const linked = !!selected.linked_order_id;
  const defaultAmount = selected.final_amount || selected.estimated_price || 0;
  const [amount, setAmount] = useState(defaultAmount);
  const [currency, setCurrency] = useState(selected.final_currency || selected.currency || 'INR');
  const [note, setNote] = useState(selected.payment_note || '');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(!linked);

  useEffect(() => {
    setAmount(selected.final_amount || selected.estimated_price || 0);
    setCurrency(selected.final_currency || selected.currency || 'INR');
    setNote(selected.payment_note || '');
    setEditing(!selected.linked_order_id);
  }, [selected.id, selected.linked_order_id, selected.final_amount, selected.estimated_price, selected.final_currency, selected.currency, selected.payment_note]);

  const send = async () => {
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setBusy(true);
    try {
      const res = await api.recoverySendPayment(selected.id, { amount: Number(amount), currency, note });
      toast.success(linked ? 'Payment request updated' : 'Payment request sent', { description: `Order ${res.order.id} linked to this case` });
      setEditing(false);
      onUpdated?.(res.case);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const sym = CURRENCY_SYM[currency] || '';

  return (
    <div className="eh-panel p-4 bg-[rgba(0,255,157,.04)] border border-[rgba(0,255,157,.25)]" data-testid="recovery-payment-panel">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="eh-mono text-[10px] opacity-70 tracking-widest flex items-center gap-2"><CreditCard size={11} className="text-[var(--eh-green)]" /> // PAYMENT REQUEST</div>
        {linked && <a href={`/track?id=${selected.linked_order_id}`} target="_blank" rel="noreferrer" className="eh-mono text-[10px] text-[var(--eh-green)] hover:underline flex items-center gap-1"><ExternalLink size={10} /> {selected.linked_order_id}</a>}
      </div>

      {linked && !editing ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <div className="eh-display text-2xl font-black eh-neon">{sym}{Number(selected.final_amount || 0).toLocaleString('en-IN')}</div>
            <div className="eh-mono text-[10px] opacity-60">{selected.final_currency}</div>
          </div>
          {selected.payment_note && <div className="eh-mono text-[11px] opacity-70 leading-5">{selected.payment_note}</div>}
          <div className="eh-mono text-[10px] opacity-50">// SENT {selected.payment_sent_at ? new Date(selected.payment_sent_at).toLocaleString() : ''}</div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(true)} data-testid="recovery-payment-edit" className="text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] flex items-center gap-1.5"><Edit3 size={11} /> UPDATE AMOUNT</button>
            <a href={`/track?id=${selected.linked_order_id}`} target="_blank" rel="noreferrer" className="text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] flex items-center gap-1.5"><ExternalLink size={11} /> VIEW PAYMENT</a>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="eh-mono text-[10px] opacity-70 leading-5">{linked ? 'Updating the amount keeps the same payment link active.' : 'Set the final quote and send the customer a payment link. This auto-creates a linked order and shows UPI/Crypto box on their /track page. Case auto-bumps to ENGAGED.'}</div>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 eh-mono text-sm opacity-60">{sym}</span>
              <input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} className="eh-input pl-7" placeholder="Final amount" data-testid="recovery-payment-amount" />
            </div>
            <select className="eh-input" value={currency} onChange={e => setCurrency(e.target.value)} data-testid="recovery-payment-currency">
              {['INR', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <textarea rows={2} className="eh-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Note for customer (optional) — e.g. Pay after we confirm recovery on call" data-testid="recovery-payment-note" />
          <div className="flex gap-2 flex-wrap">
            <button onClick={send} disabled={busy} className="eh-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50" data-testid="recovery-payment-send">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <TgIcon size={12} />} {busy ? 'SENDING…' : linked ? 'UPDATE REQUEST' : 'SEND PAYMENT REQUEST'}
            </button>
            {linked && <button onClick={() => setEditing(false)} className="text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)]">CANCEL</button>}
          </div>
        </div>
      )}
    </div>
  );
};

const ServicesTab = ({ cfg, setCfg }) => {
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState(cfg.services || []);

  useEffect(() => { setServices(cfg.services || []); }, [cfg.services]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.recoveryConfigUpdate({ services });
      setCfg(c => ({ ...c, services: r.recovery.services }));
      toast.success('Services saved');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const update = (idx, patch) => setServices(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const remove = (idx) => setServices(prev => prev.filter((_, i) => i !== idx));
  const add = () => setServices(prev => [...prev, { id: `s_${Date.now()}`, name: 'New service', issue_key: 'new', price_min: 999, price_max: 4999, eta_min_days: 1, eta_max_days: 7, success_rate: 90, bullets: ['Bullet 1'], active: true, sort: prev.length + 1 }]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="eh-mono text-xs opacity-70">{services.length} service(s)</div>
        <div className="flex gap-2">
          <button onClick={add} className="text-xs eh-mono px-3 py-2 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] flex items-center gap-1.5"><Plus size={12} /> ADD</button>
          <button onClick={save} disabled={busy} className="eh-btn-primary text-xs flex items-center gap-1.5"><Save size={12} /> {busy ? 'SAVING…' : 'SAVE ALL'}</button>
        </div>
      </div>
      <div className="space-y-3">
        {services.map((s, idx) => (
          <div key={s.id} className="eh-panel p-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><div className="eh-mono text-[10px] opacity-60 mb-1">NAME</div><input className="eh-input" value={s.name} onChange={e => update(idx, { name: e.target.value })} /></div>
              <div><div className="eh-mono text-[10px] opacity-60 mb-1">ISSUE KEY (slug)</div><input className="eh-input" value={s.issue_key} onChange={e => update(idx, { issue_key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })} /></div>
              <div><div className="eh-mono text-[10px] opacity-60 mb-1">PRICE MIN (INR)</div><input className="eh-input" type="number" value={s.price_min} onChange={e => update(idx, { price_min: Number(e.target.value) })} /></div>
              <div><div className="eh-mono text-[10px] opacity-60 mb-1">PRICE MAX (INR)</div><input className="eh-input" type="number" value={s.price_max} onChange={e => update(idx, { price_max: Number(e.target.value) })} /></div>
              <div><div className="eh-mono text-[10px] opacity-60 mb-1">ETA MIN DAYS</div><input className="eh-input" type="number" value={s.eta_min_days} onChange={e => update(idx, { eta_min_days: Number(e.target.value) })} /></div>
              <div><div className="eh-mono text-[10px] opacity-60 mb-1">ETA MAX DAYS</div><input className="eh-input" type="number" value={s.eta_max_days} onChange={e => update(idx, { eta_max_days: Number(e.target.value) })} /></div>
              <div><div className="eh-mono text-[10px] opacity-60 mb-1">SUCCESS %</div><input className="eh-input" type="number" min={0} max={100} value={s.success_rate} onChange={e => update(idx, { success_rate: Number(e.target.value) })} /></div>
              <div><div className="eh-mono text-[10px] opacity-60 mb-1">SORT</div><input className="eh-input" type="number" value={s.sort || 0} onChange={e => update(idx, { sort: Number(e.target.value) })} /></div>
              <div>
                <div className="eh-mono text-[10px] opacity-60 mb-1">TAG BADGE (animated label on tile)</div>
                <select className="eh-input" value={s.tag || ''} onChange={e => update(idx, { tag: e.target.value })} data-testid={`svc-tag-${idx}`}>
                  <option value="">— No badge —</option>
                  <option value="PREMIUM">✦ PREMIUM (gold sparkle)</option>
                  <option value="HOT">🔥 HOT (orange flame)</option>
                  <option value="NEW">● NEW (green pulse)</option>
                  <option value="BESTSELLER">★ BESTSELLER (purple sparkles)</option>
                  <option value="LIMITED">⚡ LIMITED (cyan flash)</option>
                  <option value="FAST">⚡ FAST (lightning)</option>
                  <option value="SECURE">🛡 SECURE (shield glow)</option>
                </select>
              </div>
              <div className="sm:col-span-2"><div className="eh-mono text-[10px] opacity-60 mb-1">BULLETS (one per line)</div><textarea rows={3} className="eh-textarea" value={(s.bullets || []).join('\n')} onChange={e => update(idx, { bullets: e.target.value.split('\n').filter(Boolean) })} /></div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--eh-border)]">
              <label className="flex items-center gap-2 text-xs eh-mono cursor-pointer">
                <input type="checkbox" checked={s.active !== false} onChange={e => update(idx, { active: e.target.checked })} /> ACTIVE (shown publicly)
              </label>
              <button onClick={() => remove(idx)} className="text-xs eh-mono text-red-400 hover:text-red-300 flex items-center gap-1.5"><Trash2 size={12} /> DELETE</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReviewsTab = ({ cfg }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending | approved | all
  const [draft, setDraft] = useState({ name: '', handle: '', avatar_url: '', quote: '', rating: 5, service_key: '', approved: true, sort: 0 });

  const load = async () => {
    setLoading(true);
    try { setRows(await api.recoveryListReviewsAll()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.name.trim() || !draft.quote.trim()) { toast.error('Name and quote are required'); return; }
    try {
      const r = await api.recoveryCreateReview(draft);
      setRows(prev => [r, ...prev]);
      setDraft({ name: '', handle: '', avatar_url: '', quote: '', rating: 5, service_key: '', approved: true, sort: 0 });
      toast.success('Review added');
    } catch (e) { toast.error(e.message); }
  };

  const patch = async (id, p) => {
    try {
      const r = await api.recoveryUpdateReview(id, p);
      setRows(prev => prev.map(x => x.id === id ? r : x));
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    try { await api.recoveryDeleteReview(id); setRows(prev => prev.filter(x => x.id !== id)); toast.success('Deleted'); }
    catch (e) { toast.error(e.message); }
  };

  const pendingCount = rows.filter(r => !r.approved).length;
  const approvedCount = rows.filter(r => r.approved).length;
  const filtered = filter === 'all' ? rows : filter === 'pending' ? rows.filter(r => !r.approved) : rows.filter(r => r.approved);

  return (
    <div>
      <div className="eh-panel p-4 mb-5">
        <div className="eh-mono text-xs opacity-70 mb-3 tracking-widest">// ADD NEW REVIEW (manual / pre-seeded)</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="eh-input" placeholder="Name (e.g. Laura P)" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          <input className="eh-input" placeholder="Handle / Title (e.g. @cybergirl or 'Founder, PowerBolt')" value={draft.handle} onChange={e => setDraft({ ...draft, handle: e.target.value })} />
          <input className="eh-input" placeholder="Avatar URL (optional)" value={draft.avatar_url} onChange={e => setDraft({ ...draft, avatar_url: e.target.value })} />
          <select className="eh-input" value={draft.service_key} onChange={e => setDraft({ ...draft, service_key: e.target.value })}>
            <option value="">— All services —</option>
            {(cfg.services || []).map(s => <option key={s.id} value={s.issue_key}>{s.name}</option>)}
          </select>
          <textarea rows={3} className="eh-textarea sm:col-span-2" placeholder="Quote / testimonial text" value={draft.quote} onChange={e => setDraft({ ...draft, quote: e.target.value })} />
          <div>
            <div className="eh-mono text-[10px] opacity-60 mb-1">RATING</div>
            <select className="eh-input" value={draft.rating} onChange={e => setDraft({ ...draft, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
            </select>
          </div>
          <div>
            <div className="eh-mono text-[10px] opacity-60 mb-1">SORT</div>
            <input className="eh-input" type="number" value={draft.sort} onChange={e => setDraft({ ...draft, sort: Number(e.target.value) })} />
          </div>
        </div>
        <button onClick={add} className="eh-btn-primary text-xs mt-3 flex items-center gap-1.5"><Plus size={12} /> ADD REVIEW</button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('pending')} data-testid="admin-reviews-filter-pending" className={`text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border ${filter === 'pending' ? 'border-[#ffd34d] text-[#ffd34d] bg-[rgba(255,211,77,.08)]' : 'border-[var(--eh-border)]'}`}>
          PENDING ({pendingCount}){pendingCount > 0 && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#ffd34d] animate-pulse" />}
        </button>
        <button onClick={() => setFilter('approved')} className={`text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border ${filter === 'approved' ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)]'}`}>APPROVED ({approvedCount})</button>
        <button onClick={() => setFilter('all')} className={`text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border ${filter === 'all' ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)]'}`}>ALL ({rows.length})</button>
      </div>

      {loading ? <div className="text-center py-10"><Loader2 className="animate-spin inline-block" /></div> : (
        <div className="space-y-3">
          {filtered.length === 0 && <div className="eh-panel p-10 text-center eh-mono text-xs opacity-60">No reviews in this view.</div>}
          {filtered.map(r => (
            <div key={r.id} className={`eh-panel p-4 ${!r.approved ? 'border-l-2 border-l-[#ffd34d]' : ''}`} data-testid={`admin-review-${r.id}`}>
              <div className="flex gap-3 items-start">
                {r.avatar_url ? <img src={r.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" /> : <div className="w-10 h-10 rounded-full grid place-items-center text-sm eh-mono shrink-0" style={{ background: 'rgba(0,255,157,.15)', color: 'var(--eh-green)' }}>{(r.name || 'A')[0].toUpperCase()}</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-bold text-sm">{r.name}</div>
                    {r.handle && <div className="eh-mono text-[10px] opacity-60">{r.handle}</div>}
                    <div className="flex gap-0.5 text-[var(--eh-green)]">{Array.from({ length: r.rating || 5 }).map((_, i) => <Star key={i} size={11} fill="currentColor" />)}</div>
                    {r.source === 'customer' && <span className="eh-mono text-[9px] tracking-widest px-1.5 py-0.5 rounded bg-[rgba(77,224,255,.15)] text-[#4de0ff] flex items-center gap-1"><BadgeCheck size={10} /> CUSTOMER</span>}
                    {r.case_id && <a href={`/track?id=${r.case_id}`} target="_blank" rel="noreferrer" className="eh-mono text-[9px] opacity-60 hover:opacity-100 underline">{r.case_id}</a>}
                  </div>
                  <div className="text-sm opacity-90 mt-1 leading-6">"{r.quote}"</div>
                  {!!(r.media_urls || []).length && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mt-2 max-w-md">
                      {r.media_urls.map((m, i) => (
                        <a key={i} href={m.url} target="_blank" rel="noreferrer" className="block aspect-square rounded overflow-hidden border border-[var(--eh-border)] bg-black/40 relative group">
                          {m.kind === 'video' ? (
                            <>
                              <video src={m.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 grid place-items-center bg-black/30 group-hover:bg-black/10"><ImageIcon size={14} className="text-white" /></div>
                            </>
                          ) : (
                            <img src={m.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="eh-mono text-[10px] opacity-50 mt-2">{r.service_key || 'all services'} · sort {r.sort || 0}{r.email ? ` · ${r.email}` : ''} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => patch(r.id, { approved: !r.approved })} data-testid={`admin-review-approve-${r.id}`} className={`text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border flex items-center justify-center gap-1.5 ${r.approved ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[#ffd34d] text-[#ffd34d] hover:bg-[rgba(255,211,77,.08)]'}`}>
                    {r.approved ? <><Check size={11} /> APPROVED</> : <><Eye size={11} /> APPROVE</>}
                  </button>
                  <button onClick={() => remove(r.id)} className="text-[10px] eh-mono text-red-400 hover:text-red-300 px-3 py-1.5 rounded border border-red-400/30 flex items-center justify-center gap-1.5"><Trash2 size={11} /> DELETE</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatsTab = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.recoveryStats().then(setStats).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="text-center py-10"><Loader2 className="animate-spin inline-block" /></div>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="eh-panel p-5"><div className="eh-mono text-[10px] opacity-60 tracking-widest">TOTAL CASES</div><div className="eh-display text-3xl font-black eh-neon mt-2">{stats.total || 0}</div></div>
      <div className="eh-panel p-5"><div className="eh-mono text-[10px] opacity-60 tracking-widest">RECOVERED</div><div className="eh-display text-3xl font-black eh-neon mt-2">{stats.recovered || 0}</div></div>
      <div className="eh-panel p-5"><div className="eh-mono text-[10px] opacity-60 tracking-widest">THIS WEEK</div><div className="eh-display text-3xl font-black mt-2">{stats.weekly_recovered || 0}</div></div>
      <div className="eh-panel p-5"><div className="eh-mono text-[10px] opacity-60 tracking-widest">SUCCESS RATE</div><div className="eh-display text-3xl font-black mt-2">{stats.success_rate || 0}%</div></div>
    </div>
  );
};

const HeroTab = ({ cfg, setCfg }) => {
  const [hero, setHero] = useState(cfg.hero || {});
  const [trust, setTrust] = useState(cfg.trust || {});
  const [busy, setBusy] = useState(false);

  useEffect(() => { setHero(cfg.hero || {}); setTrust(cfg.trust || {}); }, [cfg.hero, cfg.trust]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.recoveryConfigUpdate({ hero, trust });
      setCfg(c => ({ ...c, hero: r.recovery.hero, trust: r.recovery.trust }));
      toast.success('Hero & trust saved');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="eh-panel p-5">
        <div className="eh-mono text-xs opacity-70 mb-3 tracking-widest">// HERO</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">KICKER</div><input className="eh-input" value={hero.kicker || ''} onChange={e => setHero({ ...hero, kicker: e.target.value })} /></div>
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">TELEGRAM URL</div><input className="eh-input" value={hero.telegram_url || ''} onChange={e => setHero({ ...hero, telegram_url: e.target.value })} placeholder="https://t.me/yourhandle" /></div>
          <div className="sm:col-span-2"><div className="eh-mono text-[10px] opacity-60 mb-1">HEADLINE</div><input className="eh-input" value={hero.title || ''} onChange={e => setHero({ ...hero, title: e.target.value })} /></div>
          <div className="sm:col-span-2"><div className="eh-mono text-[10px] opacity-60 mb-1">SUBTITLE</div><textarea rows={3} className="eh-textarea" value={hero.subtitle || ''} onChange={e => setHero({ ...hero, subtitle: e.target.value })} /></div>
        </div>
      </div>
      <div className="eh-panel p-5">
        <div className="eh-mono text-xs opacity-70 mb-3 tracking-widest">// TRUST SIGNALS</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">CLAIMED RECOVERED TOTAL (boost)</div><input className="eh-input" type="number" value={trust.claim_recovered_total || 0} onChange={e => setTrust({ ...trust, claim_recovered_total: Number(e.target.value) })} /></div>
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">AVG ETA TEXT</div><input className="eh-input" value={trust.avg_eta || ''} onChange={e => setTrust({ ...trust, avg_eta: e.target.value })} /></div>
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">ENCRYPTION TEXT</div><input className="eh-input" value={trust.encryption || ''} onChange={e => setTrust({ ...trust, encryption: e.target.value })} /></div>
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">GUARANTEE TEXT</div><input className="eh-input" value={trust.guarantee || ''} onChange={e => setTrust({ ...trust, guarantee: e.target.value })} /></div>
        </div>
      </div>
      <button onClick={save} disabled={busy} className="eh-btn-primary text-xs flex items-center gap-1.5"><Save size={12} /> {busy ? 'SAVING…' : 'SAVE HERO & TRUST'}</button>
    </div>
  );
};

const RecoveryManager = () => {
  const [active, setActive] = useState('cases');
  const [cfg, setCfg] = useState({ services: [], platforms: [], hero: {}, trust: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.recoveryConfig().then(setCfg).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center"><Loader2 className="animate-spin inline-block" /></div>;

  return (
    <div>
      <div className="mb-5">
        <div className="eh-kicker mb-2">// RECOVERY</div>
        <h2 className="eh-display text-2xl md:text-3xl font-black">Account Recovery Desk</h2>
        <p className="text-sm opacity-70 mt-1">Manage incoming recovery cases, services, reviews, and trust signals.</p>
      </div>
      <Tabs active={active} setActive={setActive} />
      {active === 'cases' && <CasesTab />}
      {active === 'services' && <ServicesTab cfg={cfg} setCfg={setCfg} />}
      {active === 'reviews' && <ReviewsTab cfg={cfg} />}
      {active === 'stats' && <StatsTab />}
      {active === 'hero' && <HeroTab cfg={cfg} setCfg={setCfg} />}
    </div>
  );
};

export default RecoveryManager;
