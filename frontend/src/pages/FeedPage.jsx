import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, MessageCircle, Eye, Send as SendIcon, X, BadgeCheck, Grid3x3, Film, Volume2, VolumeX, MapPin, Loader2, Share2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const SESS_KEY = 'eh_feed_view_session';
const getViewSession = () => {
  let s = localStorage.getItem(SESS_KEY);
  if (!s) { s = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(SESS_KEY, s); }
  return s;
};
const fmt = (n) => {
  n = Number(n) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url);
};

const sharePostOrReel = async ({ type, id, caption, displayName }) => {
  const url = `${window.location.origin}/feed/${type === 'reel' ? 'r' : 'p'}/${id}`;
  const title = `${displayName || 'ERRORHACKER'} on ERRORHACKER Feed`;
  const text = caption ? `${caption.slice(0, 120)}${caption.length > 120 ? '…' : ''}` : 'Check this out on ERRORHACKER';
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return; }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied', { description: url });
  } catch {
    window.prompt('Copy this link:', url);
  }
};

const ProfileHeader = ({ profile, postCount, reelCount, brandLogo }) => (
  <div className="px-4 sm:px-6 py-6 sm:py-10 border-b border-[var(--eh-border)]">
    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-6 sm:gap-10 items-center sm:items-start">
      <div className="relative shrink-0">
        <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full overflow-hidden p-[3px]" style={{ background: 'conic-gradient(from 180deg, var(--eh-green), #4de0ff, #a855f7, var(--eh-green))' }}>
          <div className="w-full h-full rounded-full overflow-hidden bg-black">
            <img src={brandLogo} alt={profile.username} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
      <div className="flex-1 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-3">
          <h1 className="eh-display text-xl sm:text-2xl font-light">{profile.username}</h1>
          {profile.verified && <BadgeCheck size={20} className="text-[#4de0ff]" />}
          <Link to="/services" className="ml-2 text-xs eh-mono px-3 py-1.5 rounded bg-[var(--eh-green)] text-[#001a10] font-bold tracking-widest hover:opacity-90">FOLLOW</Link>
          <Link to="/track" className="text-xs eh-mono px-3 py-1.5 rounded border border-[var(--eh-border)] tracking-widest hover:border-[var(--eh-green)]">MESSAGE</Link>
        </div>
        <div className="flex justify-center sm:justify-start gap-6 sm:gap-10 mb-4 eh-mono text-sm">
          <div><span className="font-bold text-base">{fmt(postCount + reelCount)}</span> <span className="opacity-70">posts</span></div>
          <div><span className="font-bold text-base">{fmt(profile.followers)}</span> <span className="opacity-70">followers</span></div>
          <div><span className="font-bold text-base">{fmt(profile.following)}</span> <span className="opacity-70">following</span></div>
        </div>
        <div className="eh-mono text-sm">
          <div className="font-bold mb-1">{profile.displayName}</div>
          {profile.bio && <div className="opacity-80 whitespace-pre-line leading-6">{profile.bio}</div>}
          {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="text-[var(--eh-green)] hover:underline">{profile.website.replace(/^https?:\/\//, '')}</a>}
        </div>
      </div>
    </div>
  </div>
);

const CommentList = ({ items }) => (
  <div className="space-y-3">
    {items.length === 0 && <div className="opacity-60 eh-mono text-xs text-center py-4">No comments yet. Be the first.</div>}
    {items.map(c => (
      <div key={c.id} className="flex gap-2.5 items-start" data-testid={`feed-comment-${c.id}`}>
        {c.picture ? (
          <img src={c.picture} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
        ) : (
          <div className="w-7 h-7 rounded-full grid place-items-center text-[10px] eh-mono shrink-0" style={{ background: 'rgba(0,255,157,.15)', color: 'var(--eh-green)' }}>{(c.user_name || 'a')[0].toUpperCase()}</div>
        )}
        <div className="flex-1 text-sm">
          <span className="font-bold mr-2">{c.user_name}</span>
          <span className="opacity-90">{c.text}</span>
          <div className="eh-mono text-[10px] opacity-50 mt-0.5">{new Date(c.created_at).toLocaleString()}</div>
        </div>
      </div>
    ))}
  </div>
);

// Single post card in vertical feed (Instagram-style)
const PostCard = ({ post, brandLogo, onMutate, onOpenComments, mutedAudio, onToggleMuted }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const viewedRef = useRef(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const isVideo = isVideoUrl(post.image_url);

  useEffect(() => {
    if (!cardRef.current) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        // mark view once at 50%
        if (e.isIntersecting && e.intersectionRatio >= 0.5 && !viewedRef.current) {
          viewedRef.current = true;
          api.feedViewPost(post.id, getViewSession()).catch(() => {});
        }
        // autoplay video when in view, pause otherwise
        if (isVideo && videoRef.current) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            videoRef.current.muted = mutedAudio;
            const p = videoRef.current.play();
            if (p && p.catch) p.catch(() => { videoRef.current.muted = true; videoRef.current.play().catch(()=>{}); });
          } else {
            videoRef.current.pause();
          }
        }
      });
    }, { threshold: [0, 0.5, 0.6] });
    io.observe(cardRef.current);
    return () => io.disconnect();
  }, [post.id, isVideo, mutedAudio]);

  // Reflect global mute toggle on the video
  useEffect(() => { if (isVideo && videoRef.current) videoRef.current.muted = mutedAudio; }, [mutedAudio, isVideo]);

  const doLike = async (forceLike = false) => {
    if (!user) { toast.error('Login to like'); nav('/login'); return; }
    if (forceLike && liked) return;
    try {
      const r = await api.feedLikePost(post.id);
      setLiked(r.liked); setLikes(r.likes_count);
      onMutate?.({ ...post, liked_by_me: r.liked, likes_count: r.likes_count });
    } catch (e) { toast.error(e.message); }
  };

  const handleDoubleTap = () => {
    if (!user) return;
    if (!liked) doLike(true);
    setDoubleTapHeart(true);
    setTimeout(() => setDoubleTapHeart(false), 700);
  };

  return (
    <article ref={cardRef} id={`post-${post.id}`} data-testid={`feed-post-card-${post.id}`} className="border-b border-[var(--eh-border)] pb-4">
      {/* header */}
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="w-9 h-9 rounded-full overflow-hidden p-[2px] shrink-0" style={{ background: 'conic-gradient(from 180deg, var(--eh-green), #4de0ff, #a855f7, var(--eh-green))' }}>
          <img src={brandLogo} className="w-full h-full rounded-full object-cover bg-black" alt="" />
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm font-bold truncate">errorhacker</span>
          <BadgeCheck size={14} className="text-[#4de0ff] shrink-0" />
        </div>
        {post.location && <span className="eh-mono text-[10px] opacity-60 ml-auto flex items-center gap-1 truncate max-w-[40%]"><MapPin size={10} /> {post.location}</span>}
      </div>
      {/* media */}
      <div className="relative bg-black select-none" onDoubleClick={handleDoubleTap}>
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={post.image_url}
              className="w-full max-h-[80vh] object-contain bg-black"
              loop
              playsInline
              muted={mutedAudio}
              preload="metadata"
              onClick={(e) => { const v = e.currentTarget; v.paused ? v.play().catch(()=>{}) : v.pause(); }}
            />
            <button onClick={onToggleMuted} aria-label="toggle audio" className="absolute bottom-3 right-3 w-9 h-9 grid place-items-center rounded-full bg-black/60 text-white">
              {mutedAudio ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </>
        ) : (
          <img src={post.image_url} loading="lazy" className="w-full max-h-[80vh] object-contain" alt="" />
        )}
        {doubleTapHeart && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <Heart size={96} fill="#ff2a3a" color="#ff2a3a" className="drop-shadow-[0_0_20px_rgba(255,42,58,.7)] eh-pop" />
          </div>
        )}
      </div>
      {/* actions */}
      <div className="flex items-center gap-4 px-3 pt-3">
        <button onClick={() => doLike(false)} data-testid={`post-card-like-${post.id}`} aria-label="like" className="active:scale-90 transition-transform"><Heart size={26} fill={liked ? '#ff2a3a' : 'none'} color={liked ? '#ff2a3a' : 'currentColor'} /></button>
        <button onClick={() => onOpenComments(post)} data-testid={`post-card-comments-${post.id}`} aria-label="comments" className="active:scale-90 transition-transform"><MessageCircle size={26} /></button>
        <button onClick={() => sharePostOrReel({ type: 'post', id: post.id, caption: post.caption })} data-testid={`post-card-share-${post.id}`} aria-label="share" className="active:scale-90 transition-transform"><Share2 size={24} /></button>
      </div>
      {/* meta */}
      <div className="px-3 pt-2 text-sm">
        <div className="font-bold eh-mono text-xs">{fmt(likes)} likes · {fmt(post.views_count)} views</div>
        {post.caption && <div className="mt-1.5 leading-6 line-clamp-3"><span className="font-bold mr-2">errorhacker</span>{post.caption}</div>}
        {post.comments_count > 0 && (
          <button onClick={() => onOpenComments(post)} className="mt-1.5 text-xs opacity-60 hover:opacity-100">View all {fmt(post.comments_count)} comments</button>
        )}
        <div className="eh-mono text-[10px] opacity-50 uppercase mt-1.5">{new Date(post.created_at).toLocaleDateString()}</div>
      </div>
    </article>
  );
};

