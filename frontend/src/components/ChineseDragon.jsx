import React from 'react';

/**
 * ChineseDragon — A traditional gold Chinese dragon (lóng) that slowly snakes
 * between the letters of ERRORHACKER, then settles ("sleeps") with its head
 * resting on the letter H.
 *
 * Vector-based (SVG) → renders crisp at any resolution (4K-ready).
 * The dragon body is positioned absolutely over the title; CSS animation
 * advances offset-distance and finally rests at the H position.
 */
const ChineseDragon = () => {
  return (
    <span aria-hidden="true" className="eh-dragon-wrap" data-testid="hero-dragon">
      <svg
        className="eh-dragon-svg"
        viewBox="-40 -50 1200 180"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Gold gradient for body fill */}
          <linearGradient id="ehGoldFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"  stopColor="#fff5b6" />
            <stop offset="25%" stopColor="#ffd24a" />
            <stop offset="55%" stopColor="#e0a000" />
            <stop offset="85%" stopColor="#8a5500" />
            <stop offset="100%" stopColor="#5a3a00" />
          </linearGradient>
          {/* Bright accent for highlights */}
          <linearGradient id="ehGoldAccent" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"  stopColor="#fffce0" />
            <stop offset="100%" stopColor="#ffe070" />
          </linearGradient>
          {/* Dark outline gradient */}
          <linearGradient id="ehGoldDark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"  stopColor="#7a4a00" />
            <stop offset="100%" stopColor="#3a2300" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="ehDragonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
            <feFlood floodColor="#ffb13a" floodOpacity="0.55" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Scales pattern */}
          <pattern id="ehScales" x="0" y="0" width="14" height="12" patternUnits="userSpaceOnUse">
            <path d="M 0 6 Q 7 -2 14 6 Z" fill="none" stroke="rgba(70,40,0,.55)" strokeWidth="0.9" />
            <path d="M -7 12 Q 0 4 7 12 M 7 12 Q 14 4 21 12" fill="none" stroke="rgba(70,40,0,.4)" strokeWidth="0.7" />
          </pattern>
        </defs>

        {/* The whole dragon (group) — gets translated along the slither path via CSS offset-path */}
        <g className="eh-dragon-body" filter="url(#ehDragonGlow)">
          {/* Sinuous body (rendered relative to head origin at 0,0). The body extends to the LEFT (negative x) so the head leads. */}
          {/* Body main shape: a long ribbon */}
          <path
            d="
              M 0 0
              C -40 -30, -90  30, -140 -10
              S -240  30, -290 -15
              S -390  25, -440 -10
              S -540  20, -590 -5
              S -680  15, -720 0
              L -740 4 L -740 -4 Z
            "
            fill="url(#ehGoldFill)"
            stroke="url(#ehGoldDark)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Scale texture overlay */}
          <path
            d="
              M 0 0
              C -40 -30, -90  30, -140 -10
              S -240  30, -290 -15
              S -390  25, -440 -10
              S -540  20, -590 -5
              S -680  15, -720 0
              L -740 4 L -740 -4 Z
            "
            fill="url(#ehScales)"
            opacity="0.55"
          />
          {/* Dorsal mane (zig-zag fins along the back) */}
          <path
            d="
              M -8 -8 L -22 -28 L -34 -10
              L -50 -32 L -62 -14
              L -85 -42 L -100 -18
              L -125 -38 L -138 -16
              L -165 -36 L -180 -14
              L -210 -32 L -225 -10
              L -255 -28 L -270 -8
              L -300 -22 L -316 -6
              L -345 -20 L -360 -4
              L -390 -18 L -406 -2
              L -440 -14 L -456 0
              L -490 -10 L -506 4
              L -540 -6 L -556 6
              L -600 -2 L -616 8
              L -660  2 L -676 10
              L -720  4
            "
            fill="none"
            stroke="#ffe070"
            strokeWidth="2.2"
            strokeLinejoin="round"
            opacity="0.9"
          />
          <path
            d="
              M -8 -8 L -22 -28 L -34 -10
              L -50 -32 L -62 -14
              L -85 -42 L -100 -18
              L -125 -38 L -138 -16
              L -165 -36 L -180 -14
              L -210 -32 L -225 -10
              L -255 -28 L -270 -8
              L -300 -22 L -316 -6
              L -345 -20 L -360 -4
              L -390 -18 L -406 -2
              L -440 -14 L -456 0
              L -490 -10 L -506 4
              L -540 -6 L -556 6
              L -600 -2 L -616 8
              L -660  2 L -676 10
              L -720  4
            "
            fill="none"
            stroke="#7a4a00"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          {/* Belly highlight */}
          <path
            d="
              M -2 4
              C -40 28, -90  44, -140 18
              S -240  44, -290 22
              S -390  44, -440 22
              S -540  40, -590 22
              S -680  28, -720 10
            "
            fill="none"
            stroke="#fff5b6"
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity="0.75"
          />

          {/* ====== Limb / claw on body ====== */}
          <g transform="translate(-220, 18)">
            <path d="M 0 0 Q 6 14 -2 22 M -8 22 L -2 22 L 0 30 M -2 22 L 4 28 M -2 22 L 8 24" stroke="#7a4a00" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 0 0 Q 6 14 -2 22" stroke="#ffd24a" strokeWidth="1.2" fill="none" />
          </g>
          <g transform="translate(-460, 16)">
            <path d="M 0 0 Q 6 14 -2 22 M -8 22 L -2 22 L 0 30 M -2 22 L 4 28 M -2 22 L 8 24" stroke="#7a4a00" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 0 0 Q 6 14 -2 22" stroke="#ffd24a" strokeWidth="1.2" fill="none" />
          </g>

          {/* ====== Tail flame ====== */}
          <g transform="translate(-740, 0)">
            <path d="M 0 -4 L -22 -14 L -10 -2 L -28 -2 L -10 2 L -24 14 L 0 4 Z" fill="url(#ehGoldFill)" stroke="#7a4a00" strokeWidth="1.2" strokeLinejoin="round" />
          </g>

          {/* ====== HEAD (sits at origin 0,0; muzzle leads to the right) ====== */}
          <g className="eh-dragon-head">
            {/* Mane / hair around the head */}
            <g opacity="0.95">
              <path d="M -14 -20 Q -22 -38 -4 -34 Q -10 -22 -14 -20 Z" fill="url(#ehGoldFill)" stroke="#7a4a00" strokeWidth="1" />
              <path d="M -22 -10 Q -42 -22 -32 -2 Q -28 -12 -22 -10 Z" fill="url(#ehGoldFill)" stroke="#7a4a00" strokeWidth="1" />
              <path d="M -20  10 Q -42  20 -30  28 Q -26  18 -20  10 Z" fill="url(#ehGoldFill)" stroke="#7a4a00" strokeWidth="1" />
              <path d="M -10  18 Q -22  38  -4  34 Q -10  24 -10  18 Z" fill="url(#ehGoldFill)" stroke="#7a4a00" strokeWidth="1" />
            </g>
            {/* Horns (deer antler style) */}
            <g stroke="#7a4a00" strokeWidth="1.4" fill="url(#ehGoldFill)" strokeLinejoin="round">
              <path d="M -4 -22 Q  2 -34  12 -40 Q  4 -32   6 -22 Z" />
              <path d="M -8 -24 Q -16 -38 -14 -46 Q -18 -36 -12 -22 Z" />
            </g>
            {/* Main head shape */}
            <path
              d="
                M -14 -16
                Q  10 -16  22 -8
                Q  34  -2  30  6
                Q  20  14   6  16
                Q -10  18 -16  10
                Q -22   0 -14 -16 Z
              "
              fill="url(#ehGoldFill)"
              stroke="#5a3a00"
              strokeWidth="1.8"
            />
            {/* Snout highlight */}
            <path d="M 14 -2 Q 24 -2 28 4 Q 22 8 14 6 Z" fill="url(#ehGoldAccent)" opacity="0.9" />
            {/* Nostril */}
            <ellipse cx="26" cy="2" rx="1.6" ry="1" fill="#5a3a00" />
            {/* Whiskers */}
            <g stroke="#ffd24a" strokeWidth="1.2" fill="none" strokeLinecap="round" className="eh-dragon-whiskers">
              <path d="M 22 8 Q 50 18 40 30" />
              <path d="M 28 6 Q 60  6 56 18" />
            </g>
            {/* Eye — open (awake) state */}
            <g className="eh-dragon-eye-open">
              <ellipse cx="2" cy="-4" rx="5" ry="5" fill="#fff" stroke="#5a3a00" strokeWidth="1" />
              <ellipse cx="2.5" cy="-3.5" rx="2.4" ry="3.6" fill="#0a0a0a" />
              <circle cx="3.5" cy="-5" r="0.9" fill="#fff" />
            </g>
            {/* Eye — closed (sleeping) state */}
            <path className="eh-dragon-eye-closed" d="M -3 -4 Q 2 -1 7 -4" stroke="#5a3a00" strokeWidth="1.6" fill="none" strokeLinecap="round" />

            {/* Mouth */}
            <path d="M 14 8 Q 22 12 28 8" stroke="#5a3a00" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            {/* Tiny fang */}
            <path d="M 18 9 L 19 13 L 20 9 Z" fill="#fff5d0" stroke="#5a3a00" strokeWidth="0.5" />
          </g>
        </g>

        {/* Sleeping Zzz (visible only when dragon is at rest) */}
        <g className="eh-dragon-zzz" aria-hidden="true">
          <text className="eh-zzz-1" x="0" y="0" fontFamily="'Caveat Brush', cursive" fontSize="28" fill="#ffd24a">Z</text>
          <text className="eh-zzz-2" x="0" y="0" fontFamily="'Caveat Brush', cursive" fontSize="22" fill="#ffd24a">z</text>
          <text className="eh-zzz-3" x="0" y="0" fontFamily="'Caveat Brush', cursive" fontSize="16" fill="#ffe070">z</text>
        </g>
      </svg>
    </span>
  );
};

export default ChineseDragon;
