import React, { useEffect, useRef, useState } from 'react';

/**
 * SilhouetteDragon — A clean, single-color silhouette Chinese dragon in the
 * traditional logo style (flowing form, no shading, elegant negative space).
 *
 * Original SVG illustration drawn from scratch. Renders in two layers so the
 * body weaves BEHIND some letters of ERRORHACKER and IN FRONT of others.
 *
 *  - Layer A (z-index -1): body parts that should be hidden by letters.
 *  - Layer B (z-index  3): body parts that overlap letters + the head.
 *
 * Cursor reactivity: the head's eye-slit (a tiny negative-space cut) shifts
 * a couple of px following the visitor's cursor — a subtle "the dragon is
 * watching you" effect that fits the silhouette aesthetic.
 */

// ----- Dragon body silhouette path (continuous outline, tail → head) -----
// Body is a long sinuous ribbon with rhythmic S-curves and a spiked mane
// along the back. Head and whiskers are added separately as a group near
// the left end (so the head ends up over the first "E" of ERRORHACKER).
const BODY_PATH = `
  M 1180 80
  C 1130 96, 1060 98, 1000 86
  C 940 74, 900 50, 860 60
  C 820 70, 780 110, 740 105
  C 700 100, 680 60, 640 58
  C 600 56, 560 96, 520 96
  C 480 96, 460 56, 420 56
  C 380 56, 360 96, 320 98
  C 280 100, 260 64, 220 62
  L 195 60
  Q 175 60, 165 70
  Q 156 80, 168 90
  Q 184 102, 220 92
  C 254 84, 280 88, 318 90
  C 360 92, 380 124, 420 122
  C 458 120, 480 88, 520 88
  C 560 88, 580 124, 620 124
  C 658 124, 680 92, 720 92
  C 762 92, 800 124, 840 122
  C 880 120, 900 90, 940 88
  C 980 86, 1020 108, 1080 112
  C 1120 114, 1160 106, 1190 96
  Z
`;

// Mane/spikes along the top of the body — a row of zigzag triangles
const MANE_PATH = `
  M 220 56  L 232 30 L 244 56
  L 268 28 L 280 56
  L 308 30 L 322 60
  L 354 32 L 368 62
  L 402 30 L 418 60
  L 452 32 L 468 60
  L 504 30 L 520 60
  L 556 32 L 570 60
  L 606 30 L 622 60
  L 656 34 L 670 60
  L 706 32 L 720 60
  L 754 34 L 770 60
  L 806 32 L 820 60
  L 856 36 L 870 58
  L 906 34 L 922 56
  L 956 38 L 972 56
  L 1006 36 L 1020 54
  L 1058 38 L 1074 52
  L 1110 42 L 1124 50
  Z
`;

// Two small claws hanging from the underside
const CLAWS_PATH = `
  M 420 124
  L 414 144 L 422 136 L 424 150 L 432 138 L 434 152 L 442 138 L 444 150 L 452 138
  L 458 130 Z
  M 820 124
  L 814 144 L 822 136 L 824 150 L 832 138 L 834 152 L 842 138 L 844 150 L 852 138
  L 858 130 Z
`;

// FRONT windows: x-ranges where body appears IN FRONT of letters. Gaps go
// to the BACK layer (behind letters).
const FRONT_WINDOWS = [
  [60, 230],     // head + first curl (over the E)
  [410, 540],    // mid arc
  [720, 860],    // late arc
  [1040, 1200],  // tail
];

const buildBackRects = (windows) => {
  const back = [];
  let x = -120;
  for (const [a, b] of windows) {
    if (a > x) back.push([x, a]);
    x = b;
  }
  back.push([x, 1320]);
  return back;
};

