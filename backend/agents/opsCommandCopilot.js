/**
 * @module agents/opsCommandCopilot
 * @description 🧑‍✈️ Ops Command Copilot — Fuses agent data into live decisions for staff.
 * Generates mitigation options, tracks resolutions, provides dashboard data.
 */

import { getDb } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates mitigation options for a critical alert.
 * @param {string} alertId - The alert to mitigate
 * @returns {Promise<object>} Mitigation options with descriptions
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export async function generateMitigationOptions(alertId) {
  const db = getDb();
  const alert = db.prepare(`
    SELECT a.*, z.name as zone_name, z.type as zone_type
    FROM alerts a
    LEFT JOIN zones z ON z.id = a.zone_id
    WHERE a.id = ?
  `).get(alertId);

  if (!alert) return { error: true, message: 'Alert not found' };

  // Generate context-aware mitigation options
  const options = await getMitigationStrategies(alert);

  // Store in database
  const insertOption = db.prepare(`
    INSERT INTO mitigation_actions (id, alert_id, option_label, description, status)
    VALUES (?, ?, ?, ?, 'proposed')
  `);

  const storedOptions = options.map((opt) => {
    const id = uuidv4();
    insertOption.run(id, alertId, opt.label, opt.description);
    return { id, ...opt };
  });

  return {
    alertId,
    alert,
    options: storedOptions,
    recommendation: `Based on current conditions, Option A is recommended for faster crowd relief.`,
  };
}

import { generateContent } from '../utils/llm.js';

/**
 * Gets mitigation strategies based on alert type and location using Gemini.
 * @param {object} alert - The alert object
 * @returns {Promise<Array<{label: string, description: string, impact: string, action_type: string}>>}
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
async function getMitigationStrategies(alert) {
  const db = getDb();
  const altGates = db.prepare(`SELECT name FROM zones WHERE type = 'gate' AND id != ? AND status = 'normal'`).all(alert.zone_id);
  const altGateNames = altGates.map(g => g.name).join(', ') || 'alternate gates';

  const prompt = `You are the Ops Command Copilot for FanPulse AI (FIFA World Cup 2026).
An alert has been triggered:
Type: ${alert.type}
Severity: ${alert.severity}
Message: ${alert.message}
Zone: ${alert.zone_name}

Available normal gates for redirection: ${altGateNames}

Propose exactly 2 mitigation options.
Return STRICTLY in JSON format as an array of objects:
[
  {
    "label": "Option A: [Short Title]",
    "description": "[Detailed description of the action]",
    "impact": "[Brief impact assessment]",
    "action_type": "[redirect | hold | staff_deploy | advisory]"
  },
  ...
]`;

  try {
    const responseText = await generateContent(prompt, 'You are an ops mitigation AI returning strict JSON arrays.', true);
    const data = JSON.parse(responseText.trim().replace(/^```json/i, '').replace(/```$/i, ''));
    return data;
  } catch (err) {
    console.error('LLM mitigation generation failed:', err);
    // Fallback to static if LLM fails
    return [
      {
        label: 'Option A: Deploy Additional Staff',
        description: `Send 6 additional staff to ${alert.zone_name || 'affected area'} for crowd management.`,
        impact: 'Low disruption, gradual improvement.',
        action_type: 'staff_deploy',
      },
      {
        label: 'Option B: Broadcast Advisory',
        description: `Issue multilingual PA advisory about ${alert.zone_name || 'affected area'}.`,
        impact: 'No disruption, relies on fan compliance.',
        action_type: 'advisory',
      },
    ];
  }
}

/**
 * Selects a mitigation option (organizer decision).
 * @param {string} optionId - The mitigation option ID
 * @param {string} selectedBy - Who selected it
 * @returns {object} Updated mitigation action
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function selectMitigationOption(optionId, selectedBy = 'ops_organizer') {
  const db = getDb();

  const option = db.prepare('SELECT * FROM mitigation_actions WHERE id = ?').get(optionId);
  if (!option) return { error: true, message: 'Option not found' };

  // Mark selected option
  db.prepare(`
    UPDATE mitigation_actions SET status = 'selected', selected_by = ?, selected_at = datetime('now')
    WHERE id = ?
  `).run(selectedBy, optionId);

  // Reject other options for the same alert
  db.prepare(`
    UPDATE mitigation_actions SET status = 'rejected'
    WHERE alert_id = ? AND id != ? AND status = 'proposed'
  `).run(option.alert_id, optionId);

  // Acknowledge the alert
  db.prepare(`
    UPDATE alerts SET status = 'acknowledged' WHERE id = ?
  `).run(option.alert_id);

  return {
    ...option,
    status: 'selected',
    selected_by: selectedBy,
  };
}

/**
 * Gets comprehensive ops dashboard data.
 * @returns {object} Dashboard data with stats, alerts, actions
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getOpsDashboard() {
  const db = getDb();

  const totalFans = db.prepare('SELECT SUM(current_occupancy) as total FROM zones').get();
  const totalCapacity = db.prepare('SELECT SUM(capacity) as total FROM zones').get();
  const activeAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE status = "active"').get();
  const criticalZones = db.prepare('SELECT COUNT(*) as count FROM zones WHERE status = "critical"').get();
  const warningZones = db.prepare('SELECT COUNT(*) as count FROM zones WHERE status = "warning"').get();

  const recentAlerts = db.prepare(`
    SELECT a.*, z.name as zone_name
    FROM alerts a LEFT JOIN zones z ON z.id = a.zone_id
    ORDER BY a.created_at DESC LIMIT 10
  `).all();

  const pendingActions = db.prepare(`
    SELECT ma.*, a.zone_id, z.name as zone_name
    FROM mitigation_actions ma
    JOIN alerts a ON a.id = ma.alert_id
    LEFT JOIN zones z ON z.id = a.zone_id
    WHERE ma.status = 'proposed'
  `).all();

  return {
    stats: {
      totalFans: totalFans?.total || 0,
      totalCapacity: totalCapacity?.total || 0,
      occupancyPct: totalCapacity?.total ? Math.round((totalFans?.total / totalCapacity.total) * 100) : 0,
      activeAlerts: activeAlerts?.count || 0,
      criticalZones: criticalZones?.count || 0,
      warningZones: warningZones?.count || 0,
    },
    recentAlerts,
    pendingActions,
  };
}

/**
 * Handles an ops command request from the orchestrator.
 * @param {{ action: string, alertId?: string, optionId?: string }} request
 * @returns {Promise<object>} Ops response
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export async function handleOpsRequest(request) {
  const { action = 'dashboard', alertId, optionId, selectedBy } = request;

  switch (action) {
    case 'dashboard':
      return getOpsDashboard();
    case 'mitigate':
      if (!alertId) return { error: true, message: 'alertId required' };
      return await generateMitigationOptions(alertId);
    case 'select':
      if (!optionId) return { error: true, message: 'optionId required' };
      return selectMitigationOption(optionId, selectedBy);
    default:
      return getOpsDashboard();
  }
}
