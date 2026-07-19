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
// Removed unused getDb import

/**
 * Creates and configures the API router.
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @returns {Router} Express router
 */
export function createApiRouter(io) {
  const router = Router();

  /* ─── CHAT (Orchestrator) ─── */
  router.post('/chat', configureChatRateLimit(), validate(chatSchema), async (req, res, next) => {
    try {
      const result = await routeRequest(req.validated);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /* ─── ZONES ─── */
  router.get('/zones', (req, res, next) => {
    try {
      const zones = getDensityOverview();
      res.json({ zones });
    } catch (err) {
      next(err);
    }
  });

  /* ─── ALERTS ─── */
  router.get('/alerts', (req, res, next) => {
    try {
      const alerts = getActiveAlerts();
      res.json({ alerts });
    } catch (err) {
      next(err);
    }
  });

  /* ─── NAVIGATION ─── */
  router.post('/navigate', validate(navigationSchema), (req, res, next) => {
    try {
      const result = handleNavigationRequest(req.validated);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /* ─── TRANSIT ─── */
  router.get('/transit', (req, res, next) => {
    try {
      const result = handleTransitRequest({ action: 'recommend', lowCarbon: req.query.green === 'true' });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /* ─── SUSTAINABILITY ─── */
  router.get('/sustainability', (req, res, next) => {
    try {
      const result = handleGreenRequest({ action: 'dashboard' });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /* ─── ACCESSIBILITY ─── */
  router.get('/accessibility', (req, res, next) => {
    try {
      const result = handleAccessRequest({ type: req.query.type || 'facilities' });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /* ─── PA ANNOUNCEMENTS ─── */
  router.get('/pa-announcements', async (req, res, next) => {
    try {
      const result = await handlePolyglotRequest({ action: 'recent' });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /* ─── OPS DASHBOARD ─── */
  router.get('/ops/dashboard', async (req, res, next) => {
    try {
      const result = await getOpsDashboard();
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /* ─── MITIGATION ─── */
  router.post('/alerts/:alertId/mitigate', async (req, res, next) => {
    try {
      const result = await handleOpsRequest({ action: 'mitigate', alertId: req.params.alertId });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/mitigation/select', validate(mitigationSelectSchema), (req, res, next) => {
    try {
      const result = selectDemoMitigation(req.validated.optionId, io);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /* ─── DEMO ─── */
  router.post('/demo/crowd-surge', (req, res, next) => {
    try {
      const result = startCrowdSurgeDemo(io);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/demo/state', (req, res) => {
    res.json(getDemoState());
  });

  router.post('/demo/reset', (req, res, next) => {
    try {
      resetDemo();
      io.emit('demo:reset', { message: 'Demo reset.' });
      res.json({ success: true, message: 'Demo reset successfully' });
    } catch (err) {
      next(err);
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
