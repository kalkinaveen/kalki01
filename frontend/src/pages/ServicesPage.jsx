import React from 'react';
import Services from '../components/Services';

const ServicesPage = () => (
  <div className="pt-10">
    <div className="max-w-7xl mx-auto px-4 md:px-6 text-center mb-4">
      <div className="eh-kicker justify-center mb-3">// ALL SERVICES</div>
      <h1 className="eh-display text-4xl md:text-6xl font-black">CHOOSE YOUR <span className="eh-neon">WEAPON</span></h1>
      <p className="opacity-70 mt-4 max-w-xl mx-auto text-sm">All operations are routed through encrypted channels. Manual delivery. No bots.</p>
    </div>
    <Services />
  </div>
);
export default ServicesPage;
