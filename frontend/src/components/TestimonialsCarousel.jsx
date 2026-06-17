import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star, BadgeCheck, Quote, MessageCircle, Image as ImageIcon, Play } from 'lucide-react';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#00ff9d 0%,#00d4ff 100%)',
  'linear-gradient(135deg,#ffd34d 0%,#ff6b3a 100%)',
  'linear-gradient(135deg,#c084fc 0%,#4de0ff 100%)',
  'linear-gradient(135deg,#4de0ff 0%,#00ff9d 100%)',
  'linear-gradient(135deg,#ff6b6b 0%,#ffd34d 100%)',
  'linear-gradient(135deg,#a78bfa 0%,#ec4899 100%)',
];

const hashIdx = (s, mod) => {
  let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
};

const fmtRelative = (iso) => {
  if (!iso) return 'recently';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'today';
  if (d < 30) return `${Math.floor(d)}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

const Avatar = ({ url, name, size = 44 }) => {
  if (url) return <img src={url} alt={name || ''} className="rounded-full object-cover ring-2 ring-[rgba(0,255,157,.35)]" style={{ width: size, height: size }} />;
  const initial = (name || 'A').trim()[0].toUpperCase();
  const grad = AVATAR_GRADIENTS[hashIdx(name || '', AVATAR_GRADIENTS.length)];
  return <div className="rounded-full grid place-items-center font-black text-black ring-2 ring-[rgba(0,255,157,.35)]" style={{ width: size, height: size, background: grad, fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: size * 0.42 }}>{initial}</div>;
};

/**
 * Premium chat-bubble testimonials carousel.
 *
 * - Each review rendered as a faux Telegram/WhatsApp-style chat window.
 * - Customer's review appears as an incoming message bubble; an automated
 *   "ERRORHACKER team" reply appears below for premium social-proof effect.
 * - Auto-rotates every 7s, pauses on hover. Manual prev/next arrows + dot pager.
 * - Strict black + neon green theme with subtle gradient accents.
 */
const TestimonialsCarousel = ({ reviews = [] }) => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const reels = reviews.filter(r => r.approved !== false);
  const total = reels.length;
  const safeIdx = total ? ((idx % total) + total) % total : 0;

  useEffect(() => {
    if (paused || total < 2) return;
    const t = setInterval(() => setIdx(v => v + 1), 7000);
    return () => clearInterval(t);
  }, [paused, total]);

  if (!total) return null;
  const go = (dir) => setIdx(v => v + dir);

  return (
    <section className="mt-10 sm:mt-14" data-testid="testimonials-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex items-end justify-between gap-3 mb-4 sm:mb-5 flex-wrap">
        <div>
          <div className="eh-kicker mb-1">// TESTIMONIALS</div>
          <h2 className="font-black text-xl sm:text-3xl" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>What Our <span className="eh-neon">Clients Say</span></h2>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={() => go(-1)} aria-label="Previous" data-testid="testimonials-prev" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full grid place-items-center border border-[var(--eh-border)] hover:border-[var(--eh-green)] hover:text-[var(--eh-green)] transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={() => go(1)} aria-label="Next" data-testid="testimonials-next" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full grid place-items-center border border-[var(--eh-border)] hover:border-[var(--eh-green)] hover:text-[var(--eh-green)] transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="relative overflow-hidden testimonials-vp">
        <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${safeIdx * 100}%)` }}>
          {reels.map((r, i) => (
            <div key={r.id || i} className="w-full shrink-0 px-0.5 sm:px-2">
              <article className="testimonial-card relative grid lg:grid-cols-[1.1fr_1fr] gap-4 sm:gap-6 p-3 sm:p-7 rounded-xl sm:rounded-2xl border border-[rgba(0,255,157,.25)] bg-[#0a0d10]" data-testid={`testimonial-${r.id || i}`}>
                <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl opacity-50" style={{ background: 'radial-gradient(60% 80% at 80% 20%, rgba(0,255,157,.10), transparent 70%), radial-gradient(60% 80% at 10% 90%, rgba(77,224,255,.06), transparent 70%)' }} />

                {/* LEFT: chat simulation */}
                <div className="relative">
                  <div className="testimonial-chat rounded-lg sm:rounded-xl border border-[var(--eh-border)] bg-[#10141a] overflow-hidden">
                    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--eh-border)] bg-[#0d1115]">
                      <Avatar url={r.avatar_url} name={r.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="font-bold text-[13px] sm:text-sm truncate" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{r.name || 'Anonymous'}</div>
                          {r.source === 'customer' && <BadgeCheck size={12} className="text-[var(--eh-green)] shrink-0" />}
                        </div>
                        <div className="eh-mono text-[9px] sm:text-[10px] opacity-60 flex items-center gap-1.5">
                          <span className="relative inline-flex w-1.5 h-1.5"><span className="absolute inset-0 rounded-full bg-[var(--eh-green)] eh-pulse-dot" /></span>
                          online · {fmtRelative(r.createdAt)}
                        </div>
                      </div>
                      {/* mobile stars inline */}
                      <div className="flex items-center gap-0.5 text-[#ffd34d] lg:hidden">
                        {Array.from({ length: r.rating || 5 }).map((_, si) => <Star key={si} size={10} fill="currentColor" />)}
                      </div>
                      <div className="ml-auto eh-mono text-[9px] tracking-widest opacity-50 hidden lg:block">VERIFIED</div>
                    </div>
                    <div className="p-3 sm:p-5 space-y-2 sm:space-y-3 min-h-[120px] sm:min-h-[170px]" style={{ background: 'linear-gradient(180deg,#10141a 0%,#0c0f13 100%)' }}>
                      <div className="flex justify-start">
                        <div className="max-w-[88%] sm:max-w-[85%] px-3 py-2 sm:py-2.5 rounded-2xl rounded-tl-md text-[13px] sm:text-sm leading-relaxed bg-[#1a1f26] text-white/95 border border-[rgba(255,255,255,.06)]" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
                          "{r.quote}"
                          <div className="eh-mono text-[8px] sm:text-[9px] opacity-50 mt-1 sm:mt-1.5 text-right">{fmtRelative(r.createdAt)} · seen ✓✓</div>
                        </div>
                      </div>
                      {/* Proof media */}
                      {!!(r.media_urls || []).length && (
                        <div className="flex justify-start">
                          <div className="max-w-[88%] sm:max-w-[85%] flex flex-col gap-1.5">
                            <div className="eh-mono text-[8px] sm:text-[9px] opacity-60 px-1">📎 {r.media_urls.length} attachment{r.media_urls.length > 1 ? 's' : ''}</div>
                            <div className={`grid gap-1 ${r.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                              {r.media_urls.slice(0, 4).map((m, mi) => (
                                <a key={mi} href={m.url} target="_blank" rel="noreferrer" className="relative block rounded-md overflow-hidden border border-[rgba(0,255,157,.25)] aspect-square bg-black/40 group eh-protected-media" onContextMenu={(e) => e.preventDefault()}>
                                  {m.kind === 'video' ? (
                                    <video src={m.url} muted playsInline preload="metadata" controlsList="nodownload" disablePictureInPicture className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
                                  ) : (
                                    <img src={m.url} alt="" className="w-full h-full object-cover pointer-events-none select-none" draggable={false} loading="lazy" />
                                  )}
                                  <div className="eh-watermark-overlay" aria-hidden="true">
                                    <span>ERRORHACKER · </span>
                                    <span>ERRORHACKER · </span>
                                  </div>
                                  {m.kind === 'video' && (
                                    <div className="absolute inset-0 grid place-items-center bg-black/30 pointer-events-none">
                                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/65 grid place-items-center"><Play size={12} className="text-[var(--eh-green)] ml-0.5" fill="currentColor" /></div>
                                    </div>
                                  )}
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <div className="max-w-[80%] px-3 py-1.5 sm:py-2 rounded-2xl rounded-tr-md text-[11px] sm:text-[12px] leading-relaxed text-black font-medium" style={{ background: 'linear-gradient(135deg,#00ff9d 0%,#00d4ff 100%)', fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
                          Glad we could help! 🎉 — <b>ERRORHACKER team</b>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: pull-quote — desktop only (hidden on mobile to avoid duplication) */}
                <div className="relative hidden lg:flex flex-col justify-between">
                  <div>
                    <Quote size={28} className="text-[var(--eh-green)] opacity-60 mb-3" />
                    <p className="text-lg sm:text-xl leading-relaxed mb-5 opacity-95" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", letterSpacing: '-.005em' }}>
                      "{(r.quote || '').slice(0, 220)}{(r.quote || '').length > 220 ? '…' : ''}"
                    </p>
                    <div className="flex items-center gap-1 text-[#ffd34d] mb-4">
                      {Array.from({ length: r.rating || 5 }).map((_, si) => <Star key={si} size={16} fill="currentColor" />)}
                      <span className="ml-2 eh-mono text-[10px] tracking-widest opacity-70">{(r.rating || 5).toFixed(1)} / 5</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-4 border-t border-[var(--eh-border)]">
                    <Avatar url={r.avatar_url} name={r.name} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="font-bold text-sm" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{r.name || 'Anonymous'}</div>
                        {r.source === 'customer' && <BadgeCheck size={14} className="text-[var(--eh-green)] shrink-0" title="Verified customer" />}
                      </div>
                      {r.handle && <div className="eh-mono text-[10px] opacity-60">{r.handle}</div>}
                      {r.service_key && <div className="eh-mono text-[10px] opacity-50 mt-0.5">case: {r.service_key}</div>}
                    </div>
                    <MessageCircle size={16} className="text-[var(--eh-green)] opacity-60 shrink-0" />
                  </div>
                </div>

                {/* Mobile-only compact footer (case + handle) */}
                {(r.handle || r.service_key) && (
                  <div className="lg:hidden -mt-1 flex items-center justify-between gap-2 eh-mono text-[10px] opacity-60 px-1">
                    {r.handle && <span className="truncate">{r.handle}</span>}
                    {r.service_key && <span className="text-[var(--eh-green)] shrink-0">case: {r.service_key}</span>}
                  </div>
                )}
              </article>
            </div>
          ))}
        </div>
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-4 sm:mt-5">
          {reels.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Go to slide ${i + 1}`} className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${i === safeIdx ? 'w-6 sm:w-8 bg-[var(--eh-green)]' : 'w-1.5 sm:w-2 bg-[var(--eh-border)] hover:bg-white/30'}`} />
          ))}
        </div>
      )}
    </section>
  );
};

export default TestimonialsCarousel;
