import React from 'react';
import Hero from '../components/Hero';
import Services from '../components/Services';
import { STATS, BOOKS, MEMBERSHIPS, BLOGS, TESTIMONIALS } from '../mock';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, FileText, Star, Lock, Zap } from 'lucide-react';

const StatsRow = () => (
  <section className="py-10 border-y border-[var(--eh-border)]">
    <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
      {STATS.map(s => (
        <div key={s.label} className="text-center">
          <div className="eh-display text-3xl md:text-4xl font-black eh-neon">{s.value}</div>
          <div className="eh-mono text-xs tracking-[.3em] opacity-60 mt-2">{s.label}</div>
        </div>
      ))}
    </div>
  </section>
);

const BooksTeaser = () => (
  <section className="py-20">
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="eh-kicker mb-3">// LIBRARY</div>
          <h2 className="eh-display text-3xl md:text-5xl font-black">HACKING <span className="eh-neon">EBOOKS</span></h2>
        </div>
        <Link to="/books" className="eh-btn-ghost">BROWSE LIBRARY <ArrowRight size={16} /></Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {BOOKS.slice(0,4).map(b => (
          <Link key={b.id} to="/books" className="eh-card eh-panel p-4 group">
            <div className="relative aspect-[3/4] rounded overflow-hidden mb-4 bg-black">
              <img src={b.cover} alt={b.title} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
              {b.tag && <span className="absolute top-2 left-2 eh-mono text-[10px] tracking-widest px-2 py-1 rounded" style={{ background:'var(--eh-green)', color:'#001a10' }}>{b.tag}</span>}
            </div>
            <div className="text-sm font-semibold leading-snug" style={{ fontFamily:'Inter,sans-serif' }}>{b.title}</div>
            <div className="flex items-center justify-between mt-2 eh-mono text-xs opacity-70">
              <span>{b.author}</span><span className="eh-neon-soft">${b.price}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

const MembershipsBlock = () => (
  <section className="py-20 eh-grid-bg">
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <div className="text-center mb-12">
        <div className="eh-kicker justify-center mb-3">// MEMBERSHIPS</div>
        <h2 className="eh-display text-3xl md:text-5xl font-black">JOIN THE <span className="eh-neon">UNDERGROUND</span></h2>
        <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm">Choose your operative tier. Cancel anytime. Encrypted payments only.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {MEMBERSHIPS.map(m => (
          <div key={m.id} className={`eh-panel eh-brackets p-7 relative eh-card ${m.popular ? 'eh-panel-glow' : ''}`} style={ m.popular ? { borderColor: 'rgba(0,255,157,.55)' } : {}}>
            <span className="br-bl" /><span className="br-br" />
            {m.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 eh-mono text-[10px] tracking-widest px-3 py-1 rounded" style={{ background:'var(--eh-green)', color:'#001a10' }}>MOST POPULAR</span>}
            <div className="flex items-center gap-2 mb-2">{m.color==='red' && <Zap size={18} color="var(--eh-red)" />}{m.color==='green' && <Star size={18} color="var(--eh-green)" />}{m.color==='cyan' && <Lock size={18} color="var(--eh-cyan)" />}<div className="eh-display text-xl font-black tracking-widest">{m.name}</div></div>
            <div className="flex items-baseline gap-1 my-3">
              <span className="eh-display text-5xl font-black eh-neon">${m.price}</span>
              <span className="opacity-60 eh-mono">/{m.period}</span>
            </div>
            <ul className="space-y-2 mb-6 mt-4">
              {m.perks.map(p => (<li key={p} className="flex items-start gap-2 text-sm"><Check size={16} color="var(--eh-green)" className="mt-0.5 shrink-0" /><span>{p}</span></li>))}
            </ul>
            <button className="eh-btn-primary w-full text-xs">SUBSCRIBE NOW <ArrowRight size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const BlogsTeaser = () => (
  <section className="py-20">
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <div className="text-center mb-12">
        <div className="eh-kicker justify-center mb-3">// LATEST BLOGS</div>
        <h2 className="eh-display text-3xl md:text-5xl font-black">EXPLORE OUR MOST <span className="eh-neon">POPULAR POSTS</span></h2>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {BLOGS.slice(0,3).map(p => (
          <Link key={p.id} to="/blogs" className="eh-card eh-panel overflow-hidden group">
            <div className="relative aspect-video overflow-hidden">
              <img src={p.cover} alt={p.title} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
              <span className="absolute top-3 left-3 eh-mono text-[10px] tracking-widest px-2 py-1 rounded bg-black/70 text-white flex items-center gap-1"><FileText size={10} /> {p.tag}</span>
            </div>
            <div className="p-5">
              <div className="text-base font-semibold leading-snug mb-2" style={{ fontFamily:'Inter,sans-serif' }}>{p.title}</div>
              <div className="text-sm opacity-70 leading-6 mb-3 line-clamp-2">{p.excerpt}</div>
              <div className="eh-mono text-[11px] opacity-60">{p.date}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

const Testimonials = () => (
  <section className="py-20 eh-grid-bg">
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <div className="text-center mb-12"><div className="eh-kicker justify-center mb-3">// CLIENT FEEDBACK</div><h2 className="eh-display text-3xl md:text-5xl font-black">TRUSTED BY <span className="eh-neon">OPERATORS</span></h2></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {TESTIMONIALS.map(t => (
          <div key={t.name} className="eh-panel eh-brackets p-6">
            <span className="br-bl" /><span className="br-br" />
            <div className="flex gap-1 mb-3">{Array.from({length:5}).map((_,i)=><Star key={i} size={14} fill="var(--eh-green)" color="var(--eh-green)" />)}</div>
            <p className="text-sm leading-6 opacity-90 mb-4">“{t.text}”</p>
            <div className="eh-mono text-xs"><span className="eh-neon-soft">{t.name}</span> <span className="opacity-60">// {t.role}</span></div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Home = () => (
  <>
    <Hero />
    <StatsRow />
    <Services limit={6} />
    <BooksTeaser />
    <MembershipsBlock />
    <BlogsTeaser />
    <Testimonials />
  </>
);
export default Home;
