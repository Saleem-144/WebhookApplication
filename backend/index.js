import http from 'http';
import { Server } from 'socket.io';
import app from './src/app.js';
import dotenv from 'dotenv';
import { redisSubscriber } from './src/config/redis.js';
import * as emitters from './src/socket/emitters.js';
import { startDialpadQueueWorker } from './src/workers/dialpadQueueWorker.js';
import { setSocketIo } from './src/realtime/socketIoRef.js';
import { corsOriginCallback } from './src/config/corsShared.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars (also loaded from src/db and src/config paths during imports)
dotenv.config();

if (!process.env.JWT_SECRET?.trim()) {
  console.error('FATAL: JWT_SECRET is missing or empty in backend/.env. Set it and restart.');
  process.exit(1);
}

const port = process.env.PORT || 4000;
const server = http.createServer(app);

const listenHost = (process.env.LISTEN_HOST || '127.0.0.1').trim();

// Initialize Socket.IO (prefer websocket)
const io = new Server(server, {
  cors: {
    origin: corsOriginCallback,
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['ngrok-skip-browser-warning'],
  },
  path: '/socket.io',
  transports: ['polling', 'websocket'], // Try polling first
  allowEIO3: true,
  // Give clients 90 s to respond to a ping before the server drops them.
  // This prevents disconnects when the browser main thread is busy during
  // heavy page renders (e.g. navigating inbox → messages).
  pingTimeout: 90000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8,
  connectTimeout: 45000,
});

setSocketIo(io);

// Basic socket connection log
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id, 'Transport:', socket.conn.transport.name);

  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id} (reason: ${reason})`);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  // Monitor transport upgrades
  socket.conn.on('upgrade', (transport) => {
    console.log('🔄 Transport upgraded to:', transport.name);
  });
});

// Redis Subscriber Bridge
if (redisSubscriber) {
  redisSubscriber.subscribe('dialpad_events', (err, count) => {
    if (err) console.error('Failed to subscribe to Redis channel:', err);
    else console.log(`Subscribed to ${count} Redis channel(s). Listening for events...`);
  });

  redisSubscriber.on('message', (channel, message) => {
    if (channel === 'dialpad_events') {
      try {
        const { event, data } = JSON.parse(message);
        console.log(`Received Redis event: ${event}`);

        switch (event) {
          case 'new_message':
            emitters.emitNewMessage(io, data);
            break;
          case 'call_update':
            emitters.emitCallUpdate(io, data);
            break;
          case 'agent_status':
            emitters.emitAgentStatus(io, data.agentId, data.status);
            break;
          case 'new_notification':
            emitters.emitNotification(io, data);
            break;
          case 'dialpad_sms_delta':
            io.emit('dialpad_sms_delta', data);
            break;
          case 'dialpad_call_delta':
            io.emit('dialpad_call_delta', data);
            break;
        }
      } catch (err) {
        console.error('Failed to process Redis message:', err);
      }
    }
  });
}

import pool from './src/db/index.js';

server.listen(port, listenHost, async () => {
  console.log(`Backend server running on http://${listenHost}:${port}`);
  
  // Pre-warm the database connection to avoid 502 on first request
  try {
    const client = await pool.connect();
    console.log('Database pool warmed up and ready.');
    client.release();
  } catch (err) {
    console.error('CRITICAL: Failed to connect to database on startup:', err.message);
  }

  startDialpadQueueWorker();
});

export { io };
