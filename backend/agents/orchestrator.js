/**
 * @module agents/orchestrator
 * @description 🧠 Orchestrator LLM — Routes fan/volunteer/organizer requests to specialist agents.
 * Includes prompt-injection defense, intent classification, and response caching.
 */

import { handleNavigationRequest } from './navigator.js';
import { handleAccessRequest } from './accessCompanion.js';
import { handleTransitRequest } from './transitCopilot.js';
import { handleGreenRequest } from './greenOps.js';
// handlePolyglotRequest was imported here
import { handleOpsRequest } from './opsCommandCopilot.js';
import { getDensityOverview, getActiveAlerts } from './crowdSentinel.js';

/**
 * System prompt — hardcoded and immutable. User text cannot override this.
 */
// SYSTEM_RULES was here

/**
 * Prompt injection detection patterns.
 * @type {RegExp[]}
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|prompts)/i,
  /reveal\s+(your\s+)?(system\s+)?(prompt|instructions|rules)/i,
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(if\s+you\s+are|a)\s+/i,
  /disregard\s+(all|your|the)\s+/i,
  /override\s+(your|the|all)\s+/i,
  /forget\s+(everything|all|your)\s+/i,
  /new\s+instructions?\s*:/i,
  /\bDAN\b.*\bmode\b/i,
  /jailbreak/i,
];

/** Simple LRU-ish response cache */
const responseCache = new Map();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if user input contains prompt injection attempts.
 * @param {string} text - User input text
 * @returns {boolean} True if injection detected
 */
