import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wrench, BookOpen, CreditCard, FileText, Terminal, Settings, LogOut, Plus, Trash2, ShoppingBag, Edit3, Save, X, Eye, EyeOff, Lock, Image as ImageIcon, Palette, Type, MessageSquare, Star, Quote, Activity, RefreshCcw, Download, Upload, Award, GitBranch, BadgeCheck, Cpu, Zap } from 'lucide-react';
import Logo from '../components/Logo';
import { useSiteConfig, DEFAULTS } from '../contexts/SiteConfigContext';
import { toast } from 'sonner';

const sections = [
  { to: 'overview',    label: 'Overview',     icon: LayoutDashboard, group: 'main' },
  { to: 'branding',    label: 'Branding',     icon: Palette,         group: 'site' },
  { to: 'hero',        label: 'Hero Section', icon: Type,            group: 'site' },
  { to: 'navigation',  label: 'Navigation',   icon: GitBranch,       group: 'site' },
  { to: 'services',    label: 'Services',     icon: Wrench,          group: 'content' },
  { to: 'books',       label: 'Books',        icon: BookOpen,        group: 'content' },
  { to: 'memberships', label: 'Memberships',  icon: CreditCard,      group: 'content' },
  { to: 'comparison',  label: 'Plan Compare', icon: BadgeCheck,      group: 'content' },
  { to: 'blogs',       label: 'Blogs',        icon: FileText,        group: 'content' },
  { to: 'tools',       label: 'Tools',        icon: Terminal,        group: 'content' },
  { to: 'how',         label: 'How It Works', icon: Cpu,             group: 'content' },
  { to: 'partners',    label: 'Partners',     icon: Award,           group: 'content' },
  { to: 'testimonials',label: 'Testimonials', icon: Quote,           group: 'content' },
  { to: 'activity',    label: 'Live Feed',    icon: Activity,        group: 'content' },
  { to: 'stats',       label: 'Stats',        icon: Star,            group: 'content' },
  { to: 'faqs',        label: 'FAQs',         icon: MessageSquare,   group: 'content' },
  { to: 'orders',      label: 'Orders',       icon: ShoppingBag,     group: 'main' },
  { to: 'settings',    label: 'Settings',     icon: Settings,        group: 'main' },
];

