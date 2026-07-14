/**
 * @module middleware/validation
 * @description Input validation using Zod schemas. Sanitizes user text before LLM processing.
 */

import { z } from 'zod';

/** Chat message schema */
export const chatSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long (max 2000 chars)')
    .transform(s => s.trim()),
  from: z.string().max(100).optional(),
  role: z.enum(['fan', 'volunteer', 'organizer']).optional().default('fan'),
});

/** Mitigation selection schema */
export const mitigationSelectSchema = z.object({
  optionId: z.string().uuid('Invalid option ID'),
  selectedBy: z.string().max(100).optional().default('ops_organizer'),
});

/** Zone ID param schema */
export const zoneIdSchema = z.object({
  zoneId: z.string().min(1).max(100),
});

/** Navigation request schema */
export const navigationSchema = z.object({
  from: z.string().min(1).max(100),
  to: z.string().min(1).max(100),
  accessible: z.boolean().optional().default(false),
});

/**
 * Creates an Express middleware that validates request body against a Zod schema.
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {import('express').RequestHandler} Express middleware
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.validated = result.data;
    next();
  };
}

/**
 * Sanitizes text input — strips control characters and excessive whitespace.
 * @param {string} text - Raw input text
 * @returns {string} Sanitized text
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim()
    .slice(0, 2000); // hard length cap
}
