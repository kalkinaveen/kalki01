import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const LiveActivity = () => {
  const { config } = useSiteConfig();
  const feed = config.activity || [];
  const [items, setItems] = useState(() => feed.slice(0, 1));
  useEffect(() => {
    if (feed.length === 0) return;
    let i = 1;
    const id = setInterval(() => {
      setItems(prev => [feed[i % feed.length], ...prev].slice(0, 4));
      i += 1;
    }, 3500);
    return () => clearInterval(id);
  }, [feed]);
  if (feed.length === 0) return null;
  return (
    <section className="py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="eh-kicker mb-2">// LIVE_FEED</div>
            <h2 className="eh-display font-black" style={{ fontSize: 'clamp(1.4rem, 3.6vw, 2.4rem)' }}>RECENT <span className="eh-neon">ORDERS</span></h2>
          </div>
          <div className="flex items-center gap-2 eh-mono text-xs opacity-80"><span className="w-2 h-2 rounded-full bg-[var(--eh-green)] animate-pulse" style={{ boxShadow: '0 0 8px var(--eh-green)' }} /> streaming</div>
        </div>
        <div className="space-y-2">
          {items.map((a, i) => (
            <div key={a.id + i} className="eh-panel p-3 sm:p-4 flex items-center gap-3 text-sm" style={{ animation: i===0 ? 'eh-flash .6s ease-out' : 'none' }}>
              <div className="w-8 h-8 rounded grid place-items-center shrink-0" style={{ background: 'rgba(0,255,157,.1)', border: '1px solid rgba(0,255,157,.25)' }}><Send size={14} color="var(--eh-green)" /></div>
              <div className="flex-1 min-w-0">
                <div className="truncate"><span className="eh-neon-soft eh-mono text-xs">{a.user}</span> <span className="opacity-70">just ordered</span> <span className="font-semibold" style={{ fontFamily: 'Inter,sans-serif' }}>{a.service}</span></div>
                <div className="eh-mono text-[11px] opacity-60">{a.location} · {a.ago}</div>
              </div>
              <span className="eh-mono text-xs eh-neon-soft hidden sm:block">${a.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default LiveActivity;
