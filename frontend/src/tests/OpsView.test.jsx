import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpsView from '../views/OpsView';

// Create a controllable mock socket
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

// Mock StadiumMap to avoid SVG rendering complexities in tests
vi.mock('../components/StadiumMap', () => ({
  default: () => <div data-testid="mock-stadium-map">Stadium Map</div>,
}));

// Mock the SocketContext to provide our controllable mock
vi.mock('../context/SocketContext', () => ({
  SocketProvider: ({ children }) => children,
  useSocket: () => ({ socket: mockSocket, isConnected: true }),
}));

describe('OpsView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/sustainability')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            metrics: {
              total_carbon_saved_kg: { value: 1500 },
              fans_using_transit: { value: 5000 },
              waste_recycled_pct: { value: 85 },
            },
            overallScore: 92,
          }),
        });
      }
      if (url.includes('/api/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            alerts: [
              { id: 'alert-1', type: 'Crowd Surge', severity: 'critical', message: 'High density at Gate A', status: 'active' },
            ],
          }),
        });
      }
      if (url.includes('/api/demo/crowd-surge')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (url.includes('/api/demo/reset')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (url.includes('/api/alerts/') && url.includes('/mitigate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            options: [
              { id: 'opt-1', label: 'Redirect crowd', description: 'Redirect to Gate B' },
              { id: 'opt-2', label: 'Close gate', description: 'Close Gate A temporarily' },
            ],
          }),
        });
      }
      if (url.includes('/api/mitigation/select')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders OpsView dashboard correctly', async () => {
    render(<OpsView />);
    
    expect(screen.getByText('Ops Command Center')).toBeInTheDocument();
    expect(screen.getByTestId('mock-stadium-map')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('92/100')).toBeInTheDocument();
      expect(screen.getByText('1500 kg')).toBeInTheDocument();
      expect(screen.getByText('5,000 fans')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('High density at Gate A')).toBeInTheDocument();
    });
  });

  it('handles fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    render(<OpsView />);
    
    await waitFor(() => {
      expect(screen.getByText('Backend services unavailable')).toBeInTheDocument();
    });
  });

  it('starts demo when Demo button is clicked', async () => {
    render(<OpsView />);
    
    await waitFor(() => {
      expect(screen.getByText('High density at Gate A')).toBeInTheDocument();
    });
    
    const demoBtn = screen.getByTitle('Start Crowd Surge Demo');
    fireEvent.click(demoBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/demo/crowd-surge'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('resets demo when Reset button is clicked', async () => {
    render(<OpsView />);
    
    const resetBtn = screen.getByTitle('Reset Demo');
    fireEvent.click(resetBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/demo/reset'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('handles auto-mitigate button click', async () => {
    render(<OpsView />);
    
    await waitFor(() => {
      expect(screen.getByText('High density at Gate A')).toBeInTheDocument();
    });

    const mitigateBtn = screen.getByLabelText('Auto-Mitigate alert');
    fireEvent.click(mitigateBtn);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/alerts/alert-1/mitigate'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('handles dismiss button click', async () => {
    render(<OpsView />);
    
    await waitFor(() => {
      expect(screen.getByText('High density at Gate A')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByLabelText('Dismiss alert');
    fireEvent.click(dismissBtn);

    // Alert should now appear with reduced opacity (resolved)
    await waitFor(() => {
      const alertEl = screen.getByText('High density at Gate A').closest('[role="alert"]');
      expect(alertEl.className).toContain('opacity-50');
    });
  });

  it('shows "System Nominal" badge when no critical alerts', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/sustainability')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ metrics: {}, overallScore: 0 }),
        });
      }
      if (url.includes('/api/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ alerts: [] }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    render(<OpsView />);
    
    await waitFor(() => {
      expect(screen.getByText('System Nominal')).toBeInTheDocument();
    });
  });

  it('shows empty alerts message with Demo prompt', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/sustainability')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ metrics: {}, overallScore: 0 }),
        });
      }
      if (url.includes('/api/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ alerts: [] }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    render(<OpsView />);
    
    await waitFor(() => {
      expect(screen.getByText(/No active alerts/)).toBeInTheDocument();
    });
  });

  it('registers socket event listeners on mount', () => {
    render(<OpsView />);

    const registeredEvents = mockSocket.on.mock.calls.map(c => c[0]);
    expect(registeredEvents).toContain('alert:new');
    expect(registeredEvents).toContain('demo:started');
    expect(registeredEvents).toContain('demo:step');
    expect(registeredEvents).toContain('demo:completed');
    expect(registeredEvents).toContain('demo:reset');
    expect(registeredEvents).toContain('mitigation:options');
    expect(registeredEvents).toContain('mitigation:selected');
  });

  it('handles alert:new socket event', async () => {
    render(<OpsView />);

    const onCall = mockSocket.on.mock.calls.find(c => c[0] === 'alert:new');
    const handler = onCall[1];

    act(() => {
      handler({ id: 'alert-2', type: 'Fire', severity: 'critical', message: 'Fire in Section 300', status: 'active' });
    });

    expect(screen.getByText('Fire in Section 300')).toBeInTheDocument();
  });

  it('handles demo:step socket event', async () => {
    render(<OpsView />);

    const onCall = mockSocket.on.mock.calls.find(c => c[0] === 'demo:step');
    const handler = onCall[1];

    act(() => {
      handler({ step: 3, title: '🔴 Critical Alert', description: 'Crowd surge detected', alert: { id: 'demo-alert', type: 'Surge', severity: 'critical', message: 'Surge at Gate C', status: 'active' } });
    });

    expect(screen.getByText('🔴 Critical Alert')).toBeInTheDocument();
    expect(screen.getByText('Surge at Gate C')).toBeInTheDocument();
  });

  it('handles demo:reset socket event', async () => {
    render(<OpsView />);

    await waitFor(() => {
      expect(screen.getByText('High density at Gate A')).toBeInTheDocument();
    });

    const onCall = mockSocket.on.mock.calls.find(c => c[0] === 'demo:reset');
    const handler = onCall[1];

    act(() => {
      handler();
    });

    // Alerts should be cleared
    expect(screen.queryByText('High density at Gate A')).not.toBeInTheDocument();
  });

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<OpsView />);
    unmount();

    const unregisteredEvents = mockSocket.off.mock.calls.map(c => c[0]);
    expect(unregisteredEvents).toContain('alert:new');
    expect(unregisteredEvents).toContain('demo:started');
    expect(unregisteredEvents).toContain('demo:step');
    expect(unregisteredEvents).toContain('demo:completed');
    expect(unregisteredEvents).toContain('demo:reset');
  });
});

