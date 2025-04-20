// src/index.js
require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { listInstances, getInstanceConfig } = require('./models/instance');
const { initializeWhatsAppInstance } = require('./services/whatsappService');
const path = require('path');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 3030;

// Create necessary directories
function ensureDirectoriesExist() {
  const dirs = [
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'data', 'instances'),
    path.join(process.cwd(), 'sessions'),
    path.join(process.cwd(), 'logs')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
}

// Initialize all WhatsApp instances from saved configurations
async function initializeAllInstances() {
  try {
    // Get all instance IDs
    const instanceIds = await listInstances();
    logger.info(`Found ${instanceIds.length} instance(s) to initialize`);
    
    // Initialize each instance
    for (const instanceId of instanceIds) {
      try {
        const config = await getInstanceConfig(instanceId);
        if (config) {
          logger.info(`Initializing WhatsApp client for instance ${instanceId}`);
          await initializeWhatsAppInstance(instanceId, config);
        }
      } catch (error) {
        logger.error(`Failed to initialize instance ${instanceId}:`, error);
        // Continue with other instances even if one fails
      }
    }
  } catch (error) {
    logger.error('Failed to initialize WhatsApp instances:', error);
  }
}

// Start the application
async function startApp() {
  try {
    // Ensure directories exist
    ensureDirectoriesExist();
    
    // Initialize saved instances
    await initializeAllInstances();
    
    // Start the Express server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Process ID: ${process.pid}`);
    });
  } catch (error) {
    logger.error('Error starting application:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Exit with error in production, but stay alive in development
  if (process.env.NODE_ENV === 'production' && process.env.RESTART_ON_CRASH === 'true') {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Exit with error in production, but stay alive in development
  if (process.env.NODE_ENV === 'production' && process.env.RESTART_ON_CRASH === 'true') {
    process.exit(1);
  }
});

// Handle SIGTERM for graceful shutdown (important for containerized environments)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Close server, database connections, etc.
  process.exit(0);
});

// Start the application
startApp();