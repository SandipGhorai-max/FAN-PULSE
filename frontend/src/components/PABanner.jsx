import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { Megaphone, X } from 'lucide-react';

export default function PABanner() {
  const { socket } = useSocket();
  const [broadcast, setBroadcast] = useState(null);
  
  useEffect(() => {
    if (socket) {
      socket.on('pa:broadcast', (data) => {
        setBroadcast(data);
        // Auto-hide normal priority after 15s
        if (data.priority !== 'urgent') {
          setTimeout(() => setBroadcast(null), 15000);
        }
      });
    }
    
    return () => {
      if (socket) socket.off('pa:broadcast');
    };
  }, [socket]);
  
  if (!broadcast) return null;
  
  return (
    <div className="pa-banner z-50 fixed top-20 left-1/2 transform -translate-x-1/2 rounded-full px-6 py-3 shadow-lg flex items-center gap-4 w-11/12 max-w-4xl" style={{
      background: broadcast.priority === 'urgent' ? 'linear-gradient(90deg, #ef4444, #b91c1c)' : 'linear-gradient(90deg, #3b82f6, #6366f1)'
    }}>
      <Megaphone size={24} className="animate-pulse" />
      <div className="flex-1 flex flex-col">
        <span className="font-bold text-lg">{broadcast.message_en}</span>
        {broadcast.message_es && <span className="text-sm opacity-90">{broadcast.message_es}</span>}
      </div>
      <button onClick={() => setBroadcast(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
        <X size={20} />
      </button>
    </div>
  );
}
