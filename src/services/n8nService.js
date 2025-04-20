// src/services/n8nService.js
const axios = require('axios');
const logger = require('../utils/logger');

// Load configuration from environment variables
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const N8N_WEBHOOK_PATH = process.env.N8N_WEBHOOK_PATH || 'webhook/whatsapp-ai-bot';
const N8N_TIMEOUT = parseInt(process.env.N8N_TIMEOUT || '15000', 10);

// Create axios instance with default configuration
const n8nClient = axios.create({
  baseURL: N8N_BASE_URL,
  timeout: N8N_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(N8N_API_KEY ? { 'X-N8N-Api-Key': N8N_API_KEY } : {})
  }
});

/**
 * Send a message to n8n for AI processing
 * @param {Object} data - The message data
 * @param {string} data.message - The message content
 * @param {Object} data.sender - Information about the sender
 * @param {Object} data.conversation - Conversation history
 * @param {string} data.timestamp - The message timestamp
 * @returns {Promise<Object>} - The AI response
 */
async function sendMessageToN8n(data) {
  try {
    logger.debug(`Sending message to n8n: ${data.message.substring(0, 50)}...`);
    
    // Ensure we have a valid webhook URL
    const webhookUrl = `${N8N_BASE_URL}/${N8N_WEBHOOK_PATH}`.replace(/([^:]\/)\/+/g, '$1');
    
    // Send the request to n8n
    const response = await n8nClient.post(webhookUrl, data);
    
    // Validate the response
    if (!response.data) {
      throw new Error('Empty response from n8n');
    }
    
    logger.debug(`Received response from n8n: ${JSON.stringify(response.data).substring(0, 100)}...`);
    return response.data;
  } catch (error) {
    logger.error('Error sending message to n8n:', error.message);
    if (error.response) {
      logger.error(`n8n response status: ${error.response.status}`);
      logger.error(`n8n response data: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to process message with AI: ${error.message}`);
  }
}

/**
 * Check n8n health status
 * @returns {Promise<Object>} - Health check result
 */
async function checkN8nHealth() {
  try {
    // You can create a dedicated health check workflow in n8n
    const webhookUrl = `${N8N_BASE_URL}/webhook/whatsapp-bot-health`;
    const response = await n8nClient.get(webhookUrl);
    
    return {
      status: 'ok',
      message: response.data.message || 'n8n is healthy',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('n8n health check failed:', error.message);
    return {
      status: 'error',
      message: `n8n health check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Execute a specific AI model directly (fallback if agent isn't available)
 * @param {string} model - The model to use (e.g., 'gpt-4')
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The model's response
 */
async function executeAiModel(model, prompt, options = {}) {
  try {
    // This endpoint would be a custom n8n workflow designed to call an AI model directly
    const directAiUrl = `${N8N_BASE_URL}/webhook/direct-ai-call`;
    
    const response = await n8nClient.post(directAiUrl, {
      model,
      prompt,
      options
    });
    
    return response.data;
  } catch (error) {
    logger.error(`Error executing AI model ${model}:`, error.message);
    throw new Error(`Failed to execute AI model: ${error.message}`);
  }
}

/**
 * Get the status of a running n8n workflow execution
 * @param {string} executionId - The execution ID
 * @returns {Promise<Object>} - The execution status
 */
async function getWorkflowExecutionStatus(executionId) {
  try {
    // This requires n8n API access with appropriate permissions
    const response = await n8nClient.get(`/executions/${executionId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error getting execution status for ${executionId}:`, error.message);
    throw new Error(`Failed to get execution status: ${error.message}`);
  }
}

/**
 * Cancel a running n8n workflow execution
 * @param {string} executionId - The execution ID
 * @returns {Promise<boolean>} - Whether the cancellation was successful
 */
async function cancelWorkflowExecution(executionId) {
  try {
    // This requires n8n API access with appropriate permissions
    await n8nClient.post(`/executions/${executionId}/cancel`);
    return true;
  } catch (error) {
    logger.error(`Error cancelling execution ${executionId}:`, error.message);
    return false;
  }
}

module.exports = {
  sendMessageToN8n,
  checkN8nHealth,
  executeAiModel,
  getWorkflowExecutionStatus,
  cancelWorkflowExecution
};