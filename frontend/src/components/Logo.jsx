import React from 'react';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_functionality-139/artifacts/a8019kmd_WhatsApp%20Image%202026-05-23%20at%205.26.02%20PM.jpeg';

const Logo = ({ size = 44 }) => (
  <div
    style={{ width: size, height: size }}
    className="relative rounded-full overflow-hidden shrink-0"
  >
    <div
      className="absolute inset-0 rounded-full"
      style={{
        boxShadow: '0 0 0 2px #00ff9d, 0 0 18px rgba(0,255,157,.55), inset 0 0 14px rgba(0,0,0,.7)',
        zIndex: 2,
        pointerEvents: 'none'
      }}
    />
    <img
      src={LOGO_URL}
      alt="ERRORHACKER"
      className="w-full h-full object-cover relative"
      style={{ borderRadius: '50%' }}
    />
  </div>
);
export default Logo;
