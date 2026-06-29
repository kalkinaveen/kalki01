import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, User, ArrowRight, Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

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

  useEffect(() => { if (user) nav('/me'); }, [user, nav]);
  useEffect(() => { if (refFromUrl) setRef(refFromUrl); }, [refFromUrl]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !pw) { toast.error('Email & password required'); return; }
    if (pw.length < 4) { toast.error('Password too short (min 4 chars)'); return; }
    setBusy(true);
    try { await register(email, pw, name, ref || null); toast.success(refFromUrl ? 'Welcome — referral bonus applied' : 'Welcome aboard, operator'); nav('/me'); }
    catch (err) { toast.error(err.message || 'Signup failed'); }
    finally { setBusy(false); }
  };

  return (
    <section className="min-h-[88vh] flex items-center justify-center eh-grid-bg px-4 py-8 sm:py-12">
      <div className="w-full max-w-md relative">
        <div aria-hidden className="absolute -top-10 -left-10 w-32 h-32 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, var(--eh-green) 0%, transparent 70%)' }} />
        <div aria-hidden className="absolute -bottom-12 -right-6 w-40 h-40 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, var(--eh-green) 0%, transparent 70%)' }} />
        <div className="relative eh-panel eh-brackets px-5 py-6 sm:p-8" style={{ background: 'rgba(8,10,12,.92)', backdropFilter: 'blur(8px)' }}>
          <span className="br-bl" /><span className="br-br" />
          <div className="flex flex-col items-center text-center mb-6 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <Logo size={48} />
            <div className="mt-3 sm:mt-0">
              <div className="eh-brand font-black tracking-widest text-base sm:text-lg eh-neon-soft">CREATE_OPERATOR</div>
              <div className="eh-mono text-[10px] opacity-60 mt-0.5">// join the network</div>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
            <div>
              <label className="eh-mono text-[11px] tracking-widest opacity-70 mb-2 flex items-center gap-2"><User size={12} /> NAME <span className="opacity-50 normal-case">— optional</span></label>
              <input value={name} onChange={e=>setName(e.target.value)} data-testid="signup-name" className="eh-input text-base py-3.5" placeholder="> alias" />
            </div>
            <div>
              <label className="eh-mono text-[11px] tracking-widest opacity-70 mb-2 flex items-center gap-2"><Mail size={12} /> EMAIL</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" data-testid="signup-email" autoComplete="email" inputMode="email" className="eh-input text-base py-3.5" placeholder="> operator@domain.com" />
            </div>
            <div>
              <label className="eh-mono text-[11px] tracking-widest opacity-70 mb-2 flex items-center gap-2"><Lock size={12} /> PASSWORD</label>
              <input value={pw} onChange={e=>setPw(e.target.value)} type="password" data-testid="signup-password" autoComplete="new-password" className="eh-input text-base py-3.5" placeholder="> min 4 chars" />
            </div>
            <div>
              <label className="eh-mono text-[11px] tracking-widest opacity-70 mb-2 flex items-center gap-2"><Gift size={12} /> REFERRAL <span className="opacity-50 normal-case">— optional</span></label>
              <input value={ref} onChange={e=>setRef(e.target.value.toUpperCase())} data-testid="signup-ref" className="eh-input text-base py-3.5" placeholder="> EHXXXXXX" />
              {refFromUrl && <div className="eh-mono text-[10px] mt-1.5 text-[var(--eh-green)]">✓ referral applied — both you & inviter get rewarded</div>}
            </div>
            <button disabled={busy} type="submit" data-testid="signup-submit" className="eh-btn-primary w-full justify-center py-3.5 text-sm font-bold">
              {busy ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />} {busy ? 'CREATING' : 'CREATE_ACCOUNT'}
            </button>
          </form>
          <div className="mt-6 text-center eh-mono text-xs opacity-70">
            Already have an account? <Link to="/login" className="text-[var(--eh-green)] hover:underline font-bold">log_in</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Signup;
