import React, { useEffect, useRef, useState } from 'react';

/**
 * RealisticSnake — Scary, large, 4K-vector cobra weaving through the
 * ERRORHACKER title. Slithers in on first paint, settles with head resting
 * on the first letter "E". Eyes track the visitor's cursor in real time.
 *
 * Layers:
 *  - .eh-rsnake-back  (SVG behind text, z-index < text)  — body parts hidden
 *    by letters where the snake passes BEHIND.
 *  - .eh-rsnake-front (SVG above text, z-index > text)   — body parts visible
 *    in FRONT of letters + the head + tongue.
 *
 * Coordinate system: head sits at SVG (90, 60) which maps to ~5–9% from left
 * (right over the first E). Body extends to the RIGHT (x → 1100).
 */

// Path: head at (90,60) → tail at (1100,60), 4 sinusoidal humps over letters
const SNAKE_PATH = `
  M 90 60
  C 160 60, 220 -10, 290 -10
  S 390 60, 460 60
  S 560 -10, 630 -10
  S 730 60, 800 60
  S 900 -10, 970 -10
  S 1060 50, 1100 55
`;

// FRONT windows: x-ranges where the snake body should appear IN FRONT of
// letters. The gaps are rendered on the BACK layer (behind letters).
const FRONT_WINDOWS = [
  [60, 230],     // head & first hump (covers the E)
  [400, 540],    // mid hump
  [720, 860],    // late hump
  [1040, 1180],  // tail tip
];

const buildBackRects = (windows) => {
  const back = [];
  let x = -120;
  for (const [a, b] of windows) {
    if (a > x) back.push([x, a]);
    x = b;
  }
  back.push([x, 1280]);
  return back;
};

const Defs = () => (
  <>
    <linearGradient id="eh-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stopColor="#86a44a" />
      <stop offset="15%"  stopColor="#506e22" />
      <stop offset="50%"  stopColor="#1f3208" />
      <stop offset="85%"  stopColor="#0e1903" />
      <stop offset="100%" stopColor="#040701" />
    </linearGradient>
    <linearGradient id="eh-belly-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stopColor="rgba(220,210,150,0)" />
      <stop offset="50%"  stopColor="#c4b67a" />
      <stop offset="100%" stopColor="#5c4f25" />
    </linearGradient>
    <linearGradient id="eh-head-grad" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%"   stopColor="#a8c062" />
      <stop offset="25%"  stopColor="#6a8a28" />
      <stop offset="60%"  stopColor="#2b430e" />
      <stop offset="100%" stopColor="#070d02" />
    </linearGradient>
    <radialGradient id="eh-eye-grad" cx="40%" cy="35%" r="65%">
      <stop offset="0%"   stopColor="#fff9c4" />
      <stop offset="40%"  stopColor="#f9d534" />
      <stop offset="80%"  stopColor="#b25600" />
      <stop offset="100%" stopColor="#3a1a00" />
    </radialGradient>
    <radialGradient id="eh-eye-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stopColor="rgba(255,240,80,.85)" />
      <stop offset="60%" stopColor="rgba(255,160,30,.35)" />
      <stop offset="100%" stopColor="rgba(255,80,0,0)" />
    </radialGradient>
    <linearGradient id="eh-fang-grad" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%"  stopColor="#fffbe8" />
      <stop offset="60%" stopColor="#e7d8a0" />
      <stop offset="100%" stopColor="#a07b30" />
    </linearGradient>
    <pattern id="eh-scales" x="0" y="0" width="18" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-3)">
      <path d="M 0 7 Q 9 -2 18 7 Z" fill="none" stroke="rgba(20,12,5,.7)" strokeWidth="1" />
      <path d="M -9 14 Q 0 5 9 14 M 9 14 Q 18 5 27 14" fill="none" stroke="rgba(20,12,5,.5)" strokeWidth="0.8" />
    </pattern>
    <pattern id="eh-hood-scales" x="0" y="0" width="12" height="14" patternUnits="userSpaceOnUse">
      <path d="M 6 0 L 12 7 L 6 14 L 0 7 Z" fill="none" stroke="rgba(10,6,2,.85)" strokeWidth="1" />
      <path d="M 6 2 L 10 7 L 6 12 L 2 7 Z" fill="rgba(255,255,255,.06)" />
    </pattern>
    <filter id="eh-shadow" x="-30%" y="-30%" width="160%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
      <feOffset dx="0" dy="6" result="offsetblur" />
      <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </>
);

