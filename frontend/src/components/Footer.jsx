import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { Send, Mail, Github, Twitter } from 'lucide-react';

const Footer = () => {
  const { config } = useSiteConfig();
  return (
  <footer className="mt-20 border-t border-[var(--eh-border)] eh-grid-bg">
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-14 grid md:grid-cols-4 gap-10">
      <div>
        <div className="flex items-center gap-3 mb-4"><Logo size={40} /><div className="eh-brand font-black tracking-widest eh-neon-soft">{config.site.name}</div></div>
        <p className="text-sm opacity-70 leading-7">{config.site.description}</p>
      </div>
      <div>
        <div className="eh-mono text-xs tracking-[.3em] mb-4" style={{ color: 'var(--eh-green)' }}>// NAVIGATE</div>
        <ul className="space-y-2 text-sm">{config.nav.map(n => (<li key={n.to}><Link to={n.to} className="hover:text-[var(--eh-green)] transition-colors">{n.label}</Link></li>))}</ul>
      </div>
      <div>
        <div className="eh-mono text-xs tracking-[.3em] mb-4" style={{ color: 'var(--eh-green)' }}>// CONTACT</div>
        <a href={config.site.telegram} className="flex items-center gap-2 text-sm mb-2 hover:text-[var(--eh-green)]"><Send size={14} /> Telegram</a>
        <a href={`mailto:${config.site.email}`} className="flex items-center gap-2 text-sm hover:text-[var(--eh-green)]"><Mail size={14} /> {config.site.email}</a>
        <div className="flex gap-3 mt-4"><a className="opacity-70 hover:opacity-100" href="#"><Github size={18} /></a><a className="opacity-70 hover:opacity-100" href="#"><Twitter size={18} /></a></div>
      </div>
      <div>
        <div className="eh-mono text-xs tracking-[.3em] mb-4" style={{ color: 'var(--eh-green)' }}>// STATUS</div>
        <div className="text-sm space-y-2 eh-mono">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--eh-green)', boxShadow:'0 0 10px var(--eh-green)' }} /> system : online</div>
          <div className="opacity-70">build : {config.site.version}</div>
          <div className="opacity-70">uptime : 99.98%</div>
        </div>
      </div>
    </div>
    <div className="border-t border-[var(--eh-border)] py-5 text-center eh-mono text-xs opacity-60">
      © {new Date().getFullYear()} {config.site.name} · All operations are simulated for educational use only.
    </div>
  </footer>
  );
};
export default Footer;