const Sidebar = ({ active, setActive, onLogout }) => (
  <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[var(--eh-border)] eh-grid-bg h-screen sticky top-0">
    <div className="p-5 border-b border-[var(--eh-border)] flex items-center gap-3">
      <Logo size={36} />
      <div><div className="eh-brand font-black tracking-widest text-sm eh-neon-soft">CONTROL</div><div className="text-[10px] eh-mono opacity-60">// admin panel</div></div>
    </div>
    <nav className="p-3 flex-1 eh-scroll overflow-y-auto">
      {sections.map(s => { const I = s.icon; return (
        <button key={s.to} onClick={()=>setActive(s.to)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded mb-1 text-[12px] eh-mono tracking-widest uppercase text-left ${active===s.to ? 'bg-[rgba(0,255,157,.1)] text-[var(--eh-green)] border border-[rgba(0,255,157,.3)]' : 'hover:bg-white/5'}`}>
          <I size={14} /> {s.label}
        </button>
      );})}
    </nav>
    <div className="p-3 border-t border-[var(--eh-border)]">
      <Link to="/" target="_blank" className="w-full flex items-center gap-2 text-sm eh-mono opacity-70 hover:opacity-100 px-3 py-2"><Activity size={14} /> view site</Link>
      <button onClick={onLogout} className="w-full flex items-center gap-2 text-sm eh-mono opacity-70 hover:opacity-100 px-3 py-2 text-left"><LogOut size={14} /> logout</button>
    </div>
  </aside>
);

const Section = ({ title, kicker, actions, children }) => (
  <div>
    <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
      <div><div className="eh-kicker mb-2">{kicker}</div><h2 className="eh-display text-2xl md:text-3xl font-black">{title}</h2></div>
      <div className="flex gap-2 flex-wrap">{actions}</div>
    </div>
    {children}
  </div>
);

const StatCard = ({ label, value, hint }) => (
  <div className="eh-panel eh-brackets p-5"><span className="br-bl" /><span className="br-br" />
    <div className="eh-mono text-xs opacity-60 tracking-widest">{label}</div>
    <div className="eh-display text-3xl font-black eh-neon mt-2">{value}</div>
    {hint && <div className="eh-mono text-[11px] opacity-60 mt-1">{hint}</div>}
  </div>
);

const Label = ({ children, hint }) => (
  <div className="eh-mono text-xs tracking-[.25em] opacity-70 mb-2 flex items-center gap-2">{children}{hint && <span className="opacity-50 normal-case">— {hint}</span>}</div>
);

const Input = (props) => <input className="eh-input" {...props} />;
const Textarea = (props) => <textarea className="eh-textarea" {...props} />;

// Edit Modal -- generic form editor for any record
const EditModal = ({ item, fields, onClose, onSave, title }) => {
  const [data, setData] = useState(item || {});
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl eh-panel eh-brackets p-5 sm:p-7 my-6" onClick={e=>e.stopPropagation()}>
        <span className="br-bl" /><span className="br-br" />
        <div className="flex items-center justify-between mb-5">
          <div><div className="eh-kicker mb-1">// {item?.id ? 'EDIT' : 'CREATE'}</div><h3 className="eh-display text-xl font-black">{title}</h3></div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={18} /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto eh-scroll pr-1">
          {fields.map(f => (
            <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
              <Label hint={f.hint}>{f.label}</Label>
              {f.type === 'textarea' ? (
                <Textarea rows={f.rows || 4} value={data[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={`> ${f.label.toLowerCase()}`} />
              ) : f.type === 'select' ? (
                <select className="eh-input" value={data[f.key] || ''} onChange={e => set(f.key, e.target.value)}>
                  <option value="">--</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!data[f.key]} onChange={e => set(f.key, e.target.checked)} className="w-4 h-4 accent-[var(--eh-green)]" /> {f.label}
                </label>
              ) : f.type === 'array' ? (
                <div className="space-y-2">
                  {((data[f.key] || []).length === 0 ? [''] : data[f.key]).map((v, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input value={v} onChange={e => { const arr = [...(data[f.key]||[''])]; arr[idx] = e.target.value; set(f.key, arr); }} placeholder={`> item ${idx+1}`} />
                      <button type="button" onClick={()=>{ const arr=[...(data[f.key]||[])]; arr.splice(idx,1); set(f.key, arr); }} className="w-10 h-10 grid place-items-center rounded border border-[var(--eh-border)] hover:border-red-400 opacity-70"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => set(f.key, [...(data[f.key]||[]), ''])} className="eh-btn-ghost text-[11px]"><Plus size={12} /> ADD ITEM</button>
                </div>
              ) : (
                <Input type={f.type === 'number' ? 'number' : 'text'} value={data[f.key] ?? ''} onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)} placeholder={`> ${f.label.toLowerCase()}`} />
              )}
              {f.key.toLowerCase().includes('cover') || f.key.toLowerCase().includes('image') || f.key === 'logoUrl' ? (
                data[f.key] && <img src={data[f.key]} alt="preview" className="mt-2 max-h-32 rounded border border-[var(--eh-border)] object-cover" onError={e => e.target.style.display='none'} />
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onClose} className="eh-btn-ghost text-xs">CANCEL</button>
          <button onClick={() => { onSave(data); onClose(); }} className="eh-btn-primary text-xs"><Save size={14} /> SAVE</button>
        </div>
      </div>
    </div>
  );
};

const ListManager = ({ title, kicker, items, columns, fields, onChange, idKey = 'id' }) => {
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const handleSave = (data) => {
    if (editing) {
      onChange(items.map(it => it[idKey] === editing[idKey] ? { ...it, ...data } : it));
    } else {
      const newId = data[idKey] || (idKey === 'id' ? 'x' + Date.now() : data[idKey]);
      onChange([{ ...data, [idKey]: newId }, ...items]);
    }
  };
  const remove = (it) => { onChange(items.filter(x => x[idKey] !== it[idKey])); toast.success('Removed'); };
  return (
    <Section kicker={kicker} title={title} actions={<button onClick={()=>setShowNew(true)} className="eh-btn-primary text-xs"><Plus size={14} /> ADD NEW</button>}>
      <div className="eh-panel overflow-x-auto">
        <table className="w-full eh-mono text-sm min-w-[640px]">
          <thead><tr className="text-left border-b border-[var(--eh-border)]">{columns.map(c => <th key={c.key} className="p-3 text-xs tracking-widest opacity-70">{c.label}</th>)}<th className="p-3 w-24 text-right">Actions</th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it[idKey]} className="border-b border-[var(--eh-border)] hover:bg-white/[.02]">
                {columns.map(c => (
                  <td key={c.key} className="p-3 align-top max-w-[260px]">
                    {c.render ? c.render(it) : <div className="truncate">{String(it[c.key] ?? '')}</div>}
                  </td>
                ))}
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={()=>setEditing(it)} className="w-7 h-7 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] hover:text-[var(--eh-green)]"><Edit3 size={12} /></button>
                    <button onClick={()=>remove(it)} className="w-7 h-7 grid place-items-center rounded border border-[var(--eh-border)] hover:border-red-400 hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={columns.length+1} className="p-6 text-center opacity-60">No entries yet. Click ADD NEW.</td></tr>}
          </tbody>
        </table>
      </div>
      {(editing || showNew) && <EditModal title={title} item={editing} fields={fields} onClose={() => { setEditing(null); setShowNew(false); }} onSave={handleSave} />}
    </Section>
  );
};

const Branding = () => {
  const { config, update } = useSiteConfig();
  const s = config.site;
  return (
    <Section kicker="// IDENTITY" title="BRANDING & IDENTITY">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="eh-panel p-5 space-y-4">
          <Label hint="brand name shown everywhere">SITE NAME</Label>
          <Input value={s.name} onChange={e => update('site.name', e.target.value)} />
          <Label hint="script tagline below brand">TAGLINE</Label>
          <Input value={s.tagline} onChange={e => update('site.tagline', e.target.value)} />
          <Label hint="paragraph under hero">DESCRIPTION</Label>
          <Textarea rows={3} value={s.description} onChange={e => update('site.description', e.target.value)} />
          <Label hint="text that scrolls on top">MARQUEE TEXT</Label>
          <Input value={s.marquee} onChange={e => update('site.marquee', e.target.value)} />
          <Label hint="version shown in boot/footer">VERSION TAG</Label>
          <Input value={s.version} onChange={e => update('site.version', e.target.value)} />
        </div>
        <div className="eh-panel p-5 space-y-4">
          <Label hint="any image URL">LOGO URL</Label>
          <Input value={s.logoUrl} onChange={e => update('site.logoUrl', e.target.value)} />
          {s.logoUrl && <div className="flex justify-center pt-1"><div className="w-28 h-28 rounded-full overflow-hidden" style={{ boxShadow: '0 0 0 2px var(--eh-green), 0 0 18px rgba(0,255,157,.4)' }}><img src={s.logoUrl} alt="logo" className="w-full h-full object-cover" /></div></div>}
          <Label hint="neon green primary color">BRAND COLOR</Label>
          <div className="flex gap-2 items-center"><input type="color" value={s.brandColor || '#00ff9d'} onChange={e => update('site.brandColor', e.target.value)} className="w-12 h-12 rounded cursor-pointer bg-transparent border border-[var(--eh-border)]" /><Input value={s.brandColor || '#00ff9d'} onChange={e => update('site.brandColor', e.target.value)} /></div>
          <div className="flex gap-2 flex-wrap">
            {['#00ff9d','#ff2a3a','#4de0ff','#ffcc00','#a855f7','#22c55e','#f97316'].map(c => (
              <button key={c} onClick={() => update('site.brandColor', c)} className="w-8 h-8 rounded border" style={{ background: c, borderColor: 'var(--eh-border)' }} />
            ))}
          </div>
          <Label hint="telegram link">TELEGRAM URL</Label>
          <Input value={s.telegram} onChange={e => update('site.telegram', e.target.value)} />
          <Label>SUPPORT EMAIL</Label>
          <Input value={s.email} onChange={e => update('site.email', e.target.value)} />
        </div>
      </div>
      <div className="eh-mono text-xs opacity-60 mt-4">// Changes save automatically and apply to the live site.</div>
    </Section>
  );
};

const HeroEditor = () => {
  const { config, update } = useSiteConfig();
  const h = config.hero;
  return (
    <Section kicker="// LANDING" title="HERO SECTION">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="eh-panel p-5 space-y-4">
          <Label>SYSTEM KICKER</Label>
          <Input value={h.kicker} onChange={e => update('hero.kicker', e.target.value)} />
          <Label>WELCOME LINE</Label>
          <Input value={h.welcome} onChange={e => update('hero.welcome', e.target.value)} />
          <Label>PRIMARY BUTTON</Label>
          <div className="grid grid-cols-2 gap-2"><Input value={h.primaryCta} onChange={e=>update('hero.primaryCta', e.target.value)} placeholder="label" /><Input value={h.primaryCtaTo} onChange={e=>update('hero.primaryCtaTo', e.target.value)} placeholder="/services" /></div>
          <Label>GHOST BUTTON</Label>
          <div className="grid grid-cols-2 gap-2"><Input value={h.ghostCta} onChange={e=>update('hero.ghostCta', e.target.value)} placeholder="label" /><Input value={h.ghostCtaTo} onChange={e=>update('hero.ghostCtaTo', e.target.value)} placeholder="/tools" /></div>
        </div>
        <div className="eh-panel p-5 space-y-3">
          <Label hint="terminal-style typing lines">TYPEWRITER LINES</Label>
          {(h.typewriterLines || []).map((line, i) => (
            <div key={i} className="flex gap-2">
              <Input value={line} onChange={e => { const arr=[...h.typewriterLines]; arr[i] = e.target.value; update('hero.typewriterLines', arr); }} />
              <button onClick={() => update('hero.typewriterLines', h.typewriterLines.filter((_,k)=>k!==i))} className="w-10 h-10 grid place-items-center rounded border border-[var(--eh-border)] hover:border-red-400 opacity-70"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => update('hero.typewriterLines', [...(h.typewriterLines||[]), 'new line...'])} className="eh-btn-ghost text-[11px]"><Plus size={12} /> ADD LINE</button>
        </div>
      </div>
    </Section>
  );
};

const NavigationEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// MENU"
      title="NAVIGATION ITEMS"
      items={config.nav.map((n, i) => ({ id: 'nav-' + i, ...n }))}
      columns={[
        { key: 'label', label: 'LABEL' },
        { key: 'to',    label: 'PATH' },
      ]}
      fields={[
        { key: 'label', label: 'Label', full: true },
        { key: 'to',    label: 'Path', hint: '/services, /books, etc.', full: true },
      ]}
      onChange={(arr) => setList('nav', arr.map(({ id, ...r }) => r))}
    />
  );
};

const ServicesEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// CATALOG"
      title="MANAGE SERVICES"
      items={config.services}
      columns={[
        { key: 'name',  label: 'NAME' },
        { key: 'price', label: 'PRICE', render: it => <span className="eh-neon-soft">${it.price}</span> },
        { key: 'delivery', label: 'DELIVERY' },
        { key: 'tag', label: 'TAG' },
      ]}
      fields={[
        { key: 'name', label: 'Name', full: true },
        { key: 'short', label: 'Short Description', full: true, type: 'textarea', rows: 2 },
        { key: 'long', label: 'Long Description', full: true, type: 'textarea', rows: 5 },
        { key: 'price', label: 'Price (USD)', type: 'number' },
        { key: 'delivery', label: 'Delivery Time', hint: 'e.g. 24-72 hours' },
        { key: 'guarantee', label: 'Guarantee' },
        { key: 'tag', label: 'Tag', hint: 'POPULAR / NEW / HOT' },
        { key: 'icon', label: 'Icon', type: 'select', options: ['youtube','instagram','send','facebook','music','shield'] },
      ]}
      onChange={(arr) => setList('services', arr)}
    />
  );
};

const BooksEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// LIBRARY"
      title="MANAGE BOOKS"
      items={config.books}
      columns={[
        { key: 'title',  label: 'TITLE' },
        { key: 'author', label: 'AUTHOR' },
        { key: 'price',  label: 'PRICE', render: it => <span className="eh-neon-soft">${it.price}</span> },
        { key: 'level',  label: 'LEVEL' },
      ]}
      fields={[
        { key: 'title', label: 'Title', full: true },
        { key: 'author', label: 'Author' },
        { key: 'price', label: 'Price (USD)', type: 'number' },
        { key: 'pages', label: 'Pages', type: 'number' },
        { key: 'level', label: 'Level', type: 'select', options: ['Beginner','Intermediate','Advanced','All'] },
        { key: 'tag',   label: 'Tag', hint: 'Bestseller / New / Hot / Pro' },
        { key: 'cover', label: 'Cover Image URL', full: true },
      ]}
      onChange={(arr) => setList('books', arr)}
    />
  );
};

const MembershipsEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// TIERS"
      title="MANAGE MEMBERSHIPS"
      items={config.memberships}
      columns={[
        { key: 'name',   label: 'TIER' },
        { key: 'price',  label: 'PRICE', render: it => <span className="eh-neon-soft">${it.price}/{it.period}</span> },
        { key: 'color',  label: 'COLOR' },
        { key: 'popular',label: 'POPULAR', render: it => it.popular ? 'YES' : '-' },
      ]}
      fields={[
        { key: 'name', label: 'Tier Name', hint: 'ROOKIE / OPERATOR / ELITE' },
        { key: 'price', label: 'Price', type: 'number' },
        { key: 'period', label: 'Period', hint: 'mo, yr' },
        { key: 'color', label: 'Color', type: 'select', options: ['cyan','green','red'] },
        { key: 'popular', label: 'Mark as Most Popular', type: 'checkbox' },
        { key: 'perks', label: 'Perks (one per line)', type: 'array', full: true },
      ]}
      onChange={(arr) => setList('memberships', arr)}
    />
  );
};

const BlogsEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// CONTENT"
      title="MANAGE BLOGS"
      items={config.blogs}
      columns={[
        { key: 'title', label: 'TITLE' },
        { key: 'tag', label: 'TAG' },
        { key: 'date', label: 'DATE' },
      ]}
      fields={[
        { key: 'title', label: 'Title', full: true },
        { key: 'tag', label: 'Tag', hint: 'ARTICLE / GUIDE / STORY / LAB' },
        { key: 'date', label: 'Date', hint: 'YYYY-MM-DD' },
        { key: 'excerpt', label: 'Excerpt', full: true, type: 'textarea', rows: 3 },
        { key: 'cover', label: 'Cover Image URL', full: true },
      ]}
      onChange={(arr) => setList('blogs', arr)}
    />
  );
};

const ToolsEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// ARSENAL"
      title="MANAGE TOOLS"
      items={config.tools}
      columns={[
        { key: 'name', label: 'NAME' },
        { key: 'category', label: 'CATEGORY' },
        { key: 'size', label: 'SIZE' },
        { key: 'downloads', label: 'DOWNLOADS' },
      ]}
      fields={[
        { key: 'name', label: 'Name', full: true },
        { key: 'category', label: 'Category', hint: 'Termux / Recon / OSINT' },
        { key: 'size', label: 'File Size', hint: 'e.g. 4.2 MB' },
        { key: 'downloads', label: 'Downloads (count)', type: 'number' },
        { key: 'desc', label: 'Description', full: true, type: 'textarea', rows: 3 },
      ]}
      onChange={(arr) => setList('tools', arr)}
    />
  );
};

const HowEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// PROTOCOL"
      title="HOW IT WORKS STEPS"
      items={config.howSteps.map((s, i) => ({ id: 'how-' + i, ...s }))}
      columns={[
        { key: 'n', label: 'STEP' },
        { key: 't', label: 'TITLE' },
        { key: 'icon', label: 'ICON' },
      ]}
      fields={[
        { key: 'n', label: 'Step Number', hint: '01, 02, ...' },
        { key: 't', label: 'Title' },
        { key: 'icon', label: 'Icon', type: 'select', options: ['MessageSquare','Lock','Cpu','BadgeCheck','Shield','Zap','Send','Star'] },
        { key: 'd', label: 'Description', full: true, type: 'textarea', rows: 3 },
      ]}
      onChange={(arr) => setList('howSteps', arr.map(({ id, ...r }) => r))}
    />
  );
};

const PartnersEditor = () => {
  const { config, setList } = useSiteConfig();
  const [val, setVal] = useState('');
  return (
    <Section kicker="// AS_SEEN_ON" title="PARTNER LOGOS / BRANDS" actions={<button onClick={()=>setList('partners', DEFAULTS.partners)} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> RESET</button>}>
      <div className="eh-panel p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {config.partners.map((p, i) => (
            <div key={p+i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm eh-mono" style={{ background: 'rgba(0,255,157,.08)', border: '1px solid rgba(0,255,157,.25)' }}>
              {p}
              <button onClick={() => setList('partners', config.partners.filter((_,k)=>k!==i))} className="opacity-60 hover:opacity-100 hover:text-red-400"><X size={12} /></button>
            </div>
          ))}
        </div>
        <form onSubmit={e=>{e.preventDefault(); if(val.trim()){ setList('partners', [...config.partners, val.trim()]); setVal(''); }}} className="flex gap-2">
          <Input value={val} onChange={e=>setVal(e.target.value)} placeholder="> new brand name" />
          <button className="eh-btn-primary text-xs"><Plus size={12} /> ADD</button>
        </form>
      </div>
    </Section>
  );
};

const TestimonialsEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// FEEDBACK"
      title="MANAGE TESTIMONIALS"
      items={config.testimonials.map((t,i)=>({ id: 'tm-'+i, ...t }))}
      columns={[{ key: 'name', label: 'NAME' }, { key: 'role', label: 'ROLE' }, { key: 'text', label: 'QUOTE' }]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role / Title' },
        { key: 'text', label: 'Quote', full: true, type: 'textarea', rows: 4 },
      ]}
      onChange={(arr) => setList('testimonials', arr.map(({ id, ...r }) => r))}
    />
  );
};

const ActivityEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// LIVE_FEED"
      title="LIVE ORDER FEED ENTRIES"
      items={config.activity}
      columns={[
        { key: 'user', label: 'USER' },
        { key: 'service', label: 'SERVICE' },
        { key: 'location', label: 'LOCATION' },
        { key: 'amount', label: 'AMOUNT', render: it => <span className="eh-neon-soft">${it.amount}</span> },
      ]}
      fields={[
        { key: 'user', label: 'User handle', hint: '@username' },
        { key: 'service', label: 'Service' },
        { key: 'location', label: 'Location' },
        { key: 'ago', label: 'Time ago', hint: '14s ago / 1m ago' },
        { key: 'amount', label: 'Amount (USD)', type: 'number' },
      ]}
      onChange={(arr) => setList('activity', arr)}
    />
  );
};

const StatsEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// METRICS"
      title="HEADLINE STATS"
      items={config.stats.map((s,i)=>({ id: 'st-'+i, ...s }))}
      columns={[{ key: 'label', label: 'LABEL' }, { key: 'value', label: 'VALUE' }]}
      fields={[
        { key: 'label', label: 'Label' },
        { key: 'value', label: 'Value', hint: 'e.g. 12,400+ or 4.9/5' },
      ]}
      onChange={(arr) => setList('stats', arr.map(({ id, ...r }) => r))}
    />
  );
};

const FAQEditor = () => {
  const { config, setList } = useSiteConfig();
  return (
    <ListManager
      kicker="// KNOWLEDGE"
      title="MANAGE FAQS"
      items={config.faqs.map((f,i)=>({ id: 'faq-'+i, ...f }))}
      columns={[{ key: 'q', label: 'QUESTION' }]}
      fields={[
        { key: 'q', label: 'Question', full: true },
        { key: 'a', label: 'Answer', full: true, type: 'textarea', rows: 5 },
      ]}
      onChange={(arr) => setList('faqs', arr.map(({ id, ...r }) => r))}
    />
  );
};

const ComparisonEditor = () => {
  const { config, setList } = useSiteConfig();
  const update = (i, key, val) => setList('comparison', config.comparison.map((r, k) => k === i ? { ...r, [key]: val } : r));
  return (
    <Section kicker="// MATRIX" title="PLAN COMPARISON FEATURES" actions={<button onClick={() => setList('comparison', [...config.comparison, { f: 'New feature', r: false, o: false, e: false }])} className="eh-btn-primary text-xs"><Plus size={12} /> ADD ROW</button>}>
      <div className="eh-panel overflow-x-auto">
        <table className="w-full eh-mono text-sm min-w-[520px]">
          <thead><tr className="text-left border-b border-[var(--eh-border)]"><th className="p-3 text-xs tracking-widest opacity-70">FEATURE</th><th className="p-3 text-center text-xs">ROOKIE</th><th className="p-3 text-center text-xs">OPERATOR</th><th className="p-3 text-center text-xs">ELITE</th><th className="p-3 w-12"></th></tr></thead>
          <tbody>
            {config.comparison.map((r, i) => (
              <tr key={i} className="border-b border-[var(--eh-border)]">
                <td className="p-2"><Input value={r.f} onChange={e=>update(i,'f',e.target.value)} /></td>
                {['r','o','e'].map(k => (<td key={k} className="p-2 text-center"><input type="checkbox" checked={!!r[k]} onChange={e=>update(i,k,e.target.checked)} className="w-4 h-4 accent-[var(--eh-green)]" /></td>))}
                <td className="p-2 text-right"><button onClick={()=>setList('comparison', config.comparison.filter((_,k)=>k!==i))} className="opacity-60 hover:text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

const Orders = () => {
  const [orders, setOrders] = useState(() => JSON.parse(localStorage.getItem('eh_orders') || '[]'));
  const clear = () => { localStorage.removeItem('eh_orders'); setOrders([]); toast.success('Orders cleared'); };
  const updateStatus = (id, status) => {
    const next = orders.map(o => o.id === id ? { ...o, status } : o);
    localStorage.setItem('eh_orders', JSON.stringify(next));
    setOrders(next);
  };
  return (
    <Section kicker="// INCOMING" title="ORDERS INBOX" actions={<button onClick={clear} className="eh-btn-ghost text-xs"><Trash2 size={12} /> CLEAR ALL</button>}>
      <div className="eh-panel overflow-x-auto">
        <table className="w-full eh-mono text-sm min-w-[820px]">
          <thead><tr className="text-left border-b border-[var(--eh-border)]"><th className="p-3 text-xs tracking-widest opacity-70">ID</th><th className="p-3 text-xs">SERVICE</th><th className="p-3 text-xs">CLIENT</th><th className="p-3 text-xs">EMAIL</th><th className="p-3 text-xs">SIZE</th><th className="p-3 text-xs">TARGET</th><th className="p-3 text-xs">STATUS</th><th className="p-3 text-xs">DATE</th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="border-b border-[var(--eh-border)]">
                <td className="p-3 eh-neon-soft">{o.id}</td>
                <td className="p-3">{o.serviceName}</td>
                <td className="p-3">{o.name}</td>
                <td className="p-3 opacity-80">{o.email}</td>
                <td className="p-3">{o.size}</td>
                <td className="p-3 opacity-80 max-w-[200px] truncate">{o.target}</td>
                <td className="p-3"><select value={o.status} onChange={e=>updateStatus(o.id, e.target.value)} className="eh-input py-1 text-xs"><option value="received">received</option><option value="verified">verified</option><option value="in-progress">in-progress</option><option value="delivered">delivered</option></select></td>
                <td className="p-3 opacity-70 text-xs">{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {orders.length===0 && <tr><td colSpan={8} className="p-6 text-center opacity-60">Inbox empty. Place a test order from the storefront.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

const SettingsTab = () => {
  const { config, update, setConfig, reset } = useSiteConfig();
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `errorhacker-config-${Date.now()}.json`; a.click();
    toast.success('Config exported');
  };
  const importConfig = (e) => {
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => { try { setConfig({ ...config, ...JSON.parse(r.result) }); toast.success('Config imported'); } catch { toast.error('Invalid JSON'); } };
    r.readAsText(f);
  };
  return (
    <Section kicker="// SYSTEM" title="SETTINGS">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="eh-panel p-5">
          <Label hint="used to access /admin">ADMIN PASSWORD</Label>
          <Input type="text" value={config.site.adminPass} onChange={e => update('site.adminPass', e.target.value)} />
          <div className="eh-mono text-[11px] opacity-60 mt-2">Default: admin123. Change to secure your panel.</div>
        </div>
        <div className="eh-panel p-5">
          <Label>BACKUP & RESTORE</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            <button onClick={exportConfig} className="eh-btn-ghost text-xs"><Download size={12} /> EXPORT JSON</button>
            <label className="eh-btn-ghost text-xs cursor-pointer"><Upload size={12} /> IMPORT JSON<input type="file" accept="application/json" onChange={importConfig} className="hidden" /></label>
            <button onClick={() => { if(window.confirm('Reset ALL settings to defaults? This cannot be undone.')) { reset(); toast.success('Reset complete'); }}} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> RESET ALL</button>
          </div>
        </div>
      </div>
    </Section>
  );
};

const Overview = () => {
  const { config } = useSiteConfig();
  const orders = JSON.parse(localStorage.getItem('eh_orders') || '[]');
  return (
    <Section kicker="// DASHBOARD" title="COMMAND OVERVIEW">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="SERVICES" value={config.services.length} hint="offerings" />
        <StatCard label="BOOKS" value={config.books.length} hint="library" />
        <StatCard label="MEMBERSHIPS" value={config.memberships.length} hint="tiers" />
        <StatCard label="BLOGS" value={config.blogs.length} hint="posts" />
        <StatCard label="TOOLS" value={config.tools.length} hint="arsenal" />
        <StatCard label="ORDERS" value={orders.length} hint="received" />
      </div>
      <Section kicker="// RECENT" title="LAST 5 ORDERS">
        <div className="eh-panel overflow-x-auto">
          <table className="w-full eh-mono text-sm"><thead><tr className="text-left border-b border-[var(--eh-border)]"><th className="p-3 text-xs tracking-widest opacity-70">ID</th><th className="p-3 text-xs">SERVICE</th><th className="p-3 text-xs">CLIENT</th><th className="p-3 text-xs">STATUS</th><th className="p-3 text-xs">DATE</th></tr></thead><tbody>
            {orders.slice(0,5).map(o => (
              <tr key={o.id} className="border-b border-[var(--eh-border)]">
                <td className="p-3 eh-neon-soft">{o.id}</td><td className="p-3">{o.serviceName}</td><td className="p-3">{o.name}</td>
                <td className="p-3"><span className="px-2 py-1 rounded text-[11px]" style={{ background:'rgba(0,255,157,.1)', color:'var(--eh-green)' }}>{o.status}</span></td>
                <td className="p-3 opacity-70 text-xs">{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="p-6 text-center opacity-60">No orders yet. Place one from the storefront.</td></tr>}
          </tbody></table>
        </div>
      </Section>
    </Section>
  );
};

const Login = ({ onOk }) => {
  const { config } = useSiteConfig();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const submit = e => { e.preventDefault(); if (pw === config.site.adminPass) { localStorage.setItem('eh_admin','1'); onOk(); } else { toast.error('Access denied'); } };
  return (
    <div className="min-h-screen flex items-center justify-center eh-grid-bg p-6">
      <form onSubmit={submit} className="w-full max-w-sm eh-panel eh-brackets p-7"><span className="br-bl" /><span className="br-br" />
        <div className="flex items-center gap-3 mb-5"><Logo size={40} /><div><div className="eh-brand font-black tracking-widest eh-neon-soft">CONTROL</div><div className="text-[10px] eh-mono opacity-60">// admin login</div></div></div>
        <div className="eh-mono text-xs opacity-70 mb-2 flex items-center gap-2"><Lock size={12} color="var(--eh-green)" /> ACCESS_KEY</div>
        <div className="relative">
          <input type={show?'text':'password'} value={pw} onChange={e=>setPw(e.target.value)} placeholder="> ********" className="eh-input pr-10" autoFocus />
          <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <button className="eh-btn-primary w-full mt-5 text-xs">AUTHENTICATE</button>
        <div className="eh-mono text-[11px] opacity-50 mt-4 text-center">default: admin123 · change after first login</div>
      </form>
    </div>
  );
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => localStorage.getItem('eh_admin') === '1');
  const [active, setActive] = useState('overview');
  if (!authed) return <Login onOk={() => setAuthed(true)} />;
  const logout = () => { localStorage.removeItem('eh_admin'); setAuthed(false); navigate('/admin'); };

  return (
    <div className="min-h-screen flex bg-[var(--eh-bg)]">
      <Sidebar active={active} setActive={setActive} onLogout={logout} />
      <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-x-hidden">
        <div className="md:hidden mb-4 flex gap-2 overflow-x-auto eh-scroll pb-2">
          {sections.map(s => (<button key={s.to} onClick={()=>setActive(s.to)} className={`shrink-0 px-3 py-2 rounded text-[11px] eh-mono tracking-widest uppercase ${active===s.to ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>{s.label}</button>))}
        </div>

        {active==='overview'    && <Overview />}
        {active==='branding'    && <Branding />}
        {active==='hero'        && <HeroEditor />}
        {active==='navigation'  && <NavigationEditor />}
        {active==='services'    && <ServicesEditor />}
        {active==='books'       && <BooksEditor />}
        {active==='memberships' && <MembershipsEditor />}
        {active==='comparison'  && <ComparisonEditor />}
        {active==='blogs'       && <BlogsEditor />}
        {active==='tools'       && <ToolsEditor />}
        {active==='how'         && <HowEditor />}
        {active==='partners'    && <PartnersEditor />}
        {active==='testimonials'&& <TestimonialsEditor />}
        {active==='activity'    && <ActivityEditor />}
        {active==='stats'       && <StatsEditor />}
        {active==='faqs'        && <FAQEditor />}
        {active==='orders'      && <Orders />}
        {active==='settings'    && <SettingsTab />}
      </main>
    </div>
  );
};
export default AdminPanel;
