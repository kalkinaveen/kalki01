import React, { useEffect, useState } from 'react';
import Logo from './Logo';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const BOOT_LINES = [
  '> boot sequence initiated...',
  '> loading kernel: errorhacker-core v2.6.1',
  '> mounting /dev/secure-channel...',
  '> decrypting user payload [AES-256]',
  '> establishing mesh with c2.errorhacker.io',
];

const MatrixRain = () => {
  const ref = React.useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const chars = 'アァイィウヴエオカガキギクグケゲコゴサ 0123456789ABCDEF#$%@!?<>/\\|';
    const fontSize = 14;
    let drops = Array(Math.floor(canvas.width / fontSize)).fill(1);
    const draw = () => {
      ctx.fillStyle = 'rgba(5,6,8,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-30" />;
};

const BootScreen = ({ onDone }) => {
  const { config } = useSiteConfig();
  const SITE = config.site;
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setLines(prev => prev.length < BOOT_LINES.length ? [...prev, BOOT_LINES[prev.length]] : prev);
      setProgress(Math.min(100, Math.round((i / BOOT_LINES.length) * 100)));
      if (i >= BOOT_LINES.length) { clearInterval(id); setTimeout(() => onDone && onDone(), 700); }
    }, 380);
    return () => clearInterval(id);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[var(--eh-bg)]">
      <MatrixRain />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 40%, rgba(0,255,157,.10), transparent 70%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,255,157,.04) 0 1px, transparent 1px 3px)' }} />

      {/* Top progress line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'rgba(0,255,157,.12)' }}>
        <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: 'var(--eh-green)', boxShadow: '0 0 6px var(--eh-green)' }} />
      </div>

      <div className="relative h-full w-full flex items-center justify-center px-4 py-4">
        <div className="w-full max-w-[360px] sm:max-w-[420px] eh-panel eh-brackets px-5 py-6 sm:px-7 sm:py-7 backdrop-blur-sm" style={{ background: 'rgba(8,10,12,.82)' }}>
          <span className="br-bl" /><span className="br-br" />

          {/* Header */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] eh-mono mb-4" style={{ color: 'var(--eh-green)' }}>
            <span>&gt;_ errorhacker_boot.sh</span>
            <div className="flex items-center gap-2"><span className="opacity-70">{SITE.version}</span><button onClick={() => onDone && onDone()} className="opacity-60 hover:opacity-100 tracking-widest text-[9px]">[SKIP]</button></div>
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-3">
            <div className="relative w-[64px] h-[64px] flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full eh-spin-slow" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="48" stroke="rgba(0,255,157,.15)" strokeWidth="0.8" />
                <circle cx="50" cy="50" r="48" stroke="var(--eh-green)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="55 245" />
              </svg>
              <div className="relative z-10 rounded-full overflow-hidden" style={{ boxShadow: '0 0 12px rgba(0,255,157,.3)' }}>
                <Logo size={46} />
              </div>
            </div>
          </div>

          {/* Brand title */}
          <h1 className="eh-brand font-black tracking-[0.08em] text-[26px] sm:text-3xl text-center mb-2.5" style={{ color: 'var(--eh-green)', textShadow: '0 0 2px rgba(0,255,157,.5), 0 0 10px rgba(0,255,157,.2)' }}>{SITE.name}</h1>

          {/* Divider */}
          <div className="mx-auto w-24 h-px mb-3" style={{ background: 'var(--eh-green)', boxShadow: '0 0 6px var(--eh-green)' }} />

          {/* Subtitle */}
          <div className="text-center mb-4 text-[10px] tracking-[.4em] opacity-80" style={{ color: 'var(--eh-green)', fontFamily: "'Share Tech Mono', monospace" }}>INITIALIZING SYSTEM ...</div>

          {/* Terminal log */}
          <div className="text-[10.5px] sm:text-[11px] leading-[1.65] min-h-[100px]" style={{ color: 'var(--eh-green)', fontFamily: "'Share Tech Mono', 'VT323', monospace" }}>
            {lines.map((l, i) => (<div key={i} className={`whitespace-nowrap overflow-hidden text-ellipsis ${i === lines.length - 1 ? 'opacity-100' : 'opacity-70'}`}>{l}</div>))}
            <span className="eh-caret">&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default BootScreen;
