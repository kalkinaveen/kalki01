import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Moon, Sun, Menu, X, Search } from 'lucide-react';
import Logo from './Logo';
import { useTheme } from '../contexts/ThemeContext';
import { NAV, SITE } from '../mock';

const Navbar = () => {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md" style={{ background: 'rgba(5,6,8,.78)', borderBottom: '1px solid var(--eh-border)' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <Logo size={42} />
          <div className="hidden sm:block">
            <div className="eh-display font-black tracking-widest text-base eh-neon-soft">{SITE.name}</div>
            <div className="text-[10px] eh-mono opacity-60">// underground tech intel</div>
          </div>
        </Link>
        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `eh-mono px-3 py-2 text-sm tracking-widest uppercase transition-colors ${isActive ? 'text-[var(--eh-green)]' : 'text-[var(--eh-text)] hover:text-[var(--eh-green)]'}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button className="hidden md:flex items-center gap-2 eh-mono text-xs px-3 py-2 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors">
            <Search size={14} /> <span className="opacity-70">search...</span>
          </button>
          <button onClick={toggle} aria-label="toggle theme" className="w-10 h-10 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => setOpen(o => !o)} className="lg:hidden w-10 h-10 grid place-items-center rounded border border-[var(--eh-border)]" aria-label="menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-[var(--eh-border)]">
          <div className="px-4 py-3 flex flex-col">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `eh-mono py-3 text-sm tracking-widest uppercase border-b border-[var(--eh-border)] ${isActive ? 'text-[var(--eh-green)]' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
export default Navbar;
