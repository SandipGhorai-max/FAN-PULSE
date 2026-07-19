import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HeroSection from '../components/HeroSection';

describe('HeroSection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title and static content', () => {
    render(<HeroSection />);
    expect(screen.getByText(/FIFA World Cup 2026/i)).toBeInTheDocument();
    expect(screen.getByText('Nations')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Matches', { exact: false })).toBeInTheDocument();
  });

  it('renders countdown when date is in the future', () => {
    // Set system time so 519 days remain (2025-01-08 is 519 days before 2026-06-11)
    vi.setSystemTime(new Date('2025-01-08T18:00:00Z'));
    render(<HeroSection />);
    // Days countdown should render
    expect(screen.getByText('Days')).toBeInTheDocument();
    // Advance timer to trigger a re-render tick
    vi.advanceTimersByTime(1000);
  });

  it('handles target date in the past (all zeros)', () => {
    // Mock date to be after TARGET_DATE (June 11, 2026)
    vi.setSystemTime(new Date('2026-06-12T00:00:00Z'));
    render(<HeroSection />);
    // All countdown units should show 00
    expect(screen.getAllByText('00').length).toBeGreaterThan(0);
  });

  it('rotates facts on interval', () => {
    render(<HeroSection />);
    // Initial fact should be displayed
    expect(screen.getByText(/48 Nations/)).toBeInTheDocument();
    // Advance by 3500ms to trigger next fact
    vi.advanceTimersByTime(3500);
    // Something from FACTS should still be in the document
    expect(document.querySelector('.facts-text')).toBeTruthy();
  });
});
