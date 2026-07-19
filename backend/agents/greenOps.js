/**
 * @module agents/greenOps
 * @description 🌱 GreenOps Agent — Sustainability nudges + carbon tracking.
 * Tracks carbon footprint of transit choices and provides eco-friendly suggestions.
 */

import { getDb } from '../db/schema.js';

/**
 * Gets current sustainability dashboard metrics.
 * @returns {object} Aggregated sustainability data
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getSustainabilityDashboard() {
  const db = getDb();

  const metrics = db.prepare('SELECT * FROM sustainability_metrics ORDER BY timestamp DESC').all();
  const transitModes = db.prepare(`
    SELECT mode,
           COUNT(*) as route_count,
           AVG(carbon_kg) as avg_carbon_kg,
           MIN(carbon_kg) as min_carbon_kg,
           MAX(carbon_kg) as max_carbon_kg
    FROM transit_routes
    GROUP BY mode
  `).all();

  // Calculate carbon savings vs all-rideshare baseline
  const allTransit = db.prepare('SELECT * FROM transit_routes').all();
  const rideshareAvg = allTransit
    .filter(r => r.mode === 'rideshare')
    .reduce((sum, r) => sum + r.carbon_kg, 0) / Math.max(allTransit.filter(r => r.mode === 'rideshare').length, 1);

  const transitSavings = allTransit
    .filter(r => r.mode !== 'rideshare')
    .map(r => ({ mode: r.mode, name: r.name, savings_kg: Math.round((rideshareAvg - r.carbon_kg) * 10) / 10 }));

  return {
    metrics: Object.fromEntries(metrics.map(m => [m.metric_type, { value: m.value, unit: m.unit }])),
    transitModes,
    carbonSavings: transitSavings,
    overallScore: calculateGreenScore(metrics),
  };
}

/**
 * Calculates a 0–100 green score based on current metrics.
 * @param {object[]} metrics - Current sustainability metrics
 * @returns {number} Green score
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
function calculateGreenScore(metrics) {
  const metricMap = Object.fromEntries(metrics.map(m => [m.metric_type, m.value]));
  let score = 50; // baseline

  if (metricMap.waste_recycled_pct > 60) score += 15;
  if (metricMap.fans_using_transit > 10000) score += 20;
  if (metricMap.total_carbon_saved_kg > 100) score += 15;

  return Math.min(100, score);
}

/**
 * Generates a sustainability nudge for a fan based on their transit choice.
 * @param {string} transitMode - The transit mode being considered
 * @returns {object} Nudge message with carbon comparison
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function generateNudge(transitMode) {
  const db = getDb();
  const routes = db.prepare('SELECT * FROM transit_routes WHERE mode = ?').all(transitMode);
  const rideshare = db.prepare('SELECT AVG(carbon_kg) as avg FROM transit_routes WHERE mode = ?').get('rideshare');

  if (!routes.length) {
    return {
      nudge: '🌱 Consider public transit to reduce your carbon footprint!',
      savings: null,
    };
  }

  const avgCarbon = routes.reduce((sum, r) => sum + r.carbon_kg, 0) / routes.length;
  const savings = Math.round((rideshare.avg - avgCarbon) * 10) / 10;

  const nudges = {
    train: `🚂 Great choice! Train saves ~${savings}kg CO₂ vs rideshare. You're helping keep the World Cup green!`,
    subway: `🚇 Metro is the greenest way to travel! You'll save ~${savings}kg CO₂ compared to driving.`,
    bus: `🚌 Buses carry 40+ fans — that's ~${savings}kg CO₂ saved per person vs rideshare!`,
    walk: `🚶 Walking is zero-emission! The ultimate green choice. Arrive refreshed and carbon-free!`,
    rideshare: `🚗 Consider sharing your ride or switching to transit to save up to ${rideshare.avg}kg CO₂!`,
  };

  return {
    nudge: nudges[transitMode] || '🌱 Every green choice counts! Consider public transit.',
    carbon_kg: avgCarbon,
    savings_vs_rideshare_kg: Math.max(0, savings),
    transitMode,
  };
}

/**
 * Records a sustainability event (e.g., fan chose transit over rideshare).
 * @param {string} type - Metric type
 * @param {number} value - Value to record
 * @param {string} unit - Unit of measurement
 * @param {string} [zoneId] - Optional zone
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function recordMetric(type, value, unit, zoneId = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO sustainability_metrics (metric_type, value, unit, zone_id) VALUES (?, ?, ?, ?)
  `).run(type, value, unit, zoneId);
}

/**
 * Handles a GreenOps request from the orchestrator.
 * @param {{ action: string, transitMode?: string }} request
 * @returns {object} Sustainability response
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function handleGreenRequest(request) {
  const { action = 'dashboard', transitMode } = request;

  switch (action) {
    case 'dashboard':
      return getSustainabilityDashboard();
    case 'nudge':
      return generateNudge(transitMode || 'train');
    default:
      return getSustainabilityDashboard();
  }
}
