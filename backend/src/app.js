import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { query } from './db/index.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import statsRouter from './routes/stats.js';
import searchRouter from './routes/search.js';

const app = express();

// Standard middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/stats', statsRouter);
app.use('/api/search', searchRouter);

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
