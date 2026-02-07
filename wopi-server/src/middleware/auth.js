const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

/**
 * Middleware to authenticate JWT tokens
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user from database
    const result = await pool.query(
      'SELECT id, email, username, display_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    logger.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware to check admin role
 */
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, username, display_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length > 0 && result.rows[0].is_active) {
      req.user = result.rows[0];
    }
  } catch (error) {
    // Ignore token errors for optional auth
  }

  next();
}

/**
 * Generate JWT token for user
 */
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
  generateToken,
  generateRefreshToken
};
