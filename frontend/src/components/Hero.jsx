import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Terminal, ChevronDown } from 'lucide-react';
import { SITE } from '../mock';

const Hero = () => (
  <section className="relative min-h-[88vh] flex items-center justify-center eh-grid-bg overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 50% at 50% 35%, rgba(0,255,157,0.10), transparent 60%)' }} />
    <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 text-center">
      <div className="eh-kicker justify-center mb-6">SYSTEM ONLINE // SECURE CONNECTION</div>
      <h1 className="eh-script text-5xl sm:text-6xl md:text-7xl leading-tight mb-8 eh-glitch">{SITE.tagline}</h1>
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
