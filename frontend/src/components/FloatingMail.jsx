import React from 'react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

/**
 * Floating "Mail Support" button — pairs with FloatingTelegram, sits above it.
 * Unique animated SVG envelope:
 *  - Outer ring pulses softly (radar)
 *  - Envelope flap "opens" on hover (3D-ish tilt)
 *  - A neon-green message dot orbits around the envelope drawing attention
 *  - Tiny @ in the corner cycles brightness like a notification ping
 */
const FloatingMail = () => {
  const { config } = useSiteConfig();
  const email = config?.site?.email || 'team@errorhacker.site';
  return (
    <a
      href={`mailto:${email}?subject=Support%20%E2%80%94%20ERRORHACKER`}
      className="eh-float-mail group"
      aria-label="Email Support"
      data-testid="floating-mail-support"
      title={`Email support · ${email}`}
    >
      <span className="ehm-ring ehm-ring-1" />
      <span className="ehm-ring ehm-ring-2" />
      <span className="ehm-orbit"><span className="ehm-dot" /></span>
      <svg viewBox="0 0 64 64" width="28" height="28" className="ehm-svg" aria-hidden="true">
        <defs>
          <linearGradient id="ehmBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#001a10" />
            <stop offset="100%" stopColor="#021c14" />
          </linearGradient>
        </defs>
        {/* envelope body */}
        <rect x="6" y="18" width="52" height="34" rx="5" fill="url(#ehmBody)" stroke="currentColor" strokeWidth="2.4" />
        {/* envelope flap (top triangle) */}
        <path d="M6 20 L32 40 L58 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" className="ehm-flap" />
        {/* @ symbol notification corner */}
        <circle cx="50" cy="16" r="6" fill="currentColor" className="ehm-ping" />
        <text x="50" y="19" textAnchor="middle" fontSize="9" fontWeight="900" fill="#001a10" fontFamily="JetBrains Mono, monospace">@</text>
      </svg>
    </a>
  );
};

export default FloatingMail;
