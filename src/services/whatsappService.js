// src/services/whatsappService.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { handleIncomingMessage } = require('../controllers/messageHandler');
const logger = require('../utils/logger');
const config = require('../config');

// Global client instance
let whatsappClient = null;

/**
 * Initialize the WhatsApp client
 * @returns {Promise<void>}
 */
async function initializeWhatsApp() {
  try {
    // Create sessions directory if it doesn't exist
    const sessionDir = path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Initialize WhatsApp client with better configuration
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: sessionDir,
        clientId: process.env.CLIENT_ID || 'whatsapp-ai-bot'
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

    // Handle QR code for authentication
    whatsappClient.on('qr', (qr) => {
      logger.info('QR code received. Scan with your WhatsApp phone.');
      // Generate QR in terminal
      qrcode.generate(qr, { small: true });
      
      // Also save QR code to a file for web access if needed
      const qrPath = path.join(process.cwd(), 'qrcode.txt');
      fs.writeFileSync(qrPath, qr);
      logger.info(`QR code also saved to ${qrPath}`);
    });

    // Handle authentication state
    whatsappClient.on('authenticated', () => {
      logger.info('WhatsApp client authenticated successfully');
    });

    // Handle authentication failures
    whatsappClient.on('auth_failure', (error) => {
      logger.error('WhatsApp authentication failed:', error);
    });

    // Handle client ready state
    whatsappClient.on('ready', () => {
      logger.info('WhatsApp client is ready');
      // Clean up QR code file if it exists
      const qrPath = path.join(process.cwd(), 'qrcode.txt');
      if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
      }
    });

    // Handle disconnection
    whatsappClient.on('disconnected', (reason) => {
      logger.warn('WhatsApp client disconnected:', reason);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        logger.info('Attempting to reconnect WhatsApp client...');
        whatsappClient.initialize();
      }, 5000);
    });

    // Handle incoming messages
    whatsappClient.on('message_create', async (message) => {
      try {
        // Log message received (with sensitive data redacted)
        const redactedBody = message.body ? message.body.substring(0, 20) + (message.body.length > 20 ? '...' : '') : '';
        logger.info(`Message received from ${message.from}: ${redactedBody}`);
        
        // Process the message
        await handleIncomingMessage(message, whatsappClient);
      } catch (error) {
        logger.error('Error handling incoming message:', error);
      }
    });

    // Initialize the client
    await whatsappClient.initialize();
    
    return whatsappClient;
  } catch (error) {
    logger.error('Failed to initialize WhatsApp client:', error);
    throw error;
  }
}

/**
 * Send a message to a WhatsApp chat
 * @param {string} to - The recipient's phone number with country code (@c.us format)
 * @param {string} message - The message to send
 * @returns {Promise<any>} - The sent message object
 */
async function sendMessage(to, message) {
  if (!whatsappClient) {
    throw new Error('WhatsApp client not initialized');
  }
  
  try {
    // Validate the phone number format
    if (!to.endsWith('@c.us')) {
      to = `${to}@c.us`;
    }
    
    // Send the message
    const response = await whatsappClient.sendMessage(to, message);
    logger.info(`Message sent to ${to}`);
    return response;
  } catch (error) {
    logger.error(`Failed to send message to ${to}:`, error);
    throw error;
  }
}

/**
 * Send a media message to a WhatsApp chat
 * @param {string} to - The recipient's phone number
 * @param {Buffer|string} media - The media content (buffer or base64)
 * @param {string} filename - The filename
 * @param {string} caption - Optional caption
 * @returns {Promise<any>} - The sent message object
 */
async function sendMediaMessage(to, media, filename, caption = '') {
  if (!whatsappClient) {
    throw new Error('WhatsApp client not initialized');
  }
  
  try {
    // Create MessageMedia object
    const messageMedia = new MessageMedia(
      getContentType(filename),
      typeof media === 'string' ? media : media.toString('base64'),
      filename
    );
    
    // Send the media message
    const response = await whatsappClient.sendMessage(to, messageMedia, { caption });
    logger.info(`Media message sent to ${to}`);
    return response;
  } catch (error) {
    logger.error(`Failed to send media message to ${to}:`, error);
    throw error;
  }
}

/**
 * Get content type based on file extension
 * @param {string} filename - The filename
 * @returns {string} - The MIME type
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webp': 'image/webp'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Check if a number exists on WhatsApp
 * @param {string} number - The phone number to check
 * @returns {Promise<boolean>} - Whether the number exists
 */
async function checkNumberExists(number) {
  if (!whatsappClient) {
    throw new Error('WhatsApp client not initialized');
  }
  
  try {
    // Format the number
    const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    
    // Check if the number exists
    const exists = await whatsappClient.isRegisteredUser(formattedNumber);
    return exists;
  } catch (error) {
    logger.error(`Failed to check if number exists ${number}:`, error);
    throw error;
  }
}

/**
 * Get the current connection state
 * @returns {string} - The connection state
 */
function getConnectionState() {
  if (!whatsappClient) {
    return 'DISCONNECTED';
  }
  
  return whatsappClient.getState();
}

module.exports = {
  initializeWhatsApp,
  sendMessage,
  sendMediaMessage,
  checkNumberExists,
  getConnectionState
};