// src/models/conversation.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/security');

// Directory to store conversation data
const DATA_DIR = path.join(process.cwd(), 'data', 'conversations');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Get conversation history for a user
 * @param {string} conversationId - The conversation ID (instanceId-userId or instanceId-groupId)
 * @returns {Promise<Object>} - The conversation object
 */
async function getConversation(conversationId) {
  try {
    // Sanitize conversation ID for use in filename
    const safeConversationId = conversationId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = path.join(DATA_DIR, `${safeConversationId}.json`);
    
    // Check if conversation file exists
    if (!fs.existsSync(filePath)) {
      // Return empty conversation if file doesn't exist
      return {
        conversationId,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    // Read and parse the conversation file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Decrypt if encryption is enabled
    const decryptedContent = process.env.ENCRYPTION_KEY 
      ? decrypt(fileContent) 
      : fileContent;
    
    const conversation = JSON.parse(decryptedContent);
    
    // Return the conversation
    return conversation;
  } catch (error) {
    logger.error(`Error getting conversation for ${conversationId}:`, error);
    
    // Return empty conversation on error
    return {
      conversationId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

/**
 * Save conversation history
 * @param {string} conversationId - The conversation ID (instanceId-userId or instanceId-groupId)
 * @param {Object} conversation - The conversation object to save
 * @returns {Promise<boolean>} - Whether the save was successful
 */
async function saveConversation(conversationId, conversation) {
  try {
    // Sanitize conversation ID for use in filename
    const safeConversationId = conversationId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = path.join(DATA_DIR, `${safeConversationId}.json`);
    
    // Update the timestamp
    conversation.updatedAt = new Date().toISOString();
    
    // Convert conversation to JSON
    const conversationJson = JSON.stringify(conversation, null, 2);
    
    // Encrypt if encryption is enabled
    const contentToSave = process.env.ENCRYPTION_KEY 
      ? encrypt(conversationJson) 
      : conversationJson;
    
    // Write the file
    fs.writeFileSync(filePath, contentToSave, 'utf8');
    
    return true;
  } catch (error) {
    logger.error(`Error saving conversation for ${conversationId}:`, error);
    return false;
  }
}

/**
 * Clear conversation history
 * @param {string} conversationId - The conversation ID (instanceId-userId or instanceId-groupId)
 * @returns {Promise<boolean>} - Whether the clear was successful
 */
async function clearConversation(conversationId) {
  try {
    // Sanitize conversation ID for use in filename
    const safeConversationId = conversationId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = path.join(DATA_DIR, `${safeConversationId}.json`);
    
    // Check if conversation file exists
    if (fs.existsSync(filePath)) {
      // Delete the file
      fs.unlinkSync(filePath);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error clearing conversation for ${conversationId}:`, error);
    return false;
  }
}

/**
 * Delete all conversations for an instance
 * @param {string} instanceId - The instance ID
 * @returns {Promise<number>} - The number of deleted conversations
 */
async function deleteInstanceConversations(instanceId) {
  try {
    // Get all conversation files for this instance
    const files = fs.readdirSync(DATA_DIR).filter(file => 
      file.startsWith(`${instanceId}-`) && file.endsWith('.json')
    );
    
    // Delete each file
    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      fs.unlinkSync(filePath);
      deletedCount++;
    }
    
    logger.info(`Deleted ${deletedCount} conversations for instance ${instanceId}`);
    return deletedCount;
  } catch (error) {
    logger.error(`Error deleting conversations for instance ${instanceId}:`, error);
    return 0;
  }
}

/**
 * Delete old conversations (older than specified days)
 * @param {number} days - The number of days to keep conversations
 * @returns {Promise<number>} - The number of deleted conversations
 */
async function deleteOldConversations(days = 30) {
  try {
    // Get all conversation files
    const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.json'));
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let deletedCount = 0;
    
    // Iterate through files and delete old ones
    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      const stats = fs.statSync(filePath);
      
      // Check if file is older than cutoff date
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    
    logger.info(`Deleted ${deletedCount} old conversations`);
    return deletedCount;
  } catch (error) {
    logger.error('Error deleting old conversations:', error);
    return 0;
  }
}

module.exports = {
  getConversation,
  saveConversation,
  clearConversation,
  deleteInstanceConversations,
  deleteOldConversations
};