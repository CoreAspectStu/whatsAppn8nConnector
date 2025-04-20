// src/index.js
require('dotenv').config();
const app = require('./app');
const { initializeWhatsApp } = require('./services/whatsappService');
const logger = require('./utils/logger');

// Configuration
const PORT = process.env.PORT || 3000;

// Initialize WhatsApp connection
initializeWhatsApp()
  .then(() => {
    logger.info('WhatsApp client initialized successfully');
  })
  .catch((error) => {
    logger.error('Failed to initialize WhatsApp client:', error);
    process.exit(1);
  });

// Start the Express server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`AI Provider: ${process.env.AI_PROVIDER}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Perform graceful shutdown if needed
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Perform graceful shutdown if needed
});

// Handle SIGTERM for graceful shutdown (important for containerized environments)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Close server, database connections, etc.
  process.exit(0);
});