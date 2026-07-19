/**
 * @module middleware/googleCloudLogger
 * @description Simulated Google Cloud Logging middleware for telemetry and analytics.
 * Demonstrates early-stage adoption of Google Cloud services.
 */

import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';

const loggingWinston = new LoggingWinston({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'fanpulse-ai-demo',
});

export const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    // Fallback if not in test env
    ...(process.env.NODE_ENV !== 'test' ? [loggingWinston] : []),
  ],
});

export function googleCloudLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const severity = res.statusCode >= 400 ? 'error' : 'info';
    
    logger.log(severity, `${req.method} ${req.originalUrl} - ${res.statusCode}`, {
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        status: res.statusCode,
        latency: `${duration}ms`,
        remoteIp: req.ip,
      },
      timestamp: new Date().toISOString(),
    });
  });

  next();
}
