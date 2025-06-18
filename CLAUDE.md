## Agent Social Implementation Guidelines

### Project Overview
**Agent Social** is an automated social media content pipeline that discovers news, creates brand-aligned content, and posts to multiple platforms with human approval workflow.

### Architecture Principles
- **Single-file Design**: All components in `social_pipeline.py` for simplicity
- **Brand-First**: YAML-based brand framework drives all content
- **Human-in-the-Loop**: Slack approval before posting
- **Platform Agnostic**: Easily extensible to new social platforms
- **Serverless**: Modal deployment for scheduled execution

### Technical Stack & Patterns
- **AI Framework**: Agno v2 + Azure OpenAI
- **Content Discovery**: Serper API for news/stories
- **Social Posting**: Composio for multi-platform support
- **Approval Flow**: Slack Socket Mode for interactive approvals
- **Deployment**: Modal serverless platform
- **Scheduling**: Every 6 hours via Modal cron

### Implementation Patterns

#### Content Generation Pipeline
```python
# 1. Story Discovery
stories = await discover_stories()  # Serper API

# 2. Content Creation
content = await generate_content(story, brand_framework)  # Agno agents

# 3. Approval Request
approved = await request_approval(content)  # Slack workflow

# 4. Multi-platform Posting
if approved:
    await post_to_platforms(content)  # Composio
```

#### Agent Configuration
```python
# Fast, focused agents for each task
story_agent = Agent(
    name="story_discoverer",
    model="o4-mini",  # Fast model
    instructions=["Find relevant caregiving stories"],
    response_model=StoryList
)

content_agent = Agent(
    name="content_creator", 
    model="o4",  # Quality model
    instructions=brand_framework.to_instructions(),
    response_model=SocialContent
)
```

#### Brand Framework Integration
```yaml
# brands/givecare.yaml
name: "GiveCare"
voice:
  tone: "empathetic, supportive, hopeful"
  style: "conversational, inclusive"
topics:
  - family caregiving
  - dementia support
  - self-care
```

### Key File Structure
```
social_pipeline.py      # Main pipeline implementation
modal_app.py           # Modal deployment config
brands/
└── givecare.yaml     # Brand voice configuration
output/               # Generated content archive
requirements.txt      # Dependencies
.github/
└── workflows/
    └── ci-cd.yml    # GitHub Actions CI/CD
```

### Critical Technical Patterns
- **Async Everything**: All API calls use async/await
- **Error Recovery**: Graceful degradation if APIs fail
- **Content Archival**: All generated content saved to output/
- **Approval Timeout**: 30-minute window for human review
- **Platform Adaptation**: Content tailored per platform limits

### Development Workflow
1. **Test locally** with `python social_pipeline.py`
2. **Review output** in `output/` directory
3. **Deploy to Modal** with `modal deploy modal_app.py`
4. **Monitor logs** with `modal logs -f`

### Common Commands
```bash
# Local Development
python social_pipeline.py                    # Run full pipeline
python -m pytest tests/ -v                   # Run tests

# Modal Deployment
modal deploy modal_app.py                    # Deploy to production
modal run modal_app.py::test_endpoint        # Test deployment
modal logs -f                                # Stream logs
modal run modal_app.py::scheduled_social_pipeline  # Manual run

# Environment Setup
pip install -r requirements.txt              # Install dependencies
cp .env.example .env                        # Setup environment
```

### Environment Variables
```bash
# Required API Keys
AZURE_OPENAI_API_KEY      # Azure OpenAI access
AZURE_OPENAI_ENDPOINT     # Azure endpoint
COMPOSIO_API_KEY          # Social posting
SERPER_API_KEY            # Story discovery
SLACK_BOT_TOKEN           # Slack bot
SLACK_APP_TOKEN           # Slack Socket Mode
AGNO_API_KEY              # Agno framework

# Configuration
SLACK_CHANNEL_ID          # Approval channel
APPROVAL_TIMEOUT_MINUTES  # Default: 30
```

### Best Practices
- **Brand Consistency**: All content must align with brand YAML
- **Quality Control**: Human approval required before posting
- **Rate Limiting**: Respect platform API limits
- **Error Handling**: Log failures but continue pipeline
- **Content Archive**: Keep all generated content for analysis

### Future Enhancements
- **Instagram Support**: Add visual content generation
- **Analytics Integration**: Track engagement metrics
- **A/B Testing**: Test different content styles
- **Multi-brand Support**: Extend beyond GiveCare
- **Auto-approval Rules**: For certain content types

## Current Focus
**Stable Production Pipeline** - Focus on reliability, content quality, and brand consistency. The pipeline successfully generates and posts content every 6 hours with human oversight.