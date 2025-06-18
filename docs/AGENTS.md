# Agent Social Contributor Guide

## 🚀 Dev Environment Setup

### **Python Environment**
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Set up pre-commit hooks (optional)
pre-commit install
```

### **Environment Variables**
```bash
# Copy example environment file and configure your values
cp .env.example .env
# Edit .env with your actual API keys

# Required variables:
# - AZURE_OPENAI_API_KEY: Azure OpenAI API key
# - AZURE_OPENAI_ENDPOINT: Azure OpenAI endpoint
# - AZURE_OPENAI_API_VERSION: API version (e.g., "2024-10-01-preview")
# - AZURE_OPENAI_DEPLOYMENT_NAME: Model deployment name
# - COMPOSIO_API_KEY: For social media posting
# - AGNO_API_KEY: Agno framework API key
# - SERPER_API_KEY: For news/story discovery
# - SLACK_BOT_TOKEN: For approval workflow
# - SLACK_APP_TOKEN: For Slack Socket Mode
# - SLACK_CHANNEL_ID: Channel for content approvals
```

### **Local Development**
```bash
# Run the pipeline locally
python social_pipeline.py

# Test specific components
python -c "from social_pipeline import test_agents; test_agents()"

# Check brand configuration
python -c "from social_pipeline import brand_framework; print(brand_framework.guidelines)"
```

---

## 🧪 Testing Instructions

### **Test Structure**
```
tests/                      # Test directory (to be created)
├── test_content_gen.py    # Content generation tests
├── test_approval.py       # Slack approval workflow tests
├── test_posting.py        # Social media posting tests
└── test_brand.py          # Brand consistency tests
```

### **Running Tests**
```bash
# Install test dependencies
pip install pytest pytest-asyncio pytest-mock

# Run all tests
pytest -v

# Test specific component
pytest tests/test_content_gen.py -v

# Test with coverage
pytest --cov=social_pipeline --cov-report=html

# Integration test (requires API keys)
python social_pipeline.py --test-mode
```

### **Manual Testing**
```bash
# Test story discovery only
python -c "from social_pipeline import discover_stories; discover_stories(test_mode=True)"

# Test content generation without posting
python -c "from social_pipeline import generate_content; generate_content(test_mode=True)"

# Test Slack approval flow
python -c "from social_pipeline import test_slack_approval; test_slack_approval()"
```

---

## 🔄 Git Workflow & PR Instructions

### **Branch Naming**
```bash
# Feature branches
git checkout -b feature/add-instagram-support
git checkout -b feature/improve-brand-voice

# Bug fixes
git checkout -b fix/slack-timeout-handling
git checkout -b fix/api-rate-limiting

# Improvements
git checkout -b improve/content-quality
git checkout -b refactor/agent-structure
```

### **Commit Message Format**
```bash
# Format: type(scope): description
feat(agents): add Instagram content generation
fix(slack): resolve approval timeout issues
docs(readme): update deployment instructions
test(content): add brand voice consistency tests
refactor(pipeline): simplify approval workflow

# Include context in commit body
git commit -m "feat(agents): add humor to content generation

- Implement personality traits for agents
- Add humor detection and generation
- Include tone variation based on platform
- Test with sample content

Resolves #123"
```

### **Pull Request Guidelines**

#### **PR Template**
```markdown
## Summary
Brief description of changes and why they're needed.

## Changes
- [ ] New feature implementation
- [ ] Bug fixes
- [ ] Documentation updates
- [ ] Test additions/updates

## Testing
- [ ] Tested locally with real API calls
- [ ] Tested in Modal dev environment
- [ ] Content quality verified
- [ ] Brand consistency checked

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No API keys in code
- [ ] Modal deployment tested
```

---

## 🛠️ Development Patterns

### **Project Structure**
```
social_pipeline.py          # Main pipeline (all components)
brands/                     # Brand configuration directory
└── givecare.yaml          # GiveCare brand framework
output/                    # Generated content output
requirements.txt           # Production dependencies
modal_app.py              # Modal deployment configuration
.github/
└── workflows/
    └── ci-cd.yml         # GitHub Actions CI/CD
```

### **Code Style Standards**
```python
# Use type hints for all functions
async def generate_content(
    story: dict, 
    platform: str = "twitter"
) -> ContentResult:
    """Generate platform-specific content from story."""
    pass