const Defs = () => (
  <>
    {/* Pure silhouette gradient — body is a flat fill with subtle bottom darkening */}
    <linearGradient id="eh-sil-fill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stopColor="var(--eh-green, #00ff9d)" stopOpacity="1" />
      <stop offset="100%" stopColor="#003a26" stopOpacity="1" />
    </linearGradient>
    {/* Outer glow */}
    <filter id="eh-sil-glow" x="-20%" y="-50%" width="140%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
      <feFlood floodColor="var(--eh-green, #00ff9d)" floodOpacity="0.5" />
      <feComposite in2="blur" operator="in" />
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </>
);

const BodySilhouette = ({ clipId }) => (
  <g clipPath={`url(#${clipId})`} filter="url(#eh-sil-glow)">
    <path d={BODY_PATH}  fill="url(#eh-sil-fill)" />
    <path d={MANE_PATH}  fill="url(#eh-sil-fill)" />
    <path d={CLAWS_PATH} fill="url(#eh-sil-fill)" />
  </g>
);

// ---- Head silhouette (sits at the LEFT end, over the first E) ----
const DragonHead = ({ eyeOffset }) => {
  const { dx, dy } = eyeOffset;
  return (
    <g className="eh-sil-head" transform="translate(140 80)" filter="url(#eh-sil-glow)">
      {/* Whiskers — long flowing curves */}
      <path
        d="M -30 -10 Q -120 -50 -180 -28 Q -210 -16 -200 -2"
        stroke="url(#eh-sil-fill)" strokeWidth="3.5" fill="none" strokeLinecap="round"
        className="eh-sil-whisker eh-sil-whisker-1"
      />
      <path
        d="M -30  16 Q -120  60 -190  40 Q -218  30 -210  14"
        stroke="url(#eh-sil-fill)" strokeWidth="3.2" fill="none" strokeLinecap="round"
        className="eh-sil-whisker eh-sil-whisker-2"
      />

      {/* Mane crest (multiple flame-shaped tongues flowing back) */}
      <path
        d="
          M 10 -28
          L  -6 -64 L  -2 -34
          L -18 -68 L -16 -36
          L -34 -70 L -28 -40
          L -52 -68 L -42 -42
          L -68 -60 L -52 -38
          L -82 -52 L -62 -34
          L -94 -42 L -68 -28
          L 10 -28 Z
        "
        fill="url(#eh-sil-fill)"
      />

      {/* Horns (deer antler silhouette) */}
      <path d="M -8 -36 Q -2 -52  4 -64 Q 12 -56  10 -38 Z" fill="url(#eh-sil-fill)" />
      <path d="M  8 -34 Q 18 -50 28 -58 Q 32 -46 22 -32 Z" fill="url(#eh-sil-fill)" />

      {/* Main head shape — elongated, curved snout, lower jaw open */}
      <path
        d="
          M -22 -28
          Q  30 -32  60 -16
          Q  82  -6  78   6
          Q  72  18  56  20
          Q  82  22  72  32
          Q  56  36  44  30
          Q  30  34  18  30
          Q   8  26  -4  22
          Q -22  18 -28   6
          Q -34  -8 -28 -16
          Q -28 -24 -22 -28 Z
        "
        fill="url(#eh-sil-fill)"
      />

      {/* Negative-space EYE — a slit that cuts INTO the silhouette and tracks
          the cursor by translating a couple of pixels. */}
      <g transform={`translate(${dx} ${dy})`} className="eh-sil-eye">
        <ellipse cx="20" cy="-12" rx="4.2" ry="2.4" fill="#000" />
        <ellipse cx="20" cy="-12" rx="2.2" ry="1.2" fill="var(--eh-green, #00ff9d)" />
      </g>

      {/* Tiny fang silhouette inside mouth */}
      <path d="M 36 8 L 38 18 L 42 8 Z" fill="#000" />
      <path d="M 52 10 L 54 22 L 58 10 Z" fill="#000" />

      {/* Forked tongue — silhouette flame */}
      <g className="eh-sil-tongue">
        <path d="M 74 14 L 96 8 L 86 16 L 102 20 L 86 22 L 96 30 L 74 22 Z" fill="url(#eh-sil-fill)" />
      </g>
    </g>
  );
};

// ---- Tail flame at the right end ----
const DragonTail = () => (
  <g transform="translate(1180 78)" filter="url(#eh-sil-glow)">
    <path
      d="
        M 0 0
        L 30 -22 L 18 -6 L 44 -16 L 26 4
        L 50 6 L 26 16 L 42 32 L 18 22
        L 28 38 L 0 24 Z
      "
      fill="url(#eh-sil-fill)"
    />
  </g>
);

const SilhouetteDragon = () => {
  const wrapRef = useRef(null);
  const [eyeOffset, setEyeOffset] = useState({ dx: 0, dy: 0 });

  useEffect(() => {
    let raf = 0;
    let target = { dx: 0, dy: 0 };
    const handle = (e) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Head sits ~10% from left, ~55% from top
      const hx = r.left + r.width * 0.10;
      const hy = r.top + r.height * 0.55;
      const dx = e.clientX - hx;
      const dy = e.clientY - hy;
      const dist = Math.hypot(dx, dy) || 1;
      const max = 2.4;
      target = { dx: (dx / dist) * max, dy: (dy / dist) * max };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const apply = () => { raf = 0; setEyeOffset(target); };
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
    <span ref={wrapRef} aria-hidden="true" className="eh-rsnake-wrap" data-testid="hero-silhouette-dragon">
      {/* BACK layer — sits BEHIND letters */}
      <svg className="eh-rsnake eh-rsnake-back" viewBox="0 -20 1240 200" preserveAspectRatio="xMidYMid meet">
        <defs>
          <Defs />
          <clipPath id="eh-sil-back-clip" clipPathUnits="userSpaceOnUse">
            {buildBackRects(FRONT_WINDOWS).map(([a, b], i) => (
              <rect key={i} x={a} y={-60} width={b - a} height={300} />
            ))}
          </clipPath>
        </defs>
        <BodySilhouette clipId="eh-sil-back-clip" />
      </svg>

      {/* FRONT layer — sits ABOVE letters */}
      <svg className="eh-rsnake eh-rsnake-front" viewBox="0 -20 1240 200" preserveAspectRatio="xMidYMid meet">
        <defs>
          <Defs />
          <clipPath id="eh-sil-front-clip" clipPathUnits="userSpaceOnUse">
            {FRONT_WINDOWS.map(([a, b], i) => (
              <rect key={i} x={a} y={-60} width={b - a} height={300} />
            ))}
          </clipPath>
        </defs>
        <BodySilhouette clipId="eh-sil-front-clip" />
        <DragonTail />
        <DragonHead eyeOffset={eyeOffset} />
      </svg>
    </span>
  );
};

export default SilhouetteDragon;
