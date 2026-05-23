import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { NAV, SITE } from '../mock';
import { Send, Mail, Github, Twitter } from 'lucide-react';

const Footer = () => (
  <footer className="mt-20 border-t border-[var(--eh-border)] eh-grid-bg">
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-14 grid md:grid-cols-4 gap-10">
      <div>
        <div className="flex items-center gap-3 mb-4"><Logo size={40} /><div className="eh-brand font-black tracking-widest eh-neon-soft">{SITE.name}</div></div>
        <p className="text-sm opacity-70 leading-7">{SITE.description}</p>
      </div>
      <div>
        <div className="eh-mono text-xs tracking-[.3em] mb-4" style={{ color: 'var(--eh-green)' }}>// NAVIGATE</div>
        <ul className="space-y-2 text-sm">{NAV.map(n => (<li key={n.to}><Link to={n.to} className="hover:text-[var(--eh-green)] transition-colors">{n.label}</Link></li>))}</ul>
      </div>
      <div>
        <div className="eh-mono text-xs tracking-[.3em] mb-4" style={{ color: 'var(--eh-green)' }}>// CONTACT</div>
        <a href={SITE.telegram} className="flex items-center gap-2 text-sm mb-2 hover:text-[var(--eh-green)]"><Send size={14} /> Telegram</a>
        <a href={`mailto:${SITE.email}`} className="flex items-center gap-2 text-sm hover:text-[var(--eh-green)]"><Mail size={14} /> {SITE.email}</a>
        <div className="flex gap-3 mt-4"><a className="opacity-70 hover:opacity-100" href="#"><Github size={18} /></a><a className="opacity-70 hover:opacity-100" href="#"><Twitter size={18} /></a></div>
      </div>
      <div>
        <div className="eh-mono text-xs tracking-[.3em] mb-4" style={{ color: 'var(--eh-green)' }}>// STATUS</div>
        <div className="text-sm space-y-2 eh-mono">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--eh-green)', boxShadow:'0 0 10px var(--eh-green)' }} /> system : online</div>
          <div className="opacity-70">build : {SITE.version}</div>
          <div className="opacity-70">uptime : 99.98%</div>
        </div>
      </div>
    </div>
    <div className="border-t border-[var(--eh-border)] py-5 text-center eh-mono text-xs opacity-60">
      © {new Date().getFullYear()} {SITE.name} · All operations are simulated for educational use only.
    </div>
  </footer>
);
export default Footer;
