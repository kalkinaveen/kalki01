import React from 'react';
import { Flame, Send } from 'lucide-react';
import { SITE } from '../mock';

const Marquee = () => {
  const items = Array.from({ length: 8 });
  return (
    <div className="eh-marquee relative z-30">
      <div className="eh-marquee-track eh-mono text-sm">
        {items.map((_, i) => (
          <span key={i} className="inline-flex items-center gap-3">
            <Send size={14} />
            POST UPDATE WILL COME SOON!
            <Flame size={14} />
            {SITE.name}
            <span className="opacity-60">•</span>
          </span>
        ))}
      </div>
    </div>
  );
};
export default Marquee;
