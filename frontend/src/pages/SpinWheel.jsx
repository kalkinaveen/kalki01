import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Trophy, Clock, Wallet as WalletIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Daily Spin Wheel.
 * - Fetches /spin/config (public-safe, no weights) for prize labels & colors
 * - Fetches /me/spin/status for cooldown
 * - On POST /me/spin/spin, server picks prize (weighted) and credits wallet.
 *   We then animate the wheel to land on the winning slice (3.5s spin).
 */
const TWO_PI = Math.PI * 2;

const SpinWheel = () => {
  const { user, loading } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winning, setWinning] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const wheelRef = useRef(null);

  const reload = async () => {
    try {
      const c = await api.spinConfig();
      setCfg(c);
      if (user) setStatus(await api.spinStatus());
    } catch (e) { /* ignore */ }
  };
  useEffect(() => { reload(); }, [user]);

  // Live countdown to next spin
  useEffect(() => {
    if (!status?.next_at) { setTimeLeft(''); return; }
    const tick = () => {
      const diff = new Date(status.next_at).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(''); reload(); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [status?.next_at]);

  if (loading) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  if (!user) return <section className="min-h-[60vh] grid place-items-center"><Link to="/login" className="eh-btn-primary">Sign in to play</Link></section>;
  if (!cfg) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  if (!cfg.enabled) return <section className="min-h-[60vh] grid place-items-center text-center"><div><h1 className="eh-display text-2xl font-black mb-2">Spin Wheel Paused</h1><p className="eh-mono text-xs opacity-60">Check back soon.</p></div></section>;

  const prizes = cfg.prizes || [];
  const slice = TWO_PI / prizes.length;

  const handleSpin = async () => {
    if (spinning || !status?.can_spin) return;
    setSpinning(true);
    setWinning(null);
    try {
      const res = await api.spinSpin();
      const idx = prizes.findIndex(p => p.id === res.prize.id);
      // Land the pointer (top, 0°) at the centre of the winning slice.
      // Slice i centres at angle (i + 0.5) * slice. We add 6 full turns for spin drama.
      const target = -(idx + 0.5) * slice;
      const fullTurns = 6 * TWO_PI;
      const final = (rotation || 0) % TWO_PI - ((rotation || 0) % TWO_PI) + fullTurns + target;
      setRotation(final);
      // Reveal prize after CSS transition
      setTimeout(() => {
        setWinning(res.prize);
        setSpinning(false);
        reload();
        if (res.prize.type === 'credit' && res.prize.amount > 0) {
          toast.success(`Won ${res.prize.label}!`, { description: 'Credited to your wallet 💸' });
        } else {
          toast.message(res.prize.label, { description: 'No worries — try again tomorrow!' });
        }
      }, 3700);
    } catch (e) {
      setSpinning(false);
      toast.error(e.message || 'Spin failed');
      if (e.status === 429) reload();
    }
  };

  // Build conic-gradient backgrounds for the wheel
  const conicSegments = prizes.map((p, i) => {
    const startDeg = (i * 360) / prizes.length;
    const endDeg = ((i + 1) * 360) / prizes.length;
    return `${p.color || '#3a3f44'} ${startDeg}deg ${endDeg}deg`;
  }).join(', ');

  return (
    <section className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
      <div className="mb-8 text-center">
        <div className="eh-kicker justify-center mb-2">// DAILY SPIN</div>
        <h1 className="eh-display font-black mb-2" style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}>Win <span className="eh-neon">Free Wallet Credit</span></h1>
        <p className="eh-mono text-xs opacity-70 max-w-md mx-auto leading-6">One spin every {cfg.cooldown_hours}h. Up to ₹500 jackpot. Credited instantly to your wallet.</p>
      </div>

      <div className="flex flex-col items-center gap-8">
        {/* Wheel */}
        <div className="relative" style={{ width: 'min(90vw, 420px)' }}>
          {/* Pointer */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10" style={{ width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '26px solid var(--eh-green)', filter: 'drop-shadow(0 0 8px rgba(0,255,157,0.6))' }} />
          <div className="aspect-square rounded-full relative overflow-hidden" style={{
            background: `conic-gradient(from -90deg, ${conicSegments})`,
            transform: `rotate(${rotation}rad)`,
            transition: spinning ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.21, 0.99)' : 'none',
            boxShadow: '0 0 60px rgba(0,255,157,0.15), inset 0 0 30px rgba(0,0,0,0.4)',
            border: '4px solid var(--eh-border)',
          }} ref={wheelRef} data-testid="spin-wheel">
            {prizes.map((p, i) => {
              const angle = (i + 0.5) * (360 / prizes.length) - 90;
              return (
                <div key={p.id} className="absolute top-1/2 left-1/2" style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0, -38%)` }}>
                  <div className="eh-mono font-bold text-xs sm:text-sm text-black whitespace-nowrap" style={{ transform: 'rotate(90deg)', textShadow: '0 1px 2px rgba(255,255,255,0.3)' }}>
                    {p.label}
                  </div>
                </div>
              );
            })}
            {/* Center hub */}
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-[#0d1115] border-2 border-[var(--eh-green)] grid place-items-center" style={{ boxShadow: '0 0 20px rgba(0,255,157,0.5)' }}>
                <Sparkles size={22} className="text-[var(--eh-green)]" />
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center w-full max-w-md">
          {status?.can_spin ? (
            <button onClick={handleSpin} disabled={spinning} data-testid="spin-go-btn" className="eh-btn-primary text-base sm:text-lg px-8 py-4 inline-flex items-center gap-2 disabled:opacity-50">
              {spinning ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} {spinning ? 'SPINNING…' : 'SPIN NOW'}
            </button>
          ) : (
            <div className="eh-panel p-5 text-center" data-testid="spin-cooldown">
              <Clock size={22} className="text-[#ffd34d] mx-auto mb-2" />
              <div className="eh-display text-lg font-black mb-1">Next spin in</div>
              <div className="eh-neon eh-mono text-2xl font-bold mb-1">{timeLeft || '…'}</div>
              <div className="eh-mono text-[11px] opacity-60">Come back daily to keep winning credit</div>
            </div>
          )}
          {winning && (
            <div className="eh-panel p-4 mt-4 bg-[rgba(0,255,157,.04)] border border-[rgba(0,255,157,.25)]" data-testid="spin-result">
              <Trophy size={20} className="text-[#ffd34d] mx-auto mb-1" />
              <div className="eh-display font-black text-xl">{winning.label}</div>
              {winning.type === 'credit' && winning.amount > 0 ? (
                <div className="eh-mono text-xs opacity-80 mt-1">credited to your <Link to="/me/wallet" className="eh-neon underline inline-flex items-center gap-1"><WalletIcon size={10} /> wallet</Link></div>
              ) : (
                <div className="eh-mono text-xs opacity-70 mt-1">try again tomorrow 🤞</div>
              )}
            </div>
          )}
          <div className="flex justify-center gap-3 mt-4">
            <Link to="/me/wallet" className="eh-btn-ghost text-xs"><WalletIcon size={12} /> WALLET</Link>
            <Link to="/me" className="eh-btn-ghost text-xs">← ACCOUNT</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpinWheel;
