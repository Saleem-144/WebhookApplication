import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { query } from './db/index.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import statsRouter from './routes/stats.js';
import searchRouter from './routes/search.js';
import dialpadApiRouter from './routes/dialpadApi.js';
import notificationsRouter from './routes/notifications.js';
import { handleDialpadWebhook } from './routes/webhooksDialpad.js';
import contactRouter from './routes/contactApi.js';
import logsRouter from './routes/logs.js';
import { corsOriginCallback } from './config/corsShared.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Standard middleware
app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const uploadsRoot = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsRoot));

app.post(
  '/api/webhooks/dialpad',
  express.raw({
    // Dialpad may send application/jwt with charset or other variants — accept any.
    type: () => true,
    limit: '512kb',
  }),
  handleDialpadWebhook,
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Auth routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/stats', statsRouter);
app.use('/api/search', searchRouter);
app.use('/api/dialpad', dialpadApiRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/contacts', contactRouter);
app.use('/api/logs', logsRouter);

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Backend server is healthy',
      database: 'Connected',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    console.error('Database connection failed in health check:', err);
    res.status(500).json({
      success: false,
      message: 'Backend server is unhealthy',
      database: 'Disconnected',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
  }
});

export default app;
