import React from 'react';
import { BOOKS } from '../mock';
import { ShoppingCart, Star } from 'lucide-react';
import { toast } from 'sonner';

const BooksPage = () => {
  const addToCart = (b) => {
    const cart = JSON.parse(localStorage.getItem('eh_cart') || '[]');
    cart.unshift({ ...b, addedAt: new Date().toISOString() });
    localStorage.setItem('eh_cart', JSON.stringify(cart));
    toast.success('Added to cart', { description: b.title });
  };
  return (
    <div className="pt-10 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 text-center mb-10">
        <div className="eh-kicker justify-center mb-3">// LIBRARY</div>
        <h1 className="eh-display text-4xl md:text-6xl font-black">HACKING <span className="eh-neon">EBOOKS</span></h1>
        <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm">Curated handbooks for ethical hackers, pentesters and curious minds. Instant PDF delivery.</p>
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {BOOKS.map(b => (
          <div key={b.id} className="eh-card eh-panel p-5">
            <div className="relative aspect-[3/4] rounded overflow-hidden mb-4 bg-black">
              <img src={b.cover} alt={b.title} className="w-full h-full object-cover opacity-90" />
              {b.tag && <span className="absolute top-2 left-2 eh-mono text-[10px] tracking-widest px-2 py-1 rounded" style={{ background:'var(--eh-green)', color:'#001a10' }}>{b.tag}</span>}
            </div>
            <div className="text-base font-semibold leading-snug mb-1" style={{ fontFamily:'Inter,sans-serif' }}>{b.title}</div>
            <div className="eh-mono text-xs opacity-70 mb-3">{b.author} · {b.pages} pages · {b.level}</div>
            <div className="flex items-center gap-1 mb-4">{Array.from({length:5}).map((_,i)=><Star key={i} size={12} fill="var(--eh-green)" color="var(--eh-green)" />)}<span className="eh-mono text-[11px] opacity-60 ml-1">(128)</span></div>
            <div className="flex items-center justify-between">
              <div className="eh-display text-2xl font-black eh-neon">${b.price}</div>
              <button onClick={() => addToCart(b)} className="eh-btn-ghost text-xs"><ShoppingCart size={14} /> ADD</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default BooksPage;
