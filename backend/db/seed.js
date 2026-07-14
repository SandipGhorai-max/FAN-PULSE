/**
 * @module db/seed
 * @description Seeds the Stadium Context Graph with realistic MetLife Stadium data.
 * 20+ zones, connections with distances, transit routes, and initial readings.
 */

import { getDb, resetDb } from './schema.js';

/**
 * Seeds the database with MetLife Stadium data for the demo.
 * Can be run standalone or imported.
 */
export function seedDatabase() {
  const db = getDb();
  resetDb();

  /* ─── ZONES ─── */
  const zones = [
    // Gates
    { id: 'gate-a', name: 'Gate A (Main)', type: 'gate', capacity: 800, coord_x: 50, coord_y: 5, is_accessible: 1 },
    { id: 'gate-b', name: 'Gate B (East)', type: 'gate', capacity: 600, coord_x: 90, coord_y: 35, is_accessible: 1 },
    { id: 'gate-c', name: 'Gate C (South)', type: 'gate', capacity: 700, coord_x: 50, coord_y: 95, is_accessible: 1 },
    { id: 'gate-d', name: 'Gate D (West)', type: 'gate', capacity: 600, coord_x: 10, coord_y: 35, is_accessible: 1 },
    { id: 'gate-e', name: 'Gate E (NE VIP)', type: 'gate', capacity: 300, coord_x: 75, coord_y: 10, is_accessible: 1 },
    { id: 'gate-f', name: 'Gate F (NW Accessible)', type: 'gate', capacity: 400, coord_x: 25, coord_y: 10, is_accessible: 1 },

    // Concourses
    { id: 'concourse-north', name: 'North Concourse', type: 'concourse', capacity: 2000, coord_x: 50, coord_y: 20, is_accessible: 1 },
    { id: 'concourse-south', name: 'South Concourse', type: 'concourse', capacity: 2000, coord_x: 50, coord_y: 80, is_accessible: 1 },
    { id: 'concourse-east', name: 'East Concourse', type: 'concourse', capacity: 1500, coord_x: 80, coord_y: 50, is_accessible: 1 },
    { id: 'concourse-west', name: 'West Concourse', type: 'concourse', capacity: 1500, coord_x: 20, coord_y: 50, is_accessible: 1 },

    // Seating Sections
    { id: 'section-100', name: 'Section 100 (Lower North)', type: 'section', capacity: 3000, coord_x: 50, coord_y: 30 },
    { id: 'section-200', name: 'Section 200 (Lower East)', type: 'section', capacity: 3000, coord_x: 70, coord_y: 50 },
    { id: 'section-300', name: 'Section 300 (Lower South)', type: 'section', capacity: 3000, coord_x: 50, coord_y: 70 },
    { id: 'section-400', name: 'Section 400 (Lower West)', type: 'section', capacity: 3000, coord_x: 30, coord_y: 50 },

    // Facilities
    { id: 'concession-n1', name: 'Food Court North', type: 'concession', capacity: 400, coord_x: 40, coord_y: 18 },
    { id: 'concession-s1', name: 'Food Court South', type: 'concession', capacity: 400, coord_x: 60, coord_y: 82 },
    { id: 'medical-east', name: 'Medical Station East', type: 'medical', capacity: 50, coord_x: 85, coord_y: 50, is_accessible: 1 },
    { id: 'medical-west', name: 'Medical Station West', type: 'medical', capacity: 50, coord_x: 15, coord_y: 50, is_accessible: 1 },

    // Accessible & Quiet Zones
    { id: 'accessible-viewing', name: 'Accessible Viewing Platform', type: 'accessible', capacity: 200, coord_x: 50, coord_y: 45, is_accessible: 1, is_quiet_zone: 0 },
    { id: 'quiet-zone-nw', name: 'Sensory Quiet Zone NW', type: 'accessible', capacity: 100, coord_x: 22, coord_y: 25, is_accessible: 1, is_quiet_zone: 1 },
    { id: 'quiet-zone-se', name: 'Sensory Quiet Zone SE', type: 'accessible', capacity: 100, coord_x: 78, coord_y: 75, is_accessible: 1, is_quiet_zone: 1 },
  ];

  const insertZone = db.prepare(`
    INSERT INTO zones (id, name, type, capacity, current_occupancy, coord_x, coord_y, status, is_accessible, is_quiet_zone)
    VALUES (@id, @name, @type, @capacity, @current_occupancy, @coord_x, @coord_y, @status, @is_accessible, @is_quiet_zone)
  `);

  const insertZones = db.transaction((zoneList) => {
    for (const z of zoneList) {
      insertZone.run({
        ...z,
        current_occupancy: Math.floor((z.capacity || 500) * (0.3 + Math.random() * 0.3)),
        status: 'normal',
        is_accessible: z.is_accessible || 0,
        is_quiet_zone: z.is_quiet_zone || 0,
      });
    }
  });
  insertZones(zones);

  /* ─── ZONE CONNECTIONS (bidirectional) ─── */
  const connections = [
    // Gates → Concourses
    ['gate-a', 'concourse-north', 2.0], ['gate-b', 'concourse-east', 2.0],
    ['gate-c', 'concourse-south', 2.0], ['gate-d', 'concourse-west', 2.0],
    ['gate-e', 'concourse-north', 2.5], ['gate-e', 'concourse-east', 3.0],
    ['gate-f', 'concourse-north', 2.5], ['gate-f', 'concourse-west', 3.0],

    // Concourse ring connections
    ['concourse-north', 'concourse-east', 4.0],
    ['concourse-east', 'concourse-south', 4.0],
    ['concourse-south', 'concourse-west', 4.0],
    ['concourse-west', 'concourse-north', 4.0],

    // Concourses → Sections
    ['concourse-north', 'section-100', 1.5],
    ['concourse-east', 'section-200', 1.5],
    ['concourse-south', 'section-300', 1.5],
    ['concourse-west', 'section-400', 1.5],

    // Cross-section connections
    ['section-100', 'section-200', 3.0],
    ['section-200', 'section-300', 3.0],
    ['section-300', 'section-400', 3.0],
    ['section-400', 'section-100', 3.0],

    // Facilities
    ['concourse-north', 'concession-n1', 1.0],
    ['concourse-south', 'concession-s1', 1.0],
    ['concourse-east', 'medical-east', 0.5],
    ['concourse-west', 'medical-west', 0.5],

    // Accessible zones
    ['concourse-north', 'quiet-zone-nw', 2.0],
    ['concourse-west', 'quiet-zone-nw', 1.5],
    ['concourse-east', 'quiet-zone-se', 2.0],
    ['concourse-south', 'quiet-zone-se', 1.5],
    ['concourse-north', 'accessible-viewing', 1.0],
    ['concourse-south', 'accessible-viewing', 1.0],
    ['section-100', 'accessible-viewing', 0.5],
    ['section-300', 'accessible-viewing', 0.5],
  ];

  const insertConn = db.prepare(`
    INSERT OR IGNORE INTO zone_connections (from_zone_id, to_zone_id, distance, is_accessible, current_flow_rate)
    VALUES (?, ?, ?, 1, 1.0)
  `);

  const insertConnections = db.transaction((conns) => {
    for (const [from, to, dist] of conns) {
      insertConn.run(from, to, dist);
      insertConn.run(to, from, dist); // bidirectional
    }
  });
  insertConnections(connections);

  /* ─── TRANSIT ROUTES ─── */
  const transitRoutes = [
    { id: 'nj-transit-rail', name: 'NJ Transit Rail → Meadowlands', mode: 'train', from_location: 'Penn Station NYC', to_location: 'MetLife Stadium', eta_minutes: 35, carbon_kg: 0.8, is_accessible: 1 },
    { id: 'nj-transit-bus', name: 'NJ Transit Bus 160', mode: 'bus', from_location: 'Port Authority NYC', to_location: 'MetLife Stadium', eta_minutes: 45, carbon_kg: 1.2, is_accessible: 1 },
    { id: 'subway-secaucus', name: 'Subway → Secaucus Junction', mode: 'subway', from_location: 'Times Square', to_location: 'Secaucus Junction', eta_minutes: 20, carbon_kg: 0.3, is_accessible: 1 },
    { id: 'rideshare-nyc', name: 'Rideshare from Manhattan', mode: 'rideshare', from_location: 'Manhattan', to_location: 'MetLife Stadium', eta_minutes: 30, carbon_kg: 4.5, is_accessible: 0 },
    { id: 'rideshare-nj', name: 'Rideshare from Newark', mode: 'rideshare', from_location: 'Newark', to_location: 'MetLife Stadium', eta_minutes: 20, carbon_kg: 3.2, is_accessible: 0 },
    { id: 'shuttle-hotel', name: 'FIFA Fan Shuttle', mode: 'bus', from_location: 'Official Fan Hotels', to_location: 'MetLife Stadium', eta_minutes: 25, carbon_kg: 0.9, is_accessible: 1 },
    { id: 'walk-parking', name: 'Walk from Lot K', mode: 'walk', from_location: 'Parking Lot K', to_location: 'Gate A', eta_minutes: 12, carbon_kg: 0, is_accessible: 1 },
  ];

  const insertTransit = db.prepare(`
    INSERT INTO transit_routes (id, name, mode, from_location, to_location, eta_minutes, surge_level, carbon_kg, is_accessible)
    VALUES (@id, @name, @mode, @from_location, @to_location, @eta_minutes, 'normal', @carbon_kg, @is_accessible)
  `);

  const insertTransitRoutes = db.transaction((routes) => {
    for (const r of routes) insertTransit.run(r);
  });
  insertTransitRoutes(transitRoutes);

  /* ─── INITIAL SUSTAINABILITY METRICS ─── */
  const insertMetric = db.prepare(`
    INSERT INTO sustainability_metrics (metric_type, value, unit) VALUES (?, ?, ?)
  `);
  insertMetric.run('total_carbon_saved_kg', 142.5, 'kg');
  insertMetric.run('fans_using_transit', 12450, 'count');
  insertMetric.run('water_stations_active', 24, 'count');
  insertMetric.run('waste_recycled_pct', 67.3, 'percent');

  console.log('✅ Database seeded with MetLife Stadium data');
}

// Run directly if executed as a script
if (process.argv[1] && process.argv[1].includes('seed')) {
  seedDatabase();
}
