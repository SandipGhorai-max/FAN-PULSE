/**
 * @module server
 * @description FanPulse AI Backend — Express + Socket.IO server.
 * Entry point for the multi-agent GenAI system.
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { configureHelmet, configureCors, configureGeneralRateLimit, ALLOWED_ORIGINS } from './middleware/security.js';
import { googleCloudLogger, logger } from './middleware/googleCloudLogger.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { chatSchema } from './middleware/validation.js';
import { handleAgentError } from './utils/errorWrapper.js';
import { createApiRouter } from './routes/api.js';
import { seedDatabase } from './db/seed.js';
import { getDb } from './db/schema.js';
import { routeRequest } from './agents/orchestrator.js';
import path from 'path';
import { fileURLToPath } from 'url';
import xss from 'xss-clean';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();
const httpServer = createServer(app);

// Socket.IO — accept all origins for deployment flexibility
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'], // Polling first — works through tunnels
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

/* ─── MIDDLEWARE ─── */
app.use(googleCloudLogger);
app.use(configureHelmet());
app.use(configureCors());
app.use(configureGeneralRateLimit());
app.use(express.json({ limit: '1mb' }));
app.use(xss());

/* ─── ROUTES ─── */
app.use('/api', createApiRouter(io));

if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React frontend app
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  // Catch-all route to serve index.html for React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Global error handler must be the last middleware
app.use(globalErrorHandler);

/* ─── SOCKET.IO ─── */
// Simple in-memory socket rate limiter
const socketRateLimits = new Map();
const SOCKET_RATE_LIMIT_MS = 1000; // 1 msg per sec per socket

io.on('connection', (socket) => {
  logger.info(`🔌 Client connected: ${socket.id}`);

  socket.on('chat:message', async (data) => {
    const now = Date.now();
    const lastMsgTime = socketRateLimits.get(socket.id) || 0;
    if (now - lastMsgTime < SOCKET_RATE_LIMIT_MS) {
      return socket.emit('chat:error', { message: 'Too many requests. Please wait.' });
    }
    socketRateLimits.set(socket.id, now);

    try {
      // Validate with Zod
      const parseResult = chatSchema.safeParse({
        message: data.text || data.message || '',
        from: data.context?.location || data.from || '',
        role: data.context?.role || data.role || 'fan'
      });

      if (!parseResult.success) {
        return socket.emit('chat:error', { message: parseResult.error.issues[0].message });
      }

      const request = parseResult.data;
      const result = await routeRequest(request);
      socket.emit('chat:response', { message: result.response, ...result });
    } catch (err) {
      const errorObj = handleAgentError(err, 'Orchestrator');
      socket.emit('chat:error', { message: errorObj.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`🔌 Client disconnected: ${socket.id}`);
    socketRateLimits.delete(socket.id);
  });
});

/* ─── STARTUP ─── */
// Initialize database and seed
const db = getDb();
const isSeeded = db.prepare('SELECT count(*) as count FROM zones').get().count > 0;
if (!isSeeded) {
  seedDatabase();
}

httpServer.listen(PORT, () => {
  logger.info('');
  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║  ⚽ FanPulse AI — FIFA World Cup 2026 Backend    ║');
  logger.info(`║  🌐 Server running on http://localhost:${PORT}       ║`);
  logger.info('║  📡 Socket.IO ready for real-time events         ║');
  logger.info('║  💾 SQLite Stadium Context Graph initialized     ║');
  logger.info('╚══════════════════════════════════════════════════╝');
  logger.info('');
});

export { app, httpServer, io };
