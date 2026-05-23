import React from 'react';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { Check, Star, Lock, Zap, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import PricingComparison from '../components/PricingComparison';
import FAQ from '../components/FAQ';

const MembershipsPage = () => {
  const { config } = useSiteConfig();
  const subscribe = (m) => {
    const subs = JSON.parse(localStorage.getItem('eh_subs') || '[]');
    subs.unshift({ tier: m.id, name: m.name, price: m.price, at: new Date().toISOString() });
    localStorage.setItem('eh_subs', JSON.stringify(subs));
    toast.success(`${m.name} tier selected`, { description: 'Proceed to checkout (mock).' });
  };
  return (
    <div className="pt-10 pb-10 eh-grid-bg">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10 sm:mb-12">
          <div className="eh-kicker justify-center mb-3">// MEMBERSHIPS</div>
          <h1 className="eh-display font-black" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}>JOIN THE <span className="eh-neon">UNDERGROUND</span></h1>
          <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm">Cancel anytime. Encrypted payments. Operative-only access.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {config.memberships.map(m => (
            <div key={m.id} className={`eh-panel eh-brackets p-6 sm:p-7 relative eh-card ${m.popular ? 'eh-panel-glow' : ''}`} style={ m.popular ? { borderColor: 'rgba(0,255,157,.55)' } : {}}>
              <span className="br-bl" /><span className="br-br" />
              {m.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 eh-mono text-[10px] tracking-widest px-3 py-1 rounded" style={{ background:'var(--eh-green)', color:'#001a10' }}>MOST POPULAR</span>}
              <div className="flex items-center gap-2 mb-2">{m.color==='red' && <Zap size={18} color="var(--eh-red)" />}{m.color==='green' && <Star size={18} color="var(--eh-green)" />}{m.color==='cyan' && <Lock size={18} color="var(--eh-cyan)" />}<div className="eh-display text-xl font-black tracking-widest">{m.name}</div></div>
              <div className="flex items-baseline gap-1 my-3"><span className="eh-display text-4xl sm:text-5xl font-black eh-neon">${m.price}</span><span className="opacity-60 eh-mono">/{m.period}</span></div>
              <ul className="space-y-2 mb-6 mt-4">{(m.perks || []).map(p => (<li key={p} className="flex items-start gap-2 text-sm"><Check size={16} color="var(--eh-green)" className="mt-0.5 shrink-0" /><span>{p}</span></li>))}</ul>
              <button onClick={() => subscribe(m)} className="eh-btn-primary w-full text-xs">SUBSCRIBE NOW <ArrowRight size={14} /></button>
            </div>
          ))}
        </div>
      </div>
      <PricingComparison />
      <FAQ limit={5} />
    </div>
  );
};
export default MembershipsPage;
