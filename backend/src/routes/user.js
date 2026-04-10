import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db/index.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { sendCredentials } from '../services/email.js';
import { logAction } from '../services/audit.js';

const router = express.Router();

const CREATABLE_BY_ADMIN = ['admin', 'agent'];
const CREATABLE_BY_SUPERADMIN = ['superadmin', 'admin', 'agent'];

/**
 * List all users (superadmin and admin only)
 * GET /api/users
 */
router.get('/', protect, restrictTo('superadmin', 'admin'), async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, avatar_url, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC'
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
 * Create user (superadmin: superadmin | admin | agent; admin: admin | agent only)
 * POST /api/users
 */
router.post('/', protect, restrictTo('superadmin', 'admin'), async (req, res) => {
  try {
    const { email, name, role } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({ success: false, error: 'Email, name, and role are required' });
    }

    const creatable =
      req.user.role === 'superadmin' ? CREATABLE_BY_SUPERADMIN : CREATABLE_BY_ADMIN;

    if (!creatable.includes(role)) {
      return res.status(400).json({
        success: false,
        error:
          req.user.role === 'superadmin'
            ? 'Role must be superadmin, admin, or agent'
            : 'Admins can only create admin or agent users',
        code: 'INVALID_ROLE',
      });
    }

    const temporaryPassword = Math.random().toString(36).slice(-12);
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(temporaryPassword, salt);

    const insertResult = await query(
      'INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
      [email.trim(), name.trim(), role, passwordHash]
    );
    const newUser = insertResult.rows[0];

    await logAction(req.user.id, 'CREATE_USER', 'users', newUser.id, { email, role, name });

    const emailResult = await sendCredentials(
      email.trim(),
      name.trim(),
      temporaryPassword
    );
    const credentialsEmailed = Boolean(emailResult?.sent);
    const emailError = credentialsEmailed ? null : emailResult?.error || 'Email not sent';

    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        email: email.trim(),
        name: name.trim(),
        role
      },
      emailSent: credentialsEmailed,
      ...(emailError && !credentialsEmailed && { emailError }),
      message: credentialsEmailed
        ? 'User created. Credentials have been emailed.'
        : `User created, but the invitation email was not sent. ${emailError}`,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }
    if (err.code === '23514') {
      return res.status(400).json({
        success: false,
        error:
          'Database does not allow role "agent" yet. Run backend/migrations/001_users_role_agent.sql on your database.',
        code: 'SCHEMA_OUTDATED',
      });
    }
    console.error('Create user error:', err);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * Delete a user (superadmin and admin; admins cannot delete superadmin)
 * DELETE /api/users/:id
 */
router.delete('/:id', protect, restrictTo('superadmin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete yourself' });
    }

    const targetResult = await query('SELECT id, email, role FROM users WHERE id = $1', [id]);
    const target = targetResult.rows[0];

    if (!target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (target.role === 'superadmin' && req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admins cannot remove a superadmin',
        code: 'FORBIDDEN',
      });
    }

    await query('DELETE FROM users WHERE id = $1', [id]);

    await logAction(req.user.id, 'DELETE_USER', 'users', id, { email: target.email });

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
