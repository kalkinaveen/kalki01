import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.authMe();
      setUser(res.user || null);
    } catch (_) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip /me check if we are about to process a Google session_id
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const r = await api.authLogin(email, password);
    if (r.token) localStorage.setItem('eh_user_token', r.token);
    setUser(r.user);
    return r.user;
  };
  const register = async (email, password, name) => {
    const r = await api.authRegister(email, password, name);
    if (r.token) localStorage.setItem('eh_user_token', r.token);
    setUser(r.user);
    return r.user;
  };
  const logout = async () => {
    try { await api.authLogout(); } catch (_) {}
    localStorage.removeItem('eh_user_token');
    setUser(null);
  };
  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/me';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  const exchangeGoogleSession = async (session_id) => {
    const r = await api.authGoogleSession(session_id);
    if (r.token) localStorage.setItem('eh_user_token', r.token);
    setUser(r.user);
    return r.user;
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, googleLogin, exchangeGoogleSession, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
