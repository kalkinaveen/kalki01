import React from 'react';
import { Shield, Users, Award, Globe, Mail, Send } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const InfoPage = () => {
  const { config } = useSiteConfig();
  const SITE = config.site;
  return (
    <div className="pt-10 pb-20">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <div className="eh-kicker justify-center mb-3">// WHO_WE_ARE</div>
          <h1 className="eh-display font-black" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}>ABOUT <span className="eh-neon">{SITE.name}</span></h1>
          <p className="opacity-70 mt-4 max-w-2xl mx-auto text-sm leading-7">We are a collective of ethical hackers, automation engineers and cybersecurity researchers. Our mission is to demystify the underground and equip the next generation of operators with knowledge, tools and trusted services.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {[
            { icon: Shield, label: 'Trusted Source', desc: '7+ years protecting clients' },
            { icon: Users, label: 'Community First', desc: '12k+ active operators' },
            { icon: Award, label: 'Award Winning', desc: 'Recognized methodology' },
            { icon: Globe, label: 'Global Reach', desc: 'Operating in 40+ countries' },
          ].map((b,i) => { const I = b.icon; return (
            <div key={i} className="eh-card eh-panel p-6 text-center">
              <div className="w-12 h-12 rounded-md mx-auto mb-4 grid place-items-center" style={{ background:'rgba(0,255,157,.08)', border:'1px solid rgba(0,255,157,.25)' }}><I size={22} color="var(--eh-green)" /></div>
              <div className="font-semibold mb-1" style={{ fontFamily:'Inter,sans-serif' }}>{b.label}</div>
              <div className="text-xs opacity-70">{b.desc}</div>
            </div>
          );})}
        </div>

        <div className="eh-panel eh-brackets p-6 md:p-10 mb-10">
          <span className="br-bl" /><span className="br-br" />
          <div className="eh-kicker mb-4">// MANIFESTO</div>
          <p className="text-sm leading-7 opacity-90">We believe that knowledge wants to be free. We weaponize curiosity. We test the boundaries, not the people. Every operation we run is encrypted, manual and double-checked. We never store more data than the operation requires. We deliver on time — or we deliver again, on the house.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {config.stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="eh-display text-3xl md:text-4xl font-black eh-neon">{s.value}</div>
              <div className="eh-mono text-xs tracking-[.3em] opacity-60 mt-2">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="eh-panel eh-brackets p-6 md:p-10 text-center">
          <span className="br-bl" /><span className="br-br" />
          <div className="eh-kicker justify-center mb-3">// REACH_OUT</div>
          <h2 className="eh-display text-2xl md:text-4xl font-black mb-3">NEED A <span className="eh-neon">CUSTOM OP?</span></h2>
          <p className="opacity-70 text-sm mb-6">Ping us on Telegram. Quotes returned within 12 hours.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={SITE.telegram} target="_blank" rel="noreferrer" className="eh-btn-primary"><Send size={16} /> TELEGRAM</a>
            <a href={`mailto:${SITE.email}`} className="eh-btn-ghost"><Mail size={14} /> EMAIL</a>
          </div>
        </div>
      </div>
    </div>
  );
};
export default InfoPage;
