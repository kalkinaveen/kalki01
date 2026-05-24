import React, { useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

/**
 * ImageInput — text URL input + native file upload that posts to /api/uploads
 * onChange(url) is called with the resulting URL (existing URL preserved if no upload).
 */
const ImageInput = ({ value, onChange, placeholder = '> https://... or upload', testid = 'image-input' }) => {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => fileRef.current?.click();
  const handle = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Please pick an image'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setBusy(true);
    try {
      const res = await api.uploadImage(f);
      onChange(res.absoluteUrl);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2 items-stretch" data-testid={testid}>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 bg-[rgba(0,255,157,.04)] eh-mono text-sm border border-[var(--eh-border)] focus:border-[var(--eh-green)] outline-none rounded-sm"
        data-testid={`${testid}-url`}
      />
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        className="eh-btn-ghost text-xs whitespace-nowrap px-3"
        data-testid={`${testid}-upload-btn`}
      >
        {busy ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
        {busy ? 'UPLOADING' : 'UPLOAD'}
      </button>
      {value && (
        <button type="button" onClick={() => onChange('')} className="eh-btn-ghost text-xs px-3" data-testid={`${testid}-clear-btn`}><X size={14} /></button>
      )}
      <input ref={fileRef} onChange={handle} type="file" accept="image/*" className="hidden" />
    </div>
  );
};

export default ImageInput;
