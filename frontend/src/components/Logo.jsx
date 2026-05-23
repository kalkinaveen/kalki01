import React from 'react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const Logo = ({ size = 44 }) => {
  const { config } = useSiteConfig();
  const LOGO_URL = config.site.logoUrl;
  return (
    <div style={{ width: size, height: size }} className="relative rounded-full overflow-hidden shrink-0">
      <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 2px var(--eh-green), 0 0 18px rgba(0,255,157,.55), inset 0 0 14px rgba(0,0,0,.7)', zIndex: 2, pointerEvents: 'none' }} />
      <img src={LOGO_URL} alt="logo" className="w-full h-full object-cover relative" style={{ borderRadius: '50%' }} />
    </div>
  );
};
export default Logo;