const SnakeBody = ({ clipId }) => (
  <g clipPath={`url(#${clipId})`}>
    {/* shadow */}
    <path d={SNAKE_PATH} fill="none" stroke="rgba(0,0,0,.55)" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" transform="translate(2,5)" />
    {/* dark outline */}
    <path d={SNAKE_PATH} fill="none" stroke="#0c0703" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
    {/* body fill */}
    <path d={SNAKE_PATH} fill="none" stroke="url(#eh-body-grad)" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
    {/* belly highlight */}
    <path d={SNAKE_PATH} fill="none" stroke="url(#eh-belly-grad)" strokeWidth="10" strokeLinecap="round" transform="translate(0,8)" opacity="0.65" />
    {/* spine highlight */}
    <path d={SNAKE_PATH} fill="none" stroke="rgba(255,255,255,.20)" strokeWidth="2.4" strokeLinecap="round" transform="translate(0,-7)" />
    {/* scale pattern */}
    <path d={SNAKE_PATH} fill="none" stroke="url(#eh-scales)" strokeWidth="26" opacity="0.6" />
    {/* engraving hatching */}
    <path d={SNAKE_PATH} fill="none" stroke="rgba(15,9,3,.55)" strokeWidth="22" strokeDasharray="1.2 7" strokeLinecap="butt" opacity="0.9" />
  </g>
);

