import React, { useRef, useState } from 'react';
import { Camera, Upload, X, Loader } from 'lucide-react';

export default function TicketScanner({ onScanSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result;
      
      try {
        const res = await fetch('/api/vision/scan-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image })
        });
        
        const data = await res.json();
        if (data.error || !data.success) {
          setError(data.message || 'Failed to scan ticket.');
        } else {
          onScanSuccess(data.data);
          setIsOpen(false);
        }
      } catch (err) {
        setError('Network error during scan.');
      } finally {
        setIsScanning(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read image.');
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <button 
        type="button"
        className="btn btn-secondary flex items-center gap-2"
        onClick={() => setIsOpen(true)}
        aria-label="Scan Ticket"
      >
        <Camera size={16} /> Scan Ticket
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm animate-fade-in relative">
            <button 
              className="absolute top-2 right-2 text-muted hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Camera className="text-blue-400" /> Ticket Scanner
            </h3>
            
            <p className="text-sm text-muted mb-4">
              Upload a picture of your ticket to automatically get wayfinding directions to your seat.
            </p>

            {error && (
              <div className="p-3 bg-red-500/20 text-red-300 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button 
                className="btn btn-primary flex items-center justify-center gap-2 w-full py-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
              >
                {isScanning ? (
                  <><Loader className="animate-spin" size={18} /> Analyzing Vision Data...</>
                ) : (
                  <><Upload size={18} /> Upload Image</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
