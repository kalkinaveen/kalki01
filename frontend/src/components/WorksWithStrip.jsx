import React, { useEffect, useState } from 'react';
import { Instagram, Youtube, Facebook, Twitter, Globe, Github, Linkedin } from 'lucide-react';
import { api } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Resolve the absolute URL for an admin-uploaded brand icon.
 * Admin upload endpoint stores files under `/api/uploads/{id}` — relative path
 * needs the backend host prefix to render from anywhere on the public site.
 */
const resolveIcon = (u) => {
  if (!u) return null;
  if (u.startsWith('http')) return u;
  return `${BACKEND_URL}${u}`;
};

/**
 * Fallback icon when admin hasn't uploaded a custom logo yet.
 * Matches by name (case-insensitive) so default seed values
 * still look polished out of the box.
 */
const FallbackIcon = ({ name, size = 22 }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('insta')) return <Instagram size={size} />;
  if (n.includes('you') || n.includes('youtube')) return <Youtube size={size} />;
  if (n.includes('face') || n === 'fb') return <Facebook size={size} />;
  if (n === 'x' || n.includes('twit')) return <Twitter size={size} />;
  if (n.includes('git')) return <Github size={size} />;
  if (n.includes('link')) return <Linkedin size={size} />;
  return <Globe size={size} />;
};

/**
 * "WORKS WITH" marquee — black + neon green strict theme.
 * - Infinite horizontal scroll using existing eh-scroll keyframes
 * - Each brand: glowing border circle with logo (admin-uploaded or fallback)
 * - Pulsing dot on top for active feel
 * - Hover lifts + intensifies neon glow
 * - Speed configurable from admin panel (10-120s)
 */
const WorksWithStrip = () => {
  const [data, setData] = useState(null);
  useEffect(() => { api.worksWith().then(setData).catch(() => setData(null)); }, []);
  if (!data || !data.enabled || !(data.items || []).length) return null;

  const items = data.items;
  // Triple the array so the marquee never has visible gaps on wide screens
  const reel = [...items, ...items, ...items];

  return (
    <section className="py-10 sm:py-12 border-y border-[var(--eh-border)] relative overflow-hidden" data-testid="works-with-strip">
      {/* radial glow backdrop — purely cosmetic, sits behind icons */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 80% at 50% 50%, rgba(0,255,157,.06), transparent 70%)' }} />
      <div className="relative">
        <div className="eh-mono text-[10px] tracking-[.45em] opacity-60 text-center mb-7 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--eh-green)] eh-pulse-dot" />
          // {data.title || 'WORKS WITH'}
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--eh-green)] eh-pulse-dot" />
        </div>

        {/* Edge fades for premium feel */}
        <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-16 sm:w-24 z-10" style={{ background: 'linear-gradient(to right, var(--eh-bg, #050608), transparent)' }} />
        <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-16 sm:w-24 z-10" style={{ background: 'linear-gradient(to left, var(--eh-bg, #050608), transparent)' }} />

        <div className="overflow-hidden whitespace-nowrap">
          <div className="inline-flex gap-6 sm:gap-10" style={{ animation: `eh-scroll ${data.speed || 35}s linear infinite` }}>
            {reel.map((it, i) => {
              const icon = resolveIcon(it.icon_url);
              const inner = (
                <div className="ww-brand inline-flex items-center gap-3 px-4 py-2.5 rounded-full border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-all bg-[rgba(0,0,0,.4)] backdrop-blur-sm group" data-testid={`works-with-${it.id}-${i}`}>
                  <div className="ww-icon relative w-9 h-9 sm:w-10 sm:h-10 rounded-full grid place-items-center bg-[#0d1115] border border-[var(--eh-border)] group-hover:border-[var(--eh-green)] transition-all">
                    {icon ? (
                      <img src={icon} alt={it.name} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" loading="lazy" />
                    ) : (
                      <span className="text-[var(--eh-green)] opacity-90 group-hover:opacity-100"><FallbackIcon name={it.name} size={20} /></span>
                    )}
                    {/* pulse ring */}
                    <span className="absolute inset-0 rounded-full pointer-events-none ww-pulse" />
                  </div>
                  <span className="eh-mono text-xs sm:text-sm tracking-wider uppercase opacity-80 group-hover:opacity-100 group-hover:text-[var(--eh-green)] transition-colors">{it.name}</span>
                </div>
              );
              return it.link ? (
                <a key={`${it.id}-${i}`} href={it.link} target="_blank" rel="noreferrer" className="shrink-0">{inner}</a>
              ) : (
                <div key={`${it.id}-${i}`} className="shrink-0">{inner}</div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorksWithStrip;
