// src/services/whatsappService.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { handleIncomingMessage } = require('../controllers/messageHandler');
const logger = require('../utils/logger');
const { updateInstanceStatus } = require('../models/instance');

// Global client instances
const clientInstances = {};

/**
 * Initialize the WhatsApp client for a specific instance
 * @param {string} instanceId - The instance ID
 * @param {Object} config - Instance configuration
 * @returns {Promise<Object>} - The WhatsApp client instance
 */
async function initializeWhatsAppInstance(instanceId, config) {
  try {
    // Create sessions directory for this instance if it doesn't exist
    const sessionDir = path.join(process.cwd(), 'sessions', instanceId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Initialize WhatsApp client with configuration
    clientInstances[instanceId] = new Client({
      authStrategy: new LocalAuth({
        dataPath: sessionDir,
        clientId: instanceId
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1280, height: 800 }
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2340.0.html'
      },
      webVersion: '2.2340.0'
    });

    // Set up event handlers
    setupEventHandlers(instanceId, clientInstances[instanceId], config);
    
    // Initialize the client
    await clientInstances[instanceId].initialize();
    
    logger.info(`WhatsApp client for instance ${instanceId} initialized`);
    return clientInstances[instanceId];
  } catch (error) {
    logger.error(`Failed to initialize WhatsApp client for instance ${instanceId}:`, error);
    throw error;
  }
}

/**
 * Set up event handlers for a WhatsApp client instance
 * @param {string} instanceId - The instance ID
 * @param {Object} client - The WhatsApp client instance
 * @param {Object} config - Instance configuration
 */
function setupEventHandlers(instanceId, client, config) {
  // Handle QR code for authentication
  client.on('qr', (qr) => {
    logger.info(`QR code received for instance ${instanceId}`);
    
    // Generate QR in terminal for debug purposes
    qrcode.generate(qr, { small: true });
    
    // Save QR code to a file for web access
    const qrPath = path.join(process.cwd(), 'sessions', instanceId, 'qrcode.txt');
    fs.writeFileSync(qrPath, qr);
    logger.info(`QR code saved to ${qrPath} for instance ${instanceId}`);
    
    // Update instance status
    updateInstanceStatus(instanceId, 'WAITING_FOR_QR_SCAN');
  });

  // Handle authentication state
  client.on('authenticated', () => {
    logger.info(`WhatsApp client for instance ${instanceId} authenticated successfully`);
    updateInstanceStatus(instanceId, 'AUTHENTICATED');
  });

  // Handle authentication failures
  client.on('auth_failure', (error) => {
    logger.error(`WhatsApp authentication failed for instance ${instanceId}:`, error);
    updateInstanceStatus(instanceId, 'AUTH_FAILURE');
  });

  // Handle client ready state
  client.on('ready', () => {
    logger.info(`WhatsApp client for instance ${instanceId} is ready`);
    
    // Clean up QR code file if it exists
    const qrPath = path.join(process.cwd(), 'sessions', instanceId, 'qrcode.txt');
    if (fs.existsSync(qrPath)) {
      fs.unlinkSync(qrPath);
    }
    
    updateInstanceStatus(instanceId, 'CONNECTED');
  });

  // Handle disconnection
  client.on('disconnected', (reason) => {
    logger.warn(`WhatsApp client for instance ${instanceId} disconnected:`, reason);
    updateInstanceStatus(instanceId, 'DISCONNECTED');
    
    // Attempt to reconnect after a delay
    setTimeout(() => {
      logger.info(`Attempting to reconnect WhatsApp client for instance ${instanceId}...`);
      client.initialize();
    }, 5000);
  });

  // Handle incoming messages
  client.on('message_create', async (message) => {
    try {
      // Log message received (with sensitive data redacted)
      const redactedBody = message.body ? message.body.substring(0, 20) + (message.body.length > 20 ? '...' : '') : '';
      logger.info(`Message received for instance ${instanceId} from ${message.from}: ${redactedBody}`);
      
      // Process the message with instance context
      await handleIncomingMessage(message, client, instanceId, config);
    } catch (error) {
      logger.error(`Error handling incoming message for instance ${instanceId}:`, error);
    }
  });
}

/**
 * Get a specific WhatsApp client instance
 * @param {string} instanceId - The instance ID
 * @returns {Object|null} - The WhatsApp client instance or null if not found
 */
function getClientInstance(instanceId) {
  return clientInstances[instanceId] || null;
}

/**
 * Check if a client instance exists and is initialized
 * @param {string} instanceId - The instance ID
 * @returns {boolean} - Whether the client instance exists and is initialized
 */
function isClientInitialized(instanceId) {
  return !!clientInstances[instanceId];
}

/**
 * Get the state of a client instance
 * @param {string} instanceId - The instance ID
 * @returns {Promise<string>} - The client state
 */
async function getClientState(instanceId) {
  try {
    const client = getClientInstance(instanceId);
    if (!client) {
      return 'NOT_INITIALIZED';
    }
    
    return await client.getState();
  } catch (error) {
    logger.error(`Error getting state for instance ${instanceId}:`, error);
    return 'ERROR';
  }
}

/**
 * Send a message from a specific instance
 * @param {string} instanceId - The instance ID
 * @param {string} to - The recipient's phone number with country code (@c.us format)
 * @param {string} message - The message to send
 * @returns {Promise<any>} - The sent message object
 */
async function sendMessage(instanceId, to, message) {
  const client = getClientInstance(instanceId);
  if (!client) {
    throw new Error(`WhatsApp client for instance ${instanceId} not initialized`);
  }
  
  try {
    // Validate the phone number format
    if (!to.endsWith('@c.us')) {
      to = `${to}@c.us`;
    }
    
    // Send the message
    const response = await client.sendMessage(to, message);
    logger.info(`Message sent from instance ${instanceId} to ${to}`);
    return response;
  } catch (error) {
    logger.error(`Failed to send message from instance ${instanceId} to ${to}:`, error);
    throw error;
  }
}

/**
 * List all active instances
 * @returns {Array} - Array of active instance IDs
 */
function listActiveInstances() {
  return Object.keys(clientInstances);
}

/**
 * Destroy a client instance
 * @param {string} instanceId - The instance ID
 * @returns {Promise<boolean>} - Whether the destroy was successful
 */
async function destroyClientInstance(instanceId) {
  try {
    const client = getClientInstance(instanceId);
    if (client) {
      // Attempt to log out and destroy the client
      await client.destroy();
      delete clientInstances[instanceId];
      logger.info(`Client instance ${instanceId} destroyed`);
    }
    
    // Update instance status
    await updateInstanceStatus(instanceId, 'DESTROYED');
    return true;
  } catch (error) {
    logger.error(`Error destroying client instance ${instanceId}:`, error);
    return false;
  }
}

module.exports = {
  initializeWhatsAppInstance,
  getClientInstance,
  isClientInitialized,
  getClientState,
  sendMessage,
  listActiveInstances,
  destroyClientInstance
};