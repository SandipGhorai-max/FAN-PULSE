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
});