/** The big scary head (sits at SVG 90,60 when settled). Eyes track cursor. */
const ScaryHead = ({ eyeOffset }) => {
  const { dx, dy } = eyeOffset;
  return (
    <g className="eh-rsnake-head" transform="translate(90 60)" filter="url(#eh-shadow)">
      {/* Hood (cobra-like flare) — wide triangle behind head */}
      <g className="eh-hood">
        <path d="M 24 -34 Q 70 -54 96 -38 Q 110 -10 96 18 Q 70 36 24 24 Z" fill="url(#eh-head-grad)" stroke="#0a0501" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M 24 -34 Q 70 -54 96 -38 Q 110 -10 96 18 Q 70 36 24 24 Z" fill="url(#eh-hood-scales)" opacity="0.7" />
        {/* hood spectacle pattern */}
        <ellipse cx="68" cy="-12" rx="8" ry="6" fill="#fbe89b" opacity="0.5" />
        <ellipse cx="68" cy="10" rx="8" ry="6" fill="#fbe89b" opacity="0.5" />
        <path d="M 60 -2 Q 72 -8 84 -2 Q 72 4 60 -2 Z" fill="rgba(0,0,0,.35)" />
      </g>

      {/* Main head shape — triangular, looking LEFT (toward viewer) */}
      <path d="
          M -54 -2
          Q -56 -28 -28 -34
          Q  16 -42  46 -30
          Q  60 -16  56  -2
          Q  60  14  46  28
          Q  16  42 -28  34
          Q -56  28 -54  2 Z
        " fill="url(#eh-head-grad)" stroke="#0a0501" strokeWidth="2.4" strokeLinejoin="round" />

      {/* Top scales */}
      <path d="M -42 -18 Q -10 -28 36 -22 M -42 -10 Q -10 -18 38 -12 M -40 0 Q -10 -6 40 -2" stroke="rgba(15,9,3,.65)" strokeWidth="1.2" fill="none" />
      <path d="M -40 18 Q -10 26 38 18 M -40 10 Q -10 16 40 10" stroke="rgba(15,9,3,.55)" strokeWidth="1.1" fill="none" />

      {/* Snout / nostril */}
      <ellipse cx="-46" cy="-10" rx="2.2" ry="1.5" fill="#0c0501" />
      <ellipse cx="-46" cy="10"  rx="2.2" ry="1.5" fill="#0c0501" />

      {/* Eyes — glow + iris + slit pupil that follows cursor */}
      <g className="eh-rsnake-eye">
        {/* Glow halo */}
        <circle cx="-18" cy="-16" r="14" fill="url(#eh-eye-glow)" />
        <circle cx="-18" cy="18"  r="14" fill="url(#eh-eye-glow)" />
        {/* Eye socket shadow */}
        <ellipse cx="-18" cy="-16" rx="11" ry="9" fill="#1a0c02" />
        <ellipse cx="-18" cy="18"  rx="11" ry="9" fill="#1a0c02" />
        {/* Iris (yellow-amber) */}
        <ellipse cx="-18" cy="-16" rx="9" ry="7" fill="url(#eh-eye-grad)" stroke="#0a0501" strokeWidth="1" />
        <ellipse cx="-18" cy="18"  rx="9" ry="7" fill="url(#eh-eye-grad)" stroke="#0a0501" strokeWidth="1" />
        {/* SLIT PUPILS — translated by cursor offset */}
        <g transform={`translate(${dx} ${dy})`}>
          <ellipse cx="-18" cy="-16" rx="1.6" ry="6" fill="#050505" />
          <ellipse cx="-18" cy="18"  rx="1.6" ry="6" fill="#050505" />
          {/* tiny catch-light */}
          <circle cx="-15.5" cy="-19" r="1.2" fill="#fff" opacity="0.85" />
          <circle cx="-15.5" cy="15"  r="1.2" fill="#fff" opacity="0.85" />
        </g>
        {/* Brow ridge — adds menace */}
        <path d="M -32 -26 Q -18 -32 -4 -26" stroke="#0a0501" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <path d="M -32  10 Q -18  4  -4  10" stroke="#0a0501" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      </g>

      {/* Mouth opening (slightly agape, showing fangs) */}
      <path d="M -54 -2 Q -48 14 -38 12 L -30 8 Q -10 6 14 8 L 30 12 Q 42 12 50 4" fill="#3a0a0a" stroke="#0a0501" strokeWidth="1.4" />
      {/* Inner mouth shadow */}
      <path d="M -48 0 Q -36 8 -26 6 L -12 4 Q 6 4 22 6 L 36 8 Q 44 8 48 2" fill="#150404" />

      {/* Fangs (two big curved fangs) */}
      <g className="eh-fangs">
        <path d="M -42 2 Q -41 16 -38 26 Q -36 16 -34 4 Z" fill="url(#eh-fang-grad)" stroke="#0a0501" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M -22 4 Q -21 20 -18 32 Q -16 20 -14 6 Z" fill="url(#eh-fang-grad)" stroke="#0a0501" strokeWidth="0.8" strokeLinejoin="round" />
      </g>

      {/* Forked tongue */}
      <g className="eh-rsnake-tongue" transform="translate(-58 0)">
        <path d="M 0 -2 L -22 -10 L -14 -2 L -28 2 L -14 6 L -22 14 L 0 4 Z" fill="#a01818" stroke="#5a0707" strokeWidth="0.8" strokeLinejoin="round" />
      </g>
    </g>
  );
};

const RealisticSnake = () => {
  const wrapRef = useRef(null);
  const [eyeOffset, setEyeOffset] = useState({ dx: 0, dy: 0 });

  // Track cursor and translate pupils within the eyes
  useEffect(() => {
    let raf = 0;
    let target = { dx: 0, dy: 0 };
    const handle = (e) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Head center in screen px — head sits ~6% from left, ~50% from top of wrap
      const hx = r.left + r.width * 0.06;
      const hy = r.top + r.height * 0.55;
      const dx = e.clientX - hx;
      const dy = e.clientY - hy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const max = 3.2; // max pupil shift in SVG units
      target = {
        dx: (dx / dist) * max,
        dy: (dy / dist) * max,
      };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const apply = () => {
      raf = 0;
      setEyeOffset(target);
    };
    window.addEventListener('mousemove', handle, { passive: true });
    window.addEventListener('touchmove', (ev) => {
      const t = ev.touches[0]; if (t) handle({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handle);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <span ref={wrapRef} aria-hidden="true" className="eh-rsnake-wrap" data-testid="hero-snake-realistic">
      {/* BACK layer (behind text) */}
      <svg className="eh-rsnake eh-rsnake-back" viewBox="-40 -60 1240 180" preserveAspectRatio="xMidYMid meet">
        <defs>
          <Defs />
          <clipPath id="eh-back-clip" clipPathUnits="userSpaceOnUse">
            {buildBackRects(FRONT_WINDOWS).map(([a, b], i) => (
              <rect key={i} x={a} y={-80} width={b - a} height={240} />
            ))}
          </clipPath>
        </defs>
        <SnakeBody clipId="eh-back-clip" />
      </svg>

      {/* FRONT layer (above text) */}
      <svg className="eh-rsnake eh-rsnake-front" viewBox="-40 -60 1240 180" preserveAspectRatio="xMidYMid meet">
        <defs>
          <Defs />
          <clipPath id="eh-front-clip" clipPathUnits="userSpaceOnUse">
            {FRONT_WINDOWS.map(([a, b], i) => (
              <rect key={i} x={a} y={-80} width={b - a} height={240} />
            ))}
          </clipPath>
        </defs>
        <SnakeBody clipId="eh-front-clip" />
        {/* Tail tip flourish (front layer end) */}
        <g transform="translate(1100 55)">
          <path d="M 0 -8 L 32 -14 L 16 0 L 36 4 L 16 8 L 30 18 Z" fill="url(#eh-body-grad)" stroke="#0c0703" strokeWidth="1.2" strokeLinejoin="round" />
        </g>
        {/* HEAD with cursor-tracking eyes */}
        <ScaryHead eyeOffset={eyeOffset} />
      </svg>
    </span>
  );
};

export default RealisticSnake;
