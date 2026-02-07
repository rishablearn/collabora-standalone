const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/users
 * List all users (admin only)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, email, username, display_name, role, storage_quota, storage_used, 
             is_active, created_at, last_login
      FROM users
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` WHERE email ILIKE $${paramIndex} OR username ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users';
    const countParams = [];
    if (search) {
      countQuery += ` WHERE email ILIKE $1 OR username ILIKE $1 OR display_name ILIKE $1`;
      countParams.push(`%${search}%`);
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      users: result.rows.map(u => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.display_name,
        role: u.role,
        storageQuota: parseInt(u.storage_quota),
        storageUsed: parseInt(u.storage_used),
        isActive: u.is_active,
        createdAt: u.created_at,
        lastLogin: u.last_login
      })),
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * GET /api/users/:id
 * Get user details (admin or self)
 */
router.get('/:id', async (req, res) => {
  try {
    // Only allow admin or self
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT id, email, username, display_name, role, storage_quota, storage_used, 
              is_active, email_verified, created_at, last_login
       FROM users WHERE id = $1`,
      [req.params.id]
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
      storageQuota: parseInt(user.storage_quota),
      storageUsed: parseInt(user.storage_used),
      isActive: user.is_active,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      lastLogin: user.last_login
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * PUT /api/users/:id
 * Update user (admin or self)
 */
router.put('/:id', [
  body('displayName').optional().trim().escape(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only allow admin or self (self can only update limited fields)
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { displayName, email, role, storageQuota, isActive } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Self can only update displayName
    if (displayName !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      values.push(displayName);
      paramIndex++;
    }

    // Admin-only updates
    if (req.user.role === 'admin') {
      if (email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        values.push(email);
        paramIndex++;
      }
      if (role !== undefined) {
        updates.push(`role = $${paramIndex}`);
        values.push(role);
        paramIndex++;
      }
      if (storageQuota !== undefined) {
        updates.push(`storage_quota = $${paramIndex}`);
        values.push(storageQuota);
        paramIndex++;
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        values.push(isActive);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    values.push(req.params.id);
    const query = `
      UPDATE users SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, username, display_name, role, storage_quota, storage_used, is_active
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'USER_UPDATE', 'user', req.params.id, JSON.stringify(req.body), req.ip]
    );

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      storageQuota: parseInt(user.storage_quota),
      storageUsed: parseInt(user.storage_used),
      isActive: user.is_active
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'USER_DELETE', 'user', req.params.id, req.ip]
    );

    res.json({ message: 'User deleted' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post('/', requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 50 }).trim().escape(),
  body('password').isLength({ min: 8 }),
  body('displayName').optional().trim().escape(),
  body('role').optional().isIn(['user', 'admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password, displayName, role = 'user', storageQuota } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash, display_name, role, storage_quota)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, username, display_name, role, storage_quota, created_at`,
      [email, username, passwordHash, displayName || username, role, storageQuota || 5368709120]
    );

    const user = result.rows[0];

    // Create root folder for user
    await pool.query(
      'INSERT INTO folders (owner_id, name) VALUES ($1, $2)',
      [user.id, 'My Documents']
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'USER_CREATE', 'user', user.id, JSON.stringify({ email }), req.ip]
    );

    res.status(201).json({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      storageQuota: parseInt(user.storage_quota),
      createdAt: user.created_at
    });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * GET /api/users/:id/storage
 * Get user storage stats
 */
router.get('/:id/storage', async (req, res) => {
  try {
    // Only allow admin or self
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'SELECT storage_quota, storage_used FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get file count
    const fileCount = await pool.query(
      'SELECT COUNT(*) FROM files WHERE owner_id = $1 AND is_deleted = false',
      [req.params.id]
    );

    res.json({
      quota: parseInt(user.storage_quota),
      used: parseInt(user.storage_used),
      available: parseInt(user.storage_quota) - parseInt(user.storage_used),
      percentUsed: Math.round((parseInt(user.storage_used) / parseInt(user.storage_quota)) * 100),
      fileCount: parseInt(fileCount.rows[0].count)
    });
  } catch (error) {
    logger.error('Get storage error:', error);
    res.status(500).json({ error: 'Failed to get storage stats' });
  }
});

module.exports = router;
