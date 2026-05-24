import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send as SendIcon, Bot, Loader2 } from 'lucide-react';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { api } from '../lib/api';

const sessionKey = 'eh_chat_session';

const getSessionId = () => {
  let s = localStorage.getItem(sessionKey);
  if (!s) { s = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(sessionKey, s); }
  return s;
};

const HelpChat = () => {
  const { config } = useSiteConfig();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ from: 'bot', text: 'hey operator. i am err0r-bot — ask about services, pricing, delivery, refunds or payments.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const sid = useRef(getSessionId());

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, [msgs, open]);

  const send = async (text) => {
    const t = (text || '').trim();
    if (!t || busy) return;
    setMsgs(m => [...m, { from: 'me', text: t }]);
    setInput('');
    setBusy(true);
    try {
      const res = await api.chatSend(sid.current, t);
      setMsgs(m => [...m, { from: 'bot', text: res.reply || '...' }]);
    } catch (e) {
      setMsgs(m => [...m, { from: 'bot', text: 'connection lost. ping us on telegram for instant help.' }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      <button data-testid="helpchat-toggle" onClick={() => setOpen(o => !o)} className="fixed right-[20px] bottom-[94px] z-40 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full"
        style={{ background: '#0d1115', border: '1px solid rgba(0,255,157,.35)', boxShadow: '0 8px 24px rgba(0,0,0,.4), 0 0 0 4px rgba(0,255,157,.06)' }}>
        {open ? <X size={16} color="var(--eh-green)" /> : <MessageCircle size={16} color="var(--eh-green)" />}
        <span className="eh-mono text-xs tracking-widest eh-neon-soft hidden sm:inline">{open ? 'CLOSE' : 'NEED_HELP?'}</span>
      </button>

      {open && (
        <div className="fixed right-3 sm:right-5 bottom-[150px] z-40 w-[min(92vw,360px)] eh-panel eh-brackets shadow-2xl flex flex-col overflow-hidden" style={{ height: 460, background: '#0d1115' }}>
          <span className="br-bl" /><span className="br-br" />
          <div className="p-4 border-b border-[var(--eh-border)] flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: 'rgba(0,255,157,.1)', border: '1px solid rgba(0,255,157,.35)' }}><Bot size={18} color="var(--eh-green)" /></div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--eh-green)] border-2 border-[#0d1115]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily:'Inter,sans-serif' }}>ERR0R-BOT <span className="text-[10px] eh-mono opacity-60">// ai</span></div>
              <div className="eh-mono text-[10px] opacity-70 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--eh-green)]" /> online · encrypted</div>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto eh-scroll p-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from==='me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded text-sm leading-6 whitespace-pre-wrap ${m.from==='me' ? 'bg-[var(--eh-green)] text-[#001a10]' : 'bg-[var(--eh-bg-2)]'}`} style={ m.from!=='me' ? { border:'1px solid var(--eh-border)' } : {}}>{m.text}</div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="px-3 py-2 rounded text-sm eh-mono opacity-70 flex items-center gap-2" style={{ border:'1px solid var(--eh-border)' }}><Loader2 size={12} className="animate-spin" /> typing...</div></div>}
          </div>
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {['Pricing?','Delivery time?','Refund policy?'].map(q => <button key={q} onClick={()=>send(q)} disabled={busy} className="text-[11px] eh-mono px-2 py-1 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] opacity-80">{q}</button>)}
          </div>
          <form onSubmit={e=>{e.preventDefault(); send(input);}} className="p-3 border-t border-[var(--eh-border)] flex gap-2">
            <input data-testid="helpchat-input" value={input} onChange={e=>setInput(e.target.value)} placeholder="&gt; type your message..." className="eh-input flex-1 text-sm py-2" />
            <button data-testid="helpchat-send" disabled={busy} className="w-10 h-10 rounded grid place-items-center bg-[var(--eh-green)] disabled:opacity-50" type="submit"><SendIcon size={16} color="#001a10" /></button>
          </form>
          <a href={config.site.telegram} target="_blank" rel="noreferrer" className="eh-mono text-[10px] text-center py-2 opacity-70 hover:opacity-100 border-t border-[var(--eh-border)]">PREFER LIVE OPERATOR? OPEN ON TELEGRAM →</a>
        </div>
      )}
    </>
  );
};
export default HelpChat;
