/**
 * @module db/schema
 * @description Stadium Context Graph — SQLite schema for FanPulse AI.
 * All agents read and write to these tables to share live stadium state.
 */

import { DatabaseSync as Database } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(__dirname, '..', 'fanpulse.db');

/** @type {Database | null} */
let dbInstance = null;

/**
 * Returns a singleton database connection, creating schema if needed.
 * @returns {Database} The SQLite database instance
 */
export function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = new Database(DB_PATH);
  dbInstance.exec('PRAGMA journal_mode = WAL');
  dbInstance.exec('PRAGMA foreign_keys = ON');

  // Shim for better-sqlite3 transaction API
  dbInstance.transaction = (fn) => {
    return (...args) => {
      dbInstance.exec('BEGIN IMMEDIATE');
      try {
        const result = fn(...args);
        dbInstance.exec('COMMIT');
        return result;
      } catch (err) {
        dbInstance.exec('ROLLBACK');
        throw err;
      }
    };
  };

  createSchema(dbInstance);
  return dbInstance;
}

/**
 * Creates all Stadium Context Graph tables if they don't exist.
 * @param {Database.Database} db - The database instance
 */
function createSchema(db) {
  db.exec(`
    -- Stadium zones: gates, concourses, sections, facilities
    CREATE TABLE IF NOT EXISTS zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('gate','concourse','section','facility','accessible','medical','concession')),
      capacity INTEGER NOT NULL DEFAULT 500,
      current_occupancy INTEGER NOT NULL DEFAULT 0,
      coord_x REAL NOT NULL DEFAULT 0,
      coord_y REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'normal' CHECK(status IN ('normal','warning','critical','closed')),
      is_accessible INTEGER NOT NULL DEFAULT 0,
      is_quiet_zone INTEGER NOT NULL DEFAULT 0
    );

    -- Connections between zones (edges in the stadium graph)
    CREATE TABLE IF NOT EXISTS zone_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_zone_id TEXT NOT NULL REFERENCES zones(id),
      to_zone_id TEXT NOT NULL REFERENCES zones(id),
      distance REAL NOT NULL DEFAULT 1.0,
      is_accessible INTEGER NOT NULL DEFAULT 1,
      current_flow_rate REAL NOT NULL DEFAULT 1.0,
      UNIQUE(from_zone_id, to_zone_id)
    );

    -- Real-time alerts from agents
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('info','warning','critical')),
      zone_id TEXT REFERENCES zones(id),
      message TEXT NOT NULL,
      agent_source TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','acknowledged','resolved')),
      resolved_by TEXT,
      resolved_at TEXT
    );

    -- Crowd density readings over time
    CREATE TABLE IF NOT EXISTS crowd_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id TEXT NOT NULL REFERENCES zones(id),
      density REAL NOT NULL,
      temperature_c REAL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Transit routes to/from the stadium
    CREATE TABLE IF NOT EXISTS transit_routes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('train','subway','bus','rideshare','walk')),
      from_location TEXT NOT NULL,
      to_location TEXT NOT NULL,
      eta_minutes INTEGER NOT NULL,
      surge_level TEXT NOT NULL DEFAULT 'normal' CHECK(surge_level IN ('normal','busy','surge')),
      carbon_kg REAL NOT NULL DEFAULT 0,
      is_accessible INTEGER NOT NULL DEFAULT 1
    );

    -- Multilingual PA announcements
    CREATE TABLE IF NOT EXISTS pa_announcements (
      id TEXT PRIMARY KEY,
      message_en TEXT NOT NULL,
      message_es TEXT NOT NULL DEFAULT '',
      message_fr TEXT NOT NULL DEFAULT '',
      message_ko TEXT NOT NULL DEFAULT '',
      message_ar TEXT NOT NULL DEFAULT '',
      zone_id TEXT REFERENCES zones(id),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high','urgent')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Sustainability metrics
    CREATE TABLE IF NOT EXISTS sustainability_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      zone_id TEXT REFERENCES zones(id),
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Mitigation actions proposed by Ops Command Copilot
    CREATE TABLE IF NOT EXISTS mitigation_actions (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL REFERENCES alerts(id),
      option_label TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','selected','rejected','completed')),
      selected_by TEXT,
      selected_at TEXT,
      outcome TEXT
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_zones_status ON zones(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_zone ON alerts(zone_id);
    CREATE INDEX IF NOT EXISTS idx_crowd_zone_time ON crowd_readings(zone_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_pa_time ON pa_announcements(created_at);
    CREATE INDEX IF NOT EXISTS idx_mitigation_alert ON mitigation_actions(alert_id);
  `);
}

/**
 * Closes the database connection gracefully.
 */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Resets the database (drops all data, re-creates schema).
 * Used for testing and demo resets.
 */
export function resetDb() {
  const db = getDb();
  db.exec(`
    DELETE FROM mitigation_actions;
    DELETE FROM pa_announcements;
    DELETE FROM sustainability_metrics;
    DELETE FROM crowd_readings;
    DELETE FROM alerts;
    DELETE FROM zone_connections;
    DELETE FROM transit_routes;
    DELETE FROM zones;
  `);
}
