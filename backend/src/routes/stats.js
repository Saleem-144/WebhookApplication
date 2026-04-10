import express from 'express';
import {
  getStatsSummary,
  getAllOffices,
  getDepartmentsByOffice,
  getAgents,
} from '../db/models.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/**
 * Departments for an office
 * GET /api/stats/departments?office_id=<uuid>
 */
router.get('/departments', protect, async (req, res) => {
  try {
    const { office_id: officeId } = req.query;
    if (!officeId || typeof officeId !== 'string' || !UUID_RE.test(officeId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid office_id query parameter is required',
        code: 'INVALID_OFFICE_ID',
      });
    }
    const departments = await getDepartmentsByOffice(officeId);
    res.json({ success: true, data: departments });
  } catch (err) {
    console.error('Stats departments error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
});

/**
 * Agents for an office (optional department filter later)
 * GET /api/stats/agents?office_id=<uuid>
 */
router.get('/agents', protect, async (req, res) => {
  try {
    const { office_id: officeId } = req.query;
    if (!officeId || typeof officeId !== 'string' || !UUID_RE.test(officeId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid office_id query parameter is required',
        code: 'INVALID_OFFICE_ID',
      });
    }
    const agents = await getAgents({ officeId });
    res.json({ success: true, data: agents });
  } catch (err) {
    console.error('Stats agents error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

export default router;
