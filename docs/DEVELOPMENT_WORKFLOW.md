# Agent Social - Development Workflow

## Getting Started

### Prerequisites
- Python 3.11+
- Modal account (for deployment)
- Slack workspace (for approvals)
- API keys for Azure OpenAI, Composio, Serper, Agno

### Initial Setup
```bash
# Clone repository
git clone https://github.com/your-org/agent-social.git
cd agent-social

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env with your API keys
```

### Environment Configuration
```bash
# Required environment variables
AZURE_OPENAI_API_KEY=xxx
AZURE_OPENAI_ENDPOINT=https://xxx.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-10-01-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini

COMPOSIO_API_KEY=xxx
AGNO_API_KEY=xxx
SERPER_API_KEY=xxx

SLACK_BOT_TOKEN=xoxb-xxx
SLACK_APP_TOKEN=xapp-xxx
SLACK_CHANNEL_ID=C123456

# Optional
APPROVAL_TIMEOUT_MINUTES=30
```

## Development Workflow

### 1. Local Development

#### Running the Pipeline
```bash
# Full pipeline run
python social_pipeline.py

# Test mode (no actual posting)
python social_pipeline.py --test-mode

# Specific components
python -c "from social_pipeline import test_agents; test_agents()"
```

#### Testing Individual Components
```python
# Test story discovery
from social_pipeline import discover_stories
stories = await discover_stories()
print(stories)

# Test content generation
from social_pipeline import generate_content
content = await generate_content(story, brand_framework)
print(content)

# Test Slack approval
from social_pipeline import test_slack_approval
await test_slack_approval()
```

### 2. Brand Configuration

#### Working with Brand YAML
```yaml
# brands/givecare.yaml
name: "GiveCare"
tagline: "Your AI companion in the caregiving journey"

voice:
  tone: "empathetic, supportive, encouraging, hopeful"
  style: "conversational, warm, inclusive"
  
topics:
  - family caregiving
  - dementia care
  - self-care for caregivers
  - eldercare
  - caregiving resources
  
guidelines:
  - Always acknowledge the challenges of caregiving
  - Provide practical, actionable advice
  - Share stories of hope and resilience
```

#### Adding a New Brand
1. Create `brands/newbrand.yaml`
2. Define voice, topics, and guidelines
3. Update pipeline to load the new brand
4. Test content generation with new brand

### 3. Agent Development

#### Creating New Agents
```python
# Pattern for new agents
new_agent = Agent(
    name="descriptive_name",
    role="Clear role description",
    instructions=[
        "Specific instruction 1",
        "Specific instruction 2"
    ],
    model="o4-mini",  # or "o4" for quality
    response_model=OutputModel,  # Pydantic model
    tools=[],  # Only if needed
)
```

#### Agent Best Practices
- Use `o4-mini` for fast iterations (discovery)
- Use `o4` for quality output (content)
- Always use Pydantic models for structured output
- Keep instructions focused and specific
- Test with various inputs

### 4. Approval Workflow

#### Setting Up Slack Bot
1. Create Slack app at api.slack.com
2. Enable Socket Mode
3. Add bot to your workspace
4. Install bot to approval channel
5. Copy tokens to `.env`

#### Testing Approval Flow
```python
# Send test approval request
from social_pipeline import send_approval_request
result = await send_approval_request({
    "content": "Test post content",
    "platforms": ["twitter", "linkedin"]
})
```

### 5. Platform Integration

#### Adding New Platforms
```python
# 1. Check Composio support
composio apps list

# 2. Add platform to PLATFORMS list
PLATFORMS = ["twitter", "linkedin", "facebook", "instagram"]

# 3. Update content generation for platform
if platform == "instagram":
    # Add image generation logic
    content.visual_prompt = "..."

# 4. Test posting
await post_to_platform("instagram", content)
```

## Deployment Workflow

### 1. Modal Setup

#### First Time Setup
```bash
# Install Modal CLI
pip install modal

# Authenticate
modal setup

# Create secrets
modal secret create agent-social-secrets \
  AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY \
  COMPOSIO_API_KEY=$COMPOSIO_API_KEY \
  SERPER_API_KEY=$SERPER_API_KEY \
  SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN \
  AGNO_API_KEY=$AGNO_API_KEY
```

