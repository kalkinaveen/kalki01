import React, { useState } from 'react';
import { Loader2, X, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

const RefundRequestModal = ({ order, onClose, onCreated }) => {
  const [reason, setReason] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setUploading(true);
    try {
      const r = await api.uploadImage(f);
      setProofUrl(r.url);
      toast.success('Proof uploaded');
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (reason.trim().length < 8) { toast.error('Reason must be at least 8 characters'); return; }
    setSubmitting(true);
    try {
      const r = await api.refundCreate({ order_id: order.id, reason: reason.trim(), proof_url: proofUrl });
      toast.success('Refund request submitted', { description: r.id });
      onCreated?.(r);
      onClose?.();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={onClose}>
      <div className="eh-panel p-5 sm:p-6 max-w-lg w-full" onClick={e => e.stopPropagation()} data-testid="refund-modal">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-[var(--eh-green)]" />
            <div>
              <div className="eh-mono text-[10px] opacity-60">// REQUEST REFUND</div>
              <div className="eh-display text-lg font-black">For order <span className="eh-neon-soft">{order.id}</span></div>
            </div>
          </div>
          <button onClick={onClose} className="eh-btn-ghost text-xs"><X size={12} /></button>
        </div>

        <p className="eh-mono text-[11px] opacity-70 leading-6 mb-4">
          ▸ Tell us what went wrong. If approved, your refund is credited <b className="text-[var(--eh-green)]">instantly to your wallet</b>. Track the status anytime at <code>/refund/{'<ID>'}</code> or via the Telegram bot.
        </p>

        <label className="eh-mono text-[10px] opacity-60 block mb-1.5">REASON (required)</label>
        <textarea
          rows={4}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="What didn't work for you? More detail = faster review."
          className="eh-textarea text-sm mb-3"
          data-testid="refund-reason"
        />

        <label className="eh-mono text-[10px] opacity-60 block mb-1.5">PROOF / SCREENSHOT (optional)</label>
        <div className="flex gap-2 items-center mb-4">
          <label className="eh-btn-ghost text-xs cursor-pointer inline-flex items-center gap-1.5" data-testid="refund-upload">
            <input type="file" accept="image/*" className="hidden" onChange={upload} />
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {uploading ? 'UPLOADING…' : 'UPLOAD'}
          </label>
          {proofUrl && <a href={proofUrl} target="_blank" rel="noreferrer" className="eh-mono text-[10px] text-[var(--eh-green)] hover:underline truncate flex-1">{proofUrl.split('/').pop()}</a>}
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-[var(--eh-border)]">
          <button onClick={onClose} className="eh-btn-ghost text-xs" data-testid="refund-cancel">CANCEL</button>
          <button onClick={submit} disabled={submitting || reason.trim().length < 8} className="eh-btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="refund-submit">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} {submitting ? 'SUBMITTING…' : 'SUBMIT REQUEST'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundRequestModal;
