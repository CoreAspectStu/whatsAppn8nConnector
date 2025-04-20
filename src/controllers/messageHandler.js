// src/controllers/messageHandler.js
const logger = require('../utils/logger');
const { getConversation, saveConversation } = require('../models/conversation');
const { sendMessageToN8n, executeAiModel } = require('../services/n8nService');
const { sanitizeInput } = require('../utils/security');

/**
 * Handle incoming WhatsApp messages
 * @param {Object} message - The WhatsApp message object
 * @param {Object} client - The WhatsApp client instance
 * @param {string} instanceId - The instance ID
 * @param {Object} config - Instance configuration
 * @returns {Promise<void>}
 */
async function handleIncomingMessage(message, client, instanceId, config) {
  try {
    // Skip processing if message is from the bot itself
    if (message.fromMe && config.processSelfMessages !== true) {
      logger.debug(`Ignoring message from self for instance ${instanceId}`);
      return;
    }

    // Get sender information
    const sender = message.from;
    const senderName = message._data.notifyName || 'Unknown';
    
    // Check if user is authorized to use the bot
    if (!isUserAuthorized(sender, config)) {
      logger.warn(`Unauthorized message from ${sender} for instance ${instanceId}`);
      
      // Optionally respond to unauthorized users
      if (config.notifyUnauthorized === true) {
        await message.reply(
          "I'm sorry, you are not authorized to use this service. " +
          "Please contact the administrator if you believe this is an error."
        );
      }
      return;
    }

    // Process group messages differently if needed
    if (sender.includes('@g.us')) {
      return await handleGroupMessage(message, client, instanceId, config);
    }

    // Sanitize and validate the message content
    const messageContent = sanitizeInput(message.body || '');
    if (!messageContent.trim()) {
      logger.debug(`Empty message received for instance ${instanceId}, ignoring`);
      return;
    }

    // Get conversation history for context
    const conversationId = `${instanceId}-${sender}`;
    const conversation = await getConversation(conversationId);
    
    // Set message "seen" status indicator if enabled
    if (config.showTypingIndicator === true) {
      await message.getChat().then(chat => {
        chat.sendStateTyping();
      }).catch(err => {
        logger.warn(`Failed to send typing indicator for instance ${instanceId}:`, err.message);
      });
    }
    
    // Prepare data for AI processing
    const requestData = {
      message: messageContent,
      sender: {
        id: sender,
        name: senderName
      },
      conversation: conversation,
      timestamp: new Date().toISOString(),
      messageType: message.type,
      instanceId: instanceId
    };

    // Process message with n8n AI workflow
    logger.info(`Processing message from ${sender} for instance ${instanceId}`);
    
    try {
      // Use n8n for AI processing (leverages the AI agent setup in n8n)
      const aiResponse = await sendMessageToN8n(instanceId, requestData);
      
      // Handle the response
      if (aiResponse && aiResponse.output) {
        await message.reply(aiResponse.output);
        
        // Update conversation history
        conversation.messages.push(
          { role: 'user', content: messageContent },
          { role: 'assistant', content: aiResponse.output }
        );
      } else {
        // Fallback to direct API if n8n fails
        logger.warn(`No valid response from n8n for instance ${instanceId}, using fallback AI`);
        
        const fallbackResponse = await handleFallbackAi(instanceId, messageContent, conversation);
        await message.reply(fallbackResponse);
        
        // Update conversation history
        conversation.messages.push(
          { role: 'user', content: messageContent },
          { role: 'assistant', content: fallbackResponse }
        );
      }
    } catch (processingError) {
      logger.error(`Error from n8n AI processing for instance ${instanceId}:`, processingError);
      
      // Use fallback method
      const fallbackResponse = await handleFallbackAi(instanceId, messageContent, conversation);
      await message.reply(fallbackResponse);
      
      // Update conversation history
      conversation.messages.push(
        { role: 'user', content: messageContent },
        { role: 'assistant', content: fallbackResponse }
      );
    }
    
    // Trim conversation history if it gets too long
    const maxLength = config.maxConversationLength || 20;
    if (conversation.messages.length > maxLength) {
      conversation.messages = conversation.messages.slice(-maxLength);
    }
    
    // Save updated conversation
    await saveConversation(conversationId, conversation);
    
    // Log analytics if enabled
    if (config.enableAnalytics === true) {
      logMessageAnalytics(instanceId, sender, messageContent, conversation.messages[conversation.messages.length - 1].content);
    }
    
  } catch (error) {
    logger.error(`Error handling message for instance ${instanceId}:`, error);
    
    // Send error message to user
    try {
      await message.reply(
        "I encountered an error while processing your message. " +
        "Please try again later."
      );
    } catch (replyError) {
      logger.error(`Failed to send error message for instance ${instanceId}:`, replyError);
    }
  }
}

