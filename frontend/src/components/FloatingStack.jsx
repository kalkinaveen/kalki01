import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, X, Bot, Sparkles, Mail } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { api } from '../lib/api';

/** Custom contact glyph — a terminal-style chat bubble with a broadcast antenna + live ping. */
const ContactGlyph = ({ open }) => (
  <svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true" style={{ display: 'block' }}>
    <defs>
      <linearGradient id="cgFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stopColor="#001a10" />
        <stop offset="100%" stopColor="#052b1d" />
      </linearGradient>
    </defs>
    {/* Antenna mast */}
    <line x1="22" y1="3" x2="22" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity={open ? 0 : 1} />
    {/* Broadcast waves */}
    <path d="M19 5 Q22 3 25 5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={open ? 0 : .85} className="cg-wave cg-wave-1" />
    <path d="M17.5 6 Q22 1.5 26.5 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={open ? 0 : .55} className="cg-wave cg-wave-2" />
    {/* Chat bubble body */}
    <path
      d="M3 8 H21 Q24 8 24 11 V19 Q24 22 21 22 H12 L7 25.5 V22 H6 Q3 22 3 19 Z"
      fill="url(#cgFill)"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Terminal dots inside bubble */}
    <circle cx="9"  cy="15" r="1.4" fill="currentColor" className="cg-dot cg-dot-1" />
    <circle cx="13.5" cy="15" r="1.4" fill="currentColor" className="cg-dot cg-dot-2" />
    <circle cx="18" cy="15" r="1.4" fill="currentColor" className="cg-dot cg-dot-3" />
    {/* Live ping at antenna tip */}
    <circle cx="22" cy="3" r="2" fill="currentColor" className="cg-ping" opacity={open ? 0 : 1} />
  </svg>
);

/**
 * FloatingStack — fixed bottom-right action cluster.
 *
 *  • AI FAQ Chatbot (err0r-help) — visible on EVERY page.
 *  • Contact (Telegram + Email popover) — visible ONLY on the home page (`/`).
 *
 * iOS notes:
 *  • All inputs render at 16px on mobile so Safari does NOT auto-zoom on focus.
 *  • Chat panel uses 100dvh-aware sizing and safe-area inset to dodge the home bar.
 */
const FloatingStack = () => {
  const { config } = useSiteConfig();
  const { pathname } = useLocation();
  const email = config?.site?.email || 'team@errorhacker.site';
  const tg = config?.site?.telegram || 'https://t.me/errorhacker';

  // Contact button visibility: home page only
  const onHome = pathname === '/' || pathname === '';

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
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
  const contactWrapRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, chatOpen]);

  // Close contact popover on outside click
  useEffect(() => {
    if (!contactOpen) return;
    const onDoc = (e) => {
      if (contactWrapRef.current && !contactWrapRef.current.contains(e.target)) setContactOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [contactOpen]);

  // Hide contact popover when we navigate away from home
  useEffect(() => { if (!onHome) setContactOpen(false); }, [onHome]);

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
      if (e.status === 429 && e.detail?.limit_reached) {
        const d = e.detail;
        let msg;
        if (d.auth_required) {
          msg = `⌛ free ai limit reached (${d.used}/${d.free_limit} today). sign in + top up wallet at /me to keep chatting · ₹${d.wallet_cost}/msg after free.`;
        } else if (d.top_up_required) {
          msg = `⌛ free limit used (${d.used}/${d.free_limit}). top up your wallet at /me — extras cost ₹${d.wallet_cost}/msg. resets at midnight UTC.`;
        } else {
          msg = `⌛ ${d.message || 'free limit reached'}`;
        }
        setMessages(m => [...m, { role: 'bot', text: msg }]);
      } else {
        setMessages(m => [...m, { role: 'bot', text: `> error · ${e.message || 'try again'}` }]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* AI Chat panel — slides up from the AI bot button */}
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
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <button data-testid="floating-faq-chat-send" onClick={send} disabled={busy || !input.trim()} className="eh-fchat-send" aria-label="send">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="eh-float-stack" aria-label="quick actions" data-testid="floating-stack">
        {/* AI FAQ Chatbot — always visible */}
        <button
          type="button"
          onClick={() => { setChatOpen(v => !v); setContactOpen(false); }}
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

        {/* Contact (Telegram + Email merged) — HOME PAGE ONLY */}
        {onHome && (
          <div ref={contactWrapRef} style={{ position: 'relative' }}>
            {/* Popover with Telegram + Email options */}
            {contactOpen && (
              <div className="eh-contact-pop" data-testid="floating-contact-popover">
                <a
                  href={tg}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="floating-contact-telegram"
                  onClick={() => setContactOpen(false)}
                  className="eh-contact-item"
                  style={{ '--brand': '#229ED9' }}
                >
                  <span className="eh-contact-ico" style={{ background: '#229ED9' }}>
                    <Send size={15} color="#fff" />
                  </span>
                  <span className="min-w-0">
                    <span className="block eh-mono text-[11px] tracking-widest font-bold leading-tight">TELEGRAM</span>
                    <span className="block text-[11px] opacity-65 leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>instant chat · 24/7</span>
                  </span>
                </a>
                <a
                  href={`mailto:${email}?subject=Support%20%E2%80%94%20ERRORHACKER`}
                  data-testid="floating-contact-email"
                  onClick={() => setContactOpen(false)}
                  className="eh-contact-item"
                  style={{ '--brand': '#00ff9d' }}
                >
                  <span className="eh-contact-ico" style={{ background: 'rgba(0,255,157,.18)', border: '1px solid rgba(0,255,157,.5)' }}>
                    <Mail size={15} color="#00ff9d" />
                  </span>
                  <span className="min-w-0">
                    <span className="block eh-mono text-[11px] tracking-widest font-bold leading-tight">EMAIL</span>
                    <span className="block text-[11px] opacity-65 leading-tight truncate" style={{ fontFamily: 'Inter, sans-serif' }}>{email}</span>
                  </span>
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setContactOpen(v => !v); setChatOpen(false); }}
              className="eh-float-btn eh-float-contact"
              aria-label="Contact us"
              data-testid="floating-contact-toggle"
              title="Contact · Telegram or Email"
            >
              <span className="ehc-ring ehc-ring-1" />
              <span className="ehc-ring ehc-ring-2" />
              {contactOpen ? <X size={22} /> : <ContactGlyph open={false} />}
              {!contactOpen && <span className="ehc-dot" />}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default FloatingStack;
