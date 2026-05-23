import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { DollarSign, Clock, ShieldCheck, ArrowLeft, User, AtSign, MessageCircle, Package, Link2, FileText, Send, Lock } from 'lucide-react';
import { toast } from 'sonner';

const Field = ({ icon: Icon, label, children }) => (
  <div>
    <div className="eh-mono text-xs tracking-[.25em] opacity-70 mb-2 flex items-center gap-2"><Icon size={14} color="var(--eh-green)" /> {label}</div>
    {children}
  </div>
);

const ServiceDetail = () => {
  const { id } = useParams();
  const { config } = useSiteConfig();
  const s = config.services.find(x => x.id === id);
  const [form, setForm] = useState({ name:'', email:'', tg:'', size:'', target:'', notes:'' });
  if (!s) return <div className="max-w-3xl mx-auto px-6 py-20"><div className="opacity-70">Service not found.</div><Link to="/services" className="eh-btn-ghost mt-4">Back to services</Link></div>;

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const onSubmit = e => {
    e.preventDefault();
    const orders = JSON.parse(localStorage.getItem('eh_orders') || '[]');
    orders.unshift({ id: 'ORD-' + Date.now(), service: s.id, serviceName: s.name, ...form, status: 'received', createdAt: new Date().toISOString() });
    localStorage.setItem('eh_orders', JSON.stringify(orders));
    toast.success('Order placed successfully', { description: 'Our team will contact you on Telegram shortly.' });
    setForm({ name:'', email:'', tg:'', size:'', target:'', notes:'' });
  };

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link to="/services" className="inline-flex items-center gap-2 eh-mono text-xs opacity-70 hover:opacity-100 mb-6"><ArrowLeft size={14} /> back</Link>
        <div className="eh-panel eh-brackets p-6 md:p-8 mb-6">
          <span className="br-bl" /><span className="br-br" />
          <div className="text-xs eh-mono mb-3" style={{ color:'var(--eh-green)' }}>// SERVICE_OVERVIEW</div>
          <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ fontFamily:'Inter,sans-serif' }}>{s.name}</h1>
          <p className="opacity-80 text-sm leading-7">{s.short}</p>
          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            <div className="eh-panel p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full grid place-items-center" style={{ background:'rgba(0,255,157,.1)', border:'1px solid rgba(0,255,157,.3)' }}><DollarSign size={16} color="var(--eh-green)" /></div>
              <div><div className="text-[10px] eh-mono opacity-60 tracking-widest">PRICE</div><div className="eh-mono text-sm">From ${s.price}</div></div>
            </div>
            <div className="eh-panel p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full grid place-items-center" style={{ background:'rgba(0,255,157,.1)', border:'1px solid rgba(0,255,157,.3)' }}><Clock size={16} color="var(--eh-green)" /></div>
              <div><div className="text-[10px] eh-mono opacity-60 tracking-widest">DELIVERY</div><div className="eh-mono text-sm">{s.delivery}</div></div>
            </div>
            <div className="eh-panel p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full grid place-items-center" style={{ background:'rgba(0,255,157,.1)', border:'1px solid rgba(0,255,157,.3)' }}><ShieldCheck size={16} color="var(--eh-green)" /></div>
              <div><div className="text-[10px] eh-mono opacity-60 tracking-widest">GUARANTEE</div><div className="eh-mono text-sm">{s.guarantee}</div></div>
            </div>
          </div>
        </div>

        <div className="eh-panel eh-brackets p-6 md:p-8 mb-6">
          <span className="br-bl" /><span className="br-br" />
          <div className="eh-kicker mb-4">SERVICE_DETAILS // ENCRYPTED</div>
          <p className="text-sm leading-7 opacity-85 whitespace-pre-line">{s.long}</p>
        </div>

        <form onSubmit={onSubmit} className="eh-panel eh-brackets p-6 md:p-8">
          <span className="br-bl" /><span className="br-br" />
          <div className="eh-mono text-xs mb-1" style={{ color:'var(--eh-green)' }}>// PLACE_ORDER</div>
          <div className="text-xl mb-1" style={{ fontFamily:'Inter,sans-serif' }}>{s.name}</div>
          <div className="eh-mono text-xs eh-neon-soft mb-6">PRICE: From ${s.price}</div>
          <div className="grid gap-5">
            <Field icon={User} label="YOUR NAME"><input required name="name" value={form.name} onChange={onChange} placeholder="&gt; John Doe" className="eh-input" /></Field>
            <Field icon={AtSign} label="EMAIL"><input required type="email" name="email" value={form.email} onChange={onChange} placeholder="&gt; you@example.com" className="eh-input" /></Field>
            <Field icon={MessageCircle} label="TELEGRAM (OPTIONAL)"><input name="tg" value={form.tg} onChange={onChange} placeholder="&gt; @username" className="eh-input" /></Field>
            <Field icon={Package} label="PACKAGE SIZE"><input required name="size" value={form.size} onChange={onChange} placeholder="&gt; 1000 / 5000 / etc" className="eh-input" /></Field>
            <Field icon={Link2} label="TARGET LINK (URL / @CHANNEL)"><input required name="target" value={form.target} onChange={onChange} placeholder="&gt; https://t.me/yourchannel" className="eh-input" /></Field>
            <Field icon={FileText} label="ADDITIONAL NOTES (OPTIONAL)"><textarea rows={4} name="notes" value={form.notes} onChange={onChange} placeholder="&gt; any specific requirements..." className="eh-textarea" /></Field>
          </div>
          <div className="mt-5 flex items-center gap-2 eh-mono text-xs px-3 py-2 rounded" style={{ background:'rgba(0,255,157,.08)', color:'var(--eh-green)', border:'1px solid rgba(0,255,157,.25)' }}>
            <span className="w-2 h-2 rounded-full bg-current" style={{ boxShadow:'0 0 8px currentColor' }} /> <Lock size={12} /> SECURE CHANNEL // YOUR DATA IS ENCRYPTED
          </div>
          <button type="submit" className="eh-btn-primary w-full mt-5">PLACE ORDER <Send size={16} /></button>
        </form>
      </div>
    </div>
  );
};
export default ServiceDetail;
