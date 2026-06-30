import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import AuthShell from '../components/AuthShell';

const Login = () => {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => { if (user) nav(loc.state?.from || '/me'); }, [user, nav, loc.state]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !pw) { toast.error('Please enter your email and password'); return; }
    setBusy(true);
    try {
      await login(email, pw);
      toast.success('Welcome back!');
      nav(loc.state?.from || '/me');
    } catch (err) {
      toast.error(err.message || 'Login failed — please try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      kicker="SIGN IN"
      title={<>Welcome <span className="eh-neon">back</span></>}
      subtitle="Sign in to pick up your orders, recovery cases, wallet and growth campaigns — all in one place."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="text-[var(--eh-green)] font-bold hover:underline" data-testid="login-link-signup">
            Create an account
          </Link>
        </>
      }
    >
      <div className="mb-5">
        <h2 className="font-bold text-xl sm:text-2xl mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Sign in</h2>
        <p className="text-xs sm:text-sm opacity-65" style={{ fontFamily: 'Inter, sans-serif' }}>
          It only takes a few seconds. We'll keep you signed in on this device.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div>
          <label
            htmlFor="login-email"
            className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5 opacity-80"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <Mail size={13} /> Email
          </label>
          <input
            id="login-email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            data-testid="login-email"
            autoComplete="email"
            inputMode="email"
            className="eh-input text-base py-3"
            placeholder="you@email.com"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5 opacity-80"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <Lock size={13} /> Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              type={showPw ? 'text' : 'password'}
              data-testid="login-password"
              autoComplete="current-password"
              className="eh-input text-base py-3 pr-11"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 opacity-60 hover:opacity-100 transition-opacity"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              data-testid="login-toggle-pw"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button
          disabled={busy}
          type="submit"
          data-testid="login-submit"
          className="eh-btn-primary w-full justify-center py-3 text-sm font-bold mt-2 disabled:opacity-50"
        >
          {busy ? (
            <><Loader2 className="animate-spin" size={14} /> Signing you in…</>
          ) : (
            <>Sign in <ArrowRight size={14} /></>
          )}
        </button>
      </form>

      <div className="mt-4 eh-mono text-[10px] opacity-55 text-center leading-relaxed">
        Trouble signing in? Reach us on Telegram and we'll help recover your account.
      </div>
    </AuthShell>
  );
};

export default Login;
