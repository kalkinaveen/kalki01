import React, { useEffect, useState } from 'react';

const ScrollProgress = () => {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      setP(total > 0 ? (h.scrollTop / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[2px] pointer-events-none">
      <div style={{ width: `${p}%`, background: 'var(--eh-green)', boxShadow: '0 0 8px var(--eh-green)' }} className="h-full transition-[width] duration-150" />
    </div>
  );
};
export default ScrollProgress;
