import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wrench, BookOpen, CreditCard, FileText, Terminal, Settings, LogOut, Plus, Trash2, ShoppingBag, Edit3, Save, X, Eye, EyeOff, Lock, Image as ImageIcon, Palette, Type, MessageSquare, Star, Quote, Activity, RefreshCcw, Download, Upload, Award, GitBranch, BadgeCheck, Cpu, Zap, Loader2, ArrowUp, ArrowDown, User, Mail, Copy } from 'lucide-react';
import Logo from '../components/Logo';
import ImageInput from '../components/ImageInput';
import { useSiteConfig, DEFAULTS } from '../contexts/SiteConfigContext';
import { api } from '../lib/api';
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
  { to: 'users',       label: 'Users',        icon: User,            group: 'main' },
  { to: 'feed',        label: 'Feed (IG)',    icon: Activity,        group: 'main' },
  { to: 'payments',    label: 'Payments',     icon: CreditCard,      group: 'main' },
  { to: 'coupons',     label: 'Coupons',      icon: Zap,             group: 'main' },
  { to: 'notifications', label: 'Notifications', icon: MessageSquare, group: 'main' },
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
              ) : f.key.toLowerCase().includes('cover') || f.key.toLowerCase().includes('image') || f.key === 'logoUrl' ? (
                <ImageInput value={data[f.key] || ''} onChange={(v) => set(f.key, v)} testid={`edit-${f.key}`} />
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
  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  return (
    <Section kicker={kicker} title={title} actions={<button onClick={()=>setShowNew(true)} className="eh-btn-primary text-xs"><Plus size={14} /> ADD NEW</button>}>
      <div className="eh-panel overflow-x-auto">
        <table className="w-full eh-mono text-sm min-w-[640px]">
          <thead><tr className="text-left border-b border-[var(--eh-border)]">{columns.map(c => <th key={c.key} className="p-3 text-xs tracking-widest opacity-70">{c.label}</th>)}<th className="p-3 w-32 text-right">Actions</th></tr></thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it[idKey]} className="border-b border-[var(--eh-border)] hover:bg-white/[.02]">
                {columns.map(c => (
                  <td key={c.key} className="p-3 align-top max-w-[260px]">
                    {c.render ? c.render(it) : <div className="truncate">{String(it[c.key] ?? '')}</div>}
                  </td>
                ))}
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={()=>move(idx, -1)} disabled={idx === 0} className="w-7 h-7 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] hover:text-[var(--eh-green)] disabled:opacity-30 disabled:hover:border-[var(--eh-border)] disabled:hover:text-current" title="Move up"><ArrowUp size={12} /></button>
                    <button onClick={()=>move(idx, 1)} disabled={idx === items.length - 1} className="w-7 h-7 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] hover:text-[var(--eh-green)] disabled:opacity-30 disabled:hover:border-[var(--eh-border)] disabled:hover:text-current" title="Move down"><ArrowDown size={12} /></button>
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
          <Label hint="upload from device or paste URL">LOGO IMAGE</Label>
          <ImageInput value={s.logoUrl || ''} onChange={(v) => update('site.logoUrl', v)} testid="branding-logo" />
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try { setOrders(await api.listOrders()); } catch (e) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);
  const clear = async () => {
    if (!window.confirm('Delete ALL orders permanently?')) return;
    try { await api.clearOrders(); setOrders([]); toast.success('Orders cleared'); } catch (e) { toast.error(e.message); }
  };
  const updateStatus = async (id, status) => {
    try { await api.updateOrder(id, status); setOrders(orders.map(o => o.id === id ? { ...o, status } : o)); toast.success('Status updated'); } catch (e) { toast.error(e.message); }
  };
  return (
    <Section kicker="// INCOMING" title="ORDERS INBOX" actions={<><button onClick={reload} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> REFRESH</button><button onClick={clear} className="eh-btn-ghost text-xs"><Trash2 size={12} /> CLEAR ALL</button></>}>
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
            {!loading && orders.length===0 && <tr><td colSpan={8} className="p-6 text-center opacity-60">Inbox empty. Place a test order from the storefront.</td></tr>}
            {loading && <tr><td colSpan={8} className="p-6 text-center opacity-60 eh-mono text-xs">&gt; loading orders...</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

const FeedManager = () => {
  const { config, update } = useSiteConfig();
  const profile = config.feedProfile || { username: 'errorhacker', displayName: 'ERRORHACKER', bio: '', website: '', followers: 0, following: 0, verified: true };
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // {kind:'post'|'reel', data}
  const [selectedComments, setSelectedComments] = useState(null); // {kind, id, items}

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([api.feedListPosts(), api.feedListReels()]);
      setPosts(p); setReels(r);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const openNew = (kind) => setEditing({ kind, data: kind === 'post'
    ? { image_url: '', caption: '', location: '', likes_base: 0, views_base: 0, pinned: false }
    : { video_url: '', thumb_url: '', caption: '', likes_base: 0, views_base: 0, pinned: false } });

  const save = async () => {
    if (!editing) return;
    const { kind, data } = editing;
    try {
      if (kind === 'post') {
        if (!data.image_url) { toast.error('Image URL required'); return; }
        if (data.id) await api.feedUpdatePost(data.id, { image_url: data.image_url, caption: data.caption || '', location: data.location || '', likes_base: Number(data.likes_base) || 0, views_base: Number(data.views_base) || 0, pinned: !!data.pinned });
        else await api.feedCreatePost({ ...data, likes_base: Number(data.likes_base) || 0, views_base: Number(data.views_base) || 0 });
      } else {
        if (!data.video_url) { toast.error('Video URL required'); return; }
        if (data.id) await api.feedUpdateReel(data.id, { video_url: data.video_url, thumb_url: data.thumb_url || '', caption: data.caption || '', likes_base: Number(data.likes_base) || 0, views_base: Number(data.views_base) || 0, pinned: !!data.pinned });
        else await api.feedCreateReel({ ...data, likes_base: Number(data.likes_base) || 0, views_base: Number(data.views_base) || 0 });
      }
      toast.success('Saved');
      setEditing(null);
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (kind, id) => {
    if (!window.confirm(`Delete this ${kind}?`)) return;
    try {
      if (kind === 'post') await api.feedDeletePost(id);
      else await api.feedDeleteReel(id);
      toast.success('Deleted'); refresh();
    } catch (e) { toast.error(e.message); }
  };

  const togglePin = async (kind, item) => {
    try {
      if (kind === 'post') await api.feedUpdatePost(item.id, { pinned: !item.pinned });
      else await api.feedUpdateReel(item.id, { pinned: !item.pinned });
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const openComments = async (kind, id) => {
    try {
      const items = kind === 'post' ? await api.feedPostComments(id) : await api.feedReelComments(id);
      setSelectedComments({ kind, id, items, newName: '', newText: '', newPic: '' });
    } catch (e) { toast.error(e.message); }
  };

  const addAdminComment = async () => {
    if (!selectedComments) return;
    const { kind, id, newName, newText, newPic } = selectedComments;
    if (!newName || !newText) { toast.error('Name and text required'); return; }
    try {
      const c = await api.feedAddAdminComment({ [kind === 'post' ? 'post_id' : 'reel_id']: id, user_name: newName, text: newText, picture: newPic || '' });
      setSelectedComments(s => ({ ...s, items: [...s.items, c], newName: '', newText: '', newPic: '' }));
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const delComment = async (cid) => {
    if (!window.confirm('Delete comment?')) return;
    try {
      await api.feedDeleteComment(cid);
      setSelectedComments(s => ({ ...s, items: s.items.filter(c => c.id !== cid) }));
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Section kicker="// SOCIAL" title="FEED MANAGER (POSTS · REELS · COMMENTS)" actions={<button onClick={refresh} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> REFRESH</button>}>
      {/* Profile config */}
      <div className="eh-panel p-5 mb-6">
        <div className="eh-kicker mb-3">// PROFILE HEADER</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>USERNAME</Label><Input value={profile.username} onChange={e => update('feedProfile.username', e.target.value)} /></div>
          <div><Label>DISPLAY NAME</Label><Input value={profile.displayName} onChange={e => update('feedProfile.displayName', e.target.value)} /></div>
          <div><Label>WEBSITE</Label><Input value={profile.website || ''} onChange={e => update('feedProfile.website', e.target.value)} /></div>
          <div><Label hint="number">FOLLOWERS</Label><Input type="number" value={profile.followers} onChange={e => update('feedProfile.followers', Number(e.target.value) || 0)} /></div>
          <div><Label hint="number">FOLLOWING</Label><Input type="number" value={profile.following} onChange={e => update('feedProfile.following', Number(e.target.value) || 0)} /></div>
          <div><Label>VERIFIED BADGE</Label><label className="inline-flex items-center gap-2 eh-mono text-xs cursor-pointer mt-2"><input type="checkbox" checked={!!profile.verified} onChange={e => update('feedProfile.verified', e.target.checked)} className="w-4 h-4 accent-[var(--eh-green)]" /> {profile.verified ? 'ON' : 'OFF'}</label></div>
          <div className="sm:col-span-2 lg:col-span-3"><Label>BIO (multi-line)</Label><Textarea rows={3} value={profile.bio || ''} onChange={e => update('feedProfile.bio', e.target.value)} /></div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('posts')} className={`px-4 py-2 rounded eh-mono text-xs tracking-widest ${tab==='posts' ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>POSTS ({posts.length})</button>
        <button onClick={() => setTab('reels')} className={`px-4 py-2 rounded eh-mono text-xs tracking-widest ${tab==='reels' ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>REELS ({reels.length})</button>
        <button onClick={() => openNew(tab === 'reels' ? 'reel' : 'post')} className="eh-btn-primary text-xs ml-auto"><Plus size={12} /> NEW {tab === 'reels' ? 'REEL' : 'POST'}</button>
      </div>

      {loading ? <div className="py-10 text-center opacity-60">Loading...</div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tab === 'posts' ? posts : reels).length === 0 && <div className="col-span-3 py-10 text-center opacity-60 eh-mono text-xs">No {tab} yet. Hit NEW above to create.</div>}
          {(tab === 'posts' ? posts : reels).map(item => (
            <div key={item.id} className="eh-panel overflow-hidden">
              <div className="aspect-square bg-black relative">
                {tab === 'posts'
                  ? <img src={item.image_url} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                  : (item.thumb_url
                      ? <img src={item.thumb_url} alt="" className="w-full h-full object-cover" />
                      : <video src={item.video_url} className="w-full h-full object-cover" muted preload="metadata" />)
                }
                {item.pinned && <span className="absolute top-2 left-2 text-[9px] eh-mono px-1.5 py-0.5 rounded bg-black/70 text-[var(--eh-green)] tracking-widest">PINNED</span>}
              </div>
              <div className="p-3">
                <div className="text-sm leading-5 line-clamp-2 mb-2">{item.caption || <span className="opacity-50">(no caption)</span>}</div>
                <div className="flex justify-between eh-mono text-[11px] opacity-70 mb-3">
                  <span>❤ {item.likes_count}</span>
                  <span>💬 {item.comments_count}</span>
                  <span>👁 {item.views_count}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setEditing({ kind: tab === 'posts' ? 'post' : 'reel', data: { ...item } })} className="eh-btn-ghost text-[11px] px-2 py-1"><Edit3 size={11} /> EDIT</button>
                  <button onClick={() => openComments(tab === 'posts' ? 'post' : 'reel', item.id)} className="eh-btn-ghost text-[11px] px-2 py-1"><MessageSquare size={11} /> {item.comments_count}</button>
                  <button onClick={() => togglePin(tab === 'posts' ? 'post' : 'reel', item)} className="eh-btn-ghost text-[11px] px-2 py-1">{item.pinned ? 'UNPIN' : 'PIN'}</button>
                  <button onClick={() => remove(tab === 'posts' ? 'post' : 'reel', item.id)} className="eh-btn-ghost text-[11px] px-2 py-1 ml-auto text-red-400 hover:text-red-300"><Trash2 size={11} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/85 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-xl eh-panel p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#0d1115' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="eh-kicker">// {editing.data.id ? 'EDIT' : 'NEW'} {editing.kind.toUpperCase()}</div>
              <button onClick={() => setEditing(null)} className="opacity-70 hover:opacity-100"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {editing.kind === 'post' ? (
                <>
                  <div><Label hint="upload or paste url">IMAGE</Label><ImageInput value={editing.data.image_url} onChange={(v) => setEditing(e => ({ ...e, data: { ...e.data, image_url: v } }))} /></div>
                  {editing.data.image_url && <img src={editing.data.image_url} className="max-h-48 rounded object-cover w-full" alt="" onError={e => e.target.style.display='none'} />}
                  <div><Label>CAPTION</Label><Textarea rows={3} value={editing.data.caption} onChange={e => setEditing(s => ({ ...s, data: { ...s.data, caption: e.target.value } }))} /></div>
                  <div><Label>LOCATION (optional)</Label><Input value={editing.data.location} onChange={e => setEditing(s => ({ ...s, data: { ...s.data, location: e.target.value } }))} placeholder="darknet" /></div>
                </>
              ) : (
                <>
                  <FeedVideoUpload value={editing.data.video_url} onChange={(v) => setEditing(e => ({ ...e, data: { ...e.data, video_url: v } }))} />
                  {editing.data.video_url && <video src={editing.data.video_url} controls className="max-h-64 w-full bg-black rounded" />}
                  <div><Label hint="optional thumbnail image">THUMB URL</Label><ImageInput value={editing.data.thumb_url} onChange={(v) => setEditing(e => ({ ...e, data: { ...e.data, thumb_url: v } }))} /></div>
                  <div><Label>CAPTION</Label><Textarea rows={3} value={editing.data.caption} onChange={e => setEditing(s => ({ ...s, data: { ...s.data, caption: e.target.value } }))} /></div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label hint="display likes start">LIKES BASE</Label><Input type="number" value={editing.data.likes_base} onChange={e => setEditing(s => ({ ...s, data: { ...s.data, likes_base: Number(e.target.value) || 0 } }))} /></div>
                <div><Label hint="display views start">VIEWS BASE</Label><Input type="number" value={editing.data.views_base} onChange={e => setEditing(s => ({ ...s, data: { ...s.data, views_base: Number(e.target.value) || 0 } }))} /></div>
              </div>
              <label className="inline-flex items-center gap-2 eh-mono text-xs cursor-pointer"><input type="checkbox" checked={!!editing.data.pinned} onChange={e => setEditing(s => ({ ...s, data: { ...s.data, pinned: e.target.checked } }))} className="w-4 h-4 accent-[var(--eh-green)]" /> PINNED (shows first)</label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="eh-btn-ghost text-xs">CANCEL</button>
              <button onClick={save} className="eh-btn-primary text-xs"><Save size={12} /> SAVE</button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {selectedComments && (
        <div className="fixed inset-0 z-50 bg-black/85 grid place-items-center p-4" onClick={() => setSelectedComments(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg eh-panel p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#0d1115' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="eh-kicker">// COMMENTS ({selectedComments.items.length})</div>
              <button onClick={() => setSelectedComments(null)} className="opacity-70 hover:opacity-100"><X size={16} /></button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2 mb-4">
              {selectedComments.items.length === 0 && <div className="opacity-60 eh-mono text-xs text-center py-4">No comments yet.</div>}
              {selectedComments.items.map(c => (
                <div key={c.id} className="flex items-start gap-3 eh-panel p-3">
                  <div className="flex-1">
                    <div className="text-sm"><span className="font-bold mr-2">{c.user_name}</span><span className="opacity-90">{c.text}</span></div>
                    <div className="eh-mono text-[10px] opacity-50 mt-1">{c.is_admin_seed ? '⚙ seeded · ' : ''}{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                  <button onClick={() => delComment(c.id)} className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--eh-border)] pt-3 space-y-2">
              <div className="eh-kicker mb-2">// ADD SEEDED COMMENT</div>
              <Input value={selectedComments.newName} onChange={e => setSelectedComments(s => ({ ...s, newName: e.target.value }))} placeholder="username e.g. ghost_runner" />
              <Input value={selectedComments.newPic} onChange={e => setSelectedComments(s => ({ ...s, newPic: e.target.value }))} placeholder="avatar URL (optional)" />
              <Textarea rows={2} value={selectedComments.newText} onChange={e => setSelectedComments(s => ({ ...s, newText: e.target.value }))} placeholder="comment text" />
              <button onClick={addAdminComment} className="eh-btn-primary text-xs"><Plus size={12} /> ADD COMMENT</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
};

// Helper: video upload component
const FeedVideoUpload = ({ value, onChange }) => {
  const [busy, setBusy] = useState(false);
  const onPick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('video/')) { toast.error('Pick a video'); return; }
    if (f.size > 50 * 1024 * 1024) { toast.error('Max 50MB'); return; }
    setBusy(true);
    try {
      const r = await api.feedUploadMedia(f);
      onChange(r.absoluteUrl);
      toast.success('Video uploaded');
    } catch (err) { toast.error(err.message || 'Upload failed'); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <Label hint="upload mp4 (max 50MB) or paste url">VIDEO</Label>
      <div className="flex gap-2 items-stretch">
        <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="> https://... or upload" />
        <label className="eh-btn-ghost text-xs cursor-pointer whitespace-nowrap px-3">
          {busy ? <><Loader2 className="animate-spin" size={12} /> UPLOADING</> : <><Upload size={12} /> UPLOAD MP4</>}
          <input type="file" accept="video/*" onChange={onPick} className="hidden" disabled={busy} />
        </label>
        {value && <button type="button" onClick={() => onChange('')} className="eh-btn-ghost text-xs px-3"><X size={12} /></button>}
      </div>
    </div>
  );
};

const UsersTab = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const load = async () => {
    setLoading(true);
    try { setItems(await api.listUsers()); } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const remove = async (u) => {
    if (!window.confirm(`Delete user ${u.email}? This cannot be undone.`)) return;
    try { await api.deleteUser(u.user_id); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };
  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied'); };
  const filtered = items.filter(u => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (u.email || '').toLowerCase().includes(s) || (u.name || '').toLowerCase().includes(s) || (u.referral_code || '').toLowerCase().includes(s);
  });
  return (
    <Section kicker="// USERS" title={`REGISTERED USERS (${items.length})`} actions={<button onClick={load} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> REFRESH</button>}>
      <div className="mb-4">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="> search email / name / referral..." className="eh-input text-sm max-w-md" data-testid="users-search" />
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <div className="eh-panel p-4">
          <div className="eh-mono text-[10px] opacity-60 mb-1">TOTAL</div>
          <div className="eh-display text-2xl font-black eh-neon">{items.length}</div>
        </div>
        <div className="eh-panel p-4">
          <div className="eh-mono text-[10px] opacity-60 mb-1">PASSWORD</div>
          <div className="eh-display text-2xl font-black">{items.filter(u => u.provider === 'password').length}</div>
        </div>
        <div className="eh-panel p-4">
          <div className="eh-mono text-[10px] opacity-60 mb-1">GOOGLE</div>
          <div className="eh-display text-2xl font-black">{items.filter(u => u.provider === 'google').length}</div>
        </div>
      </div>
      <div className="eh-panel overflow-x-auto">
        <table className="w-full eh-mono text-sm min-w-[760px]">
          <thead><tr className="text-left border-b border-[var(--eh-border)]">
            <th className="p-3 text-xs tracking-widest opacity-70">USER</th>
            <th className="p-3 text-xs">EMAIL</th>
            <th className="p-3 text-xs">PROVIDER</th>
            <th className="p-3 text-xs">REFERRAL</th>
            <th className="p-3 text-xs">ORDERS</th>
            <th className="p-3 text-xs">JOINED</th>
            <th className="p-3 text-xs text-right">ACTIONS</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center opacity-60">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center opacity-60">No users.</td></tr>}
            {filtered.map(u => (
              <tr key={u.user_id} className="border-b border-[var(--eh-border)] hover:bg-white/[.02]" data-testid={`user-row-${u.user_id}`}>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {u.picture ? <img src={u.picture} className="w-7 h-7 rounded-full object-cover" alt="" /> : <div className="w-7 h-7 rounded-full grid place-items-center text-[10px]" style={{ background: 'rgba(0,255,157,.15)', color: 'var(--eh-green)' }}>{(u.name || u.email || 'a')[0].toUpperCase()}</div>}
                    <span className="text-sm font-bold" style={{ fontFamily: 'Inter,sans-serif' }}>{u.name || '—'}</span>
                  </div>
                </td>
                <td className="p-3"><span className="eh-neon-soft">{u.email}</span></td>
                <td className="p-3"><span className="px-2 py-1 rounded text-[10px]" style={{ background: u.provider === 'google' ? 'rgba(77,224,255,.1)' : 'rgba(0,255,157,.1)', color: u.provider === 'google' ? '#4de0ff' : 'var(--eh-green)' }}>{(u.provider || 'password').toUpperCase()}</span></td>
                <td className="p-3 opacity-80">{u.referral_code || '—'}</td>
                <td className="p-3">{u.orders_count}</td>
                <td className="p-3 opacity-70 text-[11px]">{new Date(u.created_at).toLocaleString()}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => copy(u.email)} title="Copy email" className="w-7 h-7 grid place-items-center rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] hover:text-[var(--eh-green)]"><Copy size={12} /></button>
                    <button onClick={() => remove(u)} className="w-7 h-7 grid place-items-center rounded border border-[var(--eh-border)] hover:border-red-400 hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

const PaymentSettingsTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.getPaymentSettings().then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);
  const update = (patch) => setData(d => ({ ...d, ...patch }));
  const updateWallet = (i, patch) => setData(d => ({ ...d, crypto_wallets: d.crypto_wallets.map((w, idx) => idx === i ? { ...w, ...patch } : w) }));
  const addWallet = () => setData(d => ({ ...d, crypto_wallets: [...(d.crypto_wallets || []), { coin: '', network: '', address: '', qr_url: '' }] }));
  const removeWallet = (i) => setData(d => ({ ...d, crypto_wallets: d.crypto_wallets.filter((_, idx) => idx !== i) }));
  const updateCurrency = (i, patch) => setData(d => ({ ...d, currencies: d.currencies.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  const addCurrency = () => setData(d => ({ ...d, currencies: [...(d.currencies || []), { code: '', symbol: '', rate: 1 }] }));
  const removeCurrency = (i) => setData(d => ({ ...d, currencies: d.currencies.filter((_, idx) => idx !== i) }));
  const save = async () => {
    setSaving(true);
    try { const r = await api.putPaymentSettings(data); setData(r); toast.success('Saved'); }
    catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  if (loading) return <Section kicker="// PAYMENTS" title="PAYMENT SETTINGS"><div className="py-10 text-center opacity-60">Loading...</div></Section>;
  return (
    <Section kicker="// PAYMENTS" title="PAYMENT SETTINGS" actions={<button onClick={save} disabled={saving} className="eh-btn-primary text-xs"><Save size={12} /> {saving ? 'SAVING...' : 'SAVE ALL'}</button>}>
      {/* Manual / UPI */}
      <div className="eh-panel p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="eh-kicker">// MANUAL (UPI / BANK)</div>
          <label className="inline-flex items-center gap-2 eh-mono text-xs cursor-pointer"><input type="checkbox" checked={!!data.manual_enabled} onChange={e => update({ manual_enabled: e.target.checked })} className="w-4 h-4 accent-[var(--eh-green)]" /> {data.manual_enabled ? 'ENABLED' : 'DISABLED'}</label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>UPI ID</Label><Input value={data.upi_id || ''} onChange={e => update({ upi_id: e.target.value })} placeholder="errorhacker@upi" /></div>
          <div><Label>UPI NAME / RECIPIENT</Label><Input value={data.upi_name || ''} onChange={e => update({ upi_name: e.target.value })} placeholder="ERRORHACKER" /></div>
          <div className="sm:col-span-2"><Label>QR CODE IMAGE</Label><ImageInput value={data.qr_image_url || ''} onChange={v => update({ qr_image_url: v })} testid="payment-qr" /></div>
          <div className="sm:col-span-2"><Label>BANK DETAILS (multi-line)</Label><Textarea rows={3} value={data.bank_details || ''} onChange={e => update({ bank_details: e.target.value })} placeholder="Bank: HDFC\nA/C: 1234 5678 9012\nIFSC: HDFC0001234" /></div>
          <div className="sm:col-span-2"><Label>INSTRUCTIONS (shown to customer at checkout)</Label><Textarea rows={3} value={data.instructions || ''} onChange={e => update({ instructions: e.target.value })} /></div>
        </div>
      </div>

      {/* Crypto */}
      <div className="eh-panel p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="eh-kicker">// CRYPTO WALLETS</div>
          <label className="inline-flex items-center gap-2 eh-mono text-xs cursor-pointer"><input type="checkbox" checked={!!data.crypto_enabled} onChange={e => update({ crypto_enabled: e.target.checked })} className="w-4 h-4 accent-[var(--eh-green)]" /> {data.crypto_enabled ? 'ENABLED' : 'DISABLED'}</label>
        </div>
        <div className="space-y-3">
          {(data.crypto_wallets || []).map((w, i) => (
            <div key={i} className="grid sm:grid-cols-[120px_140px_1fr_auto] gap-2 items-end border border-[var(--eh-border)] p-3 rounded">
              <div><Label>COIN</Label><Input value={w.coin} onChange={e => updateWallet(i, { coin: e.target.value.toUpperCase() })} placeholder="BTC" /></div>
              <div><Label>NETWORK</Label><Input value={w.network} onChange={e => updateWallet(i, { network: e.target.value })} placeholder="Bitcoin / TRC20" /></div>
              <div><Label>ADDRESS</Label><Input value={w.address} onChange={e => updateWallet(i, { address: e.target.value })} placeholder="bc1q... / T..." /></div>
              <button onClick={() => removeWallet(i)} className="eh-btn-ghost text-xs text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
              <div className="sm:col-span-4"><Label>QR (optional)</Label><ImageInput value={w.qr_url} onChange={v => updateWallet(i, { qr_url: v })} testid={`wallet-qr-${i}`} /></div>
            </div>
          ))}
          <button onClick={addWallet} className="eh-btn-ghost text-xs"><Plus size={12} /> ADD WALLET</button>
        </div>
      </div>

      {/* Currencies */}
      <div className="eh-panel p-5">
        <div className="eh-kicker mb-3">// CURRENCIES & RATES</div>
        <p className="eh-mono text-[11px] opacity-70 mb-3">Set rate as multiplier from your BASE price. Example: if your service is priced in INR and you want to show USD, USD rate = 0.012 means 1 INR × 0.012 = USD.</p>
        <div className="space-y-2 max-w-xl">
          {(data.currencies || []).map((c, i) => (
            <div key={i} className="grid grid-cols-[100px_100px_1fr_auto] gap-2 items-end">
              <div><Label>CODE</Label><Input value={c.code} onChange={e => updateCurrency(i, { code: e.target.value.toUpperCase() })} placeholder="USD" /></div>
              <div><Label>SYMBOL</Label><Input value={c.symbol} onChange={e => updateCurrency(i, { symbol: e.target.value })} placeholder="$" /></div>
              <div><Label>RATE × BASE</Label><Input type="number" step="0.0001" value={c.rate} onChange={e => updateCurrency(i, { rate: Number(e.target.value) || 0 })} /></div>
              <button onClick={() => removeCurrency(i)} className="eh-btn-ghost text-xs text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
            </div>
          ))}
          <button onClick={addCurrency} className="eh-btn-ghost text-xs"><Plus size={12} /> ADD CURRENCY</button>
        </div>
        <div className="mt-4 max-w-xs">
          <Label>DEFAULT CURRENCY</Label>
          <select className="eh-input" value={data.default_currency || 'INR'} onChange={e => update({ default_currency: e.target.value })}>
            {(data.currencies || []).map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
          </select>
        </div>
      </div>
    </Section>
  );
};

const CouponsTab = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'percent', value: 10, max_uses: -1, active: true, description: '' });
  const load = async () => {
    setLoading(true);
    try { setItems(await api.listCoupons()); } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    if (!form.code) { toast.error('Code required'); return; }
    try { await api.createCoupon({ ...form, code: form.code.toUpperCase(), value: Number(form.value), max_uses: Number(form.max_uses) }); toast.success('Coupon created'); setForm({ code: '', type: 'percent', value: 10, max_uses: -1, active: true, description: '' }); load(); }
    catch (err) { toast.error(err.message); }
  };
  const toggleActive = async (c) => {
    try { await api.updateCoupon(c.code, { active: !c.active }); load(); } catch (e) { toast.error(e.message); }
  };
  const remove = async (code) => {
    if (!window.confirm(`Delete coupon ${code}?`)) return;
    try { await api.deleteCoupon(code); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };
  return (
    <Section kicker="// DISCOUNTS" title="COUPON CODES" actions={<button onClick={load} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> REFRESH</button>}>
      <div className="grid lg:grid-cols-[420px_1fr] gap-5">
        <form onSubmit={create} className="eh-panel p-5 space-y-3" data-testid="coupon-form">
          <div className="eh-kicker mb-2">// CREATE</div>
          <Label>CODE</Label>
          <Input data-testid="coupon-code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="HACK20" />
          <Label>TYPE</Label>
          <select className="eh-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} data-testid="coupon-type">
            <option value="percent">PERCENT (%)</option>
            <option value="flat">FLAT (amount off)</option>
          </select>
          <Label hint={form.type === 'percent' ? '0-100' : 'currency amount'}>VALUE</Label>
          <Input data-testid="coupon-value" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
          <Label hint="-1 = unlimited">MAX USES</Label>
          <Input data-testid="coupon-max-uses" type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} />
          <Label>DESCRIPTION</Label>
          <Input data-testid="coupon-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="20% off all services" />
          <label className="inline-flex items-center gap-2 eh-mono text-xs cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-[var(--eh-green)]" /> ACTIVE
          </label>
          <button data-testid="coupon-create-btn" type="submit" className="eh-btn-primary text-xs w-full justify-center"><Plus size={12} /> CREATE COUPON</button>
        </form>
        <div className="eh-panel overflow-x-auto">
          <table className="w-full eh-mono text-sm min-w-[640px]">
            <thead><tr className="text-left border-b border-[var(--eh-border)]">
              <th className="p-3 text-xs tracking-widest opacity-70">CODE</th>
              <th className="p-3 text-xs">TYPE</th>
              <th className="p-3 text-xs">VALUE</th>
              <th className="p-3 text-xs">USED</th>
              <th className="p-3 text-xs">STATUS</th>
              <th className="p-3 text-xs">ACTIONS</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-6 text-center opacity-60">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="p-6 text-center opacity-60">No coupons yet.</td></tr>}
              {items.map(c => (
                <tr key={c.code} className="border-b border-[var(--eh-border)]" data-testid={`coupon-row-${c.code}`}>
                  <td className="p-3 eh-neon-soft font-bold">{c.code}</td>
                  <td className="p-3 opacity-80">{c.type}</td>
                  <td className="p-3">{c.type === 'percent' ? `${c.value}%` : c.value}</td>
                  <td className="p-3 opacity-70">{c.used} / {c.max_uses === -1 ? '∞' : c.max_uses}</td>
                  <td className="p-3"><span className="px-2 py-1 rounded text-[11px]" style={{ background: c.active ? 'rgba(0,255,157,.1)' : 'rgba(255,255,255,.05)', color: c.active ? 'var(--eh-green)' : 'rgba(255,255,255,.5)' }}>{c.active ? 'ACTIVE' : 'OFF'}</span></td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => toggleActive(c)} className="eh-btn-ghost text-[11px] px-2 py-1">{c.active ? 'DISABLE' : 'ENABLE'}</button>
                    <button onClick={() => remove(c.code)} className="text-red-400 hover:text-red-300 px-2"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
};

const NotificationsTab = () => {
  const { config, update } = useSiteConfig();
  const t = (config.notifications && config.notifications.telegram) || { enabled: false, bot_token: '', chat_id: '' };
  const [testing, setTesting] = useState(false);
  const sendTest = async () => {
    if (!t.bot_token || !t.chat_id) { toast.error('Bot Token and Chat ID are required'); return; }
    setTesting(true);
    try {
      await api.testTelegram(t.bot_token, t.chat_id, 'ERRORHACKER // test alert ok_');
      toast.success('Test sent — check your Telegram');
    } catch (e) { toast.error(e.message); }
    finally { setTesting(false); }
  };
  return (
    <Section kicker="// CHANNELS" title="ORDER NOTIFICATIONS">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="eh-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Label hint="ping bot whenever a new order arrives">TELEGRAM ALERTS</Label>
            <label className="inline-flex items-center gap-2 text-xs eh-mono cursor-pointer">
              <input type="checkbox" data-testid="tg-enabled" checked={!!t.enabled} onChange={e => update('notifications.telegram.enabled', e.target.checked)} className="w-4 h-4 accent-[var(--eh-green)]" />
              {t.enabled ? <span className="text-[var(--eh-green)]">ENABLED</span> : <span className="opacity-60">DISABLED</span>}
            </label>
          </div>
          <Label hint="from @BotFather (e.g. 7891234567:AAH...)">BOT TOKEN</Label>
          <Input data-testid="tg-bot-token" value={t.bot_token || ''} onChange={e => update('notifications.telegram.bot_token', e.target.value)} placeholder="> bot token" />
          <Label hint="from @userinfobot (numeric)">CHAT ID</Label>
          <Input data-testid="tg-chat-id" value={t.chat_id || ''} onChange={e => update('notifications.telegram.chat_id', e.target.value)} placeholder="> chat id" />
          <div className="flex gap-2 pt-1">
            <button data-testid="tg-test-btn" onClick={sendTest} disabled={testing} className="eh-btn-primary text-xs">{testing ? 'SENDING...' : 'SEND TEST'}</button>
          </div>
        </div>
        <div className="eh-panel p-5 space-y-3 eh-mono text-[12px] opacity-80 leading-6">
          <div className="eh-kicker mb-1">// SETUP IN 2 MIN</div>
          <div>1. Open Telegram → search <span className="text-[var(--eh-green)]">@BotFather</span> → send <span className="text-[var(--eh-green)]">/newbot</span>.</div>
          <div>2. Pick a name + username ending in <span className="text-[var(--eh-green)]">_bot</span>. Copy the <b>BOT TOKEN</b>.</div>
          <div>3. Search <span className="text-[var(--eh-green)]">@userinfobot</span> → press Start → copy your <b>CHAT ID</b>.</div>
          <div>4. Paste both here, enable, hit <b>SEND TEST</b>.</div>
          <div className="opacity-60 mt-3">Once enabled, every new customer order pings your Telegram instantly.</div>
        </div>
      </div>
    </Section>
  );
};

const SettingsTab = () => {
  const { config, update, setConfig, reset, refetch } = useSiteConfig();
  const [newPw, setNewPw] = useState('');
  const changePass = async () => {
    if (!newPw || newPw.length < 4) { toast.error('Password too short (min 4 chars)'); return; }
    try {
      await api.changePassword(newPw);
      toast.success('Password updated. Re-login required.');
      localStorage.removeItem('eh_admin_token');
      localStorage.removeItem('eh_admin');
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) { toast.error(e.message); }
  };
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `errorhacker-config-${Date.now()}.json`; a.click();
    toast.success('Config exported');
  };
  const importConfig = (e) => {
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => { try { setConfig({ ...config, ...JSON.parse(r.result) }); toast.success('Config imported & synced'); } catch { toast.error('Invalid JSON'); } };
    r.readAsText(f);
  };
  return (
    <Section kicker="// SYSTEM" title="SETTINGS" actions={<button onClick={refetch} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> SYNC FROM SERVER</button>}>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="eh-panel p-5">
          <Label hint="used to access /admin">CHANGE ADMIN PASSWORD</Label>
          <div className="flex gap-2">
            <Input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="> new password (min 4 chars)" />
            <button onClick={changePass} className="eh-btn-primary text-xs"><Save size={12} /> SAVE</button>
          </div>
          <div className="eh-mono text-[11px] opacity-60 mt-2">You will be logged out after change.</div>
        </div>
        <div className="eh-panel p-5">
          <Label>BACKUP & RESTORE</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            <button onClick={exportConfig} className="eh-btn-ghost text-xs"><Download size={12} /> EXPORT JSON</button>
            <label className="eh-btn-ghost text-xs cursor-pointer"><Upload size={12} /> IMPORT JSON<input type="file" accept="application/json" onChange={importConfig} className="hidden" /></label>
            <button onClick={() => { if(window.confirm('Reset ALL settings to defaults on the server? This cannot be undone.')) { reset(); toast.success('Reset complete'); }}} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> RESET ALL</button>
          </div>
          <div className="eh-mono text-[11px] opacity-60 mt-3">Changes auto-sync to the live server when you are logged in.</div>
        </div>
      </div>
    </Section>
  );
};

const Overview = ({ setActive }) => {
  const { config } = useSiteConfig();
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      const [o, u] = await Promise.all([api.listOrders().catch(() => []), api.listUsers().catch(() => [])]);
      setOrders(o); setUsers(u);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const revenue = orders.filter(o => ['delivered', 'paid', 'verified'].includes(o.status)).reduce((s, o) => s + Number(o.payment_amount || 0), 0);
  const pendingPayments = orders.filter(o => o.status === 'payment_review').length;

  const updateOrderStatus = async (id, status) => {
    try { await api.updateOrder(id, status); toast.success(`Marked ${status}`); refresh(); }
    catch (e) { toast.error(e.message); }
  };

  const quickActions = [
    { label: 'NEW SERVICE',    icon: Wrench,      to: 'services',  color: 'rgba(0,255,157,.15)' },
    { label: 'NEW BOOK',       icon: BookOpen,    to: 'books',     color: 'rgba(77,224,255,.15)' },
    { label: 'NEW BLOG',       icon: FileText,    to: 'blogs',     color: 'rgba(255,200,40,.15)' },
    { label: 'NEW FEED POST',  icon: Activity,    to: 'feed',      color: 'rgba(255,80,120,.15)' },
    { label: 'PAYMENTS',       icon: CreditCard,  to: 'payments',  color: 'rgba(180,120,255,.15)' },
    { label: 'COUPONS',        icon: Zap,         to: 'coupons',   color: 'rgba(0,255,157,.15)' },
  ];

  return (
    <Section kicker="// DASHBOARD" title="COMMAND OVERVIEW" actions={<button onClick={refresh} className="eh-btn-ghost text-xs"><RefreshCcw size={12} /> REFRESH</button>}>
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="eh-panel p-4">
          <div className="eh-mono text-[10px] opacity-60 mb-1">TOTAL ORDERS</div>
          <div className="eh-display text-3xl font-black eh-neon">{orders.length}</div>
          <div className="eh-mono text-[10px] opacity-50 mt-1">all-time</div>
        </div>
        <div className="eh-panel p-4">
          <div className="eh-mono text-[10px] opacity-60 mb-1">REVENUE</div>
          <div className="eh-display text-3xl font-black eh-neon">${revenue.toFixed(0)}</div>
          <div className="eh-mono text-[10px] opacity-50 mt-1">verified payments</div>
        </div>
        <div className="eh-panel p-4">
          <div className="eh-mono text-[10px] opacity-60 mb-1">USERS</div>
          <div className="eh-display text-3xl font-black">{users.length}</div>
          <div className="eh-mono text-[10px] opacity-50 mt-1">registered</div>
        </div>
        <div className="eh-panel p-4" style={ pendingPayments ? { borderColor: 'rgba(255,200,40,.4)' } : {}}>
          <div className="eh-mono text-[10px] opacity-60 mb-1">PENDING REVIEW</div>
          <div className="eh-display text-3xl font-black" style={ pendingPayments ? { color: '#ffc828' } : {}}>{pendingPayments}</div>
          <div className="eh-mono text-[10px] opacity-50 mt-1">payments to verify</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="eh-panel p-4 mb-6">
        <div className="eh-kicker mb-3">// QUICK ACTIONS</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {quickActions.map(q => { const I = q.icon; return (
            <button key={q.label} onClick={() => setActive(q.to)} className="flex flex-col items-center gap-2 py-4 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-all hover:bg-white/[.02]" data-testid={`qa-${q.to}`}>
              <div className="w-9 h-9 rounded grid place-items-center" style={{ background: q.color }}><I size={16} color="var(--eh-green)" /></div>
              <div className="eh-mono text-[10px] tracking-widest">{q.label}</div>
            </button>
          );})}
        </div>
      </div>

      {/* Content counters w/ jump buttons */}
      <div className="eh-panel p-4 mb-6">
        <div className="eh-kicker mb-3">// CONTENT</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { key: 'services',     count: config.services.length,     label: 'SERVICES',    icon: Wrench },
            { key: 'books',        count: config.books.length,        label: 'BOOKS',       icon: BookOpen },
            { key: 'memberships',  count: config.memberships.length,  label: 'TIERS',       icon: CreditCard },
            { key: 'blogs',        count: config.blogs.length,        label: 'BLOGS',       icon: FileText },
            { key: 'tools',        count: config.tools.length,        label: 'TOOLS',       icon: Terminal },
            { key: 'faqs',         count: config.faqs.length,         label: 'FAQS',        icon: MessageSquare },
          ].map(c => { const I = c.icon; return (
            <button key={c.key} onClick={() => setActive(c.key)} className="flex items-center gap-3 p-3 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors text-left">
              <I size={16} className="text-[var(--eh-green)] shrink-0" />
              <div className="min-w-0">
                <div className="eh-display text-2xl font-black leading-none">{c.count}</div>
                <div className="eh-mono text-[10px] opacity-60 tracking-widest mt-1">{c.label}</div>
              </div>
              <Edit3 size={12} className="ml-auto opacity-50" />
            </button>
          );})}
        </div>
      </div>

      {/* Recent Orders w/ inline status changer */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="eh-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="eh-kicker">// RECENT ORDERS</div>
            <button onClick={() => setActive('orders')} className="eh-mono text-[10px] opacity-70 hover:opacity-100 hover:text-[var(--eh-green)]">VIEW ALL →</button>
          </div>
          <div className="space-y-2">
            {loading && <div className="py-6 text-center opacity-60 eh-mono text-xs">Loading...</div>}
            {!loading && orders.length === 0 && <div className="py-6 text-center opacity-60 eh-mono text-xs">No orders yet.</div>}
            {orders.slice(0, 6).map(o => (
              <div key={o.id} className="flex items-center gap-3 p-2.5 border border-[var(--eh-border)] rounded" data-testid={`ov-order-${o.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ fontFamily: 'Inter,sans-serif' }}>{o.serviceName || '—'}</div>
                  <div className="eh-mono text-[10px] opacity-60 truncate">{o.name} · {o.id}</div>
                </div>
                <select value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)} className="bg-transparent eh-mono text-[10px] px-2 py-1 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] cursor-pointer">
                  <option value="received">received</option>
                  <option value="payment_review">payment_review</option>
                  <option value="verified">verified</option>
                  <option value="in-progress">in-progress</option>
                  <option value="delivered">delivered</option>
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="eh-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="eh-kicker">// RECENT USERS</div>
            <button onClick={() => setActive('users')} className="eh-mono text-[10px] opacity-70 hover:opacity-100 hover:text-[var(--eh-green)]">VIEW ALL →</button>
          </div>
          <div className="space-y-2">
            {users.length === 0 && <div className="py-6 text-center opacity-60 eh-mono text-xs">No users yet.</div>}
            {users.slice(0, 6).map(u => (
              <div key={u.user_id} className="flex items-center gap-3 p-2.5 border border-[var(--eh-border)] rounded">
                {u.picture ? <img src={u.picture} className="w-8 h-8 rounded-full object-cover" alt="" /> : <div className="w-8 h-8 rounded-full grid place-items-center text-[10px] eh-mono" style={{ background: 'rgba(0,255,157,.15)', color: 'var(--eh-green)' }}>{(u.name || u.email || 'a')[0].toUpperCase()}</div>}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ fontFamily: 'Inter,sans-serif' }}>{u.name || u.email.split('@')[0]}</div>
                  <div className="eh-mono text-[10px] opacity-60 truncate">{u.email}</div>
                </div>
                <div className="eh-mono text-[10px] opacity-70">{u.orders_count} ord</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
};

const Login = ({ onOk }) => {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.login(pw);
      if (res?.token) {
        localStorage.setItem('eh_admin_token', res.token);
        localStorage.setItem('eh_admin', '1');
        onOk();
      }
    } catch (err) {
      toast.error(err.status === 401 ? 'Access denied' : (err.message || 'Login failed'));
    } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center eh-grid-bg p-6">
      <form onSubmit={submit} className="w-full max-w-sm eh-panel eh-brackets p-7"><span className="br-bl" /><span className="br-br" />
        <div className="flex items-center gap-3 mb-5"><Logo size={40} /><div><div className="eh-brand font-black tracking-widest eh-neon-soft">CONTROL</div><div className="text-[10px] eh-mono opacity-60">// admin login</div></div></div>
        <div className="eh-mono text-xs opacity-70 mb-2 flex items-center gap-2"><Lock size={12} color="var(--eh-green)" /> ACCESS_KEY</div>
        <div className="relative">
          <input type={show?'text':'password'} value={pw} onChange={e=>setPw(e.target.value)} placeholder="> ********" className="eh-input pr-10" autoFocus />
          <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <button disabled={busy} className="eh-btn-primary w-full mt-5 text-xs">{busy ? 'AUTHENTICATING...' : 'AUTHENTICATE'}</button>
        <div className="eh-mono text-[11px] opacity-50 mt-4 text-center">default: admin123 · change after first login</div>
      </form>
    </div>
  );
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => localStorage.getItem('eh_admin') === '1' && !!localStorage.getItem('eh_admin_token'));
  const [active, setActive] = useState('overview');
  if (!authed) return <Login onOk={() => setAuthed(true)} />;
  const logout = async () => {
    try { await api.logout(); } catch (_) {}
    localStorage.removeItem('eh_admin'); localStorage.removeItem('eh_admin_token');
    setAuthed(false); navigate('/admin');
  };

  return (
    <div className="min-h-screen flex bg-[var(--eh-bg)]">
      <Sidebar active={active} setActive={setActive} onLogout={logout} />
      <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-x-hidden">
        <div className="md:hidden mb-4 flex gap-2 overflow-x-auto eh-scroll pb-2">
          {sections.map(s => (<button key={s.to} onClick={()=>setActive(s.to)} className={`shrink-0 px-3 py-2 rounded text-[11px] eh-mono tracking-widest uppercase ${active===s.to ? 'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)] border border-[rgba(0,255,157,.4)]' : 'border border-[var(--eh-border)]'}`}>{s.label}</button>))}
        </div>

        {active==='overview'    && <Overview setActive={setActive} />}
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
        {active==='users'       && <UsersTab />}
        {active==='feed'        && <FeedManager />}
        {active==='payments'    && <PaymentSettingsTab />}
        {active==='coupons'     && <CouponsTab />}
        {active==='notifications'&& <NotificationsTab />}
        {active==='settings'    && <SettingsTab />}
      </main>
    </div>
  );
};
export default AdminPanel;
