import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { logMessageSeen } from '../services/loggerService.js';

const router = express.Router();

/**
 * Superadmin/Admin: List all agents and their basic status.
 * GET /api/logs/agent-summaries
 */
router.get('/agent-summaries', protect, restrictTo('superadmin', 'admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.avatar_url,
        (SELECT MAX(created_at) FROM agent_activity_logs WHERE user_id = u.id) as last_activity,
        (SELECT COUNT(*) FROM agent_activity_logs WHERE user_id = u.id AND action_type = 'message_sent') as messages_sent
      FROM users u
      WHERE u.role = 'agent'
      ORDER BY last_activity DESC NULLS LAST
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Superadmin/Admin: Fetch activity logs for a specific agent.
 * GET /api/logs/agent/:userId
 */
router.get('/agent/:userId', protect, restrictTo('superadmin', 'admin'), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, action_type, details, created_at FROM agent_activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200',
      [req.params.userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Agent: Mark a message or thread as seen.
 * POST /api/logs/seen
 */
router.post('/seen', protect, async (req, res) => {
  try {
    const { dialpadId, threadKey, type } = req.body;
    
    if (type === 'message' && dialpadId) {
      await logMessageSeen(req.user.id, dialpadId);
    } else if (type === 'thread' && threadKey) {
      await query(
        'INSERT INTO agent_activity_logs (user_id, action_type, details) VALUES ($1, $2, $3)',
        [req.user.id, 'message_seen', { threadKey }]
      );
    } else {
      return res.status(400).json({ success: false, error: 'dialpadId or threadKey and valid type required' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Superadmin/Admin: Get list of agents who have seen a specific message.
 * GET /api/logs/seen-by/:dialpadId
 */
router.get('/seen-by/:dialpadId', protect, restrictTo('superadmin', 'admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.avatar_url, s.seen_at 
       FROM message_seen_logs s
       JOIN users u ON s.user_id = u.id
       WHERE s.message_dialpad_id = $1
       ORDER BY s.seen_at ASC`,
      [req.params.dialpadId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
