import React from 'react';
import { Flame, Send } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const Marquee = () => {
  const { config } = useSiteConfig();
  const items = Array.from({ length: 8 });
  const text = config.site.marquee || 'POST UPDATE WILL COME SOON!';
  return (
    <div className="eh-marquee relative z-30">
      <div className="eh-marquee-track eh-mono text-sm">
        {items.map((_, i) => (
          <span key={i} className="inline-flex items-center gap-3">
            <Send size={14} />{text}<Flame size={14} />{config.site.name}<span className="opacity-60">•</span>
          </span>
        ))}
      </div>
    </div>
  );
};
export default Marquee;
