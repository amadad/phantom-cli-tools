# Deployment Guide

## Overview
Deploy the brand-agnostic social media pipeline to Modal for serverless execution with scheduled posting and multimedia generation.

## Prerequisites

### 1. Environment Setup
```bash
# Clone and setup
git clone <repository>
cd agent-social
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Fill in all API keys
```

### 2. Required API Keys
```bash
# AI Models
AZURE_OPENAI_API_KEY=""           # Azure OpenAI access
AZURE_OPENAI_BASE_URL=""          # Azure endpoint
SERPER_API_KEY=""                 # News discovery

# Media Generation
REPLICATE_API_TOKEN=""            # Image generation
SONAUTO_API_KEY=""               # Audio generation (optional)

# Social Platforms
COMPOSIO_API_KEY=""              # Multi-platform posting
TWITTER_CONNECTION_ID=""          # Twitter integration
LINKEDIN_CONNECTION_ID=""         # LinkedIn integration
YOUTUBE_CONNECTION_ID=""          # YouTube integration

# Approval Workflow
SLACK_BOT_TOKEN=""               # Slack bot
SLACK_APPROVAL_CHANNEL=""        # Approval channel
```

### 3. Brand Configuration
```yaml
# brand/your-brand.yml
name: "YourBrand"
voice_tone: "Professional and friendly"
voice_style: "Conversational, clear"
color_palette: "#FF6B35, #2D3748, #F7FAFC"
image_style: "modern, clean, professional"
attributes: "trustworthy, innovative, accessible"
```

## Local Development

### Test Individual Components
```bash
# Test multimedia generation
python utils/multimedia_gen.py

# Test Slack approval workflow
python utils/slack_approval.py

# Test full pipeline
python social_pipeline.py --test
```

### Generate Content Locally
```bash
# With approval workflow
python social_pipeline.py "Your content topic"

# Skip approval for testing
python social_pipeline.py --no-approval "Your topic"

# Generate and auto-post
python social_pipeline.py --post "Your topic"
```

## Modal Deployment

### 1. Install Modal CLI
```bash
pip install modal
modal setup
```

### 2. Configure Modal Secrets
```bash
# Azure OpenAI secrets
modal secret create azure-openai-secrets \
  AZURE_OPENAI_API_KEY="your-key" \
  AZURE_OPENAI_BASE_URL="your-endpoint"

# Search API secrets
modal secret create serper-api-key \
  SERPER_API_KEY="your-key"

# Composio secrets
modal secret create composio-secrets \
  COMPOSIO_API_KEY="your-key" \
  TWITTER_CONNECTION_ID="your-id" \
  LINKEDIN_CONNECTION_ID="your-id" \
  YOUTUBE_CONNECTION_ID="your-id"

# Slack secrets
modal secret create slack-secrets \
  SLACK_BOT_TOKEN="your-token" \
  SLACK_APPROVAL_CHANNEL="#your-channel"

# Media generation secrets (optional)
modal secret create media-secrets \
  REPLICATE_API_TOKEN="your-token" \
  SONAUTO_API_KEY="your-key"
```

### 3. Deploy to Modal
```bash
# Deploy the application
modal deploy modal_deploy.py

# Test deployment
modal run modal_deploy.py::run_social_pipeline \
  --topic "Test topic" \
  --platforms "twitter,linkedin"

# Check health
modal run modal_deploy.py::health_check
```

### 4. Monitor Deployment
```bash
# Stream logs
modal logs -f brand-social-pipeline

# Check scheduled runs
modal logs brand-social-pipeline scheduled_pipeline

# View app dashboard
modal app list
```

## Production Configuration

### Scheduled Execution
The pipeline runs automatically every 6 hours:
- **00:00 UTC**: Morning content
- **06:00 UTC**: Midday content  
- **12:00 UTC**: Afternoon content
- **18:00 UTC**: Evening content

### Manual Triggers
```bash
# Manual pipeline execution
modal run modal_deploy.py::run_social_pipeline \
  --topic "Breaking news topic" \
  --platforms "twitter,linkedin,youtube" \
  --auto_post false

# Emergency posting (skip approval)
modal run modal_deploy.py::run_social_pipeline \
  --topic "Urgent announcement" \
  --auto_post true
```

### Environment-Specific Configs
```python
# Update modal_deploy.py for different environments
app_names = {
    "dev": "brand-social-dev",
    "staging": "brand-social-staging", 
    "prod": "brand-social-pipeline"
}

# Environment-specific secrets
secrets_by_env = {
    "dev": ["dev-secrets"],
    "prod": ["prod-secrets"]
}
```

## Monitoring & Maintenance

### Health Checks
```bash
# Application health
curl https://your-app.modal.run/health

# Pipeline status
modal logs brand-social-pipeline --follow
```

### Content Monitoring
- **Slack approval channel**: Monitor approval requests
- **Output directory**: Review generated content
- **Modal logs**: Track pipeline execution

### Error Handling
```bash
# Check failed runs
modal logs brand-social-pipeline --filter "ERROR"

# Restart failed pipeline
modal run modal_deploy.py::run_social_pipeline --topic "retry-topic"

# Update deployment
modal deploy modal_deploy.py --force
```

## Troubleshooting

### Common Issues

#### 1. API Key Errors
```bash
# Verify secrets
modal secret list

# Update secrets
modal secret create secret-name KEY="new-value"
```

#### 2. Composio Connection Issues
```bash
# Test connection IDs in Composio dashboard
# Verify platform permissions
# Check rate limits
```

#### 3. Slack Approval Not Working
```bash
# Verify bot permissions
# Check channel configuration
# Test with terminal approval fallback
```

#### 4. Media Generation Failures
```bash
# Check Replicate/Sonauto API status
# Verify API keys and quotas
# Test with simplified prompts
```

### Debug Mode
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Test individual components
python -c "
import asyncio
from utils.multimedia_gen import test_multimedia
test_multimedia()
"
```

## Scaling & Optimization

### Performance Tuning
- **Concurrent execution**: Adjust Modal timeout settings
- **Media generation**: Optimize prompts for faster generation
- **API rate limits**: Implement backoff strategies
- **Content caching**: Cache research results

### Cost Management
- **Model selection**: Use appropriate models per task
- **Media generation**: Generate on-demand vs batch
- **API usage**: Monitor costs per platform
- **Resource allocation**: Right-size Modal functions

### Multi-Brand Support
```python
# Deploy multiple brand instances
brands = ["brand1", "brand2", "brand3"]
for brand in brands:
    app = modal.App(f"{brand}-social-pipeline")
    # Deploy brand-specific instance
```

---

**Clean deployment process for scalable, brand-driven social media automation.**