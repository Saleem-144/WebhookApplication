import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

/**
 * Read a named cookie from Cookie header. JWT values may contain '=' (base64 padding);
 * splitting on '=' breaks the token — use first '=' as name/value boundary only.
 */
const getCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const segment = part.trim();
    const eq = segment.indexOf('=');
    if (eq < 1) continue;
    const key = segment.slice(0, eq).trim();
    if (key !== name) continue;
    return segment.slice(eq + 1).trim();
  }
  return null;
};

/** Same JWT as the `token` cookie — for curl, Postman, and server-to-server scripts. */
const getBearerToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const m = authHeader.match(/^Bearer\s+(\S+)/i);
  return m ? m[1].trim() : null;
};

/**
 * Middleware to protect routes via JWT: prefer `token` httpOnly cookie (browser),
 * else `Authorization: Bearer <jwt>` (same token returned in POST /api/auth/login body).
 */
export const protect = async (req, res, next) => {
  try {
    const token =
      getCookieValue(req.headers.cookie, 'token') ||
      getBearerToken(req.headers.authorization);

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
    const userResult = await query(
      'SELECT id, email, name, role, must_change_password, avatar_url FROM users WHERE id = $1',
      [decoded.id]
    );
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
