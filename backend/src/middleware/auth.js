import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

/**
 * Middleware to protect routes via JWT in HTTP-only cookies
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    // 1) Get token from cookies
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      token = cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'You are not logged in. Please log in to get access.',
        code: 'UNAUTHORIZED'
      });
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const userResult = await query('SELECT id, email, name, role, must_change_password FROM users WHERE id = $1', [decoded.id]);
    const currentUser = userResult.rows[0];

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'The user belonging to this token no longer exists.',
        code: 'USER_NOT_FOUND'
      });
    }

    // 4) Grant access
    req.user = currentUser;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token. Please log in again.',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Middleware to restrict access based on roles
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to perform this action',
        code: 'FORBIDDEN'
      });
    }
    next();
  };
};
