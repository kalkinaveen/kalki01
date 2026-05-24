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
    try { const j = await res.json(); msg = (typeof j.detail === 'string' ? j.detail : (Array.isArray(j.detail) ? j.detail.map(d => d.msg).join(', ') : msg)); } catch (_) {}
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
  authRegister: (email, password, name) => req('/auth/register', { method: 'POST', body: { email, password, name } }),
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
  // uploads
  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/uploads`, {
      method: 'POST',
      headers: { 'X-Admin-Token': getToken() },
      body: fd,
    });
    if (!res.ok) { let m = `HTTP ${res.status}`; try { const j = await res.json(); m = j.detail || m; } catch (_) {} throw new Error(m); }
    const data = await res.json();
    return { ...data, absoluteUrl: `${BACKEND_URL}${data.url}` };
  },
};
