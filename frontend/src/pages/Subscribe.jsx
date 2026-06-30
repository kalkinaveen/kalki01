import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Loader2, Crown, Zap, ShieldCheck, Flame, User, Sparkles, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import TierUpCelebration from '../components/TierUpCelebration';

const ICONS = { user: User, shield: ShieldCheck, crown: Crown, flame: Flame };

const Subscribe = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [current, setCurrent] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(null);
  const [celebrate, setCelebrate] = useState(null);

  useEffect(() => {
    if (!user) { nav('/login', { state: { from: '/subscribe' } }); return; }
    Promise.all([api.subscriptionTiers(), api.mySubscription()])
      .then(([t, s]) => {
        setTiers(t.tiers || []);
        setCurrent(s.tier);
        setWalletBalance(s.wallet_balance || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, nav]);

  const handleSubscribe = async (tier) => {
    if (tier.price_inr > walletBalance) {
      toast.error(`You need ₹${tier.price_inr - walletBalance} more — top up your wallet first`);
      nav('/me/wallet');
      return;
    }
    setActivating(tier.id);
    try {
      const out = await api.subscribe(tier.id);
      setCurrent(out.tier);
      setWalletBalance(b => b - tier.price_inr);
      setCelebrate(out.tier);
    } catch (e) {
      toast.error(e.message || 'Activation failed');
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  }

  return (
    <section className="relative min-h-screen overflow-hidden pb-20 sm:pb-28">
      {/* Royal ambient gradient floor */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/4 w-[36rem] h-[36rem] rounded-full opacity-20 blur-3xl" style={{ background: '#ffd34d' }} />
        <div className="absolute top-40 right-0 w-[28rem] h-[28rem] rounded-full opacity-15 blur-3xl" style={{ background: '#ff2d92' }} />
        <div className="absolute bottom-0 left-0 w-[28rem] h-[28rem] rounded-full opacity-15 blur-3xl" style={{ background: '#4de0ff' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
        {/* Hero */}
        <div className="text-center mb-12 sm:mb-16" data-testid="subscribe-hero">
          <div className="eh-kicker justify-center mb-3" style={{ color: '#ffd34d' }}>
            <Crown size={11} /> OPERATIVE PASS
          </div>
          <h1
            className="font-black leading-[1.05]"
            style={{
              fontFamily: "'Cinzel', 'Space Grotesk', serif",
              fontSize: 'clamp(2rem, 7vw, 4rem)',
              letterSpacing: '-.01em',
            }}
          >
            Free is good.{' '}
            <span className="bg-gradient-to-r from-[#ffd34d] via-[#ff2d92] to-[#4de0ff] bg-clip-text text-transparent">
              Priority is better.
            </span>
          </h1>
          <p className="opacity-75 mt-4 max-w-2xl mx-auto text-sm sm:text-base" style={{ fontFamily: 'Inter,sans-serif' }}>
            Skip the queue. Discount every order. Wear your rank like a uniform. The Pass lasts 30 days, debits from your wallet — no card-on-file, no surprises.
          </p>
          {/* Wallet bar */}
          <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full border border-[var(--eh-border)] eh-mono text-[11px]" data-testid="subscribe-wallet-bar">
            <Wallet size={12} className="text-[var(--eh-green)]" /> WALLET: <b className="eh-neon">₹{walletBalance.toLocaleString('en-IN')}</b>
            <a href="/me/wallet" className="ml-2 underline decoration-dotted opacity-80 hover:opacity-100">top up →</a>
          </div>
          {current && current.rank > 0 && (
            <div className="mt-3 text-sm opacity-80" data-testid="subscribe-current-tier">
              Currently active: <b style={{ color: current.color }}>{current.name}</b>
            </div>
          )}
        </div>

        {/* Tier cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" data-testid="subscribe-tier-grid">
          {tiers.map(tier => {
            const Icon = ICONS[tier.icon] || User;
            const isCurrent = current?.id === tier.id;
            const isFree = tier.price_inr === 0;
            const isUpgrade = current && tier.rank > current.rank;
            const isDowngrade = current && tier.rank < current.rank;
            return (
              <div
                key={tier.id}
                className="sub-card relative overflow-hidden rounded-2xl border-2 p-5 sm:p-6 flex flex-col"
                data-testid={`sub-tier-${tier.id}`}
                style={{
                  borderColor: isCurrent ? tier.color : `${tier.color}55`,
                  background: `linear-gradient(160deg, ${tier.color}14 0%, transparent 60%), rgba(8,10,12,.4)`,
                  boxShadow: isCurrent ? `0 0 0 1px ${tier.color}88, 0 18px 50px -16px ${tier.color}88` : 'none',
                  '--c': tier.color,
                }}
              >
                <span aria-hidden className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }} />
                {isCurrent && (
                  <div
                    className="absolute -top-2 right-3 eh-mono text-[9px] tracking-widest px-2 py-1 rounded font-bold"
                    style={{ background: tier.color, color: '#000' }}
                  >
                    ACTIVE
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl grid place-items-center"
                    style={{ background: `${tier.color}1a`, border: `1px solid ${tier.color}55`, color: tier.color }}
                  >
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                  {tier.rank === 3 && (
                    <span className="eh-mono text-[9px] tracking-widest opacity-90 px-1.5 py-0.5 rounded font-bold" style={{ background: `${tier.color}22`, color: tier.color }}>
                      TOP TIER
                    </span>
                  )}
                </div>
                <div
                  className="font-black text-2xl sm:text-3xl mb-1"
                  style={{ fontFamily: "'Cinzel', serif", color: tier.color, letterSpacing: '.02em' }}
                >
                  {tier.name}
                </div>
                <div className="eh-mono text-[10px] opacity-70 mb-3 leading-snug min-h-[28px]">
                  {tier.tagline}
                </div>
                <div className="mb-4">
                  {isFree ? (
                    <span className="text-3xl font-black eh-neon">FREE</span>
                  ) : (
                    <>
                      <span className="text-3xl font-black" style={{ color: tier.color }}>₹{tier.price_inr.toLocaleString('en-IN')}</span>
                      <span className="opacity-60 text-sm ml-1">/ 30 days</span>
                    </>
                  )}
                </div>
                <ul className="space-y-1.5 flex-1 mb-5">
                  {tier.perks.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] leading-snug" style={{ fontFamily: 'Inter,sans-serif' }}>
                      <Check size={13} className="shrink-0 mt-0.5" style={{ color: tier.color }} />
                      <span className="opacity-85">{p}</span>
                    </li>
                  ))}
                </ul>
                {isFree ? (
                  <button
                    disabled
                    className="eh-btn-ghost text-xs justify-center py-2.5 opacity-70"
                    data-testid={`sub-cta-${tier.id}`}
                  >
                    Default tier
                  </button>
                ) : isCurrent ? (
                  <button
                    onClick={() => toast.info('You\'re already on this tier — enjoy the spoils.')}
                    className="text-xs justify-center py-2.5 rounded-md border eh-mono tracking-widest"
                    style={{ borderColor: tier.color, color: tier.color }}
                    data-testid={`sub-cta-${tier.id}`}
                  >
                    YOU'RE ON THIS PASS
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(tier)}
                    disabled={activating === tier.id}
                    className="flex items-center justify-center gap-1.5 text-xs py-2.5 font-bold tracking-widest rounded-md transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: tier.color, color: '#000' }}
                    data-testid={`sub-cta-${tier.id}`}
                  >
                    {activating === tier.id ? (
                      <><Loader2 size={12} className="animate-spin" /> ACTIVATING…</>
                    ) : (
                      <>{isDowngrade ? 'SWITCH' : 'ACTIVATE'} · ₹{tier.price_inr} <ArrowRight size={12} /></>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Trust / FAQ strip */}
        <div className="grid md:grid-cols-3 gap-4 mt-12 max-w-5xl mx-auto" data-testid="subscribe-trust">
          {[
            { Icon: Wallet,      title: 'Wallet-debit only',  body: 'No credit-card-on-file. Top up once, activate any tier instantly, cancel anytime.' },
            { Icon: ShieldCheck, title: 'Priority you can see', body: 'Your tier badge floats next to every order ID — support sees it, your engineer sees it.' },
            { Icon: Sparkles,    title: '30-day passes',       body: "Try it for a month. Auto-renew arrives next iteration; for now we'll remind you before expiry." },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="eh-panel p-4 sm:p-5">
              <Icon size={18} className="text-[var(--eh-green)] mb-2" />
              <div className="font-bold text-sm mb-1" style={{ fontFamily: 'Inter,sans-serif' }}>{title}</div>
              <div className="eh-mono text-[11px] opacity-70 leading-relaxed">{body}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .sub-card { transition: transform .35s cubic-bezier(.2,.9,.3,1), border-color .25s ease, box-shadow .35s ease; }
        .sub-card:hover { transform: translateY(-4px); border-color: var(--c); box-shadow: 0 18px 50px -16px var(--c); }
      `}</style>

      <TierUpCelebration tier={celebrate} onClose={() => { setCelebrate(null); nav('/me'); }} />
    </section>
  );
};

export default Subscribe;
