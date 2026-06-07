import React from 'react';
import Hero from '../components/Hero';
import Services from '../components/Services';
import HowItWorks from '../components/HowItWorks';
import LiveActivity from '../components/LiveActivity';
import Partners from '../components/Partners';
import WorksWithStrip from '../components/WorksWithStrip';
import TestimonialsCarousel from '../components/TestimonialsCarousel';
import FAQ from '../components/FAQ';
import CountUp from '../components/CountUp';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, FileText, Star, Lock, Zap, Calendar } from 'lucide-react';

const parseStatValue = (s) => {
  const m = String(s).match(/[\d.]+/);
  const num = m ? parseFloat(m[0]) : 0;
  const suffix = String(s).replace(/[\d.]+/, '');
  return { num, suffix };
};

const StatsRow = () => {
  const { config } = useSiteConfig();
  return (
    <section className="py-12 border-y border-[var(--eh-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {config.stats.map(s => {
          const { num, suffix } = parseStatValue(s.value);
          const isFloat = String(num).includes('.');
          return (
            <div key={s.label} className="text-center">
              <div className="eh-display font-black eh-neon" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.6rem)' }}>
                {isFloat ? s.value : <CountUp end={num} suffix={suffix} />}
              </div>
              <div className="eh-mono text-[10px] sm:text-xs tracking-[.3em] opacity-60 mt-2">{s.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const BooksTeaser = () => {
  const { config } = useSiteConfig();
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-8 sm:mb-10 flex-wrap gap-4">
          <div>
            <div className="eh-kicker mb-3">// LIBRARY</div>
            <h2 className="eh-display font-black" style={{ fontSize: 'clamp(1.6rem, 5vw, 3.2rem)' }}>HACKING <span className="eh-neon">EBOOKS</span></h2>
          </div>
          <Link to="/books" className="eh-btn-ghost text-xs">BROWSE LIBRARY <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {config.books.slice(0,4).map(b => (
            <Link key={b.id} to="/books" className="eh-card eh-panel p-3 sm:p-4 group">
              <div className="relative aspect-[3/4] rounded overflow-hidden mb-3 sm:mb-4 bg-black">
                <img src={b.cover} alt={b.title} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
                {b.tag && <span className="absolute top-2 left-2 eh-mono text-[10px] tracking-widest px-2 py-1 rounded" style={{ background:'var(--eh-green)', color:'#001a10' }}>{b.tag}</span>}
              </div>
              <div className="text-xs sm:text-sm font-semibold leading-snug" style={{ fontFamily:'Inter,sans-serif' }}>{b.title}</div>
              <div className="flex items-center justify-between mt-2 eh-mono text-[11px] opacity-70">
                <span className="truncate">{b.author}</span><span className="eh-neon-soft shrink-0 ml-2">${b.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const MembershipsBlock = () => {
  const { config } = useSiteConfig();
  return (
    <section className="py-16 sm:py-20 eh-grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-12">
          <div className="eh-kicker justify-center mb-3">// MEMBERSHIPS</div>
          <h2 className="eh-display font-black" style={{ fontSize: 'clamp(1.6rem, 5vw, 3.2rem)' }}>JOIN THE <span className="eh-neon">UNDERGROUND</span></h2>
          <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm">Choose your operative tier. Cancel anytime. Encrypted payments only.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {config.memberships.map(m => (
            <div key={m.id} className={`eh-panel eh-brackets p-6 sm:p-7 relative eh-card ${m.popular ? 'eh-panel-glow' : ''}`} style={ m.popular ? { borderColor: 'rgba(0,255,157,.55)' } : {}}>
              <span className="br-bl" /><span className="br-br" />
              {m.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 eh-mono text-[10px] tracking-widest px-3 py-1 rounded" style={{ background:'var(--eh-green)', color:'#001a10' }}>MOST POPULAR</span>}
              <div className="flex items-center gap-2 mb-2">{m.color==='red' && <Zap size={18} color="var(--eh-red)" />}{m.color==='green' && <Star size={18} color="var(--eh-green)" />}{m.color==='cyan' && <Lock size={18} color="var(--eh-cyan)" />}<div className="eh-display text-xl font-black tracking-widest">{m.name}</div></div>
              <div className="flex items-baseline gap-1 my-3">
                <span className="eh-display text-4xl sm:text-5xl font-black eh-neon">${m.price}</span>
                <span className="opacity-60 eh-mono">/{m.period}</span>
              </div>
              <ul className="space-y-2 mb-6 mt-4">
                {(m.perks || []).map(p => (<li key={p} className="flex items-start gap-2 text-sm"><Check size={16} color="var(--eh-green)" className="mt-0.5 shrink-0" /><span>{p}</span></li>))}
              </ul>
              <Link to="/memberships" className="eh-btn-primary w-full text-xs">SUBSCRIBE NOW <ArrowRight size={14} /></Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const BlogsTeaser = () => {
  const { config } = useSiteConfig();
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-12">
          <div className="eh-kicker justify-center mb-3">// LATEST BLOGS</div>
          <h2 className="eh-display font-black" style={{ fontSize: 'clamp(1.6rem, 5vw, 3.2rem)' }}>EXPLORE OUR MOST <span className="eh-neon">POPULAR POSTS</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {config.blogs.slice(0,3).map(p => (
            <Link key={p.id} to="/blogs" className="eh-card eh-panel overflow-hidden group">
              <div className="relative aspect-video overflow-hidden">
                <img src={p.cover} alt={p.title} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-3 left-3 eh-mono text-[10px] tracking-widest px-2 py-1 rounded bg-black/70 text-white flex items-center gap-1"><FileText size={10} /> {p.tag}</span>
              </div>
              <div className="p-5">
                <div className="text-base font-semibold leading-snug mb-2" style={{ fontFamily:'Inter,sans-serif' }}>{p.title}</div>
                <div className="text-sm opacity-70 leading-6 mb-3 line-clamp-2">{p.excerpt}</div>
                <div className="eh-mono text-[11px] opacity-60 flex items-center gap-1"><Calendar size={11} />{p.date}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTA = () => (
  <section className="py-16 sm:py-20">
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <div className="eh-panel eh-brackets p-8 sm:p-14 text-center relative overflow-hidden">
        <span className="br-bl" /><span className="br-br" />
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: 'radial-gradient(50% 60% at 50% 40%, rgba(0,255,157,.10), transparent 70%)' }} />
        <div className="relative">
          <div className="eh-kicker justify-center mb-3">// READY_OPERATOR?</div>
          <h2 className="eh-display font-black mb-4" style={{ fontSize: 'clamp(1.8rem, 6vw, 3.6rem)' }}>RUN YOUR FIRST <span className="eh-neon">OP TODAY</span></h2>
          <p className="opacity-80 max-w-xl mx-auto text-sm mb-7">From $7 social packages to full pentest engagements. Encrypted from the first byte.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/services" className="eh-btn-primary text-xs">EXPLORE SERVICES <ArrowRight size={14} /></Link>
            <Link to="/memberships" className="eh-btn-ghost text-xs">VIEW MEMBERSHIPS</Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Home = () => (
  <>
    <Hero />
    <WorksWithStrip />
    <Partners />
    <StatsRow />
    <Services limit={6} />
    <HowItWorks />
    <LiveActivity />
    <BooksTeaser />
    <MembershipsBlock />
    <BlogsTeaser />
    <TestimonialsCarousel />
    <FAQ limit={5} />
    <CTA />
  </>
);
export default Home;
