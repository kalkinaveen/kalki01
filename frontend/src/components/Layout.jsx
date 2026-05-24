import React from 'react';
import Marquee from './Marquee';
import Navbar from './Navbar';
import Footer from './Footer';
import FloatingTelegram from './FloatingTelegram';
import ScrollProgress from './ScrollProgress';

const Layout = ({ children }) => (
  <div className="App eh-scanlines">
    <ScrollProgress />
    <Marquee />
    <Navbar />
    <main>{children}</main>
    <Footer />
    <FloatingTelegram />
  </div>
);
export default Layout;
