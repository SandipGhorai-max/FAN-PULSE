/**
 * @module agents/navigator
 * @description 🧭 Navigator Agent — Routes fans to gates/seats via shortest path.
 * Uses Dijkstra's algorithm on the Stadium Context Graph with congestion-aware weights.
 */

import { getDb } from '../db/schema.js';

/**
 * Builds the adjacency graph from zone_connections, weighted by distance × congestion.
 * @returns {Map<string, Array<{to: string, weight: number}>>} Adjacency list
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function buildGraph() {
  const db = getDb();
  const connections = db.prepare(`
    SELECT zc.from_zone_id, zc.to_zone_id, zc.distance, zc.current_flow_rate,
           z.status AS to_status
    FROM zone_connections zc
    JOIN zones z ON z.id = zc.to_zone_id
  `).all();

  const graph = new Map();

  for (const conn of connections) {
    if (!graph.has(conn.from_zone_id)) graph.set(conn.from_zone_id, []);

    // Closed zones get infinite weight; congested zones get penalized
    let weight = conn.distance / Math.max(conn.current_flow_rate, 0.1);
    if (conn.to_status === 'closed') weight = Infinity;
    else if (conn.to_status === 'critical') weight *= 3.0;
    else if (conn.to_status === 'warning') weight *= 1.5;

    graph.get(conn.from_zone_id).push({ to: conn.to_zone_id, weight });
  }

  return graph;
}

/**
 * Dijkstra's shortest path algorithm.
 * @param {string} startId - Starting zone ID
 * @param {string} endId - Destination zone ID
 * @param {object} [options] - Options
 * @param {boolean} [options.accessibleOnly] - Only use accessible paths
 * @returns {{ path: string[], distance: number, zones: object[] } | null}
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function findShortestPath(startId, endId, options = {}) {
  const db = getDb();
  const { accessibleOnly = false } = options;

  let query = `
    SELECT zc.from_zone_id, zc.to_zone_id, zc.distance, zc.current_flow_rate,
           zc.is_accessible, z.status AS to_status
    FROM zone_connections zc
    JOIN zones z ON z.id = zc.to_zone_id
  `;
  if (accessibleOnly) query += ' WHERE zc.is_accessible = 1';

  const connections = db.prepare(query).all();
  const graph = new Map();

  for (const conn of connections) {
    if (!graph.has(conn.from_zone_id)) graph.set(conn.from_zone_id, []);
    let weight = conn.distance / Math.max(conn.current_flow_rate, 0.1);
    if (conn.to_status === 'closed') weight = Infinity;
    else if (conn.to_status === 'critical') weight *= 3.0;
    else if (conn.to_status === 'warning') weight *= 1.5;
    graph.get(conn.from_zone_id).push({ to: conn.to_zone_id, weight });
  }

  // Dijkstra
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  // Initialize distances
  for (const nodeId of graph.keys()) {
    dist.set(nodeId, Infinity);
  }
  // Also add nodes that only appear as targets
  for (const conn of connections) {
    if (!dist.has(conn.to_zone_id)) dist.set(conn.to_zone_id, Infinity);
  }

  dist.set(startId, 0);

  while (true) {
    // Find unvisited node with minimum distance
    let minDist = Infinity;
    let current = null;
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < minDist) {
        minDist = d;
        current = node;
      }
    }

    if (current === null || current === endId) break;
    visited.add(current);

    const neighbors = graph.get(current) || [];
    for (const { to, weight } of neighbors) {
      if (visited.has(to)) continue;
      const alt = dist.get(current) + weight;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, current);
      }
    }
  }

  // Reconstruct path
  if (!dist.has(endId) || dist.get(endId) === Infinity) return null;

  const path = [];
  let step = endId;
  while (step) {
    path.unshift(step);
    step = prev.get(step) || null;
  }

  if (path[0] !== startId) return null;

  // Fetch zone details for the path
  const zoneDetails = db.prepare(
    `SELECT * FROM zones WHERE id IN (${path.map(() => '?').join(',')})`
  ).all(...path);

  const zoneMap = new Map(zoneDetails.map(z => [z.id, z]));
  const zones = path.map(id => zoneMap.get(id)).filter(Boolean);

  return {
    path,
    distance: Math.round(dist.get(endId) * 10) / 10,
    zones,
    estimated_walk_minutes: Math.round(dist.get(endId) * 1.2),
  };
}

/**
 * Processes a navigation request from a fan.
 * @param {{ from: string, to: string, accessible?: boolean }} request
 * @returns {object} Navigation response with path and directions
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function handleNavigationRequest(request) {
  const { from, to, accessible = false } = request;
  const db = getDb();

  // Validate zones exist
  const fromZone = db.prepare('SELECT * FROM zones WHERE id = ?').get(from);
  const toZone = db.prepare('SELECT * FROM zones WHERE id = ?').get(to);

  if (!fromZone) return { error: true, message: `Unknown zone: ${from}` };
  if (!toZone) return { error: true, message: `Unknown zone: ${to}` };

  const result = findShortestPath(from, to, { accessibleOnly: accessible });

  if (!result) {
    return {
      error: true,
      message: `No ${accessible ? 'accessible ' : ''}path found from ${fromZone.name} to ${toZone.name}. Try a different route.`,
    };
  }

  // Generate human-readable directions
  const directions = result.zones.map((zone, i) => {
    if (i === 0) return `Start at ${zone.name}`;
    if (i === result.zones.length - 1) return `Arrive at ${zone.name}`;
    const congestionNote = zone.status === 'warning' ? ' ⚠️ (moderately busy)' : zone.status === 'critical' ? ' 🔴 (very crowded — hurry through)' : '';
    return `Continue through ${zone.name}${congestionNote}`;
  });

  return {
    error: false,
    from: fromZone.name,
    to: toZone.name,
    path: result.path,
    distance: result.distance,
    estimated_walk_minutes: result.estimated_walk_minutes,
    directions,
    accessible,
    zones: result.zones.map(z => ({ id: z.id, name: z.name, status: z.status })),
  };
}

/**
 * Gets reroute suggestions when a zone becomes congested.
 * @param {string} congestedZoneId - The zone to avoid
 * @returns {object[]} Alternative routes for affected fans
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getRerouteSuggestions(congestedZoneId) {
  const db = getDb();

  // Find zones connected to the congested zone
  const affected = db.prepare(`
    SELECT DISTINCT from_zone_id FROM zone_connections WHERE to_zone_id = ?
  `).all(congestedZoneId);

  const suggestions = [];
  const destinations = db.prepare(`SELECT id FROM zones WHERE type = 'section'`).all();

  for (const { from_zone_id: fromId } of affected.slice(0, 3)) {
    for (const dest of destinations.slice(0, 2)) {
      const route = findShortestPath(fromId, dest.id);
      if (route && !route.path.includes(congestedZoneId)) {
        suggestions.push({
          from: fromId,
          to: dest.id,
          ...route,
        });
        break;
      }
    }
  }

  return suggestions;
}
