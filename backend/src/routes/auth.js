import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { query } from '../db/index.js';
import { createSendToken } from '../services/auth.js';
import { protect } from '../middleware/auth.js';
import { uploadAvatarMiddleware, avatarsDir } from '../middleware/avatarUpload.js';
import { logActivity } from '../services/loggerService.js';

const router = express.Router();

const userSelectFields =
  'id, email, name, role, must_change_password, avatar_url';

const clearTokenCookie = (res) => {
  res.clearCookie('token', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
};

/**
 * Logout — clears HTTP-only auth cookie
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  clearTokenCookie(res);
  res.status(200).json({ success: true, message: 'Logged out' });
});

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

    // 4) Log activity
    logActivity(user.id, 'login', { email: user.email, ip: req.ip });
  } catch (err) {
    console.error('Login error:', err);
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json({
      success: false,
      error: isDev ? err.message : 'An error occurred during login',
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * Current user (from JWT cookie)
 * GET /api/auth/me
 */
router.get('/me', protect, async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

const MIN_NEW_PASSWORD_LEN = 8;

/**
 * Update current user's display name
 * PATCH /api/auth/profile
 */
router.patch('/profile', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
        code: 'INVALID_INPUT',
      });
    }

    await query('UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2', [
      name.trim(),
      req.user.id,
    ]);

    const refreshed = await query(
      `SELECT ${userSelectFields} FROM users WHERE id = $1`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      data: { user: refreshed.rows[0] },
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * Upload profile picture (stored under backend/uploads/avatars, served at /uploads/...)
 * POST /api/auth/avatar — multipart field name: avatar
 */
router.post('/avatar', protect, uploadAvatarMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file received',
        code: 'MISSING_FILE',
      });
    }

    const publicPath = `/uploads/avatars/${req.file.filename}`;

    const prev = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    const oldUrl = prev.rows[0]?.avatar_url;

    await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [
      publicPath,
      req.user.id,
    ]);

    if (oldUrl && oldUrl.startsWith('/uploads/avatars/')) {
      const oldFile = path.join(avatarsDir, path.basename(oldUrl));
      fs.unlink(oldFile, () => {});
    }

    const refreshed = await query(`SELECT ${userSelectFields} FROM users WHERE id = $1`, [
      req.user.id,
    ]);

    res.status(200).json({
      success: true,
      data: { user: refreshed.rows[0] },
    });
  } catch (err) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    console.error('Avatar upload error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to save profile picture',
      code: 'SERVER_ERROR',
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

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        success: false,
        error: `New password must be at least ${MIN_NEW_PASSWORD_LEN} characters`,
        code: 'INVALID_INPUT',
      });
    }

    if (newPassword.length < MIN_NEW_PASSWORD_LEN) {
      return res.status(400).json({
        success: false,
        error: `New password must be at least ${MIN_NEW_PASSWORD_LEN} characters`,
        code: 'INVALID_INPUT',
      });
    }

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
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2',
      [passwordHash, req.user.id]
    );

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

    logActivity(req.user.id, 'change_password');
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
