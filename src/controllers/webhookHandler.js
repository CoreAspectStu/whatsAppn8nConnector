// src/controllers/webhookHandler.js
const logger = require('../utils/logger');
const { sendMessage } = require('../services/whatsappService');
const { sanitizeInput } = require('../utils/security');

/**
 * Handle incoming webhook requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function webhookHandler(req, res) {
  try {
    logger.info('Received webhook request');

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Extract message data
    const { to, message, options } = req.body;

    // Validate required fields
    if (!to || !message) {
      return res.status(400).json({ error: 'Missing required fields: to and message' });
    }

    // Sanitize inputs
    const sanitizedTo = sanitizeInput(to);
    const sanitizedMessage = sanitizeInput(message);

    // Process options
    const messageOptions = options || {};
    
    // Validate phone number format (basic check)
    if (!isValidPhoneNumber(sanitizedTo)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Send message to WhatsApp
    logger.info(`Sending webhook message to ${sanitizedTo}`);
    const result = await sendMessage(sanitizedTo, sanitizedMessage);

    // Return success response
    return res.status(200).json({
      success: true,
      messageId: result.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process webhook',
      message: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

/**
 * Validate phone number format
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - Whether the phone number is valid
 */
function isValidPhoneNumber(phoneNumber) {
  // Remove @c.us if present
  const number = phoneNumber.replace('@c.us', '');
  
  // Basic validation: must be numeric and at least 10 digits
  return /^\d{10,15}$/.test(number);
}

module.exports = {
  webhookHandler
};