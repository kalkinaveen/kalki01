import React from 'react';
import { Send } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const FloatingTelegram = () => {
  const { config } = useSiteConfig();
  return (
    <a href={config.site.telegram} target="_blank" rel="noreferrer" className="eh-float" aria-label="Telegram">
      <Send size={24} />
    </a>
  );
};
export default FloatingTelegram;
