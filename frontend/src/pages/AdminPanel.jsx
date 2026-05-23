import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wrench, BookOpen, CreditCard, FileText, Terminal, Settings, LogOut, Plus, Trash2, ShoppingBag, Users, Activity, Lock, Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo';
import { SERVICES as MS, BOOKS as MB, MEMBERSHIPS as MM, BLOGS as MBL, TOOLS as MT, SITE } from '../mock';
import { toast } from 'sonner';

const ADMIN_PASS = 'admin123';

const readLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const sections = [
  { to: 'overview', label: 'Overview', icon: LayoutDashboard },
  { to: 'services', label: 'Services', icon: Wrench },
  { to: 'books', label: 'Books', icon: BookOpen },
  { to: 'memberships', label: 'Memberships', icon: CreditCard },
  { to: 'blogs', label: 'Blogs', icon: FileText },
  { to: 'tools', label: 'Tools', icon: Terminal },
  { to: 'orders', label: 'Orders', icon: ShoppingBag },
  { to: 'settings', label: 'Settings', icon: Settings },
];

const Sidebar = ({ active, setActive, onLogout }) => (
  <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[var(--eh-border)] eh-grid-bg">
    <div className="p-5 border-b border-[var(--eh-border)] flex items-center gap-3">
      <Logo size={36} />
      <div><div className="eh-display font-black tracking-widest text-sm eh-neon-soft">CONTROL</div><div className="text-[10px] eh-mono opacity-60">// admin panel</div></div>
    </div>
    <nav className="p-3 flex-1 eh-scroll overflow-y-auto">
      {sections.map(s => { const I = s.icon; return (
        <button key={s.to} onClick={()=>setActive(s.to)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded mb-1 text-sm eh-mono tracking-widest uppercase ${active===s.to ? 'bg-[rgba(0,255,157,.1)] text-[var(--eh-green)] border border-[rgba(0,255,157,.3)]' : 'hover:bg-white/5'}`}>
          <I size={16} /> {s.label}
        </button>
      );})}
    </nav>
    <div className="p-3 border-t border-[var(--eh-border)]">
      <Link to="/" className="w-full flex items-center gap-2 text-sm eh-mono opacity-70 hover:opacity-100 px-3 py-2"><Activity size={14} /> view site</Link>
      <button onClick={onLogout} className="w-full flex items-center gap-2 text-sm eh-mono opacity-70 hover:opacity-100 px-3 py-2 text-left"><LogOut size={14} /> logout</button>
    </div>
  </aside>
);

const StatCard = ({ label, value, hint }) => (
  <div className="eh-panel eh-brackets p-5"><span className="br-bl" /><span className="br-br" />
    <div className="eh-mono text-xs opacity-60 tracking-widest">{label}</div>
    <div className="eh-display text-3xl font-black eh-neon mt-2">{value}</div>
    {hint && <div className="eh-mono text-[11px] opacity-60 mt-1">{hint}</div>}
  </div>
);

const Section = ({ title, kicker, actions, children }) => (
  <div>
    <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
      <div><div className="eh-kicker mb-2">{kicker}</div><h2 className="eh-display text-2xl md:text-3xl font-black">{title}</h2></div>
      <div className="flex gap-2">{actions}</div>
    </div>
    {children}
  </div>
);

const CrudTable = ({ items, fields, onAdd, onDelete }) => {
  const [form, setForm] = useState({});
  const submit = e => { e.preventDefault(); if(!form.name && !form.title) return; onAdd({ id: 'x'+Date.now(), ...form }); setForm({}); toast.success('Added successfully'); };
  return (
    <div>
      <div className="eh-panel overflow-x-auto mb-5">
        <table className="w-full eh-mono text-sm"><thead><tr className="text-left border-b border-[var(--eh-border)]">{fields.map(f => <th key={f.key} className="p-3 text-xs tracking-widest opacity-70">{f.label}</th>)}<th className="p-3 w-10"></th></tr></thead><tbody>
          {items.map(it => (
            <tr key={it.id} className="border-b border-[var(--eh-border)] hover:bg-white/[.02]">
              {fields.map(f => <td key={f.key} className="p-3 align-top">{String(it[f.key] ?? '')}</td>)}
              <td className="p-3"><button onClick={()=>{onDelete(it.id); toast.success('Removed');}} className="opacity-60 hover:opacity-100 hover:text-red-400"><Trash2 size={14} /></button></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={fields.length+1} className="p-6 text-center opacity-60">No entries yet.</td></tr>}
        </tbody></table>
      </div>
      <form onSubmit={submit} className="eh-panel p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {fields.slice(0,6).map(f => (
          <input key={f.key} className="eh-input" placeholder={`> ${f.label}`} value={form[f.key]||''} onChange={e=>setForm(s=>({...s,[f.key]:e.target.value}))} />
        ))}
        <button className="eh-btn-primary text-xs"><Plus size={14} /> ADD ENTRY</button>
      </form>
    </div>
  );
};

const Overview = ({ services, books, blogs, tools, orders }) => (
  <Section kicker="// DASHBOARD" title="COMMAND OVERVIEW">
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard label="SERVICES" value={services.length} hint="active offerings" />
      <StatCard label="BOOKS" value={books.length} hint="in library" />
      <StatCard label="BLOGS" value={blogs.length} hint="published" />
      <StatCard label="TOOLS" value={tools.length} hint="in arsenal" />
    </div>
    <Section kicker="// RECENT_ORDERS" title="INCOMING TRANSMISSIONS">
      <div className="eh-panel overflow-x-auto">
        <table className="w-full eh-mono text-sm"><thead><tr className="text-left border-b border-[var(--eh-border)]"><th className="p-3 text-xs tracking-widest opacity-70">ID</th><th className="p-3 text-xs tracking-widest opacity-70">SERVICE</th><th className="p-3 text-xs tracking-widest opacity-70">CLIENT</th><th className="p-3 text-xs tracking-widest opacity-70">STATUS</th><th className="p-3 text-xs tracking-widest opacity-70">DATE</th></tr></thead><tbody>
          {orders.slice(0,8).map(o => (
            <tr key={o.id} className="border-b border-[var(--eh-border)]">
              <td className="p-3 eh-neon-soft">{o.id}</td>
              <td className="p-3">{o.serviceName}</td>
              <td className="p-3">{o.name}</td>
              <td className="p-3"><span className="px-2 py-1 rounded text-[11px]" style={{ background:'rgba(0,255,157,.1)', color:'var(--eh-green)' }}>{o.status}</span></td>
              <td className="p-3 opacity-70">{new Date(o.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={5} className="p-6 text-center opacity-60">No orders yet. Place a test order from the storefront.</td></tr>}
        </tbody></table>
      </div>
    </Section>
  </Section>
);

const Login = ({ onOk }) => {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const submit = e => { e.preventDefault(); if(pw === ADMIN_PASS){ localStorage.setItem('eh_admin','1'); onOk(); } else { toast.error('Access denied'); } };
  return (
    <div className="min-h-screen flex items-center justify-center eh-grid-bg p-6">
      <form onSubmit={submit} className="w-full max-w-sm eh-panel eh-brackets p-7"><span className="br-bl" /><span className="br-br" />
        <div className="flex items-center gap-3 mb-5"><Logo size={40} /><div><div className="eh-display font-black tracking-widest eh-neon-soft">CONTROL</div><div className="text-[10px] eh-mono opacity-60">// admin login</div></div></div>
        <div className="eh-mono text-xs opacity-70 mb-2 flex items-center gap-2"><Lock size={12} color="var(--eh-green)" /> ACCESS_KEY</div>
        <div className="relative">
          <input type={show?'text':'password'} value={pw} onChange={e=>setPw(e.target.value)} placeholder="&gt; ********" className="eh-input pr-10" autoFocus />
          <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <button className="eh-btn-primary w-full mt-5 text-xs">AUTHENTICATE</button>
        <div className="eh-mono text-[11px] opacity-50 mt-4 text-center">hint: admin123 · demo only</div>
      </form>
    </div>
  );
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => localStorage.getItem('eh_admin') === '1');
  const [active, setActive] = useState('overview');
  const [services, setServices] = useState(() => readLS('eh_admin_services', MS));
  const [books, setBooks] = useState(() => readLS('eh_admin_books', MB));
  const [memberships, setMemberships] = useState(() => readLS('eh_admin_memberships', MM));
  const [blogs, setBlogs] = useState(() => readLS('eh_admin_blogs', MBL));
  const [tools, setTools] = useState(() => readLS('eh_admin_tools', MT));
  const [orders, setOrders] = useState(() => readLS('eh_orders', []));
  const [settings, setSettings] = useState(() => readLS('eh_settings', { siteName: SITE.name, tagline: SITE.tagline, marquee: SITE.marquee, telegram: SITE.telegram, email: SITE.email }));

  useEffect(() => writeLS('eh_admin_services', services), [services]);
  useEffect(() => writeLS('eh_admin_books', books), [books]);
  useEffect(() => writeLS('eh_admin_memberships', memberships), [memberships]);
  useEffect(() => writeLS('eh_admin_blogs', blogs), [blogs]);
  useEffect(() => writeLS('eh_admin_tools', tools), [tools]);
  useEffect(() => writeLS('eh_settings', settings), [settings]);

  if (!authed) return <Login onOk={() => setAuthed(true)} />;

  const logout = () => { localStorage.removeItem('eh_admin'); setAuthed(false); navigate('/admin'); };

  return (
    <div className="min-h-screen flex bg-[var(--eh-bg)]">
      <Sidebar active={active} setActive={setActive} onLogout={logout} />
      <main className="flex-1 p-5 md:p-10 overflow-x-hidden">
        <div className="md:hidden mb-4 flex gap-2 overflow-x-auto eh-scroll pb-2">
          {sections.map(s => (<button key={s.to} onClick={()=>setActive(s.to)} className={`shrink-0 px-3 py-2 rounded text-xs eh-mono tracking-widest uppercase ${active===s.to ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>{s.label}</button>))}
        </div>

        {active==='overview' && <Overview services={services} books={books} blogs={blogs} tools={tools} orders={orders} />}
        {active==='services' && <Section kicker="// MODULE" title="MANAGE SERVICES"><CrudTable items={services} fields={[{key:'name',label:'Name'},{key:'price',label:'Price'},{key:'delivery',label:'Delivery'},{key:'guarantee',label:'Guarantee'},{key:'tag',label:'Tag'},{key:'short',label:'Short'}]} onAdd={x=>setServices(p=>[x,...p])} onDelete={id=>setServices(p=>p.filter(x=>x.id!==id))} /></Section>}
        {active==='books' && <Section kicker="// MODULE" title="MANAGE BOOKS"><CrudTable items={books} fields={[{key:'title',label:'Title'},{key:'author',label:'Author'},{key:'price',label:'Price'},{key:'pages',label:'Pages'},{key:'level',label:'Level'},{key:'tag',label:'Tag'}]} onAdd={x=>setBooks(p=>[x,...p])} onDelete={id=>setBooks(p=>p.filter(x=>x.id!==id))} /></Section>}
        {active==='memberships' && <Section kicker="// MODULE" title="MANAGE PLANS"><CrudTable items={memberships} fields={[{key:'name',label:'Tier'},{key:'price',label:'Price'},{key:'period',label:'Period'},{key:'color',label:'Color'}]} onAdd={x=>setMemberships(p=>[x,...p])} onDelete={id=>setMemberships(p=>p.filter(x=>x.id!==id))} /></Section>}
        {active==='blogs' && <Section kicker="// MODULE" title="MANAGE BLOGS"><CrudTable items={blogs} fields={[{key:'title',label:'Title'},{key:'tag',label:'Tag'},{key:'date',label:'Date'},{key:'excerpt',label:'Excerpt'}]} onAdd={x=>setBlogs(p=>[x,...p])} onDelete={id=>setBlogs(p=>p.filter(x=>x.id!==id))} /></Section>}
        {active==='tools' && <Section kicker="// MODULE" title="MANAGE TOOLS"><CrudTable items={tools} fields={[{key:'name',label:'Name'},{key:'category',label:'Category'},{key:'size',label:'Size'},{key:'desc',label:'Description'}]} onAdd={x=>setTools(p=>[x,...p])} onDelete={id=>setTools(p=>p.filter(x=>x.id!==id))} /></Section>}
        {active==='orders' && (
          <Section kicker="// MODULE" title="INCOMING ORDERS" actions={<button onClick={()=>{ localStorage.removeItem('eh_orders'); setOrders([]); toast.success('Orders cleared'); }} className="eh-btn-ghost text-xs"><Trash2 size={14} /> CLEAR</button>}>
            <div className="eh-panel overflow-x-auto"><table className="w-full eh-mono text-sm"><thead><tr className="text-left border-b border-[var(--eh-border)]"><th className="p-3 text-xs tracking-widest opacity-70">ID</th><th className="p-3 text-xs tracking-widest opacity-70">SERVICE</th><th className="p-3 text-xs tracking-widest opacity-70">CLIENT</th><th className="p-3 text-xs tracking-widest opacity-70">EMAIL</th><th className="p-3 text-xs tracking-widest opacity-70">SIZE</th><th className="p-3 text-xs tracking-widest opacity-70">TARGET</th><th className="p-3 text-xs tracking-widest opacity-70">STATUS</th></tr></thead><tbody>
              {orders.map(o => (<tr key={o.id} className="border-b border-[var(--eh-border)]"><td className="p-3 eh-neon-soft">{o.id}</td><td className="p-3">{o.serviceName}</td><td className="p-3">{o.name}</td><td className="p-3 opacity-80">{o.email}</td><td className="p-3">{o.size}</td><td className="p-3 opacity-80">{o.target}</td><td className="p-3"><span className="px-2 py-1 rounded text-[11px]" style={{ background:'rgba(0,255,157,.1)', color:'var(--eh-green)' }}>{o.status}</span></td></tr>))}
              {orders.length===0 && <tr><td colSpan={7} className="p-6 text-center opacity-60">Inbox empty.</td></tr>}
            </tbody></table></div>
          </Section>
        )}
        {active==='settings' && (
          <Section kicker="// MODULE" title="SITE SETTINGS">
            <div className="eh-panel p-6 grid sm:grid-cols-2 gap-4">
              {[['siteName','Site Name'],['tagline','Tagline'],['marquee','Marquee Text'],['telegram','Telegram URL'],['email','Email']].map(([k,l])=>(
                <label key={k} className="text-sm"><div className="eh-mono text-xs tracking-widest opacity-70 mb-2">{l}</div><input className="eh-input" value={settings[k]||''} onChange={e=>setSettings(s=>({...s,[k]:e.target.value}))} /></label>
              ))}
              <div className="sm:col-span-2 flex justify-end"><button onClick={()=>toast.success('Settings saved')} className="eh-btn-primary text-xs">SAVE</button></div>
            </div>
          </Section>
        )}
      </main>
    </div>
  );
};
export default AdminPanel;
