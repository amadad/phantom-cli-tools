#!/bin/bash

# Setup Modal secrets from your .env file
# Run this after: modal token new

echo "Setting up Modal secrets..."

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Azure OpenAI secrets
modal secret create azure-openai \
  AZURE_OPENAI_DEFAULT_MODEL="${AZURE_OPENAI_DEFAULT_MODEL}" \
  AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION}" \
  AZURE_OPENAI_BASE_URL="${AZURE_OPENAI_BASE_URL}" \
  AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY}" \
  AZURE_OPENAI_GPT45_ENDPOINT="${AZURE_OPENAI_GPT45_ENDPOINT}" \
  AZURE_OPENAI_GPT45_DEPLOYMENT="${AZURE_OPENAI_GPT45_DEPLOYMENT}" \
  AZURE_OPENAI_O4_MINI_ENDPOINT="${AZURE_OPENAI_O4_MINI_ENDPOINT}" \
  AZURE_OPENAI_O4_MINI_DEPLOYMENT="${AZURE_OPENAI_O4_MINI_DEPLOYMENT}" \
  AZURE_OPENAI_SORA_ENDPOINT="${AZURE_OPENAI_SORA_ENDPOINT}" \
  AZURE_OPENAI_SORA_DEPLOYMENT="${AZURE_OPENAI_SORA_DEPLOYMENT}"

# Composio secrets  
modal secret create composio \
  COMPOSIO_API_KEY="${COMPOSIO_API_KEY}" \
  TWITTER_CONNECTION_ID="${TWITTER_CONNECTION_ID}" \
  TWITTER_MEDIA_CONNECTION_ID="${TWITTER_MEDIA_CONNECTION_ID}" \
  LINKEDIN_CONNECTION_ID="${LINKEDIN_CONNECTION_ID}"

# Slack secrets
modal secret create slack \
  SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}" \
  SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET}"

# Search API secrets
modal secret create search-apis \
  SERP_API_KEY="${SERP_API_KEY}" \
  EXA_API_KEY="${EXA_API_KEY}" \
  TAVILY_API_KEY="${TAVILY_API_KEY}" \
  FIRECRAWL_API_KEY="${FIRECRAWL_API_KEY}"

# Replicate secret
modal secret create replicate \
  REPLICATE_API_TOKEN="${REPLICATE_API_TOKEN}"

echo "✅ Modal secrets created!"
echo ""
echo "Next steps:"
echo "1. Deploy: modal deploy modal_app.py"
echo "2. Get webhook URL from Modal dashboard"
echo "3. Add webhook URL to Slack app settings"