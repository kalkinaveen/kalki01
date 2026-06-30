import React, { useEffect, useState } from 'react';
import {
  Wallet, Plus, Loader2, Upload, Copy, Check, ArrowDownLeft, ArrowUpRight,
  Sparkles, Gift, RotateCcw, Zap, CreditCard, Bitcoin, Banknote, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import CashfreeTopupModal from '../components/CashfreeTopupModal';

/**
 * MyWallet — premium, multi-color "Add Money" page (Iter-29 redesign).
 *
 * Design rules:
 * - Top-up methods are surfaced as 3 brand-coloured tiles (Card/UPI = green,
 *   Manual UPI = pink, Crypto = cyan) so the user sees their options without
 *   chasing tabs.
 * - Spin reward is the yellow accent tile in the balance hero.
 * - Quick-amount chips inherit the active method colour so the user sees a
 *   continuous "this is the path I'm on" cue.
 * - Transactions list keeps the clean, dense ledger feel — that's where users
 *   audit, not browse.
 */

const QUICK = [100, 500, 1000, 2000, 5000];

const TYPE_ICON = {
  credit: <ArrowDownLeft size={14} className="text-[var(--eh-green)]" />,
  debit: <ArrowUpRight size={14} className="text-red-400" />,
  spin: <Sparkles size={14} className="text-[#ffd34d]" />,
  cashback: <Gift size={14} className="text-[#4de0ff]" />,
  refund: <RotateCcw size={14} className="text-[#c084fc]" />,
};

const METHOD_META = {
  cashfree: { color: '#00ff9d', label: 'CARD / UPI / NETBANKING', Icon: Zap, tag: 'INSTANT · RECOMMENDED' },
  manual:   { color: '#ff2d92', label: 'PAY VIA UPI / BANK',      Icon: Banknote, tag: 'MANUAL · ~30 MIN' },
  crypto:   { color: '#4de0ff', label: 'CRYPTO TRANSFER',          Icon: Bitcoin, tag: 'USDT · BTC · ETH' },
};

const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const MyWallet = () => {
  const { user, loading } = useAuth();
  const [w, setW] = useState(null);
  const [txns, setTxns] = useState([]);
  const [payCfg, setPayCfg] = useState(null);
  const [amount, setAmount] = useState(500);
  const [txRef, setTxRef] = useState('');
  const [method, setMethod] = useState(null); // null = picker, then 'cashfree' | 'manual' | 'crypto'
  const [coin, setCoin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState('');
  const [cfOpen, setCfOpen] = useState(false);
  const [cfConfig, setCfConfig] = useState({ configured: false, mode: 'sandbox' });
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.cashfreeConfig().then(setCfConfig).catch(() => {});
  }, []);

  const reload = async () => {
    try {
      const [wallet, txs, pay] = await Promise.all([api.walletGet(), api.walletTxns(), api.getPaymentSettings()]);
      setW(wallet); setTxns(txs); setPayCfg(pay);
      if (pay.crypto_wallets?.length && !coin) setCoin(pay.crypto_wallets[0].coin);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (user) reload(); }, [user]);

  if (loading) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin text-[var(--eh-green)]" /></section>;
  if (!user) return <section className="min-h-[60vh] grid place-items-center"><Link to="/login" className="eh-btn-primary">Sign in to view wallet</Link></section>;
  if (!w) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin text-[var(--eh-green)]" /></section>;

  const copy = (t, k) => { navigator.clipboard.writeText(t); setCopied(k); toast.success('Copied'); setTimeout(() => setCopied(''), 1500); };

  const submitManual = async () => {
    if (!amount || amount < 10) { toast.error('Min ₹10 deposit'); return; }
    if (!txRef) { toast.error('Add the UPI / UTR / TXID reference number'); return; }
    setSubmitting(true);
    try {
      await api.walletDeposit({
        amount: Number(amount),
        method: method === 'crypto' ? 'crypto' : 'manual',
        coin: method === 'crypto' ? coin : '',
        tx_reference: txRef,
      });
      toast.success('Deposit submitted!', { description: 'Admin will approve within 30 min — wallet auto-credits when done.' });
      setDone(true); setTxRef('');
      await reload();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const activeWallet = (payCfg?.crypto_wallets || []).find(x => x.coin === coin);
  const activeMeta = method ? METHOD_META[method] : null;
  const activeColor = activeMeta?.color || '#00ff9d';

  // Build the list of methods actually available based on admin config
  const availableMethods = [];
  if (cfConfig.configured) availableMethods.push('cashfree');
  if (payCfg?.manual_enabled) availableMethods.push('manual');
  if (payCfg?.crypto_enabled && payCfg?.crypto_wallets?.length) availableMethods.push('crypto');

  return (
    <section className="relative px-3 sm:px-6 py-8 sm:py-14 max-w-5xl mx-auto" data-testid="wallet-page">
      {/* Ambient color blobs — premium depth without noise */}
      <div aria-hidden className="pointer-events-none absolute -top-20 -left-12 w-72 h-72 rounded-full opacity-25 blur-3xl" style={{ background: '#00ff9d' }} />
      <div aria-hidden className="pointer-events-none absolute top-32 right-0 w-72 h-72 rounded-full opacity-15 blur-3xl" style={{ background: '#ff2d92' }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 w-64 h-64 rounded-full opacity-15 blur-3xl" style={{ background: '#4de0ff' }} />

      <div className="relative">
        <div className="mb-7 sm:mb-8">
          <div className="eh-kicker mb-2">// WALLET</div>
          <h1 className="eh-display text-3xl sm:text-5xl font-black leading-tight">
            <span>Your </span><span className="eh-neon">money</span><span>, ready to spend.</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base opacity-75 max-w-xl leading-relaxed" style={{ fontFamily: 'Inter,sans-serif' }}>
            Top up once, then every order — SMM, recovery, books — debits in a single tap. No more proof-uploads per order.
          </p>
        </div>

        {/* ============== BALANCE HERO (multi-tile) ============== */}
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3 sm:gap-4 mb-7" data-testid="wallet-balance-grid">
          {/* Primary balance tile — neon green */}
          <div
            className="wallet-hero-tile relative overflow-hidden rounded-2xl border-2 p-6 sm:p-8"
            style={{
              borderColor: 'rgba(0,255,157,.45)',
              background: 'linear-gradient(160deg, rgba(0,255,157,.12) 0%, transparent 65%)',
            }}
            data-testid="wallet-balance-card"
          >
            <span aria-hidden className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #00ff9d, transparent)' }} />
            <div className="flex items-start justify-between mb-3">
              <div className="eh-mono text-[10px] tracking-[0.25em] opacity-65 flex items-center gap-1.5">
                <Wallet size={11} className="text-[var(--eh-green)]" /> AVAILABLE BALANCE
              </div>
              <div className="eh-mono text-[9px] tracking-widest opacity-55">{w.currency}</div>
            </div>
            <div className="eh-display font-black eh-neon leading-none" style={{ fontSize: 'clamp(2.6rem, 9vw, 4.5rem)' }}>
              ₹{Number(w.balance || 0).toLocaleString('en-IN')}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                to="/me/orders"
                className="eh-mono text-[10px] tracking-widest font-bold px-3 py-1.5 rounded-md border border-[var(--eh-border)] hover:border-[var(--eh-green)] hover:text-[var(--eh-green)] transition-colors"
                data-testid="wallet-orders-link"
              >
                MY ORDERS →
              </Link>
              <Link
                to="/me"
                className="eh-mono text-[10px] tracking-widest font-bold px-3 py-1.5 rounded-md border border-[var(--eh-border)] hover:border-[var(--eh-green)] hover:text-[var(--eh-green)] transition-colors"
              >
                ← ACCOUNT
              </Link>
            </div>
          </div>

          {/* Daily spin reward tile — yellow accent */}
          <Link
            to="/me/spin"
            data-testid="wallet-spin-cta"
            className="wallet-hero-tile group relative overflow-hidden rounded-2xl border-2 p-5 sm:p-6 flex flex-col justify-between transition-all"
            style={{
              borderColor: 'rgba(255,211,77,.5)',
              background: 'linear-gradient(160deg, rgba(255,211,77,.14) 0%, transparent 65%)',
            }}
          >
            <span aria-hidden className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #ffd34d, transparent)' }} />
            <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'radial-gradient(50% 60% at 60% 30%, rgba(255,211,77,.18), transparent 70%)' }} />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl grid place-items-center mb-3 group-hover:scale-110 transition-transform" style={{ background: 'rgba(255,211,77,.18)', border: '1px solid rgba(255,211,77,.55)', color: '#ffd34d' }}>
                <Sparkles size={20} strokeWidth={1.8} />
              </div>
              <div className="eh-mono text-[10px] tracking-[0.18em] font-bold" style={{ color: '#ffd34d' }}>DAILY SPIN</div>
              <div className="font-bold text-base sm:text-lg mt-1 leading-snug" style={{ fontFamily: 'Inter,sans-serif' }}>
                Win up to <span style={{ color: '#ffd34d' }}>₹500</span> · once a day
              </div>
            </div>
            <div className="relative mt-3 inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest font-bold px-3 py-2 rounded-md" style={{ background: '#ffd34d', color: '#000', width: 'fit-content' }}>
              SPIN NOW <ArrowRight size={12} />
            </div>
          </Link>
        </div>

        {/* ============== ADD BALANCE — PICKER or FORM ============== */}
        <div className="mb-7">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="eh-kicker"><Plus size={11} className="inline -mt-0.5 mr-1 text-[var(--eh-green)]" /> // ADD BALANCE</div>
            {method && !done && (
              <button
                onClick={() => { setMethod(null); setTxRef(''); }}
                className="eh-mono text-[10px] tracking-widest opacity-65 hover:opacity-100 hover:text-[var(--eh-green)] transition-colors"
                data-testid="wallet-method-back"
              >
                ← CHANGE METHOD
              </button>
            )}
            {done && (
              <button
                onClick={() => { setDone(false); setMethod(null); }}
                className="eh-mono text-[10px] tracking-widest opacity-80 hover:opacity-100 text-[var(--eh-green)]"
              >
                NEW DEPOSIT
              </button>
            )}
          </div>

          {/* === DONE STATE === */}
          {done && (
            <div
              className="rounded-2xl border-2 p-8 text-center"
              style={{
                borderColor: 'rgba(0,255,157,.45)',
                background: 'linear-gradient(160deg, rgba(0,255,157,.12) 0%, transparent 65%)',
              }}
              data-testid="wallet-done-state"
            >
              <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-3 bg-[rgba(0,255,157,.18)] border border-[rgba(0,255,157,.5)]">
                <Check size={28} className="text-[var(--eh-green)]" />
              </div>
              <div className="eh-display font-black text-xl mb-1">Deposit submitted!</div>
              <p className="text-sm opacity-75 leading-relaxed max-w-md mx-auto" style={{ fontFamily: 'Inter,sans-serif' }}>
                Our team verifies within 30 min and credits your wallet automatically. You&apos;ll get a Telegram DM the moment it&apos;s approved.
              </p>
            </div>
          )}

          {/* === METHOD PICKER (multi-color tiles) === */}
          {!done && method === null && (
            <>
              {availableMethods.length === 0 ? (
                <div className="eh-panel p-6 text-center text-sm opacity-70">
                  No payment methods are currently enabled. Please contact support.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" data-testid="wallet-method-picker">
                  {availableMethods.map(key => {
                    const meta = METHOD_META[key];
                    const Icon = meta.Icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setMethod(key)}
                        data-testid={`wallet-method-${key}`}
                        className="wallet-method-tile group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all flex flex-col"
                        style={{
                          borderColor: `${meta.color}55`,
                          background: `linear-gradient(160deg, ${meta.color}10 0%, transparent 65%)`,
                          '--c': meta.color,
                        }}
                      >
                        <span aria-hidden className="absolute top-0 left-0 right-0 h-[3px] opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />
                        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(50% 60% at 50% 30%, ${meta.color}22, transparent 70%)` }} />

                        <div className="relative flex items-start justify-between mb-4">
                          <div
                            className="w-12 h-12 rounded-xl grid place-items-center transition-transform group-hover:scale-110"
                            style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}55`, color: meta.color }}
                          >
                            <Icon size={22} strokeWidth={1.8} />
                          </div>
                          <span className="eh-mono text-[10px] tracking-widest opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" style={{ color: meta.color }}>→</span>
                        </div>

                        <div className="relative">
                          <div className="eh-mono text-[10px] sm:text-[11px] tracking-[0.18em] font-bold leading-tight mb-1.5" style={{ color: meta.color }}>
                            {meta.tag}
                          </div>
                          <div className="font-bold text-base sm:text-lg leading-tight" style={{ fontFamily: 'Inter,sans-serif' }}>
                            {meta.label}
                          </div>
                        </div>

                        <div className="relative mt-4">
                          <div
                            className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest font-bold px-3 py-2 rounded-md transition-all group-hover:brightness-110"
                            style={{ background: meta.color, color: '#000' }}
                          >
                            CHOOSE <ArrowRight size={12} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* === METHOD: CASHFREE === */}
          {!done && method === 'cashfree' && (
            <div
              className="rounded-2xl border-2 p-5 sm:p-7"
              style={{
                borderColor: `${activeColor}55`,
                background: `linear-gradient(160deg, ${activeColor}0d 0%, transparent 65%)`,
              }}
            >
              <div className="mb-5">
                <div className="eh-mono text-[10px] tracking-[0.18em] font-bold mb-1" style={{ color: activeColor }}>{activeMeta.tag}</div>
                <div className="font-bold text-base sm:text-lg" style={{ fontFamily: 'Inter,sans-serif' }}>Pay with Cashfree</div>
                <div className="text-xs opacity-70 mt-1" style={{ fontFamily: 'Inter,sans-serif' }}>Card, UPI, Netbanking and Wallets — wallet credits in seconds.</div>
              </div>

              <div className="mb-4">
                <div className="eh-mono text-[10px] opacity-60 mb-2 tracking-widest">CHOOSE AMOUNT</div>
                <div className="flex gap-2 flex-wrap mb-3">
                  {QUICK.map(q => (
                    <button
                      key={q}
                      onClick={() => setAmount(q)}
                      data-testid={`wallet-quick-${q}`}
                      className="px-3.5 py-2 rounded-md eh-mono text-xs font-bold tracking-wide border transition-colors"
                      style={
                        amount === q
                          ? { borderColor: activeColor, color: activeColor, background: `${activeColor}14` }
                          : { borderColor: 'var(--eh-border)' }
                      }
                    >
                      ₹{q.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="10"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="eh-input text-lg w-full"
                  placeholder="Custom amount (min ₹10)"
                  data-testid="wallet-amount"
                />
              </div>

              <button
                onClick={() => setCfOpen(true)}
                disabled={!amount || amount < 10}
                className="w-full flex items-center justify-center gap-2 py-3.5 font-bold text-sm tracking-wider rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: activeColor, color: '#000' }}
                data-testid="wallet-cashfree-cta"
              >
                <Zap size={14} /> PAY {formatINR(amount)} INSTANTLY <ArrowRight size={16} />
              </button>
              <div className="text-center eh-mono text-[10px] opacity-60 mt-3">
                Cashfree hosted checkout · {cfConfig.mode === 'production' ? 'live mode' : 'sandbox mode'} · 256-bit secured
              </div>
            </div>
          )}

          {/* === METHOD: MANUAL UPI / CRYPTO === */}
          {!done && (method === 'manual' || method === 'crypto') && (
            <div
              className="rounded-2xl border-2 p-5 sm:p-7"
              style={{
                borderColor: `${activeColor}55`,
                background: `linear-gradient(160deg, ${activeColor}0d 0%, transparent 65%)`,
              }}
            >
              <div className="mb-5">
                <div className="eh-mono text-[10px] tracking-[0.18em] font-bold mb-1" style={{ color: activeColor }}>{activeMeta.tag}</div>
                <div className="font-bold text-base sm:text-lg" style={{ fontFamily: 'Inter,sans-serif' }}>{activeMeta.label}</div>
                <div className="text-xs opacity-70 mt-1" style={{ fontFamily: 'Inter,sans-serif' }}>
                  Send the amount, then paste the reference below — we approve within 30 min.
                </div>
              </div>

              {/* Amount */}
              <div className="mb-4">
                <div className="eh-mono text-[10px] opacity-60 mb-2 tracking-widest">CHOOSE AMOUNT</div>
                <div className="flex gap-2 flex-wrap mb-3">
                  {QUICK.map(q => (
                    <button
                      key={q}
                      onClick={() => setAmount(q)}
                      data-testid={`wallet-quick-${q}`}
                      className="px-3.5 py-2 rounded-md eh-mono text-xs font-bold tracking-wide border transition-colors"
                      style={
                        amount === q
                          ? { borderColor: activeColor, color: activeColor, background: `${activeColor}14` }
                          : { borderColor: 'var(--eh-border)' }
                      }
                    >
                      ₹{q.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="10"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="eh-input text-lg w-full"
                  placeholder="Custom amount (min ₹10)"
                  data-testid="wallet-amount"
                />
              </div>

              {/* Payment destination panel */}
              {method === 'manual' && payCfg && (
                <div className="rounded-xl border p-4 mb-4 space-y-2" style={{ borderColor: `${activeColor}33`, background: `${activeColor}06` }}>
                  {payCfg.upi_id && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="eh-mono text-[10px] opacity-60 tracking-widest">SEND TO UPI</div>
                        <div className="eh-mono text-sm font-bold break-all" style={{ color: activeColor }}>{payCfg.upi_id}</div>
                      </div>
                      <button onClick={() => copy(payCfg.upi_id, 'upi')} className="eh-btn-ghost text-xs shrink-0">
                        {copied === 'upi' ? <Check size={12} /> : <Copy size={12} />} COPY
                      </button>
                    </div>
                  )}
                  {payCfg.qr_image_url && (
                    <div className="pt-2 border-t border-[var(--eh-border)] flex justify-center">
                      <img src={payCfg.qr_image_url} alt="UPI QR" className="max-w-[160px] rounded border border-[var(--eh-border)]" />
                    </div>
                  )}
                  <div className="eh-mono text-[10px] opacity-70 leading-5 pt-2 border-t border-[var(--eh-border)]">
                    Send <span style={{ color: activeColor }}>{formatINR(amount)}</span> to the UPI ID above, then paste the UPI Reference / UTR below.
                  </div>
                </div>
              )}

              {method === 'crypto' && payCfg && activeWallet && (
                <div className="rounded-xl border p-4 mb-4 space-y-3" style={{ borderColor: `${activeColor}33`, background: `${activeColor}06` }}>
                  <div className="flex gap-2 flex-wrap">
                    {(payCfg.crypto_wallets || []).map(cw => (
                      <button
                        key={cw.coin}
                        onClick={() => setCoin(cw.coin)}
                        className="px-3 py-1.5 rounded-md eh-mono text-xs font-bold tracking-wide border transition-colors"
                        style={
                          coin === cw.coin
                            ? { borderColor: activeColor, color: activeColor, background: `${activeColor}14` }
                            : { borderColor: 'var(--eh-border)' }
                        }
                      >
                        {cw.coin}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="eh-mono text-[10px] opacity-60 tracking-widest">
                        SEND {activeWallet.coin}{activeWallet.network ? ` · ${activeWallet.network}` : ''}
                      </div>
                      <div className="eh-mono text-xs break-all font-bold" style={{ color: activeColor }}>{activeWallet.address}</div>
                    </div>
                    <button onClick={() => copy(activeWallet.address, 'wallet')} className="eh-btn-ghost text-xs shrink-0">
                      {copied === 'wallet' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="eh-mono text-[10px] opacity-70 leading-5 pt-2 border-t border-[var(--eh-border)]">
                    Send the INR equivalent ({formatINR(amount)}) in {activeWallet.coin}. Paste the TXID below.
                  </div>
                </div>
              )}

              {/* TX reference + submit */}
              <input
                value={txRef}
                onChange={e => setTxRef(e.target.value)}
                placeholder={method === 'crypto' ? '> TXID / hash' : '> UPI Reference / UTR'}
                className="eh-input w-full mb-3"
                data-testid="wallet-tx-ref"
              />
              <button
                onClick={submitManual}
                disabled={submitting || !amount || amount < 10 || !txRef}
                className="w-full flex items-center justify-center gap-2 py-3.5 font-bold text-sm tracking-wider rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: activeColor, color: '#000' }}
                data-testid="wallet-submit"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {submitting ? ' SUBMITTING…' : ` I HAVE PAID — SUBMIT ${formatINR(amount)}`}
                <ArrowRight size={16} />
              </button>
              <div className="text-center eh-mono text-[10px] opacity-60 mt-3 leading-relaxed">
                Manual deposits credit within ~30 min after verification · Telegram DM on approval.
              </div>
            </div>
          )}
        </div>

        {/* ============== TRANSACTIONS ============== */}
        <div className="eh-panel p-5 sm:p-6" data-testid="wallet-txn-panel">
          <div className="flex items-center justify-between mb-4">
            <div className="eh-mono text-xs tracking-widest opacity-70">// TRANSACTIONS ({txns.length})</div>
            {txns.length > 0 && (
              <Link to="/me/orders" className="eh-mono text-[10px] tracking-widest opacity-65 hover:opacity-100 hover:text-[var(--eh-green)]">
                VIEW ORDERS →
              </Link>
            )}
          </div>
          {txns.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 mx-auto rounded-full grid place-items-center mb-3" style={{ background: 'rgba(0,255,157,.08)', border: '1px solid rgba(0,255,157,.3)' }}>
                <Wallet size={22} className="text-[var(--eh-green)]" />
              </div>
              <div className="text-sm font-semibold" style={{ fontFamily: 'Inter,sans-serif' }}>No transactions yet</div>
              <div className="eh-mono text-[11px] opacity-60 mt-1">Top up to get started — pick a method above.</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {txns.map(t => (
                <Link
                  key={t.id}
                  to={`/receipt/${t.id}`}
                  className="flex items-center justify-between gap-3 p-3 border border-[var(--eh-border)] rounded-md text-sm hover:border-[rgba(0,255,157,.4)] hover:bg-[rgba(0,255,157,.04)] transition-colors group"
                  data-testid={`wallet-txn-${t.id}`}
                >
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
                    <div className="eh-mono text-[10px] opacity-50 group-hover:text-[var(--eh-green)]">
                      {new Date(t.createdAt).toLocaleDateString()} · RECEIPT →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <CashfreeTopupModal
        open={cfOpen}
        onClose={() => { setCfOpen(false); reload(); }}
        suggested={Number(amount) || 500}
        minAmount={10}
        title="ADD MONEY"
        subtitle="Cashfree hosted checkout · Card, UPI, Netbanking, Wallets"
        redirectBackTo="/me/wallet"
      />

      <style>{`
        .wallet-method-tile { transition: transform .35s cubic-bezier(.2,.9,.3,1), border-color .25s ease, box-shadow .35s ease; }
        .wallet-method-tile:hover {
          border-color: var(--c) !important;
          transform: translateY(-3px);
          box-shadow: 0 18px 50px -16px color-mix(in srgb, var(--c) 60%, transparent);
        }
        .wallet-hero-tile { transition: transform .35s ease, box-shadow .35s ease; }
        .wallet-hero-tile:hover { transform: translateY(-2px); }
      `}</style>
    </section>
  );
};

export default MyWallet;
