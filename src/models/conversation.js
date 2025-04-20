// src/models/conversation.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/security');

// Directory to store conversation data
const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Get conversation history for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The conversation object
 */
async function getConversation(userId) {
  try {
    // Sanitize user ID for use in filename
    const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = path.join(DATA_DIR, `${safeUserId}_conversation.json`);
    
    // Check if conversation file exists
    if (!fs.existsSync(filePath)) {
      // Return empty conversation if file doesn't exist
      return {
        userId,
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
    logger.error(`Error getting conversation for ${userId}:`, error);
    
    // Return empty conversation on error
    return {
      userId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

/**
 * Save conversation history for a user
 * @param {string} userId - The user ID
 * @param {Object} conversation - The conversation object to save
 * @returns {Promise<boolean>} - Whether the save was successful
 */
async function saveConversation(userId, conversation) {
  try {
    // Sanitize user ID for use in filename
    const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = path.join(DATA_DIR, `${safeUserId}_conversation.json`);
    
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
    logger.error(`Error saving conversation for ${userId}:`, error);
    return false;
  }
}

/**
 * Clear conversation history for a user
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Whether the clear was successful
 */
async function clearConversation(userId) {
  try {
    // Sanitize user ID for use in filename
    const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = path.join(DATA_DIR, `${safeUserId}_conversation.json`);
    
    // Check if conversation file exists
    if (fs.existsSync(filePath)) {
      // Delete the file
      fs.unlinkSync(filePath);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error clearing conversation for ${userId}:`, error);
    return false;
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
    const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('_conversation.json'));
    
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
  deleteOldConversations
};