/**
 * Handle messages from WhatsApp groups
 * @param {Object} message - The WhatsApp message object
 * @param {Object} client - The WhatsApp client instance
 * @param {string} instanceId - The instance ID
 * @param {Object} config - Instance configuration
 * @returns {Promise<void>}
 */
async function handleGroupMessage(message, client, instanceId, config) {
  try {
    // Get group and author information
    const groupId = message.from;
    const authorId = message.author || '';
    
    // Check if the bot should respond to this group
    if (!isGroupAuthorized(groupId, config)) {
      logger.debug(`Group ${groupId} not authorized for instance ${instanceId}, ignoring message`);
      return;
    }
    
    // Check if the bot is mentioned or command prefix is used
    const mentionedIds = message.mentionedIds || [];
    const botNumber = client.info.wid._serialized;
    const isBotMentioned = mentionedIds.includes(botNumber);
    const hasCommandPrefix = message.body.startsWith(config.commandPrefix || '!bot');
    
    // Only process if bot is mentioned or command prefix is used
    if (!isBotMentioned && !hasCommandPrefix) {
      return;
    }
    
    // Set message "seen" status indicator if enabled
    if (config.showTypingIndicator === true) {
      await message.getChat().then(chat => {
        chat.sendStateTyping();
      }).catch(err => {
        logger.warn(`Failed to send typing indicator for instance ${instanceId}:`, err.message);
      });
    }
    
    // Remove the mention or command prefix
    let messageContent = message.body;
    if (isBotMentioned) {
      // Remove the mention tag (format: @number)
      messageContent = messageContent.replace(/@\d+/, '').trim();
    }
    if (hasCommandPrefix) {
      // Remove the command prefix
      messageContent = messageContent.replace(
        new RegExp(`^${config.commandPrefix || '!bot'}`), 
        ''
      ).trim();
    }
    
    // Sanitize message content
    messageContent = sanitizeInput(messageContent);
    
    if (!messageContent.trim()) {
      logger.debug(`Empty group message content after processing for instance ${instanceId}, ignoring`);
      return;
    }
    
    // Get conversation history for this group
    const conversationId = `${instanceId}-${groupId}`;
    const conversation = await getConversation(conversationId);
    
    // Prepare data for AI processing
    const requestData = {
      message: messageContent,
      sender: {
        id: authorId,
        name: message._data.notifyName || 'Unknown',
        inGroup: groupId
      },
      conversation: conversation,
      timestamp: new Date().toISOString(),
      messageType: message.type,
      isGroup: true,
      instanceId: instanceId
    };
    
    // Process with n8n and reply
    logger.info(`Processing group message from ${authorId} in ${groupId} for instance ${instanceId}`);
    
    try {
      const aiResponse = await sendMessageToN8n(instanceId, requestData);
      
      if (aiResponse && aiResponse.output) {
        await message.reply(aiResponse.output);
        
        // Update group conversation
        conversation.messages.push(
          { role: 'user', content: messageContent, author: authorId },
          { role: 'assistant', content: aiResponse.output }
        );
      } else {
        // Fallback to direct API if n8n fails
        logger.warn(`No valid response from n8n for group message in instance ${instanceId}, using fallback AI`);
        
        const fallbackResponse = await handleFallbackAi(instanceId, messageContent, conversation);
        await message.reply(fallbackResponse);
        
        // Update conversation history
        conversation.messages.push(
          { role: 'user', content: messageContent, author: authorId },
          { role: 'assistant', content: fallbackResponse }
        );
      }
    } catch (processingError) {
      logger.error(`Error from n8n AI processing for group message in instance ${instanceId}:`, processingError);
      
      // Use fallback method
      const fallbackResponse = await handleFallbackAi(instanceId, messageContent, conversation);
      await message.reply(fallbackResponse);
      
      // Update conversation history
      conversation.messages.push(
        { role: 'user', content: messageContent, author: authorId },
        { role: 'assistant', content: fallbackResponse }
      );
    }
    
    // Trim conversation history if it gets too long
    const maxLength = config.maxConversationLength || 20;
    if (conversation.messages.length > maxLength) {
      conversation.messages = conversation.messages.slice(-maxLength);
    }
    
    // Save updated conversation
    await saveConversation(conversationId, conversation);
  } catch (error) {
    logger.error(`Error handling group message for instance ${instanceId}:`, error);
    try {
      await message.reply("I encountered an error while processing your message.");
    } catch (replyError) {
      logger.error(`Failed to send error message for instance ${instanceId}:`, replyError);
    }
  }
}

/**
 * Check if a user is authorized to use the bot
 * @param {string} userId - The user ID to check
 * @param {Object} config - Instance configuration
 * @returns {boolean} - Whether the user is authorized
 */
