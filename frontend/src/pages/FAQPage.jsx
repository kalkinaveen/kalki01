import React from 'react';
import FAQ from '../components/FAQ';

const FAQPage = () => (
  <div className="pt-10 pb-10">
    <div className="max-w-7xl mx-auto px-4 md:px-6 text-center mb-4">
      <div className="eh-kicker justify-center mb-3">// KNOWLEDGE_BASE</div>
      <h1 className="eh-display font-black" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}>QUESTIONS, <span className="eh-neon">ANSWERED</span></h1>
      <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm">All the most asked questions in one place.</p>
    </div>
    <FAQ />
  </div>
);
export default FAQPage;
