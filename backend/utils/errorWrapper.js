/**
 * @module utils/errorWrapper
 * @description Standardized error wrapper for unified error handling across agents.
 */

export class AgentError extends Error {
  /**
   * @param {string} message - User-facing error message
   * @param {string} code - Internal error code
   * @param {number} status - HTTP-like status code
   */
  constructor(message, code = 'INTERNAL_ERROR', status = 500) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'AgentError';
  }
}

/**
 * Handles errors and returns a standardized response shape.
 * @param {Error} err - The error object
 * @param {string} agentName - Name of the agent where the error occurred
 * @returns {{ status: string, code: string, message: string, agent: string }} Standard error response
 */
export function handleAgentError(err, agentName) {
  console.error(`[${agentName}] Error:`, err);
  if (err instanceof AgentError) {
    return {
      status: 'error',
      code: err.code,
      message: err.message,
      agent: agentName,
    };
  }
  return {
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: `An unexpected error occurred while processing your request.`,
    agent: agentName,
  };
}

/**
 * Wrapper for agent functions to catch errors and return standard shape.
 * @param {string} agentName - Name of the agent
 * @param {Function} fn - Async agent function
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(agentName, fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return handleAgentError(err, agentName);
    }
  };
}
