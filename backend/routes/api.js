/**
 * @module routes/api
 * @description API routes for FanPulse AI — connects frontend to agent system.
 */

import { Router } from 'express';
import { routeRequest } from '../agents/orchestrator.js';
import { getDensityOverview, getActiveAlerts } from '../agents/crowdSentinel.js';
import { handleNavigationRequest } from '../agents/navigator.js';
import { handleTransitRequest } from '../agents/transitCopilot.js';
import { handleGreenRequest } from '../agents/greenOps.js';
import { handlePolyglotRequest } from '../agents/polyglotConcierge.js';
import { handleOpsRequest, getOpsDashboard } from '../agents/opsCommandCopilot.js';
import { handleAccessRequest } from '../agents/accessCompanion.js';
import { startCrowdSurgeDemo, selectDemoMitigation, getDemoState, resetDemo, stopDemo } from '../demo/crowdSurgeDemo.js';
import { validate, chatSchema, mitigationSelectSchema, navigationSchema } from '../middleware/validation.js';
import { configureChatRateLimit } from '../middleware/security.js';
import { getDb } from '../db/schema.js';

/**
 * Creates and configures the API router.
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @returns {Router} Express router
 */
export function createApiRouter(io) {
  const router = Router();

  /* ─── CHAT (Orchestrator) ─── */
  router.post('/chat', configureChatRateLimit(), validate(chatSchema), async (req, res) => {
    try {
      const result = await routeRequest(req.validated);
      res.json(result);
    } catch (err) {
      console.error('Chat error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /* ─── ZONES ─── */
  router.get('/zones', (req, res) => {
    try {
      const zones = getDensityOverview();
      res.json({ zones });
    } catch (err) {
      console.error('Zones error:', err);
      res.status(500).json({ error: 'Failed to fetch zones' });
    }
  });

  /* ─── ALERTS ─── */
  router.get('/alerts', (req, res) => {
    try {
      const alerts = getActiveAlerts();
      res.json({ alerts });
    } catch (err) {
      console.error('Alerts error:', err);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  /* ─── NAVIGATION ─── */
  router.post('/navigate', validate(navigationSchema), (req, res) => {
    try {
      const result = handleNavigationRequest(req.validated);
      res.json(result);
    } catch (err) {
      console.error('Navigation error:', err);
      res.status(500).json({ error: 'Navigation failed' });
    }
  });

  /* ─── TRANSIT ─── */
  router.get('/transit', (req, res) => {
    try {
      const result = handleTransitRequest({ action: 'recommend', lowCarbon: req.query.green === 'true' });
      res.json(result);
    } catch (err) {
      console.error('Transit error:', err);
      res.status(500).json({ error: 'Failed to fetch transit info' });
    }
  });

  /* ─── SUSTAINABILITY ─── */
  router.get('/sustainability', (req, res) => {
    try {
      const result = handleGreenRequest({ action: 'dashboard' });
      res.json(result);
    } catch (err) {
      console.error('Sustainability error:', err);
      res.status(500).json({ error: 'Failed to fetch sustainability data' });
    }
  });

  /* ─── ACCESSIBILITY ─── */
  router.get('/accessibility', (req, res) => {
    try {
      const result = handleAccessRequest({ type: req.query.type || 'facilities' });
      res.json(result);
    } catch (err) {
      console.error('Accessibility error:', err);
      res.status(500).json({ error: 'Failed to fetch accessibility data' });
    }
  });

  /* ─── PA ANNOUNCEMENTS ─── */
  router.get('/pa-announcements', async (req, res) => {
    try {
      const result = await handlePolyglotRequest({ action: 'recent' });
      res.json(result);
    } catch (err) {
      console.error('PA error:', err);
      res.status(500).json({ error: 'Failed to fetch announcements' });
    }
  });

  /* ─── OPS DASHBOARD ─── */
  router.get('/ops/dashboard', async (req, res) => {
    try {
      const result = await getOpsDashboard();
      res.json(result);
    } catch (err) {
      console.error('Ops error:', err);
      res.status(500).json({ error: 'Failed to fetch ops dashboard' });
    }
  });

  /* ─── MITIGATION ─── */
  router.post('/alerts/:alertId/mitigate', async (req, res) => {
    try {
      const result = await handleOpsRequest({ action: 'mitigate', alertId: req.params.alertId });
      res.json(result);
    } catch (err) {
      console.error('Mitigation error:', err);
      res.status(500).json({ error: 'Failed to generate mitigation options' });
    }
  });

  router.post('/mitigation/select', validate(mitigationSelectSchema), (req, res) => {
    try {
      const result = selectDemoMitigation(req.validated.optionId, io);
      res.json(result);
    } catch (err) {
      console.error('Selection error:', err);
      res.status(500).json({ error: 'Failed to select mitigation' });
    }
  });

  /* ─── DEMO ─── */
  router.post('/demo/crowd-surge', (req, res) => {
    try {
      const result = startCrowdSurgeDemo(io);
      res.json(result);
    } catch (err) {
      console.error('Demo error:', err);
      res.status(500).json({ error: 'Failed to start demo' });
    }
  });

  router.get('/demo/state', (req, res) => {
    res.json(getDemoState());
  });

  router.post('/demo/reset', (req, res) => {
    try {
      resetDemo();
      io.emit('demo:reset', { message: 'Demo reset.' });
      res.json({ success: true, message: 'Demo reset successfully' });
    } catch (err) {
      console.error('Reset error:', err);
      res.status(500).json({ error: 'Failed to reset demo' });
    }
  });

  router.post('/demo/stop', (req, res) => {
    stopDemo();
    res.json({ success: true, message: 'Demo stopped' });
  });

  /* ─── HEALTH ─── */
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  return router;
}
