// Simple API client for ERRORHACKER backend
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const getToken = () => localStorage.getItem('eh_admin_token') || '';

async function req(path, { method = 'GET', body, admin = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) headers['X-Admin-Token'] = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.detail || msg; } catch (_) {}
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
  createOrder: (data) => req('/orders', { method: 'POST', body: data }),
  listOrders: () => req('/orders', { admin: true }),
  getOrder: (id) => req(`/orders/${id}`),
  updateOrder: (id, status) => req(`/orders/${id}`, { method: 'PATCH', body: { status }, admin: true }),
  clearOrders: () => req('/orders', { method: 'DELETE', admin: true }),
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
    // Build absolute URL for public use
    return { ...data, absoluteUrl: `${BACKEND_URL}${data.url}` };
  },
};
