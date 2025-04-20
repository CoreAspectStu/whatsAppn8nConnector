# WhatsApp n8n Connector

A multi-instance WhatsApp gateway that connects with n8n for AI-powered responses. Deploy on Oracle Cloud via Coolify for a robust, scalable WhatsApp automation solution.

## 🌟 Features

- **Multi-Instance Support**: Manage multiple WhatsApp connections from a single server
- **n8n Integration**: Each instance can connect to different n8n workflows
- **Dynamic Webhook URLs**: Unique endpoint for each WhatsApp instance
- **Admin API**: Manage instances through a comprehensive API
- **Enhanced Security**: API key authentication and encryption capabilities
- **Conversation Memory**: Instance-specific conversation history for context
- **Group Chat Support**: Intelligent handling of group messages
- **Containerized**: Easy deployment with Docker and Coolify
- **API-First Design**: Perfect for integration with custom frontends

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

4. Run the server:
   ```bash
   npm start
   ```

### Creating a WhatsApp Instance

1. Create a new instance:
   ```bash
   curl -X POST http://localhost:3030/api/admin/instances \
     -H "Content-Type: application/json" \
     -H "X-Admin-Key: your-admin-key" \
     -d '{
       "instanceId": "instance1",
       "name": "My WhatsApp Bot",
       "n8nConfig": {
         "baseUrl": "http://your-n8n-server:5678",
         "webhookPath": "webhook/whatsapp-ai-bot",
         "apiKey": "your-n8n-api-key",
         "timeout": 15000
       },
       "allowedUsers": ["1234567890", "0987654321"],
       "allowedGroups": ["*"]
     }'
   ```

2. Get the QR code to authenticate WhatsApp:
   ```bash
   curl http://localhost:3030/api/instances/instance1/qr \
     -H "X-API-Key: your-api-key"
   ```

3. Scan the QR code with WhatsApp on your phone

### Docker Deployment

Build and run with Docker:
```bash
docker-compose up -d
```

## 🔧 API Reference

### Admin API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/instances` | POST | Create a new WhatsApp instance |
| `/api/admin/instances` | GET | List all instances |
| `/api/admin/instances/:instanceId` | GET | Get instance details |
| `/api/admin/instances/:instanceId` | PUT | Update instance configuration |
| `/api/admin/instances/:instanceId` | DELETE | Delete an instance |
| `/api/admin/instances/:instanceId/restart` | POST | Restart an instance |

### Public API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/instances/:instanceId/qr` | GET | Get QR code for authentication |
| `/api/webhook/:instanceId` | POST | Send a message via the instance |
| `/health` | GET | Check server health |
| `/version` | GET | Get server version information |

## n8n Integration

### Setting up the n8n Workflow

1. In n8n, create a new workflow with a webhook node
2. Configure the webhook path to match what you specified in the instance configuration
3. Add your AI processing nodes (OpenAI, logic, etc.)
4. Return responses in this format:
   ```json
   {
     "output": "The response text to send to WhatsApp"
   }
   ```

### Testing the Integration

Send a message to one of your allowed WhatsApp users or groups. The connector will:
1. Receive the message
2. Forward it to the corresponding n8n workflow
3. Send the AI-generated response back to WhatsApp

## Coolify Deployment on Oracle Cloud

1. Set up your Oracle Cloud instance with Coolify
2. Import this project into Coolify with these settings:
   - Port: 3030
   - Environment variables: Copy from your `.env` file
   - Persistent storage for:
     - `/app/data` - Instance configurations and conversations
     - `/app/sessions` - WhatsApp session data
     - `/app/logs` - Log files

3. Deploy the application

## ⚠️ Disclaimer

This is an unofficial method for connecting to WhatsApp. WhatsApp may block numbers that misuse automation. Use responsibly and adhere to WhatsApp's terms of service.

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📧 Contact

For support or collaboration, reach out at info@coreaspect.io
