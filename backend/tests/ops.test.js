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
    
    const resErr = await handleOpsRequest({ action: 'mitigate' });
    expect(resErr.error).toBe(true);
  });

  it('handleOpsRequest routes select properly', async () => {
    // Generate an option first
    const mit = await handleOpsRequest({ action: 'mitigate', alertId: testAlertId });
    const optId = mit.options[0].id;

    const res = await handleOpsRequest({ action: 'select', optionId: optId });
    expect(res.status).toBe('selected');
    
    const resErr = await handleOpsRequest({ action: 'select' });
    expect(resErr.error).toBe(true);
  });

  it('selectMitigationOption returns error if option not found', () => {
    const res = selectMitigationOption('invalid');
    expect(res.error).toBe(true);
  });

  it('generateMitigationOptions returns error if alert not found', async () => {
    const res = await generateMitigationOptions('invalid');
    expect(res.error).toBe(true);
  });
});
