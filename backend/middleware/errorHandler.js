import { AgentError } from '../utils/errorWrapper.js';
import { ZodError } from 'zod';
import { logger } from './googleCloudLogger.js';

/**
 * Global error handler middleware for Express API routes.
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
// eslint-disable-next-line no-unused-vars
export function globalErrorHandler(err, req, res, next) {
  logger.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof AgentError) {
    return res.status(err.statusCode).json({
      error: true,
      code: err.code,
      message: err.message,
    });
  }

  // Handle express-validator or general errors
  res.status(500).json({
    error: true,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred while processing your request.',
  });
}
