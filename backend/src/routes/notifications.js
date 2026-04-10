import express from 'express';
import { protect } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/notifications?limit=50
 */
router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const { rows } = await query(
      `
      SELECT
        id,
        event_type,
        source_type,
        source_id,
        preview_text,
        is_read,
        created_at,
        meta,
        dismissed_from_popup_at
      FROM notifications
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit],
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/notifications/dismiss-popup-all
 * Clears the bell list only; inbox still shows every notification.
 */
router.post('/dismiss-popup-all', protect, async (req, res) => {
  try {
    await query(
      `
      UPDATE notifications
      SET dismissed_from_popup_at = NOW()
      WHERE dismissed_from_popup_at IS NULL
      `,
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/notifications/:id/dismiss-popup
 */
router.patch('/:id/dismiss-popup', protect, async (req, res) => {
  try {
    const { rows } = await query(
      `
      UPDATE notifications
      SET dismissed_from_popup_at = NOW()
      WHERE id = $1
      RETURNING id, dismissed_from_popup_at
      `,
      [req.params.id],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const { rows } = await query(
      `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1
      RETURNING id, is_read
      `,
      [req.params.id],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', protect, async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true, read_at = NOW() WHERE is_read = false`,
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/notifications/read-by-thread
 * Body: { thread_key: string } — matches meta.thread_key (SMS thread id from webhooks).
 */
router.post('/read-by-thread', protect, async (req, res) => {
  try {
    const threadKey = String(req.body?.thread_key ?? '').trim();
    if (!threadKey || threadKey.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'thread_key is required',
        code: 'BAD_REQUEST',
      });
    }
    const { rows } = await query(
      `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE is_read = false AND meta->>'thread_key' = $1
      RETURNING id
      `,
      [threadKey],
    );
    return res.json({ success: true, data: { updated: rows.length } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