function isUserAuthorized(userId, config) {
  // If no configuration is provided, deny access
  if (!config) {
    return false;
  }
  
  // If allowedUsers includes '*', allow all users
  if (config.allowedUsers && config.allowedUsers.includes('*')) {
    return true;
  }
  
  // For group chats, check allowedGroups
  if (userId.includes('@g.us')) {
    return isGroupAuthorized(userId, config);
  }
  
  // Check if the user is in the allowed list
  if (config.allowedUsers && Array.isArray(config.allowedUsers)) {
    // Remove @c.us suffix if present for comparison
    const normalizedUserId = userId.replace('@c.us', '');
    
    return config.allowedUsers.some(allowedUser => {
      const normalizedAllowedUser = allowedUser.replace('@c.us', '');
      return normalizedAllowedUser === normalizedUserId;
    });
  }
  
  // Default to deny access
  return false;
}

/**
 * Check if a group is authorized
 * @param {string} groupId - The group ID to check
 * @param {Object} config - Instance configuration
 * @returns {boolean} - Whether the group is authorized
 */
function isGroupAuthorized(groupId, config) {
  // If no configuration is provided, deny access
  if (!config) {
    return false;
  }
  
  // If allowedGroups includes '*', allow all groups
  if (config.allowedGroups && config.allowedGroups.includes('*')) {
    return true;
  }
  
  // Check if the group is in the allowed list
  if (config.allowedGroups && Array.isArray(config.allowedGroups)) {
    return config.allowedGroups.includes(groupId);
  }
  
  // Default to deny access
  return false;
}

/**
 * Handle fallback AI processing when n8n is unavailable
 * @param {string} instanceId - The instance ID
 * @param {string} message - The message to process
 * @param {Object} conversation - The conversation history
 * @returns {Promise<string>} - The AI response
 */
async function handleFallbackAi(instanceId, message, conversation) {
  try {
    // Prepare a system message
    const systemMessage = "You are a helpful WhatsApp assistant. Be concise and helpful.";
    
    // Prepare the conversation history in the format expected by the model
    const messages = [
      { role: 'system', content: systemMessage }
    ];
    
    // Add conversation history (limited to last few messages)
    if (conversation && Array.isArray(conversation.messages)) {
      const recentMessages = conversation.messages.slice(-5);
      messages.push(...recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    }
    
    // Add the current message
    messages.push({ role: 'user', content: message });
    
    // Try to use n8n's direct AI execution
    try {
      const result = await executeAiModel(
        instanceId,
        'gpt-4', // Use a default model
        JSON.stringify(messages),
        { temperature: 0.7 }
      );
      return result.text || result.message || result.content;
    } catch (directAiError) {
      logger.error(`Error using direct AI execution for instance ${instanceId}:`, directAiError);
      
      // Final fallback: hardcoded response
      return "I'm currently experiencing technical difficulties. Please try again later or contact support if the issue persists.";
    }
  } catch (error) {
    logger.error(`Error in fallback AI handling for instance ${instanceId}:`, error);
    return "I'm sorry, I'm having trouble generating a response right now. Please try again later.";
  }
}

/**
 * Log message analytics
 * @param {string} instanceId - The instance ID
 * @param {string} sender - The sender's ID
 * @param {string} userMessage - The user's message
 * @param {string} botResponse - The bot's response
 */
function logMessageAnalytics(instanceId, sender, userMessage, botResponse) {
  try {
    // Calculate some basic metrics
    const userMessageLength = userMessage.length;
    const botResponseLength = botResponse.length;
    const responseTime = new Date().getTime();
    
    // Log the analytics data
    logger.info('Message Analytics', {
      instanceId,
      userId: sender,
      userMessageLength,
      botResponseLength,
      responseTime,
      timestamp: new Date().toISOString()
    });
    
    // If analytics webhook is configured, send the data there
    const { getInstanceConfig } = require('../models/instance');
    getInstanceConfig(instanceId).then(config => {
      if (config && config.analyticsWebhook) {
        // Use axios to send analytics data
        const axios = require('axios');
        axios.post(config.analyticsWebhook, {
          instanceId,
          userId: sender,
          userMessageLength,
          botResponseLength,
          responseTime,
          timestamp: new Date().toISOString()
        }).catch(error => {
          logger.error(`Failed to send analytics data for instance ${instanceId}:`, error.message);
        });
      }
    }).catch(error => {
      logger.error(`Failed to get instance config for analytics for instance ${instanceId}:`, error.message);
    });
  } catch (error) {
    logger.error(`Error logging analytics for instance ${instanceId}:`, error);
  }
}

module.exports = {
  handleIncomingMessage,
  isUserAuthorized,
  isGroupAuthorized
};