import React, { useState, useEffect } from 'react';

// FIFA World Cup 2026 Opening Ceremony: June 11, 2026
const TARGET_DATE = new Date('2026-06-11T18:00:00Z');

function getTimeLeft() {
  const diff = TARGET_DATE - new Date();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const MATCHES = [
  { time: 'Jun 12', teams: '🇺🇸 USA vs 🇲🇽 Mexico', venue: 'MetLife Stadium', status: 'UPCOMING' },
  { time: 'Jun 15', teams: '🇧🇷 Brazil vs 🇦🇷 Argentina', venue: 'SoFi Stadium', status: 'UPCOMING' },
  { time: 'Jun 18', teams: '🇩🇪 Germany vs 🇫🇷 France', venue: 'AT&T Stadium', status: 'UPCOMING' },
  { time: 'Jun 22', teams: '🇵🇹 Portugal vs 🇪🇸 Spain', venue: 'Rose Bowl', status: 'UPCOMING' },
];

const FACTS = [
  '🏟️ 48 Nations will compete across 16 host cities',
  '⚽ 104 matches total — the biggest World Cup ever',
  '🌎 Hosted by USA, Canada & Mexico',
  '👥 Over 5 million fans expected to attend',
  '📺 4 billion viewers worldwide',
];

export default function HeroSection() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const f = setInterval(() => setFactIndex(i => (i + 1) % FACTS.length), 3500);
    return () => clearInterval(f);
  }, []);

  return (
    <div className="hero-section">
      {/* === HERO IMAGE === */}
      <div className="hero-image-wrap">
        <img src="/worldcup_hero.png" alt="FIFA World Cup 2026 Stadium" className="hero-bg-img" />
        <div className="hero-overlay" />
        {/* Logo + title over image */}
        <div className="hero-center-content">
          <img src="/logo.png" alt="FanPulse AI Logo" className="hero-logo-big" />
          <h2 className="hero-title">FIFA World Cup 2026™</h2>
          <p className="hero-subtitle">The Greatest Show on Earth — Powered by AI</p>
        </div>
      </div>

      {/* === COUNTDOWN TIMER === */}
      <div className="countdown-bar">
        <p className="countdown-label">⏱️ Opening Ceremony Countdown</p>
        <div className="countdown-grid">
          {[['days', 'Days'], ['hours', 'Hours'], ['minutes', 'Min'], ['seconds', 'Sec']].map(([key, label]) => (
            <div key={key} className="countdown-unit">
              <span className="countdown-num">{String(timeLeft[key]).padStart(2, '0')}</span>
              <span className="countdown-lbl">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* === QUICK STATS === */}
      <div className="hero-stats-row">
        <div className="hero-stat"><span className="hero-stat-num">48</span><span className="hero-stat-lbl">Nations</span></div>
        <div className="hero-stat-divider" />
        <div className="hero-stat"><span className="hero-stat-num">16</span><span className="hero-stat-lbl">Host Cities</span></div>
        <div className="hero-stat-divider" />
        <div className="hero-stat"><span className="hero-stat-num">104</span><span className="hero-stat-lbl">Matches</span></div>
        <div className="hero-stat-divider" />
        <div className="hero-stat"><span className="hero-stat-num">5M+</span><span className="hero-stat-lbl">Fans</span></div>
        <div className="hero-stat-divider" />
        <div className="hero-stat"><span className="hero-stat-num">8</span><span className="hero-stat-lbl">AI Agents</span></div>
      </div>

      {/* === MATCH SCHEDULE PREVIEW === */}
      <div className="match-schedule-section">
        <h3 className="section-sub-title">📅 Upcoming Matches</h3>
        <div className="match-cards-row">
          {MATCHES.map((m, i) => (
            <div key={i} className="match-card">
              <div className="match-card-date">{m.time}</div>
              <div className="match-card-teams">{m.teams}</div>
              <div className="match-card-venue">📍 {m.venue}</div>
              <div className="match-card-status">{m.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* === ROTATING FACTS === */}
      <div className="facts-ticker">
        <span className="facts-icon">ℹ️</span>
        <span key={factIndex} className="facts-text animate-fade-in">{FACTS[factIndex]}</span>
      </div>
    </div>
  );
}
