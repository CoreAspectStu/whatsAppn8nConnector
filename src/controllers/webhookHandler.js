// src/controllers/webhookHandler.js
const logger = require('../utils/logger');
const { getInstanceConfig } = require('../models/instance');
const { getClientInstance } = require('../services/whatsappService');
const { sanitizeInput } = require('../utils/security');

/**
 * Handle incoming webhook requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function webhookHandler(req, res) {
  try {
    const instanceId = req.params.instanceId;
    logger.info(`Received webhook request for instance ${instanceId}`);

    // Validate instance ID
    if (!instanceId) {
      return res.status(400).json({ error: 'Missing instance ID' });
    }

    // Get instance configuration
    const instanceConfig = await getInstanceConfig(instanceId);
    if (!instanceConfig) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Get WhatsApp client instance
    const client = getClientInstance(instanceId);
    if (!client) {
      return res.status(503).json({ error: 'WhatsApp client not initialized for this instance' });
    }

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
    logger.info(`Sending webhook message to ${sanitizedTo} from instance ${instanceId}`);
    
    try {
      // Format the phone number
      const formattedNumber = sanitizedTo.includes('@c.us') ? sanitizedTo : `${sanitizedTo}@c.us`;
      
      // Send the message
      const result = await client.sendMessage(formattedNumber, sanitizedMessage);
      
      // Return success response
      return res.status(200).json({
        success: true,
        messageId: result.id,
        instanceId: instanceId,
        timestamp: new Date().toISOString()
      });
    } catch (sendError) {
      logger.error(`Failed to send message to ${sanitizedTo} from instance ${instanceId}:`, sendError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send message',
        message: sendError.message
      });
    }
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

/**
 * Register webhook routes with Express app
 * @param {Object} app - Express app
 */
function registerWebhookRoutes(app) {
  const { validateApiKey } = require('../middleware/auth');
  
  // Main webhook route for sending messages
  app.post('/api/webhook/:instanceId', validateApiKey, webhookHandler);
}

module.exports = {
  webhookHandler,
  registerWebhookRoutes
};