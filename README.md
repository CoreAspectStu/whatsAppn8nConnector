# WhatsApp n8n Connector

A robust WhatsApp AI chatbot with n8n integration, AI Agent capabilities, and enhanced security features for deployment on Oracle Cloud via Coolify.

## 🌟 Features

- **n8n-Powered AI Processing**: Leverages n8n's AI Agent capabilities for advanced tool calling
- **Multi-Model Support**: Works with OpenAI, Anthropic, or other LLM providers via n8n
- **Enhanced Security**: Proper authentication, encryption, and access control
- **Conversation Memory**: Persistent conversation history with context window management
- **Web Search Capabilities**: Can search the web to answer questions in real-time
- **Calculator Tool Integration**: Handles mathematical calculations directly
- **Group Chat Support**: Works in both individual and group conversations
- **Containerized**: Easy deployment with Docker and Coolify
- **Analytics**: Tracks usage patterns and performance metrics

## 📋 Prerequisites

- Node.js 18+ and npm
- n8n instance running on Oracle Cloud
- Coolify for deployment
- Docker (for local development and testing)
- OpenAI API key configured in n8n (not needed in the bot itself)

## 🚀 Quick Start

### Environment Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/CoreAspectStu/whatsAppn8nConnector.git
   cd whatsAppn8nConnector
   ```

2. Copy the environment template and fill in your values:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### n8n Setup

1. Import the provided workflows from the `n8n/workflows` directory into your n8n instance:
   - `advanced_ai_whatsapp_bot.json` - Main AI agent workflow
   - `bot_analytics.json` - Analytics tracking workflow

2. Configure the necessary credentials in n8n:
   - OpenAI API for the AI model
   - Other API credentials as needed (Google for search, etc.)

3. Activate the workflows in n8n

### Local Development

Run the application in development mode:
```bash
npm run dev
```

### Docker Deployment

Build and run with Docker:
```bash
docker-compose up -d
```

### Coolify Deployment on Oracle Cloud

1. Set up your Oracle Cloud instance with Coolify
2. Import this project into Coolify
3. Configure the environment variables
4. Deploy using the Coolify dashboard

## 🔧 Architecture

This solution uses a "thin client, smart server" architecture:

1. **WhatsApp Client (This Repository)**
   - Handles WhatsApp connectivity
   - Manages user sessions and authorization
   - Maintains conversation history
   - Forwards messages to n8n for processing

2. **n8n Instance (Your Oracle Cloud Server)**
   - Handles all AI processing with the AI Agent
   - Stores credentials securely
   - Performs web searches and calculations
   - Returns formatted responses

This approach offers several advantages:
- Your API keys remain secure in n8n, not in the WhatsApp client
- n8n's visual workflow builder makes it easy to customize AI behavior
- Tool calling capabilities are handled by n8n's AI Agent node
- You can modify the AI's behavior without redeploying the WhatsApp client

## 📱 WhatsApp Integration

This bot uses `whatsapp-web.js` to connect to WhatsApp. The first time you run it, you'll need to scan a QR code with your WhatsApp phone.

### Group Chat Usage

The bot can be used in group chats in two ways:
1. Mention the bot's number
2. Use a command prefix (default: !bot)

Example: `!bot What's the weather in London?`

## ⚠️ Disclaimer

This is an unofficial method for connecting to WhatsApp. WhatsApp may block numbers that misuse automation. Use responsibly and adhere to WhatsApp's terms of service.

## 🛠️ Troubleshooting

- **QR Code Not Showing**: Ensure your terminal supports QR code display or use the web interface
- **Connection Issues**: Check your network and firewall settings
- **Authentication Errors**: Verify your API keys and credentials
- **n8n Connection Problems**: Ensure your n8n instance is running and accessible
- **Container Failures**: Check the Docker logs for detailed error information

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📧 Contact

For support or collaboration, reach out at info@coreaspect.io