// Instagram-style profile grid tile for posts
const PostTile = ({ post, onOpen }) => {
  const isVideo = isVideoUrl(post.image_url);
  return (
    <button onClick={() => onOpen(post)} data-testid={`post-grid-tile-${post.id}`} className="group relative aspect-square overflow-hidden bg-[var(--eh-bg-2)]">
      {isVideo ? (
        <>
          <video src={post.image_url} className="w-full h-full object-cover" muted preload="metadata" />
          <div className="absolute top-1.5 right-1.5"><Film size={14} className="text-white drop-shadow" /></div>
        </>
      ) : (
        <img src={post.image_url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex items-center gap-5 eh-mono text-white font-bold text-sm">
          <span className="flex items-center gap-1.5"><Heart size={18} fill="white" /> {fmt(post.likes_count)}</span>
          <span className="flex items-center gap-1.5"><MessageCircle size={18} fill="white" /> {fmt(post.comments_count)}</span>
        </div>
      </div>
      {post.pinned && <span className="absolute top-1.5 left-1.5 text-[9px] eh-mono px-1.5 py-0.5 rounded bg-black/70 text-[var(--eh-green)] tracking-widest">PINNED</span>}
    </button>
  );
};

// Instagram-style post modal: image left + comments panel right (desktop) or stacked (mobile)
const PostModal = ({ post, onClose, onMutate }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [muted, setMuted] = useState(true);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const isVideo = isVideoUrl(post.image_url);
  const viewedRef = useRef(false);

  useEffect(() => {
    api.feedPostComments(post.id).then(setComments).catch(() => {});
    if (!viewedRef.current) {
      viewedRef.current = true;
      api.feedViewPost(post.id, getViewSession()).catch(() => {});
    }
  }, [post.id]);

  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.play().catch(() => { if (videoRef.current) { videoRef.current.muted = true; setMuted(true); videoRef.current.play().catch(()=>{}); } });
    }
  }, [isVideo, muted]);

  const doLike = async (forceLike = false) => {
    if (!user) { toast.error('Login to like'); nav('/login'); return; }
    if (forceLike && liked) return;
    try {
      const r = await api.feedLikePost(post.id);
      setLiked(r.liked); setLikes(r.likes_count);
      onMutate?.({ ...post, liked_by_me: r.liked, likes_count: r.likes_count });
    } catch (e) { toast.error(e.message); }
  };

  const handleDoubleTap = () => {
    if (!user) return;
    if (!liked) doLike(true);
    setDoubleTapHeart(true);
    setTimeout(() => setDoubleTapHeart(false), 700);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user) { toast.error('Login to comment'); nav('/login'); return; }
    setBusy(true);
    try {
      const c = await api.feedAddPostComment(post.id, text.trim());
      setComments(prev => [...prev, c]); setText('');
      onMutate?.({ ...post, comments_count: (post.comments_count || 0) + 1 });
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-6" onClick={onClose} data-testid={`post-modal-${post.id}`}>
      <button onClick={onClose} aria-label="close" data-testid="post-modal-close" className="fixed top-4 right-4 z-[90] w-10 h-10 grid place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"><X size={20} /></button>
      <div onClick={e => e.stopPropagation()} className="w-full md:max-w-5xl md:max-h-[92vh] eh-panel grid grid-rows-[auto_1fr] md:grid-rows-1 md:grid-cols-[1fr_360px] overflow-hidden bg-[#0d1115]">
        {/* media side */}
        <div className="relative bg-black flex items-center justify-center min-h-[40vh] md:min-h-0 md:max-h-[92vh]" onDoubleClick={handleDoubleTap}>
          {isVideo ? (
            <>
              <video
                ref={videoRef}
                src={post.image_url}
                className="max-w-full max-h-[55vh] md:max-h-[92vh] object-contain"
                loop
                playsInline
                preload="metadata"
                onClick={(e) => { const v = e.currentTarget; v.paused ? v.play().catch(()=>{}) : v.pause(); }}
              />
              <button onClick={() => setMuted(m => !m)} aria-label="toggle audio" className="absolute bottom-3 right-3 w-9 h-9 grid place-items-center rounded-full bg-black/60 text-white">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
            </>
          ) : (
            <img src={post.image_url} className="max-w-full max-h-[55vh] md:max-h-[92vh] object-contain" alt="" />
          )}
          {doubleTapHeart && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <Heart size={96} fill="#ff2a3a" color="#ff2a3a" className="drop-shadow-[0_0_20px_rgba(255,42,58,.7)] eh-pop" />
            </div>
          )}
        </div>
        {/* side panel */}
        <div className="flex flex-col border-t md:border-t-0 md:border-l border-[var(--eh-border)] min-h-0 max-h-[60vh] md:max-h-none">
          <div className="flex items-center gap-2 p-3 border-b border-[var(--eh-border)] text-sm font-bold">errorhacker <BadgeCheck size={14} className="text-[#4de0ff]" /></div>
          {post.location && <div className="px-3 py-2 eh-mono text-[11px] opacity-70 flex items-center gap-1 border-b border-[var(--eh-border)]"><MapPin size={11} /> {post.location}</div>}
          <div className="flex-1 overflow-y-auto eh-scroll p-3">
            {post.caption && <div className="text-sm mb-4 leading-6"><span className="font-bold mr-2">errorhacker</span>{post.caption}</div>}
            <CommentList items={comments} />
          </div>
          <div className="border-t border-[var(--eh-border)] p-3">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => doLike(false)} data-testid={`post-modal-like-${post.id}`} aria-label="like" className="active:scale-90 transition-transform"><Heart size={24} fill={liked ? '#ff2a3a' : 'none'} color={liked ? '#ff2a3a' : 'currentColor'} /></button>
              <MessageCircle size={24} />
              <button onClick={() => sharePostOrReel({ type: 'post', id: post.id, caption: post.caption })} data-testid={`post-modal-share-${post.id}`} aria-label="share" className="active:scale-90 transition-transform"><Share2 size={22} /></button>
            </div>
            <div className="eh-mono text-xs font-bold mb-1">{fmt(likes)} likes · {fmt(post.views_count)} views</div>
            <div className="eh-mono text-[10px] opacity-50 uppercase">{new Date(post.created_at).toLocaleDateString()}</div>
          </div>
          {user ? (
            <form onSubmit={submit} className="border-t border-[var(--eh-border)] flex">
              <input value={text} onChange={e => setText(e.target.value)} data-testid="post-modal-comment-input" placeholder="Add a comment…" className="flex-1 bg-transparent px-3 py-3 text-sm outline-none" />
              <button data-testid="post-modal-comment-submit" disabled={busy || !text.trim()} className="px-4 text-[var(--eh-green)] font-bold disabled:opacity-30">Post</button>
            </form>
          ) : (
            <div className="border-t border-[var(--eh-border)] p-3 flex items-center gap-3 bg-[rgba(0,255,157,.05)]">
              <div className="flex-1 text-xs eh-mono opacity-80">Join the conversation</div>
              <button onClick={() => nav('/login', { state: { from: '/feed' } })} data-testid="post-modal-login-cta" className="eh-btn-primary text-xs px-4 py-2"><LogIn size={12} /> LOG IN TO COMMENT</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Comments-only bottom sheet for posts
const CommentsSheet = ({ post, onClose, onMutate }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.feedPostComments(post.id).then(setComments).catch(() => {});
  }, [post.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user) { toast.error('Login to comment'); nav('/login'); return; }
    setBusy(true);
    try {
      const c = await api.feedAddPostComment(post.id, text.trim());
      setComments(prev => [...prev, c]); setText('');
      onMutate?.({ ...post, comments_count: (post.comments_count || 0) + 1 });
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-md sm:rounded eh-panel max-h-[85vh] flex flex-col bg-[#0d1115]">
        <div className="flex items-center justify-between p-3 border-b border-[var(--eh-border)]">
          <div className="font-bold text-sm">Comments</div>
          <button onClick={onClose} aria-label="close" className="opacity-70 hover:opacity-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto eh-scroll p-3">
          <CommentList items={comments} />
        </div>
        {user ? (
          <form onSubmit={submit} className="border-t border-[var(--eh-border)] flex">
            <input value={text} onChange={e => setText(e.target.value)} data-testid="post-sheet-comment-input" placeholder="Add a comment…" className="flex-1 bg-transparent px-3 py-3 text-sm outline-none" />
            <button data-testid="post-sheet-comment-submit" disabled={busy || !text.trim()} className="px-4 text-[var(--eh-green)] font-bold disabled:opacity-30">Post</button>
          </form>
        ) : (
          <div className="border-t border-[var(--eh-border)] p-3 flex items-center gap-3 bg-[rgba(0,255,157,.05)]">
            <div className="flex-1 text-xs eh-mono opacity-80">Join the conversation</div>
            <button onClick={() => nav('/login', { state: { from: '/feed' } })} data-testid="post-sheet-login-cta" className="eh-btn-primary text-xs px-4 py-2"><LogIn size={12} /> LOG IN TO COMMENT</button>
          </div>
        )}
      </div>
    </div>
  );
};

// Vertical TikTok/Instagram-Reels-style feed
const ReelsFeed = ({ reels, onMutate, initialReelId, onExit }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const containerRef = useRef(null);
  const videoRefs = useRef({});
  const [muted, setMuted] = useState(false); // audio ON by default
  const [activeId, setActiveId] = useState(null);
  const [commentsFor, setCommentsFor] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);

  // 1. IntersectionObserver only decides which reel is "active"
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(entries => {
      // pick the entry with the highest intersectionRatio that's at least 70% visible
      let best = null;
      entries.forEach(e => {
        if (e.intersectionRatio >= 0.7 && (!best || e.intersectionRatio > best.intersectionRatio)) best = e;
      });
      if (best) setActiveId(best.target.getAttribute('data-reel-id'));
    }, { root: containerRef.current, threshold: [0, 0.5, 0.7, 1] });
    Array.from(containerRef.current.querySelectorAll('[data-reel-id]')).forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [reels.length]);

  // 2. Single source of truth: whenever activeId or muted changes, hard-sync ALL videos.
  //    - Every non-active video: pause + mute + rewind so it can't leak audio.
  //    - Active video: apply user's mute preference and play; if blocked by autoplay policy, fall back to muted.
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, v]) => {
      if (!v) return;
      if (id !== activeId) {
        v.muted = true;
        if (!v.paused) v.pause();
        try { v.currentTime = 0; } catch {}
        return;
      }
      // active
      v.muted = muted;
      const p = v.play();
      if (p && p.catch) {
        p.catch(() => {
          // Autoplay-with-sound blocked → fall back to muted and prompt user
          v.muted = true;
          setMuted(true);
          setShowUnmuteHint(true);
          v.play().catch(() => {});
        });
      }
      // record view once per active reel
      if (!v.dataset.viewed) {
        v.dataset.viewed = '1';
        api.feedViewReel(id, getViewSession()).catch(() => {});
      }
    });
    if (!muted) setShowUnmuteHint(false);
  }, [activeId, muted, reels.length]);

  // Scroll to initial reel from deep-link
  useEffect(() => {
    if (!initialReelId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-reel-id="${initialReelId}"]`);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [initialReelId, reels.length]);

  const toggleLike = async (reel) => {
    if (!user) { toast.error('Login to like'); nav('/login'); return; }
    try {
      const r = await api.feedLikeReel(reel.id);
      onMutate?.({ ...reel, liked_by_me: r.liked, likes_count: r.likes_count });
    } catch (e) { toast.error(e.message); }
  };

  const openComments = async (reel) => {
    setCommentsFor(reel);
    try { setComments(await api.feedReelComments(reel.id)); } catch { setComments([]); }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user) { toast.error('Login to comment'); nav('/login'); return; }
    setBusy(true);
    try {
      const c = await api.feedAddReelComment(commentsFor.id, text.trim());
      setComments(prev => [...prev, c]); setText('');
      onMutate?.({ ...commentsFor, comments_count: (commentsFor.comments_count || 0) + 1 });
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  if (reels.length === 0) {
    return <div className="py-20 text-center opacity-60 eh-mono text-xs">No reels yet.</div>;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <button onClick={onExit} data-testid="reels-close" aria-label="close reels" className="fixed top-4 left-4 z-20 w-10 h-10 grid place-items-center rounded-full bg-black/60 text-white"><X size={20} /></button>
      <button onClick={() => setMuted(m => !m)} data-testid="reels-mute-toggle" aria-label="toggle audio" className="fixed top-4 right-4 z-20 w-10 h-10 grid place-items-center rounded-full bg-black/60 text-white">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>

      <div ref={containerRef} className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory eh-no-scrollbar">
        {reels.map(reel => (
          <section key={reel.id} data-reel-id={reel.id} data-testid={`reel-section-${reel.id}`} className="relative h-[100dvh] snap-start snap-always bg-black flex items-center justify-center">
            <video
              ref={el => { if (el) videoRefs.current[reel.id] = el; }}
              src={reel.video_url}
              className="absolute inset-0 w-full h-full object-contain bg-black"
              loop
              playsInline
              preload="metadata"
              poster={reel.thumb_url || undefined}
              onClick={(e) => {
                const v = e.currentTarget;
                if (v.paused) v.play().catch(()=>{});
                else v.pause();
              }}
            />
            {/* Right action rail */}
            <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 text-white z-10">
              <button onClick={() => toggleLike(reel)} data-testid={`reel-card-like-${reel.id}`} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
                <Heart size={30} fill={reel.liked_by_me ? '#ff2a3a' : 'none'} color={reel.liked_by_me ? '#ff2a3a' : 'currentColor'} />
                <span className="text-[11px] font-bold">{fmt(reel.likes_count)}</span>
              </button>
              <button onClick={() => openComments(reel)} data-testid={`reel-card-comments-${reel.id}`} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
                <MessageCircle size={30} />
                <span className="text-[11px] font-bold">{fmt(reel.comments_count)}</span>
              </button>
              <button onClick={() => sharePostOrReel({ type: 'reel', id: reel.id, caption: reel.caption })} data-testid={`reel-card-share-${reel.id}`} aria-label="share" className="flex flex-col items-center gap-1 transition-transform active:scale-90">
                <Share2 size={28} />
                <span className="text-[11px] font-bold">Share</span>
              </button>
              <div className="flex flex-col items-center gap-1 opacity-90">
                <Eye size={26} />
                <span className="text-[11px] font-bold">{fmt(reel.views_count)}</span>
              </div>
            </div>
            {/* Bottom caption */}
            <div className="absolute bottom-0 left-0 right-0 p-3 pr-20 pb-6 bg-gradient-to-t from-black/85 to-transparent text-white z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-bold text-sm">errorhacker</span>
                <BadgeCheck size={14} className="text-[#4de0ff]" />
              </div>
              {reel.caption && <div className="text-xs leading-5 opacity-95 line-clamp-3">{reel.caption}</div>}
            </div>
          </section>
        ))}
      </div>

      {/* Tap-to-unmute hint */}
      {showUnmuteHint && muted && (
        <button onClick={() => setMuted(false)} data-testid="reels-unmute-hint" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/70 border border-white/20 text-white text-xs eh-mono flex items-center gap-2 backdrop-blur">
          <VolumeX size={14} /> tap to unmute
        </button>
      )}

      {/* Comments sheet */}
      {commentsFor && (
        <div className="fixed inset-0 z-[90] bg-black/85 flex items-end justify-center" onClick={() => setCommentsFor(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-md eh-panel rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col bg-[#0d1115]">
            <div className="flex items-center justify-between p-3 border-b border-white/10 text-white">
              <div className="font-bold text-sm">Comments</div>
              <button onClick={() => setCommentsFor(null)} aria-label="close"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto eh-scroll p-3 text-white"><CommentList items={comments} /></div>
            {user ? (
              <form onSubmit={submitComment} className="border-t border-white/10 flex">
                <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none" />
                <button disabled={busy || !text.trim()} className="px-4 text-[var(--eh-green)] font-bold disabled:opacity-30">Post</button>
              </form>
            ) : (
              <div className="border-t border-white/10 p-3 flex items-center gap-3 bg-[rgba(0,255,157,.06)]">
                <div className="flex-1 text-xs eh-mono opacity-80 text-white">Join the conversation</div>
                <button onClick={() => { setCommentsFor(null); nav('/login', { state: { from: '/feed' } }); }} data-testid="reel-sheet-login-cta" className="eh-btn-primary text-xs px-4 py-2"><LogIn size={12} /> LOG IN TO COMMENT</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FeedPage = () => {
  const { config } = useSiteConfig();
  const { postId, reelId } = useParams();
  const nav = useNavigate();
  const profile = config.feedProfile || { username: 'errorhacker', displayName: config.site?.name || 'ERRORHACKER', bio: '', followers: 0, following: 0, verified: true };
  const [tab, setTab] = useState(reelId ? 'reels' : 'posts');
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsPost, setCommentsPost] = useState(null);
  const [openPostId, setOpenPostId] = useState(null);
  const [openReelId, setOpenReelId] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.feedListPosts(), api.feedListReels()])
      .then(([p, r]) => { setPosts(p); setReels(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Open post modal on deep link
  useEffect(() => {
    if (postId && posts.length) { setTab('posts'); setOpenPostId(postId); }
  }, [postId, posts.length]);

  useEffect(() => {
    if (reelId && reels.length) { setTab('reels'); setOpenReelId(reelId); }
  }, [reelId, reels.length]);

  const postCount = useMemo(() => posts.length, [posts]);
  const reelCount = useMemo(() => reels.length, [reels]);

  const updatePost = useCallback((p) => setPosts(prev => prev.map(x => x.id === p.id ? p : x)), []);
  const updateReel = useCallback((r) => setReels(prev => prev.map(x => x.id === r.id ? r : x)), []);

  const exitReels = () => { setOpenReelId(null); window.history.replaceState(null, '', '/feed'); };

  const openReel = (id) => { setOpenReelId(id); window.history.replaceState(null, '', `/feed/r/${id}`); };

  const openPost = (post) => { setOpenPostId(post.id); window.history.replaceState(null, '', `/feed/p/${post.id}`); };
  const closePost = () => { setOpenPostId(null); window.history.replaceState(null, '', '/feed'); };

  const openPostObj = useMemo(() => posts.find(p => p.id === openPostId) || null, [openPostId, posts]);

  // Combined Posts + Reels feed for the "ALL" tab — sorted by created_at desc, pinned first
  const combined = useMemo(() => {
    const items = [
      ...posts.map(p => ({ ...p, _kind: 'post' })),
      ...reels.map(r => ({ ...r, _kind: 'reel' })),
    ];
    items.sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return items;
  }, [posts, reels]);

  return (
    <section className="min-h-[80vh] eh-grid-bg">
      <ProfileHeader profile={profile} postCount={postCount} reelCount={reelCount} brandLogo={config.site.logoUrl} />
      <div className="max-w-xl mx-auto">
        <div className="flex justify-center border-b border-[var(--eh-border)] sticky top-[64px] z-10 backdrop-blur bg-[rgba(5,6,8,.85)]">
          <button onClick={() => setTab('posts')} data-testid="feed-tab-posts" className={`flex items-center gap-2 px-5 py-3 text-xs eh-mono tracking-widest uppercase ${tab === 'posts' ? 'text-[var(--eh-green)] border-t-2 border-[var(--eh-green)]' : 'opacity-70'}`}>
            <Grid3x3 size={14} /> ALL
          </button>
          <button onClick={() => setTab('reels')} data-testid="feed-tab-reels" className={`flex items-center gap-2 px-5 py-3 text-xs eh-mono tracking-widest uppercase ${tab === 'reels' ? 'text-[var(--eh-green)] border-t-2 border-[var(--eh-green)]' : 'opacity-70'}`}>
            <Film size={14} /> REELS
          </button>
        </div>
        {loading ? (
          <div className="py-20 grid place-items-center opacity-70"><Loader2 className="animate-spin" /></div>
        ) : tab === 'posts' ? (
          <div className="py-3">
            {combined.length === 0 && <div className="py-20 text-center opacity-60 eh-mono text-xs">No posts or reels yet.</div>}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 px-1 sm:px-0">
              {combined.map(item => item._kind === 'reel' ? (
                <button key={`r-${item.id}`} onClick={() => openReel(item.id)} data-testid={`feed-grid-reel-${item.id}`} className="group relative aspect-square overflow-hidden bg-[var(--eh-bg-2)]">
                  {item.thumb_url ? (
                    <img src={item.thumb_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <video src={item.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-5 eh-mono text-white font-bold text-sm">
                      <span className="flex items-center gap-1.5"><Heart size={18} fill="white" /> {fmt(item.likes_count)}</span>
                      <span className="flex items-center gap-1.5"><Eye size={18} /> {fmt(item.views_count)}</span>
                    </div>
                  </div>
                  <div className="absolute top-1.5 right-1.5"><Film size={14} className="text-white drop-shadow" /></div>
                  {item.pinned && <span className="absolute top-1.5 left-1.5 text-[9px] eh-mono px-1.5 py-0.5 rounded bg-black/70 text-[var(--eh-green)] tracking-widest">PINNED</span>}
                </button>
              ) : (
                <PostTile key={`p-${item.id}`} post={item} onOpen={openPost} />
              ))}
            </div>
          </div>
        ) : (
          <div className="py-3">
            {reels.length === 0 && <div className="py-20 text-center opacity-60 eh-mono text-xs">No reels yet.</div>}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 px-1 sm:px-0">
              {reels.map(r => (
                <button key={r.id} onClick={() => openReel(r.id)} data-testid={`reel-grid-tile-${r.id}`} className="group relative overflow-hidden bg-[var(--eh-bg-2)]" style={{ aspectRatio: '9/16' }}>
                  {r.thumb_url ? (
                    <img src={r.thumb_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <video src={r.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute top-1.5 right-1.5"><Film size={14} className="text-white drop-shadow" /></div>
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between eh-mono text-white text-[11px] font-bold">
                    <span className="flex items-center gap-1"><Eye size={11} /> {fmt(r.views_count)}</span>
                    <span className="flex items-center gap-1"><Heart size={11} fill="white" /> {fmt(r.likes_count)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {openPostObj && <PostModal post={openPostObj} onClose={closePost} onMutate={updatePost} />}
      {commentsPost && <CommentsSheet post={commentsPost} onClose={() => setCommentsPost(null)} onMutate={updatePost} />}
      {openReelId && reels.length > 0 && <ReelsFeed reels={reels} onMutate={updateReel} initialReelId={openReelId} onExit={exitReels} />}
    </section>
  );
};

export default FeedPage;
