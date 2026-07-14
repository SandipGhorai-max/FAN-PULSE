import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import StadiumMap from '../components/StadiumMap';
import { ShieldAlert, Leaf, CheckCircle, Play, RotateCcw, Zap } from 'lucide-react';

const API_BASE = 'http://localhost:3001';

export default function OpsView() {
  const { socket, isConnected } = useSocket();
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState({ carbon: 0, transit: 0, recycling: 0, greenScore: 0 });
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(null);

  useEffect(() => {
    // Fetch initial sustainability metrics
    fetch(`${API_BASE}/api/sustainability`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        // data.metrics is an Object keyed by metric_type, not an Array
        const m = data.metrics || {};
        setMetrics({
          carbon: m.total_carbon_saved_kg?.value || 0,
          transit: m.fans_using_transit?.value || 0,
          recycling: m.waste_recycled_pct?.value || 0,
          greenScore: data.overallScore || 0,
        });
      })
      .catch(err => console.error('Sustainability fetch error:', err));

    // Fetch initial alerts
    fetch(`${API_BASE}/api/alerts`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setAlerts(data.alerts || []))
      .catch(err => console.error('Alerts fetch error:', err));
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('alert:new', (alert) => {
      setAlerts(prev => [alert, ...prev.filter(a => a.id !== alert.id)]);
    });

    socket.on('demo:started', () => {
      setDemoRunning(true);
      setDemoStep(null);
    });

    socket.on('demo:step', (step) => {
      setDemoStep(step);
      // If step contains an alert, add it
      if (step.alert) {
        setAlerts(prev => [step.alert, ...prev.filter(a => a.id !== step.alert.id)]);
      }
    });

    socket.on('demo:completed', (data) => {
      setDemoRunning(false);
      setDemoStep({ step: 8, title: '🎉 Demo Complete!', description: data.message });
      // Refresh alerts
      fetch(`${API_BASE}/api/alerts`)
        .then(res => res.json())
        .then(d => setAlerts(d.alerts || []))
        .catch(() => {});
    });

    socket.on('demo:reset', () => {
      setAlerts([]);
      setDemoStep(null);
      setDemoRunning(false);
    });

    socket.on('mitigation:options', ({ alertId, options }) => {
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, options } : a
      ));
    });

    socket.on('mitigation:selected', () => {
      // Refresh alerts to show selected state
    });

    return () => {
      socket.off('alert:new');
      socket.off('demo:started');
      socket.off('demo:step');
      socket.off('demo:completed');
      socket.off('demo:reset');
      socket.off('mitigation:options');
      socket.off('mitigation:selected');
    };
  }, [socket]);

  const startDemo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/demo/crowd-surge`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) alert(data.message);
    } catch (err) {
      console.error('Failed to start demo:', err);
    }
  };

  const resetDemo = async () => {
    try {
      await fetch(`${API_BASE}/api/demo/reset`, { method: 'POST' });
      setAlerts([]);
      setDemoStep(null);
      setDemoRunning(false);
    } catch (err) {
      console.error('Failed to reset demo:', err);
    }
  };

  const handleMitigate = async (alertId, optionId) => {
    try {
      if (optionId) {
        // Select specific mitigation option
        await fetch(`${API_BASE}/api/mitigation/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionId, selectedBy: 'ops_organizer' }),
        });
      } else {
        // Generate mitigation options first
        const res = await fetch(`${API_BASE}/api/alerts/${alertId}/mitigate`, { method: 'POST' });
        const data = await res.json();
        if (data.options) {
          setAlerts(prev => prev.map(a =>
            a.id === alertId ? { ...a, options: data.options } : a
          ));
        }
      }
    } catch (err) {
      console.error('Mitigation error:', err);
    }
  };

  const handleDismiss = (alertId) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, status: 'resolved' } : a
    ));
  };

  return (
    <div className="glass-panel animate-fade-in flex-col gap-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-gradient">Ops Command Center</h2>
          <p className="text-muted text-sm">Real-time Density Monitoring & Mitigation</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Demo Controls */}
          <button
            onClick={startDemo}
            disabled={demoRunning}
            className="btn btn-primary text-xs"
            title="Start Crowd Surge Demo"
          >
            <Play size={14} /> Demo
          </button>
          <button
            onClick={resetDemo}
            className="btn btn-outline text-xs"
            title="Reset Demo"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <div className={`badge ${alerts.some(a => a.status !== 'resolved' && a.severity === 'critical') ? 'badge-critical' : 'badge-normal'}`}>
            {alerts.some(a => a.status !== 'resolved' && a.severity === 'critical') ? 'CRITICAL ALERTS' : 'System Nominal'}
          </div>
        </div>
      </div>

      {/* Demo Step Indicator */}
      {demoStep && (
        <div className="glass-panel p-3 flex items-center gap-3" style={{
          borderColor: 'rgba(139, 92, 246, 0.3)',
          background: 'rgba(139, 92, 246, 0.08)',
        }}>
          <Zap size={18} className="text-accent" style={{ color: '#a78bfa' }} />
          <div className="flex-1">
            <span className="font-bold text-sm">{demoStep.title}</span>
            <p className="text-muted text-xs">{demoStep.description}</p>
          </div>
          {demoStep.step && (
            <span className="badge badge-normal text-xs">Step {demoStep.step}/7</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 h-full">
        <div className="col-span-8 flex flex-col">
          <div className="flex-1">
            <StadiumMap />
          </div>
        </div>

        <div className="col-span-4 flex-col gap-6 h-[500px] overflow-y-auto">
          {/* Active Alerts Panel */}
          <div className="glass-panel flex-col gap-4">
            <h3 className="font-medium text-sm text-muted uppercase flex items-center gap-2">
              <ShieldAlert size={16} /> Active Alerts ({alerts.filter(a => a.status !== 'resolved').length})
            </h3>

            <div className="flex-col gap-4">
              {alerts.length === 0 ? (
                <p className="text-center text-muted text-sm my-4">
                  No active alerts. Click <strong>Demo</strong> to simulate a crowd surge scenario.
                </p>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className={`glass-panel p-3 ${alert.status === 'resolved' ? 'opacity-50' : ''}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className={`badge ${alert.severity === 'critical' ? 'badge-critical' : 'badge-warning'}`}>
                        {alert.type || alert.severity}
                      </div>
                      {alert.status === 'resolved' && <CheckCircle size={16} style={{ color: '#22c55e' }} />}
                    </div>
                    <p className="text-sm font-medium">{alert.message}</p>

                    {/* Mitigation options from Ops Copilot */}
                    {alert.status !== 'resolved' && alert.options && (
                      <div className="flex gap-2 mt-3">
                        {alert.options.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => handleMitigate(alert.id, opt.id)}
                            className="btn btn-primary text-xs flex-1 py-1 px-2"
                            title={opt.description}
                          >
                            {opt.option_label || opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Default actions when no specific options available */}
                    {alert.status !== 'resolved' && !alert.options && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleDismiss(alert.id)} className="btn btn-outline text-xs flex-1 py-1">Dismiss</button>
                        <button onClick={() => handleMitigate(alert.id)} className="btn btn-primary text-xs flex-1 py-1">Auto-Mitigate</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sustainability Panel */}
          <div className="glass-panel flex-col gap-4">
            <h3 className="font-medium text-sm text-muted uppercase flex items-center gap-2">
              <Leaf size={16} style={{ color: '#4ade80' }} /> Sustainability
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-sm">Green Score</span>
              <span className="font-bold text-gradient">{metrics.greenScore}/100</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Carbon Saved</span>
              <span className="font-bold text-gradient">{metrics.carbon} kg</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Transit Usage</span>
              <span className="font-bold text-gradient">{metrics.transit.toLocaleString()} fans</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Recycling Rate</span>
              <span className="font-bold text-gradient">{metrics.recycling}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
