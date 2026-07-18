import React from 'react';
import { render, screen } from '@testing-library/react';
import FanView from '../views/FanView';
import { SocketProvider } from '../context/SocketContext';

// Mock window.HTMLElement.prototype.scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock Socket.io client
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      close: vi.fn()
    }))
  };
});

describe('FanView Component', () => {
  it('renders FanView header', () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    expect(screen.getByText(/Fan View/i)).toBeInTheDocument();
  });

  it('renders assistant chat container', () => {
    render(
      <SocketProvider>
        <FanView />
      </SocketProvider>
    );
    expect(screen.getByText(/FanPulse Assistant/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask for directions or info/i)).toBeInTheDocument();
  });
});
