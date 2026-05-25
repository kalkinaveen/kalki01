import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Moon, Sun, Menu, X, Search, User, LogOut, LogIn, ShoppingCart } from 'lucide-react';
import Logo from './Logo';
import { useTheme } from '../contexts/ThemeContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import SearchModal from './SearchModal';

const Navbar = () => {
  const { theme, toggle } = useTheme();
  const { config } = useSiteConfig();
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setSearchOpen(true);
      } else if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault(); setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md" style={{ background: 'rgba(5,6,8,.78)', borderBottom: '1px solid var(--eh-border)' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <Logo size={42} />
          <div className="block">
            <div className="eh-brand font-black tracking-widest text-sm sm:text-base leading-tight">
              <span className="eh-title-error">ERROR</span><span className="eh-title-hacker">HACKER</span>
            </div>
            <div className="text-[9px] sm:text-[10px] eh-mono opacity-60 leading-tight">// underground tech intel</div>
          </div>
        </Link>
        <nav className="hidden lg:flex items-center gap-1">
          {config.nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `eh-mono px-3 py-2 text-sm tracking-widest uppercase transition-colors ${isActive ? 'text-[var(--eh-green)]' : 'text-[var(--eh-text)] hover:text-[var(--eh-green)]'}`}>{n.label}</NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} data-testid="nav-search" className="hidden md:flex items-center gap-2 eh-mono text-xs px-3 py-2 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors">
            <Search size={14} /> <span className="opacity-70">search...</span>
            <kbd className="ml-2 text-[9px] opacity-60 px-1 py-0.5 border border-[var(--eh-border)] rounded">⌘K</kbd>
          </button>
          <button onClick={() => setSearchOpen(true)} data-testid="nav-search-mobile" aria-label="search" className="md:hidden w-10 h-10 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors"><Search size={16} /></button>
          <Link to="/cart" data-testid="nav-cart" className="relative w-10 h-10 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors">
            <ShoppingCart size={16} />
            {count > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] grid place-items-center text-[10px] eh-mono font-bold rounded-full px-1" style={{ background: 'var(--eh-green)', color: '#001a10' }}>{count}</span>}
          </Link>
          {user ? (
            <div className="relative">
              <button data-testid="nav-user-btn" onClick={() => setUserMenu(v => !v)} className="flex items-center gap-2 px-2.5 py-2 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors">
                {user.picture ? <img src={user.picture} alt="" className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full grid place-items-center text-[10px] eh-mono" style={{ background: 'rgba(0,255,157,.15)', color: 'var(--eh-green)' }}>{(user.name||user.email)[0].toUpperCase()}</div>}
                <span className="hidden sm:inline eh-mono text-xs max-w-[110px] truncate">{user.name || user.email.split('@')[0]}</span>
              </button>
              {userMenu && (
                <div onMouseLeave={() => setUserMenu(false)} className="absolute right-0 mt-2 w-44 eh-panel py-1 z-50" style={{ background: '#0d1115' }}>
                  <NavLink to="/me" onClick={() => setUserMenu(false)} className="flex items-center gap-2 px-3 py-2 text-xs eh-mono hover:bg-white/5"><User size={12} /> my_account</NavLink>
                  <button data-testid="nav-logout" onClick={async () => { setUserMenu(false); await logout(); nav('/'); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs eh-mono hover:bg-white/5"><LogOut size={12} /> logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" data-testid="nav-login" className="hidden sm:flex items-center gap-1.5 eh-mono text-xs px-3 py-2 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors">
              <LogIn size={12} /> LOGIN
            </Link>
          )}
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
            {config.nav.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `eh-mono py-3 text-sm tracking-widest uppercase border-b border-[var(--eh-border)] ${isActive ? 'text-[var(--eh-green)]' : ''}`}>{n.label}</NavLink>
            ))}
            {!user && <NavLink to="/login" onClick={() => setOpen(false)} className="eh-mono py-3 text-sm tracking-widest uppercase border-b border-[var(--eh-border)] text-[var(--eh-green)]">login</NavLink>}
            {user && <NavLink to="/me" onClick={() => setOpen(false)} className="eh-mono py-3 text-sm tracking-widest uppercase border-b border-[var(--eh-border)] text-[var(--eh-green)]">my_account</NavLink>}
          </div>
        </div>
      )}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};
export default Navbar;
