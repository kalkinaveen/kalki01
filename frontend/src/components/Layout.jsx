import React from 'react';
import { useLocation } from 'react-router-dom';
import Marquee from './Marquee';
import Navbar from './Navbar';
import Footer from './Footer';
import FloatingStack from './FloatingStack';
import ScrollProgress from './ScrollProgress';

const Layout = ({ children }) => {
  const { pathname } = useLocation();
  const isFeed = pathname.startsWith('/feed');
  return (
    <div className="App eh-scanlines">
      <ScrollProgress />
      {!isFeed && <Marquee />}
      <Navbar />
      <main>{children}</main>
      {!isFeed && <Footer />}
      <FloatingStack />
    </div>
  );
};
export default Layout;
