import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Send, Mail, Users, Sparkles, CheckCircle2, X, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

/**
 * Admin: New-Tool / Update Announcements
 * Creates an announcement, fires Telegram broadcast + Resend email blast.
 * Audience: all | wallet (balance > 0) | paying (has at least 1 paid order).
 */

const TOOL_OPTIONS = [
  ['',                'No tool — generic update'],
  ['diagnose',        'Issue Checker'],
  ['breach',          'Breach Checker'],
  ['odds',            'Recovery Odds'],
  ['phishing',        'Phishing Detector'],
  ['appeal',          'Appeal Generator'],
  ['security-score',  'Security Score'],
  ['account-worth',   'Account Worth'],
  ['selfie-coach',    'Selfie Prep Coach'],
];

const fmtTs = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || ''; } };

const AnnouncementsManager = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);  // audience size preview before blast
  const [form, setForm] = useState({
    title: '',
    body: '',
    link: '',
    tool_id: '',
    audience: 'all',
    send_telegram: true,
    send_email: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.adminListAnnouncements();
      setList(rows || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const onToolChange = (tid) => {
    const link = tid ? `/tools/${tid}` : '';
    setForm(f => ({ ...f, tool_id: tid, link: link || f.link }));
  };

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    // Step 1 — fetch audience preview (no blast yet)
    setBusy(true);
    try {
      const p = await api.adminAnnouncementAudience(form.audience);
      setPreview(p);
    } catch (e) {
      toast.error(e.message || 'Could not load audience preview');
    } finally {
      setBusy(false);
    }
  };

  const confirmBlast = async () => {
    setBusy(true);
    try {
      const created = await api.adminCreateAnnouncement(form);
      toast.success(`Blast queued · sending to ${(preview?.telegram_reachable || 0)} TG + ${(preview?.email_reachable || 0)} email in background`);
      setShowForm(false);
      setPreview(null);
      setForm({ title: '', body: '', link: '', tool_id: '', audience: 'all', send_telegram: true, send_email: true });
      // counters arrive as the background task completes — reload twice
      load();
      setTimeout(load, 3500);
      setTimeout(load, 12000);
      return created;
    } catch (e) {
      toast.error(e.message || 'Failed to send');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this announcement record? (does not unsend the broadcast)')) return;
    try {
      await api.adminDeleteAnnouncement(id);
      load();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="eh-kicker mb-2">// ANNOUNCEMENTS</div>
          <h2 className="eh-display text-2xl md:text-3xl font-black">Broadcast Center</h2>
          <p className="text-sm opacity-65 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Push tool launches & site updates to every linked Telegram user + every opted-in email.
          </p>
        </div>
        <button
          data-testid="ann-new-btn"
          onClick={() => setShowForm(true)}
          className="eh-btn-primary text-xs"
        >
          <Plus size={14} /> NEW ANNOUNCEMENT
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="eh-panel p-8 text-center opacity-60 eh-mono text-sm">
          <Loader2 className="inline animate-spin mr-2" size={14} /> loading…
        </div>
      ) : list.length === 0 ? (
        <div className="eh-panel p-10 text-center">
          <Megaphone size={32} className="mx-auto opacity-30 mb-3" />
          <div className="text-sm opacity-60" style={{ fontFamily: 'Inter, sans-serif' }}>
            No announcements yet. Hit <strong>NEW ANNOUNCEMENT</strong> to send your first one.
          </div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="ann-list">
          {list.map(a => (
            <div key={a.id} className="eh-panel p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm sm:text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{a.title}</div>
                  <div className="eh-mono text-[10px] opacity-50 mt-0.5">{fmtTs(a.created_at)} · {a.audience || 'all'}{a.tool_id ? ` · /${a.tool_id}` : ''}</div>
                </div>
                <button onClick={() => remove(a.id)} data-testid={`ann-del-${a.id}`} className="opacity-50 hover:opacity-100 hover:text-[#ff3148] p-1">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-[13px] opacity-80 leading-relaxed mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{a.body}</p>
              <div className="flex flex-wrap gap-2 eh-mono text-[10px] tracking-widest">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[var(--eh-border)]">
                  <Send size={10} /> TG {a.tg_sent || 0}/{(a.tg_sent || 0) + (a.tg_failed || 0)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[var(--eh-border)]">
                  <Mail size={10} /> EMAIL {a.email_sent || 0}/{(a.email_sent || 0) + (a.email_failed || 0)}
                </span>
                {a.link && (
                  <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[var(--eh-border)] hover:border-[var(--eh-green)]">
                    {a.link}
                  </a>
                )}
                {a.status === 'sent' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.4)' }}>
                    <CheckCircle2 size={10} /> SENT
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto" onClick={() => !busy && setShowForm(false)}>
          <div className="w-full max-w-xl eh-panel eh-brackets p-5 sm:p-7 my-6" onClick={e => e.stopPropagation()}>
            <span className="br-bl" /><span className="br-br" />
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="eh-kicker mb-1">// NEW</div>
                <h3 className="eh-display text-xl font-black">Send Announcement</h3>
              </div>
              <button onClick={() => !busy && setShowForm(false)} className="opacity-60 hover:opacity-100"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Tool (optional — marks as NEW + auto-fills link)</label>
                <select data-testid="ann-tool" className="eh-input" value={form.tool_id} onChange={e => onToolChange(e.target.value)}>
                  {TOOL_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Title</label>
                <input
                  data-testid="ann-title"
                  className="eh-input"
                  placeholder="e.g. 🔥 New tool: Phishing Detector — paste any sus DM"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Body</label>
                <textarea
                  data-testid="ann-body"
                  rows={4}
                  className="eh-textarea"
                  placeholder="2–4 lines. Plain text. Use \n for line breaks."
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                />
              </div>
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Link (CTA)</label>
                <input
                  data-testid="ann-link"
                  className="eh-input"
                  placeholder="/tools/phishing  or  https://errorhacker.site/..."
                  value={form.link}
                  onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                />
              </div>
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Audience</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['all',    'Everyone',     Users],
                    ['wallet', 'Wallet holders', Sparkles],
                    ['paying', 'Paid customers', CheckCircle2],
                  ].map(([v, l, I]) => (
                    <button
                      key={v}
                      type="button"
                      data-testid={`ann-aud-${v}`}
                      onClick={() => setForm(f => ({ ...f, audience: v }))}
                      className={`eh-mono text-[10px] tracking-widest py-2.5 rounded border inline-flex flex-col items-center gap-1 ${form.audience === v ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
                    >
                      <I size={13} />
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="ann-send-tg"
                  onClick={() => setForm(f => ({ ...f, send_telegram: !f.send_telegram }))}
                  className={`eh-mono text-[11px] tracking-widest py-2.5 rounded border inline-flex items-center justify-center gap-2 ${form.send_telegram ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
                >
                  <Send size={12} /> {form.send_telegram ? '✓ TELEGRAM' : 'TELEGRAM'}
                </button>
                <button
                  type="button"
                  data-testid="ann-send-email"
                  onClick={() => setForm(f => ({ ...f, send_email: !f.send_email }))}
                  className={`eh-mono text-[11px] tracking-widest py-2.5 rounded border inline-flex items-center justify-center gap-2 ${form.send_email ? 'bg-[var(--eh-green)] text-black border-[var(--eh-green)]' : 'bg-transparent border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}
                >
                  <Mail size={12} /> {form.send_email ? '✓ EMAIL' : 'EMAIL'}
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => !busy && setShowForm(false)} className="eh-btn-ghost flex-1 justify-center text-xs">CANCEL</button>
              <button data-testid="ann-submit" onClick={submit} disabled={busy} className="eh-btn-primary flex-1 justify-center text-xs" style={{ opacity: busy ? .7 : 1 }}>
                {busy ? <><Loader2 size={12} className="animate-spin" /> CHECKING…</> : <><Megaphone size={12} /> PREVIEW &amp; SEND</>}
              </button>
            </div>
            <p className="text-[10px] opacity-50 eh-mono mt-3 text-center">
              You&apos;ll see exact audience size before anything goes out.
            </p>
          </div>
        </div>
      )}

      {/* Audience preview / confirm modal */}
      {preview && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => !busy && setPreview(null)}>
          <div className="w-full max-w-md eh-panel eh-brackets p-5 sm:p-7" onClick={e => e.stopPropagation()} data-testid="ann-preview-modal">
            <span className="br-bl" /><span className="br-br" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(255,211,77,.08)', border: '1px solid rgba(255,211,77,.4)' }}>
                <AlertTriangle size={22} color="#ffd34d" />
              </div>
              <div>
                <div className="eh-kicker mb-1">// CONFIRM BLAST</div>
                <h3 className="eh-display text-lg font-black leading-tight">This will reach real users</h3>
              </div>
            </div>
            <div className="space-y-2 rounded-lg p-4 bg-[#0d1115] border border-[var(--eh-border)] mb-4">
              <div className="flex items-center justify-between text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                <span className="opacity-70">Audience</span>
                <span className="eh-mono font-bold">{(preview.audience || 'all').toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70 inline-flex items-center gap-1.5"><Users size={13} /> Total matched</span>
                <span className="eh-mono font-bold">{preview.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70 inline-flex items-center gap-1.5"><Send size={13} /> Telegram reachable</span>
                <span className="eh-mono font-bold" data-testid="ann-preview-tg">{form.send_telegram ? preview.telegram_reachable : 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70 inline-flex items-center gap-1.5"><Mail size={13} /> Email reachable</span>
                <span className="eh-mono font-bold" data-testid="ann-preview-email">{form.send_email ? preview.email_reachable : 0}</span>
              </div>
            </div>
            {(preview.total === 0 || ((form.send_telegram ? preview.telegram_reachable : 0) + (form.send_email ? preview.email_reachable : 0) === 0)) ? (
              <p className="text-[12px] opacity-70 mb-4 eh-mono leading-relaxed">
                · 0 reachable recipients — toggle Telegram/Email or pick a different audience.
              </p>
            ) : (
              <p className="text-[12px] opacity-70 mb-4 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                Once you confirm, the blast runs in the background. Email opt-outs are skipped automatically.
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => !busy && setPreview(null)} className="eh-btn-ghost flex-1 justify-center text-xs">BACK TO EDIT</button>
              <button
                data-testid="ann-confirm"
                onClick={confirmBlast}
                disabled={busy || ((form.send_telegram ? preview.telegram_reachable : 0) + (form.send_email ? preview.email_reachable : 0) === 0)}
                className="eh-btn-primary flex-1 justify-center text-xs"
                style={{ opacity: busy ? .7 : 1 }}
              >
                {busy ? <><Loader2 size={12} className="animate-spin" /> SENDING…</> : <><Megaphone size={12} /> CONFIRM &amp; BLAST</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsManager;
