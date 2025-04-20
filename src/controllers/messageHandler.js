// src/controllers/messageHandler.js
const logger = require('../utils/logger');
const { isUserAuthorized } = require('../models/user');
const { getConversation, saveConversation } = require('../models/conversation');
const { sendMessageToN8n, executeAiModel } = require('../services/n8nService');
const { sanitizeInput } = require('../utils/security');

/**
 * Handle incoming WhatsApp messages
 * @param {Object} message - The WhatsApp message object
 * @param {Object} client - The WhatsApp client instance
 * @returns {Promise<void>}
 */
async function handleIncomingMessage(message, client) {
  try {
    // Skip processing if message is from the bot itself
    if (message.fromMe && process.env.PROCESS_SELF_MESSAGES !== 'true') {
      logger.debug('Ignoring message from self');
      return;
    }

    // Get sender information
    const sender = message.from;
    const senderName = message._data.notifyName || 'Unknown';
    
    // Check if user is authorized to use the bot
    if (!await isUserAuthorized(sender)) {
      logger.warn(`Unauthorized message from ${sender}`);
      
      // Optionally respond to unauthorized users
      if (process.env.NOTIFY_UNAUTHORIZED === 'true') {
        await message.reply(
          "I'm sorry, you are not authorized to use this service. " +
          "Please contact the administrator if you believe this is an error."
        );
      }
      return;
    }

    // Process group messages differently if needed
    if (sender.includes('@g.us')) {
      return await handleGroupMessage(message, client);
    }

    // Sanitize and validate the message content
    const messageContent = sanitizeInput(message.body || '');
    if (!messageContent.trim()) {
      logger.debug('Empty message received, ignoring');
      return;
    }

    // Get conversation history for context
    const conversation = await getConversation(sender);
    
    // Set message "seen" status indicator if enabled
    if (process.env.SHOW_TYPING_INDICATOR === 'true') {
      await message.getChat().then(chat => {
        chat.sendStateTyping();
      }).catch(err => {
        logger.warn('Failed to send typing indicator:', err.message);
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
      messageType: message.type
    };

    // Process message with n8n AI workflow
    logger.info(`Processing message from ${sender}`);
    
    try {
      // Use n8n for AI processing (leverages the AI agent setup in n8n)
      const aiResponse = await sendMessageToN8n(requestData);
      
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
        logger.warn('No valid response from n8n, using fallback AI');
        
        const fallbackResponse = await handleFallbackAi(messageContent, conversation);
        await message.reply(fallbackResponse);
        
        // Update conversation history
        conversation.messages.push(
          { role: 'user', content: messageContent },
          { role: 'assistant', content: fallbackResponse }
        );
      }
    } catch (processingError) {
      logger.error('Error from n8n AI processing:', processingError);
      
      // Use fallback method
      const fallbackResponse = await handleFallbackAi(messageContent, conversation);
      await message.reply(fallbackResponse);
      
      // Update conversation history
      conversation.messages.push(
        { role: 'user', content: messageContent },
        { role: 'assistant', content: fallbackResponse }
      );
    }
    
    // Trim conversation history if it gets too long
    const maxLength = parseInt(process.env.MAX_CONVERSATION_LENGTH || '20', 10);
    if (conversation.messages.length > maxLength) {
      conversation.messages = conversation.messages.slice(-maxLength);
    }
    
    // Save updated conversation
    await saveConversation(sender, conversation);
    
    // Log analytics if enabled
    if (process.env.ENABLE_ANALYTICS === 'true') {
      logMessageAnalytics(sender, messageContent, conversation.messages[conversation.messages.length - 1].content);
    }
    
  } catch (error) {
    logger.error('Error handling message:', error);
    
    // Send error message to user
    try {
      await message.reply(
        "I encountered an error while processing your message. " +
        "Please try again later."
      );
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Handle messages from WhatsApp groups
 * @param {Object} message - The WhatsApp message object
 * @param {Object} client - The WhatsApp client instance
 * @returns {Promise<void>}
 */
async function handleGroupMessage(message, client) {
  try {
    // Get group and author information
    const groupId = message.from;
    const authorId = message.author || '';
    
    // Check if the bot should respond to this group
    const allowedGroups = (process.env.ALLOWED_GROUPS || '').split(',').map(g => g.trim());
    if (!allowedGroups.includes(groupId) && !allowedGroups.includes('*')) {
      logger.debug(`Group ${groupId} not in allowed list, ignoring message`);
      return;
    }
    
    // Check if the bot is mentioned or command prefix is used
    const mentionedIds = message.mentionedIds || [];
    const botNumber = client.info.wid._serialized;
    const isBotMentioned = mentionedIds.includes(botNumber);
    const hasCommandPrefix = message.body.startsWith(process.env.COMMAND_PREFIX || '!bot');
    
    // Only process if bot is mentioned or command prefix is used
    if (!isBotMentioned && !hasCommandPrefix) {
      return;
    }
    
    // Set message "seen" status indicator if enabled
    if (process.env.SHOW_TYPING_INDICATOR === 'true') {
      await message.getChat().then(chat => {
        chat.sendStateTyping();
      }).catch(err => {
        logger.warn('Failed to send typing indicator:', err.message);
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
        new RegExp(`^${process.env.COMMAND_PREFIX || '!bot'}`), 
        ''
      ).trim();
    }
    
    // Sanitize message content
    messageContent = sanitizeInput(messageContent);
    
    if (!messageContent.trim()) {
      logger.debug('Empty group message content after processing, ignoring');
      return;
    }
    
    // Get conversation history for this group
    const conversation = await getConversation(groupId);
    
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
      isGroup: true
    };
    
    // Process with n8n and reply
    logger.info(`Processing group message from ${authorId} in ${groupId}`);
    
    try {
      const aiResponse = await sendMessageToN8n(requestData);
      
      if (aiResponse && aiResponse.output) {
        await message.reply(aiResponse.output);
        
        // Update group conversation
        conversation.messages.push(
          { role: 'user', content: messageContent, author: authorId },
          { role: 'assistant', content: aiResponse.output }
        );
      } else {
        // Fallback to direct API if n8n fails
        logger.warn('No valid response from n8n, using fallback AI for group message');
        
        const fallbackResponse = await handleFallbackAi(messageContent, conversation);
        await message.reply(fallbackResponse);
        
        // Update conversation history
        conversation.messages.push(
          { role: 'user', content: messageContent, author: authorId },
          { role: 'assistant', content: fallbackResponse }
        );
      }
    } catch (processingError) {
      logger.error('Error from n8n AI processing for group message:', processingError);
      
      // Use fallback method
      const fallbackResponse = await handleFallbackAi(messageContent, conversation);
      await message.reply(fallbackResponse);
      
      // Update conversation history
      conversation.messages.push(
        { role: 'user', content: messageContent, author: authorId },
        { role: 'assistant', content: fallbackResponse }
      );
    }
    
    // Trim conversation history if it gets too long
    const maxLength = parseInt(process.env.MAX_CONVERSATION_LENGTH || '20', 10);
    if (conversation.messages.length > maxLength) {
      conversation.messages = conversation.messages.slice(-maxLength);
    }
    
    // Save updated conversation
    await saveConversation(groupId, conversation);
  } catch (error) {
    logger.error('Error handling group message:', error);
    try {
      await message.reply("I encountered an error while processing your message.");
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Handle fallback AI processing when n8n is unavailable
 * @param {string} message - The message to process
 * @param {Object} conversation - The conversation history
 * @returns {Promise<string>} - The AI response
 */
async function handleFallbackAi(message, conversation) {
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
    
    // Try to use n8n's direct AI execution (which still uses n8n but a simpler workflow)
    try {
      const result = await executeAiModel(
        process.env.OPENAI_MODEL || 'gpt-4',
        JSON.stringify(messages),
        { temperature: 0.7 }
      );
      return result.text || result.message || result.content;
    } catch (directAiError) {
      logger.error('Error using direct AI execution:', directAiError);
      
      // Final fallback: hardcoded response
      return "I'm currently experiencing technical difficulties. Please try again later or contact support if the issue persists.";
    }
  } catch (error) {
    logger.error('Error in fallback AI handling:', error);
    return "I'm sorry, I'm having trouble generating a response right now. Please try again later.";
  }
}

/**
 * Log message analytics
 * @param {string} sender - The sender's ID
 * @param {string} userMessage - The user's message
 * @param {string} botResponse - The bot's response
 */
function logMessageAnalytics(sender, userMessage, botResponse) {
  try {
    // Calculate some basic metrics
    const userMessageLength = userMessage.length;
    const botResponseLength = botResponse.length;
    const responseTime = new Date().getTime(); // You would calculate actual response time
    
    // Log the analytics data (in real implementation, you'd send this to a database or analytics service)
    logger.info('Message Analytics', {
      userId: sender,
      userMessageLength,
      botResponseLength,
      responseTime,
      timestamp: new Date().toISOString()
    });
    
    // If analytics webhook is configured, send the data there
    if (process.env.ANALYTICS_WEBHOOK) {
      // Use n8n client to send analytics data
      const axios = require('axios');
      axios.post(process.env.ANALYTICS_WEBHOOK, {
        userId: sender,
        userMessageLength,
        botResponseLength,
        responseTime,
        timestamp: new Date().toISOString()
      }).catch(error => {
        logger.error('Failed to send analytics data:', error.message);
      });
    }
  } catch (error) {
    logger.error('Error logging analytics:', error);
  }
}

module.exports = {
  handleIncomingMessage
};