import React, { useEffect, useState } from 'react';
import { Copy, Check, Upload, Loader2, CreditCard, Bitcoin, Zap, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { openCashfreeCheckout } from '../lib/cashfree';

const PaymentBox = ({ order, onUpdated, autoScroll }) => {
  const [settings, setSettings] = useState(null);
  const [cf, setCf] = useState({ configured: false, mode: 'sandbox' });
  const [tab, setTab] = useState('cashfree');
  const [coin, setCoin] = useState(null);
  const [txRef, setTxRef] = useState('');
  const [proof, setProof] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState('');
  const boxRef = React.useRef(null);

  useEffect(() => {
    Promise.all([
      api.getPaymentSettings().catch(() => null),
      api.cashfreeConfig().catch(() => ({ configured: false })),
    ]).then(([s, c]) => {
      if (s) {
        setSettings(s);
        if (s.crypto_wallets?.length) setCoin(s.crypto_wallets[0].coin);
      }
      setCf(c);
      // Pick the default tab — prefer Cashfree if live, then manual, then crypto
      if (c.configured) setTab('cashfree');
      else if (s?.manual_enabled) setTab('manual');
      else if (s?.crypto_enabled) setTab('crypto');
    });
  }, []);

  // Auto-scroll into view when user lands here from an email "PAY NOW" link
  useEffect(() => {
    if (autoScroll && settings && boxRef.current) {
      const t = setTimeout(() => boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
      return () => clearTimeout(t);
    }
  }, [autoScroll, settings]);

  if (!settings) return null;
  const anyManual = settings.manual_enabled || settings.crypto_enabled;
  if (!cf.configured && !anyManual) return null;
  if (['delivered', 'paid', 'verified', 'in-progress'].includes(order.status)) return null;

  const amount = Number(order.payment_amount || order.amount || 0);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied');
    setTimeout(() => setCopied(''), 1500);
  };

  const payWithCashfree = async () => {
    if (amount <= 0) { toast.error('Awaiting quote — admin will send a price soon'); return; }
    setPaying(true);
    try {
      const r = await api.cashfreePayOrder(order.id, {});
      if (!r?.payment_session_id) throw new Error('Could not open checkout');
      try { sessionStorage.setItem('eh_payment_redirect', window.location.pathname); } catch {}
      await openCashfreeCheckout(r.payment_session_id);
    } catch (e) { toast.error(e.message || 'Cashfree error'); }
    finally { setPaying(false); }
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
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/recovery/reviews/upload-media`, { method: 'POST', body: fd });
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

  const TabBtn = ({ id, icon: Icon, label, recommended }) => (
    <button onClick={() => setTab(id)} data-testid={`pay-tab-${id}`} className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded eh-mono text-[11px] sm:text-xs tracking-widest transition-all ${tab === id ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)] hover:border-[rgba(0,255,157,.3)]'}`}>
      <Icon size={12} /> {label}
      {recommended && <span className="absolute -top-2 -right-1 eh-mono text-[8px] tracking-widest bg-[var(--eh-green)] text-black px-1.5 py-0.5 rounded-full font-bold">FAST</span>}
    </button>
  );

  return (
    <div ref={boxRef} className={`eh-panel eh-brackets p-5 sm:p-6 mt-6 ${autoScroll ? 'eh-pulse-once' : ''}`} data-testid="payment-box">
      <span className="br-bl" /><span className="br-br" />
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="eh-kicker">// COMPLETE_PAYMENT {amount > 0 && <span className="eh-neon-soft ml-2">· ₹{amount.toLocaleString('en-IN')}</span>}</div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {cf.configured && <TabBtn id="cashfree" icon={Zap} label="CARD / UPI" recommended />}
        {settings.manual_enabled && <TabBtn id="manual" icon={CreditCard} label="MANUAL UPI" />}
        {settings.crypto_enabled && <TabBtn id="crypto" icon={Bitcoin} label="CRYPTO" />}
      </div>

      {tab === 'cashfree' && (
        <div className="space-y-3" data-testid="pay-cashfree-pane">
          <div className="eh-panel p-4 border border-[rgba(0,255,157,.35)] bg-[rgba(0,255,157,.04)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0 bg-[rgba(0,255,157,.12)] border border-[rgba(0,255,157,.5)]"><Zap size={20} color="var(--eh-green)" /></div>
              <div className="min-w-0">
                <div className="eh-mono text-[10px] opacity-60 tracking-widest">// RECOMMENDED · INSTANT</div>
                <div className="eh-display font-black text-base sm:text-lg leading-tight">Pay & start work — right now</div>
                <div className="eh-mono text-[11px] opacity-70 mt-0.5 leading-5">Card · UPI · Netbanking · Wallets. Order auto-marked <b className="text-[var(--eh-green)]">VERIFIED</b> on payment.</div>
              </div>
            </div>
            <button onClick={payWithCashfree} disabled={paying || amount <= 0} className="eh-btn-primary w-full justify-center py-3 text-sm inline-flex items-center gap-2 disabled:opacity-50" data-testid="pay-cashfree-btn">
              {paying ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {paying ? 'OPENING SECURE CHECKOUT…' : amount > 0 ? `PAY ₹${amount.toLocaleString('en-IN')} · OPEN CHECKOUT` : 'AWAITING QUOTE'}
            </button>
            <div className="mt-3 flex items-center gap-2 eh-mono text-[10px] opacity-60">
              <ShieldCheck size={11} className="text-[var(--eh-green)]" />
              <span>Powered by <b>Cashfree</b> · PCI-DSS L1 secured · {cf.mode === 'production' ? 'live mode' : 'sandbox'}</span>
            </div>
          </div>
          {anyManual && (
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-px bg-[var(--eh-border)]" />
              <button onClick={() => setTab(settings.manual_enabled ? 'manual' : 'crypto')} className="eh-mono text-[10px] tracking-widest opacity-70 hover:opacity-100">OR PAY MANUALLY →</button>
              <div className="flex-1 h-px bg-[var(--eh-border)]" />
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-3" data-testid="pay-manual-pane">
          {settings.upi_id && (
            <div className="flex items-center justify-between gap-3 p-3 border border-[var(--eh-border)] rounded">
              <div className="min-w-0">
                <div className="eh-mono text-[10px] opacity-60">UPI ID</div>
                <div className="eh-mono text-sm font-bold eh-neon-soft truncate">{settings.upi_id}</div>
                {settings.upi_name && <div className="eh-mono text-[10px] opacity-60 truncate">→ {settings.upi_name}</div>}
              </div>
              <button onClick={() => copy(settings.upi_id, 'upi')} className="eh-btn-ghost text-xs shrink-0">{copied === 'upi' ? <Check size={12} /> : <Copy size={12} />} COPY</button>
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
        <div className="space-y-3" data-testid="pay-crypto-pane">
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

      {/* Manual proof submission — hidden for Cashfree path */}
      {tab !== 'cashfree' && (
        <div className="space-y-2 mt-4 border-t border-[var(--eh-border)] pt-4">
          <div className="eh-mono text-xs tracking-widest opacity-70">SUBMIT PROOF</div>
          <input value={txRef} onChange={e => setTxRef(e.target.value)} data-testid="pay-tx-ref" placeholder="> Transaction reference / UTR / TXID" className="eh-input text-sm w-full" />
          <label className={`block w-full cursor-pointer rounded border border-dashed border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors p-3 text-center ${uploading ? 'opacity-60 pointer-events-none' : ''}`} data-testid="pay-upload-dropzone">
            <div className="flex items-center justify-center gap-2 eh-mono text-xs">
              {uploading ? <><Loader2 className="animate-spin" size={14} /> UPLOADING…</> : <><Upload size={14} /> {proof ? 'REPLACE SCREENSHOT' : 'UPLOAD PAYMENT SCREENSHOT'}</>}
            </div>
            <div className="eh-mono text-[10px] opacity-50 mt-1">PNG / JPG · max 5MB</div>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          {proof && <div className="relative"><img src={proof} alt="proof" className="max-h-40 w-full object-contain rounded border border-[var(--eh-green)]" onError={e => e.target.style.display = 'none'} /><span className="absolute top-1 right-1 eh-mono text-[9px] px-1.5 py-0.5 rounded bg-[var(--eh-green)] text-black font-bold">✓ UPLOADED</span></div>}
          <button onClick={submit} disabled={submitting || !proof || !txRef} data-testid="pay-submit" className="eh-btn-primary text-xs w-full justify-center mt-2 disabled:opacity-50">{submitting ? 'SUBMITTING...' : 'I HAVE PAID — SUBMIT'}</button>
        </div>
      )}
    </div>
  );
};

export default PaymentBox;
