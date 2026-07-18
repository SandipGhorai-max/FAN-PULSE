import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import FanView from './views/FanView';
import VolunteerView from './views/VolunteerView';
import OpsView from './views/OpsView';
import PABanner from './components/PABanner';
import { Activity } from 'lucide-react';

function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <div className="app-container">
          <PABanner />
          <header className="app-header" role="banner">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="FanPulse AI - FIFA World Cup 2026"
                style={{
                  height: '44px',
                  width: '44px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  filter: 'drop-shadow(0 0 8px rgba(0, 212, 180, 0.6))',
                }}
              />
              <div className="h-6 w-px bg-gray-500 opacity-50" aria-hidden="true"></div>
              <div className="flex items-center gap-2">
                <Activity className="text-primary" size={20} aria-hidden="true" />
                <h1 className="text-gradient uppercase tracking-widest text-xl font-bold">FanPulse AI</h1>
              </div>
            </div>
            <nav className="nav-links" aria-label="Main Navigation">
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} aria-current={({ isActive }) => (isActive ? 'page' : undefined)}>
                Fan
              </NavLink>
              <NavLink to="/volunteer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} aria-current={({ isActive }) => (isActive ? 'page' : undefined)}>
                Volunteer
              </NavLink>
              <NavLink to="/ops" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} aria-current={({ isActive }) => (isActive ? 'page' : undefined)}>
                Ops Command
              </NavLink>
            </nav>
            <div className="flex items-center gap-4">
              <div className="badge badge-normal flex items-center gap-1" role="status" aria-live="polite">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true"></span>
                System Live
              </div>
            </div>
          </header>

          <main className="main-content">
            <Routes>
              <Route path="/" element={<FanView />} />
              <Route path="/volunteer" element={<VolunteerView />} />
              <Route path="/ops" element={<OpsView />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;
