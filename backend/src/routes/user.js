import express from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { sendCredentials } from '../services/email.js';
import { logAction } from '../services/audit.js';

const router = express.Router();

/**
 * List all users
 * GET /api/users
 */
router.get('/', protect, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

/**
 * Create a new user (admin/superadmin)
 * POST /api/users
 */
router.post('/', protect, restrictTo('superadmin'), async (req, res) => {
  try {
    const { email, name, role } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({ success: false, error: 'Email, name, and role are required' });
    }

    // 1) Generate random 12-char password
    const temporaryPassword = Math.random().toString(36).slice(-12);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(temporaryPassword, salt);

    // 2) Save to DB
    const insertResult = await query(
      'INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, name, role, passwordHash]
    );
    const newUser = insertResult.rows[0];

    // 3) Log action
    await logAction(req.user.id, 'CREATE_USER', 'users', newUser.id, { email, role, name });

    // 4) Send credentials via email (async for better response time)
    sendCredentials(email, name, temporaryPassword).catch(err => {
      console.error('Async credentials email failed:', err);
    });

    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        email,
        name,
        role
      },
      message: 'User created. Credentials have been emailed.'
    });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * Delete a user
 * DELETE /api/users/:id
 */
router.delete('/:id', protect, restrictTo('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete yourself' });
    }

    const deleteResult = await query('DELETE FROM users WHERE id = $1 RETURNING email', [id]);
    const deletedUser = deleteResult.rows[0];

    if (!deletedUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Log action
    await logAction(req.user.id, 'DELETE_USER', 'users', id, { email: deletedUser.email });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

export default router;