#### Deployment
```bash
# Deploy to Modal
modal deploy modal_app.py

# View deployment
modal app list

# Check logs
modal logs -f
```

### 2. Testing in Production

#### Manual Trigger
```bash
# Via Modal CLI
modal run modal_app.py::social_pipeline

# Via web endpoint
curl -X POST https://your-modal-app.modal.run/trigger
```

#### Monitoring
```bash
# Stream logs
modal logs -f

# Check scheduled runs
modal app describe agent-social
```

### 3. CI/CD Pipeline

#### GitHub Actions Workflow
The CI/CD pipeline automatically:
1. Runs on push to main
2. Validates environment
3. Installs dependencies
4. Deploys to Modal

#### Manual Deployment
```bash
# Trigger GitHub Action
gh workflow run ci-cd.yml
```

## Debugging Workflow

### Common Issues

#### 1. API Rate Limits
```python
# Add retry logic
async def with_retry(func, max_attempts=3):
    for attempt in range(max_attempts):
        try:
            return await func()
        except RateLimitError:
            wait = (2 ** attempt) + random.random()
            await asyncio.sleep(wait)
```

#### 2. Slack Connection Issues
```bash
# Check Slack tokens
python -c "from social_pipeline import test_slack_connection; test_slack_connection()"

# Verify bot permissions
# - chat:write
# - channels:read
# - reactions:write
```

#### 3. Modal Import Errors
```python
# Ensure all imports are absolute
from social_pipeline import function  # Good
from .utils import helper  # Bad for Modal
```

### Logging Best Practices
```python
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Use throughout code
logger.info(f"Discovered {len(stories)} stories")
logger.error(f"Failed to post to {platform}: {e}")
```

## Testing Workflow

### Unit Testing
```python
# tests/test_content_generation.py
import pytest
from social_pipeline import generate_content

@pytest.mark.asyncio
async def test_content_generation():
    story = {"title": "Test", "snippet": "Test content"}
    content = await generate_content(story)
    assert content.platform_content["twitter"]
    assert len(content.platform_content["twitter"]) <= 280
```

### Integration Testing
```bash
# Test full pipeline without posting
python social_pipeline.py --test-mode --no-post

# Test with specific story
python social_pipeline.py --story-url "https://example.com/story"
```

### Load Testing
```python
# Test concurrent content generation
import asyncio

async def load_test():
    tasks = []
    for i in range(10):
        task = generate_content(test_story)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks)
    print(f"Generated {len(results)} pieces of content")
```

## Code Review Checklist

### Before Submitting PR
- [ ] Code runs locally without errors
- [ ] No API keys in code
- [ ] Brand voice maintained
- [ ] Error handling added
- [ ] Logging added for debugging
- [ ] Documentation updated
- [ ] Tests pass (if applicable)

### Review Focus Areas
1. **Brand Consistency**: Does content match voice?
2. **Error Handling**: Graceful failures?
3. **Performance**: Any blocking calls?
4. **Security**: API keys protected?
5. **Deployment**: Modal-compatible?

## Performance Optimization

### Async Best Practices
```python
# Good - Concurrent API calls
results = await asyncio.gather(
    discover_stories(),
    load_brand_framework(),
    check_rate_limits()
)

# Bad - Sequential calls
stories = await discover_stories()
brand = await load_brand_framework()
limits = await check_rate_limits()
```

### Caching Strategy
```python
# Cache expensive operations
@lru_cache(maxsize=100)
def parse_brand_yaml(brand_name):
    return load_yaml(f"brands/{brand_name}.yaml")

# Cache API responses
STORY_CACHE = {}
CACHE_DURATION = 3600  # 1 hour
```

## Release Process

### Version Management
```bash
# Tag releases
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

### Deployment Steps
1. Merge PR to main
2. CI/CD deploys automatically
3. Monitor Modal logs
4. Verify scheduled runs
5. Check Slack approvals

### Rollback Process
```bash
# Via Modal
modal deploy modal_app.py --tag previous-version

# Via Git
git revert <commit>
git push origin main
```

---

*Workflow optimized for rapid iteration and reliable production deployment.*