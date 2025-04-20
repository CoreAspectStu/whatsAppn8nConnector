// src/models/user.js
const logger = require('../utils/logger');

/**
 * Check if a user is authorized to use the bot
 * @param {string} userId - The user ID to check
 * @returns {Promise<boolean>} - Whether the user is authorized
 */
async function isUserAuthorized(userId) {
  try {
    // Get the list of allowed users from environment variable
    const allowedUsers = (process.env.ALLOWED_USERS || '').split(',').map(u => u.trim());
    
    // Check if the user is in the allowed list or if the list contains '*' (allow all)
    if (allowedUsers.includes('*')) {
      return true;
    }
    
    // For group chats, check the ALLOWED_GROUPS environment variable
    if (userId.includes('@g.us')) {
      const allowedGroups = (process.env.ALLOWED_GROUPS || '').split(',').map(g => g.trim());
      return allowedGroups.includes(userId) || allowedGroups.includes('*');
    }
    
    // Remove @c.us suffix if present for comparison
    const normalizedUserId = userId.replace('@c.us', '');
    
    // Check if the user ID is in the allowed list (with or without @c.us)
    return allowedUsers.some(allowedUser => {
      const normalizedAllowedUser = allowedUser.replace('@c.us', '');
      return normalizedAllowedUser === normalizedUserId;
    });
  } catch (error) {
    logger.error('Error checking user authorization:', error);
    // Default to unauthorized in case of error
    return false;
  }
}

/**
 * Get user role (can be extended for more complex user management)
 * @param {string} userId - The user ID
 * @returns {Promise<string>} - The user role
 */
async function getUserRole(userId) {
  // In this simple implementation, all authorized users have the same role
  const isAuthorized = await isUserAuthorized(userId);
  return isAuthorized ? 'user' : 'unauthorized';
}

/**
 * Add a user to the allowed users list (in-memory only)
 * @param {string} userId - The user ID to add
 * @returns {Promise<boolean>} - Whether the user was added successfully
 */
async function addAllowedUser(userId) {
  try {
    // This is a simplified implementation that only works in-memory
    // In a real application, you would update a database or configuration file
    
    // Get the current allowed users
    const allowedUsers = (process.env.ALLOWED_USERS || '').split(',').map(u => u.trim());
    
    // Normalize the user ID
    const normalizedUserId = userId.replace('@c.us', '');
    
    // Check if the user is already in the list
    if (allowedUsers.some(u => u.replace('@c.us', '') === normalizedUserId)) {
      return true; // Already allowed
    }
    
    // Add the user to the list (this will only persist for the current process)
    allowedUsers.push(normalizedUserId);
    process.env.ALLOWED_USERS = allowedUsers.join(',');
    
    logger.info(`Added user ${normalizedUserId} to allowed users list`);
    return true;
  } catch (error) {
    logger.error('Error adding allowed user:', error);
    return false;
  }
}

/**
 * Remove a user from the allowed users list (in-memory only)
 * @param {string} userId - The user ID to remove
 * @returns {Promise<boolean>} - Whether the user was removed successfully
 */
async function removeAllowedUser(userId) {
  try {
    // Get the current allowed users
    const allowedUsers = (process.env.ALLOWED_USERS || '').split(',').map(u => u.trim());
    
    // Normalize the user ID
    const normalizedUserId = userId.replace('@c.us', '');
    
    // Filter out the user from the list
    const updatedList = allowedUsers.filter(u => u.replace('@c.us', '') !== normalizedUserId);
    
    // Update the environment variable
    process.env.ALLOWED_USERS = updatedList.join(',');
    
    logger.info(`Removed user ${normalizedUserId} from allowed users list`);
    return true;
  } catch (error) {
    logger.error('Error removing allowed user:', error);
    return false;
  }
}

module.exports = {
  isUserAuthorized,
  getUserRole,
  addAllowedUser,
  removeAllowedUser
};