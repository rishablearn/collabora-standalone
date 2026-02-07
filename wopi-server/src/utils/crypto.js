const crypto = require('crypto');
const CryptoJS = require('crypto-js');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Generate a secure access token for WOPI
 */
function generateAccessToken(fileId, userId, permissions = 'view') {
  const payload = {
    fileId,
    userId,
    permissions,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  
  const secret = process.env.WOPI_SECRET || 'default-secret';
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), secret).toString();
  return Buffer.from(encrypted).toString('base64url');
}

/**
 * Verify and decode access token
 */
function verifyAccessToken(token) {
  try {
    const secret = process.env.WOPI_SECRET || 'default-secret';
    const encrypted = Buffer.from(token, 'base64url').toString();
    const decrypted = CryptoJS.AES.decrypt(encrypted, secret);
    const payload = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    
    // Token expires after 24 hours
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - payload.timestamp > maxAge) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a random file ID
 */
function generateFileId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a lock ID for WOPI locking
 */
function generateLockId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a password using bcrypt-compatible method
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

/**
 * Verify a password against a hash
 */
function verifyPassword(password, hash) {
  const [saltHex, keyHex] = hash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
  return key.toString('hex') === keyHex;
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateFileId,
  generateLockId,
  hashPassword,
  verifyPassword
};
