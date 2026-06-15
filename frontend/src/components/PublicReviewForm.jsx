import React, { useState } from 'react';
import { Star, Upload, X, Loader2, CheckCircle2, Send, Play, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

/**
 * Public "Leave a review" form — open to anyone, no login or case required.
 * - Star rating + 20+ char review text + optional handle + optional media (up to 3)
 * - Submissions saved with approved=false, must be admin-approved before going public
 * - Floating "Leave a Review" CTA that expands into the form when tapped
 */
const PublicReviewForm = ({ services = [] }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ rating: 5, quote: '', name: '', handle: '', service_key: '', media_urls: [] });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const upload = async (file) => {
    const max = file.type.startsWith('video/') ? 25 : 5;
    if (file.size > max * 1024 * 1024) {
      toast.error('File too large', { description: `Max ${max}MB` });
      return;
    }
    setUploading(true);
    try {
      const r = await api.recoveryUploadReviewMedia(file);
      setDraft(d => ({ ...d, media_urls: [...d.media_urls, { url: r.absoluteUrl, kind: r.kind, content_type: r.content_type }] }));
    } catch (e) { toast.error('Upload failed', { description: e.message }); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!draft.name.trim()) { toast.error('Please add your name'); return; }
    if (draft.quote.trim().length < 20) {
      toast.error('Please write at least 20 characters about your experience');
      return;
    }
    setSubmitting(true);
    try {
      await api.recoverySubmitPublicReview({
        name: draft.name.trim(),
        handle: draft.handle.trim(),
        quote: draft.quote.trim(),
        rating: draft.rating,
        service_key: draft.service_key || '',
        media_urls: draft.media_urls,
        // these fields exist on the schema but aren't relevant for public reviews:
        avatar_url: '', sort: 0, approved: false,
      });
      setDone(true);
      toast.success('Review submitted!', { description: 'Thanks! It will appear once our team approves it.' });
    } catch (e) {
      toast.error('Submission failed', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="text-center mt-8 mb-2">
        <button onClick={() => { setOpen(true); setDone(false); }} data-testid="public-review-open" className="eh-btn-primary text-xs sm:text-sm inline-flex items-center gap-2 px-5 py-3">
          <MessageSquare size={14} /> LEAVE A REVIEW
          <Sparkles size={12} className="text-[#ffd34d] rwh-sparkle-icon" />
        </button>
        <div className="eh-mono text-[10px] opacity-50 mt-2">Open to everyone — share your experience</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="eh-panel p-5 mt-8 bg-[rgba(0,255,157,.04)] border border-[rgba(0,255,157,.25)]" data-testid="public-review-done">
        <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={16} className="text-[var(--eh-green)]" /><div className="font-bold text-sm">Thanks for your review!</div></div>
        <div className="eh-mono text-[11px] opacity-70 leading-5 mb-3">Your testimonial is pending admin approval. Once approved it will appear publicly above.</div>
        <button onClick={() => { setOpen(false); setDraft({ rating: 5, quote: '', name: '', handle: '', service_key: '', media_urls: [] }); }} className="eh-btn-ghost text-xs">CLOSE</button>
      </div>
    );
  }

  return (
    <div className="eh-panel p-5 sm:p-6 mt-8" data-testid="public-review-form">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="eh-kicker mb-1">// LEAVE A PUBLIC REVIEW</div>
          <h3 className="font-black text-xl sm:text-2xl" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>Share your story</h3>
          <p className="eh-mono text-[11px] opacity-70 mt-1 leading-5">Open to everyone. Reviews go live after a quick admin review.</p>
        </div>
        <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100" data-testid="public-review-close"><X size={18} /></button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">RATING</div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setDraft(d => ({ ...d, rating: n }))} className="p-1 transition-transform hover:scale-110" data-testid={`public-review-star-${n}`}>
                <Star size={28} fill={n <= draft.rating ? 'var(--eh-green)' : 'transparent'} className={n <= draft.rating ? 'text-[var(--eh-green)]' : 'text-[var(--eh-border)]'} />
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">YOUR NAME *</div>
            <input className="eh-input" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Laura P." data-testid="public-review-name" />
          </div>
          <div>
            <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">HANDLE / TITLE (optional)</div>
            <input className="eh-input" value={draft.handle} onChange={e => setDraft(d => ({ ...d, handle: e.target.value }))} placeholder="@yourhandle or Founder, X" data-testid="public-review-handle" />
          </div>
        </div>

        {services.length > 0 && (
          <div>
            <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">WHICH SERVICE? (optional)</div>
            <select className="eh-input" value={draft.service_key} onChange={e => setDraft(d => ({ ...d, service_key: e.target.value }))} data-testid="public-review-service">
              <option value="">— Any / General —</option>
              {services.filter(s => s.active !== false).map(s => <option key={s.id} value={s.issue_key}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">YOUR REVIEW (20+ chars) *</div>
          <textarea rows={4} className="eh-textarea" value={draft.quote} onChange={e => setDraft(d => ({ ...d, quote: e.target.value }))} placeholder="Honest, specific feedback helps others. e.g. They recovered my Instagram in 3 days after Meta rejected my appeals." data-testid="public-review-quote" />
          <div className="flex items-center justify-between mt-1">
            <div className="eh-mono text-[10px] opacity-50">{draft.quote.trim().length} / 20</div>
            {draft.quote.trim().length >= 20 && <div className="eh-mono text-[10px] text-[var(--eh-green)]">✓ READY</div>}
          </div>
        </div>

        <div>
          <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">PROOF (optional) · IMAGE (5MB) OR VIDEO (25MB) · UP TO 3</div>
          <label className={`eh-panel p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--eh-green)] border border-dashed border-[var(--eh-border)] rounded transition-colors ${draft.media_urls.length >= 3 ? 'opacity-50 pointer-events-none' : ''}`} data-testid="public-review-media-upload">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span className="eh-mono text-xs">{uploading ? 'Uploading…' : draft.media_urls.length >= 3 ? 'Max 3 files' : 'Add a screenshot or short video'}</span>
            <input type="file" accept="image/*,video/*" hidden disabled={uploading || draft.media_urls.length >= 3} onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (f) await upload(f);
            }} />
          </label>
          {!!draft.media_urls.length && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {draft.media_urls.map((m, i) => (
                <div key={i} className="relative aspect-square rounded overflow-hidden border border-[var(--eh-border)] bg-black/40">
                  {m.kind === 'video' ? (
                    <>
                      <video src={m.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 grid place-items-center bg-black/30 pointer-events-none"><Play size={20} className="text-white" fill="currentColor" /></div>
                    </>
                  ) : (
                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button type="button" onClick={() => setDraft(d => ({ ...d, media_urls: d.media_urls.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-full bg-black/70 text-white hover:bg-black"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 items-center pt-1">
          <button onClick={submit} disabled={submitting || draft.quote.trim().length < 20 || !draft.name.trim()} className="eh-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50" data-testid="public-review-submit-btn">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {submitting ? 'SUBMITTING…' : 'SUBMIT REVIEW'}
          </button>
          <button onClick={() => setOpen(false)} className="eh-btn-ghost text-xs">CANCEL</button>
        </div>
        <div className="eh-mono text-[10px] opacity-50 leading-5">// Your review goes live after admin approval. We don't share your email or IP.</div>
      </div>
    </div>
  );
};

export default PublicReviewForm;
