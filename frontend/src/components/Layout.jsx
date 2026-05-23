import React from 'react';
import Marquee from './Marquee';
import Navbar from './Navbar';
import Footer from './Footer';
import FloatingTelegram from './FloatingTelegram';
import HelpChat from './HelpChat';
import ScrollProgress from './ScrollProgress';

const Layout = ({ children }) => (
  <div className="App eh-scanlines">
    <ScrollProgress />
    <Marquee />
    <Navbar />
    <main>{children}</main>
    <Footer />
    <HelpChat />
    <FloatingTelegram />
  </div>
);
export default Layout;
