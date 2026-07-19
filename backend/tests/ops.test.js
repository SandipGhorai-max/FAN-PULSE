import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMitigationOptions, selectMitigationOption, getOpsDashboard, handleOpsRequest } from '../agents/opsCommandCopilot.js';
import { getDb, resetDb } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

describe('Ops Command Copilot', () => {
  let testAlertId;
  let optionId;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDb();
    const db = getDb();
    
    // Insert test data
    db.prepare(`INSERT INTO zones (id, name, type, capacity) VALUES ('z1', 'Gate Z', 'gate', 500)`).run();
    testAlertId = uuidv4();
    db.prepare(`INSERT INTO alerts (id, type, severity, zone_id, message, agent_source) VALUES (?, 'Crowd Surge', 'critical', 'z1', 'Help', 'system')`).run(testAlertId);
  });

  it('handleOpsRequest routes dashboard properly', async () => {
    const res = await handleOpsRequest({ action: 'dashboard' });
    expect(res.stats).toBeDefined();
    
    const resDefault = await handleOpsRequest({});
    expect(resDefault.stats).toBeDefined();
  });

  it('handleOpsRequest routes mitigate properly', async () => {
    const res = await handleOpsRequest({ action: 'mitigate', alertId: testAlertId });
    expect(res.options).toBeDefined();
    expect(res.options.length).toBeGreaterThan(0);
    optionId = res.options[0].id;
    
    try {
      await handleOpsRequest({ action: 'mitigate' });
    } catch (err) {
      expect(err.message).toMatch(/alertId required/);
      expect(err.statusCode).toBe(400);
    }
  });

  it('handleOpsRequest routes select properly', async () => {
    // Generate an option first
    const mit = await handleOpsRequest({ action: 'mitigate', alertId: testAlertId });
    const optId = mit.options[0].id;

    const res = await handleOpsRequest({ action: 'select', optionId: optId });
    expect(res.status).toBe('selected');
    
    try {
      await handleOpsRequest({ action: 'select' });
    } catch (err) {
      expect(err.message).toMatch(/optionId required/);
      expect(err.statusCode).toBe(400);
    }
  });

  it('selectMitigationOption returns error if option not found', () => {
    try {
      selectMitigationOption('unknown-option');
    } catch (err) {
      expect(err.message).toMatch(/Option not found/);
      expect(err.statusCode).toBe(404);
    }
  });

  it('generateMitigationOptions returns error if alert not found', async () => {
    try {
      await generateMitigationOptions('unknown-alert');
    } catch (err) {
      expect(err.message).toMatch(/Alert not found/);
      expect(err.statusCode).toBe(404);
    }
  });
});
