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
          <header className="app-header">
            <div className="flex items-center gap-2">
              <Activity className="text-primary" size={28} />
              <h1 className="text-gradient">FanPulse AI</h1>
            </div>
            <nav className="nav-links">
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Fan
              </NavLink>
              <NavLink to="/volunteer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Volunteer
              </NavLink>
              <NavLink to="/ops" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Ops Command
              </NavLink>
            </nav>
            <div className="flex items-center gap-4">
              <div className="badge badge-normal flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
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
