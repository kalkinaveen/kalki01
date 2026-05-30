// Simple API client for ERRORHACKER backend
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const getToken = () => localStorage.getItem('eh_admin_token') || '';

async function req(path, { method = 'GET', body, admin = false, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) headers['X-Admin-Token'] = getToken();
  const userTok = localStorage.getItem('eh_user_token');
  if (auth && userTok) headers['Authorization'] = `Bearer ${userTok}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = (typeof j.detail === 'string' ? j.detail : (Array.isArray(j.detail) ? j.detail.map(d => d.msg).join(', ') : msg));
    } catch (parseErr) {
      console.warn('api: failed to parse error body', parseErr);
    }
    if (admin && res.status === 401) {
      localStorage.removeItem('eh_admin_token');
      localStorage.removeItem('eh_admin');
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        setTimeout(() => window.location.reload(), 100);
      }
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  // config
  getConfig: () => req('/config'),
  putConfig: (data) => req('/config', { method: 'PUT', body: data, admin: true }),
  // admin
  login: (password) => req('/admin/login', { method: 'POST', body: { password } }),
  logout: () => req('/admin/logout', { method: 'POST', admin: true }).catch(() => null),
  changePassword: (new_password) => req('/admin/password', { method: 'POST', body: { new_password }, admin: true }),
  testTelegram: (bot_token, chat_id, message) => req('/admin/telegram/test', { method: 'POST', body: { bot_token, chat_id, message }, admin: true }),
  // orders
  createOrder: (data) => req('/orders', { method: 'POST', body: data, auth: true }),
  listOrders: () => req('/orders', { admin: true }),
  getOrder: (id) => req(`/orders/${id}`),
  updateOrder: (id, status) => req(`/orders/${id}`, { method: 'PATCH', body: { status }, admin: true }),
  clearOrders: () => req('/orders', { method: 'DELETE', admin: true }),
  myOrders: () => req('/me/orders', { auth: true }),
  // auth (customer)
  authRegister: (email, password, name, ref) => req('/auth/register', { method: 'POST', body: { email, password, name, ref } }),
  authLogin: (email, password) => req('/auth/login', { method: 'POST', body: { email, password } }),
  authLogout: () => req('/auth/logout', { method: 'POST' }),
  authMe: () => req('/auth/me', { auth: true }),
  authGoogleSession: (session_id) => req('/auth/google/session', { method: 'POST', body: { session_id } }),
  // coupons
  listCoupons: () => req('/coupons', { admin: true }),
  createCoupon: (data) => req('/coupons', { method: 'POST', body: data, admin: true }),
  updateCoupon: (code, data) => req(`/coupons/${code}`, { method: 'PATCH', body: data, admin: true }),
  deleteCoupon: (code) => req(`/coupons/${code}`, { method: 'DELETE', admin: true }),
  applyCoupon: (code, amount) => req('/coupons/apply', { method: 'POST', body: { code, amount } }),
  // chat
  chatSend: (session_id, message) => req('/chat/message', { method: 'POST', body: { session_id, message } }),
  // payments
  getPaymentSettings: () => req('/payments/settings'),
  putPaymentSettings: (data) => req('/payments/settings', { method: 'PUT', body: data, admin: true }),
  submitPaymentProof: (data) => req('/payments/proof', { method: 'POST', body: data }),
  // users (admin)
  listUsers: () => req('/admin/users', { admin: true }),
  deleteUser: (uid) => req(`/admin/users/${uid}`, { admin: true, method: 'DELETE' }),
  // referrals
  getReferralSettings: () => req('/referrals/settings'),
  putReferralSettings: (data) => req('/referrals/settings', { method: 'PUT', body: data, admin: true }),
  myReferrals: () => req('/me/referrals', { auth: true }),
  adminReferrals: () => req('/admin/referrals', { admin: true }),
  // feed
  feedListPosts: () => req('/feed/posts'),
  feedGetPost: (id) => req(`/feed/posts/${id}`),
  feedCreatePost: (data) => req('/feed/posts', { method: 'POST', body: data, admin: true }),
  feedUpdatePost: (id, data) => req(`/feed/posts/${id}`, { method: 'PATCH', body: data, admin: true }),
  feedDeletePost: (id) => req(`/feed/posts/${id}`, { method: 'DELETE', admin: true }),
  feedListReels: () => req('/feed/reels'),
  feedCreateReel: (data) => req('/feed/reels', { method: 'POST', body: data, admin: true }),
  feedUpdateReel: (id, data) => req(`/feed/reels/${id}`, { method: 'PATCH', body: data, admin: true }),
  feedDeleteReel: (id) => req(`/feed/reels/${id}`, { method: 'DELETE', admin: true }),
  feedLikePost: (id) => req(`/feed/posts/${id}/like`, { method: 'POST', auth: true }),
  feedLikeReel: (id) => req(`/feed/reels/${id}/like`, { method: 'POST', auth: true }),
  feedViewPost: (id, session_id) => req(`/feed/posts/${id}/view`, { method: 'POST', body: { session_id } }),
  feedViewReel: (id, session_id) => req(`/feed/reels/${id}/view`, { method: 'POST', body: { session_id } }),
  feedPostComments: (id) => req(`/feed/posts/${id}/comments`),
  feedReelComments: (id) => req(`/feed/reels/${id}/comments`),
  feedAddPostComment: (id, text) => req(`/feed/posts/${id}/comments`, { method: 'POST', body: { text }, auth: true }),
  feedAddReelComment: (id, text) => req(`/feed/reels/${id}/comments`, { method: 'POST', body: { text }, auth: true }),
  feedAddAdminComment: (data) => req('/feed/comments/admin', { method: 'POST', body: data, admin: true }),
  feedDeleteComment: (id) => req(`/feed/comments/${id}`, { method: 'DELETE', admin: true }),
  feedUploadMedia: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/feed/upload-media`, {
      method: 'POST',
      headers: { 'X-Admin-Token': getToken() },
      body: fd,
    });
    if (!res.ok) {
      let m = `HTTP ${res.status}`;
      try { const j = await res.json(); m = j.detail || m; } catch (parseErr) { console.warn('upload: error parsing response', parseErr); }
      throw new Error(m);
    }
    const data = await res.json();
    return { ...data, absoluteUrl: `${BACKEND_URL}${data.url}` };
  },
  // recovery
  recoveryConfig: () => req('/recovery/config'),
  recoveryConfigUpdate: (data) => req('/recovery/config', { method: 'PUT', body: data, admin: true }),
  recoveryCreateCase: (data) => req('/recovery/cases', { method: 'POST', body: data }),
  recoveryListCases: () => req('/recovery/cases', { admin: true }),
  recoveryGetCase: (id) => req(`/recovery/cases/${id}`),
  recoveryUpdateCase: (id, data) => req(`/recovery/cases/${id}`, { method: 'PATCH', body: data, admin: true }),
  recoveryDeleteCase: (id) => req(`/recovery/cases/${id}`, { method: 'DELETE', admin: true }),
  recoverySendPayment: (id, data) => req(`/recovery/cases/${id}/send-payment`, { method: 'POST', body: data, admin: true }),
  recoveryListReviews: (svc) => req(`/recovery/reviews${svc ? `?service_key=${svc}` : ''}`),
  recoveryListReviewsAll: () => req('/recovery/reviews?all=true', { admin: true }),
  recoveryCreateReview: (data) => req('/recovery/reviews', { method: 'POST', body: data, admin: true }),
  recoveryUpdateReview: (id, data) => req(`/recovery/reviews/${id}`, { method: 'PATCH', body: data, admin: true }),
  recoveryDeleteReview: (id) => req(`/recovery/reviews/${id}`, { method: 'DELETE', admin: true }),
  recoveryStats: () => req('/recovery/stats'),
  recoveryUploadProof: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${BACKEND_URL}/api/recovery/upload-proof`, { method: 'POST', body: fd });
    if (!r.ok) { const e = await r.json().catch(() => ({})); const err = new Error(e.detail || `Upload failed (${r.status})`); err.status = r.status; throw err; }
    const data = await r.json();
    return { ...data, absoluteUrl: `${BACKEND_URL}${data.url}` };
  },
  recoveryCanReview: (caseId) => req(`/recovery/cases/${caseId}/can-review`),
  recoverySubmitReview: (data) => req('/recovery/reviews/submit', { method: 'POST', body: data }),
  recoveryUploadReviewMedia: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${BACKEND_URL}/api/recovery/reviews/upload-media`, { method: 'POST', body: fd });
    if (!r.ok) { const e = await r.json().catch(() => ({})); const err = new Error(e.detail || `Upload failed (${r.status})`); err.status = r.status; throw err; }
    const data = await r.json();
    return { ...data, absoluteUrl: `${BACKEND_URL}${data.url}` };
  },
  // team management (owner only)
  teamList: () => req('/admin/team', { admin: true }),
  teamAdd: (data) => req('/admin/team', { method: 'POST', body: data, admin: true }),
  teamUpdate: (id, data) => req(`/admin/team/${id}`, { method: 'PATCH', body: data, admin: true }),
  teamRemove: (id) => req(`/admin/team/${id}`, { method: 'DELETE', admin: true }),
  auditList: () => req('/admin/audit', { admin: true }),
  // feed hide / restore
  feedHidePost: (id) => req(`/feed/posts/${id}/hide`, { method: 'POST', admin: true }),
  feedRestorePost: (id) => req(`/feed/posts/${id}/restore`, { method: 'POST', admin: true }),
  feedTrashPosts: () => req('/feed/posts/trash', { admin: true }),
  feedHideReel: (id) => req(`/feed/reels/${id}/hide`, { method: 'POST', admin: true }),
  feedRestoreReel: (id) => req(`/feed/reels/${id}/restore`, { method: 'POST', admin: true }),
  feedTrashReels: () => req('/feed/reels/trash', { admin: true }),
  // uploads
  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/uploads`, {
      method: 'POST',
      headers: { 'X-Admin-Token': getToken() },
      body: fd,
    });
    if (!res.ok) {
      let m = `HTTP ${res.status}`;
      try { const j = await res.json(); m = j.detail || m; } catch (parseErr) { console.warn('upload: error parsing response', parseErr); }
      throw new Error(m);
    }
    const data = await res.json();
    return { ...data, absoluteUrl: `${BACKEND_URL}${data.url}` };
  },
};
