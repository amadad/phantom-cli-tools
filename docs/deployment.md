# Agent Social Deployment Guide

## Overview

Agent Social is deployed using Modal, a serverless platform that provides scalable compute resources. This guide covers deployment setup, configuration, monitoring, and troubleshooting.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Process](#deployment-process)
5. [Monitoring & Logs](#monitoring--logs)
6. [Troubleshooting](#troubleshooting)
7. [Performance Optimization](#performance-optimization)

## Prerequisites

### Required Accounts
- **Modal Account**: Sign up at [modal.com](https://modal.com)
- **Azure OpenAI**: Access to Azure OpenAI service
- **Serper API**: For news/content discovery
- **Slack Workspace**: For approval workflows
- **Social Media Accounts**: Twitter, LinkedIn, YouTube via Composio

### Local Requirements
```bash
# Python 3.10+
python --version

# Install Modal CLI
pip install modal

# Authenticate Modal
modal token new
```

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/agent-social.git
cd agent-social
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Modal Secrets

Create secrets in Modal dashboard or via CLI:

```bash
# Azure OpenAI secrets
modal secret create azure-openai-secrets \
  AZURE_OPENAI_API_KEY=your-key \
  AZURE_OPENAI_BASE_URL=your-endpoint \
  AZURE_OPENAI_DEPLOYMENT=gpt-4

# Serper API key
modal secret create serper-api-key \
  SERPER_API_KEY=your-serper-key

# Composio secrets (social media)
modal secret create composio-secrets \
  COMPOSIO_API_KEY=your-composio-key \
  TWITTER_CONNECTION_ID=your-twitter-id \
  LINKEDIN_CONNECTION_ID=your-linkedin-id \
  YOUTUBE_CONNECTION_ID=your-youtube-id

# Slack secrets
modal secret create slack-secrets \
  SLACK_BOT_TOKEN=xoxb-your-bot-token \
  SLACK_APP_TOKEN=xapp-your-app-token \
  SLACK_CHANNEL_ID=C1234567890

# Media generation APIs
modal secret create media-api-keys \
  REPLICATE_API_TOKEN=your-replicate-token \
  SONAUTO_API_KEY=your-sonauto-key

# Agno API key (optional)
modal secret create agno-secrets \
  AGNO_API_KEY=your-agno-key
```

## Environment Configuration

### Brand Configuration

1. Edit `brand/givecare.yml` to customize:
   - Brand voice and tone
   - Visual style
   - Content topics
   - Platform-specific settings

2. Key configuration sections:
```yaml
# Core brand identity
name: "YourBrand"
voice:
  tone: "professional, supportive"
  style: "conversational"

# Content topics for rotation
topics:
  - "Topic 1"
  - "Topic 2"
  - "Topic 3"

# Platform configurations
platforms:
  twitter:
    max_chars: 280
    optimal_times: ["9am", "12pm", "5pm"]
  linkedin:
    max_chars: 3000
    professional_tone: true
```

### Modal Configuration

The `modal_app.py` file contains deployment settings:

```python
# Container configuration
@app.cls(
    image=image,
    gpu="t4",  # GPU for media generation
    cpu=2.0,   # CPU cores
    memory=4096,  # Memory in MB
    timeout=1800,  # 30 minutes max
    retries=2,  # Automatic retries
    volumes={"/storage": storage_volume}
)
```

## Deployment Process

### 1. Test Locally
```bash
# Run pipeline test
python social_pipeline.py

# Test specific components
python utils/media_gen_parallel.py
python utils/slack_approval.py
```

### 2. Deploy to Modal
```bash
# Deploy the application
modal deploy modal_app.py

# Verify deployment
modal app list
```

### 3. Test Deployment
```bash
# Run test endpoint
modal run modal_app.py::test_endpoint

# Manual pipeline run
modal run modal_app.py::run_social_pipeline --topic "Test topic"

# Check scheduled function
modal run modal_app.py::scheduled_social_pipeline
```

## Monitoring & Logs

### Real-time Logs
```bash
# Stream all logs
modal logs -f

# Filter by function
modal logs -f --function scheduled_social_pipeline

# Last hour of logs
modal logs --since 1h
```

### Performance Monitoring

1. **Modal Dashboard**: View execution metrics at app.modal.com
2. **Telemetry**: If enabled, check Agno dashboard for:
   - Pipeline execution times
   - Cache hit rates
   - Error rates
   - Agent performance

### Health Checks
```bash
# Check deployment health
modal run modal_app.py::health_check

# View container status
modal container list
```

## Troubleshooting

### Common Issues

#### 1. Import Errors
```bash
# Error: ModuleNotFoundError
# Solution: Ensure all files are added to Modal image
.add_local_file("social_pipeline.py", remote_path="/app/social_pipeline.py")
.add_local_dir("utils/", remote_path="/app/utils/")
.add_local_dir("brand/", remote_path="/app/brand/")
```

#### 2. Secret Access Errors
```bash
# Error: Missing environment variable
# Solution: Verify secret names match exactly
modal secret list
modal secret whois azure-openai-secrets
```

#### 3. Memory/Timeout Issues
```python
# Increase resources in modal_app.py
@app.cls(
    memory=8192,  # Increase to 8GB
    timeout=3600,  # Increase to 60 minutes
)
```

#### 4. GPU Availability
```python
# If GPU unavailable, disable for text-only
@app.cls(
    gpu=None,  # Remove GPU requirement
)
```

### Debug Mode

Enable detailed logging:
```python
# In social_pipeline.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Performance Optimization

### 1. Container Warm-up
```python
# Keep containers warm
buffer_containers=1  # Always keep 1 warm
scaledown_window=300  # 5 min idle timeout
```

### 2. Caching Strategy
- Research results cached for 1 hour
- Brand config loaded once per container
- Media assets stored in persistent volume

### 3. Parallel Processing
- Platform adaptations run concurrently
- Media generation in parallel
- Approval requests sent simultaneously

### 4. Resource Allocation
```python
# Optimize based on workload
if heavy_media_generation:
    gpu="t4"
    memory=8192
else:
    gpu=None
    memory=4096
```

## CI/CD Integration

### GitHub Actions Workflow

The repository includes `.github/workflows/ci-cd.yml` for automated deployment:

```yaml
name: Deploy to Modal
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -r requirements.txt
      - run: modal deploy modal_app.py
```

### Required GitHub Secrets
- `MODAL_TOKEN_ID`
- `MODAL_TOKEN_SECRET`

## Best Practices

### 1. Version Control
- Tag deployments: `git tag v1.0.0`
- Document config changes in commits
- Keep brand configs in version control

### 2. Testing
- Test locally before deploying
- Use test endpoint for validation
- Monitor first scheduled runs closely

### 3. Security
- Rotate API keys regularly
- Use Modal secrets (never hardcode)
- Limit container permissions

### 4. Scaling
- Start with conservative resources
- Monitor usage patterns
- Scale based on actual needs

## Rollback Procedures

### Quick Rollback
```bash
# List recent deployments
modal deployment list

# Rollback to previous version
modal deployment rollback <deployment-id>
```

### Manual Recovery
```bash
# Stop current deployment
modal app stop social-pipeline-v2

# Deploy known good version
git checkout v1.0.0
modal deploy modal_app.py
```

## Support

### Modal Resources
- [Modal Documentation](https://modal.com/docs)
- [Modal Discord](https://discord.gg/modal)
- Support: support@modal.com

### Application Issues
- Check logs first: `modal logs -f`
- Review error handling in `utils/error_handling.py`
- Check circuit breaker states
- Verify all API keys are valid