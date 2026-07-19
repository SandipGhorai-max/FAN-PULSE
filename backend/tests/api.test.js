import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApiRouter } from '../routes/api.js';

// Mock Socket.IO server
const mockIo = {
  emit: () => {},
  on: () => {}
};

const app = express();
app.use(express.json());
app.use('/api', createApiRouter(mockIo));

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

  it('GET /api/sustainability should return green dashboard data', async () => {
    const res = await request(app).get('/api/sustainability');
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
    const res = await request(app).post('/api/alerts/alert123/mitigate');
    expect(res.status).toBe(200);
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
});
