import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, closeDb } from '../db/schema.js';

describe('Database Schema & Wrapper', () => {
  let db;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    db = getDb();
  });

  afterAll(() => {
    closeDb();
  });

  it('runs sync transaction successfully', () => {
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO zones (id, name, type, capacity, current_occupancy, status, is_accessible, is_quiet_zone) VALUES ('test-zone', 'Test Zone', 'gate', 500, 0, 'normal', 0, 0)`).run();
      return 'success';
    });
    const result = tx();
    expect(result).toBe('success');
  });

  it('rolls back sync transaction on error', () => {
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO zones (id, name, type, capacity, current_occupancy, status, is_accessible, is_quiet_zone) VALUES ('test-zone-2', 'Test Zone 2', 'gate', 500, 0, 'normal', 0, 0)`).run();
      throw new Error('sync fail');
    });
    expect(() => tx()).toThrow('sync fail');
    
    // Check it rolled back
    const row = db.prepare(`SELECT * FROM zones WHERE id = 'test-zone-2'`).get();
    expect(row).toBeUndefined();
  });

  it('runs async transaction successfully', async () => {
    const tx = db.transaction(async () => {
      db.prepare(`INSERT INTO zones (id, name, type, capacity, current_occupancy, status, is_accessible, is_quiet_zone) VALUES ('async-zone', 'Async Zone', 'gate', 500, 0, 'normal', 0, 0)`).run();
      return 'async success';
    });
    const result = await tx();
    expect(result).toBe('async success');
  });

  it('rolls back async transaction on error', async () => {
    const tx = db.transaction(async () => {
      db.prepare(`INSERT INTO zones (id, name, type, capacity, current_occupancy, status, is_accessible, is_quiet_zone) VALUES ('async-zone-2', 'Async Zone 2', 'gate', 500, 0, 'normal', 0, 0)`).run();
      throw new Error('async fail');
    });
    await expect(tx()).rejects.toThrow('async fail');
    
    const row = db.prepare(`SELECT * FROM zones WHERE id = 'async-zone-2'`).get();
    expect(row).toBeUndefined();
  });
});
