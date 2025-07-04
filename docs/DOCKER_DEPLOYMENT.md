# Docker Deployment Guide

## Overview

Agent Social is now a standalone Python application that can run locally or in Docker, making it easy to deploy to any server including Hetzner via Coolify.

## Quick Start

### Local Development

```bash
# Install dependencies with UV
uv sync

# Run once
./run.sh run

# Test with sample content
./run.sh test

# Run scheduler (every 6 hours)
./run.sh schedule
```

### Docker

```bash
# Build image
./run.sh docker-build

# Run once
./run.sh docker-run

# Run scheduler in background
./run.sh docker-schedule

# View logs
./run.sh docker-logs

# Stop
./run.sh docker-stop
```

## Configuration

### Environment Variables

Create a `.env` file with your API keys:

```bash
# Azure OpenAI
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT=your-deployment-name

# APIs
COMPOSIO_API_KEY=your-composio-key
SERPER_API_KEY=your-serper-key
AGNO_API_KEY=your-agno-key

# Social Platform Authentication
COMPOSIO_TWITTER_ENTITY_ID=your-twitter-entity
COMPOSIO_LINKEDIN_ENTITY_ID=your-linkedin-entity

# Telegram Bot (for approvals)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# Optional: Slack (fallback approval)
SLACK_BOT_TOKEN=your-slack-bot
SLACK_APP_TOKEN=your-slack-app
SLACK_CHANNEL_ID=your-channel
```

## Deployment Options

### 1. Direct Python (Development)

```bash
# Using UV
uv run python app.py

# With options
uv run python app.py --topic "self-care tips" --platforms twitter,linkedin
```

### 2. Docker (Production)

```bash
# Build
docker build -t agent-social:latest .

# Run once
docker run --rm --env-file .env \
  -v $(pwd)/output:/app/output \
  agent-social:latest

# Run with custom topic
docker run --rm --env-file .env \
  -v $(pwd)/output:/app/output \
  agent-social:latest \
  python app.py --topic "holiday caregiving"
```

### 3. Docker Compose

```bash
# Run once (test)
docker-compose run --rm agent-social

# Run scheduler
docker-compose --profile scheduler up -d

# Check logs
docker-compose --profile scheduler logs -f
```

### 4. Coolify Deployment

1. **Prepare your Hetzner server** with Coolify installed

2. **Create a new service** in Coolify:
   - Type: Docker
   - Source: Git repository or Docker image

3. **Configure environment variables** in Coolify's UI

4. **Set the Docker command**:
   ```
   python app.py --schedule 6
   ```

5. **Configure volumes**:
   - `/app/output` for persistent content storage
   - `/app/brands` if you want to customize brands

6. **Deploy** and monitor logs in Coolify

## Command Line Options

```bash
python app.py [options]

Options:
  --topic TEXT          Content topic (uses rotation if not provided)
  --platforms TEXT      Comma-separated platforms (default: twitter,linkedin)
  --auto-post          Post without approval
  --no-image           Skip image generation
  --no-stories         Skip story discovery
  --schedule HOURS     Run every N hours
  --brand-config PATH  Brand config file (default: brands/givecare.yml)
```

## Scheduling Options

### Built-in Scheduler
```bash
# Run every 6 hours
python app.py --schedule 6

# Run every 4 hours
python app.py --schedule 4
```

### System Cron
```cron
# Run at 8am, 2pm, 8pm daily
0 8,14,20 * * * cd /app && python app.py >> /var/log/agent-social.log 2>&1
```

### Systemd Service
```ini
[Unit]
Description=Agent Social
After=network.target

[Service]
Type=simple
User=agentsocial
WorkingDirectory=/app
ExecStart=/usr/local/bin/python /app/app.py --schedule 6
Restart=always
Environment="PATH=/usr/local/bin:/usr/bin"

[Install]
WantedBy=multi-user.target
```

## Output Structure

Generated content is saved in the `output/` directory:

```
output/
├── content/
│   ├── GiveCare_20250104_120000.json
│   └── GiveCare_20250104_180000.json
├── images/
│   └── [generated images]
└── posting_results.json
```

## Monitoring

### Check Latest Output
```bash
# View recent content
ls -la output/content/ | tail -5

# Check last run
cat output/content/$(ls -t output/content/ | head -1) | jq .
```

### Docker Logs
```bash
# Live logs
docker-compose --profile scheduler logs -f

# Last 100 lines
docker-compose --profile scheduler logs --tail 100
```

## Troubleshooting

### Environment Variables
```bash
# Verify all required vars are set
./run.sh test
```

### Docker Issues
```bash
# Rebuild image
docker-compose build --no-cache

# Check running containers
docker ps

# Inspect container
docker-compose --profile scheduler exec agent-social-scheduler /bin/bash
```

### API Errors
- Check API keys in `.env`
- Verify rate limits aren't exceeded
- Check network connectivity

## Security Notes

1. **Never commit `.env` file**
2. **Use Docker secrets in production**
3. **Rotate API keys regularly**
4. **Monitor output directory size**
5. **Set up log rotation**

## Performance Tuning

- Image generation takes ~45 seconds
- Content generation ~30 seconds per platform
- Total pipeline ~2-3 minutes
- Adjust `--schedule` based on needs

## Backup

Important data to backup:
- `output/` directory (generated content)
- `brands/` directory (brand configs)
- `.env` file (keep secure!)