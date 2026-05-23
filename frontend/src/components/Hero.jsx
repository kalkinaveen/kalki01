import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Terminal, ChevronDown } from 'lucide-react';
import { SITE } from '../mock';

const Hero = () => (
  <section className="relative min-h-[88vh] flex items-center justify-center eh-grid-bg overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 50% at 50% 35%, rgba(0,255,157,0.10), transparent 60%)' }} />
    <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 text-center">
      <div className="eh-kicker justify-center mb-6">SYSTEM ONLINE // SECURE CONNECTION_</div>
      <div className="eh-mono text-xs sm:text-sm tracking-[.4em] opacity-70 mb-3">WELCOME TO</div>
      <h1 className="eh-brand eh-glitch font-black text-6xl sm:text-8xl md:text-9xl leading-none mb-6 eh-title-glitch">
        <span className="eh-title-main" data-text={SITE.name}>
          <span className="eh-chrom-r" aria-hidden="true">{SITE.name}</span>
          <span className="eh-chrom-c" aria-hidden="true">{SITE.name}</span>
          {SITE.name}
        </span>
      </h1>
      <div className="flex items-center justify-center gap-4 mb-6">
        <span className="h-px w-10 sm:w-20 bg-[var(--eh-green)] opacity-60" />
        <h2 className="eh-script text-3xl sm:text-4xl md:text-5xl leading-tight">{SITE.tagline}</h2>
        <span className="h-px w-10 sm:w-20 bg-[var(--eh-green)] opacity-60" />
      </div>
      <p className="max-w-2xl mx-auto eh-mono text-sm md:text-base leading-7 opacity-80 mb-10">{SITE.description}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link to="/services" className="eh-btn-primary text-sm">Explore Our Services <ArrowRight size={18} /></Link>
        <Link to="/tools" className="eh-btn-ghost text-sm"><Terminal size={16} />&gt; view_tools</Link>
      </div>
      <div className="mt-20 flex flex-col items-center gap-2 opacity-70">
        <div className="eh-mono text-[10px] tracking-[.5em]">SCROLL</div>
        <ChevronDown className="animate-bounce" size={18} color="var(--eh-green)" />
      </div>
    </div>
  </section>
);
export default Hero;
