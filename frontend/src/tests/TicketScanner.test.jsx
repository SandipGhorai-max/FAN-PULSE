import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TicketScanner from '../components/TicketScanner';

describe('TicketScanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders scan ticket button', () => {
    render(<TicketScanner onScanSuccess={vi.fn()} />);
    expect(screen.getByText('Scan Ticket')).toBeInTheDocument();
  });

  it('opens modal on button click', () => {
    render(<TicketScanner onScanSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Scan Ticket'));
    expect(screen.getByText('Upload a picture of your ticket to automatically get wayfinding directions to your seat.')).toBeInTheDocument();
  });

  it('closes modal on close button click', () => {
    render(<TicketScanner onScanSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Scan Ticket'));
    expect(screen.getByText('Upload Image')).toBeInTheDocument();
    
    // Close button is the one with X icon, let's find it by role or simply first button in the glass panel
    const closeBtn = screen.getAllByRole('button')[1]; // second button is X
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Upload Image')).not.toBeInTheDocument();
  });

  it('handles successful ticket scan', async () => {
    const mockOnScanSuccess = vi.fn();
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { section: '102', row: 'F', seat: '12', nearestGate: 'Gate A' }
      })
    });

    render(<TicketScanner onScanSuccess={mockOnScanSuccess} />);
    fireEvent.click(screen.getByText('Scan Ticket'));

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['dummy content'], 'ticket.png', { type: 'image/png' });
    
    let onloadRef = null;
    class MockFileReader {
      constructor() {
        this.result = 'data:image/png;base64,dummy';
      }
      set onload(fn) {
        onloadRef = fn;
      }
      readAsDataURL() {
        if (onloadRef) onloadRef();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/vision/scan-ticket', expect.any(Object));
      expect(mockOnScanSuccess).toHaveBeenCalledWith({
        section: '102',
        row: 'F',
        seat: '12',
        nearestGate: 'Gate A'
      });
      // modal should be closed
      expect(screen.queryByText('Upload Image')).not.toBeInTheDocument();
    });
  });

  it('handles scan error', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        error: true,
        message: 'Invalid image format'
      })
    });

    render(<TicketScanner onScanSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Scan Ticket'));

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['dummy content'], 'ticket.png', { type: 'image/png' });
    
    let onloadRef = null;
    class MockFileReader {
      constructor() {
        this.result = 'data:image/png;base64,dummy';
      }
      set onload(fn) {
        onloadRef = fn;
      }
      readAsDataURL() {
        if (onloadRef) onloadRef();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Invalid image format')).toBeInTheDocument();
    });
  });

  it('handles file read error', async () => {
    render(<TicketScanner onScanSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Scan Ticket'));

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['dummy content'], 'ticket.png', { type: 'image/png' });
    
    let onerrorRef = null;
    class MockFileReader {
      constructor() {}
      set onerror(fn) {
        onerrorRef = fn;
      }
      readAsDataURL() {
        if (onerrorRef) onerrorRef();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Failed to read image.')).toBeInTheDocument();
    });
  });

  it('handles network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<TicketScanner onScanSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Scan Ticket'));

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['dummy content'], 'ticket.png', { type: 'image/png' });
    
    let onloadRef = null;
    class MockFileReader {
      constructor() {
        this.result = 'data:image/png;base64,dummy';
      }
      set onload(fn) {
        onloadRef = fn;
      }
      readAsDataURL() {
        if (onloadRef) onloadRef();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Network error during scan.')).toBeInTheDocument();
    });
  });
});
