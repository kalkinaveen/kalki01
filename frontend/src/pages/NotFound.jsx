import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Terminal } from 'lucide-react';

const NotFound = () => (
  <div className="min-h-[70vh] flex items-center justify-center px-4 py-20 eh-grid-bg">
    <div className="text-center">
      <div className="eh-brand font-black eh-neon mb-4" style={{ fontSize: 'clamp(5rem, 22vw, 14rem)', lineHeight: 1 }}>404</div>
      <div className="eh-mono text-sm tracking-widest opacity-70 mb-2">// SIGNAL_LOST</div>
      <h1 className="eh-display text-2xl sm:text-3xl font-black mb-4">THIS PATH IS <span className="eh-neon">ENCRYPTED</span></h1>
      <p className="opacity-70 mb-8 max-w-md mx-auto text-sm">The page you were looking for has been moved, deleted, or never existed in our reality.</p>
      <div className="flex gap-3 justify-center flex-col sm:flex-row">
        <Link to="/" className="eh-btn-primary text-xs"><Home size={14} /> RETURN HOME</Link>
        <Link to="/services" className="eh-btn-ghost text-xs"><Terminal size={14} /> SERVICES</Link>
      </div>
    </div>
  </div>
);
export default NotFound;
