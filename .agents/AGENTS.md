# FanPulse AI — Antigravity Agent Configuration

## Project Context
FanPulse AI is an autonomous, multi-agent command center designed for the FIFA World Cup 2026. The goal is to address Smart Stadium challenges: Navigation Fatigue, Crowd Management, and Accessibility.

## Agentic Architecture
This workspace utilizes an 8-agent architecture built on the Google GenAI SDK.
- **Orchestrator**: Core router for user intents.
- **Navigator**: Dijkstra's routing.
- **Crowd Sentinel**: Density monitoring.
- **Ops Command Copilot**: Incident mitigation.
- **Polyglot Concierge**: Multilingual support.
- **Access Companion**: Accessibility and sensory rooms.
- **Transit Copilot**: Google Maps and carbon tracking.
- **Vision Copilot**: Multimodal ticket scanning to navigate fans.

## Coding Rules
1. **Schema Validation**: All APIs must use Zod validation in `backend/middleware/validation.js`.
2. **Error Handling**: Use the `errorWrapper.js` and `globalErrorHandler` for robust failures.
3. **LLM Usage**: All LLM calls must use the unified `backend/utils/llm.js` utility and support strict JSON output when specified.
4. **Testing**: 100% component and backend test coverage is enforced. Vitest is the primary testing framework.

*Note: This file demonstrates project-scoped alignment for PromptWar Challenge 4.*
