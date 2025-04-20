// src/middleware/auth.js
const logger = require('../utils/logger');

/**
 * Middleware to validate API key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateApiKey(req, res, next) {
  try {
    // Get API key from environment variable
    const apiKey = process.env.API_KEY;
    
    // If no API key is set, skip validation
    if (!apiKey) {
      logger.warn('API key validation skipped: No API key set in environment variables');
      return next();
    }
    
    // Get API key from request header
    const providedKey = req.headers['x-api-key'];
    
    // Check if API key is provided
    if (!providedKey) {
      logger.warn('API key validation failed: No API key provided');
      return res.status(401).json({ error: 'API key is required' });
    }
    
    // Validate API key
    if (providedKey !== apiKey) {
      logger.warn('API key validation failed: Invalid API key');
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // API key is valid, proceed to the next middleware
    next();
  } catch (error) {
    logger.error('Error validating API key:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

/**
 * Middleware to validate admin API key (for admin-only endpoints)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateAdminKey(req, res, next) {
  try {
    // Get admin API key from environment variable
    const adminKey = process.env.ADMIN_API_KEY;
    
    // If no admin key is set, skip validation in development mode
    if (!adminKey) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Admin key validation skipped: No admin key set in environment variables (development mode)');
        return next();
      } else {
        logger.error('Admin key validation failed: No admin key set in environment variables');
        return res.status(500).json({ error: 'Server configuration error: Admin key not set' });
      }
    }
    
    // Get admin key from request header
    const providedKey = req.headers['x-admin-key'];
    
    // Check if admin key is provided
    if (!providedKey) {
      logger.warn('Admin key validation failed: No admin key provided');
      return res.status(401).json({ error: 'Admin key is required' });
    }
    
    // Validate admin key
    if (providedKey !== adminKey) {
      logger.warn('Admin key validation failed: Invalid admin key');
      return res.status(401).json({ error: 'Invalid admin key' });
    }
    
    // Admin key is valid, proceed to the next middleware
    next();
  } catch (error) {
    logger.error('Error validating admin key:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

/**
 * Middleware to validate JWT token (for future use)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateJwt(req, res, next) {
  try {
    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET;
    
    // If no JWT secret is set, skip validation
    if (!jwtSecret) {
      logger.warn('JWT validation skipped: No JWT secret set in environment variables');
      return next();
    }
    
    // Get JWT token from request header
    const token = req.headers.authorization?.split(' ')[1];
    
    // Check if token is provided
    if (!token) {
      logger.warn('JWT validation failed: No token provided');
      return res.status(401).json({ error: 'JWT token is required' });
    }
    
    // Validate JWT token
    const jwt = require('jsonwebtoken');
    try {
      const decoded = jwt.verify(token, jwtSecret);
      
      // Set user info in request object
      req.user = decoded;
      
      // Token is valid, proceed to the next middleware
      next();
    } catch (jwtError) {
      logger.warn('JWT validation failed: Invalid token');
      return res.status(401).json({ error: 'Invalid JWT token' });
    }
  } catch (error) {
    logger.error('Error validating JWT token:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

module.exports = {
  validateApiKey,
  validateAdminKey,
  validateJwt
};