# Pydantic models for data validation
class ContentResult(BaseModel):
    platform: str
    content: str
    visuals: Optional[List[str]] = None
    
# Async by default for API operations
async def post_to_platform(
    content: ContentResult,
    platform_client: Any
) -> PostResult:
    """Post content to specified platform."""
    pass
```

### **Agent Development Pattern**
```python
# Agent structure for content generation
agent = Agent(
    name="content_creator",
    role="Social media content creator",
    instructions=[
        "Create engaging social content",
        "Follow brand voice guidelines",
        "Adapt tone for platform"
    ],
    response_model=ContentOutput,
    model="o4-mini",  # Fast model for content
    tools=[necessary_tools_only]
)
```

---

## 🔍 Code Review Process

### **Review Checklist**
- [ ] **Functionality**: Pipeline works end-to-end
- [ ] **Content Quality**: Generated content meets standards
- [ ] **Brand Consistency**: Follows brand guidelines
- [ ] **API Usage**: Efficient API calls, proper error handling
- [ ] **Security**: No exposed API keys or secrets
- [ ] **Performance**: Reasonable execution time
- [ ] **Documentation**: Code comments updated

### **Testing Before Review**
1. Run the pipeline locally with test mode
2. Verify content quality and brand alignment
3. Test approval workflow in Slack
4. Check Modal deployment compatibility
5. Ensure no breaking changes to scheduled runs

---

## 📚 Modal Deployment

### **Deployment Commands**
```bash
# Deploy to Modal
modal deploy modal_app.py

# Test deployment
modal run modal_app.py::test_endpoint

# Check logs
modal logs -f

# Run scheduled job manually
modal run modal_app.py::scheduled_social_pipeline
```

### **Environment Configuration**
```bash
# Set Modal secrets
modal secret create agent-social-secrets \
  AZURE_OPENAI_API_KEY=<key> \
  COMPOSIO_API_KEY=<key> \
  SERPER_API_KEY=<key> \
  SLACK_BOT_TOKEN=<token> \
  AGNO_API_KEY=<key>
```

---

## 🚨 Troubleshooting

### **Common Issues**

#### **"Composio tool not found"**
```bash
# Problem: Composio tools not properly initialized
# Solution: Ensure COMPOSIO_API_KEY is set and valid
composio login  # If using CLI
composio apps list  # Verify access
```

#### **Slack approval timeout**
```bash
# Problem: Content approval timing out
# Solution: Check Slack Socket Mode connection
# Verify SLACK_APP_TOKEN and SLACK_BOT_TOKEN are valid
# Ensure bot is in the approval channel
```

#### **Modal deployment fails**
```bash
# Problem: Import errors in Modal
# Solution: Ensure all dependencies in requirements.txt
# Check that no local file imports are used
# Verify secret names match exactly
```

#### **Content generation quality issues**
```python
# Problem: Generated content doesn't match brand voice
# Solution: Review brand framework YAML
# Adjust agent instructions
# Test with different prompts
```

#### **API rate limiting**
```python
# Problem: Hitting API rate limits
# Solution: Implement exponential backoff
# Reduce frequency of scheduled runs
# Cache story discovery results
```

---

## 🤝 Getting Help

### **Documentation Resources**
- **social_pipeline.py** - Main pipeline code with inline docs
- **brands/givecare.yaml** - Brand voice configuration
- **modal_app.py** - Deployment configuration
- **.github/workflows/ci-cd.yml** - CI/CD pipeline

### **Key Areas to Understand**
1. **Brand Framework**: How brand voice is maintained
2. **Approval Workflow**: Slack integration for content review
3. **Multi-platform Support**: Adapting content per platform
4. **Modal Deployment**: Serverless execution model

---

## 📋 Definition of Done

### **Feature Completion**
- [ ] **Implementation**: Feature works in pipeline
- [ ] **Testing**: Manual test of full pipeline
- [ ] **Brand Compliance**: Content matches voice
- [ ] **Approval Flow**: Slack workflow functions
- [ ] **Deployment**: Works on Modal platform
- [ ] **Documentation**: Updated as needed
- [ ] **Monitoring**: Logs show successful runs
- [ ] **Performance**: Completes in reasonable time

---

*Building an AI-powered social media presence that authentically represents the GiveCare brand and engages with the caregiving community.*