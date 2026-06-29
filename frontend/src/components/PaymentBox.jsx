import React, { useEffect, useState } from 'react';
import { Copy, Check, Upload, Loader2, CreditCard, Bitcoin, Zap, ShieldCheck, Clock, Send as TgIcon, RefreshCcw } from 'lucide-react';
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
  const [teamTgUrl, setTeamTgUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const boxRef = React.useRef(null);

  useEffect(() => {
    Promise.all([
      api.getPaymentSettings().catch(() => null),
      api.cashfreeConfig().catch(() => ({ configured: false })),
      api.recoveryConfig().catch(() => null),
    ]).then(([s, c, rc]) => {
      if (s) {
        setSettings(s);
        if (s.crypto_wallets?.length) setCoin(s.crypto_wallets[0].coin);
      }
      setCf(c);
      if (rc?.hero?.telegram_url) setTeamTgUrl(rc.hero.telegram_url);
      // Pick the default tab — prefer Cashfree if live, then manual, then crypto
      if (c.configured) setTab('cashfree');
      else if (s?.manual_enabled) setTab('manual');
      else if (s?.crypto_enabled) setTab('crypto');
    });
  }, []);

  // Auto-scroll into view when user lands here from an email "PAY NOW" link
  useEffect(() => {
    if (autoScroll && (cf.configured || settings) && boxRef.current) {
      const t = setTimeout(() => boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
      return () => clearTimeout(t);
    }
  }, [autoScroll, settings, cf.configured]);

  // Only hide the entire box once the order is fully paid — otherwise always
  // render at least the Cashfree pane (the manual-UPI/crypto admin config may
  // be empty for a fresh deploy, but Cashfree should still be reachable).
  if (['delivered', 'paid', 'verified', 'in-progress'].includes(order.status)) return null;
  const safeSettings = settings || { manual_enabled: false, crypto_enabled: false, crypto_wallets: [], upi_id: '', bank_details: '' };
  const anyManual = safeSettings.manual_enabled || safeSettings.crypto_enabled;
  if (!cf.configured && !anyManual) return null;

  const amount = Number(order.payment_amount || order.amount || 0);
  const isAwaitingQuote = amount <= 0;

  const refreshOrder = async () => {
    setRefreshing(true);
    try {
      const fresh = await api.getOrder(order.id);
      onUpdated?.(fresh);
      const newAmt = Number(fresh?.payment_amount || fresh?.amount || 0);
      if (newAmt > 0) toast.success(`Quote ready · ₹${newAmt.toLocaleString('en-IN')}`);
      else toast.info('Still awaiting quote — try again shortly');
    } catch (_e) { toast.error('Could not refresh'); }
    finally { setRefreshing(false); }
  };

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
      try { sessionStorage.setItem('eh_payment_redirect', window.location.pathname); } catch { /* noop */ }
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

  const activeWallet = (safeSettings.crypto_wallets || []).find(w => w.coin === coin);

  // Premium payment-method tile (extends tools-tile aesthetic)
  // eslint-disable-next-line react/no-unstable-nested-components
  const PayTile = ({ id, icon: Icon, color, title, sub, badge }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      data-testid={`pay-tab-${id}`}
      className={`eh-pay-tile ${tab === id ? 'is-active' : ''}`}
      style={{ '--tile-color': color }}
    >
      <span className="shine" />
      {badge && <span className="badge">{badge}</span>}
      <div className="pay-icon"><Icon size={20} color={color} strokeWidth={1.8} /></div>
      <h4>{title}</h4>
      <p>{sub}</p>
      <span className="pay-arrow">{tab === id ? '▸ SELECTED' : 'CHOOSE →'}</span>
    </button>
  );

  return (
    <div ref={boxRef} className={`eh-panel eh-brackets p-4 sm:p-6 mt-5 sm:mt-6 ${autoScroll ? 'eh-pulse-once' : ''}`} data-testid="payment-box">
      <span className="br-bl" /><span className="br-br" />
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div className="eh-kicker truncate">// COMPLETE_PAYMENT</div>
        {amount > 0 && <div className="eh-display font-black text-xl sm:text-2xl eh-neon shrink-0">₹{amount.toLocaleString('en-IN')}</div>}
      </div>

      {isAwaitingQuote ? (
        <div data-testid="pay-awaiting-quote" className="relative">
          {/* Beautiful awaiting-quote panel — replaces the locked button entirely */}
          <div className="relative overflow-hidden rounded-xl border border-[rgba(0,255,157,.3)] bg-[rgba(0,255,157,.04)]">
            {/* Scanline overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,255,157,.05) 0 1px, transparent 1px 3px)' }} />
            {/* Top status strip */}
            <div className="relative flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[rgba(0,255,157,.08)] border-b border-[rgba(0,255,157,.25)]">
              <span className="relative flex items-center justify-center w-2 h-2 shrink-0">
                <span className="absolute inset-0 rounded-full bg-[var(--eh-green)] opacity-70 animate-ping" />
                <span className="relative w-2 h-2 rounded-full bg-[var(--eh-green)]" />
              </span>
              <span className="eh-mono text-[10px] sm:text-[11px] tracking-[.25em] text-[var(--eh-green)] font-bold">// QUOTE_IN_REVIEW</span>
              <span className="ml-auto eh-mono text-[9px] sm:text-[10px] opacity-50 tracking-widest">EST · UNDER 4 HRS</span>
            </div>

            <div className="relative p-5 sm:p-6">
              {/* Hero icon + headline */}
              <div className="flex items-start gap-3 sm:gap-4 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl border border-[rgba(0,255,157,.5)] bg-[rgba(0,255,157,.1)] grid place-items-center relative">
                  <Clock size={22} className="text-[var(--eh-green)] eh-spin-slow" strokeWidth={1.6} />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--eh-green)] animate-pulse shadow-[0_0_8px_var(--eh-green)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="eh-display font-black text-lg sm:text-xl leading-tight mb-1">Your operator is preparing the quote</h3>
                  <p className="eh-mono text-[11px] sm:text-[12px] opacity-75 leading-5 sm:leading-6">
                    We&apos;re scoping <span className="eh-neon-soft">{order.serviceName || order.service || 'your request'}</span> and locking in the final price. You&apos;ll get the amount + secure pay link on Telegram and email — usually within a few hours.
                  </p>
                </div>
              </div>

              {/* 3-step mini timeline */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { k: 'placed', label: 'PLACED', sub: 'done' },
                  { k: 'review', label: 'PRICING', sub: 'live' },
                  { k: 'pay',    label: 'PAY',     sub: 'next' },
                ].map((s) => {
                  const isDone = s.sub === 'done';
                  const isLive = s.sub === 'live';
                  return (
                    <div key={s.k} className={`relative rounded-lg border p-2.5 sm:p-3 text-center ${isDone ? 'border-[rgba(0,255,157,.45)] bg-[rgba(0,255,157,.08)]' : isLive ? 'border-[rgba(0,255,157,.6)] bg-[rgba(0,255,157,.12)] shadow-[0_0_18px_rgba(0,255,157,.18)_inset]' : 'border-[var(--eh-border)] opacity-50'}`}>
                      <div className={`eh-mono text-[9px] sm:text-[10px] tracking-widest mb-0.5 ${isDone || isLive ? 'text-[var(--eh-green)]' : 'opacity-70'}`}>{s.label}</div>
                      <div className="eh-mono text-[9px] opacity-60">{isDone ? '✓' : isLive ? <span className="inline-flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-[var(--eh-green)] animate-pulse" /> NOW</span> : '—'}</div>
                    </div>
                  );
                })}
              </div>

              {/* Action row — stacks on mobile */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {teamTgUrl ? (
                  <a href={teamTgUrl} target="_blank" rel="noreferrer" data-testid="pay-awaiting-ping" className="eh-btn-primary text-xs sm:text-sm justify-center inline-flex items-center gap-2 flex-1 py-3 sm:py-2.5">
                    <TgIcon size={14} /> PING TEAM ON TELEGRAM
                  </a>
                ) : null}
                <button onClick={refreshOrder} disabled={refreshing} data-testid="pay-awaiting-refresh" className="eh-btn-ghost text-xs sm:text-sm justify-center inline-flex items-center gap-2 flex-1 py-3 sm:py-2.5 disabled:opacity-50">
                  <RefreshCcw size={13} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'CHECKING…' : 'CHECK FOR QUOTE'}
                </button>
              </div>

              {/* Reassurance footer */}
              <div className="mt-4 flex items-center gap-2 eh-mono text-[10px] opacity-55">
                <ShieldCheck size={11} className="text-[var(--eh-green)]" />
                <span>No charge will be made until you approve the quote. This page auto-updates.</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Premium payment-method tile picker — picks the active path */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {cf.configured && (
          <PayTile id="cashfree" icon={Zap} color="#00ff9d" title="Card / UPI" sub="Instant · auto-verify" badge="FAST" />
        )}
        {safeSettings.manual_enabled && (
          <PayTile id="manual" icon={CreditCard} color="#4de0ff" title="Manual UPI" sub="Pay & upload proof" />
        )}
        {safeSettings.crypto_enabled && (
          <PayTile id="crypto" icon={Bitcoin} color="#ffd34d" title="Crypto" sub="USDT · BTC · ETH" />
        )}
      </div>

      {tab === 'cashfree' && (
        <div className="space-y-3" data-testid="pay-cashfree-pane">
          {/* Tools-tile inspired card — colored top accent, compact mobile-first layout */}
          <div className="relative overflow-hidden rounded-xl border border-[rgba(0,255,157,.45)] bg-[rgba(0,255,157,.05)]">
            {/* Top accent strip (badge-style like tools tile) */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
              <div className="inline-flex items-center gap-1.5">
                <span className="relative inline-flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-[var(--eh-green)] opacity-70 animate-ping" />
                  <span className="relative w-2 h-2 rounded-full bg-[var(--eh-green)]" />
                </span>
                <span className="eh-mono text-[10px] tracking-[.22em] text-[var(--eh-green)] font-bold">RECOMMENDED</span>
              </div>
              <span className="eh-mono text-[9px] tracking-widest opacity-50">INSTANT · PCI-DSS L1</span>
            </div>
            <div className="px-4 pb-4">
              {/* Tighter mobile layout: icon + headline on one row, smaller text */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg grid place-items-center shrink-0 bg-[rgba(0,255,157,.12)] border border-[rgba(0,255,157,.5)]">
                  <Zap size={16} className="sm:hidden" color="var(--eh-green)" strokeWidth={2} />
                  <Zap size={20} className="hidden sm:block" color="var(--eh-green)" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="eh-display font-black text-[15px] sm:text-lg leading-snug">Pay &amp; start work · right now</div>
                  <div className="eh-mono text-[10.5px] sm:text-[11px] opacity-70 mt-1 leading-[1.55]">Card · UPI · Netbanking · Wallets — auto-verifies your order on payment.</div>
                </div>
              </div>
              <button onClick={payWithCashfree} disabled={paying || amount <= 0} className="eh-btn-primary w-full justify-center py-3 sm:py-3 text-sm inline-flex items-center gap-2 disabled:opacity-50" data-testid="pay-cashfree-btn">
                {paying ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {paying ? <span>OPENING…</span> : amount > 0 ? (
                  <span>PAY ₹{amount.toLocaleString('en-IN')} <span className="hidden sm:inline opacity-80">· OPEN CHECKOUT</span><span className="sm:hidden opacity-80"> →</span></span>
                ) : <span>AWAITING QUOTE</span>}
              </button>
              <div className="mt-2.5 flex items-center justify-center gap-1.5 eh-mono text-[9.5px] sm:text-[10px] opacity-55">
                <ShieldCheck size={10} className="text-[var(--eh-green)]" />
                <span>Powered by Cashfree · {cf.mode === 'production' ? 'live mode' : 'sandbox'}</span>
              </div>
            </div>
          </div>
          {anyManual && (
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-px bg-[var(--eh-border)]" />
              <button onClick={() => setTab(safeSettings.manual_enabled ? 'manual' : 'crypto')} className="eh-mono text-[10px] tracking-widest opacity-70 hover:opacity-100">OR PAY MANUALLY →</button>
              <div className="flex-1 h-px bg-[var(--eh-border)]" />
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-3" data-testid="pay-manual-pane">
          {safeSettings.upi_id && (
            <div className="flex items-center justify-between gap-3 p-3 border border-[var(--eh-border)] rounded">
              <div className="min-w-0">
                <div className="eh-mono text-[10px] opacity-60">UPI ID</div>
                <div className="eh-mono text-sm font-bold eh-neon-soft truncate">{safeSettings.upi_id}</div>
                {safeSettings.upi_name && <div className="eh-mono text-[10px] opacity-60 truncate">→ {safeSettings.upi_name}</div>}
              </div>
              <button onClick={() => copy(safeSettings.upi_id, 'upi')} className="eh-btn-ghost text-xs shrink-0">{copied === 'upi' ? <Check size={12} /> : <Copy size={12} />} COPY</button>
            </div>
          )}
          {safeSettings.qr_image_url && (
            <div className="text-center">
              <img src={safeSettings.qr_image_url} alt="QR" className="mx-auto max-w-[200px] rounded border border-[var(--eh-border)]" />
              <div className="eh-mono text-[10px] opacity-60 mt-1">scan to pay</div>
            </div>
          )}
          {safeSettings.bank_details && (
            <div className="p-3 border border-[var(--eh-border)] rounded">
              <div className="eh-mono text-[10px] opacity-60 mb-1">BANK DETAILS</div>
              <pre className="eh-mono text-xs whitespace-pre-wrap leading-6">{safeSettings.bank_details}</pre>
            </div>
          )}
          {safeSettings.instructions && <div className="eh-mono text-[11px] opacity-80 leading-6 p-3 border border-dashed border-[var(--eh-border)] rounded">{safeSettings.instructions}</div>}
        </div>
      )}

      {tab === 'crypto' && (
        <div className="space-y-3" data-testid="pay-crypto-pane">
          <div className="flex gap-2 flex-wrap">
            {(safeSettings.crypto_wallets || []).map(w => (
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
      </>
      )}
    </div>
  );
};

export default PaymentBox;
