// src/models/instance.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/security');

// Directory to store instance data
const INSTANCES_DIR = path.join(process.cwd(), 'data', 'instances');

// Ensure instances directory exists
if (!fs.existsSync(INSTANCES_DIR)) {
  fs.mkdirSync(INSTANCES_DIR, { recursive: true });
}

/**
 * Get configuration for a specific instance
 * @param {string} instanceId - The instance ID
 * @returns {Promise<Object|null>} - The instance configuration or null if not found
 */
async function getInstanceConfig(instanceId) {
  try {
    // Sanitize instance ID for use in filename
    const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = path.join(INSTANCES_DIR, `${safeInstanceId}.json`);
    
    // Check if configuration file exists
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    // Read and parse the configuration file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Decrypt if encryption is enabled
    const decryptedContent = process.env.ENCRYPTION_KEY 
      ? decrypt(fileContent) 
      : fileContent;
    
    const config = JSON.parse(decryptedContent);
    
    // Return the configuration
    return config;
  } catch (error) {
    logger.error(`Error getting configuration for instance ${instanceId}:`, error);
    return null;
  }
}

/**
 * Save configuration for a specific instance
 * @param {string} instanceId - The instance ID
 * @param {Object} config - The configuration to save
 * @returns {Promise<boolean>} - Whether the save was successful
 */
async function saveInstanceConfig(instanceId, config) {
  try {
    // Sanitize instance ID for use in filename
    const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = path.join(INSTANCES_DIR, `${safeInstanceId}.json`);
    
    // Add last updated timestamp
    config.updatedAt = new Date().toISOString();
    
    // Convert config to JSON
    const configJson = JSON.stringify(config, null, 2);
    
    // Encrypt if encryption is enabled
    const contentToSave = process.env.ENCRYPTION_KEY 
      ? encrypt(configJson) 
      : configJson;
    
    // Write the file
    fs.writeFileSync(filePath, contentToSave, 'utf8');
    
    return true;
  } catch (error) {
    logger.error(`Error saving configuration for instance ${instanceId}:`, error);
    return false;
  }
}

/**
 * Delete configuration for a specific instance
 * @param {string} instanceId - The instance ID
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
async function deleteInstanceConfig(instanceId) {
  try {
    // Sanitize instance ID for use in filename
    const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = path.join(INSTANCES_DIR, `${safeInstanceId}.json`);
    
    // Check if configuration file exists
    if (fs.existsSync(filePath)) {
      // Delete the file
      fs.unlinkSync(filePath);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error deleting configuration for instance ${instanceId}:`, error);
    return false;
  }
}

/**
 * List all available instances
 * @returns {Promise<Array>} - Array of instance IDs
 */
async function listInstances() {
  try {
    // Get all configuration files
    const files = fs.readdirSync(INSTANCES_DIR).filter(file => file.endsWith('.json'));
    
    // Extract instance IDs from filenames
    const instanceIds = files.map(file => file.replace('.json', ''));
    
    return instanceIds;
  } catch (error) {
    logger.error('Error listing instances:', error);
    return [];
  }
}

/**
 * Get basic info for all instances
 * @returns {Promise<Array>} - Array of instance info objects
 */
async function getInstancesInfo() {
  try {
    const instanceIds = await listInstances();
    const instancesInfo = [];
    
    for (const instanceId of instanceIds) {
      const config = await getInstanceConfig(instanceId);
      if (config) {
        instancesInfo.push({
          id: instanceId,
          name: config.name || instanceId,
          created: config.created,
          updated: config.updatedAt,
          status: config.status || 'unknown'
        });
      }
    }
    
    return instancesInfo;
  } catch (error) {
    logger.error('Error getting instances info:', error);
    return [];
  }
}

/**
 * Update instance status
 * @param {string} instanceId - The instance ID
 * @param {string} status - The new status
 * @returns {Promise<boolean>} - Whether the update was successful
 */
async function updateInstanceStatus(instanceId, status) {
  try {
    const config = await getInstanceConfig(instanceId);
    if (!config) {
      return false;
    }
    
    config.status = status;
    return await saveInstanceConfig(instanceId, config);
  } catch (error) {
    logger.error(`Error updating status for instance ${instanceId}:`, error);
    return false;
  }
}

module.exports = {
  getInstanceConfig,
  saveInstanceConfig,
  deleteInstanceConfig,
  listInstances,
  getInstancesInfo,
  updateInstanceStatus
};