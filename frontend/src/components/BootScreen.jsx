import React, { useEffect, useState } from 'react';
import Logo from './Logo';
import { useSiteConfig } from '../contexts/SiteConfigContext';
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
    }, 320);
    return () => clearInterval(id);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[var(--eh-bg)]">
      <MatrixRain />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 40%, rgba(0,255,157,.10), transparent 70%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,255,157,.04) 0 1px, transparent 1px 3px)' }} />

      <div className="relative h-full w-full flex items-center justify-center px-4">
        <div className="w-full max-w-[640px] eh-panel eh-brackets p-5 sm:p-10 backdrop-blur-sm" style={{ background: 'rgba(8,10,12,.78)' }}>
          <span className="br-bl" /><span className="br-br" />

          <div className="flex items-center justify-between text-[10px] sm:text-xs eh-mono mb-6" style={{ color: 'var(--eh-green)' }}>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ boxShadow: '0 0 8px currentColor' }} /> &gt;_ errorhacker_boot.sh</div>
            <div className="flex items-center gap-3"><span className="opacity-70">{SITE.version}</span><button onClick={() => onDone && onDone()} className="opacity-60 hover:opacity-100 tracking-widest">[SKIP]</button></div>
          </div>

          <div className="flex flex-col items-center gap-6 py-3">
            <div className="relative w-[150px] h-[150px] sm:w-[180px] sm:h-[180px] flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full eh-spin-slow" viewBox="0 0 100 100" fill="none">
                <defs>
                  <linearGradient id="ehArc" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#00ff9d" stopOpacity="0" />
                    <stop offset="60%" stopColor="#00ff9d" stopOpacity=".55" />
                    <stop offset="100%" stopColor="#00ff9d" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="48" stroke="rgba(0,255,157,.15)" strokeWidth="0.6" />
                <circle cx="50" cy="50" r="48" stroke="url(#ehArc)" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="80 220" />
              </svg>
              <div className="absolute inset-5 rounded-full" style={{ border: '1px solid rgba(0,255,157,.35)' }} />
              <div className="relative z-10 rounded-full overflow-hidden" style={{ boxShadow: '0 0 20px rgba(0,255,157,.25)' }}>
                <Logo size={96} />
              </div>
              <div className="absolute inset-5 rounded-full overflow-hidden pointer-events-none">
                <div className="eh-scan-beam" />
              </div>
            </div>

            <h1 className="font-black tracking-[0.18em] text-2xl sm:text-4xl text-center" style={{ fontFamily: "'Major Mono Display', 'Share Tech Mono', monospace", color: 'var(--eh-green)', textShadow: '0 0 3px rgba(0,255,157,.55), 0 0 12px rgba(0,255,157,.3)' }}>{SITE.name}</h1>

            <div className="w-full max-w-sm">
              <div className="flex justify-between eh-mono text-[10px] mb-1 opacity-80"><span>INITIALIZING SYSTEM</span><span>{progress}%</span></div>
              <div className="h-[3px] rounded overflow-hidden bg-white/5 relative"><div style={{ width: `${progress}%`, background: 'var(--eh-green)', boxShadow: '0 0 6px var(--eh-green)' }} className="h-full transition-all duration-300" /></div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] eh-mono">
              <span className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'rgba(0,255,157,.08)', color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.25)' }}><Lock size={10} /> ENCRYPTED</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'rgba(0,255,157,.08)', color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.25)' }}><Wifi size={10} /> TOR_OK</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'rgba(0,255,157,.08)', color: 'var(--eh-green)', border: '1px solid rgba(0,255,157,.25)' }}><ShieldCheck size={10} /> SECURED</span>
            </div>
          </div>

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
