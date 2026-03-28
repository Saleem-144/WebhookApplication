import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db/index.js';
import { createSendToken } from '../services/auth.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * Login route
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // 2) Check if user exists & password is correct
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 3) Create and send token
    createSendToken(user, 200, res);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'An error occurred during login',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * Change password route
 * POST /api/auth/change-password
 */
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1) Verify current password
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect current password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 2) Hash new password and update user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2',
      [passwordHash, req.user.id]
    );

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({
      success: false,
      error: 'An error occurred during password change',
      code: 'SERVER_ERROR'
    });
  }
});

export default router;
