import React, { useEffect, useState } from 'react';
import { Wallet, Plus, Loader2, Upload, Copy, Check, ArrowDownLeft, ArrowUpRight, Sparkles, Gift, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const QUICK = [100, 500, 1000, 2000];

const TYPE_ICON = {
  credit: <ArrowDownLeft size={14} className="text-[var(--eh-green)]" />,
  debit: <ArrowUpRight size={14} className="text-red-400" />,
  spin: <Sparkles size={14} className="text-[#ffd34d]" />,
  cashback: <Gift size={14} className="text-[#4de0ff]" />,
  refund: <RotateCcw size={14} className="text-[#c084fc]" />,
};

const MyWallet = () => {
  const { user, loading } = useAuth();
  const [w, setW] = useState(null);
  const [txns, setTxns] = useState([]);
  const [payCfg, setPayCfg] = useState(null);
  const [amount, setAmount] = useState(500);
  const [txRef, setTxRef] = useState('');
  const [method, setMethod] = useState('manual');
  const [coin, setCoin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('amount'); // amount → pay → done
  const [copied, setCopied] = useState('');

  const reload = async () => {
    try {
      const [wallet, txs, pay] = await Promise.all([api.walletGet(), api.walletTxns(), api.getPaymentSettings()]);
      setW(wallet); setTxns(txs); setPayCfg(pay);
      if (pay.crypto_wallets?.length && !coin) setCoin(pay.crypto_wallets[0].coin);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { if (user) reload(); }, [user]);

  if (loading) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  if (!user) return <section className="min-h-[60vh] grid place-items-center"><Link to="/login" className="eh-btn-primary">Sign in to view wallet</Link></section>;
  if (!w) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;

  const copy = (t, k) => { navigator.clipboard.writeText(t); setCopied(k); toast.success('Copied'); setTimeout(() => setCopied(''), 1500); };

  const submit = async () => {
    if (!amount || amount < 10) { toast.error('Min ₹10 deposit'); return; }
    if (!txRef && method === 'manual') { toast.error('Add UPI/UTR reference number'); return; }
    setSubmitting(true);
    try {
      await api.walletDeposit({ amount: Number(amount), method, coin: method === 'crypto' ? coin : '', tx_reference: txRef });
      toast.success('Deposit submitted!', { description: 'Admin will approve within 30 min — you\'ll see the balance update here.' });
      setStep('done'); setTxRef('');
      await reload();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const activeWallet = (payCfg?.crypto_wallets || []).find(x => x.coin === coin);

  return (
    <section className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
      <div className="mb-8">
        <div className="eh-kicker mb-2">// WALLET</div>
        <h1 className="eh-display text-3xl sm:text-4xl font-black">My Wallet</h1>
        <p className="eh-mono text-xs opacity-70 mt-1">Top up your balance and place orders instantly. No more proof-submit per order.</p>
      </div>

      {/* Balance hero */}
      <div className="eh-panel eh-brackets p-6 sm:p-8 mb-6 bg-[rgba(0,255,157,.04)] border border-[rgba(0,255,157,.25)]" data-testid="wallet-balance-card">
        <span className="br-bl" /><span className="br-br" />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="eh-mono text-[10px] tracking-widest opacity-60 flex items-center gap-2 mb-1"><Wallet size={12} className="text-[var(--eh-green)]" /> // BALANCE</div>
            <div className="eh-display font-black eh-neon" style={{ fontSize: 'clamp(2.2rem, 7vw, 3.8rem)' }}>₹{Number(w.balance || 0).toLocaleString('en-IN')}</div>
            <div className="eh-mono text-[11px] opacity-50 mt-1">{w.currency}</div>
          </div>
          <div className="flex flex-col gap-2 items-stretch">
            <Link to="/me/spin" data-testid="wallet-spin-cta" className="eh-btn-primary text-xs inline-flex items-center justify-center gap-1.5 bg-[#ffd34d] !text-black hover:bg-[#ffd34d]/90">
              <Sparkles size={14} /> DAILY SPIN — WIN ₹500
            </Link>
            <Link to="/me" className="eh-btn-ghost text-xs justify-center">← BACK TO ACCOUNT</Link>
          </div>
        </div>
      </div>

      {/* Top-up flow */}
      <div className="eh-panel p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="eh-mono text-xs tracking-widest opacity-70 flex items-center gap-2"><Plus size={12} className="text-[var(--eh-green)]" /> // ADD BALANCE</div>
          {step === 'done' && <button onClick={() => setStep('amount')} className="eh-btn-ghost text-xs">NEW DEPOSIT</button>}
        </div>

        {step === 'amount' && (
          <div className="space-y-4">
            <div>
              <div className="eh-mono text-[10px] opacity-60 mb-2">QUICK AMOUNT</div>
              <div className="flex gap-2 flex-wrap mb-3">
                {QUICK.map(q => (
                  <button key={q} onClick={() => setAmount(q)} data-testid={`wallet-quick-${q}`} className={`px-4 py-2.5 rounded eh-mono text-sm font-bold tracking-wide border transition-colors ${amount === q ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]' : 'border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}>₹{q.toLocaleString('en-IN')}</button>
                ))}
              </div>
              <input type="number" min="10" value={amount} onChange={e => setAmount(e.target.value)} className="eh-input text-lg" placeholder="Custom amount" data-testid="wallet-amount" />
            </div>
            <button onClick={() => setStep('pay')} disabled={!amount || amount < 10} className="eh-btn-primary text-xs disabled:opacity-50" data-testid="wallet-continue">CONTINUE → ₹{Number(amount || 0).toLocaleString('en-IN')}</button>
          </div>
        )}

        {step === 'pay' && payCfg && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              {payCfg.manual_enabled && <button onClick={() => setMethod('manual')} className={`px-4 py-2 rounded eh-mono text-xs ${method === 'manual' ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>UPI / BANK</button>}
              {payCfg.crypto_enabled && <button onClick={() => setMethod('crypto')} className={`px-4 py-2 rounded eh-mono text-xs ${method === 'crypto' ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>CRYPTO</button>}
            </div>

            {method === 'manual' && (
              <div className="eh-panel p-4 space-y-2">
                {payCfg.upi_id && (
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="eh-mono text-[10px] opacity-60">UPI ID</div>
                      <div className="eh-mono text-sm font-bold eh-neon-soft">{payCfg.upi_id}</div>
                    </div>
                    <button onClick={() => copy(payCfg.upi_id, 'upi')} className="eh-btn-ghost text-xs">{copied === 'upi' ? <Check size={12} /> : <Copy size={12} />} COPY</button>
                  </div>
                )}
                {payCfg.qr_image_url && <img src={payCfg.qr_image_url} alt="QR" className="mx-auto max-w-[180px] rounded border border-[var(--eh-border)]" />}
                <div className="eh-mono text-[11px] opacity-70 leading-6 pt-2 border-t border-[var(--eh-border)]">Send <span className="eh-neon">₹{amount}</span> to the UPI ID above, then paste the UPI Reference / UTR below.</div>
              </div>
            )}
            {method === 'crypto' && activeWallet && (
              <div className="eh-panel p-4 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {(payCfg.crypto_wallets || []).map(cw => (
                    <button key={cw.coin} onClick={() => setCoin(cw.coin)} className={`px-3 py-1.5 rounded eh-mono text-xs ${coin === cw.coin ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>{cw.coin}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="min-w-0">
                    <div className="eh-mono text-[10px] opacity-60">{activeWallet.coin} {activeWallet.network && `· ${activeWallet.network}`}</div>
                    <div className="eh-mono text-xs break-all eh-neon-soft">{activeWallet.address}</div>
                  </div>
                  <button onClick={() => copy(activeWallet.address, 'wallet')} className="eh-btn-ghost text-xs shrink-0">{copied === 'wallet' ? <Check size={12} /> : <Copy size={12} />}</button>
                </div>
              </div>
            )}
            <input value={txRef} onChange={e => setTxRef(e.target.value)} placeholder={method === 'crypto' ? '> TXID / hash' : '> UPI Reference / UTR'} className="eh-input" data-testid="wallet-tx-ref" />
            <div className="flex gap-2">
              <button onClick={() => setStep('amount')} className="eh-btn-ghost text-xs">← BACK</button>
              <button onClick={submit} disabled={submitting} className="eh-btn-primary text-xs flex-1 justify-center disabled:opacity-50" data-testid="wallet-submit">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {submitting ? 'SUBMITTING…' : 'I HAVE PAID — SUBMIT'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-3 bg-[rgba(0,255,157,.12)]"><Check size={28} className="text-[var(--eh-green)]" /></div>
            <div className="eh-display font-black text-xl mb-1">Deposit submitted!</div>
            <p className="eh-mono text-xs opacity-70 leading-6 max-w-md mx-auto">Our team verifies within 30 min and credits your wallet automatically. You'll get a Telegram DM the moment it's approved.</p>
          </div>
        )}
      </div>

      {/* Txn history */}
      <div className="eh-panel p-5">
        <div className="eh-mono text-xs tracking-widest opacity-70 mb-3">// TRANSACTIONS ({txns.length})</div>
        {txns.length === 0 ? (
          <div className="eh-mono text-xs opacity-60 text-center py-6">No transactions yet. Top up to get started.</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {txns.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3 border border-[var(--eh-border)] rounded text-sm" data-testid={`wallet-txn-${t.id}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {TYPE_ICON[t.type] || <ArrowDownLeft size={14} />}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm uppercase eh-mono">{t.type}</div>
                    <div className="eh-mono text-[10px] opacity-60 truncate">{t.note || '—'}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`eh-mono font-bold ${['credit', 'spin', 'cashback', 'refund'].includes(t.type) ? 'text-[var(--eh-green)]' : 'text-red-400'}`}>
                    {['credit', 'spin', 'cashback', 'refund'].includes(t.type) ? '+' : '−'}₹{Number(t.amount).toLocaleString('en-IN')}
                  </div>
                  <div className="eh-mono text-[10px] opacity-50">{new Date(t.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MyWallet;
