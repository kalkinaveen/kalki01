import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Terminal, ChevronDown } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import Typewriter from './Typewriter';

const Hero = () => {
  const { config } = useSiteConfig();
  const SITE = config.site;
  const HERO = config.hero;
  return (
    <section className="relative min-h-[88vh] flex items-center justify-center eh-grid-bg overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 50% at 50% 35%, rgba(0,255,157,0.10), transparent 60%)' }} />
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="eh-kicker justify-center mb-5 text-[10px] sm:text-xs">{HERO.kicker}</div>
        <div className="eh-mono text-[10px] sm:text-sm tracking-[.4em] opacity-70 mb-3">{HERO.welcome}</div>
        <h1 className="eh-brand font-black leading-none mb-5 px-2 whitespace-nowrap relative" style={{ fontSize: 'clamp(1.6rem, 8vw, 7rem)' }}>
          <span data-testid="hero-title" className="inline-block">
            <span className="eh-title-error">ERROR</span><span className="eh-title-hacker">HACKER</span>
          </span>
        </h1>
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-5 px-2">
          <span className="hidden sm:block h-px w-8 sm:w-16 bg-[var(--eh-green)] opacity-60 shrink-0" />
          <h2 className="eh-script leading-tight" style={{ fontSize: 'clamp(1.6rem, 5.5vw, 3rem)' }}>{SITE.tagline}</h2>
          <span className="hidden sm:block h-px w-8 sm:w-16 bg-[var(--eh-green)] opacity-60 shrink-0" />
        </div>
        <div className="eh-mono text-xs sm:text-sm opacity-90 mb-6" style={{ color: 'var(--eh-green)' }}>
          &gt; <Typewriter words={HERO.typewriterLines} />
        </div>
        {/* Brand-pillar quote — short, memorable, prints well on social shares. */}
        <blockquote
          data-testid="hero-quote"
          className="relative mx-auto max-w-3xl px-4 sm:px-8 mb-7 sm:mb-9"
          style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
        >
          <span aria-hidden className="hidden sm:block absolute left-0 top-2 text-3xl leading-none text-[var(--eh-green)] opacity-50">&ldquo;</span>
          <span aria-hidden className="hidden sm:block absolute right-0 bottom-2 text-3xl leading-none text-[var(--eh-green)] opacity-50">&rdquo;</span>
          <p className="font-bold italic text-base sm:text-xl md:text-2xl leading-snug">
            We don't sell <span className="line-through opacity-50 not-italic font-normal">shortcuts</span>.
            We sell <span className="eh-neon not-italic">unfair advantages</span>.
          </p>
        </blockquote>
        <p className="max-w-2xl mx-auto eh-mono text-xs sm:text-sm md:text-base leading-6 sm:leading-7 opacity-80 mb-8 sm:mb-10 px-2">{SITE.description}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
          <Link to={HERO.primaryCtaTo} className="eh-btn-primary text-xs sm:text-sm w-full sm:w-auto">{HERO.primaryCta} <ArrowRight size={16} /></Link>
          <Link to={HERO.ghostCtaTo} className="eh-btn-ghost text-xs sm:text-sm w-full sm:w-auto justify-center"><Terminal size={14} />{HERO.ghostCta}</Link>
        </div>
        <div className="mt-14 sm:mt-20 flex flex-col items-center gap-2 opacity-70">
          <div className="eh-mono text-[10px] tracking-[.5em]">SCROLL</div>
          <ChevronDown className="animate-bounce" size={18} color="var(--eh-green)" />
        </div>
      </div>
    </section>
  );
};
export default Hero;
