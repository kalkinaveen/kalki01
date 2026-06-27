import React, { useEffect, useState } from 'react';
import { CreditCard, Plus, Trash2, Loader2, Save, Eye, Wallet as WalletIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

const DEFAULTS = {
  heading: '💳 <b>PAYMENT OPTIONS</b>',
  intro: 'Pick any method — your wallet credits the moment our team verifies.',
  upi_id: '',
  upi_name: '',
  crypto_wallets: [],
  instructions: '1. Send the exact amount.\n2. Copy the UPI Reference / UTR or TXID.\n3. Tap <b>I\'ve Paid</b> below to submit proof.',
  support_text: 'Need help? Reply here or tap Support below.',
  show_paid_button: true,
  show_support_button: true,
  show_quote_button: true,
  paid_button_label: "✅ I've Paid",
  support_button_label: '💬 Talk to Support',
  quote_button_label: '💎 Get Free Quote',
  support_url: 'https://t.me/errorhacker',
  quote_url: 'https://errorhacker.site/recovery',
  paid_form_url: 'https://errorhacker.site/me/wallet',
};

const Field = ({ label, children, hint }) => (
  <div>
    <label className="eh-mono text-[10px] tracking-widest opacity-60 block mb-1.5">{label}</label>
    {children}
    {hint && <p className="eh-mono text-[10px] opacity-50 mt-1 leading-5">{hint}</p>}
  </div>
);

const TgPaymentInfoPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await api.adminTgPayInfoGet();
      setData({ ...DEFAULTS, ...r });
    } catch (e) { toast.error(e.message); setData({ ...DEFAULTS }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const setWallet = (idx, k, v) => setData(d => {
    const ws = [...(d.crypto_wallets || [])];
    ws[idx] = { ...ws[idx], [k]: v };
    return { ...d, crypto_wallets: ws };
  });
  const addWallet = () => setData(d => ({ ...d, crypto_wallets: [...(d.crypto_wallets || []), { coin: 'USDT', network: 'TRC20', address: '' }] }));
  const removeWallet = (idx) => setData(d => ({ ...d, crypto_wallets: (d.crypto_wallets || []).filter((_, i) => i !== idx) }));

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.adminTgPayInfoSet(data);
      setData(prev => ({ ...prev, ...(r.payment_info || {}) }));
      toast.success('Payment info saved · live for new bot messages');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const preview = async () => {
    setBusy(true);
    try {
      await api.adminTgPayInfoPreview({ payment_info: data });
      toast.success('Preview sent to your admin chat');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  if (loading || !data) return <div className="eh-panel p-5 grid place-items-center min-h-[200px]"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="eh-panel p-5 space-y-5" data-testid="admin-tg-payinfo-panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="eh-mono text-xs tracking-widest opacity-70 flex items-center gap-2">
          <CreditCard size={12} className="text-[var(--eh-green)]" /> // BOT PAYMENT INFO ( /pay )
        </div>
        <div className="flex gap-2">
          <button onClick={preview} disabled={busy} className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="admin-tg-payinfo-preview">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} PREVIEW IN TG
          </button>
          <button onClick={save} disabled={busy} className="eh-btn-primary text-xs inline-flex items-center gap-1.5" data-testid="admin-tg-payinfo-save">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} SAVE
          </button>
        </div>
      </div>
      <p className="eh-mono text-[11px] opacity-70 leading-6">
        This block is rendered by the bot when a customer taps <b>Payment Info</b> or types <code>/pay</code>. HTML supported. Use placeholders <code>{'{amount}'}</code> and <code>{'{order_id}'}</code> inside Instructions — they auto-substitute.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="HEADING (HTML)">
          <input className="eh-input text-sm" value={data.heading} onChange={e => set('heading', e.target.value)} data-testid="admin-tg-payinfo-heading" />
        </Field>
        <Field label="INTRO LINE">
          <input className="eh-input text-sm" value={data.intro} onChange={e => set('intro', e.target.value)} data-testid="admin-tg-payinfo-intro" />
        </Field>
        <Field label="UPI ID">
          <input className="eh-input text-sm" value={data.upi_id} onChange={e => set('upi_id', e.target.value)} placeholder="errorhacker@upi" data-testid="admin-tg-payinfo-upi" />
        </Field>
        <Field label="UPI ACCOUNT NAME">
          <input className="eh-input text-sm" value={data.upi_name} onChange={e => set('upi_name', e.target.value)} placeholder="ERRORHACKER" data-testid="admin-tg-payinfo-upi-name" />
        </Field>
      </div>

      {/* Crypto wallets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="eh-mono text-[10px] tracking-widest opacity-60">CRYPTO WALLETS</label>
          <button onClick={addWallet} className="eh-btn-ghost text-[11px] inline-flex items-center gap-1" data-testid="admin-tg-payinfo-add-wallet"><Plus size={10} /> ADD</button>
        </div>
        {(data.crypto_wallets || []).length === 0 && <p className="eh-mono text-[10px] opacity-50">No crypto wallets configured.</p>}
        <div className="space-y-2">
          {(data.crypto_wallets || []).map((w, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <input className="eh-input text-xs col-span-3 sm:col-span-2" value={w.coin || ''} onChange={e => setWallet(idx, 'coin', e.target.value)} placeholder="USDT" />
              <input className="eh-input text-xs col-span-4 sm:col-span-3" value={w.network || ''} onChange={e => setWallet(idx, 'network', e.target.value)} placeholder="TRC20" />
              <input className="eh-input text-xs col-span-12 sm:col-span-6 font-mono" value={w.address || ''} onChange={e => setWallet(idx, 'address', e.target.value)} placeholder="TXXXX..." />
              <button onClick={() => removeWallet(idx)} className="eh-btn-ghost text-red-400 text-[11px] col-span-12 sm:col-span-1" data-testid={`admin-tg-payinfo-remove-wallet-${idx}`}><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      </div>

      <Field label="INSTRUCTIONS (HTML · supports {amount} {order_id})">
        <textarea rows={4} className="eh-textarea text-sm" value={data.instructions} onChange={e => set('instructions', e.target.value)} data-testid="admin-tg-payinfo-instructions" />
      </Field>
      <Field label="SUPPORT FOOTER LINE">
        <input className="eh-input text-sm" value={data.support_text} onChange={e => set('support_text', e.target.value)} data-testid="admin-tg-payinfo-support-text" />
      </Field>

      {/* Buttons */}
      <div className="space-y-3">
        <label className="eh-mono text-[10px] tracking-widest opacity-60 block">INLINE BUTTONS</label>
        {[
          { key: 'paid', label: 'PAID', urlKey: 'paid_form_url', placeholder: 'https://errorhacker.site/me/wallet' },
          { key: 'quote', label: 'QUOTE', urlKey: 'quote_url', placeholder: 'https://errorhacker.site/recovery' },
          { key: 'support', label: 'SUPPORT', urlKey: 'support_url', placeholder: 'https://t.me/errorhacker' },
        ].map(b => (
          <div key={b.key} className="grid grid-cols-12 gap-2 items-center">
            <label className="col-span-12 sm:col-span-2 inline-flex items-center gap-2 eh-mono text-xs">
              <input type="checkbox" checked={!!data[`show_${b.key}_button`]} onChange={e => set(`show_${b.key}_button`, e.target.checked)} className="accent-[var(--eh-green)]" data-testid={`admin-tg-payinfo-show-${b.key}`} />
              <span className="text-[var(--eh-green)]">{b.label}</span>
            </label>
            <input className="eh-input text-xs col-span-12 sm:col-span-4" value={data[`${b.key}_button_label`] || ''} onChange={e => set(`${b.key}_button_label`, e.target.value)} placeholder="Button text" />
            <input className="eh-input text-xs col-span-12 sm:col-span-6 font-mono" value={data[b.urlKey] || ''} onChange={e => set(b.urlKey, e.target.value)} placeholder={b.placeholder} />
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--eh-border)] pt-3 flex items-center gap-2 eh-mono text-[10px] opacity-50">
        <WalletIcon size={11} className="text-[var(--eh-green)]" /> Customer site keeps using its own Payment Settings under <b className="text-[var(--eh-green)]/80">Payments tab</b>. This block is only for the bot.
      </div>
    </div>
  );
};

export default TgPaymentInfoPanel;
