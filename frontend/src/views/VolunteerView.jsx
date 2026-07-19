import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Megaphone, AlertTriangle, CheckCircle } from 'lucide-react';

export default function VolunteerView() {
  const { socket, isConnected } = useSocket();
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [status, setStatus] = useState('idle');
  const [broadcasts, setBroadcasts] = useState([]);

  useEffect(() => {
    if (socket) {
      socket.on('pa:broadcast', (data) => {
        setBroadcasts(prev => [data, ...prev].slice(0, 10)); // keep last 10
      });
    }
    return () => {
      if (socket) socket.off('pa:broadcast');
    };
  }, [socket]);

  const submitReport = (e) => {
    e.preventDefault();
    if (!socket || !location || !description) return;
    
    setStatus('submitting');
    
    // Simulate natural language report matching agent's expected format
    const text = `I am a volunteer at ${location}. ${description}. Severity is ${severity}.`;
    
    socket.emit('chat:message', {
      text,
      context: { role: 'volunteer', userId: 'vol-1', location }
    });
    
    setTimeout(() => {
      setStatus('success');
      setLocation('');
      setDescription('');
      setTimeout(() => setStatus('idle'), 3000);
    }, 1000);
  };

  return (
    <div className="glass-panel animate-fade-in flex-col gap-4">
      <div className="mb-4">
        <h2 className="text-gradient">Volunteer Hub</h2>
        <p className="text-muted text-sm">Submit Incidents, Translation Services, Crowd Observations</p>
      </div>
      
      <div className="grid grid-cols-2 gap-6 h-full">
        <div className="glass-panel flex-col gap-4">
          <h3 className="font-medium flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" /> 
            Report Incident
          </h3>
          
          <form onSubmit={submitReport} className="flex flex-col gap-4">
            <div>
              <label htmlFor="report-location" className="text-sm text-muted mb-1 block">Location</label>
              <select id="report-location" className="input-field" value={location} onChange={e => setLocation(e.target.value)} required>
                <option value="">Select Zone...</option>
                <option value="gate-a">Gate A</option>
                <option value="gate-b">Gate B</option>
                <option value="concourse-north">North Concourse</option>
                <option value="section-100">Section 100</option>
                <option value="medical-east">Medical East</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="report-severity" className="text-sm text-muted mb-1 block">Severity</label>
              <select id="report-severity" className="input-field" value={severity} onChange={e => setSeverity(e.target.value)}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="report-description" className="text-sm text-muted mb-1 block">Description</label>
              <textarea 
                id="report-description"
                className="input-field" 
                rows="4" 
                placeholder="Describe the incident (e.g. huge crowd forming, spill on the floor)..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              ></textarea>
            </div>
            
            <button 
              type="submit" 
              className={`btn btn-primary justify-center ${status === 'success' ? 'bg-green-600 hover:bg-green-600' : ''}`}
              disabled={status === 'submitting' || !isConnected}
            >
              {status === 'success' ? <><CheckCircle size={18} /> Reported!</> : 'Submit Report'}
            </button>
          </form>
        </div>
        
        <div className="glass-panel flex-col gap-4 h-[500px] overflow-hidden">
          <h3 className="font-medium flex items-center gap-2">
            <Megaphone size={18} className="text-primary" />
            Live Broadcasts (Polyglot)
          </h3>
          
          <div className="flex-col gap-4 overflow-y-auto pr-2 flex-1" aria-live="polite" aria-atomic="false">
            {broadcasts.length === 0 ? (
              <p className="text-muted text-sm text-center mt-10">No recent broadcasts</p>
            ) : (
              broadcasts.map((b, i) => (
                <div key={i} className="glass-panel p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <div className={`badge ${b.priority === 'urgent' ? 'badge-critical' : 'badge-warning'}`}>
                      {b.priority.toUpperCase()}
                    </div>
                    <span className="text-xs text-muted">Just now</span>
                  </div>
                  <p className="font-medium mt-2">{b.message_en}</p>
                  
                  {b.message_es && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50 flex flex-col gap-1 text-sm text-gray-300">
                      <p><span className="font-semibold text-blue-400">ES:</span> {b.message_es}</p>
                    </div>
                  )}
                  {b.message_fr && (
                    <div className="text-sm text-gray-300">
                      <p><span className="font-semibold text-blue-400">FR:</span> {b.message_fr}</p>
                    </div>
                  )}
                  {b.message_ko && (
                    <div className="text-sm text-gray-300">
                      <p><span className="font-semibold text-blue-400">KO:</span> {b.message_ko}</p>
                    </div>
                  )}
                  {b.message_ar && (
                    <div className="text-sm text-gray-300">
                      <p><span className="font-semibold text-blue-400">AR:</span> {b.message_ar}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