export function detectPromptInjection(text) {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

import { generateContent } from '../utils/llm.js';

/**
 * Classifies user intent from natural language input.
 * @param {string} text - User input text
 * @returns {Promise<{ agent: string, intent: string, params: object }>}
 */
export async function classifyIntent(text) {
  const prompt = `Classify the following user request into one of the FanPulse AI agent intents.
  
Available agents and their intents:
1. navigator: 'navigate' (finding routes to gates, sections, food)
2. crowd_sentinel: 'check_density' (asking about crowds, queues, congestion)
3. access_companion: 'accessible_route' (wheelchair access) or 'quiet_zones' (sensory quiet areas)
4. transit_copilot: 'transit_info' (train, bus, uber, leaving stadium)
5. green_ops: 'sustainability' (recycling, carbon footprint)
6. polyglot: 'translate' (asking for translation or speaking in non-English)
7. ops_copilot: 'dashboard' (staff/organizer asking for status or alerts)
8. general: 'help' (anything else)

Respond strictly in JSON format matching this schema:
{
  "agent": "agent_name",
  "intent": "intent_name",
  "params": {} // extract any relevant parameters like 'destination', 'type', 'lowCarbon'
}

User request: "${text}"`;

  try {
    const responseText = await generateContent(prompt, 'You are a strict JSON intent classifier.', true);
    // Parse the JSON response
    const data = JSON.parse(responseText.trim().replace(/^```json/i, '').replace(/```$/i, ''));
    return data;
  } catch (err) {
    console.error('LLM intent classification failed or API key missing:', err.message, 'Using rule-based fallback.');
    const lower = text.toLowerCase();
    if (lower.match(/navigate|route|go to|find|where is|seat|food|gate|section/)) return { agent: 'navigator', intent: 'navigate', params: { destination: text } };
    if (lower.match(/crowd|density|busy|full|surge|queue|wait/)) return { agent: 'crowd_sentinel', intent: 'check_density', params: {} };
    if (lower.match(/wheelchair|accessible|quiet|sensory|disability/)) return { agent: 'access_companion', intent: 'accessible_route', params: { type: lower.includes('quiet') ? 'quiet_zones' : 'facilities' } };
    if (lower.match(/transit|train|bus|uber|leave|parking|subway/)) return { agent: 'transit_copilot', intent: 'transit_info', params: {} };
    if (lower.match(/green|recycle|carbon|sustainab/)) return { agent: 'green_ops', intent: 'sustainability', params: {} };
    if (lower.match(/dashboard|stats|organizer/)) return { agent: 'ops_copilot', intent: 'dashboard', params: {} };
    return { agent: 'general', intent: 'help', params: {} };
  }
}

/**
 * Routes a request to the appropriate specialist agent.
 * @param {{ message: string, from?: string, role?: string }} request
 * @returns {Promise<object>} Agent response
 */
export async function routeRequest(request) {
  const { message, from, role = 'fan' } = request;

  if (!message || typeof message !== 'string') {
    return {
      agent: 'orchestrator',
      response: 'Please enter a message so I can help you!',
      type: 'error',
    };
  }

  // 1. Prompt injection check
  if (detectPromptInjection(message)) {
    return {
      agent: 'orchestrator',
      response: "I'm FanPulse AI, here to help you enjoy the World Cup! 🏟️ I can help with navigation, crowd info, transit, accessibility, and more. What would you like to know?",
      type: 'safety_block',
      blocked: true,
    };
  }

  // 2. Check cache
  const cacheKey = `${message.toLowerCase().trim().slice(0, 100)}:${from || ''}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  // 3. Classify intent
  const classification = await classifyIntent(message);

  // 4. Route to agent
  let result;
  try {
    result = await dispatchToAgent(classification, { message, from, role });
  } catch (err) {
    console.error('Dispatch error:', err);
    result = {
      agent: 'orchestrator',
      response: `I encountered an issue processing your request. Please try again or ask a staff member for help.`,
      type: 'error',
    };
  }

  // 5. Cache result
  if (responseCache.size >= CACHE_MAX_SIZE) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}

/**
 * Dispatches to the correct specialist agent.
 * @param {{ agent: string, intent: string, params: object }} classification
 * @param {{ message: string, from?: string, role?: string }} context
 * @returns {Promise<object>} Agent response
 */
async function dispatchToAgent(classification, context) {
  const { agent, params } = classification;

  switch (agent) {
    case 'navigator': {
      // Try to extract from/to from context
      const fromZone = context.from || 'gate-a';
      const toZone = params.destination || 'section-100';

      // Match zone IDs from text
      const zoneId = matchZoneFromText(toZone);
      const nav = await handleNavigationRequest({
        from: fromZone,
        to: zoneId || 'section-100',
      });

      return {
        agent: 'navigator',
        icon: '🧭',
        response: nav.error
          ? nav.message
          : `📍 **Route found!**\n${nav.directions.join('\n→ ')}\n\n⏱ Estimated walk: ${nav.estimated_walk_minutes} min`,
        data: nav,
        type: 'navigation',
      };
    }

    case 'crowd_sentinel': {
      const overview = await getDensityOverview();
      const alerts = await getActiveAlerts();
      const hotspots = overview.filter(z => z.density > 0.7);

      let response = '👁️ **Current Crowd Status:**\n';
      if (hotspots.length === 0) {
        response += '✅ All zones are at comfortable levels. Enjoy the match!\n';
      } else {
        response += hotspots.map(z =>
          `${z.status === 'critical' ? '🔴' : '🟡'} ${z.name}: ${Math.round(z.density * 100)}% capacity`
        ).join('\n');
      }
      if (alerts.length > 0) {
        response += `\n\n⚠️ ${alerts.length} active alert(s). Staff are managing the situation.`;
      }

      return { agent: 'crowd_sentinel', icon: '👁️', response, data: { overview, alerts }, type: 'crowd' };
    }

    case 'access_companion': {
      const accessResult = await handleAccessRequest({
        type: params.type || 'facilities',
        from: context.from,
      });

      let response = '♿ **Accessibility Info:**\n';
      if (params.type === 'quiet_zones') {
        const zones = accessResult.quietZones || [];
        response += zones.map(z =>
          `🤫 ${z.name} — ${z.occupancy_pct}% occupied (capacity: ${z.capacity})`
        ).join('\n') || 'Quiet zones are available. Ask staff for directions.';
      } else {
        response += 'Accessible routes, quiet zones, and wheelchair-friendly gates are available. How can I help specifically?';
      }

      return { agent: 'access_companion', icon: '♿', response, data: accessResult, type: 'accessibility' };
    }

    case 'transit_copilot': {
      const transit = await handleTransitRequest({
        action: 'recommend',
        lowCarbon: params.lowCarbon,
      });

      let response = '🚌 **Transit Options:**\n';
      response += transit.recommendation + '\n\n';
      response += transit.routes.slice(0, 4).map(r =>
        `${getModeIcon(r.mode)} ${r.name} — ${r.adjusted_eta_minutes} min ${r.surge_level !== 'normal' ? `⚡ ${r.surge_level}` : ''}`
      ).join('\n');

      return { agent: 'transit_copilot', icon: '🚌', response, data: transit, type: 'transit' };
    }

    case 'green_ops': {
      const green = await handleGreenRequest({ action: 'dashboard' });

      return {
        agent: 'green_ops',
        icon: '🌱',
        response: `🌱 **Sustainability Dashboard**\nGreen Score: ${green.overallScore}/100 🌍\n♻️ Recycling rate: ${green.metrics.waste_recycled_pct?.value || 0}%\n🚋 Fans using transit: ${green.metrics.fans_using_transit?.value?.toLocaleString() || 0}\n💨 Carbon saved: ${green.metrics.total_carbon_saved_kg?.value || 0}kg`,
        data: green,
        type: 'sustainability',
      };
    }

    case 'polyglot': {
      try {
        const polyglotPrompt = `You are a multilingual assistant for FanPulse AI. The user says: "${context.message}". 
        Translate or respond to their query in their original language. Keep it brief and helpful.`;
        const llmResponse = await generateContent(polyglotPrompt, 'You are a multilingual concierge.');
        return {
          agent: 'polyglot',
          icon: '🌍',
          response: llmResponse,
          type: 'language',
        };
      } catch (err) {
        console.error('Polyglot agent error:', err);
        return {
          agent: 'polyglot',
          icon: '🌍',
          response: '🌍 **Multilingual Support Available!**\nI can communicate in:\n🇺🇸 English\n🇪🇸 Español\n🇫🇷 Français\n🇰🇷 한국어\n🇸🇦 العربية\n\nJust ask your question in any language!',
          type: 'language',
        };
      }
    }

    case 'ops_copilot': {
      const ops = await handleOpsRequest({ action: 'dashboard' });
      return {
        agent: 'ops_copilot',
        icon: '🧑‍✈️',
        response: `🧑‍✈️ **Ops Dashboard**\n👥 Total fans: ${ops.stats.totalFans.toLocaleString()} (${ops.stats.occupancyPct}%)\n🚨 Active alerts: ${ops.stats.activeAlerts}\n🔴 Critical zones: ${ops.stats.criticalZones}\n🟡 Warning zones: ${ops.stats.warningZones}`,
        data: ops,
        type: 'ops',
      };
    }

    default:
      try {
        const genPrompt = `You are FanPulse AI, a helpful virtual assistant for the FIFA World Cup 2026. 
        A fan asked: "${context.message}". 
        Give a polite and helpful response guiding them on how you can help (navigation, crowd conditions, transit, accessibility).`;
        const llmResponse = await generateContent(genPrompt, 'You are a helpful World Cup assistant.');
        return {
          agent: 'orchestrator',
          icon: '⚽',
          response: llmResponse,
          type: 'general',
        };
      } catch (err) {
        console.error('General agent error:', err);
        return {
          agent: 'orchestrator',
          icon: '⚽',
          response: "⚽ **Welcome to FanPulse AI!** I can help with navigation, crowd conditions, transit, and accessibility.\n\nTry asking me:\n- *\"How do I get to Gate A?\"*\n- *\"Is the West Concourse crowded?\"*\n- *\"Where are the quiet zones?\"*",
          type: 'general',
        };
      }
  }
}

/**
 * Matches free-text zone descriptions to zone IDs.
 * @param {string} text - Zone description
 * @returns {string | null} Matched zone ID
 */
function matchZoneFromText(text) {
  const lower = text.toLowerCase();

  const zoneMap = {
    'gate a': 'gate-a', 'gate b': 'gate-b', 'gate c': 'gate-c',
    'gate d': 'gate-d', 'gate e': 'gate-e', 'gate f': 'gate-f',
    'north concourse': 'concourse-north', 'south concourse': 'concourse-south',
    'east concourse': 'concourse-east', 'west concourse': 'concourse-west',
    'section 100': 'section-100', 'section 200': 'section-200',
    'section 300': 'section-300', 'section 400': 'section-400',
    'food': 'concession-n1', 'concession': 'concession-n1',
    'medical': 'medical-east', 'first aid': 'medical-east',
    'accessible': 'accessible-viewing', 'quiet': 'quiet-zone-nw',
  };

  for (const [key, id] of Object.entries(zoneMap)) {
    if (lower.includes(key)) return id;
  }

  return null;
}

/**
 * Gets an icon for a transit mode.
 * @param {string} mode - Transit mode
 * @returns {string} Emoji icon
 */
function getModeIcon(mode) {
  const icons = { train: '🚂', subway: '🚇', bus: '🚌', rideshare: '🚗', walk: '🚶' };
  return icons[mode] || '🚏';
}

/**
 * Clears the response cache (for testing).
 */
export function clearCache() {
  responseCache.clear();
}
