import React, { useEffect, useRef, useState } from 'react';
import { Send, X, Bot, Sparkles } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { api } from '../lib/api';

/**
 * FloatingStack — single fixed cluster at bottom-right that houses:
 *   1. AI FAQ Chatbot (neon, top)
 *   2. Mail Support (middle)
 *   3. Telegram (bottom, primary brand)
 * Mobile-safe: scales sizes + uses safe-area-inset padding to avoid the iOS home bar.
 * Replaces the older FloatingTelegram + FloatingMail (which fought for the same `bottom-24` slot).
 */
const FloatingStack = () => {
  const { config } = useSiteConfig();
  const email = config?.site?.email || 'team@errorhacker.site';
  const tg = config?.site?.telegram || 'https://t.me/errorhacker';

  const [chatOpen, setChatOpen] = useState(false);
  const [sessionId] = useState(() => {
    const k = 'eh_faq_session';
    let s = sessionStorage.getItem(k);
    if (!s) { s = `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem(k, s); }
    return s;
  });
  const [messages, setMessages] = useState(() => [
    { role: 'bot', text: 'hey · i\'m err0r-help. ask me anything about recovery, pricing, eta, payments, or your order ⌁' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, chatOpen]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    try {
      const r = await api.toolsFaq(sessionId, text);
      setMessages(m => [...m, { role: 'bot', text: r.reply || '...' }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'bot', text: `> error · ${e.message || 'try again'}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Chat panel — anchored to the stack, slides up */}
      {chatOpen && (
        <div className="eh-fchat-panel" data-testid="floating-faq-chat-panel" role="dialog" aria-label="FAQ assistant">
          <div className="eh-fchat-head">
            <div className="flex items-center gap-2 min-w-0">
              <div className="eh-fchat-avatar"><Bot size={14} /></div>
              <div className="min-w-0">
                <div className="text-xs eh-mono font-bold leading-tight">err0r-help</div>
                <div className="text-[10px] opacity-60 leading-tight">// ai assistant · online</div>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="opacity-70 hover:opacity-100" data-testid="floating-faq-chat-close" aria-label="close">
              <X size={16} />
            </button>
          </div>
          <div ref={scrollRef} className="eh-fchat-body" data-testid="floating-faq-chat-body">
            {messages.map((m, i) => (
              <div key={i} className={`eh-fchat-msg ${m.role === 'user' ? 'is-user' : 'is-bot'}`}>
                <div className="bubble">{m.text}</div>
              </div>
            ))}
            {busy && (
              <div className="eh-fchat-msg is-bot">
                <div className="bubble"><span className="eh-fchat-dot" /> <span className="eh-fchat-dot" /> <span className="eh-fchat-dot" /></div>
              </div>
            )}
          </div>
          <div className="eh-fchat-foot">
            <input
              data-testid="floating-faq-chat-input"
              className="eh-fchat-input"
              placeholder="ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              disabled={busy}
            />
            <button data-testid="floating-faq-chat-send" onClick={send} disabled={busy || !input.trim()} className="eh-fchat-send">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="eh-float-stack" aria-label="quick actions" data-testid="floating-stack">
        {/* AI FAQ Chatbot */}
        <button
          type="button"
          onClick={() => setChatOpen(v => !v)}
          className="eh-float-btn eh-float-ai group"
          aria-label="AI assistant"
          data-testid="floating-faq-chat-toggle"
          title="ask err0r-help · AI assistant"
        >
          <span className="ai-ring ai-ring-1" />
          <span className="ai-ring ai-ring-2" />
          {chatOpen ? <X size={22} /> : <Bot size={22} />}
          {!chatOpen && (
            <span className="ai-spark" aria-hidden="true"><Sparkles size={10} /></span>
          )}
        </button>

        {/* Mail */}
        <a
          href={`mailto:${email}?subject=Support%20%E2%80%94%20ERRORHACKER`}
          className="eh-float-btn eh-float-mail-v2"
          aria-label="Email Support"
          data-testid="floating-mail-support"
          title={`Email support · ${email}`}
        >
          <span className="ehm-ring ehm-ring-1" />
          <span className="ehm-ring ehm-ring-2" />
          <span className="ehm-orbit"><span className="ehm-dot" /></span>
          <svg viewBox="0 0 64 64" width="22" height="22" className="ehm-svg" aria-hidden="true">
            <defs>
              <linearGradient id="ehmBody2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#001a10" />
                <stop offset="100%" stopColor="#021c14" />
              </linearGradient>
            </defs>
            <rect x="6" y="18" width="52" height="34" rx="5" fill="url(#ehmBody2)" stroke="currentColor" strokeWidth="2.4" />
            <path d="M6 20 L32 40 L58 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" className="ehm-flap" />
            <circle cx="50" cy="16" r="6" fill="currentColor" className="ehm-ping" />
            <text x="50" y="19" textAnchor="middle" fontSize="9" fontWeight="900" fill="#001a10" fontFamily="JetBrains Mono, monospace">@</text>
          </svg>
        </a>

        {/* Telegram */}
        <a
          href={tg}
          target="_blank"
          rel="noreferrer"
          className="eh-float-btn eh-float-tg"
          aria-label="Telegram"
          data-testid="floating-telegram"
          title="Chat on Telegram"
        >
          <Send size={22} />
          <span className="tg-dot" />
        </a>
      </div>
    </>
  );
};

export default FloatingStack;
