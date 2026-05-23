import React from 'react';
import { Check, X, Star, Lock, Zap } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const Cell = ({ v }) => v ? <Check size={16} color="var(--eh-green)" /> : <X size={14} className="opacity-30" />;

const PricingComparison = () => {
  const { config } = useSiteConfig();
  const features = config.comparison || [];
  const [r, o, e] = config.memberships || [];
  return (
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
                <th className="p-4 text-center"><div className="flex flex-col items-center gap-1"><Lock size={14} color="var(--eh-cyan)" /><div className="eh-display font-black text-sm tracking-widest">{r?.name || 'ROOKIE'}</div><div className="eh-mono text-[11px] opacity-60">${r?.price ?? 5}/{r?.period || 'mo'}</div></div></th>
                <th className="p-4 text-center relative" style={{ background: 'rgba(0,255,157,.04)' }}><div className="flex flex-col items-center gap-1"><Star size={14} color="var(--eh-green)" /><div className="eh-display font-black text-sm tracking-widest eh-neon">{o?.name || 'OPERATOR'}</div><div className="eh-mono text-[11px] opacity-60">${o?.price ?? 19}/{o?.period || 'mo'}</div></div></th>
                <th className="p-4 text-center"><div className="flex flex-col items-center gap-1"><Zap size={14} color="var(--eh-red)" /><div className="eh-display font-black text-sm tracking-widest">{e?.name || 'ELITE'}</div><div className="eh-mono text-[11px] opacity-60">${e?.price ?? 49}/{e?.period || 'mo'}</div></div></th>
              </tr>
            </thead>
            <tbody>
              {features.map((row, idx) => (
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
};
export default PricingComparison;
