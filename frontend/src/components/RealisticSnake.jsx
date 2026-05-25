import React from 'react';

/**
 * RealisticSnake — A vintage engraved-illustration style snake that winds
 * through the ERRORHACKER title. Rendered in two SVG layers so the body
 * passes BEHIND some letters and IN FRONT of others (true weaving effect).
 *
 * Layer A (behind text): the body sections that should be hidden by letters.
 * Layer B (above text):   the body sections that should overlap the letters,
 *                         including the head.
 *
 * The snake's centerline is a smooth S-curve. We use SVG clip-paths to show
 * alternating slices of the same body on each layer — together they recreate
 * the full snake with the weaving illusion.
 */
const SNAKE_PATH = `
  M -50 60
  C  40 60,  70  -20, 140  -20
  S  220 60, 290 60
  S  370 -20, 440 -20
  S  520 60, 590 60
  S  670 -20, 740 -20
  S  820 60, 890 60
  S  960 -20, 1040 -20
  S 1100 50, 1160 50
`;
// We pick 4 weaving "windows" along the X axis. Slices INSIDE windows go in
// FRONT of the letters; the rest go BEHIND. Coordinates are in SVG viewBox
// units (0..1100).
const FRONT_WINDOWS = [
  [120, 250],   // hump 1 — front
  [430, 560],   // hump 2 — front
  [730, 860],   // hump 3 — front
  [1010, 1170], // head + final hump — front
];

const buildClipRects = (windows, invert = false) => {
  if (!invert) return windows;
  // Convert front windows -> back rects (gaps between fronts)
  const back = [];
  let x = -120;
  for (const [a, b] of windows) {
    if (a > x) back.push([x, a]);
    x = b;
  }
  back.push([x, 1300]);
  return back;
};

const SnakeBody = ({ id }) => (
  <g clipPath={`url(#${id})`}>
    {/* Drop shadow behind body for depth */}
    <path d={SNAKE_PATH} fill="none" stroke="rgba(0,0,0,.55)" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" transform="translate(2,4)" />
    {/* Dark outline */}
    <path d={SNAKE_PATH} fill="none" stroke="#1c0e05" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
    {/* Main body fill */}
    <path d={SNAKE_PATH} fill="none" stroke="url(#snakeBody)" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
    {/* Belly highlight (offset down slightly) */}
    <path d={SNAKE_PATH} fill="none" stroke="url(#snakeBelly)" strokeWidth="10" strokeLinecap="round" transform="translate(0,8)" opacity="0.6" />
    {/* Spine highlight */}
    <path d={SNAKE_PATH} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2.5" strokeLinecap="round" transform="translate(0,-7)" />
    {/* Scale texture — repeating diamonds via dasharray */}
    <path d={SNAKE_PATH} fill="none" stroke="url(#snakeScales)" strokeWidth="26" strokeLinecap="butt"
          strokeDasharray="6 14" opacity="0.55" />
    {/* Cross-hatching for engraving feel */}
    <path d={SNAKE_PATH} fill="none" stroke="rgba(20,12,5,.55)" strokeWidth="22"
          strokeDasharray="1.2 7" strokeLinecap="butt" opacity="0.8" />
  </g>
);

const RealisticSnake = () => {
  return (
    <span aria-hidden="true" className="eh-rsnake-wrap" data-testid="hero-snake-realistic">
      {/* BACK layer — sits BEHIND the letters */}
      <svg className="eh-rsnake eh-rsnake-back" viewBox="-60 -60 1240 180" preserveAspectRatio="xMidYMid meet">
        <defs>
          <SnakeDefs />
          <clipPath id="snakeBackClip" clipPathUnits="userSpaceOnUse">
            {buildClipRects(FRONT_WINDOWS, true).map(([a, b], i) => (
              <rect key={i} x={a} y={-80} width={b - a} height={240} />
            ))}
          </clipPath>
        </defs>
        <SnakeBody id="snakeBackClip" />
      </svg>

      {/* FRONT layer — sits ABOVE the letters */}
      <svg className="eh-rsnake eh-rsnake-front" viewBox="-60 -60 1240 180" preserveAspectRatio="xMidYMid meet">
        <defs>
          <SnakeDefs />
          <clipPath id="snakeFrontClip" clipPathUnits="userSpaceOnUse">
            {FRONT_WINDOWS.map(([a, b], i) => (
              <rect key={i} x={a} y={-80} width={b - a} height={240} />
            ))}
          </clipPath>
        </defs>
        <SnakeBody id="snakeFrontClip" />

        {/* HEAD — placed at the end of the path (front-only) */}
        <g className="eh-rsnake-head" transform="translate(1158 50)">
          <ellipse cx="0" cy="0" rx="34" ry="22" fill="url(#snakeBody)" stroke="#1c0e05" strokeWidth="2.5" />
          <ellipse cx="-2" cy="-3" rx="28" ry="14" fill="url(#snakeScales)" opacity="0.6" />
          {/* Subtle scale lines on head */}
          <path d="M -28 -8 Q -10 -16 18 -10 M -30 0 Q -10 -4 22 0 M -28 8 Q -10 14 18 10" stroke="rgba(20,12,5,.55)" strokeWidth="1.2" fill="none" />
          {/* Eye */}
          <ellipse cx="10" cy="-6" rx="4.5" ry="3.5" fill="#fff8d0" stroke="#1c0e05" strokeWidth="1.2" />
          <ellipse cx="10" cy="-6" rx="1.6" ry="3.4" fill="#0a0a0a" />
          {/* Nostril */}
          <circle cx="26" cy="-2" r="1.4" fill="#1c0e05" />
          {/* Tongue */}
          <path className="eh-rsnake-tongue" d="M 34 2 L 50 -4 L 44 2 L 52 6 L 44 2 L 50 8 Z" fill="#9b1818" stroke="#5a0a0a" strokeWidth="0.6" strokeLinejoin="round" />
        </g>
      </svg>
    </span>
  );
};

const SnakeDefs = () => (
  <>
    {/* Body gradient — natural snake green/olive */}
    <linearGradient id="snakeBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stopColor="#6b8a37" />
      <stop offset="20%"  stopColor="#3f5a1c" />
      <stop offset="50%"  stopColor="#1f3208" />
      <stop offset="80%"  stopColor="#0e1903" />
      <stop offset="100%" stopColor="#070d02" />
    </linearGradient>
    {/* Belly highlight (paler green/cream) */}
    <linearGradient id="snakeBelly" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
      <stop offset="50%"  stopColor="#c9d49a" />
      <stop offset="100%" stopColor="#8a9560" />
    </linearGradient>
    {/* Scales (small pattern) */}
    <pattern id="snakeScales" x="0" y="0" width="16" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-2)">
      <path d="M 0 7 Q 8 -1 16 7 Z" fill="none" stroke="rgba(30,18,5,.7)" strokeWidth="1" />
      <path d="M -8 14 Q 0 6 8 14 M 8 14 Q 16 6 24 14" fill="none" stroke="rgba(30,18,5,.5)" strokeWidth="0.8" />
    </pattern>
  </>
);

export default RealisticSnake;
