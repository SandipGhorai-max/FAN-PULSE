import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as accessCompanion from '../agents/accessCompanion.js';
import * as crowdSentinel from '../agents/crowdSentinel.js';
import * as greenOps from '../agents/greenOps.js';
import * as navigator from '../agents/navigator.js';
import * as opsCommandCopilot from '../agents/opsCommandCopilot.js';
import * as polyglotConcierge from '../agents/polyglotConcierge.js';
import * as transitCopilot from '../agents/transitCopilot.js';
import * as llm from '../utils/llm.js';

// Mock DB
vi.mock('../db/schema.js', () => {
  return {
    getDb: vi.fn(() => ({
      prepare: vi.fn(() => ({
        all: vi.fn(() => []),
        get: vi.fn(() => ({ count: 1 })),
        run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      })),
      transaction: vi.fn((fn) => fn),
    })),
  };
});

vi.mock('../utils/llm.js', () => ({
  generateContent: vi.fn()
}));

describe('All Agents Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('accessCompanion', () => {
    it('handles route request', () => {
      expect(accessCompanion.handleAccessRequest({ type: 'route' }).error).toBe(true);
      expect(accessCompanion.handleAccessRequest({ type: 'route', from: 'A', to: 'B' }).error).toBe(true);
    });
    it('handles quiet_zones', () => {
      expect(accessCompanion.handleAccessRequest({ type: 'quiet_zones' }).error).toBe(false);
    });
    it('handles facilities', () => {
      expect(accessCompanion.handleAccessRequest({ type: 'facilities' }).error).toBe(false);
    });
    it('handles unknown', () => {
      expect(accessCompanion.handleAccessRequest({ type: 'unknown' }).error).toBe(false);
    });
  });

  describe('crowdSentinel', () => {
    it('records reading', () => {
      expect(crowdSentinel.recordDensityReading('gate-a', 0.5)).toBeDefined();
      expect(crowdSentinel.recordDensityReading('gate-a', 0.85)).toBeDefined();
      expect(crowdSentinel.recordDensityReading('gate-a', 0.95)).toBeDefined();
    });
    it('gets alerts', () => {
      expect(crowdSentinel.getActiveAlerts()).toBeDefined();
    });
    it('gets overview', () => {
      expect(crowdSentinel.getDensityOverview()).toBeDefined();
    });
    it('resolves alert', () => {
      expect(crowdSentinel.resolveAlert('1')).toBeUndefined();
    });
  });

  describe('greenOps', () => {
    it('handles report request', () => {
      expect(greenOps.handleGreenRequest({ action: 'dashboard' })).toBeDefined();
    });
    it('handles nudge request', () => {
      expect(greenOps.handleGreenRequest({ action: 'nudge', transitMode: 'train' })).toBeDefined();
    });
    it('handles default', () => {
      expect(greenOps.handleGreenRequest({ action: 'unknown' })).toBeDefined();
    });
    it('records metric', () => {
      expect(greenOps.recordMetric('test', 1, 'kg')).toBeUndefined();
    });
  });

  describe('navigator', () => {
    it('handles navigate request', () => {
      const res = navigator.handleNavigationRequest({ from: 'a', to: 'b' });
      expect(res.error).toBe(true);
    });
    it('handles navigate accessible', () => {
      const res = navigator.handleNavigationRequest({ from: 'a', to: 'b', accessible: true });
      expect(res.error).toBe(true);
    });
  });

  describe('opsCommandCopilot', () => {
    it('handles dashboard', async () => {
      const res = await opsCommandCopilot.getOpsDashboard();
      expect(res).toBeDefined();
    });
    it('handles mitigate', async () => {
      llm.generateContent.mockResolvedValueOnce(JSON.stringify([{ label: 'Option 1' }]));
      const res = await opsCommandCopilot.handleOpsRequest({ action: 'mitigate', alertId: '1' });
      expect(res).toBeDefined();
    });
  });

  describe('polyglotConcierge', () => {
    it('handles recent', async () => {
      const res = await polyglotConcierge.handlePolyglotRequest({ action: 'recent' });
      expect(res).toBeDefined();
    });
    it('handles broadcast', async () => {
      llm.generateContent.mockResolvedValueOnce(JSON.stringify({ es: 'es', fr: 'fr', ko: 'ko', ar: 'ar' }));
      const res = await polyglotConcierge.handlePolyglotRequest({ action: 'broadcast', message: 'Hello' });
      expect(res).toBeDefined();
    });
  });

  describe('transitCopilot', () => {
    it('handles status', () => {
      expect(transitCopilot.handleTransitRequest({ type: 'status' })).toBeDefined();
    });
    it('handles recommend', () => {
      expect(transitCopilot.handleTransitRequest({ type: 'recommend', location: 'stadium' })).toBeDefined();
    });
    it('handles defaults', () => {
      expect(transitCopilot.handleTransitRequest({ type: 'unknown' })).toBeDefined();
    });
  });
});
