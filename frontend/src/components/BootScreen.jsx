import React, { useEffect, useRef, useState } from 'react';
import Logo from './Logo';
import { SITE } from '../mock';
import { Lock, Wifi, ShieldCheck } from 'lucide-react';

const BOOT_LINES = [
  '> boot sequence initiated...',
  '> mounting /dev/secure ............ [ ok ]',
  '> loading kernel modules .......... [ ok ]',
  '> bypassing firewall layer ........ [ ok ]',
  '> establishing tor circuit ........ [ ok ]',
  '> verifying signatures ............ [ ok ]',
  '> handshake complete. welcome operator.',
];

// Matrix rain canvas
const MatrixRain = () => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const chars = 'アァイィウヴエオカガキギクグケゲコゴサ0123456789ABCDEF#$%@!?<>/\\|';
    const fontSize = 14;
    let columns = Math.floor(canvas.width / fontSize);
    let drops = Array(columns).fill(1);
    const draw = () => {
      ctx.fillStyle = 'rgba(5,6,8,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff9d';
      ctx.font = `${fontSize}px "Share Tech Mono", monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = Math.random() > 0.975 ? '#ffffff' : '#00ff9d';
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-40" />;
};

const BootScreen = ({ onDone }) => {
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setLines(prev => prev.length < BOOT_LINES.length ? [...prev, BOOT_LINES[prev.length]] : prev);
      setProgress(Math.min(100, Math.round((i / BOOT_LINES.length) * 100)));
      if (i >= BOOT_LINES.length) {
        clearInterval(id);
        setTimeout(() => onDone && onDone(), 700);
      }
    }, 320);
    return () => clearInterval(id);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[var(--eh-bg)]">
      <MatrixRain />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 40%, rgba(0,255,157,.10), transparent 70%)' }} />
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,255,157,.04) 0 1px, transparent 1px 3px)' }} />

      <div className="relative h-full w-full flex items-center justify-center px-4">
        <div className="w-full max-w-[640px] eh-panel eh-brackets p-5 sm:p-10 backdrop-blur-sm" style={{ background: 'rgba(8,10,12,.78)' }}>
          <span className="br-bl" /><span className="br-br" />

          {/* Top header bar */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs eh-mono mb-6" style={{ color: 'var(--eh-green)' }}>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ boxShadow: '0 0 8px currentColor' }} /> &gt;_ errorhacker_boot.sh</div>
            <span className="opacity-70">{SITE.version}</span>
          </div>

          {/* Centered logo + ring */}
          <div className="flex flex-col items-center gap-5 py-3">
            <div className="relative w-[140px] h-[140px] sm:w-[170px] sm:h-[170px] flex items-center justify-center">
              {/* outer rotating ring */}
              <div className="absolute inset-0 rounded-full border border-[rgba(0,255,157,.25)] eh-spin-slow" />
              {/* dashed mid ring */}
              <div className="absolute inset-3 rounded-full border-2 border-dashed border-[rgba(0,255,157,.45)] eh-spin-rev" />
              {/* inner pulsing ring */}
              <div className="absolute inset-6 rounded-full eh-ring" />
              {/* corner ticks */}
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-3 bg-[var(--eh-green)]" style={{ boxShadow: '0 0 8px var(--eh-green)' }} />
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-3 bg-[var(--eh-green)]" style={{ boxShadow: '0 0 8px var(--eh-green)' }} />
              <span className="absolute top-1/2 -left-1 -translate-y-1/2 w-3 h-2 bg-[var(--eh-green)]" style={{ boxShadow: '0 0 8px var(--eh-green)' }} />
              <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-3 h-2 bg-[var(--eh-green)]" style={{ boxShadow: '0 0 8px var(--eh-green)' }} />
              <div className="relative z-10"><Logo size={84} /></div>
            </div>

            <h1 className="eh-brand eh-neon font-black tracking-widest text-3xl sm:text-5xl text-center eh-title-glitch">
              <span className="eh-title-main inline-block" data-text={SITE.name}>
                <span className="eh-chrom-r" aria-hidden="true">{SITE.name}</span>
                <span className="eh-chrom-c" aria-hidden="true">{SITE.name}</span>
                {SITE.name}
              </span>
            </h1>

            {/* Progress bar with percentage */}
            <div className="w-full max-w-sm">
              <div className="flex justify-between eh-mono text-[10px] mb-1 opacity-80">
                <span>INITIALIZING SYSTEM</span>
                <span>{progress}%</span>
              </div>
              <div className="h-[3px] rounded overflow-hidden bg-white/5 relative">
                <div style={{ width: `${progress}%`, background: 'var(--eh-green)', boxShadow: '0 0 10px var(--eh-green)' }} className="h-full transition-all duration-300" />
              </div>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] eh-mono">
              <span className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'rgba(0,255,157,.08)', color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.25)' }}><Lock size={10} /> ENCRYPTED</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'rgba(0,255,157,.08)', color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.25)' }}><Wifi size={10} /> TOR_OK</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'rgba(0,255,157,.08)', color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.25)' }}><ShieldCheck size={10} /> SECURED</span>
            </div>
          </div>

          {/* Terminal log */}
          <div className="mt-6 text-[10px] sm:text-xs eh-mono leading-6 sm:leading-7 max-h-[160px] overflow-hidden" style={{ color: 'var(--eh-green)' }}>
            {lines.map((l, i) => (<div key={i} className="opacity-90">{l}</div>))}
            <span className="eh-caret">&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default BootScreen;
