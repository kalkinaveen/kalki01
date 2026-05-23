import React from 'react';
import { Link } from 'react-router-dom';
import { Youtube, Instagram, Send, Facebook, Music2, Shield, ArrowRight, DollarSign, Clock, ShieldCheck } from 'lucide-react';
import { SERVICES } from '../mock';

const ICONS = { youtube: Youtube, instagram: Instagram, send: Send, facebook: Facebook, music: Music2, shield: Shield };

const ServiceCard = ({ s }) => {
  const Icon = ICONS[s.icon] || Shield;
  return (
    <Link to={`/services/${s.id}`} className="eh-card eh-panel eh-brackets p-6 flex flex-col gap-4">
      <span className="br-bl" /><span className="br-br" />
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-md grid place-items-center" style={{ background: 'rgba(0,255,157,.08)', border: '1px solid rgba(0,255,157,.25)' }}>
          <Icon size={22} color="var(--eh-green)" />
        </div>
        {s.tag && <span className="eh-mono text-[10px] tracking-widest px-2 py-1 rounded" style={{ background: 'rgba(0,255,157,.12)', color: 'var(--eh-green)' }}>{s.tag}</span>}
      </div>
      <div>
        <h3 className="text-lg font-semibold leading-snug mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>{s.name}</h3>
        <p className="text-sm opacity-70 leading-6">{s.short}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 eh-mono text-[11px] mt-1">
        <div className="flex items-center gap-1"><DollarSign size={12} color="var(--eh-green)" /> ${s.price}</div>
        <div className="flex items-center gap-1"><Clock size={12} color="var(--eh-green)" /> {s.delivery}</div>
        <div className="flex items-center gap-1"><ShieldCheck size={12} color="var(--eh-green)" /> {s.guarantee}</div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="eh-mono text-xs opacity-60">// view_details</span>
        <ArrowRight size={16} color="var(--eh-green)" />
      </div>
    </Link>
  );
};

const Services = ({ limit }) => {
  const data = limit ? SERVICES.slice(0, limit) : SERVICES;
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <div className="eh-kicker justify-center mb-3">// OUR SERVICES</div>
          <h2 className="eh-display text-3xl md:text-5xl font-black">DISCOVER OUR MOST <span className="eh-neon">POPULAR SERVICES</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map(s => <ServiceCard key={s.id} s={s} />)}
        </div>
        {limit && (
          <div className="text-center mt-10">
            <Link to="/services" className="eh-btn-ghost">SEE MORE SERVICES <ArrowRight size={16} /></Link>
          </div>
        )}
      </div>
    </section>
  );
};
export default Services;
