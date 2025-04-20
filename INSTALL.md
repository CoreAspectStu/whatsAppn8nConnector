# WhatsApp n8n Connector - Installation Guide

This guide explains how to deploy the WhatsApp n8n Connector on Oracle Cloud using Coolify, configure it properly, and set up your first WhatsApp instance.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment on Coolify](#deployment-on-coolify)
3. [DNS Configuration](#dns-configuration)
4. [Environment Variables](#environment-variables)
5. [Persistent Storage](#persistent-storage)
6. [First-time Setup](#first-time-setup)
7. [Creating WhatsApp Instances](#creating-whatsapp-instances)
8. [n8n Workflow Configuration](#n8n-workflow-configuration)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

## Prerequisites

Before you begin, make sure you have:

- Oracle Cloud server with Coolify installed
- Domain name with ability to create subdomains
- n8n instance set up and running
- WhatsApp account for testing

## Deployment on Coolify

1. **Access Coolify Dashboard**
   - Go to your Coolify instance URL (e.g., `https://coolify.yourdomain.com`)
   - Log in with your credentials

2. **Create New Application**
   - Click "Create New Resource"
   - Select "Application"
   - Choose "GitHub" as the source
   - Connect to the GitHub repository: `CoreAspectStu/whatsAppn8nConnector`
   - Select the `main` branch

3. **General Configuration**
   - Name: `wa.coreaspectai.com` (or your preferred name)
   - Build Pack: `Dockerfile`
   - Direction: "Allow www & non-www"

4. **Build Configuration**
   - Base Directory: `/`
   - Dockerfile Location: `/Dockerfile`
   - Watch Paths: `src/pages/**` (for auto-rebuilding on changes)

## DNS Configuration

1. **Add DNS Record**
   - Type: A
   - Name: wa
   - Value: [Your Oracle Cloud Server IP]
   - TTL: 3600 (or lower for faster propagation)

2. **Verify Domain in Coolify**
   - Add domain: `https://wa.coreaspectai.com`
   - Wait for SSL certificate to be issued

## Environment Variables

Add the following environment variables to your Coolify application:

```
PORT=3030
NODE_ENV=production
LOG_LEVEL=info
API_KEY=WKpG7x2BQtkFJh4VdRSZa9eNfCjM3yT5
ADMIN_API_KEY=pEv8XsLu7QHtYN3DmAzKf5G6Bc9JrWdP
ENCRYPTION_KEY=aJ5KeS8zW2vN6qF7BpYhCx3DmLr4tG9E
JWT_SECRET=EdU6pT2xHfA9mQsVjK7yLzR3cBnW5gXZ
CORS_ORIGIN=*
RESTART_ON_CRASH=true
```

> **IMPORTANT**: The keys shown above are examples. Generate your own secure random keys for production use.

## Persistent Storage

Create three volume mounts:

1. **Data Volume**
   - Name: data or [auto-generated]
   - Source Path: `/data/coolify/applications/[your-app-id]/data`
   - Destination Path: `/app/data`

2. **Sessions Volume**
   - Name: sessions or [auto-generated]
   - Source Path: `/data/coolify/applications/[your-app-id]/sessions`
   - Destination Path: `/app/sessions`

3. **Logs Volume**
   - Name: logs or [auto-generated]
   - Source Path: `/data/coolify/applications/[your-app-id]/logs`
   - Destination Path: `/app/logs`

## Build Process Notes

The Dockerfile uses `npm install --production` instead of `npm ci` since we don't include a package-lock.json file in the repository. This ensures a successful build while still installing only production dependencies.

Key Dockerfile settings:
- Base image: node:18-slim
- Chromium installed for WhatsApp Web
- Persistent volumes for data, sessions, and logs
- Port exposed: 3030
- Health check configured

## First-time Setup

After deploying, check that your application is running:

1. **Verify Health Endpoint**
   ```bash
   curl https://wa.coreaspectai.com/health
   ```
   
   You should receive a response like:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-04-20T12:34:56.789Z",
     "version": "1.0.0",
     "environment": "production"
   }
   ```

## Creating WhatsApp Instances

Use the Admin API to create your first WhatsApp instance:

```bash
curl -X POST https://wa.coreaspectai.com/api/admin/instances \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: pEv8XsLu7QHtYN3DmAzKf5G6Bc9JrWdP" \
  -d '{
    "instanceId": "instance1",
    "name": "Primary Bot",
    "n8nConfig": {
      "baseUrl": "http://your-n8n-server:5678",
      "webhookPath": "webhook/whatsapp-ai-bot",
      "apiKey": "your-n8n-api-key",
      "timeout": 15000
    },
    "allowedUsers": ["917XXXXXXXXX"],
    "allowedGroups": ["*"],
    "options": {
      "commandPrefix": "!bot",
      "processSelfMessages": false,
      "notifyUnauthorized": true,
      "maxConversationLength": 20,
      "showTypingIndicator": true,
      "enableAnalytics": false
    }
  }'
```

## WhatsApp Authentication

1. **Get the QR Code**
   ```bash
   curl https://wa.coreaspectai.com/api/instances/instance1/qr \
     -H "X-API-Key: WKpG7x2BQtkFJh4VdRSZa9eNfCjM3yT5"
   ```

2. **Scan the QR Code**
   - The API will return a QR code as text
   - Use a QR code generator to convert it to an image (or use a service like https://www.qr-code-generator.com/)
   - Scan the QR code with your WhatsApp app

3. **Verify Connection**
   - Check that your WhatsApp client shows "Connected" status
   - Send a test message to yourself to verify the bot is responding

## n8n Workflow Configuration

1. **Import the Workflow**
   - Go to your n8n instance
   - Import the workflow file from `n8n/workflows/advanced_ai_whatsapp_bot.json`

2. **Configure the Webhook Node**
   - Set the webhook path to match what you specified when creating the instance
   - Activate the workflow

3. **Connect AI Services**
   - Configure the OpenAI credentials in n8n
   - Test the workflow with a manual execution

## Troubleshooting

### Build Issues
- If you see errors related to npm installation, check the Dockerfile
- The repository uses `npm install --production` which should work without a package-lock.json

### QR Code Issues
- If the QR code doesn't scan, regenerate it with the API
- Make sure your WhatsApp app is up to date

### Connection Issues
- Check the application logs in Coolify
- Ensure your n8n instance is accessible from the WhatsApp connector

### API Errors
- Verify you're using the correct API keys
- Check for typos in instance IDs or other parameters

## Maintenance

### Updating the Application
- Pull the latest changes from the GitHub repository
- Redeploy in Coolify

### Monitoring
- Check the logs regularly for any issues
- Set up alerts for the health endpoint

### Backup
- The persistent storage volumes contain all data
- Back them up regularly

---

For more details on API endpoints and features, refer to the [README.md](README.md) file.

> **Note**: This is a self-hosted solution. You are responsible for its security, maintenance, and compliance with WhatsApp's terms of service.
