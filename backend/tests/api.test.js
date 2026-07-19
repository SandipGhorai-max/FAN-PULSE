import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApiRouter } from '../routes/api.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';

// Mock Socket.IO server
const mockIo = {
  emit: () => {},
  on: () => {}
};

const app = express();
app.use(express.json());
app.use('/api', createApiRouter(mockIo));
app.use(globalErrorHandler);

describe('API Routes', () => {
  it('GET /api/health should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
  });

  it('POST /api/chat should validate inputs', async () => {
    // Missing message
    const res = await request(app).post('/api/chat').send({ role: 'fan' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('GET /api/alerts should return alerts', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    expect(res.body.alerts).toBeDefined();
  });

  it('POST /api/navigate should validate inputs', async () => {
    const res = await request(app).post('/api/navigate').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/transit should return transit options', async () => {
    const res = await request(app).get('/api/transit');
    expect(res.status).toBe(200);
  });

  it('GET /api/accessibility should return accessibility data', async () => {
    const res = await request(app).get('/api/accessibility');
    expect(res.status).toBe(200);
  });

  it('GET /api/pa-announcements should return recent broadcasts', async () => {
    const res = await request(app).get('/api/pa-announcements');
    expect(res.status).toBe(200);
  });

  it('GET /api/ops/dashboard should return ops dashboard data', async () => {
    const res = await request(app).get('/api/ops/dashboard');
    expect(res.status).toBe(200);
  });

  it('POST /api/alerts/:alertId/mitigate should call ops mitigation', async () => {
    // Should return 404 because alert123 does not exist
    const res = await request(app).post('/api/alerts/alert123/mitigate');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it('POST /api/mitigation/select should validate optionId', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const res = await request(app).post('/api/mitigation/select').send({ optionId: validUuid });
    expect(res.status).toBe(200); // Assuming test option is processed
  });

  it('POST /api/demo/crowd-surge should start demo', async () => {
    const res = await request(app).post('/api/demo/crowd-surge');
    expect(res.status).toBe(200);
  });

  it('GET /api/demo/state should return state', async () => {
    const res = await request(app).get('/api/demo/state');
    expect(res.status).toBe(200);
  });

  it('POST /api/demo/reset should reset demo', async () => {
    const res = await request(app).post('/api/demo/reset');
    expect(res.status).toBe(200);
  });

  it('POST /api/demo/stop should stop demo', async () => {
    const res = await request(app).post('/api/demo/stop');
    expect(res.status).toBe(200);
  });

  it('POST /api/vision/scan-ticket should process image', async () => {
    // Missing image
    const resErr = await request(app).post('/api/vision/scan-ticket').send({});
    expect(resErr.status).toBe(400);

    // Valid dummy image
    const resValid = await request(app).post('/api/vision/scan-ticket').send({ image: 'data:image/jpeg;base64,123' });
    expect(resValid.status).toBe(200);
    expect(resValid.body.success).toBeDefined();
  });

  it('handles demo errors gracefully', async () => {
    // We can spy on the methods to make them throw
    const demoMod = await import('../demo/crowdSurgeDemo.js');
    vi.spyOn(demoMod, 'startCrowdSurgeDemo').mockImplementationOnce(() => { throw new Error('Demo failed'); });
    vi.spyOn(demoMod, 'resetDemo').mockImplementationOnce(() => { throw new Error('Reset failed'); });

    const res1 = await request(app).post('/api/demo/crowd-surge');
    // Express should pass the error to the global handler or just return 500
    // Actually our test app has no global error handler mounted, so it will return 500 HTML. Let's just check 500 status.
    expect(res1.status).toBe(500);

    const res2 = await request(app).post('/api/demo/reset');
    expect(res2.status).toBe(500);
  });

  it('handles agent errors gracefully in all routes', async () => {
    const crowdSentinel = await import('../agents/crowdSentinel.js');
    const navigator = await import('../agents/navigator.js');
    const transitCopilot = await import('../agents/transitCopilot.js');
    const accessCompanion = await import('../agents/accessCompanion.js');
    const polyglotConcierge = await import('../agents/polyglotConcierge.js');
    const opsCommandCopilot = await import('../agents/opsCommandCopilot.js');
    const visionCopilot = await import('../agents/visionCopilot.js');
    const orchestrator = await import('../agents/orchestrator.js');

    vi.spyOn(crowdSentinel, 'getDensityOverview').mockImplementationOnce(() => { throw new Error('err'); });
    await request(app).get('/api/zones').expect(500);

    vi.spyOn(crowdSentinel, 'getActiveAlerts').mockImplementationOnce(() => { throw new Error('err'); });
    await request(app).get('/api/alerts').expect(500);

    vi.spyOn(navigator, 'handleNavigationRequest').mockImplementationOnce(() => { throw new Error('err'); });
    await request(app).post('/api/navigate').send({ from: 'A', to: 'B' }).expect(500);

    vi.spyOn(transitCopilot, 'handleTransitRequest').mockImplementationOnce(() => { throw new Error('err'); });
    await request(app).get('/api/transit').expect(500);

    vi.spyOn(accessCompanion, 'handleAccessRequest').mockImplementationOnce(() => { throw new Error('err'); });
    await request(app).get('/api/accessibility').expect(500);

    vi.spyOn(polyglotConcierge, 'handlePolyglotRequest').mockRejectedValueOnce(new Error('err'));
    await request(app).get('/api/pa-announcements').expect(500);

    vi.spyOn(opsCommandCopilot, 'getOpsDashboard').mockRejectedValueOnce(new Error('err'));
    await request(app).get('/api/ops/dashboard').expect(500);

    vi.spyOn(opsCommandCopilot, 'handleOpsRequest').mockRejectedValueOnce(new Error('err'));
    await request(app).post('/api/alerts/alert123/mitigate').expect(500);

    vi.spyOn(visionCopilot, 'scanTicket').mockRejectedValueOnce(new Error('err'));
    await request(app).post('/api/vision/scan-ticket').send({ image: 'data:image/jpeg;base64,123' }).expect(500);

    vi.spyOn(orchestrator, 'routeRequest').mockRejectedValueOnce(new Error('err'));
    await request(app).post('/api/chat').send({ message: 'test' }).expect(500);

    const crowdSurgeDemo = await import('../demo/crowdSurgeDemo.js');
    vi.spyOn(crowdSurgeDemo, 'selectDemoMitigation').mockImplementationOnce(() => { throw new Error('err'); });
    await request(app).post('/api/mitigation/select').send({ optionId: '123e4567-e89b-12d3-a456-426614174000' }).expect(500);
  });
});
