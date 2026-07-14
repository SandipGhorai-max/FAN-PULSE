/**
 * @module demo/crowdSurgeDemo
 * @description 🚨 Crowd Surge Demo — Scripted, replayable scenario.
 * Orchestrates a realistic crowd surge event across multiple agents with timed events.
 */

import { getDb } from '../db/schema.js';
import { recordDensityReading, resolveAlert } from '../agents/crowdSentinel.js';
import { generateMitigationOptions, selectMitigationOption } from '../agents/opsCommandCopilot.js';
import { getRerouteSuggestions } from '../agents/navigator.js';
import { generatePAAnnouncement } from '../agents/polyglotConcierge.js';
import { seedDatabase } from '../db/seed.js';

/** Demo state */
let demoState = {
  running: false,
  step: 0,
  alertId: null,
  mitigationOptions: null,
  selectedOptionId: null,
};

/**
 * Resets demo state and re-seeds the database.
 */
export function resetDemo() {
  seedDatabase();
  demoState = { running: false, step: 0, alertId: null, mitigationOptions: null, selectedOptionId: null };
}

/**
 * Starts the crowd surge demo sequence.
 * Emits Socket.IO events at each step for real-time UI updates.
 * @param {import('socket.io').Server} io - Socket.IO server
 * @returns {{ success: boolean, message: string }}
 */
export function startCrowdSurgeDemo(io) {
  if (demoState.running) {
    return { success: false, message: 'Demo is already running. Reset first.' };
  }

  resetDemo();
  demoState.running = true;
  demoState.step = 0;

  io.emit('demo:started', { message: '🚨 Crowd Surge Demo started!', timestamp: new Date().toISOString() });

  // Step 1: Density spike on West Concourse (T+0)
  setTimeout(() => {
    if (!demoState.running) return;
    demoState.step = 1;

    // Gradually increase density
    recordDensityReading('concourse-west', 0.72);

    io.emit('demo:step', {
      step: 1,
      title: 'Density Rising',
      description: 'West Concourse density climbing to 72%...',
      zone: 'concourse-west',
      density: 0.72,
    });
    io.emit('zones:updated', { zoneId: 'concourse-west' });
  }, 500);

  // Step 2: Density spikes to critical (T+1.5s)
  setTimeout(() => {
    if (!demoState.running) return;
    demoState.step = 2;

    const { alert } = recordDensityReading('concourse-west', 0.92);
    if (alert) {
      demoState.alertId = alert.id;
    }

    io.emit('demo:step', {
      step: 2,
      title: '🔴 CRITICAL: Crowd Surge Detected!',
      description: 'West Concourse at 92% capacity! Crowd Sentinel has triggered a CRITICAL alert.',
      zone: 'concourse-west',
      density: 0.92,
      alert,
    });
    io.emit('zones:updated', { zoneId: 'concourse-west' });
    if (alert) {
      io.emit('alert:new', alert);
    }
  }, 2000);

  // Step 3: Ops Copilot generates mitigation options (T+3.5s)
  setTimeout(() => {
    if (!demoState.running || !demoState.alertId) return;
    demoState.step = 3;

    const mitigation = generateMitigationOptions(demoState.alertId);
    demoState.mitigationOptions = mitigation.options;

    io.emit('demo:step', {
      step: 3,
      title: '🧑‍✈️ Ops Copilot: Mitigation Options Ready',
      description: 'Two mitigation strategies proposed. Waiting for organizer decision...',
      options: mitigation.options,
      alertId: demoState.alertId,
    });
    io.emit('mitigation:options', {
      alertId: demoState.alertId,
      options: mitigation.options,
    });
  }, 4000);

  return {
    success: true,
    message: '🚨 Crowd Surge Demo started! Watch the Ops View for real-time updates.',
    demoId: Date.now().toString(),
  };
}

/**
 * Handles organizer selection of a mitigation option during the demo.
 * Continues the demo sequence: reroute → PA announcement → resolution.
 * @param {string} optionId - Selected mitigation option ID
 * @param {import('socket.io').Server} io - Socket.IO server
 * @returns {object} Selection result
 */
