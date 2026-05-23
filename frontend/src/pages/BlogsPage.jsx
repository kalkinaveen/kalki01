import React, { useState } from 'react';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { FileText, Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const BlogsPage = () => {
  const { config } = useSiteConfig();
  const [q, setQ] = useState('');
  const filtered = config.blogs.filter(b => b.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="pt-10 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <div className="eh-kicker justify-center mb-3">// BLOG ARCHIVE</div>
          <h1 className="eh-display font-black" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}>LATEST <span className="eh-neon">INTEL</span></h1>
          <div className="mt-6 max-w-md mx-auto"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="&gt; search articles..." className="eh-input text-center" /></div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(p => (
            <Link key={p.id} to="/blogs" className="eh-card eh-panel overflow-hidden group">
              <div className="relative aspect-video overflow-hidden">
                <img src={p.cover} alt={p.title} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-3 left-3 eh-mono text-[10px] tracking-widest px-2 py-1 rounded bg-black/70 text-white flex items-center gap-1"><FileText size={10} /> {p.tag}</span>
              </div>
              <div className="p-5">
                <div className="text-base font-semibold leading-snug mb-2" style={{ fontFamily:'Inter,sans-serif' }}>{p.title}</div>
                <div className="text-sm opacity-70 leading-6 mb-3 line-clamp-2">{p.excerpt}</div>
                <div className="flex items-center justify-between"><div className="eh-mono text-[11px] opacity-60 flex items-center gap-1"><Calendar size={11} />{p.date}</div><ArrowRight size={14} color="var(--eh-green)" /></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
export default BlogsPage;
