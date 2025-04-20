// src/utils/security.js
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Sanitize user input to prevent injection attacks
 * @param {string} input - The input string to sanitize
 * @returns {string} - The sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous HTML/script tags
  return input
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|option).*?>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|option).*?>/gi, '');
}

/**
 * Generate a secure random token
 * @param {number} length - The length of the token to generate
 * @returns {string} - The generated token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using SHA-256
 * @param {string} data - The data to hash
 * @returns {string} - The hashed string
 */
function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string} text - The text to encrypt
 * @param {string} key - The encryption key (must be 32 bytes)
 * @returns {string} - The encrypted text as base64
 */
function encrypt(text, key = process.env.ENCRYPTION_KEY) {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher with key and iv
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(key.padEnd(32).slice(0, 32)),
      iv
    );
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the auth tag
    const authTag = cipher.getAuthTag();
    
    // Return iv, encrypted text, and auth tag as base64
    return Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64')
    ]).toString('base64');
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedBase64 - The encrypted text as base64
 * @param {string} key - The encryption key (must be 32 bytes)
 * @returns {string} - The decrypted text
 */
function decrypt(encryptedBase64, key = process.env.ENCRYPTION_KEY) {
  try {
    // Convert the encrypted data from base64 to buffer
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
    
    // Extract iv, authTag, and encrypted text from the buffer
    const iv = encryptedBuffer.slice(0, 16);
    const authTag = encryptedBuffer.slice(16, 32);
    const encryptedText = encryptedBuffer.slice(32);
    
    // Create decipher with key and iv
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key.padEnd(32).slice(0, 32)),
      iv
    );
    
    // Set the auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt the text
    let decrypted = decipher.update(encryptedText, 'binary', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Verify a HMAC signature
 * @param {string} data - The data that was signed
 * @param {string} signature - The signature to verify
 * @param {string} key - The key used for signing
 * @returns {boolean} - Whether the signature is valid
 */
function verifySignature(data, signature, key = process.env.JWT_SECRET) {
  try {
    const computedSignature = crypto
      .createHmac('sha256', key)
      .update(data)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (error) {
    logger.error('Signature verification error:', error);
    return false;
  }
}

module.exports = {
  sanitizeInput,
  generateToken,
  hash,
  encrypt,
  decrypt,
  verifySignature
};