export function selectDemoMitigation(optionId, io) {
  if (!demoState.running) {
    return { success: false, message: 'No demo running.' };
  }

  demoState.selectedOptionId = optionId;
  demoState.step = 4;

  // Select the option
  const selected = selectMitigationOption(optionId, 'ops_organizer');

  io.emit('demo:step', {
    step: 4,
    title: '✅ Mitigation Selected',
    description: `Organizer selected: ${selected.option_label}. Executing...`,
    selectedOption: selected,
  });
  io.emit('mitigation:selected', { optionId, selected });

  // Step 5: Navigator reroutes fans (T+click+1.5s)
  setTimeout(() => {
    if (!demoState.running) return;
    demoState.step = 5;

    // Update zone weights to reflect rerouting
    const db = getDb();
    db.prepare(`
      UPDATE zone_connections SET current_flow_rate = 0.3
      WHERE to_zone_id = 'concourse-west'
    `).run();
    db.prepare(`
      UPDATE zone_connections SET current_flow_rate = 1.5
      WHERE to_zone_id = 'concourse-east' OR to_zone_id = 'concourse-north'
    `).run();

    const reroutes = getRerouteSuggestions('concourse-west');

    io.emit('demo:step', {
      step: 5,
      title: '🧭 Navigator: Fans Being Rerouted',
      description: 'Navigator is rerouting fans away from West Concourse via East and North corridors.',
      reroutes,
    });
    io.emit('navigation:reroute', { congestedZone: 'concourse-west', reroutes });
  }, 2000);

  // Step 6: Polyglot Concierge fires multilingual PA (T+click+3.5s)
  setTimeout(() => {
    if (!demoState.running) return;
    demoState.step = 6;

    const announcement = generatePAAnnouncement(
      'crowd_redirect',
      { zone: 'West Concourse', altRoute: 'East Concourse and North Concourse' },
      'concourse-west',
      'urgent'
    );

    io.emit('demo:step', {
      step: 6,
      title: '🌍 Polyglot: Multilingual PA Broadcast',
      description: 'PA announcement fired in 5 languages: English, Spanish, French, Korean, Arabic.',
      announcement,
    });
    io.emit('pa:announcement', announcement);
  }, 4500);

  // Step 7: Density decreases, resolution (T+click+6s)
  setTimeout(() => {
    if (!demoState.running) return;
    demoState.step = 7;

    // Simulate crowd dispersal
    recordDensityReading('concourse-west', 0.65);
    const db = getDb();
    db.prepare(`UPDATE zones SET status = 'normal' WHERE id = 'concourse-west'`).run();

    // Resolve the alert
    if (demoState.alertId) {
      resolveAlert(demoState.alertId, 'ops_organizer');
    }

    // Mark mitigation as completed
    if (demoState.selectedOptionId) {
      db.prepare(`UPDATE mitigation_actions SET status = 'completed', outcome = 'Density reduced to 65%. Crisis averted.' WHERE id = ?`)
        .run(demoState.selectedOptionId);
    }

    // Reset flow rates
    db.prepare(`UPDATE zone_connections SET current_flow_rate = 1.0`).run();

    io.emit('demo:step', {
      step: 7,
      title: '✅ Crisis Resolved!',
      description: 'West Concourse density dropped to 65%. Alert resolved. Crowd flow normalized.',
      density: 0.65,
    });
    io.emit('zones:updated', { zoneId: 'concourse-west' });
    io.emit('demo:completed', {
      message: '🎉 Crowd Surge Demo completed successfully! All agents collaborated to resolve the crisis.',
      timestamp: new Date().toISOString(),
    });

    demoState.running = false;
  }, 7500);

  return { success: true, message: 'Mitigation selected. Demo continuing...' };
}

/**
 * Gets current demo state.
 * @returns {object} Current demo state
 */
export function getDemoState() {
  return { ...demoState };
}

/**
 * Stops the demo.
 */
export function stopDemo() {
  demoState.running = false;
  demoState.step = 0;
}
