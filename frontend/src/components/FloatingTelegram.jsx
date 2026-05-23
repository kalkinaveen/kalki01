import React from 'react';
import { Send } from 'lucide-react';
import { SITE } from '../mock';

const FloatingTelegram = () => (
  <a href={SITE.telegram} target="_blank" rel="noreferrer" className="eh-float" aria-label="Telegram">
    <Send size={24} />
  </a>
);
export default FloatingTelegram;
