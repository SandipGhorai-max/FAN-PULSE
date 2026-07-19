import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FanView from '../views/FanView';
import { SocketProvider, useSocket } from '../context/SocketContext';

// Mock window.HTMLElement.prototype.scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('../components/StadiumMap', () => {
  return {
    default: ({ onZoneSelect }) => (
      <button onClick={() => onZoneSelect && onZoneSelect({ name: 'Gate C' })}>
        Mock Map Zone C
      </button>
    )
  };
});

vi.mock('../components/TicketScanner', () => {
  return {
    default: ({ onScanSuccess }) => (
      <button onClick={() => onScanSuccess && onScanSuccess({ section: '100', row: 'A', seat: '1', nearestGate: 'Gate A' })}>
        Mock Ticket Scanner
      </button>
    )
  };
});

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

vi.mock('../context/SocketContext', () => ({
  SocketProvider: ({ children }) => children,
  useSocket: vi.fn(() => ({ socket: mockSocket, isConnected: true })),
}));

describe('FanView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/zones')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            zones: [
              { id: 'gate-a', name: 'Gate A', current_density: 30, status: 'normal' },
              { id: 'gate-b', name: 'Gate B', current_density: 85, status: 'warning' },
            ]
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders FanView header', async () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    await screen.findByText(/Fan View/i);
    expect(screen.getByText(/Fan View/i)).toBeInTheDocument();
  });

  it('renders assistant chat container', async () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    await screen.findByText(/FanPulse Assistant/i);
    expect(screen.getByText(/FanPulse Assistant/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask for directions or info/i)).toBeInTheDocument();
  });

  it('handles chat input change', async () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    await screen.findByText(/FanPulse Assistant/i);
    const input = screen.getByPlaceholderText(/Ask for directions or info/i);
    fireEvent.change(input, { target: { value: 'Where is my seat?' } });
    expect(input.value).toBe('Where is my seat?');
  });

  it('updates input when zone is selected from StadiumMap', async () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    await screen.findByText(/FanPulse Assistant/i);
    
    // Click the mocked map button
    const mapBtn = screen.getByText('Mock Map Zone C');
    fireEvent.click(mapBtn);
    
    // The chat input should be updated
    const input = screen.getByPlaceholderText(/Ask for directions or info/i);
    expect(input.value).toBe('How do I get to Gate C?');
  });

  it('sends a chat message when form is submitted', async () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    
    await screen.findByText(/FanPulse Assistant/i);
    const input = screen.getByPlaceholderText(/Ask for directions or info/i);
    
    // Type a message
    fireEvent.change(input, { target: { value: 'Navigate to Gate C' } });
    
    // Find the send button and click it
    fireEvent.submit(input.closest('form'));
    
    // Assert socket.emit was called instead of fetch
    expect(mockSocket.emit).toHaveBeenCalledWith('chat:message', expect.objectContaining({
      text: 'Navigate to Gate C',
      context: expect.objectContaining({ role: 'fan' })
    }));
  });

  it('handles chat response and error from socket', async () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    await screen.findByText(/FanPulse Assistant/i);
    
    // simulate socket events
    const onCallRes = mockSocket.on.mock.calls.find(c => c[0] === 'chat:response');
    onCallRes[1]({ message: 'This is a socket response' });
    await screen.findByText('This is a socket response');
    expect(screen.getByText('This is a socket response')).toBeInTheDocument();

    const onCallErr = mockSocket.on.mock.calls.find(c => c[0] === 'chat:error');
    onCallErr[1]({ message: 'This is a socket error' });
    await screen.findByText('Sorry, I encountered an error. This is a socket error');
    expect(screen.getByText('Sorry, I encountered an error. This is a socket error')).toBeInTheDocument();
  });

  it('handles ticket scanned callback', async () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    await screen.findByText(/FanPulse Assistant/i);
    
    // click mock scanner
    fireEvent.click(screen.getByText('Mock Ticket Scanner'));
    
    // should have sent a chat message
    expect(mockSocket.emit).toHaveBeenCalledWith('chat:message', expect.objectContaining({
      text: expect.stringContaining('I just scanned my ticket!')
    }));
  });

  it('handles null socket safely', () => {
    // Temporarily override the mock to return null socket
    vi.mocked(useSocket).mockImplementation(() => ({ socket: null, isConnected: false }));
    
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    
    // Attempt to submit form with null socket
    const input = screen.getByPlaceholderText(/Ask for directions or info/i);
    fireEvent.change(input, { target: { value: 'Navigate to Gate C' } });
    fireEvent.submit(input.closest('form'));
    
    // Nothing should crash, and emit shouldn't be called on the mockSocket
    expect(mockSocket.emit).not.toHaveBeenCalled();
    
    // Restore the original mock implementation
    vi.mocked(useSocket).mockImplementation(() => ({ socket: mockSocket, isConnected: true }));
  });
});
