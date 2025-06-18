# Agno + Modal Deployment Guide

## Problem Solved

This guide provides a working solution for deploying Agno agents to Modal, resolving the integration issues between Agno workflows and Modal's serverless environment.

## Key Issues Resolved

1. **Workflow vs Agent Pattern**: Modal expects simple functions, not Agno workflows with async generators
2. **FastAPIApp Import Issues**: Agno API structure has changed in recent versions
3. **Async Generator Complexity**: Modal handles async generators poorly in FastAPI endpoints

## Solution Architecture

### Simplified Agent-Based Approach

Instead of using complex workflows, we use direct Agno agents with simple function wrappers:

```python
# Before (Problematic)
async for response in pipeline.run():
    results.append(response.model_dump())

# After (Working)
result = run_agent_chat(prompt)
return result
```

### Three Deployment Options

1. **`modal_simple.py`** - Recommended: Direct function approach
2. **`modal_app.py`** - Updated: Agent-based with FastAPI endpoints  
3. **`modal_agent_deploy.py`** - Alternative: FastAPI wrapper approach

## Setup Instructions

### 1. Configure Modal Secrets

Create these secrets in your Modal dashboard:

```bash
# Azure OpenAI
modal secret create azure-openai-secrets \
  AZURE_OPENAI_API_KEY=your_key \
  AZURE_OPENAI_BASE_URL=your_endpoint \
  AZURE_OPENAI_GPT45_DEPLOYMENT=your_deployment \
  AZURE_OPENAI_API_VERSION=2025-01-01-preview

# Serper API
modal secret create serper-api-key \
  SERPER_API_KEY=your_serper_key

# Composio (optional)
modal secret create composio-secrets \
  COMPOSIO_API_KEY=your_composio_key

# Slack (optional)
modal secret create slack-secrets \
  SLACK_BOT_TOKEN=your_slack_token \
  SLACK_APP_TOKEN=your_app_token
```

### 2. Test Locally

```bash
# Run deployment readiness tests
python test_deployment.py

# Test Modal functions locally
modal run modal_simple.py --topic "AI automation" --platforms "twitter,linkedin"
```

### 3. Deploy to Modal

```bash
# Deploy the simple version (recommended)
modal deploy modal_simple.py

# Or deploy the full version
modal deploy modal_app.py
```

## API Endpoints

### Simple Deployment (`modal_simple.py`)

- **POST `/content_api`** - Create social media content
- **POST `/chat`** - Chat with the agent
- **GET `/health`** - Health check

### Full Deployment (`modal_app.py`)

- **POST `/trigger`** - Manual content creation trigger
- **Function `run_content_creation`** - Direct function call
- **Function `scheduled`** - Scheduled content creation
- **ASGI `/slack/events`** - Slack integration

## Usage Examples

### 1. Direct Function Call

```python
import modal

# Call the deployed function
result = modal.Function.lookup("agno-social-simple", "create_social_content").remote(
    topic="caregiver burnout",
    platforms=["twitter", "linkedin"]
)
print(result)
```

### 2. HTTP API Call

```bash
# POST to the API endpoint
curl -X POST "https://your-modal-url/content_api" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "caregiver burnout",
    "platforms": ["twitter", "linkedin"]
  }'
```

### 3. Local Testing

```bash
# Test with specific topic
modal run modal_simple.py --topic "healthcare innovation"

# Research only mode
modal run modal_simple.py --topic "AI ethics" --research-only
```

## Key Files

### Core Files
- **`modal_simple.py`** - Simple, direct function approach (recommended)
- **`modal_app.py`** - Full featured deployment with scheduling
- **`social_agent.py`** - Agno agent implementation
- **`social_pipeline.py`** - Original workflow (for reference)

### Utilities
- **`test_deployment.py`** - Deployment readiness tests
- **`setup_modal_secrets.sh`** - Secret configuration script

## Best Practices

### 1. Function Design
- Keep functions simple and focused
- Avoid complex async generators
- Use direct agent calls instead of workflows

### 2. Error Handling
- Always wrap agent calls in try/catch
- Return structured error responses
- Include diagnostic information

### 3. Performance
- Initialize agents inside functions (not globally)
- Use appropriate timeouts
- Consider caching for repeated requests

## Troubleshooting

### Common Issues

1. **Import Errors**
   ```
   Solution: Run test_deployment.py to verify all imports
   ```

2. **Missing Secrets**
   ```
   Solution: Verify Modal secrets are configured correctly
   ```

3. **Agent Initialization Fails**
   ```
   Solution: Check Azure OpenAI credentials and endpoints
   ```

4. **Serper API Not Working**
   ```
   Solution: Verify SERPER_API_KEY is set and valid
   ```

### Debug Steps

1. **Test Locally First**
   ```bash
   python test_deployment.py
   ```

2. **Check Modal Logs**
   ```bash
   modal logs agno-social-simple
   ```

3. **Verify Function Status**
   ```bash
   modal app list
   modal function list agno-social-simple
   ```

## Deployment Verification

After deployment, verify everything works:

1. **Health Check**
   ```bash
   curl https://your-modal-url/health
   ```

2. **Test Content Creation**
   ```bash
   curl -X POST https://your-modal-url/content_api \
     -H "Content-Type: application/json" \
     -d '{"topic": "test", "platforms": ["twitter"]}'
   ```

3. **Check Logs**
   ```bash
   modal logs agno-social-simple --follow
   ```

## Performance Considerations

- **Cold Start**: First request may take 10-15 seconds
- **Warm Requests**: Subsequent requests are much faster
- **Concurrent Requests**: Set `allow_concurrent_inputs` appropriately
- **Timeouts**: Set realistic timeouts for agent processing

## Security Notes

- Never commit API keys to version control
- Use Modal secrets for all credentials
- Regularly rotate API keys
- Monitor usage and costs

## Next Steps

1. **Production Deployment**: Configure proper monitoring and alerting
2. **Scaling**: Adjust concurrent request limits based on usage
3. **Integration**: Connect to your application's webhook endpoints
4. **Monitoring**: Set up logging and metrics collection

## Support

For issues with this deployment:
1. Check the troubleshooting section
2. Run the test script: `python test_deployment.py`
3. Review Modal logs for errors
4. Verify all secrets are properly configured