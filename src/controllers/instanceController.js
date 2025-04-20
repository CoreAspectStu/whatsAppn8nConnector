// src/controllers/instanceController.js
const { 
  getInstanceConfig, 
  saveInstanceConfig, 
  deleteInstanceConfig,
  listInstances,
  getInstancesInfo,
  updateInstanceStatus
} = require('../models/instance');
const { 
  initializeWhatsAppInstance, 
  getClientInstance,
  isClientInitialized,
  getClientState,
  destroyClientInstance,
  listActiveInstances
} = require('../services/whatsappService');
const { checkN8nHealth } = require('../services/n8nService');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Create a new WhatsApp instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createInstance(req, res) {
  try {
    const { instanceId, name, n8nConfig, allowedUsers, allowedGroups, options } = req.body;
    
    // Validate input
    if (!instanceId || !n8nConfig || !n8nConfig.baseUrl || !n8nConfig.webhookPath) {
      return res.status(400).json({ error: 'Missing required configuration' });
    }
    
    // Validate instanceId format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9-_]+$/.test(instanceId)) {
      return res.status(400).json({ error: 'Instance ID can only contain alphanumeric characters, hyphens, and underscores' });
    }
    
    // Check if instance already exists
    const existingConfig = await getInstanceConfig(instanceId);
    if (existingConfig) {
      return res.status(409).json({ error: 'Instance ID already exists' });
    }
    
    // Check n8n connectivity
    try {
      // Test connection to n8n
      const response = await fetch(n8nConfig.baseUrl);
      if (!response.ok) {
        return res.status(400).json({ error: 'Cannot connect to n8n instance' });
      }
    } catch (connectionError) {
      return res.status(400).json({ error: `Cannot connect to n8n instance: ${connectionError.message}` });
    }
    
    // Create and save new configuration
    const config = {
      instanceId,
      name: name || instanceId,
      n8nConfig,
      allowedUsers: allowedUsers || [],
      allowedGroups: allowedGroups || [],
      options: options || {
        commandPrefix: '!bot',
        processSelfMessages: false,
        notifyUnauthorized: true,
        maxConversationLength: 20,
        showTypingIndicator: true,
        enableAnalytics: false
      },
      status: 'CREATED',
      created: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await saveInstanceConfig(instanceId, config);
    
    // Initialize WhatsApp client for this instance
    try {
      await initializeWhatsAppInstance(instanceId, config);
      logger.info(`WhatsApp client initialized for instance ${instanceId}`);
    } catch (initError) {
      logger.error(`Failed to initialize WhatsApp client for instance ${instanceId}:`, initError);
      // Still return success since the instance was created - client will be initialized on next restart
    }
    
    return res.status(201).json({ 
      message: 'Instance created successfully',
      instanceId,
      name: config.name,
      status: 'INITIALIZING',
      webhookUrl: `/api/webhook/${instanceId}`
    });
  } catch (error) {
    logger.error('Error creating instance:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get details for a specific instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getInstanceDetails(req, res) {
  try {
    const { instanceId } = req.params;
    
    // Get instance configuration
    const config = await getInstanceConfig(instanceId);
    if (!config) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get client state if initialized
    let clientState = 'NOT_INITIALIZED';
    if (isClientInitialized(instanceId)) {
      clientState = await getClientState(instanceId);
    }
    
    // Check n8n health
    const n8nHealth = await checkN8nHealth(instanceId);
    
    // Prepare response
    const response = {
      instanceId: config.instanceId,
      name: config.name,
      status: config.status,
      clientState,
      n8nHealth,
      created: config.created,
      updated: config.updatedAt,
      webhookUrl: `/api/webhook/${instanceId}`,
      allowedUsers: config.allowedUsers.length,
      allowedGroups: config.allowedGroups.length,
      options: config.options
    };
    
    return res.status(200).json(response);
  } catch (error) {
    logger.error(`Error getting instance details for ${req.params.instanceId}:`, error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * List all instances
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function listInstancesHandler(req, res) {
  try {
    // Get instance info for all instances
    const instances = await getInstancesInfo();
    
    // Get active instances
    const activeInstances = listActiveInstances();
    
    // Add client state to instance info
    const instancesWithState = await Promise.all(instances.map(async (instance) => {
      let clientState = 'NOT_INITIALIZED';
      if (activeInstances.includes(instance.id)) {
        clientState = await getClientState(instance.id);
      }
      
      return {
        ...instance,
        clientState,
        isActive: activeInstances.includes(instance.id)
      };
    }));
    
    return res.status(200).json(instancesWithState);
  } catch (error) {
    logger.error('Error listing instances:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Delete an instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteInstance(req, res) {
  try {
    const { instanceId } = req.params;
    
    // Check if instance exists
    const config = await getInstanceConfig(instanceId);
    if (!config) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Destroy client instance if initialized
    if (isClientInitialized(instanceId)) {
      await destroyClientInstance(instanceId);
    }
    
    // Delete instance configuration
    await deleteInstanceConfig(instanceId);
    
    // Delete session directory
    const sessionDir = path.join(process.cwd(), 'sessions', instanceId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    
    return res.status(200).json({ 
      message: 'Instance deleted successfully',
      instanceId
    });
  } catch (error) {
    logger.error(`Error deleting instance ${req.params.instanceId}:`, error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Update instance configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateInstance(req, res) {
  try {
    const { instanceId } = req.params;
    const { name, n8nConfig, allowedUsers, allowedGroups, options } = req.body;
    
    // Get existing configuration
    const existingConfig = await getInstanceConfig(instanceId);
    if (!existingConfig) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Update configuration
    const updatedConfig = {
      ...existingConfig,
      name: name || existingConfig.name,
      n8nConfig: n8nConfig || existingConfig.n8nConfig,
      allowedUsers: allowedUsers || existingConfig.allowedUsers,
      allowedGroups: allowedGroups || existingConfig.allowedGroups,
      options: options ? { ...existingConfig.options, ...options } : existingConfig.options,
      updatedAt: new Date().toISOString()
    };
    
    await saveInstanceConfig(instanceId, updatedConfig);
    
    // If client is initialized, we may need to restart it for some changes to take effect
    // This depends on which properties were changed
    const requiresRestart = 
      JSON.stringify(existingConfig.n8nConfig) !== JSON.stringify(updatedConfig.n8nConfig);
    
    if (requiresRestart && isClientInitialized(instanceId)) {
      await destroyClientInstance(instanceId);
      await initializeWhatsAppInstance(instanceId, updatedConfig);
    }
    
    return res.status(200).json({
      message: 'Instance updated successfully',
      instanceId,
      requiresRestart
    });
  } catch (error) {
    logger.error(`Error updating instance ${req.params.instanceId}:`, error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get QR code for an instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getInstanceQr(req, res) {
  try {
    const { instanceId } = req.params;
    
    // Check if instance exists
    const config = await getInstanceConfig(instanceId);
    if (!config) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Check if client is initialized
    if (!isClientInitialized(instanceId)) {
      // Try to initialize the client
      try {
        await initializeWhatsAppInstance(instanceId, config);
      } catch (initError) {
        return res.status(500).json({ 
          error: 'Failed to initialize WhatsApp client',
          message: initError.message
        });
      }
    }
    
    // Check client state
    const state = await getClientState(instanceId);
    if (state === 'CONNECTED') {
      return res.status(200).json({ status: 'connected' });
    }
    
    // Check for QR code file
    const qrPath = path.join(process.cwd(), 'sessions', instanceId, 'qrcode.txt');
    if (fs.existsSync(qrPath)) {
      const qrCode = fs.readFileSync(qrPath, 'utf8');
      return res.status(200).json({ 
        status: 'pending', 
        qrCode,
        state
      });
    }
    
    return res.status(202).json({ 
      status: 'initializing',
      message: 'QR code not yet generated',
      state
    });
  } catch (error) {
    logger.error(`Error getting QR code for instance ${req.params.instanceId}:`, error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Restart an instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function restartInstance(req, res) {
  try {
    const { instanceId } = req.params;
    
    // Get instance configuration
    const config = await getInstanceConfig(instanceId);
    if (!config) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Destroy client instance if initialized
    if (isClientInitialized(instanceId)) {
      await destroyClientInstance(instanceId);
    }
    
    // Initialize new client instance
    await initializeWhatsAppInstance(instanceId, config);
    
    return res.status(200).json({
      message: 'Instance restarted successfully',
      instanceId,
      status: 'INITIALIZING'
    });
  } catch (error) {
    logger.error(`Error restarting instance ${req.params.instanceId}:`, error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Register instance routes with Express app
 * @param {Object} app - Express app
 */
function registerInstanceRoutes(app) {
  const { validateApiKey, validateAdminKey } = require('../middleware/auth');
  
  // Instance management (admin only)
  app.post('/api/admin/instances', validateAdminKey, createInstance);
  app.get('/api/admin/instances', validateAdminKey, listInstancesHandler);
  app.get('/api/admin/instances/:instanceId', validateAdminKey, getInstanceDetails);
  app.put('/api/admin/instances/:instanceId', validateAdminKey, updateInstance);
  app.delete('/api/admin/instances/:instanceId', validateAdminKey, deleteInstance);
  app.post('/api/admin/instances/:instanceId/restart', validateAdminKey, restartInstance);
  
  // Instance QR code (accessible with regular API key)
  app.get('/api/instances/:instanceId/qr', validateApiKey, getInstanceQr);
}

module.exports = {
  createInstance,
  getInstanceDetails,
  listInstancesHandler,
  deleteInstance,
  updateInstance,
  getInstanceQr,
  restartInstance,
  registerInstanceRoutes
};