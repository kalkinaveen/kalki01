import React, { useEffect, useState } from 'react';
import { ShoppingBag, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Live Order Ticker — replaces / augments the top marquee with masked-name
 * social proof: "B••P just bought IG Followers · 2 min ago".
 * Auto-refreshes every 30s.
 */
const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const LiveOrderTicker = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await api.feedTicker();
        if (alive) setItems(data || []);
      } catch (e) { /* ignore */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!items.length) return null;
  // Double the array so the marquee loops seamlessly
  const reel = [...items, ...items];

  return (
    <div className="eh-ticker bg-[var(--eh-green)] text-black overflow-hidden whitespace-nowrap h-7 sm:h-8 flex items-center" data-testid="live-order-ticker">
      <div className="inline-flex gap-8 eh-mono text-[11px] sm:text-xs font-bold tracking-wide pl-8" style={{ animation: 'eh-scroll 45s linear infinite' }}>
        {reel.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 shrink-0">
            {it.type === 'recovery' ? <ShieldCheck size={11} /> : <ShoppingBag size={11} />}
            <span className="font-black">{it.name}</span>
            <span className="opacity-80">{it.type === 'recovery' ? '' : 'just got'}</span>
            <span className="font-bold">{it.label}</span>
            <span className="opacity-60">· {timeAgo(it.createdAt)}</span>
            <span className="mx-2 opacity-30">●</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default LiveOrderTicker;
