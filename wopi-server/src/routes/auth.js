const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticateToken, generateToken, generateRefreshToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 50 }).trim().escape(),
  body('password').isLength({ min: 8 }),
  body('displayName').optional().trim().escape()
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
];

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Registration validation failed', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password, displayName } = req.body;
    logger.info('Registration attempt', { email, username });

    // Test database connection first
    try {
      await pool.query('SELECT 1');
    } catch (dbErr) {
      logger.error('Database connection test failed:', dbErr.message);
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      logger.info('Registration rejected - user exists', { email, username });
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash, display_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, username, display_name, role, created_at`,
      [email, username, passwordHash, displayName || username]
    );

    const user = result.rows[0];
    logger.info('User created', { userId: user.id, email });

    // Create root folder for user (non-critical, don't fail registration if this fails)
    try {
      await pool.query(
        'INSERT INTO folders (owner_id, name) VALUES ($1, $2)',
        [user.id, 'My Documents']
      );
    } catch (folderErr) {
      logger.warn('Failed to create root folder for user', { userId: user.id, error: folderErr.message });
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Log audit (non-critical)
    try {
      await pool.query(
        `INSERT INTO audit_log (user_id, action, resource_type, details, ip_address) 
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, 'REGISTER', 'user', JSON.stringify({ email }), req.ip]
      );
    } catch (auditErr) {
      logger.warn('Failed to log audit for registration', { userId: user.id, error: auditErr.message });
    }

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        role: user.role
      },
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Registration error:', error.message, { 
      stack: error.stack,
      code: error.code,
      detail: error.detail 
    });
    
    // Handle specific database errors
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    if (error.code === 'ECONNREFUSED' || error.code === '57P03') {
      return res.status(503).json({ error: 'Database connection failed' });
    }
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Database not initialized. Please run database migrations.' });
    }
    
    res.status(500).json({ 
      error: 'Registration failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user
 */
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, details, ip_address) 
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'LOGIN', 'user', JSON.stringify({ email }), req.ip]
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        role: user.role
      },
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const token = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({ token, refreshToken: newRefreshToken });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, username, display_name, role, storage_quota, storage_used, created_at, last_login
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      storageQuota: user.storage_quota,
      storageUsed: user.storage_used,
      createdAt: user.created_at,
      lastLogin: user.last_login
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate session)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, ip_address) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'LOGOUT', 'user', req.ip]
    );

    // Clear active sessions
    await pool.query(
      'DELETE FROM active_sessions WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * PUT /api/auth/password
 * Change password
 */
router.put('/password', authenticateToken, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, req.user.id]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, ip_address) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'PASSWORD_CHANGE', 'user', req.ip]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
