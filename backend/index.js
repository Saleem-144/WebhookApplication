import http from 'http';
import { Server } from 'socket.io';
import app from './src/app.js';
import dotenv from 'dotenv';
import { redisSubscriber } from './src/config/redis.js';
import * as emitters from './src/socket/emitters.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config();

const port = process.env.PORT || 4000;
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Basic socket connection log
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
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
        }
      } catch (err) {
        console.error('Failed to process Redis message:', err);
      }
    }
  });
}

server.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});

export { io };
