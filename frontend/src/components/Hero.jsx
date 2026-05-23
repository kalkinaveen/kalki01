import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Terminal, ChevronDown } from 'lucide-react';
import { SITE } from '../mock';
import Typewriter from './Typewriter';

const Hero = () => (
  <section className="relative min-h-[88vh] flex items-center justify-center eh-grid-bg overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 50% at 50% 35%, rgba(0,255,157,0.10), transparent 60%)' }} />
    <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
      <div className="eh-kicker justify-center mb-5 text-[10px] sm:text-xs">SYSTEM ONLINE // SECURE CONNECTION_</div>
      <div className="eh-mono text-[10px] sm:text-sm tracking-[.4em] opacity-70 mb-3">WELCOME TO</div>
      <h1 className="eh-brand eh-glitch font-black leading-none mb-5 eh-title-glitch px-2 whitespace-nowrap" style={{ fontSize: 'clamp(1.6rem, 8vw, 7rem)' }}>
        <span className="eh-title-main inline-block" data-text={SITE.name}>
          <span className="eh-chrom-r" aria-hidden="true">{SITE.name}</span>
          <span className="eh-chrom-c" aria-hidden="true">{SITE.name}</span>
          {SITE.name}
        </span>
      </h1>
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-5 px-2">
        <span className="h-px w-6 sm:w-20 bg-[var(--eh-green)] opacity-60 shrink-0" />
        <h2 className="eh-script leading-tight" style={{ fontSize: 'clamp(1.4rem, 5vw, 3rem)' }}>{SITE.tagline}</h2>
        <span className="h-px w-6 sm:w-20 bg-[var(--eh-green)] opacity-60 shrink-0" />
      </div>
      <div className="eh-mono text-xs sm:text-sm opacity-90 mb-6" style={{ color: 'var(--eh-green)' }}>
        &gt; <Typewriter words={[
          'initializing operator session...',
          'access granted. ready when you are.',
          'select a service from the panel below.',
          'monetization toolkit loaded. enjoy.',
        ]} />
      </div>
      <p className="max-w-2xl mx-auto eh-mono text-xs sm:text-sm md:text-base leading-6 sm:leading-7 opacity-80 mb-8 sm:mb-10 px-2">{SITE.description}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
        <Link to="/services" className="eh-btn-primary text-xs sm:text-sm w-full sm:w-auto">Explore Our Services <ArrowRight size={16} /></Link>
        <Link to="/tools" className="eh-btn-ghost text-xs sm:text-sm w-full sm:w-auto justify-center"><Terminal size={14} />&gt; view_tools</Link>
      </div>
      <div className="mt-14 sm:mt-20 flex flex-col items-center gap-2 opacity-70">
        <div className="eh-mono text-[10px] tracking-[.5em]">SCROLL</div>
        <ChevronDown className="animate-bounce" size={18} color="var(--eh-green)" />
      </div>
    </div>
  </section>
);
export default Hero;
