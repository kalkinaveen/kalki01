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
    let detail = null;
    try {
      const j = await res.json();
      detail = j.detail;
      msg = (typeof j.detail === 'string' ? j.detail : (Array.isArray(j.detail) ? j.detail.map(d => d.msg).join(', ') : (j.detail?.message || msg)));
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
    err.detail = detail;       // preserve structured detail (used by 429 quota dialog)
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
  // telegram customer bot
  tgBotGet: () => req('/admin/telegram/bot', { admin: true }),
  tgBotSave: (data) => req('/admin/telegram/bot', { method: 'PUT', body: data, admin: true }),
  tgBotEnable: (backend_url) => req('/admin/telegram/bot/enable', { method: 'POST', body: { backend_url }, admin: true }),
  tgBotDisable: () => req('/admin/telegram/bot/disable', { method: 'POST', admin: true }),
  tgBotUsers: () => req('/admin/telegram/bot/users', { admin: true }),
  tgBotBroadcast: (message) => req('/admin/telegram/bot/broadcast', { method: 'POST', body: { message }, admin: true }),
  // wallet
  walletGet: () => req('/me/wallet', { auth: true }),
  walletTxns: () => req('/me/wallet/transactions', { auth: true }),
  walletTxn: (id) => req(`/me/wallet/transactions/${id}`, { auth: true }),
  walletDeposit: (data) => req('/me/wallet/deposit', { method: 'POST', body: data, auth: true }),
  payOrderWithWallet: (orderId) => req(`/me/orders/${orderId}/pay-with-wallet`, { method: 'POST', auth: true }),
  // Cashfree payment gateway
  cashfreeConfig: () => req('/payments/cashfree/config'),
  cashfreeTopup: (data) => req('/me/wallet/topup/cashfree', { method: 'POST', body: data, auth: true }),
  cashfreePayOrder: (orderId, data) => req(`/me/orders/${orderId}/pay/cashfree`, { method: 'POST', body: data || {}, auth: true }),
  cashfreeStatus: (cfOrderId) => req(`/payments/cashfree/orders/${cfOrderId}/status`),
  // refunds
  refundCreate: (data) => req('/me/refunds', { method: 'POST', body: data, auth: true }),
  refundsMine: () => req('/me/refunds', { auth: true }),
  refundMine: (id) => req(`/me/refunds/${id}`, { auth: true }),
  refundPublic: (id) => req(`/refunds/track/${id}`),
  adminRefunds: (status) => req(`/admin/refunds${status ? `?status=${status}` : ''}`, { admin: true }),
  adminRefundUpdate: (id, data) => req(`/admin/refunds/${id}`, { method: 'PATCH', body: data, admin: true }),
  adminRefundLookup: (trackingId) => req(`/admin/refunds/lookup/${encodeURIComponent(trackingId)}`, { admin: true }),
  adminRefundIssue: (data) => req('/admin/refunds/issue', { method: 'POST', body: data, admin: true }),
  adminWalletDeposits: (status) => req(`/admin/wallet/deposits${status ? `?status=${status}` : ''}`, { admin: true }),
  adminWalletApprove: (id) => req(`/admin/wallet/deposits/${id}/approve`, { method: 'POST', admin: true }),
  adminWalletReject: (id, reason = '') => req(`/admin/wallet/deposits/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, { method: 'POST', admin: true }),
  adminWalletAdjust: (uid, data) => req(`/admin/wallet/${uid}/adjust`, { method: 'POST', body: data, admin: true }),
  adminWallets: () => req('/admin/wallets', { admin: true }),
  // telegram admin chats (for deposit approvals)
  adminTgChatsGet: () => req('/admin/telegram/admin-chats', { admin: true }),
  adminTgChatsSet: (ids) => req('/admin/telegram/admin-chats', { method: 'PUT', body: { admin_chat_ids: ids }, admin: true }),
  adminTgChatsTest: () => req('/admin/telegram/admin-chats/test', { method: 'POST', admin: true }),
  // telegram bot /pay info (customizable payment block sent by the bot)
  adminTgPayInfoGet: () => req('/admin/telegram/payment-info', { admin: true }),
  adminTgPayInfoSet: (data) => req('/admin/telegram/payment-info', { method: 'PUT', body: data, admin: true }),
  adminTgPayInfoPreview: (data) => req('/admin/telegram/payment-info/preview', { method: 'POST', body: data, admin: true }),
  // spin wheel
  spinConfig: () => req('/spin/config'),
  spinConfigUpdate: (data) => req('/admin/spin/config', { method: 'PUT', body: data, admin: true }),
  spinStatus: () => req('/me/spin/status', { auth: true }),
  spinSpin: () => req('/me/spin/spin', { method: 'POST', body: {}, auth: true }),
  // works with
  worksWith: () => req('/works-with'),
  worksWithUpdate: (data) => req('/admin/works-with', { method: 'PUT', body: data, admin: true }),
  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const adminToken = localStorage.getItem('eh_admin_token');
    const r = await fetch(`${BACKEND_URL}/api/uploads`, { method: 'POST', body: fd, headers: { 'X-Admin-Token': adminToken || '' } });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || `Upload failed (${r.status})`); }
    return r.json();
  },
  // live ticker
  feedTicker: () => req('/feed-ticker'),
  // me ↔ telegram link
  meTelegramStatus: () => req('/me/telegram/status', { auth: true }),
  meTelegramLinkCode: () => req('/me/telegram/link-code', { method: 'POST', auth: true }),
  meTelegramUnlink: () => req('/me/telegram/unlink', { method: 'DELETE', auth: true }),
  // orders
  createOrder: (data) => req('/orders', { method: 'POST', body: data, auth: true }),
  listOrders: () => req('/orders', { admin: true }),
  getOrder: (id) => req(`/orders/${id}`),
  updateOrder: (id, status) => req(`/orders/${id}`, { method: 'PATCH', body: { status }, admin: true }),
  setOrderQuote: (id, data) => req(`/orders/${id}/set-quote`, { method: 'POST', body: data, admin: true }),
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
  // ai tools (auth=true so JWT cookie carries; lets backend track quota per user_id + deduct from wallet)
  toolsAppeal: (data) => req('/tools/appeal', { method: 'POST', body: data, auth: true }),
  toolsFaq: (session_id, message) => req('/tools/faq', { method: 'POST', body: { session_id, message }, auth: true }),
  toolsBreach: (email) => req('/tools/breach', { method: 'POST', body: { email }, auth: true }),
  toolsOdds: (data) => req('/tools/recovery-odds', { method: 'POST', body: data }),
  toolsPhishing: (data) => req('/tools/phishing-check', { method: 'POST', body: data, auth: true }),
  toolsAccountWorth: (data) => req('/tools/account-worth', { method: 'POST', body: data }),
  toolsSelfieCoach: (data) => req('/tools/selfie-coach', { method: 'POST', body: data }),
  toolsUsage: () => req('/tools/usage', { auth: true }),
  // announcements
  publicAnnouncements: () => req('/announcements'),
  adminListAnnouncements: () => req('/admin/announcements', { admin: true }),
  adminAnnouncementAudience: (audience) => req(`/admin/announcements/audience?audience=${encodeURIComponent(audience)}`, { admin: true }),
  adminCreateAnnouncement: (data) => req('/admin/announcements', { method: 'POST', body: data, admin: true }),
  adminDeleteAnnouncement: (id) => req(`/admin/announcements/${id}`, { method: 'DELETE', admin: true }),
  // payments
  getPaymentSettings: () => req('/payments/settings'),
  putPaymentSettings: (data) => req('/payments/settings', { method: 'PUT', body: data, admin: true }),
  submitPaymentProof: (data) => req('/payments/proof', { method: 'POST', body: data }),
  // SMM panel automation (admin)
  smmGetConfig: () => req('/admin/smm/config', { admin: true }),
  smmUpdateConfig: (data) => req('/admin/smm/config', { method: 'PUT', body: data, admin: true }),
  smmBalance: () => req('/admin/smm/balance', { admin: true }),
  smmSearchServices: (q, limit = 60) => req(`/admin/smm/services?q=${encodeURIComponent(q || '')}&limit=${limit}`, { admin: true }),
  smmLinkService: (sid, data) => req(`/admin/services/${sid}/smm-link`, { method: 'POST', body: data, admin: true }),
  smmUnlinkService: (sid) => req(`/admin/services/${sid}/smm-link`, { method: 'DELETE', admin: true }),
  smmPlaceOrder: (oid) => req(`/admin/orders/${oid}/smm-place`, { method: 'POST', admin: true }),
  smmPollOrder: (oid) => req(`/admin/orders/${oid}/smm-poll`, { method: 'POST', admin: true }),
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
  recoverySubmitPublicReview: (data) => req('/recovery/reviews/public', { method: 'POST', body: data }),
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
