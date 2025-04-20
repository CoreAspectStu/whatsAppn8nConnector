// src/config/index.js
require('dotenv').config();

/**
 * Application configuration
 * Loads from environment variables with sensible defaults
 */
const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  clientId: process.env.CLIENT_ID || 'whatsapp-ai-bot',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  encryptionKey: process.env.ENCRYPTION_KEY,
  apiKey: process.env.API_KEY,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // WhatsApp configuration
  commandPrefix: process.env.COMMAND_PREFIX || '!bot',
  processSelfMessages: process.env.PROCESS_SELF_MESSAGES === 'true',
  notifyUnauthorized: process.env.NOTIFY_UNAUTHORIZED === 'true',
  maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH || '20', 10),
  
  // User access control
  allowedUsers: (process.env.ALLOWED_USERS || '').split(',').map(u => u.trim()),
  allowedGroups: (process.env.ALLOWED_GROUPS || '').split(',').map(g => g.trim()),
  
  // n8n integration
  n8n: {
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY || '',
    webhookPath: process.env.N8N_WEBHOOK_PATH || 'webhook/whatsapp-ai-bot',
    timeout: parseInt(process.env.N8N_TIMEOUT || '10000', 10),
  },
  
  // AI provider settings
  aiProvider: process.env.AI_PROVIDER || 'openai',
  openAI: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
  },
  
  // Database configuration
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    path: process.env.DB_PATH || './data/conversations.db',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
  
  // Analytics
  enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
  analyticsWebhook: process.env.ANALYTICS_WEBHOOK,
  
  // Advanced options
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  concurrentSessions: parseInt(process.env.CONCURRENT_SESSIONS || '1', 10),
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
  restartOnCrash: process.env.RESTART_ON_CRASH === 'true',
};

module.exports = config;