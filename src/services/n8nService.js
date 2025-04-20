// src/services/n8nService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { getInstanceConfig } = require('../models/instance');

/**
 * Send a message to n8n for AI processing
 * @param {string} instanceId - The instance ID
 * @param {Object} data - The message data
 * @param {string} data.message - The message content
 * @param {Object} data.sender - Information about the sender
 * @param {Object} data.conversation - Conversation history
 * @param {string} data.timestamp - The message timestamp
 * @returns {Promise<Object>} - The AI response
 */
async function sendMessageToN8n(instanceId, data) {
  try {
    logger.debug(`Sending message to n8n for instance ${instanceId}: ${data.message.substring(0, 50)}...`);
    
    // Get instance configuration
    const instanceConfig = await getInstanceConfig(instanceId);
    if (!instanceConfig || !instanceConfig.n8nConfig) {
      throw new Error(`No n8n configuration found for instance ${instanceId}`);
    }
    
    const { baseUrl, apiKey, webhookPath } = instanceConfig.n8nConfig;
    
    // Create n8n client for this instance
    const n8nClient = axios.create({
      baseURL: baseUrl,
      timeout: parseInt(instanceConfig.n8nConfig.timeout || '15000', 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(apiKey ? { 'X-N8N-Api-Key': apiKey } : {})
      }
    });
    
    // Ensure we have a valid webhook URL
    const webhookUrl = `${baseUrl}/${webhookPath}`.replace(/([^:]\/)\/+/g, '$1');
    
    // Send the request to n8n
    const response = await n8nClient.post(webhookUrl, data);
    
    // Validate the response
    if (!response.data) {
      throw new Error('Empty response from n8n');
    }
    
    logger.debug(`Received response from n8n for instance ${instanceId}: ${JSON.stringify(response.data).substring(0, 100)}...`);
    return response.data;
  } catch (error) {
    logger.error(`Error sending message to n8n for instance ${instanceId}:`, error.message);
    if (error.response) {
      logger.error(`n8n response status: ${error.response.status}`);
      logger.error(`n8n response data: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to process message with AI: ${error.message}`);
  }
}

/**
 * Check n8n health status for a specific instance
 * @param {string} instanceId - The instance ID
 * @returns {Promise<Object>} - Health check result
 */
async function checkN8nHealth(instanceId) {
  try {
    // Get instance configuration
    const instanceConfig = await getInstanceConfig(instanceId);
    if (!instanceConfig || !instanceConfig.n8nConfig) {
      throw new Error(`No n8n configuration found for instance ${instanceId}`);
    }
    
    const { baseUrl, apiKey } = instanceConfig.n8nConfig;
    
    // Create n8n client for this instance
    const n8nClient = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        ...(apiKey ? { 'X-N8N-Api-Key': apiKey } : {})
      }
    });
    
    // Check if n8n is accessible
    const response = await n8nClient.get('/');
    
    return {
      status: 'ok',
      message: 'n8n is accessible',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`n8n health check failed for instance ${instanceId}:`, error.message);
    return {
      status: 'error',
      message: `n8n health check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Execute a specific AI model directly (fallback if agent isn't available)
 * @param {string} instanceId - The instance ID
 * @param {string} model - The model to use (e.g., 'gpt-4')
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The model's response
 */
async function executeAiModel(instanceId, model, prompt, options = {}) {
  try {
    // Get instance configuration
    const instanceConfig = await getInstanceConfig(instanceId);
    if (!instanceConfig || !instanceConfig.n8nConfig) {
      throw new Error(`No n8n configuration found for instance ${instanceId}`);
    }
    
    const { baseUrl, apiKey, fallbackWebhookPath } = instanceConfig.n8nConfig;
    
    // If no fallback webhook path is defined, throw an error
    if (!fallbackWebhookPath) {
      throw new Error('No fallback webhook path defined for this instance');
    }
    
    // Create n8n client for this instance
    const n8nClient = axios.create({
      baseURL: baseUrl,
      timeout: parseInt(instanceConfig.n8nConfig.timeout || '15000', 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(apiKey ? { 'X-N8N-Api-Key': apiKey } : {})
      }
    });
    
    // Send the request to the fallback webhook
    const fallbackUrl = `${baseUrl}/${fallbackWebhookPath}`.replace(/([^:]\/)\/+/g, '$1');
    const response = await n8nClient.post(fallbackUrl, {
      model,
      prompt,
      options,
      instanceId
    });
    
    return response.data;
  } catch (error) {
    logger.error(`Error executing AI model for instance ${instanceId}:`, error.message);
    throw new Error(`Failed to execute AI model: ${error.message}`);
  }
}

module.exports = {
  sendMessageToN8n,
  checkN8nHealth,
  executeAiModel
};