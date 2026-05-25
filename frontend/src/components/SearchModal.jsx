import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Wrench, BookOpen, FileText, Terminal, CreditCard, Activity } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const KIND_META = {
  service: { icon: Wrench, label: 'Service', to: (i) => `/services/${i.id}` },
  book:    { icon: BookOpen, label: 'Book',  to: () => `/books` },
  membership: { icon: CreditCard, label: 'Membership', to: () => `/memberships` },
  blog:    { icon: FileText, label: 'Blog', to: () => `/blogs` },
  tool:    { icon: Terminal, label: 'Tool', to: () => `/tools` },
  page:    { icon: Activity, label: 'Page', to: (i) => i.to },
};

const STATIC_PAGES = [
  { kind: 'page', id: 'home',         title: 'Home',         desc: 'Front page', to: '/' },
  { kind: 'page', id: 'services',     title: 'Services',     desc: 'All offerings', to: '/services' },
  { kind: 'page', id: 'books',        title: 'Books',        desc: 'Library', to: '/books' },
  { kind: 'page', id: 'memberships',  title: 'Memberships',  desc: 'Subscription tiers', to: '/memberships' },
  { kind: 'page', id: 'feed',         title: 'Feed',         desc: 'Instagram-style profile', to: '/feed' },
  { kind: 'page', id: 'blogs',        title: 'Blogs',        desc: 'Latest posts', to: '/blogs' },
  { kind: 'page', id: 'tools',        title: 'Tools',        desc: 'Arsenal', to: '/tools' },
  { kind: 'page', id: 'track',        title: 'Track Order',  desc: 'Order status', to: '/track' },
  { kind: 'page', id: 'faq',          title: 'FAQ',          desc: 'Help', to: '/faq' },
];

const SearchModal = ({ open, onClose }) => {
  const { config } = useSiteConfig();
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const index = useMemo(() => {
    const out = [];
    (config.services || []).forEach(s => out.push({ kind: 'service', id: s.id, title: s.name, desc: s.short || s.description || '' }));
    (config.books || []).forEach(b => out.push({ kind: 'book', id: b.id, title: b.title, desc: `${b.author || ''} · ${b.level || ''}` }));
    (config.memberships || []).forEach(m => out.push({ kind: 'membership', id: m.id, title: `${m.name} tier`, desc: `$${m.price}/${m.period}` }));
    (config.blogs || []).forEach(b => out.push({ kind: 'blog', id: b.id, title: b.title, desc: b.excerpt || '' }));
    (config.tools || []).forEach(t => out.push({ kind: 'tool', id: t.id, title: t.name, desc: t.short || '' }));
    STATIC_PAGES.forEach(p => out.push(p));
    return out;
  }, [config]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return index.slice(0, 8);
    return index.filter(i => (i.title || '').toLowerCase().includes(s) || (i.desc || '').toLowerCase().includes(s)).slice(0, 20);
  }, [q, index]);

  const goto = (item) => {
    const meta = KIND_META[item.kind] || KIND_META.page;
    nav(meta.to(item));
    onClose(); setQ('');
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-3" onClick={onClose} data-testid="search-modal">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl eh-panel overflow-hidden" style={{ background: '#0d1115' }}>
        <div className="flex items-center gap-3 p-4 border-b border-[var(--eh-border)]">
          <Search size={18} className="text-[var(--eh-green)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) goto(results[0]); }}
            placeholder="Search services, books, memberships, blogs..."
            className="flex-1 bg-transparent eh-mono text-sm outline-none placeholder:opacity-50"
            data-testid="search-input"
          />
          <kbd className="hidden sm:inline eh-mono text-[10px] opacity-60 px-1.5 py-0.5 border border-[var(--eh-border)] rounded">ESC</kbd>
          <button onClick={onClose} className="opacity-70 hover:opacity-100"><X size={16} /></button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto eh-scroll p-2">
          {results.length === 0 && <div className="py-10 text-center opacity-60 eh-mono text-xs">No results for "{q}"</div>}
          {results.map((r) => {
            const meta = KIND_META[r.kind] || KIND_META.page;
            const I = meta.icon;
            return (
              <button key={`${r.kind}-${r.id}`} onClick={() => goto(r)} data-testid={`search-result-${r.kind}-${r.id}`}
                className="w-full text-left flex items-center gap-3 p-3 rounded hover:bg-[rgba(0,255,157,.08)] transition-colors">
                <div className="w-9 h-9 grid place-items-center rounded shrink-0" style={{ background: 'rgba(0,255,157,.1)', border: '1px solid rgba(0,255,157,.25)' }}><I size={14} color="var(--eh-green)" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ fontFamily: 'Inter,sans-serif' }}>{r.title}</div>
                  {r.desc && <div className="eh-mono text-[11px] opacity-60 truncate">{r.desc}</div>}
                </div>
                <div className="eh-mono text-[10px] opacity-50 tracking-widest uppercase">{meta.label}</div>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-[var(--eh-border)] eh-mono text-[10px] opacity-50 flex items-center justify-between">
          <span>↵ to open · ESC to close</span>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
