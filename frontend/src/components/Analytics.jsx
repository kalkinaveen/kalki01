import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { loadGA, pageview } from '../lib/analytics';

/**
 * Mount once inside <BrowserRouter>. Loads gtag.js when the admin sets a
 * Google Analytics Measurement ID in config, and fires page_view on every
 * route change.
 */
const Analytics = () => {
  const { config } = useSiteConfig();
  const id = config?.analytics?.googleId || '';
  const enabled = !!config?.analytics?.enabled;
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (enabled && id) loadGA(id);
  }, [enabled, id]);

  useEffect(() => {
    if (enabled && id) pageview(pathname + (search || ''));
  }, [enabled, id, pathname, search]);

  return null;
};

export default Analytics;
