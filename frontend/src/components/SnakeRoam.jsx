import React from 'react';

/**
 * SnakeRoam — a live venom-style snake that slithers around the ERRORHACKER title.
 * - Sits absolutely positioned over its parent .relative container.
 * - Pure SVG + CSS keyframes. No external libs.
 * - Body segments follow the head with progressive delays for realistic motion.
 */
const SEGMENTS = 16;

const SnakeRoam = () => {
  return (
    <span aria-hidden="true" className="eh-snake-wrap" data-testid="hero-snake">
      <svg className="eh-snake-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {/* Glow filter */}
          <filter id="eh-snake-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Scale gradient: bright lime back → dark venom green belly */}
          <radialGradient id="eh-snake-grad" cx="50%" cy="35%" r="60%">
            <stop offset="0%"  stopColor="#d4ffe6" />
            <stop offset="35%" stopColor="#0aff9d" />
            <stop offset="85%" stopColor="#016a3d" />
            <stop offset="100%" stopColor="#001a10" />
          </radialGradient>
        </defs>
      </svg>

      {/* Body trail (each segment animates the SAME path with a delay → tail follows head) */}
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const t = i / SEGMENTS; // 0 head → 1 tail
        const size = 22 - t * 16; // px — head fat, tail thin
        // delay (negative so all segments start mid-loop, creating instant snake on load)
        const delay = -(SEGMENTS - i) * 0.07;
        return (
          <span
            key={i}
            className="eh-snake-seg"
            style={{
              '--seg-size': `${size}px`,
              '--seg-delay': `${delay}s`,
              '--seg-z': SEGMENTS - i,
              '--seg-hue': `${110 - t * 25}deg`,
              opacity: 1 - t * 0.25,
            }}
          />
        );
      })}

      {/* Head with eyes + flicking tongue (rides the same path, on top) */}
      <span className="eh-snake-head" style={{ '--seg-delay': '0s', '--seg-z': SEGMENTS + 5 }}>
        <span className="eh-snake-eye eh-snake-eye-l" />
        <span className="eh-snake-eye eh-snake-eye-r" />
        <span className="eh-snake-tongue" />
      </span>
    </span>
  );
};

export default SnakeRoam;
