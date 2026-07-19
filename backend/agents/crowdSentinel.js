/**
 * @module agents/crowdSentinel
 * @description 👁️ Crowd Sentinel Agent — Predicts and detects crowd surges.
 * Event-driven density monitoring with threshold-based and predictive alerts.
 */

import { getDb } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

/** Density thresholds for alert levels  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
const THRESHOLDS = {
  WARNING: 0.80,
  CRITICAL: 0.90,
  PREDICTIVE_SPIKE_PCT: 0.15,
};

/**
 * Records a crowd density reading and checks thresholds.
 * @param {string} zoneId - Zone ID
 * @param {number} density - Density as fraction of capacity (0.0–1.0)
 * @param {number} [temperature] - Optional temperature in Celsius
 * @returns {{ alert: object | null, reading: object }} The reading and any triggered alert
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function recordDensityReading(zoneId, density, temperature = null) {
  const db = getDb();

  // Insert reading
  const result = db.prepare(`
    INSERT INTO crowd_readings (zone_id, density, temperature_c) VALUES (?, ?, ?)
  `).run(zoneId, density, temperature);

  // Update zone occupancy
  const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(zoneId);
  if (!zone) return { alert: null, reading: { id: result.lastInsertRowid } };

  const newOccupancy = Math.round(zone.capacity * density);
  const newStatus = density >= THRESHOLDS.CRITICAL ? 'critical'
    : density >= THRESHOLDS.WARNING ? 'warning' : 'normal';

  db.prepare('UPDATE zones SET current_occupancy = ?, status = ? WHERE id = ?')
    .run(newOccupancy, newStatus, zoneId);

  // Check for alerts
  let alert = null;

  if (density >= THRESHOLDS.CRITICAL) {
    alert = createAlert(db, zoneId, 'critical', `CRITICAL: ${zone.name} at ${Math.round(density * 100)}% capacity — crowd surge detected!`);
  } else if (density >= THRESHOLDS.WARNING) {
    alert = createAlert(db, zoneId, 'warning', `WARNING: ${zone.name} at ${Math.round(density * 100)}% capacity — monitoring closely.`);
  }

  // Predictive check: is density rising fast?
  if (!alert) {
    alert = checkPredictiveSpike(db, zoneId, zone.name);
  }

  return {
    alert,
    reading: {
      id: result.lastInsertRowid,
      zoneId,
      density,
      occupancy: newOccupancy,
      capacity: zone.capacity,
      status: newStatus,
    },
  };
}

/**
 * Checks if density is spiking (>15% increase over recent readings).
 * @param {import('better-sqlite3').Database} db
 * @param {string} zoneId
 * @param {string} zoneName
 * @returns {object | null} Alert if spike detected
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
function checkPredictiveSpike(db, zoneId, zoneName) {
  const readings = db.prepare(`
    SELECT density FROM crowd_readings
    WHERE zone_id = ?
    ORDER BY timestamp DESC
    LIMIT 3
  `).all(zoneId);

  if (readings.length < 2) return null;

  const latest = readings[0].density;
  const previous = readings[1].density;
  const spike = latest - previous;

  if (spike >= THRESHOLDS.PREDICTIVE_SPIKE_PCT) {
    return createAlert(db, zoneId, 'warning',
      `PREDICTIVE: ${zoneName} density rising rapidly (+${Math.round(spike * 100)}% in last reading). Potential surge ahead.`
    );
  }

  return null;
}

/**
 * Creates an alert in the database.
 * @param {import('better-sqlite3').Database} db
 * @param {string} zoneId
 * @param {'info'|'warning'|'critical'} severity
 * @param {string} message
 * @returns {object} The created alert
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
function createAlert(db, zoneId, severity, message) {
  const id = uuidv4();

  // Check for existing active alert on this zone at same or higher severity
  const existing = db.prepare(`
    SELECT id FROM alerts WHERE zone_id = ? AND status = 'active' AND severity = ?
  `).get(zoneId, severity);

  if (existing) return null; // Don't duplicate

  db.prepare(`
    INSERT INTO alerts (id, type, severity, zone_id, message, agent_source)
    VALUES (?, 'crowd_density', ?, ?, ?, 'crowd_sentinel')
  `).run(id, severity, zoneId, message);

  return {
    id,
    type: 'crowd_density',
    severity,
    zone_id: zoneId,
    message,
    agent_source: 'crowd_sentinel',
    status: 'active',
  };
}

/**
 * Gets all active alerts.
 * @returns {object[]} Active alerts sorted by severity (critical first)
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getActiveAlerts() {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, z.name as zone_name
    FROM alerts a
    LEFT JOIN zones z ON z.id = a.zone_id
    WHERE a.status = 'active'
    ORDER BY
      CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      a.created_at DESC
  `).all();
}

/**
 * Gets current density overview for all zones.
 * @returns {object[]} Zone density data
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getDensityOverview() {
  const db = getDb();
  return db.prepare(`
    SELECT id, name, type, capacity, current_occupancy, status, coord_x, coord_y,
           ROUND(CAST(current_occupancy AS REAL) / NULLIF(capacity, 0), 2) as density
    FROM zones
    ORDER BY density DESC
  `).all();
}

/**
 * Resolves an alert (marks it as resolved).
 * @param {string} alertId - Alert ID
 * @param {string} resolvedBy - Who resolved it
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function resolveAlert(alertId, resolvedBy = 'system') {
  const db = getDb();
  db.prepare(`
    UPDATE alerts SET status = 'resolved', resolved_by = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(resolvedBy, alertId);
}
