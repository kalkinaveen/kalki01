import React from 'react';
import { Check, X, Star, Lock, Zap } from 'lucide-react';

const FEATURES = [
  { f: 'Weekly intel briefings', r: true, o: true, e: true },
  { f: 'Community Telegram', r: true, o: true, e: true },
  { f: 'Premium tools & scripts', r: false, o: true, e: true },
  { f: 'Full eBook library', r: false, o: true, e: true },
  { f: '24/7 priority support', r: false, o: true, e: true },
  { f: '1-on-1 mentorship', r: false, o: false, e: true },
  { f: 'Custom automation builds', r: false, o: false, e: true },
  { f: 'Private red-team labs', r: false, o: false, e: true },
  { f: 'Lifetime updates', r: false, o: false, e: true },
];

const Cell = ({ v }) => v ? <Check size={16} color="var(--eh-green)" /> : <X size={14} className="opacity-30" />;

const PricingComparison = () => (
  <section className="py-16 sm:py-20">
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-10">
        <div className="eh-kicker justify-center mb-3">// MATRIX</div>
        <h2 className="eh-display font-black" style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}>COMPARE <span className="eh-neon">TIERS</span></h2>
      </div>
      <div className="eh-panel eh-brackets overflow-x-auto eh-scroll">
        <span className="br-bl" /><span className="br-br" />
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-[var(--eh-border)]">
              <th className="text-left p-4 eh-mono text-xs tracking-widest opacity-60 w-1/2">FEATURE</th>
              <th className="p-4 text-center"><div className="flex flex-col items-center gap-1"><Lock size={14} color="var(--eh-cyan)" /><div className="eh-display font-black text-sm tracking-widest">ROOKIE</div><div className="eh-mono text-[11px] opacity-60">$5/mo</div></div></th>
              <th className="p-4 text-center relative" style={{ background: 'rgba(0,255,157,.04)' }}><div className="flex flex-col items-center gap-1"><Star size={14} color="var(--eh-green)" /><div className="eh-display font-black text-sm tracking-widest eh-neon">OPERATOR</div><div className="eh-mono text-[11px] opacity-60">$19/mo</div></div></th>
              <th className="p-4 text-center"><div className="flex flex-col items-center gap-1"><Zap size={14} color="var(--eh-red)" /><div className="eh-display font-black text-sm tracking-widest">ELITE</div><div className="eh-mono text-[11px] opacity-60">$49/mo</div></div></th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((row, idx) => (
              <tr key={idx} className="border-b border-[var(--eh-border)]">
                <td className="p-4 text-sm" style={{ fontFamily: 'Inter,sans-serif' }}>{row.f}</td>
                <td className="p-4 text-center"><Cell v={row.r} /></td>
                <td className="p-4 text-center" style={{ background: 'rgba(0,255,157,.04)' }}><Cell v={row.o} /></td>
                <td className="p-4 text-center"><Cell v={row.e} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);
export default PricingComparison;
