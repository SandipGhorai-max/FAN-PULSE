import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import StadiumMap from '../components/StadiumMap';
import HeroSection from '../components/HeroSection';
import { Send, MapPin, Loader } from 'lucide-react';

export default function FanView() {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState([
    { role: 'bot', content: "Hi! I'm FanPulse AI. How can I assist you at MetLife Stadium today? I can help you find your seat, accessible routes, or food." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => scrollToBottom(), [messages]);

  useEffect(() => {
    if (socket) {
      socket.on('chat:response', (res) => {
        setIsLoading(false);
        setMessages(prev => [...prev, { role: 'bot', content: res.message }]);
      });
      
      socket.on('chat:error', (err) => {
        setIsLoading(false);
        setMessages(prev => [...prev, { role: 'bot', content: "Sorry, I encountered an error. " + err.message }]);
      });
    }
    
    return () => {
      if (socket) {
        socket.off('chat:response');
        socket.off('chat:error');
      }
    };
  }, [socket]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    
    const text = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);
    
    // We send context along with the text
    socket.emit('chat:message', {
      text,
      context: {
        userId: 'fan-123',
        role: 'fan',
        location: 'gate-a' // mock current location
      }
    });
  };

  const handleZoneSelect = (zone) => {
    setInput(`How do I get to ${zone.name}?`);
  };

  return (
    <div className="fan-view-container animate-fade-in flex-col gap-6" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* FIFA World Cup Hero Section */}
      <HeroSection />

      {/* Fan Dashboard */}
      <div className="glass-panel flex-col gap-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-gradient">Fan View</h2>
          <p className="text-muted text-sm">Wayfinding, Accessible Routes, Transit Info</p>
        </div>
        <div className="badge badge-normal flex items-center gap-2">
          <MapPin size={14} /> You are at Gate A
        </div>
      </div>
      
      <div className="grid grid-cols-12 gap-6 h-full">
        <div className="col-span-8 flex flex-col">
          <div className="flex-1">
            <StadiumMap onZoneSelect={handleZoneSelect} />
          </div>
        </div>
        
        <div className="col-span-4 chat-container h-[500px]">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            FanPulse Assistant
          </h3>
          
          <div className="chat-messages glass-panel flex-1 mb-4" aria-live="polite" aria-atomic="false">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div className="chat-bubble bot text-muted flex items-center gap-2" aria-label="Assistant is typing...">
                <Loader size={16} className="animate-spin" aria-hidden="true" /> Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={sendMessage} className="flex gap-2" aria-label="Chat input form">
            <label htmlFor="chat-input" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>Message assistant</label>
            <input 
              id="chat-input"
              type="text" 
              className="input-field" 
              placeholder="Ask for directions or info..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || !isConnected}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isLoading || !isConnected || !input.trim()}
              aria-label="Send message"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
}
