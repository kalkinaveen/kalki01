import React from 'react';
import Marquee from './Marquee';
import Navbar from './Navbar';
import Footer from './Footer';
import FloatingTelegram from './FloatingTelegram';

const Layout = ({ children }) => (
  <div className="App eh-scanlines">
    <Marquee />
    <Navbar />
    <main>{children}</main>
    <Footer />
    <FloatingTelegram />
  </div>
);
export default Layout;
