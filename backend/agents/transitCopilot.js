/**
 * @module agents/transitCopilot
 * @description 🚌 Transit Copilot Agent — Multi-modal trip planning, surge-aware.
 * Recommends optimal transit to/from the stadium with real-time surge data.
 */

import { getDb } from '../db/schema.js';

/**
 * Gets all transit routes with current conditions.
 * @returns {object[]} Transit routes sorted by ETA
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getAllRoutes() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM transit_routes ORDER BY eta_minutes ASC
  `).all();
}

/**
 * Gets recommended routes based on preferences.
 * @param {{ from?: string, accessible?: boolean, lowCarbon?: boolean }} prefs
 * @returns {object} Recommended routes with reasoning
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getRecommendedRoutes(prefs = {}) {
  const db = getDb();
  const { from, accessible = false, lowCarbon = false } = prefs;

  let query = 'SELECT * FROM transit_routes WHERE 1=1';
  const params = [];

  if (from) {
    query += ' AND LOWER(from_location) LIKE ?';
    params.push(`%${from.toLowerCase()}%`);
  }
  if (accessible) {
    query += ' AND is_accessible = 1';
  }

  query += ' ORDER BY ';
  if (lowCarbon) {
    query += 'carbon_kg ASC, eta_minutes ASC';
  } else {
    query += 'eta_minutes ASC, carbon_kg ASC';
  }

  const routes = db.prepare(query).all(...params);

  // Add surge-adjusted ETAs
  const enrichedRoutes = routes.map(route => {
    let surgeMultiplier = 1.0;
    if (route.surge_level === 'busy') surgeMultiplier = 1.3;
    if (route.surge_level === 'surge') surgeMultiplier = 1.8;

    return {
      ...route,
      adjusted_eta_minutes: Math.round(route.eta_minutes * surgeMultiplier),
      surge_delay_minutes: Math.round(route.eta_minutes * (surgeMultiplier - 1)),
    };
  });

  // Generate recommendation text
  const best = enrichedRoutes[0];
  let recommendation = '';
  if (best) {
    recommendation = lowCarbon
      ? `🌱 Greenest option: ${best.name} — ${best.carbon_kg}kg CO₂, arrives in ~${best.adjusted_eta_minutes} min.`
      : `🚀 Fastest option: ${best.name} — arrives in ~${best.adjusted_eta_minutes} min.`;
  }

  return {
    recommendation,
    routes: enrichedRoutes,
    totalRoutes: enrichedRoutes.length,
  };
}

/**
 * Updates surge level for a transit route.
 * @param {string} routeId - Transit route ID
 * @param {'normal'|'busy'|'surge'} surgeLevel - New surge level
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function updateSurgeLevel(routeId, surgeLevel) {
  const db = getDb();
  db.prepare('UPDATE transit_routes SET surge_level = ? WHERE id = ?')
    .run(surgeLevel, routeId);
}

/**
 * Gets optimal departure recommendation.
 * @param {string} matchTime - Match start time (ISO string)
 * @returns {object} Departure recommendation
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getDepartureRecommendation(matchTime = '19:00') {
  const routes = getAllRoutes();
  const longestEta = Math.max(...routes.map(r => r.eta_minutes));

  return {
    recommendation: `Arrive 90 minutes early for security. Plan to leave ${longestEta + 90} minutes before kickoff.`,
    matchTime,
    suggestedDepartureMinutesBefore: longestEta + 90,
    tip: 'NJ Transit adds extra services on match days. Check njtransit.com for schedules.',
  };
}

/**
 * Handles a transit request from the orchestrator.
 * @param {{ action: string, from?: string, accessible?: boolean, lowCarbon?: boolean }} request
 * @returns {object} Transit response
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function handleTransitRequest(request) {
  const { action = 'recommend', from, accessible, lowCarbon } = request;

  switch (action) {
    case 'all':
      return { routes: getAllRoutes() };
    case 'recommend':
      return getRecommendedRoutes({ from, accessible, lowCarbon });
    case 'departure':
      return getDepartureRecommendation();
    default:
      return getRecommendedRoutes({ from, accessible, lowCarbon });
  }
}
