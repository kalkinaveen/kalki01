import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Gift, ArrowRight, Loader2, Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import AuthShell from '../components/AuthShell';

/**
 * Tiny inline password strength meter — friendly, not gatekeepy.
 * Score 0..3: weak / okay / strong.
 */
const scorePw = (pw = '') => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  // A long pure-letter or pure-digit password is plenty strong — don't punish
  // friendly users for skipping the "must have a number" tax.
  if ((pw.length >= 14) || (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw))) s++;
  return Math.min(s, 3);
};
const STRENGTH = ['Too short', 'Weak', 'Okay', 'Strong'];
const STRENGTH_COLOR = ['#777', '#ff7a3d', '#ffd34d', '#00ff9d'];

const Signup = () => {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const refFromUrl = params.get('ref') || '';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [ref, setRef] = useState(refFromUrl);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => { if (user) nav('/me'); }, [user, nav]);
  useEffect(() => { if (refFromUrl) setRef(refFromUrl); }, [refFromUrl]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !pw) { toast.error('Please enter your email and password'); return; }
    if (pw.length < 4) { toast.error('Password is a bit short — please use at least 4 characters'); return; }
    setBusy(true);
    try {
      await register(email, pw, name, ref || null);
      toast.success(refFromUrl ? 'Welcome — your referral bonus is on the way!' : 'Welcome to ERRORHACKER!');
      nav('/me');
    } catch (err) {
      toast.error(err.message || 'Signup failed — please try again');
    } finally {
      setBusy(false);
    }
  };

  const pwScore = scorePw(pw);

  return (
    <AuthShell
      kicker="CREATE ACCOUNT"
      title={<>Let's get you <span className="eh-neon">started</span></>}
      subtitle="Sign up in seconds. Track orders, fund a wallet, request recovery, and unlock 5,800+ growth services — all under one roof."
      footer={
        <>
          Already on board?{' '}
          <Link to="/login" className="text-[var(--eh-green)] font-bold hover:underline" data-testid="signup-link-login">
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-5">
        <h2 className="font-bold text-xl sm:text-2xl mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
          Create your free account
        </h2>
        <p className="text-xs sm:text-sm opacity-65" style={{ fontFamily: 'Inter, sans-serif' }}>
          No credit card. No commitment. You can delete your account anytime.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <div>
          <label
            htmlFor="signup-name"
            className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5 opacity-80"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <User size={13} /> Your name <span className="opacity-50 font-normal">— optional</span>
          </label>
          <input
            id="signup-name"
            value={name}
            onChange={e => setName(e.target.value)}
            data-testid="signup-name"
            className="eh-input text-base py-3"
            placeholder="What should we call you?"
          />
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5 opacity-80"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <Mail size={13} /> Email
          </label>
          <input
            id="signup-email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            data-testid="signup-email"
            autoComplete="email"
            inputMode="email"
            className="eh-input text-base py-3"
            placeholder="you@email.com"
          />
        </div>

        <div>
          <label
            htmlFor="signup-password"
            className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5 opacity-80"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <Lock size={13} /> Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              type={showPw ? 'text' : 'password'}
              data-testid="signup-password"
              autoComplete="new-password"
              className="eh-input text-base py-3 pr-11"
              placeholder="At least 4 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 opacity-60 hover:opacity-100 transition-opacity"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              data-testid="signup-toggle-pw"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {/* Friendly strength meter — only renders once the user starts typing */}
          {pw && (
            <div className="mt-2 flex items-center gap-2" data-testid="signup-pw-strength">
              <div className="flex-1 h-1.5 bg-[var(--eh-border)] rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${((pwScore + 1) / 4) * 100}%`,
                    background: STRENGTH_COLOR[pwScore],
                  }}
                />
              </div>
              <span className="eh-mono text-[10px]" style={{ color: STRENGTH_COLOR[pwScore] }}>
                {STRENGTH[pwScore]}
              </span>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="signup-ref"
            className="text-[12px] font-semibold mb-1.5 flex items-center gap-1.5 opacity-80"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <Gift size={13} /> Referral code <span className="opacity-50 font-normal">— optional</span>
          </label>
          <input
            id="signup-ref"
            value={ref}
            onChange={e => setRef(e.target.value.toUpperCase())}
            data-testid="signup-ref"
            className="eh-input text-base py-3"
            placeholder="EHXXXXXX"
          />
          {refFromUrl && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 eh-mono text-[10px] text-[var(--eh-green)]" data-testid="signup-ref-applied">
              <Check size={11} /> Referral applied — you and your inviter both get rewarded
            </div>
          )}
        </div>

        <button
          disabled={busy}
          type="submit"
          data-testid="signup-submit"
          className="eh-btn-primary w-full justify-center py-3 text-sm font-bold mt-2 disabled:opacity-50"
        >
          {busy ? (
            <><Loader2 className="animate-spin" size={14} /> Creating your account…</>
          ) : (
            <>Create account <ArrowRight size={14} /></>
          )}
        </button>
      </form>

      <div className="mt-4 eh-mono text-[10px] opacity-55 text-center leading-relaxed">
        Your data stays private — we never email-spam or sell anything.
      </div>
    </AuthShell>
  );
};

export default Signup;
