import React, { useEffect, useState } from 'react';
import { TESTIMONIALS } from '../mock';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const TestimonialsCarousel = () => {
  const [i, setI] = useState(0);
  const total = TESTIMONIALS.length;
  useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % total), 5500);
    return () => clearInterval(id);
  }, [total]);
  const t = TESTIMONIALS[i];
  return (
    <section className="py-16 sm:py-20 eh-grid-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="eh-kicker justify-center mb-3">// CLIENT_FEEDBACK</div>
          <h2 className="eh-display font-black" style={{ fontSize: 'clamp(1.6rem, 5vw, 3rem)' }}>TRUSTED BY <span className="eh-neon">OPERATORS</span></h2>
        </div>
        <div className="eh-panel eh-brackets p-6 sm:p-10 relative min-h-[260px]">
          <span className="br-bl" /><span className="br-br" />
          <Quote className="absolute top-5 right-5 opacity-10" size={70} color="var(--eh-green)" />
          <div className="flex gap-1 mb-4">{Array.from({length:5}).map((_,k)=><Star key={k} size={16} fill="var(--eh-green)" color="var(--eh-green)" />)}</div>
          <p className="text-base sm:text-lg leading-7 sm:leading-8 mb-6 max-w-2xl" style={{ fontFamily: 'Inter,sans-serif' }}>{t.text}</p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full grid place-items-center eh-display font-black eh-neon" style={{ background: 'rgba(0,255,157,.08)', border: '1px solid rgba(0,255,157,.3)' }}>{t.name[0]}</div>
              <div><div className="font-semibold" style={{ fontFamily: 'Inter,sans-serif' }}>{t.name}</div><div className="eh-mono text-xs opacity-60">// {t.role}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setI((i-1+total)%total)} className="w-9 h-9 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)]"><ChevronLeft size={16} /></button>
              <div className="eh-mono text-xs opacity-70 px-2">{String(i+1).padStart(2,'0')} / {String(total).padStart(2,'0')}</div>
              <button onClick={() => setI((i+1)%total)} className="w-9 h-9 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)]"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default TestimonialsCarousel;
