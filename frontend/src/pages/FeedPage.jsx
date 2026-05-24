import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Eye, Send as SendIcon, X, BadgeCheck, Grid3x3, Film, Volume2, VolumeX, MapPin, Loader2 } from 'lucide-react';
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

const PostTile = ({ post, onOpen }) => (
  <button onClick={() => onOpen(post)} data-testid={`feed-post-tile-${post.id}`} className="group relative aspect-square overflow-hidden bg-[var(--eh-bg-2)]">
    <img src={post.image_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
      <div className="flex items-center gap-5 eh-mono text-white font-bold">
        <span className="flex items-center gap-1.5"><Heart size={18} fill="white" /> {fmt(post.likes_count)}</span>
        <span className="flex items-center gap-1.5"><MessageCircle size={18} fill="white" /> {fmt(post.comments_count)}</span>
      </div>
    </div>
    {post.pinned && <span className="absolute top-2 left-2 text-[9px] eh-mono px-1.5 py-0.5 rounded bg-black/70 text-[var(--eh-green)] tracking-widest">PINNED</span>}
  </button>
);

const ReelTile = ({ reel, onOpen }) => (
  <button onClick={() => onOpen(reel)} data-testid={`feed-reel-tile-${reel.id}`} className="group relative overflow-hidden bg-[var(--eh-bg-2)]" style={{ aspectRatio: '9/16' }}>
    {reel.thumb_url ? (
      <img src={reel.thumb_url} alt="" className="w-full h-full object-cover" />
    ) : (
      <video src={reel.video_url} className="w-full h-full object-cover" muted preload="metadata" />
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
    <div className="absolute top-2 right-2"><Film size={14} className="text-white" /></div>
    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between eh-mono text-white text-[11px] font-bold">
      <span className="flex items-center gap-1"><Eye size={12} /> {fmt(reel.views_count)}</span>
      <span className="flex items-center gap-1"><Heart size={12} fill="white" /> {fmt(reel.likes_count)}</span>
    </div>
  </button>
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

const PostModal = ({ post, onClose, onMutate }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.feedPostComments(post.id).then(setComments).catch(() => {});
    api.feedViewPost(post.id, getViewSession()).catch(() => {});
  }, [post.id]);

  const toggleLike = async () => {
    if (!user) { toast.error('Login to like'); nav('/login'); return; }
    try {
      const r = await api.feedLikePost(post.id);
      setLiked(r.liked); setLikes(r.likes_count);
      onMutate?.({ ...post, liked_by_me: r.liked, likes_count: r.likes_count });
    } catch (e) { toast.error(e.message); }
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
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-5xl max-h-[92vh] eh-panel grid grid-cols-1 md:grid-cols-[1fr_360px] overflow-hidden bg-[#0d1115]">
        <div className="bg-black flex items-center justify-center max-h-[60vh] md:max-h-[92vh]">
          <img src={post.image_url} className="max-w-full max-h-[60vh] md:max-h-[92vh] object-contain" alt="" />
        </div>
        <div className="flex flex-col h-[40vh] md:h-[92vh] border-l border-[var(--eh-border)]">
          <div className="flex items-center justify-between p-3 border-b border-[var(--eh-border)]">
            <div className="flex items-center gap-2 text-sm font-bold">errorhacker <BadgeCheck size={14} className="text-[#4de0ff]" /></div>
            <button onClick={onClose} className="opacity-70 hover:opacity-100"><X size={18} /></button>
          </div>
          {post.location && <div className="px-3 py-2 eh-mono text-[11px] opacity-70 flex items-center gap-1 border-b border-[var(--eh-border)]"><MapPin size={11} /> {post.location}</div>}
          <div className="flex-1 overflow-y-auto eh-scroll p-3">
            {post.caption && <div className="text-sm mb-4 leading-6"><span className="font-bold mr-2">errorhacker</span>{post.caption}</div>}
            <CommentList items={comments} />
          </div>
          <div className="border-t border-[var(--eh-border)] p-3">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={toggleLike} data-testid="post-like-btn" className="transition-transform active:scale-90"><Heart size={22} fill={liked ? '#ff2a3a' : 'none'} color={liked ? '#ff2a3a' : 'currentColor'} /></button>
              <MessageCircle size={22} />
            </div>
            <div className="eh-mono text-xs font-bold mb-1">{fmt(likes)} likes · {fmt(post.views_count)} views</div>
            <div className="eh-mono text-[10px] opacity-50 uppercase">{new Date(post.created_at).toLocaleDateString()}</div>
          </div>
          <form onSubmit={submit} className="border-t border-[var(--eh-border)] flex">
            <input value={text} onChange={e => setText(e.target.value)} data-testid="post-comment-input" placeholder={user ? 'Add a comment…' : 'Login to comment'} disabled={!user} className="flex-1 bg-transparent px-3 py-3 text-sm outline-none disabled:opacity-50" />
            <button data-testid="post-comment-submit" disabled={busy || !text.trim() || !user} className="px-4 text-[var(--eh-green)] font-bold disabled:opacity-30">Post</button>
          </form>
        </div>
      </div>
    </div>
  );
};

const ReelPlayer = ({ reel, onClose, onMutate }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(reel.liked_by_me);
  const [likes, setLikes] = useState(reel.likes_count);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    api.feedReelComments(reel.id).then(setComments).catch(() => {});
    api.feedViewReel(reel.id, getViewSession()).catch(() => {});
  }, [reel.id]);

  const toggleLike = async () => {
    if (!user) { toast.error('Login to like'); nav('/login'); return; }
    try {
      const r = await api.feedLikeReel(reel.id);
      setLiked(r.liked); setLikes(r.likes_count);
      onMutate?.({ ...reel, liked_by_me: r.liked, likes_count: r.likes_count });
    } catch (e) { toast.error(e.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user) { toast.error('Login to comment'); nav('/login'); return; }
    setBusy(true);
    try {
      const c = await api.feedAddReelComment(reel.id, text.trim());
      setComments(prev => [...prev, c]); setText('');
      onMutate?.({ ...reel, comments_count: (reel.comments_count || 0) + 1 });
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-md aspect-[9/16] max-h-[92vh] bg-black overflow-hidden rounded">
        <video ref={videoRef} src={reel.video_url} className="absolute inset-0 w-full h-full object-contain bg-black" autoPlay loop muted={muted} playsInline onClick={() => videoRef.current && (videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause())} />
        <button onClick={onClose} className="absolute top-3 left-3 w-9 h-9 grid place-items-center rounded-full bg-black/50 text-white z-10"><X size={18} /></button>
        <button onClick={() => setMuted(m => !m)} className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-full bg-black/50 text-white z-10">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
        {/* Right action rail */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-white z-10">
          <button onClick={toggleLike} data-testid="reel-like-btn" className="flex flex-col items-center gap-1 transition-transform active:scale-90">
            <Heart size={28} fill={liked ? '#ff2a3a' : 'none'} color={liked ? '#ff2a3a' : 'currentColor'} />
            <span className="text-[11px] font-bold">{fmt(likes)}</span>
          </button>
          <button onClick={() => setShowComments(true)} data-testid="reel-open-comments" className="flex flex-col items-center gap-1">
            <MessageCircle size={28} />
            <span className="text-[11px] font-bold">{fmt(comments.length)}</span>
          </button>
          <div className="flex flex-col items-center gap-1 opacity-90">
            <Eye size={26} />
            <span className="text-[11px] font-bold">{fmt(reel.views_count)}</span>
          </div>
        </div>
        {/* Bottom caption */}
        <div className="absolute bottom-0 left-0 right-0 p-3 pr-20 bg-gradient-to-t from-black/85 to-transparent text-white z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-bold text-sm">errorhacker</span>
            <BadgeCheck size={14} className="text-[#4de0ff]" />
          </div>
          {reel.caption && <div className="text-xs leading-5 opacity-95 line-clamp-2">{reel.caption}</div>}
        </div>
        {/* Comments slide-up */}
        {showComments && (
          <div className="absolute inset-0 bg-black/85 z-20 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-white/10 text-white">
              <div className="font-bold text-sm">Comments</div>
              <button onClick={() => setShowComments(false)}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto eh-scroll p-3 text-white"><CommentList items={comments} /></div>
            <form onSubmit={submit} className="border-t border-white/10 flex">
              <input value={text} onChange={e => setText(e.target.value)} placeholder={user ? 'Add a comment…' : 'Login to comment'} disabled={!user} className="flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none disabled:opacity-50" />
              <button disabled={busy || !text.trim() || !user} className="px-4 text-[var(--eh-green)] font-bold disabled:opacity-30">Post</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

const FeedPage = () => {
  const { config } = useSiteConfig();
  const profile = config.feedProfile || { username: 'errorhacker', displayName: config.site?.name || 'ERRORHACKER', bio: '', followers: 0, following: 0, verified: true };
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPost, setOpenPost] = useState(null);
  const [openReel, setOpenReel] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.feedListPosts(), api.feedListReels()])
      .then(([p, r]) => { setPosts(p); setReels(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const postCount = useMemo(() => posts.length, [posts]);
  const reelCount = useMemo(() => reels.length, [reels]);

  const updatePost = (p) => setPosts(prev => prev.map(x => x.id === p.id ? p : x));
  const updateReel = (r) => setReels(prev => prev.map(x => x.id === r.id ? r : x));

  return (
    <section className="min-h-[80vh] eh-grid-bg">
      <ProfileHeader profile={profile} postCount={postCount} reelCount={reelCount} brandLogo={config.site.logoUrl} />
      <div className="max-w-4xl mx-auto px-3 sm:px-5">
        <div className="flex justify-center border-b border-[var(--eh-border)]">
          <button onClick={() => setTab('posts')} data-testid="feed-tab-posts" className={`flex items-center gap-2 px-5 py-3 text-xs eh-mono tracking-widest uppercase ${tab === 'posts' ? 'text-[var(--eh-green)] border-t-2 border-[var(--eh-green)]' : 'opacity-70'}`}>
            <Grid3x3 size={14} /> POSTS
          </button>
          <button onClick={() => setTab('reels')} data-testid="feed-tab-reels" className={`flex items-center gap-2 px-5 py-3 text-xs eh-mono tracking-widest uppercase ${tab === 'reels' ? 'text-[var(--eh-green)] border-t-2 border-[var(--eh-green)]' : 'opacity-70'}`}>
            <Film size={14} /> REELS
          </button>
        </div>
        {loading ? (
          <div className="py-20 grid place-items-center opacity-70"><Loader2 className="animate-spin" /></div>
        ) : tab === 'posts' ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5 py-4">
            {posts.length === 0 && <div className="col-span-3 py-20 text-center opacity-60 eh-mono text-xs">No posts yet.</div>}
            {posts.map(p => <PostTile key={p.id} post={p} onOpen={setOpenPost} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-1.5 py-4">
            {reels.length === 0 && <div className="col-span-3 py-20 text-center opacity-60 eh-mono text-xs">No reels yet.</div>}
            {reels.map(r => <ReelTile key={r.id} reel={r} onOpen={setOpenReel} />)}
          </div>
        )}
      </div>
      {openPost && <PostModal post={openPost} onClose={() => setOpenPost(null)} onMutate={updatePost} />}
      {openReel && <ReelPlayer reel={openReel} onClose={() => setOpenReel(null)} onMutate={updateReel} />}
    </section>
  );
};

export default FeedPage;
