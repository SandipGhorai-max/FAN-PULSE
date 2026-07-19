/**
 * @module agents/accessCompanion
 * @description ♿ Access Companion Agent — Accessible routing + sensory-quiet zones.
 * Provides wheelchair-accessible paths and sensory-friendly accommodations.
 */

import { getDb } from '../db/schema.js';
import { findShortestPath } from './navigator.js';
import { AgentError } from '../utils/errorWrapper.js';

/**
 * Finds an accessible route between two zones.
 * @param {string} fromId - Starting zone ID
 * @param {string} toId - Destination zone ID
 * @returns {object} Accessible route with special accommodations noted
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function findAccessibleRoute(fromId, toId) {
  const result = findShortestPath(fromId, toId, { accessibleOnly: true });

  if (!result) {
    return {
      error: true,
      message: 'No fully accessible route found. Please contact staff at the nearest information desk for personal assistance.',
      nearestAccessibleGate: getNearestAccessibleGate(fromId),
    };
  }

  // Enrich with accessibility info
  const db = getDb();
  const accessibleFacilities = db.prepare(`
    SELECT * FROM zones
    WHERE is_accessible = 1
    AND id IN (${result.path.map(() => '?').join(',')})
  `).all(...result.path);

  return {
    error: false,
    ...result,
    accessibleFacilities,
    tips: [
      'Elevators are available at all concourse levels.',
      'Accessible restrooms are located near all medical stations.',
      'Staff assistance available — look for volunteers in blue vests.',
    ],
  };
}

/**
 * Gets all sensory-quiet zones with current availability.
 * @returns {object[]} Quiet zones with occupancy info
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getQuietZones() {
  const db = getDb();
  return db.prepare(`
    SELECT id, name, capacity, current_occupancy, coord_x, coord_y,
           ROUND(CAST(current_occupancy AS REAL) / NULLIF(capacity, 0) * 100) as occupancy_pct
    FROM zones
    WHERE is_quiet_zone = 1
    ORDER BY occupancy_pct ASC
  `).all();
}

/**
 * Gets the nearest accessible gate to a given zone.
 * @param {string} zoneId - Current zone ID
 * @returns {object | null} Nearest accessible gate info
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
function getNearestAccessibleGate(zoneId) {
  const db = getDb();
  const gates = db.prepare(`
    SELECT id, name FROM zones WHERE type = 'gate' AND is_accessible = 1
  `).all();

  let nearest = null;
  let shortestDist = Infinity;

  for (const gate of gates) {
    const route = findShortestPath(zoneId, gate.id, { accessibleOnly: true });
    if (route && route.distance < shortestDist) {
      shortestDist = route.distance;
      nearest = { ...gate, distance: route.distance };
    }
  }

  return nearest;
}

/**
 * Gets all accessible facilities (medical, quiet zones, accessible viewing).
 * @returns {object} Categorized accessible facilities
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getAccessibleFacilities() {
  const db = getDb();

  const medical = db.prepare(`SELECT * FROM zones WHERE type = 'medical' AND is_accessible = 1`).all();
  const quietZones = db.prepare(`SELECT * FROM zones WHERE is_quiet_zone = 1`).all();
  const viewing = db.prepare(`SELECT * FROM zones WHERE type = 'accessible'`).all();
  const gates = db.prepare(`SELECT * FROM zones WHERE type = 'gate' AND is_accessible = 1`).all();

  return { medical, quietZones, viewing, accessibleGates: gates };
}

/**
 * Handles a complete accessibility request.
 * @param {{ type: string, from?: string, to?: string }} request
 * @returns {object} Response with accessible routing or facility info
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function handleAccessRequest(request) {
  const { type, from, to } = request;

  switch (type) {
    case 'route':
      if (!from || !to) throw new AgentError('Please provide start and destination zones.', 'INVALID_REQUEST', 400);
      return findAccessibleRoute(from, to);

    case 'quiet_zones':
      return { error: false, quietZones: getQuietZones() };

    case 'facilities':
      return { error: false, facilities: getAccessibleFacilities() };

    default:
      return {
        error: false,
        message: 'I can help with accessible routing, quiet zones, and facility locations. What do you need?',
        options: ['Accessible route', 'Sensory quiet zones', 'Accessible facilities'],
      };
  }
}
