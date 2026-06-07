import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './contexts/ThemeContext';
import { SiteConfigProvider } from './contexts/SiteConfigContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/Layout';
import BootScreen from './components/BootScreen';
import Home from './pages/Home';
import ServicesPage from './pages/ServicesPage';
import ServiceDetail from './pages/ServiceDetail';
import BooksPage from './pages/BooksPage';
import MembershipsPage from './pages/MembershipsPage';
import RecoveryPage from './pages/RecoveryPage';
import BlogsPage from './pages/BlogsPage';
import ToolsPage from './pages/ToolsPage';
import InfoPage from './pages/InfoPage';
import OrderTracker from './pages/OrderTracker';
import FAQPage from './pages/FAQPage';
import NotFound from './pages/NotFound';
import AdminPanel from './pages/AdminPanel';
import FontPreview from './pages/FontPreview';
import Login from './pages/Login';
import Signup from './pages/Signup';
import MyAccount from './pages/MyAccount';
import MyWallet from './pages/MyWallet';
import SpinWheel from './pages/SpinWheel';
import OrderDetail from './pages/OrderDetail';
import ReferralsPage from './pages/ReferralsPage';
import CartPage from './pages/CartPage';
import FeedPage from './pages/FeedPage';
import ScrollToTop from './components/ScrollToTop';
import Analytics from './components/Analytics';

const SiteShell = ({ children }) => <Layout>{children}</Layout>;

const BootGate = () => {
  const location = useLocation();
  const [booted, setBooted] = useState(() => sessionStorage.getItem('eh_booted') === '1');
  // Auto-skip boot for admin route
  useEffect(() => {
    if ((location.pathname.startsWith('/admin') || location.pathname.startsWith('/fonts') || location.pathname.startsWith('/login') || location.pathname.startsWith('/signup') || location.pathname.startsWith('/me')) && !booted) {
      sessionStorage.setItem('eh_booted', '1');
      setBooted(true);
    }
  }, [location.pathname, booted]);
  if (booted) return null;
  return <BootScreen onDone={() => { sessionStorage.setItem('eh_booted', '1'); setBooted(true); }} />;
};

function App() {
  return (
    <ThemeProvider>
      <SiteConfigProvider>
        <AuthProvider>
          <CartProvider>
          <div className="App">
            <BrowserRouter>
              <ScrollToTop />
              <Analytics />
              <BootGate />
              <Routes>
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/fonts" element={<FontPreview />} />
                <Route path="/login" element={<SiteShell><Login /></SiteShell>} />
                <Route path="/signup" element={<SiteShell><Signup /></SiteShell>} />
                <Route path="/me" element={<SiteShell><MyAccount /></SiteShell>} />
                <Route path="/me/wallet" element={<SiteShell><MyWallet /></SiteShell>} />
                <Route path="/me/spin" element={<SiteShell><SpinWheel /></SiteShell>} />
                <Route path="/me/orders/:id" element={<SiteShell><OrderDetail /></SiteShell>} />
                <Route path="/me/referrals" element={<SiteShell><ReferralsPage /></SiteShell>} />
                <Route path="/cart" element={<SiteShell><CartPage /></SiteShell>} />
                <Route path="/feed" element={<SiteShell><FeedPage /></SiteShell>} />
                <Route path="/feed/p/:postId" element={<SiteShell><FeedPage /></SiteShell>} />
                <Route path="/feed/r/:reelId" element={<SiteShell><FeedPage /></SiteShell>} />
                <Route path="/" element={<SiteShell><Home /></SiteShell>} />
                <Route path="/services" element={<SiteShell><ServicesPage /></SiteShell>} />
                <Route path="/services/:id" element={<SiteShell><ServiceDetail /></SiteShell>} />
                <Route path="/books" element={<SiteShell><BooksPage /></SiteShell>} />
                <Route path="/memberships" element={<SiteShell><MembershipsPage /></SiteShell>} />
                <Route path="/recovery" element={<SiteShell><RecoveryPage /></SiteShell>} />
                <Route path="/blogs" element={<SiteShell><RecoveryPage /></SiteShell>} />
                <Route path="/blog" element={<SiteShell><RecoveryPage /></SiteShell>} />
                <Route path="/tools" element={<SiteShell><ToolsPage /></SiteShell>} />
                <Route path="/track" element={<SiteShell><OrderTracker /></SiteShell>} />
                <Route path="/faq" element={<SiteShell><FAQPage /></SiteShell>} />
                <Route path="/info" element={<SiteShell><InfoPage /></SiteShell>} />
                <Route path="*" element={<SiteShell><NotFound /></SiteShell>} />
              </Routes>
            </BrowserRouter>
            <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: '#0d1115', color: '#d6e2dc', border: '1px solid #1a2128' } }} />
          </div>
          </CartProvider>
        </AuthProvider>
      </SiteConfigProvider>
    </ThemeProvider>
  );
}
export default App;
