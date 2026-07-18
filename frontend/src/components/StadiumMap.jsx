import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

const API_BASE = 'http://localhost:3001';

const STATUS_COLORS = {
  normal: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  closed: '#6b7280',
};

export default function StadiumMap({ onZoneSelect }) {
  const { socket, isConnected } = useSocket();
  const [zones, setZones] = useState([]);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/zones`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setZones(data.zones || []);
      } catch (err) {
        console.error('Failed to fetch zones:', err);
      }
    };

    fetchZones();

    if (socket) {
      socket.on('zones:updated', () => fetchZones());

      socket.on('alert:new', (alert) => {
        if (alert.zone_id) {
          setZones(prev => prev.map(z =>
            z.id === alert.zone_id
              ? { ...z, status: alert.severity === 'critical' ? 'critical' : 'warning' }
              : z
          ));
        }
      });

      socket.on('demo:completed', () => fetchZones());
    }

    return () => {
      if (socket) {
        socket.off('zones:updated');
        socket.off('alert:new');
        socket.off('demo:completed');
      }
    };
  }, [socket]);

  const getStatusColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.normal;

  return (
    <div className="stadium-map glass-panel relative" style={{ height: '100%', minHeight: '400px' }}>
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ minHeight: '100%' }}>
        <defs>
          <radialGradient id="field-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.1" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Stadium oval outline */}
        <ellipse cx="50" cy="50" rx="45" ry="42" fill="none" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="0.8" />
        <ellipse cx="50" cy="50" rx="35" ry="30" fill="none" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="0.5" />

        {/* Field */}
        <rect x="38" y="38" width="24" height="24" rx="3" fill="url(#field-gradient)" stroke="rgba(52, 211, 153, 0.6)" strokeWidth="0.5" />
        <line x1="50" y1="38" x2="50" y2="62" stroke="rgba(52, 211, 153, 0.4)" strokeWidth="0.3" />
        <circle cx="50" cy="50" r="4" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.2" />

        {/* Zones */}
        {zones.map(zone => {
          const color = getStatusColor(zone.status);
          const isCritical = zone.status === 'critical';
          const isWarning = zone.status === 'warning';
          const occupancyPct = zone.capacity > 0 ? Math.round((zone.current_occupancy / zone.capacity) * 100) : 0;
          const radius = zone.type === 'gate' ? 2.5 : zone.type === 'section' ? 3.5 : 3;

          return (
            <g
              key={zone.id}
              transform={`translate(${zone.coord_x}, ${zone.coord_y})`}
              onClick={() => onZoneSelect && onZoneSelect(zone)}
              className="map-zone"
              style={{ cursor: onZoneSelect ? 'pointer' : 'default' }}
            >
              {/* Pulse ring for critical/warning */}
              {(isCritical || isWarning) && (
                <circle r={radius + 2} fill="none" stroke={color} strokeWidth="0.3" opacity="0.5">
                  <animate attributeName="r" from={radius + 1} to={radius + 4} dur={isCritical ? '1s' : '2s'} repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur={isCritical ? '1s' : '2s'} repeatCount="indefinite" />
                </circle>
              )}

              {/* Zone circle */}
              <circle
                r={radius}
                fill={color}
                opacity={isCritical ? 0.9 : isWarning ? 0.7 : 0.4}
                filter={isCritical ? 'url(#glow)' : undefined}
              />

              {/* Zone label */}
              <text
                y={-radius - 1.5}
                textAnchor="middle"
                fill="white"
                fontSize="2.4"
                fontWeight="600"
                opacity="0.85"
                style={{ pointerEvents: 'none' }}
              >
                {zone.name.replace(/ \(.*\)/, '').split(' ').slice(0, 2).join(' ')}
              </text>

              {/* Occupancy label */}
              <text
                y={1}
                textAnchor="middle"
                fill="white"
                fontSize="2"
                fontWeight="700"
                opacity="0.9"
                style={{ pointerEvents: 'none' }}
              >
                {occupancyPct}%
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(3, 90)">
          <circle cx="0" cy="0" r="1" fill="#10b981" opacity="0.5" />
          <text x="2.5" y="0.8" fill="white" fontSize="2" opacity="0.6">Normal</text>
          <circle cx="15" cy="0" r="1" fill="#f59e0b" opacity="0.7" />
          <text x="17.5" y="0.8" fill="white" fontSize="2" opacity="0.6">Warning</text>
          <circle cx="32" cy="0" r="1" fill="#ef4444" opacity="0.9" />
          <text x="34.5" y="0.8" fill="white" fontSize="2" opacity="0.6">Critical</text>
        </g>
      </svg>

      {!isConnected && (
        <div className="absolute top-2 right-2 badge badge-warning">
          Connecting to live map...
        </div>
      )}
    </div>
  );
}
