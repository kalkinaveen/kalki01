import React, { useEffect, useState } from 'react';
import { Copy, Check, Upload, Loader2, CreditCard, Bitcoin } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

const PaymentBox = ({ order, onUpdated }) => {
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('manual');
  const [coin, setCoin] = useState(null);
  const [txRef, setTxRef] = useState('');
  const [proof, setProof] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.getPaymentSettings().then(s => {
      setSettings(s);
      if (s.crypto_wallets?.length) setCoin(s.crypto_wallets[0].coin);
      if (!s.manual_enabled && s.crypto_enabled) setTab('crypto');
    }).catch(() => {});
  }, []);

  if (!settings) return null;
  if (!settings.manual_enabled && !settings.crypto_enabled) return null;
  if (['delivered', 'paid', 'verified', 'in-progress'].includes(order.status)) return null;

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied');
    setTimeout(() => setCopied(''), 1500);
  };

  const handleUpload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Image only'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      // Public upload via order-scoped endpoint would be ideal; use admin uploads if logged in. Fallback: prompt user to paste link.
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/uploads`, { method: 'POST', body: fd, headers: { 'X-Admin-Token': '' } });
      if (!res.ok) throw new Error('Upload not allowed publicly. Please paste a screenshot URL instead.');
      const j = await res.json();
      setProof(`${process.env.REACT_APP_BACKEND_URL}${j.url}`);
      toast.success('Uploaded');
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!txRef && !proof) { toast.error('Add transaction reference or proof'); return; }
    setSubmitting(true);
    try {
      const updated = await api.submitPaymentProof({
        order_id: order.id,
        method: tab,
        coin: tab === 'crypto' ? coin : '',
        tx_reference: txRef,
        proof_url: proof,
      });
      toast.success('Payment submitted. We will verify within 30 min.');
      onUpdated?.(updated);
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const activeWallet = (settings.crypto_wallets || []).find(w => w.coin === coin);

  return (
    <div className="eh-panel eh-brackets p-5 sm:p-6 mt-6" data-testid="payment-box">
      <span className="br-bl" /><span className="br-br" />
      <div className="eh-kicker mb-4">// COMPLETE_PAYMENT</div>
      <div className="flex gap-2 mb-4">
        {settings.manual_enabled && (
          <button onClick={() => setTab('manual')} data-testid="pay-tab-manual" className={`flex items-center gap-2 px-4 py-2 rounded eh-mono text-xs tracking-widest ${tab==='manual' ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}><CreditCard size={12} /> UPI / BANK</button>
        )}
        {settings.crypto_enabled && (
          <button onClick={() => setTab('crypto')} data-testid="pay-tab-crypto" className={`flex items-center gap-2 px-4 py-2 rounded eh-mono text-xs tracking-widest ${tab==='crypto' ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}><Bitcoin size={12} /> CRYPTO</button>
        )}
      </div>

      {tab === 'manual' && (
        <div className="space-y-3">
          {settings.upi_id && (
            <div className="flex items-center justify-between gap-3 p-3 border border-[var(--eh-border)] rounded">
              <div>
                <div className="eh-mono text-[10px] opacity-60">UPI ID</div>
                <div className="eh-mono text-sm font-bold eh-neon-soft">{settings.upi_id}</div>
                {settings.upi_name && <div className="eh-mono text-[10px] opacity-60">→ {settings.upi_name}</div>}
              </div>
              <button onClick={() => copy(settings.upi_id, 'upi')} className="eh-btn-ghost text-xs">{copied === 'upi' ? <Check size={12} /> : <Copy size={12} />} COPY</button>
            </div>
          )}
          {settings.qr_image_url && (
            <div className="text-center">
              <img src={settings.qr_image_url} alt="QR" className="mx-auto max-w-[200px] rounded border border-[var(--eh-border)]" />
              <div className="eh-mono text-[10px] opacity-60 mt-1">scan to pay</div>
            </div>
          )}
          {settings.bank_details && (
            <div className="p-3 border border-[var(--eh-border)] rounded">
              <div className="eh-mono text-[10px] opacity-60 mb-1">BANK DETAILS</div>
              <pre className="eh-mono text-xs whitespace-pre-wrap leading-6">{settings.bank_details}</pre>
            </div>
          )}
          {settings.instructions && <div className="eh-mono text-[11px] opacity-80 leading-6 p-3 border border-dashed border-[var(--eh-border)] rounded">{settings.instructions}</div>}
        </div>
      )}

      {tab === 'crypto' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(settings.crypto_wallets || []).map(w => (
              <button key={w.coin} onClick={() => setCoin(w.coin)} className={`px-3 py-1.5 rounded eh-mono text-xs tracking-widest ${coin === w.coin ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>{w.coin}</button>
            ))}
          </div>
          {activeWallet && (
            <>
              <div className="p-3 border border-[var(--eh-border)] rounded">
                <div className="flex items-center justify-between mb-1">
                  <div className="eh-mono text-[10px] opacity-60">{activeWallet.coin} {activeWallet.network && `· ${activeWallet.network}`}</div>
                  <button onClick={() => copy(activeWallet.address, 'wallet')} className="eh-btn-ghost text-[10px] py-1 px-2">{copied === 'wallet' ? <Check size={10} /> : <Copy size={10} />} COPY</button>
                </div>
                <div className="eh-mono text-xs break-all eh-neon-soft">{activeWallet.address}</div>
              </div>
              {activeWallet.qr_url && (
                <div className="text-center">
                  <img src={activeWallet.qr_url} alt={`${activeWallet.coin} QR`} className="mx-auto max-w-[200px] rounded border border-[var(--eh-border)]" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="space-y-2 mt-4 border-t border-[var(--eh-border)] pt-4">
        <div className="eh-mono text-xs tracking-widest opacity-70">SUBMIT PROOF</div>
        <input value={txRef} onChange={e => setTxRef(e.target.value)} data-testid="pay-tx-ref" placeholder="> Transaction reference / UTR / TXID" className="eh-input text-sm" />
        <div className="flex gap-2 items-stretch">
          <input value={proof} onChange={e => setProof(e.target.value)} data-testid="pay-proof-url" placeholder="> screenshot URL (or upload →)" className="flex-1 eh-input text-sm" />
          <label className="eh-btn-ghost text-xs cursor-pointer whitespace-nowrap px-3">
            {uploading ? <><Loader2 className="animate-spin" size={12} /> UP</> : <><Upload size={12} /> UPLOAD</>}
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
        {proof && <img src={proof} alt="proof" className="max-h-32 rounded border border-[var(--eh-border)]" onError={e => e.target.style.display='none'} />}
        <button onClick={submit} disabled={submitting} data-testid="pay-submit" className="eh-btn-primary text-xs w-full justify-center mt-2">{submitting ? 'SUBMITTING...' : 'I HAVE PAID — SUBMIT'}</button>
      </div>
    </div>
  );
};

export default PaymentBox;
