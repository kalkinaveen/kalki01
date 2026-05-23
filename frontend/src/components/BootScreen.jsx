import React, { useEffect, useState } from 'react';
import Logo from './Logo';
import { SITE } from '../mock';

const BOOT_LINES = [
  '> boot sequence initiated...',
  '> mounting /dev/secure ... [ok]',
  '> loading kernel modules ... [ok]',
  '> establishing encrypted tunnel ... [ok]',
  '> verifying signatures ... [ok]',
  '> handshake complete. welcome.',
];

const BootScreen = ({ onDone }) => {
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setLines(prev => [...prev, BOOT_LINES[prev.length]]);
      setProgress(Math.min(100, Math.round((i / BOOT_LINES.length) * 100)));
      if (i >= BOOT_LINES.length) {
        clearInterval(id);
        setTimeout(() => onDone && onDone(), 600);
      }
    }, 380);
    return () => clearInterval(id);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--eh-bg)] eh-grid-bg">
      <div className="relative w-[min(560px,92vw)] eh-panel eh-brackets p-6 md:p-10">
        <span className="br-bl" /><span className="br-br" />
        <div className="flex items-center justify-between text-xs eh-mono mb-6" style={{ color: 'var(--eh-green)' }}>
          <span>&gt;_ errorhacker_boot.sh</span>
          <span>{SITE.version}</span>
        </div>
        <div className="flex flex-col items-center gap-5 py-3">
          <div className="relative">
            <div className="eh-ring" />
            <Logo size={68} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[160px] h-[160px]" />
            </div>
          </div>
          <h1 className="eh-display eh-neon text-4xl md:text-5xl font-black tracking-widest">{SITE.name}</h1>
          <div className="w-full max-w-sm h-[3px] rounded overflow-hidden bg-white/5">
            <div style={{ width: `${progress}%`, background: 'var(--eh-green)', boxShadow: '0 0 10px var(--eh-green)' }} className="h-full transition-all duration-300" />
          </div>
          <div className="text-xs tracking-[.4em] eh-mono" style={{ color: 'var(--eh-muted)' }}>INITIALIZING SYSTEM...</div>
        </div>
        <div className="mt-6 text-xs eh-mono leading-7" style={{ color: 'var(--eh-green)' }}>
          {lines.map((l, i) => (<div key={i}>{l}</div>))}
          <span className="eh-caret">&nbsp;</span>
        </div>
      </div>
    </div>
  );
};
export default BootScreen;
