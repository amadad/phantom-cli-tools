#!/bin/bash

# Setup Modal Secrets for Agent Social Pipeline
# This script creates all necessary secrets in Modal for the CI/CD deployment

set -e

echo "🔐 Setting up Modal secrets for Agent Social Pipeline..."

# Check if Modal CLI is installed
if ! command -v modal &> /dev/null; then
    echo "❌ Modal CLI not found. Please install it first:"
    echo "pip install modal"
    exit 1
fi

# Check if user is authenticated by trying to list secrets
if ! modal secret list &> /dev/null; then
    echo "❌ Not authenticated with Modal. Please run 'modal token new' first."
    exit 1
fi

echo "✅ Modal CLI found and authenticated"

# Azure OpenAI Secrets
echo "📝 Setting up Azure OpenAI secrets..."
modal secret create azure-openai-secrets --force \
    AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY}" \
    AZURE_OPENAI_BASE_URL="${AZURE_OPENAI_BASE_URL}" \
    AZURE_OPENAI_GPT45_DEPLOYMENT="${AZURE_OPENAI_GPT45_DEPLOYMENT}" \
    AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION}"

# Serper API Key
echo "📝 Setting up Serper API secret..."
modal secret create serper-api-key --force \
    SERPER_API_KEY="${SERPER_API_KEY}"

# Slack Secrets
echo "📝 Setting up Slack secrets..."
modal secret create slack-secrets --force \
    SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}" \
    SLACK_APP_TOKEN="${SLACK_APP_TOKEN:-}" \
    SLACK_APPROVAL_CHANNEL="${SLACK_APPROVAL_CHANNEL:-#general}" \
    SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}" \
    SLACK_VERIFICATION_TOKEN="${SLACK_VERIFICATION_TOKEN:-}"

# Composio Secrets
echo "📝 Setting up Composio secrets..."
modal secret create composio-secrets --force \
    COMPOSIO_API_KEY="${COMPOSIO_API_KEY}"

echo "🎉 All Modal secrets created successfully!"
echo ""
echo "📋 Created secrets:"
echo "  - azure-openai-secrets"
echo "  - serper-api-key" 
echo "  - slack-secrets"
echo "  - composio-secrets"
echo ""
echo "🚀 You can now deploy with: modal deploy modal_app.py"
echo "🧪 Or test locally with: modal run modal_app.py" 