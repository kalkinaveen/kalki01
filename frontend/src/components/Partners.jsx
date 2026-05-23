import React from 'react';
import { PARTNERS } from '../mock';

const Partners = () => (
  <section className="py-10 border-y border-[var(--eh-border)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="eh-mono text-[10px] tracking-[.4em] opacity-50 text-center mb-6">// AS SEEN ON</div>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {PARTNERS.map(p => (
          <div key={p} className="eh-mono text-lg sm:text-xl opacity-50 hover:opacity-90 transition-opacity tracking-wider">{p}</div>
        ))}
      </div>
    </div>
  </section>
);
export default Partners;
