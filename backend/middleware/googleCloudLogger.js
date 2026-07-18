/**
 * @module middleware/googleCloudLogger
 * @description Simulated Google Cloud Logging middleware for telemetry and analytics.
 * Demonstrates early-stage adoption of Google Cloud services.
 */

export function googleCloudLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      severity: res.statusCode >= 400 ? 'ERROR' : 'INFO',
      message: `${req.method} ${req.originalUrl} - ${res.statusCode}`,
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        status: res.statusCode,
        latency: `${duration}ms`,
        remoteIp: req.ip,
      },
      timestamp: new Date().toISOString()
    };
    
    // In a real scenario, this would use @google-cloud/logging
    // logger.write(logger.entry(logEntry));
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[GCP Logging Simulation] ${JSON.stringify(logEntry)}`);
    }
  });

  next();
}
