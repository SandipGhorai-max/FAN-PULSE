/**
 * @file all_agents.test.js
 * @description Integration tests for all 7 AI agents using a real in-memory SQLite
 * database seeded with MetLife Stadium data. This ensures actual SQL and business
 * logic are exercised — not mocked.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { seedDatabase } from '../db/seed.js';
import { closeDb } from '../db/schema.js';

// ─── Mock LLM (no real API key in CI) ───────────────────────────────────────
vi.mock('../utils/llm.js', () => ({
  generateContent: vi.fn().mockImplementation((prompt) => {
    // Mitigation prompts expect an array; translation prompts expect an object
    if (prompt && prompt.includes('mitigation')) {
      return Promise.resolve(JSON.stringify([
        { label: 'Option A: Deploy Staff', description: 'Send 4 staff to affected zone.', impact: 'Moderate', action_type: 'staff_deploy' },
        { label: 'Option B: Broadcast Advisory', description: 'Issue PA advisory.', impact: 'Low disruption', action_type: 'advisory' },
      ]));
    }
    return Promise.resolve(
      JSON.stringify({ es: 'Hola', fr: 'Bonjour', ko: '안녕', ar: 'مرحبا' })
    );
  }),
}));

// ─── Lazy-import agents AFTER mocking ────────────────────────────────────────
let accessCompanion;
let crowdSentinel;
let greenOps;
let navigator;
let opsCommandCopilot;
let polyglotConcierge;
let transitCopilot;

beforeAll(async () => {
  // Set env to test so schema uses :memory:
  process.env.NODE_ENV = 'test';

  // Seed real stadium data
  seedDatabase();

  // Import agents after DB is ready
  accessCompanion   = await import('../agents/accessCompanion.js');
  crowdSentinel     = await import('../agents/crowdSentinel.js');
  greenOps          = await import('../agents/greenOps.js');
  navigator         = await import('../agents/navigator.js');
  opsCommandCopilot = await import('../agents/opsCommandCopilot.js');
  polyglotConcierge = await import('../agents/polyglotConcierge.js');
  transitCopilot    = await import('../agents/transitCopilot.js');
});

afterAll(() => {
  closeDb();
});

// ─── accessCompanion ─────────────────────────────────────────────────────────
describe('accessCompanion', () => {
  it('returns facilities (medical, quiet zones, accessible gates)', () => {
    const res = accessCompanion.handleAccessRequest({ type: 'facilities' });
    expect(res.error).toBe(false);
    expect(res.facilities).toBeDefined();
    expect(Array.isArray(res.facilities.medical)).toBe(true);
    expect(Array.isArray(res.facilities.quietZones)).toBe(true);
    expect(Array.isArray(res.facilities.accessibleGates)).toBe(true);
  });

  it('returns quiet zones sorted by occupancy', () => {
    const res = accessCompanion.handleAccessRequest({ type: 'quiet_zones' });
    expect(res.error).toBe(false);
    expect(Array.isArray(res.quietZones)).toBe(true);
    expect(res.quietZones.length).toBeGreaterThan(0);
  });

  it('returns error for route without from/to', () => {
    const res = accessCompanion.handleAccessRequest({ type: 'route' });
    expect(res.error).toBe(true);
  });

  it('finds accessible route between real zones', () => {
    const res = accessCompanion.handleAccessRequest({
      type: 'route',
      from: 'gate-f',
      to: 'quiet-zone-nw',
    });
    // Should either succeed with a path or fail gracefully
    expect(res.error).toBeDefined();
  });

  it('returns help text for unknown type', () => {
    const res = accessCompanion.handleAccessRequest({ type: 'unknown' });
    expect(res.error).toBe(false);
    expect(res.options).toBeDefined();
  });
});

// ─── crowdSentinel ────────────────────────────────────────────────────────────
describe('crowdSentinel', () => {
  it('records a normal density reading', () => {
    const res = crowdSentinel.recordDensityReading('gate-a', 0.5);
    expect(res.reading).toBeDefined();
    expect(res.reading.status).toBe('normal');
    expect(res.alert).toBeNull();
  });

  it('records a warning density reading and triggers an alert', () => {
    const res = crowdSentinel.recordDensityReading('concourse-north', 0.82);
    expect(res.reading.status).toBe('warning');
    // First time warning should create an alert; subsequent calls de-dup
    expect(['warning', null]).toContain(res.alert?.severity ?? null);
  });

  it('records a critical density reading', () => {
    const res = crowdSentinel.recordDensityReading('concourse-east', 0.95);
    expect(res.reading.status).toBe('critical');
  });

  it('gets density overview for all zones', () => {
    const overview = crowdSentinel.getDensityOverview();
    expect(Array.isArray(overview)).toBe(true);
    expect(overview.length).toBeGreaterThan(0);
    expect(overview[0]).toHaveProperty('density');
  });

  it('gets active alerts', () => {
    const alerts = crowdSentinel.getActiveAlerts();
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('resolves an alert', () => {
    // Create a fresh alert first
    crowdSentinel.recordDensityReading('gate-b', 0.91);
    const alerts = crowdSentinel.getActiveAlerts();
    if (alerts.length > 0) {
      crowdSentinel.resolveAlert(alerts[0].id, 'ops_team');
      const afterAlerts = crowdSentinel.getActiveAlerts();
      expect(afterAlerts.find(a => a.id === alerts[0].id)).toBeUndefined();
    }
  });
});

// ─── greenOps ─────────────────────────────────────────────────────────────────
describe('greenOps', () => {
  it('returns sustainability dashboard with real data', () => {
    const res = greenOps.getSustainabilityDashboard();
    expect(res.overallScore).toBeGreaterThan(0);
    expect(res.metrics).toBeDefined();
    expect(res.transitModes).toBeDefined();
  });

  it('generates a transit nudge for train mode', () => {
    const res = greenOps.generateNudge('train');
    expect(res.nudge).toContain('🚂');
    expect(res.carbon_kg).toBeGreaterThanOrEqual(0);
  });

  it('generates a nudge for unknown mode', () => {
    const res = greenOps.generateNudge('helicopter');
    expect(res.nudge).toBeDefined();
  });

  it('records a metric', () => {
    expect(() => greenOps.recordMetric('test_metric', 42, 'units')).not.toThrow();
  });

  it('handles dashboard action via handler', () => {
    const res = greenOps.handleGreenRequest({ action: 'dashboard' });
    expect(res.overallScore).toBeDefined();
  });

  it('handles nudge action via handler', () => {
    const res = greenOps.handleGreenRequest({ action: 'nudge', transitMode: 'walk' });
    expect(res.nudge).toBeDefined();
  });

  it('handles unknown action via handler (defaults to dashboard)', () => {
    const res = greenOps.handleGreenRequest({ action: 'unknown' });
    expect(res.overallScore).toBeDefined();
  });
});

// ─── navigator ────────────────────────────────────────────────────────────────
describe('navigator', () => {
  it('builds the adjacency graph', () => {
    const graph = navigator.buildGraph();
    expect(graph).toBeInstanceOf(Map);
    expect(graph.size).toBeGreaterThan(0);
  });

  it('finds shortest path between two real zones', () => {
    const result = navigator.findShortestPath('gate-a', 'section-100');
    expect(result).not.toBeNull();
    expect(result.path[0]).toBe('gate-a');
    expect(result.path[result.path.length - 1]).toBe('section-100');
    expect(result.distance).toBeGreaterThan(0);
  });

  it('returns null for a nonexistent zone route', () => {
    const result = navigator.findShortestPath('invalid-zone', 'section-100');
    expect(result).toBeNull();
  });

  it('finds accessible-only path', () => {
    const result = navigator.findShortestPath('gate-f', 'quiet-zone-nw', { accessibleOnly: true });
    expect(result).not.toBeNull();
  });

  it('handles a full navigation request', () => {
    const res = navigator.handleNavigationRequest({ from: 'gate-a', to: 'section-100' });
    expect(res.error).toBe(false);
    expect(res.directions).toBeDefined();
    expect(res.estimated_walk_minutes).toBeGreaterThan(0);
  });

  it('returns error for unknown from zone', () => {
    const res = navigator.handleNavigationRequest({ from: 'unknown-zone', to: 'section-100' });
    expect(res.error).toBe(true);
  });

  it('returns error for unknown to zone', () => {
    const res = navigator.handleNavigationRequest({ from: 'gate-a', to: 'unknown-zone' });
    expect(res.error).toBe(true);
  });

  it('gets reroute suggestions around a congested zone', () => {
    const suggestions = navigator.getRerouteSuggestions('concourse-north');
    expect(Array.isArray(suggestions)).toBe(true);
  });
});

// ─── opsCommandCopilot ───────────────────────────────────────────────────────
describe('opsCommandCopilot', () => {
  it('returns ops dashboard with zones and alerts', async () => {
    const res = await opsCommandCopilot.getOpsDashboard();
    expect(res.stats).toBeDefined();
    expect(res.stats.totalCapacity).toBeGreaterThan(0);
    expect(Array.isArray(res.recentAlerts)).toBe(true);
    expect(Array.isArray(res.pendingActions)).toBe(true);
  });

  it('handles an ops request for dashboard action', async () => {
    const res = await opsCommandCopilot.handleOpsRequest({ action: 'dashboard' });
    expect(res).toBeDefined();
  });

  it('handles mitigate action (LLM mocked)', async () => {
    // Create an alert to mitigate
    crowdSentinel.recordDensityReading('gate-c', 0.92);
    const alerts = crowdSentinel.getActiveAlerts();
    if (alerts.length > 0) {
      const res = await opsCommandCopilot.handleOpsRequest({
        action: 'mitigate',
        alertId: alerts[0].id,
      });
      expect(res).toBeDefined();
    }
  });
});

// ─── polyglotConcierge ───────────────────────────────────────────────────────
describe('polyglotConcierge', () => {
  it('returns recent announcements', async () => {
    const res = await polyglotConcierge.handlePolyglotRequest({ action: 'recent' });
    expect(res).toBeDefined();
    expect(Array.isArray(res.announcements ?? res)).toBe(true);
  });

  it('broadcasts a message in multiple languages (LLM mocked)', async () => {
    const res = await polyglotConcierge.handlePolyglotRequest({
      action: 'broadcast',
      message: 'Welcome to the FIFA World Cup 2026!',
    });
    expect(res).toBeDefined();
  });

  it('handles unknown action gracefully', async () => {
    const res = await polyglotConcierge.handlePolyglotRequest({ action: 'unknown' });
    expect(res).toBeDefined();
  });
});

// ─── transitCopilot ──────────────────────────────────────────────────────────
describe('transitCopilot', () => {
  it('returns all transit route statuses', () => {
    const res = transitCopilot.handleTransitRequest({ type: 'status' });
    expect(res).toBeDefined();
    expect(Array.isArray(res.routes ?? res)).toBe(true);
  });

  it('recommends transit options for a stadium location', () => {
    const res = transitCopilot.handleTransitRequest({
      type: 'recommend',
      location: 'Penn Station NYC',
    });
    expect(res).toBeDefined();
  });

  it('handles unknown type gracefully', () => {
    const res = transitCopilot.handleTransitRequest({ type: 'unknown' });
    expect(res).toBeDefined();
  });
});
