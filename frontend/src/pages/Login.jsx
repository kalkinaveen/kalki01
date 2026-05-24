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
    try { await login(email, pw); toast.success('Welcome back, operator'); nav('/me'); }
    catch (err) { toast.error(err.message || 'Login failed'); }
    finally { setBusy(false); }
  };

  return (
    <section className="min-h-[80vh] flex items-center justify-center eh-grid-bg px-4 py-12">
      <div className="w-full max-w-md eh-panel eh-brackets px-6 py-7 sm:p-8" style={{ background: 'rgba(8,10,12,.85)' }}>
        <span className="br-bl" /><span className="br-br" />
        <div className="flex items-center gap-3 mb-6">
          <Logo size={42} />
          <div>
            <div className="eh-brand font-black tracking-widest text-base eh-neon-soft">ACCESS_TERMINAL</div>
            <div className="eh-mono text-[10px] opacity-60">// operator login</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4" data-testid="login-form">
          <div>
            <label className="eh-mono text-xs tracking-widest opacity-70 mb-2 flex items-center gap-2"><Mail size={12} /> EMAIL</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" data-testid="login-email" autoComplete="email" className="eh-input" placeholder="&gt; operator@domain.com" />
          </div>
          <div>
            <label className="eh-mono text-xs tracking-widest opacity-70 mb-2 flex items-center gap-2"><Lock size={12} /> PASSWORD</label>
            <input value={pw} onChange={e=>setPw(e.target.value)} type="password" data-testid="login-password" autoComplete="current-password" className="eh-input" placeholder="&gt; *********" />
          </div>
          <button disabled={busy} type="submit" data-testid="login-submit" className="eh-btn-primary w-full justify-center">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />} {busy ? 'AUTHENTICATING' : 'AUTHENTICATE'}
          </button>
        </form>
        <div className="mt-6 text-center eh-mono text-xs opacity-70">
          No account? <Link to="/signup" className="text-[var(--eh-green)] hover:underline">create_one</Link>
        </div>
      </div>
    </section>
  );
};

export default Login;
