import jwt from 'jsonwebtoken';

/**
 * Signs a JWT token with the user's ID
 */
export const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
};

/**
 * Sends a token in an HTTP-only cookie
 */
export const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + (parseInt(process.env.JWT_EXPIRES_IN) || 8) * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res.cookie('token', token, cookieOptions);

  // Remove password from output
  user.password_hash = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user
    }
  });
};
