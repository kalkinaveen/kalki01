import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import * as M from '../mock';
import { api } from '../lib/api';

const KEY = 'eh_site_config_v1';

const DEFAULTS = {
  site: { ...M.SITE, logoUrl: 'https://customer-assets.emergentagent.com/job_functionality-139/artifacts/a8019kmd_WhatsApp%20Image%202026-05-23%20at%205.26.02%20PM.jpeg', brandColor: '#00ff9d', adminPass: 'admin123' },
  notifications: { telegram: { enabled: false, bot_token: '', chat_id: '' } },
  feedProfile: { username: 'errorhacker', displayName: 'ERRORHACKER', bio: '// underground tech intel\n// 24/7 secure ops', website: 'https://errorhacker.site', followers: 128400, following: 42, verified: true },
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

const mergeWithDefaults = (data) => ({
  ...DEFAULTS,
  ...data,
  site: { ...DEFAULTS.site, ...(data?.site || {}) },
  hero: { ...DEFAULTS.hero, ...(data?.hero || {}) },
  feedProfile: { ...DEFAULTS.feedProfile, ...(data?.feedProfile || {}) },
  notifications: {
    ...DEFAULTS.notifications,
    ...(data?.notifications || {}),
    telegram: { ...DEFAULTS.notifications.telegram, ...((data?.notifications || {}).telegram || {}) },
  },
});

export const SiteConfigProvider = ({ children }) => {
  // Try to seed from localStorage cache for instant render
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return mergeWithDefaults(JSON.parse(raw));
    } catch (_) {}
    return DEFAULTS;
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch from API on mount (overwrites cache)
  useEffect(() => {
    let active = true;
    api.getConfig()
      .then(remote => {
        if (!active) return;
        const merged = mergeWithDefaults(remote);
        setConfig(merged);
        try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch (_) {}
      })
      .catch(err => console.warn('config fetch failed, using local cache', err))
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  // Persist + apply brand color
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(config)); } catch (_) {}
    const c = config.site?.brandColor;
    if (c) document.documentElement.style.setProperty('--eh-green', c);
  }, [config]);

  // Push to backend (admin only)
  const persistRemote = useCallback(async (next) => {
    setSaving(true);
    try { await api.putConfig(next); } catch (e) { console.warn('remote save failed', e?.message); }
    finally { setSaving(false); }
  }, []);

  const api2 = useMemo(() => ({
    config,
    loaded,
    saving,
    setConfig: (val) => {
      const next = typeof val === 'function' ? val(config) : val;
      setConfig(next);
      // Only push to backend if admin is logged in
      if (localStorage.getItem('eh_admin_token')) persistRemote(next);
    },
    update: (path, value) => {
      setConfig(prev => {
        const next = { ...prev };
        const keys = path.split('.');
        let cur = next;
        for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...cur[keys[i]] }; cur = cur[keys[i]]; }
        cur[keys[keys.length - 1]] = value;
        if (localStorage.getItem('eh_admin_token')) persistRemote(next);
        return next;
      });
    },
    setList: (listKey, items) => {
      setConfig(prev => {
        const next = { ...prev, [listKey]: items };
        if (localStorage.getItem('eh_admin_token')) persistRemote(next);
        return next;
      });
    },
    reset: async () => {
      localStorage.removeItem(KEY);
      setConfig(DEFAULTS);
      if (localStorage.getItem('eh_admin_token')) await persistRemote(DEFAULTS);
    },
    refetch: async () => {
      try {
        const remote = await api.getConfig();
        const merged = mergeWithDefaults(remote);
        setConfig(merged);
      } catch (_) {}
    },
  }), [config, loaded, saving, persistRemote]);

  return <SiteConfigCtx.Provider value={api2}>{children}</SiteConfigCtx.Provider>;
};

export const useSiteConfig = () => {
  const ctx = useContext(SiteConfigCtx);
  if (!ctx) throw new Error('useSiteConfig must be inside SiteConfigProvider');
  return ctx;
};

export { DEFAULTS };
