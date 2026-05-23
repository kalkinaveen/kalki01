import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import * as M from '../mock';

const KEY = 'eh_site_config_v1';

const DEFAULTS = {
  site: { ...M.SITE, logoUrl: 'https://customer-assets.emergentagent.com/job_functionality-139/artifacts/a8019kmd_WhatsApp%20Image%202026-05-23%20at%205.26.02%20PM.jpeg', brandColor: '#00ff9d', adminPass: 'admin123' },
  nav: M.NAV,
  services: M.SERVICES,
  books: M.BOOKS,
  memberships: M.MEMBERSHIPS,
  blogs: M.BLOGS,
  tools: M.TOOLS,
  partners: M.PARTNERS,
  faqs: M.FAQS,
  testimonials: M.TESTIMONIALS,
  activity: M.ACTIVITY,
  stats: M.STATS,
  howSteps: [
    { n: '01', icon: 'MessageSquare', t: 'Brief & Quote', d: 'Tell us your target & package. Instant encrypted quote on Telegram or in-app.' },
    { n: '02', icon: 'Lock', t: 'Secure Handshake', d: 'Payment routed through encrypted channels. Zero KYC, zero footprint.' },
    { n: '03', icon: 'Cpu', t: 'Manual Operation', d: 'Our operators execute manually. No bots, no shortcuts. Drip-feed available.' },
    { n: '04', icon: 'BadgeCheck', t: 'Guarantee & Refill', d: 'Up to 60-day refill warranty. If anything drops — we top it up. On the house.' },
  ],
  hero: {
    welcome: 'WELCOME TO',
    kicker: 'SYSTEM ONLINE // SECURE CONNECTION_',
    typewriterLines: [
      'initializing operator session...',
      'access granted. ready when you are.',
      'select a service from the panel below.',
      'monetization toolkit loaded. enjoy.',
    ],
    primaryCta: 'Explore Our Services',
    primaryCtaTo: '/services',
    ghostCta: '> view_tools',
    ghostCtaTo: '/tools',
  },
  comparison: [
    { f: 'Weekly intel briefings', r: true, o: true, e: true },
    { f: 'Community Telegram', r: true, o: true, e: true },
    { f: 'Premium tools & scripts', r: false, o: true, e: true },
    { f: 'Full eBook library', r: false, o: true, e: true },
    { f: '24/7 priority support', r: false, o: true, e: true },
    { f: '1-on-1 mentorship', r: false, o: false, e: true },
    { f: 'Custom automation builds', r: false, o: false, e: true },
    { f: 'Private red-team labs', r: false, o: false, e: true },
    { f: 'Lifetime updates', r: false, o: false, e: true },
  ],
};

const SiteConfigCtx = createContext(null);

export const SiteConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed, site: { ...DEFAULTS.site, ...(parsed.site || {}) }, hero: { ...DEFAULTS.hero, ...(parsed.hero || {}) } };
      }
    } catch (_) {}
    return DEFAULTS;
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(config)); } catch (_) {}
    // Apply brand color CSS variable
    const c = config.site?.brandColor;
    if (c) document.documentElement.style.setProperty('--eh-green', c);
  }, [config]);

  const api = useMemo(() => ({
    config,
    setConfig,
    update: (path, value) => setConfig(prev => {
      if (typeof path === 'function') return { ...prev, ...path(prev) };
      const next = { ...prev };
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    }),
    setList: (listKey, items) => setConfig(prev => ({ ...prev, [listKey]: items })),
    reset: () => { localStorage.removeItem(KEY); setConfig(DEFAULTS); },
  }), [config]);

  return <SiteConfigCtx.Provider value={api}>{children}</SiteConfigCtx.Provider>;
};

export const useSiteConfig = () => {
  const ctx = useContext(SiteConfigCtx);
  if (!ctx) throw new Error('useSiteConfig must be inside SiteConfigProvider');
  return ctx;
};

export { DEFAULTS };
