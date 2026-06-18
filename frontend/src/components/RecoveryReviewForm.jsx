import React, { useEffect, useState } from 'react';
import { Star, Upload, X, Loader2, CheckCircle2, Send, Play } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

/**
 * Customer-facing review submission flow, shown inside OrderTracker when
 * a recovery case reaches `recovered` or `closed` status.
 * - 1-to-5 star rating
 * - Quote text (required, min 20 chars)
 * - Optional name/handle override (prefilled from case)
 * - Up to 4 media uploads (image or video — proof of recovery)
 * - Submitted reviews start as `approved: false` and require admin approval.
 */
const RecoveryReviewForm = ({ caseId, onSubmitted }) => {
  const [state, setState] = useState({ loading: true, allowed: null });
  const [draft, setDraft] = useState({ rating: 5, quote: '', name: '', handle: '', media_urls: [] });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    api.recoveryCanReview(caseId)
      .then(r => { if (!alive) return; setState({ loading: false, allowed: r.can_review, info: r }); setDraft(d => ({ ...d, name: r.name || '' })); })
      .catch(() => alive && setState({ loading: false, allowed: false }));
    return () => { alive = false; };
  }, [caseId]);

  const upload = async (file) => {
    const max = file.type.startsWith('video/') ? 25 : 5;
    if (file.size > max * 1024 * 1024) {
      toast.error('File too large', { description: `Max ${max}MB for ${file.type.startsWith('video/') ? 'video' : 'image'}` });
      return;
    }
    setUploading(true);
    try {
      const r = await api.recoveryUploadReviewMedia(file);
      // Store relative path so links always resolve to the current host (errorhacker.site)
      setDraft(d => ({ ...d, media_urls: [...d.media_urls, { url: r.url, kind: r.kind, content_type: r.content_type }] }));
    } catch (e) { toast.error('Upload failed', { description: e.message }); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!draft.quote.trim() || draft.quote.trim().length < 20) {
      toast.error('Please write at least 20 characters about your experience');
      return;
    }
    setSubmitting(true);
    try {
      await api.recoverySubmitReview({
        case_id: caseId,
        name: (draft.name || state.info?.name || 'Customer').trim(),
        handle: draft.handle.trim(),
        quote: draft.quote.trim(),
        rating: draft.rating,
        service_key: state.info?.service_key || '',
        email: state.info?.email || '',
        media_urls: draft.media_urls,
      });
      setDone(true);
      toast.success('Review submitted!', { description: 'It will appear publicly once our team approves it.' });
      onSubmitted?.();
    } catch (e) {
      toast.error('Submission failed', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (state.loading) return null;
  if (state.allowed === false) {
    if (state.info?.already_submitted) {
      return (
        <div className="eh-panel p-5 mt-6 bg-[rgba(0,255,157,.04)] border border-[rgba(0,255,157,.25)]" data-testid="recovery-review-already">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={16} className="text-[var(--eh-green)]" /><div className="font-bold text-sm">Thanks for your review</div></div>
          <div className="eh-mono text-[11px] opacity-70 leading-5">Your testimonial is pending admin approval. Once approved it will appear in the public "From People Who Chose Recovery" section.</div>
        </div>
      );
    }
    return null;
  }
  if (done) {
    return (
      <div className="eh-panel p-5 mt-6 bg-[rgba(0,255,157,.04)] border border-[rgba(0,255,157,.25)]" data-testid="recovery-review-done">
        <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={16} className="text-[var(--eh-green)]" /><div className="font-bold text-sm">Review submitted</div></div>
        <div className="eh-mono text-[11px] opacity-70 leading-5">Pending approval — thanks for the love. We'll feature it as soon as our team verifies it.</div>
      </div>
    );
  }

  return (
    <div className="eh-panel p-5 sm:p-6 mt-6" data-testid="recovery-review-form">
      <div className="eh-kicker mb-2">// LEAVE A REVIEW</div>
      <h3 className="eh-display text-xl sm:text-2xl font-black mb-1">Your case is closed — help others choose us</h3>
      <p className="text-sm opacity-70 mb-5 leading-6">Drop a quick line about your recovery experience. Add a screenshot or short video as proof if you can. Reviews go live after admin approval.</p>

      <div className="space-y-4">
        <div>
          <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">RATING</div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setDraft(d => ({ ...d, rating: n }))} className="p-1 transition-transform hover:scale-110" data-testid={`review-star-${n}`}>
                <Star size={28} fill={n <= draft.rating ? 'var(--eh-green)' : 'transparent'} className={n <= draft.rating ? 'text-[var(--eh-green)]' : 'text-[var(--eh-border)]'} />
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">DISPLAY NAME</div>
            <input className="eh-input" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Laura P." data-testid="review-name" />
          </div>
          <div>
            <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">HANDLE / TITLE (optional)</div>
            <input className="eh-input" value={draft.handle} onChange={e => setDraft(d => ({ ...d, handle: e.target.value }))} placeholder="@yourhandle or Founder, X" data-testid="review-handle" />
          </div>
        </div>
        <div>
          <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">YOUR REVIEW (20+ chars)</div>
          <textarea rows={4} className="eh-textarea" value={draft.quote} onChange={e => setDraft(d => ({ ...d, quote: e.target.value }))} placeholder="Honest, specific feedback helps others. e.g. They recovered my Instagram in 3 days after Meta rejected my appeals. Pro-grade support on Telegram throughout." data-testid="review-quote" />
          <div className="flex items-center justify-between mt-1">
            <div className="eh-mono text-[10px] opacity-50">{draft.quote.trim().length} / 20</div>
            {draft.quote.trim().length >= 20 && <div className="eh-mono text-[10px] text-[var(--eh-green)]">✓ READY</div>}
          </div>
        </div>
        <div>
          <div className="eh-mono text-[10px] opacity-60 tracking-widest mb-1.5">PROOF (optional) · IMAGES (5MB) OR VIDEO (25MB) · UP TO 4</div>
          <label className={`eh-panel p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--eh-green)] border border-dashed border-[var(--eh-border)] rounded transition-colors ${draft.media_urls.length >= 4 ? 'opacity-50 pointer-events-none' : ''}`} data-testid="review-media-upload">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span className="eh-mono text-xs">{uploading ? 'Uploading…' : draft.media_urls.length >= 4 ? 'Max 4 files' : 'Add screenshot or short video'}</span>
            <input type="file" accept="image/*,video/*" hidden disabled={uploading || draft.media_urls.length >= 4} onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (f) await upload(f);
            }} />
          </label>
          {!!draft.media_urls.length && (
            <div className="grid grid-cols-4 gap-2 mt-2">
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
        <button onClick={submit} disabled={submitting || !draft.quote.trim() || draft.quote.trim().length < 20} className="eh-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50" data-testid="review-submit-btn">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {submitting ? 'SUBMITTING…' : 'SUBMIT REVIEW'}
        </button>
        <div className="eh-mono text-[10px] opacity-50 leading-5">// Your review will be visible publicly only after admin approval. Media is encrypted and used solely for verification.</div>
      </div>
    </div>
  );
};

export default RecoveryReviewForm;
