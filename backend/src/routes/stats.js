import express from 'express';
import { getStatsSummary, getAllOffices } from '../db/models.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get overall dashboard summary statistics
 * GET /api/stats/summary
 */
router.get('/summary', protect, async (req, res) => {
  try {
    const stats = await getStatsSummary();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('Stats summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

/**
 * Get all offices list
 * GET /api/stats/offices
 */
router.get('/offices', protect, async (req, res) => {
  try {
    const offices = await getAllOffices();
    res.json({
      success: true,
      data: offices
    });
  } catch (err) {
    console.error('Stats offices error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch offices' });
  }
});

export default router;
