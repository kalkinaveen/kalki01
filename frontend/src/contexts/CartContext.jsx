import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartCtx = createContext(null);
const KEY = 'eh_cart_v2';

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } };
const save = (items) => localStorage.setItem(KEY, JSON.stringify(items));

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(load);
  useEffect(() => { save(items); }, [items]);

  const add = useCallback((item) => {
    setItems(prev => {
      const exists = prev.find(p => p.id === item.id && p.type === item.type);
      if (exists) return prev.map(p => (p.id === item.id && p.type === item.type) ? { ...p, qty: (p.qty || 1) + (item.qty || 1) } : p);
      return [...prev, { ...item, qty: item.qty || 1, addedAt: new Date().toISOString() }];
    });
  }, []);
  const remove = useCallback((id, type) => setItems(prev => prev.filter(p => !(p.id === id && p.type === type))), []);
  const updateQty = useCallback((id, type, qty) => setItems(prev => prev.map(p => (p.id === id && p.type === type) ? { ...p, qty: Math.max(1, qty) } : p)), []);
  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((s, i) => s + (i.qty || 1), 0), [items]);
  const total = useMemo(() => items.reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0), [items]);

  return <CartCtx.Provider value={{ items, count, total, add, remove, updateQty, clear }}>{children}</CartCtx.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
