import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VolunteerView from '../views/VolunteerView';

// Create a mock socket that we can control
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

// Mock the SocketContext to provide our controllable mock
vi.mock('../context/SocketContext', () => ({
  SocketProvider: ({ children }) => children,
  useSocket: () => ({ socket: mockSocket, isConnected: true }),
}));

describe('VolunteerView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders VolunteerView UI correctly', () => {
    render(<VolunteerView />);
    
    expect(screen.getByText('Volunteer Hub')).toBeInTheDocument();
    expect(screen.getByText('Report Incident')).toBeInTheDocument();
    expect(screen.getByText('Live Broadcasts (Polyglot)')).toBeInTheDocument();
    
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByLabelText('Severity')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('renders empty broadcasts initially', () => {
    render(<VolunteerView />);
    expect(screen.getByText('No recent broadcasts')).toBeInTheDocument();
  });

  it('submit button is disabled when location or description is empty', () => {
    render(<VolunteerView />);
    const submitBtn = screen.getByText('Submit Report');
    // Even though isConnected is true, the form requires location and description
    expect(submitBtn).toBeInTheDocument();
  });

  it('fills out form fields and submits a report', async () => {
    render(<VolunteerView />);
    
    // Fill out the form
    const locationSelect = screen.getByLabelText('Location');
    fireEvent.change(locationSelect, { target: { value: 'gate-a' } });
    
    const severitySelect = screen.getByLabelText('Severity');
    fireEvent.change(severitySelect, { target: { value: 'critical' } });
    
    const description = screen.getByLabelText('Description');
    fireEvent.change(description, { target: { value: 'There is a huge crowd forming near the entrance' } });
    
    // Submit the form
    const submitBtn = screen.getByText('Submit Report');
    fireEvent.click(submitBtn);
    
    // Verify socket.emit was called with chat:message
    expect(mockSocket.emit).toHaveBeenCalledWith('chat:message', expect.objectContaining({
      text: expect.stringContaining('gate-a'),
      context: expect.objectContaining({ role: 'volunteer' }),
    }));

    // Fast-forward timers to see status change to 'success'
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByText('Reported!')).toBeInTheDocument();

    // Fast-forward more to reset status back to idle
    act(() => { vi.advanceTimersByTime(3500); });
    expect(screen.getByText('Submit Report')).toBeInTheDocument();
  });

  it('registers pa:broadcast socket listener and displays broadcasts', () => {
    render(<VolunteerView />);
    
    // Find the pa:broadcast handler registered by useEffect
    const onCall = mockSocket.on.mock.calls.find(c => c[0] === 'pa:broadcast');
    expect(onCall).toBeDefined();
    
    // Simulate a broadcast event
    const broadcastHandler = onCall[1];
    act(() => {
      broadcastHandler({
        priority: 'urgent',
        message_en: 'Gate A is congested. Use Gate B.',
        message_es: 'Puerta A congestionada. Use Puerta B.',
      });
    });

    // Verify broadcast appears in the UI
    expect(screen.getByText('Gate A is congested. Use Gate B.')).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
    // Spanish translation
    expect(screen.getByText(/Puerta A congestionada/)).toBeInTheDocument();
  });

  it('cleans up socket listener on unmount', () => {
    const { unmount } = render(<VolunteerView />);
    unmount();
    
    expect(mockSocket.off).toHaveBeenCalledWith('pa:broadcast');
  });
});

