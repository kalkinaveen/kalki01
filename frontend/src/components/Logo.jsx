import React from 'react';

const Logo = ({ size = 44 }) => (
  <div
    style={{ width: size, height: size }}
    className="relative rounded-full flex items-center justify-center"
  >
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background: 'radial-gradient(circle at 30% 30%, #ff3148, #7d0a14 60%, #2a0408)',
        boxShadow: '0 0 0 2px #00ff9d, 0 0 18px rgba(0,255,157,.55), inset 0 0 14px rgba(0,0,0,.7)'
      }}
    />
    <span
      className="relative eh-display font-black text-white"
      style={{ fontSize: size * 0.34, letterSpacing: '-0.04em', textShadow: '0 1px 0 #000, 0 0 6px #ff3148' }}
    >EH</span>
  </div>
);
export default Logo;
