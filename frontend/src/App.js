import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import BootScreen from './components/BootScreen';
import Home from './pages/Home';
import ServicesPage from './pages/ServicesPage';
import ServiceDetail from './pages/ServiceDetail';
import BooksPage from './pages/BooksPage';
import MembershipsPage from './pages/MembershipsPage';
import BlogsPage from './pages/BlogsPage';
import ToolsPage from './pages/ToolsPage';
import InfoPage from './pages/InfoPage';
import AdminPanel from './pages/AdminPanel';

const SiteShell = ({ children }) => <Layout>{children}</Layout>;

function App() {
  const [booted, setBooted] = useState(() => sessionStorage.getItem('eh_booted') === '1');
  useEffect(() => { if(booted) sessionStorage.setItem('eh_booted','1'); }, [booted]);
  return (
    <ThemeProvider>
      <div className="App">
        {!booted && <BootScreen onDone={() => setBooted(true)} />}
        <BrowserRouter>
          <Routes>
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/" element={<SiteShell><Home /></SiteShell>} />
            <Route path="/services" element={<SiteShell><ServicesPage /></SiteShell>} />
            <Route path="/services/:id" element={<SiteShell><ServiceDetail /></SiteShell>} />
            <Route path="/books" element={<SiteShell><BooksPage /></SiteShell>} />
            <Route path="/memberships" element={<SiteShell><MembershipsPage /></SiteShell>} />
            <Route path="/blogs" element={<SiteShell><BlogsPage /></SiteShell>} />
            <Route path="/tools" element={<SiteShell><ToolsPage /></SiteShell>} />
            <Route path="/info" element={<SiteShell><InfoPage /></SiteShell>} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: '#0d1115', color: '#d6e2dc', border: '1px solid #1a2128' } }} />
      </div>
    </ThemeProvider>
  );
}
export default App;
