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

module.exports = {
  validateApiKey
};