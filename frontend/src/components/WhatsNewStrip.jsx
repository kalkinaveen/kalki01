import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { api } from '../lib/api';

/**
 * "Signal · What's New" marquee strip for the homepage.
 *
 * Pulls /api/whats-new (seeded with 5 starter posts on first call) and renders
 * a horizontally auto-scrolling row of brand-coloured news pills.
 *
 * - Pauses on hover so users can actually read what catches their eye.
 * - Each pill is a Link → its `link` field (recovery / smm / tools / etc).
 * - Each pill carries the tag colour set by the admin in the CMS.
 * - Falls back to silent no-op when the feed is empty / errors.
 */
const WhatsNewStrip = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.whatsNew()
      .then(d => setItems(d?.items || []))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  // Duplicate the items list once so the marquee loop is seamless
  const loop = [...items, ...items];

  return (
    <section className="py-6 sm:py-8 border-y border-[var(--eh-border)] eh-wn-strip-wrap" data-testid="whats-new-strip">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-3 sm:gap-4">
        {/* Label */}
        <div
          className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border eh-mono text-[10px] sm:text-[11px] tracking-[0.25em] font-bold"
          style={{
            borderColor: 'rgba(0,255,157,.55)',
            background: 'linear-gradient(180deg, rgba(0,255,157,.10), rgba(0,255,157,.02))',
            color: 'var(--eh-green)',
          }}
        >
          <span className="relative inline-flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[var(--eh-green)] eh-pulse-dot" />
          </span>
          <Radio size={11} /> LIVE
        </div>

        {/* Marquee */}
        <div className="relative flex-1 overflow-hidden eh-wn-mask">
          <div className="eh-wn-track flex gap-3 sm:gap-4">
            {loop.map((it, i) => (
              <Link
                key={`${it.id}-${i}`}
                to={it.link || '/'}
                aria-hidden={i >= items.length ? 'true' : undefined}
                tabIndex={i >= items.length ? -1 : undefined}
                className="eh-wn-pill shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: `${it.color || '#00ff9d'}55`,
                  background: `linear-gradient(180deg, ${it.color || '#00ff9d'}12, transparent)`,
                }}
                data-testid={`whats-new-pill-${i}`}
              >
                <span
                  className="eh-mono text-[9px] tracking-[0.2em] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: it.color || '#00ff9d', color: '#000' }}
                >
                  {it.tag || 'NEW'}
                </span>
                <span className="text-[12px] sm:text-[13px] font-semibold whitespace-nowrap" style={{ fontFamily: 'Inter,sans-serif' }}>
                  {it.title}
                </span>
                <span className="text-[11px] opacity-65 hidden md:inline whitespace-nowrap" style={{ fontFamily: 'Inter,sans-serif' }}>
                  · {it.body}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .eh-wn-mask {
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 6%, #000 94%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0, #000 6%, #000 94%, transparent 100%);
        }
        .eh-wn-track { animation: eh-wn-scroll 38s linear infinite; width: max-content; }
        .eh-wn-strip-wrap:hover .eh-wn-track { animation-play-state: paused; }
        @keyframes eh-wn-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (max-width: 640px) {
          .eh-wn-track { animation-duration: 28s; }
        }
        @media (prefers-reduced-motion: reduce) {
          .eh-wn-track { animation: none; }
        }
      `}</style>
    </section>
  );
};

export default WhatsNewStrip;
