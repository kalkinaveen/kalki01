import React from 'react';
import { MessageSquare, Lock, Cpu, BadgeCheck, Shield, Zap, Send, Star } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const ICONS = { MessageSquare, Lock, Cpu, BadgeCheck, Shield, Zap, Send, Star };

const HowItWorks = () => {
  const { config } = useSiteConfig();
  return (
    <section className="py-16 sm:py-20 eh-grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="eh-kicker justify-center mb-3">// PROTOCOL</div>
          <h2 className="eh-display font-black" style={{ fontSize: 'clamp(1.6rem, 5vw, 3.2rem)' }}>HOW IT <span className="eh-neon">WORKS</span></h2>
          <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm">A 4-step protocol designed for speed, secrecy and zero drama.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
          <div className="hidden lg:block absolute top-10 left-[12%] right-[12%] h-px" style={{ background: 'repeating-linear-gradient(90deg, rgba(0,255,157,.4) 0 8px, transparent 8px 16px)' }} />
          {config.howSteps.map(s => { const I = ICONS[s.icon] || Shield; return (
            <div key={s.n} className="relative eh-panel eh-brackets p-6 eh-card">
              <span className="br-bl" /><span className="br-br" />
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-md grid place-items-center" style={{ background: 'rgba(0,255,157,.08)', border: '1px solid rgba(0,255,157,.25)' }}><I size={20} color="var(--eh-green)" /></div>
                <span className="eh-display font-black text-3xl opacity-20">{s.n}</span>
              </div>
              <div className="font-semibold mb-2" style={{ fontFamily: 'Inter,sans-serif' }}>{s.t}</div>
              <p className="text-sm opacity-70 leading-6">{s.d}</p>
            </div>
          );})}
        </div>
      </div>
    </section>
  );
};
export default HowItWorks;
