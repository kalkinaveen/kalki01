import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const FAQ = ({ limit }) => {
  const { config } = useSiteConfig();
  const data = limit ? (config.faqs || []).slice(0, limit) : (config.faqs || []);
  const [open, setOpen] = useState(0);
  if (data.length === 0) return null;
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="eh-kicker justify-center mb-3">// FAQ_DB</div>
          <h2 className="eh-display font-black" style={{ fontSize: 'clamp(1.6rem, 4.5vw, 3rem)' }}>FREQUENTLY <span className="eh-neon">ASKED</span></h2>
        </div>
        <div className="space-y-3">
          {data.map((f, idx) => (
            <div key={idx} className="eh-panel transition-colors" style={{ borderColor: open===idx ? 'rgba(0,255,157,.45)' : 'var(--eh-border)' }}>
              <button onClick={() => setOpen(o => o===idx ? -1 : idx)} className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <span className="eh-mono text-xs eh-neon-soft">{String(idx+1).padStart(2,'0')}</span>
                  <span className="font-semibold text-sm sm:text-base" style={{ fontFamily: 'Inter,sans-serif' }}>{f.q}</span>
                </div>
                <span className="w-7 h-7 grid place-items-center rounded shrink-0" style={{ border: '1px solid var(--eh-border)' }}>
                  {open===idx ? <Minus size={14} color="var(--eh-green)" /> : <Plus size={14} color="var(--eh-green)" />}
                </span>
              </button>
              <div className="overflow-hidden transition-[max-height,opacity] duration-300" style={{ maxHeight: open===idx ? 400 : 0, opacity: open===idx ? 1 : 0 }}>
                <div className="px-4 sm:px-5 pb-5 text-sm leading-7 opacity-80" style={{ borderTop: '1px dashed var(--eh-border)' }}>{f.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default FAQ;
