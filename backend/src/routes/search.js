import express from 'express';
import { query } from '../db/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * Unified search for agents and customers
 * GET /api/search?q=...
 */
router.get('/', protect, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: { agents: [], customers: [] } });
    }

    const searchTerm = `%${q}%`;

    // Search agents
    const agentsResult = await query(
      `SELECT id, name, email, phone_number, 'agent' as type 
       FROM agents 
       WHERE name ILIKE $1 OR email ILIKE $1 OR phone_number ILIKE $1 
       LIMIT 5`,
      [searchTerm]
    );

    // Search customers
    const customersResult = await query(
      `SELECT id, name, email, phone_number, company_name, 'customer' as type 
       FROM customers 
       WHERE name ILIKE $1 OR email ILIKE $1 OR phone_number ILIKE $1 OR company_name ILIKE $1
       LIMIT 5`,
      [searchTerm]
    );

    res.json({
      success: true,
      data: {
        agents: agentsResult.rows,
        customers: customersResult.rows
      }
    });
  } catch (err) {
    console.error('Unified search error:', err);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
