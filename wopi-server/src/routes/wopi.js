const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const pool = require('../db/pool');
const { verifyAccessToken, generateLockId } = require('../utils/crypto');
const logger = require('../utils/logger');

const router = express.Router();
const STORAGE_PATH = process.env.STORAGE_PATH || '/storage';

/**
 * WOPI CheckFileInfo
 * GET /wopi/files/:fileId
 */
router.get('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const accessToken = req.query.access_token;

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const tokenData = verifyAccessToken(accessToken);
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    // Get file info
    const result = await pool.query(
      `SELECT f.*, u.display_name as owner_name, u.email as owner_email
       FROM files f
       JOIN users u ON f.owner_id = u.id
       WHERE f.id = $1 AND f.is_deleted = false`,
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Check permissions
    const canEdit = tokenData.permissions === 'edit' || tokenData.permissions === 'admin';
    const isOwner = tokenData.userId === file.owner_id;

    // Get file stats
    const filePath = path.join(STORAGE_PATH, file.storage_path);
    let fileStats;
    try {
      fileStats = await fs.stat(filePath);
    } catch (err) {
      logger.error('File stat error:', err);
      return res.status(404).json({ error: 'File not found on storage' });
    }

    // Check for locks
    const lockResult = await pool.query(
      'SELECT * FROM file_locks WHERE file_id = $1 AND expires_at > NOW()',
      [fileId]
    );
    const isLocked = lockResult.rows.length > 0;
    const lockId = isLocked ? lockResult.rows[0].lock_id : null;

    // Build WOPI response
    const response = {
      BaseFileName: file.original_filename,
      OwnerId: file.owner_id,
      Size: parseInt(file.size),
      UserId: tokenData.userId,
      Version: file.version.toString(),
      LastModifiedTime: file.updated_at.toISOString(),
      
      // User permissions
      UserCanWrite: canEdit,
      UserCanNotWriteRelative: !canEdit,
      ReadOnly: !canEdit,
      UserCanRename: isOwner,
      
      // UI settings
      DisablePrint: false,
      DisableExport: false,
      DisableCopy: false,
      HidePrintOption: false,
      HideSaveOption: false,
      HideExportOption: false,
      
      // User info
      UserFriendlyName: file.owner_name,
      UserExtraInfo: {},
      
      // File info
      FileExtension: path.extname(file.original_filename),
      
      // Lock info
      LockValue: lockId,
      
      // Capabilities
      SupportsLocks: true,
      SupportsGetLock: true,
      SupportsExtendedLockLength: true,
      SupportsUpdate: true,
      SupportsRename: isOwner,
      SupportedShareUrlTypes: ['ReadOnly', 'ReadWrite'],
      
      // Additional properties
      IsAnonymousUser: false,
      PostMessageOrigin: process.env.DOMAIN ? `https://${process.env.DOMAIN}` : '*',
      CloseButtonClosesWindow: true
    };

    res.json(response);
  } catch (error) {
    logger.error('CheckFileInfo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * WOPI GetFile
 * GET /wopi/files/:fileId/contents
 */
router.get('/files/:fileId/contents', async (req, res) => {
  try {
    const { fileId } = req.params;
    const accessToken = req.query.access_token;

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const tokenData = verifyAccessToken(accessToken);
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    // Get file info
    const result = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];
    const filePath = path.join(STORAGE_PATH, file.storage_path);

    // Read and send file
    const fileContent = await fs.readFile(filePath);
    
    res.set({
      'Content-Type': file.mime_type,
      'Content-Disposition': `attachment; filename="${file.original_filename}"`,
      'X-WOPI-ItemVersion': file.version.toString()
    });
    
    res.send(fileContent);
  } catch (error) {
    logger.error('GetFile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * WOPI PutFile
 * POST /wopi/files/:fileId/contents
 */
router.post('/files/:fileId/contents', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  try {
    const { fileId } = req.params;
    const accessToken = req.query.access_token;
    const wopiLock = req.headers['x-wopi-lock'];

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const tokenData = verifyAccessToken(accessToken);
    if (!tokenData || (tokenData.permissions !== 'edit' && tokenData.permissions !== 'admin')) {
      return res.status(401).json({ error: 'No edit permission' });
    }

    // Get file info
    const result = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Check lock
    const lockResult = await pool.query(
      'SELECT * FROM file_locks WHERE file_id = $1 AND expires_at > NOW()',
      [fileId]
    );

    if (lockResult.rows.length > 0) {
      const existingLock = lockResult.rows[0];
      if (existingLock.lock_id !== wopiLock) {
        res.set('X-WOPI-Lock', existingLock.lock_id);
        return res.status(409).json({ error: 'Lock mismatch' });
      }
    }

    const filePath = path.join(STORAGE_PATH, file.storage_path);

    // Save version history
    const versionPath = `${file.storage_path}.v${file.version}`;
    await fs.copyFile(filePath, path.join(STORAGE_PATH, versionPath));
    
    await pool.query(
      `INSERT INTO file_versions (file_id, version, size, storage_path, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [fileId, file.version, file.size, versionPath, tokenData.userId]
    );

    // Write new content
    await fs.writeFile(filePath, req.body);
    const stats = await fs.stat(filePath);

    // Update file record
    const newVersion = file.version + 1;
    await pool.query(
      `UPDATE files SET size = $1, version = $2, updated_at = NOW() WHERE id = $3`,
      [stats.size, newVersion, fileId]
    );

    // Update user storage
    const sizeDiff = stats.size - file.size;
    await pool.query(
      'UPDATE users SET storage_used = storage_used + $1 WHERE id = $2',
      [sizeDiff, file.owner_id]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenData.userId, 'FILE_UPDATE', 'file', fileId, JSON.stringify({ version: newVersion })]
    );

    res.set('X-WOPI-ItemVersion', newVersion.toString());
    res.status(200).json({ message: 'File saved' });
  } catch (error) {
    logger.error('PutFile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * WOPI Lock operations
 * POST /wopi/files/:fileId
 */
router.post('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const accessToken = req.query.access_token;
    const wopiOverride = req.headers['x-wopi-override'];
    const wopiLock = req.headers['x-wopi-lock'];
    const wopiOldLock = req.headers['x-wopi-oldlock'];

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const tokenData = verifyAccessToken(accessToken);
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    // Get file
    const result = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    switch (wopiOverride) {
      case 'LOCK':
        return await handleLock(fileId, wopiLock, tokenData, res);
      
      case 'GET_LOCK':
        return await handleGetLock(fileId, res);
      
      case 'REFRESH_LOCK':
        return await handleRefreshLock(fileId, wopiLock, res);
      
      case 'UNLOCK':
        return await handleUnlock(fileId, wopiLock, res);
      
      case 'PUT_RELATIVE':
        return res.status(501).json({ error: 'Not implemented' });
      
      case 'RENAME_FILE':
        return await handleRename(fileId, req.headers['x-wopi-requestedname'], tokenData, res);
      
      case 'DELETE':
        return await handleDelete(fileId, tokenData, res);
      
      default:
        return res.status(400).json({ error: 'Unknown WOPI operation' });
    }
  } catch (error) {
    logger.error('WOPI operation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleLock(fileId, lockId, tokenData, res) {
  // Check existing lock
  const lockResult = await pool.query(
    'SELECT * FROM file_locks WHERE file_id = $1 AND expires_at > NOW()',
    [fileId]
  );

  if (lockResult.rows.length > 0) {
    const existingLock = lockResult.rows[0];
    if (existingLock.lock_id === lockId) {
      // Refresh existing lock
      await pool.query(
        'UPDATE file_locks SET expires_at = NOW() + INTERVAL \'30 minutes\' WHERE file_id = $1',
        [fileId]
      );
      res.set('X-WOPI-Lock', lockId);
      return res.status(200).json({ message: 'Lock refreshed' });
    } else {
      res.set('X-WOPI-Lock', existingLock.lock_id);
      return res.status(409).json({ error: 'File already locked' });
    }
  }

  // Create new lock
  await pool.query(
    `INSERT INTO file_locks (file_id, lock_id, locked_by, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')
     ON CONFLICT (file_id) DO UPDATE SET lock_id = $2, locked_by = $3, expires_at = NOW() + INTERVAL '30 minutes'`,
    [fileId, lockId, tokenData.userId]
  );

  res.set('X-WOPI-Lock', lockId);
  res.status(200).json({ message: 'Locked' });
}

async function handleGetLock(fileId, res) {
  const lockResult = await pool.query(
    'SELECT * FROM file_locks WHERE file_id = $1 AND expires_at > NOW()',
    [fileId]
  );

  if (lockResult.rows.length > 0) {
    res.set('X-WOPI-Lock', lockResult.rows[0].lock_id);
  } else {
    res.set('X-WOPI-Lock', '');
  }

  res.status(200).json({ message: 'OK' });
}

async function handleRefreshLock(fileId, lockId, res) {
  const lockResult = await pool.query(
    'SELECT * FROM file_locks WHERE file_id = $1 AND expires_at > NOW()',
    [fileId]
  );

  if (lockResult.rows.length === 0) {
    res.set('X-WOPI-Lock', '');
    return res.status(409).json({ error: 'No lock found' });
  }

  const existingLock = lockResult.rows[0];
  if (existingLock.lock_id !== lockId) {
    res.set('X-WOPI-Lock', existingLock.lock_id);
    return res.status(409).json({ error: 'Lock mismatch' });
  }

  await pool.query(
    'UPDATE file_locks SET expires_at = NOW() + INTERVAL \'30 minutes\' WHERE file_id = $1',
    [fileId]
  );

  res.set('X-WOPI-Lock', lockId);
  res.status(200).json({ message: 'Lock refreshed' });
}

async function handleUnlock(fileId, lockId, res) {
  const lockResult = await pool.query(
    'SELECT * FROM file_locks WHERE file_id = $1',
    [fileId]
  );

  if (lockResult.rows.length === 0) {
    res.set('X-WOPI-Lock', '');
    return res.status(200).json({ message: 'No lock to remove' });
  }

  const existingLock = lockResult.rows[0];
  if (existingLock.lock_id !== lockId) {
    res.set('X-WOPI-Lock', existingLock.lock_id);
    return res.status(409).json({ error: 'Lock mismatch' });
  }

  await pool.query('DELETE FROM file_locks WHERE file_id = $1', [fileId]);

  res.set('X-WOPI-Lock', '');
  res.status(200).json({ message: 'Unlocked' });
}

async function handleRename(fileId, newName, tokenData, res) {
  if (!newName) {
    return res.status(400).json({ error: 'New name required' });
  }

  await pool.query(
    'UPDATE files SET original_filename = $1 WHERE id = $2',
    [newName, fileId]
  );

  await pool.query(
    `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenData.userId, 'FILE_RENAME', 'file', fileId, JSON.stringify({ newName })]
  );

  res.json({ Name: newName });
}

async function handleDelete(fileId, tokenData, res) {
  await pool.query(
    'UPDATE files SET is_deleted = true WHERE id = $1',
    [fileId]
  );

  await pool.query(
    `INSERT INTO audit_log (user_id, action, resource_type, resource_id)
     VALUES ($1, $2, $3, $4)`,
    [tokenData.userId, 'FILE_DELETE', 'file', fileId]
  );

  res.status(200).json({ message: 'Deleted' });
}

module.exports = router;
