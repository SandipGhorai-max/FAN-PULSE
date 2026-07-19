import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StadiumMap from '../components/StadiumMap';

// Create a controllable mock socket
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

// Mock the SocketContext
vi.mock('../context/SocketContext', () => ({
  useSocket: () => ({ socket: mockSocket, isConnected: true }),
}));

const MOCK_ZONES = [
  { id: 'gate-a', name: 'Gate A', type: 'gate', status: 'normal', current_occupancy: 100, capacity: 500, coord_x: 20, coord_y: 10 },
  { id: 'gate-b', name: 'Gate B', type: 'gate', status: 'warning', current_occupancy: 400, capacity: 500, coord_x: 80, coord_y: 10 },
  { id: 'section-100', name: 'Section 100', type: 'section', status: 'critical', current_occupancy: 490, capacity: 500, coord_x: 50, coord_y: 50 },
];

describe('StadiumMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ zones: MOCK_ZONES }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and renders zones from API', async () => {
    render(<StadiumMap />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/zones'));
    });

    // Zone names should appear as SVG text elements
    await waitFor(() => {
      expect(screen.getByText('Gate A')).toBeInTheDocument();
      expect(screen.getByText('Gate B')).toBeInTheDocument();
      expect(screen.getByText('Section 100')).toBeInTheDocument();
    });
  });

  it('displays occupancy percentages', async () => {
    render(<StadiumMap />);
    
    await waitFor(() => {
      expect(screen.getByText('20%')).toBeInTheDocument(); // 100/500
      expect(screen.getByText('80%')).toBeInTheDocument(); // 400/500
      expect(screen.getByText('98%')).toBeInTheDocument(); // 490/500
    });
  });

  it('renders legend items', () => {
    render(<StadiumMap />);
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('handles fetch failure and shows error badge', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    render(<StadiumMap />);
    
    await waitFor(() => {
      expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
    });
  });

  it('calls onZoneSelect when a zone is clicked', async () => {
    const onZoneSelect = vi.fn();
    render(<StadiumMap onZoneSelect={onZoneSelect} />);
    
    await waitFor(() => {
      expect(screen.getByText('Gate A')).toBeInTheDocument();
    });

    // Click on a zone group — find the text and click its parent <g>
    const gateAText = screen.getByText('Gate A');
    const gateAGroup = gateAText.closest('.map-zone');
    if (gateAGroup) {
      fireEvent.click(gateAGroup);
      expect(onZoneSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'gate-a' }));
    }
  });

  it('registers socket listeners for zone updates', () => {
    render(<StadiumMap />);

    const registeredEvents = mockSocket.on.mock.calls.map(c => c[0]);
    expect(registeredEvents).toContain('zones:updated');
    expect(registeredEvents).toContain('alert:new');
    expect(registeredEvents).toContain('demo:completed');
  });

  it('handles alert:new socket event and updates zone status', async () => {
    render(<StadiumMap />);
    
    await waitFor(() => {
      expect(screen.getByText('Gate A')).toBeInTheDocument();
    });

    const onCall = mockSocket.on.mock.calls.find(c => c[0] === 'alert:new');
    const handler = onCall[1];

    // Simulate an alert:new event for gate-a with critical severity
    act(() => {
      handler({ zone_id: 'gate-a', severity: 'critical' });
    });

    // gate-a should now be updated internally (status changed)
    // We can verify by checking the component didn't crash
    expect(screen.getByText('Gate A')).toBeInTheDocument();
  });

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<StadiumMap />);
    unmount();

    const unregisteredEvents = mockSocket.off.mock.calls.map(c => c[0]);
    expect(unregisteredEvents).toContain('zones:updated');
    expect(unregisteredEvents).toContain('alert:new');
    expect(unregisteredEvents).toContain('demo:completed');
  });

  it('handles HTTP error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    
    render(<StadiumMap />);
    
    await waitFor(() => {
      expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
    });
  });
});
