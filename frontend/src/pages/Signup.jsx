import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

const Signup = () => {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => { if (user) nav('/me'); }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !pw) { toast.error('Email & password required'); return; }
    if (pw.length < 4) { toast.error('Password too short (min 4 chars)'); return; }
    setBusy(true);
    try { await register(email, pw, name); toast.success('Welcome aboard, operator'); nav('/me'); }
    catch (err) { toast.error(err.message || 'Signup failed'); }
    finally { setBusy(false); }
  };

  return (
    <section className="min-h-[80vh] flex items-center justify-center eh-grid-bg px-4 py-12">
      <div className="w-full max-w-md eh-panel eh-brackets px-6 py-7 sm:p-8" style={{ background: 'rgba(8,10,12,.85)' }}>
        <span className="br-bl" /><span className="br-br" />
        <div className="flex items-center gap-3 mb-6">
          <Logo size={42} />
          <div>
            <div className="eh-brand font-black tracking-widest text-base eh-neon-soft">CREATE_OPERATOR</div>
            <div className="eh-mono text-[10px] opacity-60">// join the network</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
          <div>
            <label className="eh-mono text-xs tracking-widest opacity-70 mb-2 flex items-center gap-2"><User size={12} /> NAME <span className="opacity-50 normal-case">— optional</span></label>
            <input value={name} onChange={e=>setName(e.target.value)} data-testid="signup-name" className="eh-input" placeholder="&gt; alias" />
          </div>
          <div>
            <label className="eh-mono text-xs tracking-widest opacity-70 mb-2 flex items-center gap-2"><Mail size={12} /> EMAIL</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" data-testid="signup-email" autoComplete="email" className="eh-input" placeholder="&gt; operator@domain.com" />
          </div>
          <div>
            <label className="eh-mono text-xs tracking-widest opacity-70 mb-2 flex items-center gap-2"><Lock size={12} /> PASSWORD</label>
            <input value={pw} onChange={e=>setPw(e.target.value)} type="password" data-testid="signup-password" autoComplete="new-password" className="eh-input" placeholder="&gt; min 4 chars" />
          </div>
          <button disabled={busy} type="submit" data-testid="signup-submit" className="eh-btn-primary w-full justify-center">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />} {busy ? 'CREATING' : 'CREATE_ACCOUNT'}
          </button>
        </form>
        <div className="mt-6 text-center eh-mono text-xs opacity-70">
          Already have an account? <Link to="/login" className="text-[var(--eh-green)] hover:underline">log_in</Link>
        </div>
      </div>
    </section>
  );
};

export default Signup;
