#!/bin/bash
# Agent Social - Quick Setup Script

set -e

echo "🚀 Agent Social - Agno-Native Setup"
echo "=================================="

# Check if Modal CLI is installed
if ! command -v modal &> /dev/null; then
    echo "❌ Modal CLI not found. Installing..."
    pip install modal
fi

# Check if authenticated
if ! modal secret list &> /dev/null; then
    echo "🔑 Please authenticate with Modal first:"
    echo "modal token new"
    exit 1
fi

echo "✅ Modal CLI ready"

# Setup Modal secrets from .env
if [ -f .env ]; then
    echo "🔐 Setting up Modal secrets from .env..."
    source .env
    
    # Azure OpenAI
    modal secret create azure-openai-secrets --force \
        AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY}" \
        AZURE_OPENAI_BASE_URL="${AZURE_OPENAI_BASE_URL}" \
        AZURE_OPENAI_GPT45_DEPLOYMENT="${AZURE_OPENAI_GPT45_DEPLOYMENT}" \
        AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-2024-02-15-preview}"
    
    # Serper API
    modal secret create serper-api-key --force \
        SERPER_API_KEY="${SERPER_API_KEY}"
    
    # Slack (optional)
    if [ ! -z "$SLACK_BOT_TOKEN" ]; then
        modal secret create slack-secrets --force \
            SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}" \
            SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}" \
            SLACK_VERIFICATION_TOKEN="${SLACK_VERIFICATION_TOKEN:-}" \
            SLACK_APPROVAL_CHANNEL="${SLACK_APPROVAL_CHANNEL:-#general}"
    fi
    
    # Composio (optional)
    if [ ! -z "$COMPOSIO_API_KEY" ]; then
        modal secret create composio-secrets --force \
            COMPOSIO_API_KEY="${COMPOSIO_API_KEY}" \
            TWITTER_CONNECTION_ID="${TWITTER_CONNECTION_ID:-}" \
            TWITTER_MEDIA_CONNECTION_ID="${TWITTER_MEDIA_CONNECTION_ID:-}" \
            LINKEDIN_CONNECTION_ID="${LINKEDIN_CONNECTION_ID:-}" \
            INSTAGRAM_CONNECTION_ID="${INSTAGRAM_CONNECTION_ID:-}" \
            FACEBOOK_CONNECTION_ID="${FACEBOOK_CONNECTION_ID:-}" \
            YOUTUBE_CONNECTION_ID="${YOUTUBE_CONNECTION_ID:-}"
    fi
    
    echo "✅ Modal secrets configured"
else
    echo "⚠️ No .env file found. Please create one with your API keys."
    echo "See .env.example for reference."
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo "  1. modal deploy modal_agno_deploy.py"
echo "  2. modal run modal_agno_deploy.py::create_content --topic 'AI trends'"
echo "  3. python demo_agno_native.py"