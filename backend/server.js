/**
 * @module server
 * @description FanPulse AI Backend — Express + Socket.IO server.
 * Entry point for the multi-agent GenAI system.
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { configureHelmet, configureCors, configureGeneralRateLimit } from './middleware/security.js';
import { createApiRouter } from './routes/api.js';
import { seedDatabase } from './db/seed.js';
import { getDb } from './db/schema.js';
import { routeRequest } from './agents/orchestrator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();
const httpServer = createServer(app);

// Socket.IO — accept both Vite dev ports
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',').map(s => s.trim());

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

/* ─── MIDDLEWARE ─── */
app.use(configureHelmet());
app.use(configureCors());
app.use(configureGeneralRateLimit());
app.use(express.json({ limit: '1mb' }));

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

/* ─── SOCKET.IO ─── */
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('chat:message', async (data) => {
    try {
      // Frontend sends { text, context: { role, userId, location } }
      // routeRequest expects { message, from, role }
      const request = {
        message: data.text || data.message || '',
        from: data.context?.location || data.from || '',
        role: data.context?.role || data.role || 'fan',
      };
      const result = await routeRequest(request);
      socket.emit('chat:response', { message: result.response, ...result });
    } catch (err) {
      // Log any errors from chat handling
      console.error('Chat socket error:', err);
      socket.emit('chat:error', { message: 'Something went wrong. Please try again.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

/* ─── STARTUP ─── */
// Initialize database and seed
getDb();
seedDatabase();

httpServer.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  ⚽ FanPulse AI — FIFA World Cup 2026 Backend    ║');
  console.log(`║  🌐 Server running on http://localhost:${PORT}       ║`);
  console.log('║  📡 Socket.IO ready for real-time events         ║');
  console.log('║  💾 SQLite Stadium Context Graph initialized     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

export { app, httpServer, io };
