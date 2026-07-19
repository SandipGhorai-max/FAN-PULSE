import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTransitRequest, getRecommendedRoutes, getAllRoutes, updateSurgeLevel, getDepartureRecommendation } from '../agents/transitCopilot.js';
import { getDb, resetDb } from '../db/schema.js';

describe('Transit Copilot Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDb();
    const db = getDb();
    // Insert some transit routes
    db.prepare(`INSERT INTO transit_routes (id, name, mode, from_location, to_location, eta_minutes, surge_level, carbon_kg, is_accessible) VALUES 
      ('t1', 'Express Train', 'train', 'Downtown', 'Stadium', 20, 'normal', 2, 1),
      ('t2', 'City Bus', 'bus', 'Downtown', 'Stadium', 45, 'busy', 5, 1),
      ('t3', 'Rideshare', 'rideshare', 'Uptown', 'Stadium', 30, 'surge', 15, 0)
    `).run();
  });

  it('gets all routes with getAllRoutes or handleTransitRequest action=all', () => {
    const res = handleTransitRequest({ action: 'all' });
    expect(res.routes.length).toBe(3);
  });

  it('updates surge level and calculates adjusted ETA', () => {
    updateSurgeLevel('t1', 'surge');
    
    const res = getRecommendedRoutes();
    const t1 = res.routes.find(r => r.id === 't1');
    expect(t1.surge_level).toBe('surge');
    // 20 * 1.8 = 36
    expect(t1.adjusted_eta_minutes).toBe(36);
    expect(t1.surge_delay_minutes).toBe(16);
    expect(t1.google_maps_url).toContain('https://www.google.com/maps/dir/?api=1');
  });

  it('recommends route based on lowCarbon preference', () => {
    const res = handleTransitRequest({ action: 'recommend', lowCarbon: true });
    expect(res.recommendation).toContain('Greenest option');
    expect(res.routes[0].id).toBe('t1'); // lowest carbon
  });

  it('recommends route based on accessible preference and location', () => {
    const res = handleTransitRequest({ action: 'recommend', from: 'uptown', accessible: true });
    // t3 is uptown but not accessible, so it should return nothing or empty if no matches
    expect(res.routes.length).toBe(0);

    const res2 = handleTransitRequest({ action: 'recommend', from: 'downtown', accessible: true });
    expect(res2.routes.length).toBe(2);
  });

  it('recommends default fast route', () => {
    const res = handleTransitRequest({});
    expect(res.recommendation).toContain('Fastest option');
    expect(res.routes[0].id).toBe('t1'); // fastest by eta
  });

  it('recommends departure time', () => {
    const res = handleTransitRequest({ action: 'departure' });
    expect(res.recommendation).toContain('Arrive 90 minutes early');
    expect(res.suggestedDepartureMinutesBefore).toBe(45 + 90); // 135
  });
});
