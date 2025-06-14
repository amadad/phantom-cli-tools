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

# Check if user is authenticated
if ! modal token verify &> /dev/null; then
    echo "❌ Not authenticated with Modal. Please run 'modal token new' first."
    exit 1
fi

echo "✅ Modal CLI found and authenticated"

# Azure OpenAI Secrets
echo "📝 Creating Azure OpenAI secrets..."
modal secret create azure-openai-secrets \
    AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY}" \
    AZURE_OPENAI_BASE_URL="${AZURE_OPENAI_BASE_URL}" \
    AZURE_OPENAI_GPT45_DEPLOYMENT="${AZURE_OPENAI_GPT45_DEPLOYMENT}" \
    AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-2024-02-15-preview}"

# Serper API Key
echo "📝 Creating Serper API secret..."
modal secret create serper-api-key \
    SERPER_API_KEY="${SERPER_API_KEY}"

# Slack Secrets
echo "📝 Creating Slack secrets..."
modal secret create slack-secrets \
    SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}" \
    SLACK_APP_TOKEN="${SLACK_APP_TOKEN}" \
    SLACK_APPROVAL_CHANNEL="${SLACK_APPROVAL_CHANNEL:-#general}"

# Composio Secrets
echo "📝 Creating Composio secrets..."
modal secret create composio-secrets \
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