import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

const Login = () => {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => { if (user) nav(loc.state?.from || '/me'); }, [user, nav, loc.state]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !pw) { toast.error('Email & password required'); return; }
    setBusy(true);
    try { await login(email, pw); toast.success('Welcome back, operator'); nav(loc.state?.from || '/me'); }
    catch (err) { toast.error(err.message || 'Login failed'); }
    finally { setBusy(false); }
  };

  return (
    <section className="min-h-[88vh] flex items-center justify-center eh-grid-bg px-4 py-8 sm:py-12">
      <div className="w-full max-w-md relative">
        {/* Floating ambient ring — adds depth on mobile */}
        <div aria-hidden className="absolute -top-10 -left-10 w-32 h-32 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, var(--eh-green) 0%, transparent 70%)' }} />
        <div aria-hidden className="absolute -bottom-12 -right-6 w-40 h-40 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, var(--eh-green) 0%, transparent 70%)' }} />
        <div className="relative eh-panel eh-brackets px-5 py-6 sm:p-8" style={{ background: 'rgba(8,10,12,.92)', backdropFilter: 'blur(8px)' }}>
          <span className="br-bl" /><span className="br-br" />
          {/* Mobile-first stacked hero header */}
          <div className="flex flex-col items-center text-center mb-6 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <Logo size={48} />
            <div className="mt-3 sm:mt-0">
              <div className="eh-brand font-black tracking-widest text-base sm:text-lg eh-neon-soft">ACCESS_TERMINAL</div>
              <div className="eh-mono text-[10px] opacity-60 mt-0.5">// secure operator login</div>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="eh-mono text-[11px] tracking-widest opacity-70 mb-2 flex items-center gap-2"><Mail size={12} /> EMAIL</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" data-testid="login-email" autoComplete="email" inputMode="email" className="eh-input text-base py-3.5" placeholder="> operator@domain.com" />
            </div>
            <div>
              <label className="eh-mono text-[11px] tracking-widest opacity-70 mb-2 flex items-center gap-2"><Lock size={12} /> PASSWORD</label>
              <input value={pw} onChange={e=>setPw(e.target.value)} type="password" data-testid="login-password" autoComplete="current-password" className="eh-input text-base py-3.5" placeholder="> *********" />
            </div>
            <button disabled={busy} type="submit" data-testid="login-submit" className="eh-btn-primary w-full justify-center py-3.5 text-sm font-bold">
              {busy ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />} {busy ? 'AUTHENTICATING' : 'AUTHENTICATE'}
            </button>
          </form>
          <div className="mt-6 text-center eh-mono text-xs opacity-70">
            No account? <Link to="/signup" className="text-[var(--eh-green)] hover:underline font-bold">create_one</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;
