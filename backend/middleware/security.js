/**
 * @module middleware/security
 * @description Security middleware — Helmet, CORS, rate limiting.
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

/**
 * Configures Helmet security headers.
 * @returns {import('express').RequestHandler} Helmet middleware
 */
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
  });
}

export const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL || 'https://fanpulse.app']
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

/**
 * Configures CORS with explicit origin whitelist.
 * @returns {import('express').RequestHandler} CORS middleware
 */
export function configureCors() {
  return cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}

/**
 * Configures rate limiting for the chat endpoint.
 * @returns {import('express').RequestHandler} Rate limiter middleware
 */
export function configureChatRateLimit() {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    message: {
      error: 'Too many requests. Please wait a moment before trying again.',
      retryAfter: '60 seconds',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Configures a general rate limiter for all API endpoints.
 * @returns {import('express').RequestHandler} Rate limiter middleware
 */
export function configureGeneralRateLimit() {
  return rateLimit({
    windowMs: 60000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  });
}
