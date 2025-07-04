## Agent Social Implementation Guidelines

### Important: Documentation Standards
- **DO NOT create README files** in any directory
- **Use CLAUDE.md files** for agent-specific instructions
- **Keep CLAUDE.md files minimal** - only essential context for AI agents
- **README.md** is only for the root directory (user-facing documentation)

### Project Overview
**Agent Social** is an automated social media content pipeline that discovers news, creates brand-aligned content, and posts to multiple platforms with human approval workflow.

### Architecture Principles
- **Simplified Design**: Consolidated from 17 to 7 Python files for maintainability
- **Agno 1.7.1 Patterns**: Structured outputs, proper `.arun()` API usage
- **Brand-First**: YAML-based brand framework drives all content
- **Human-in-the-Loop**: Terminal, Telegram, and Slack approval workflows
- **SerpAPI Integration**: Real news story discovery (SerpAPI.com, not Serper.dev)
- **Azure OpenAI**: GPT-4.5 with proper model configuration

### Technical Stack & Patterns
- **AI Framework**: Agno 1.7.1 with structured outputs via Pydantic
- **LLM Models**: Azure OpenAI GPT-4.5 (configurable deployment)
- **Content Discovery**: SerpAPI.com for news discovery (working)
- **Social Posting**: Dry-run mode (Composio integration future)
- **Approval Flow**: Terminal (primary), Telegram/Slack (optional)
- **Deployment**: Docker + UV package manager
- **Media Generation**: Replicate FLUX models for images

### Current Working Pipeline
```python
# 1. Story Discovery (SerpAPI)
stories = await discover_stories()  # SerpAPI.com integration

# 2. Content Creation (Azure OpenAI)
content = await generate_content(story, brand_framework)  # Agno agents with structured outputs

# 3. Media Generation (Replicate + Sora)
image = await generate_image(visual_prompt)  # FLUX models
video = await generate_video(video_prompt)   # Sora models (optional)

# 4. Approval Request (Human-in-the-loop)
approved = await request_approval(content)  # Terminal/Telegram/Slack

# 5. Social Posting (Future)
if approved:
    await post_to_platforms(content)  # Currently dry-run mode
```

### Critical Agent Configuration (Agno 1.7.1)
```python
# ✅ CORRECT: Working patterns
from agno.agent import Agent
from agno.models.azure import AzureOpenAI
from pydantic import BaseModel, Field

# Structured response model
class ContentGenerationResult(BaseModel):
    topic: str = Field(description="Content topic")
    twitter_content: str = Field(description="Twitter content")
    linkedin_content: str = Field(description="LinkedIn content")
    visual_prompt: str = Field(description="Image generation prompt")
    brand_alignment_score: float = Field(default=0.9)

# Proper Azure OpenAI model configuration
model = AzureOpenAI(
    azure_deployment=os.getenv("AZURE_OPENAI_DEFAULT_MODEL", "gpt-4.5-preview"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
)

# Create agent with structured outputs
content_agent = Agent(
    name="content_creator",
    model=model,
    instructions=brand_instructions,
    response_model=ContentGenerationResult
)

# ✅ CORRECT: Use .arun() method (not .generate())
response = await agent.arun(prompt)
result = response.content if hasattr(response, 'content') else response
```

### Brand Framework Integration
```yaml
# brands/givecare.yml - Current working format
name: "GiveCare"
voice:
  tone: "empathetic, supportive, hopeful"
  style: "conversational, inclusive, authentic"

topics:
  - "family caregiving"
  - "dementia support"
  - "caregiver self-care"
  - "support networks"

research_keywords:
  - "caregiving support"
  - "family caregiver resources"
  - "dementia care"

visual_style:
  primary: "soft, warm, documentary-style photography"
  color_palette: "#FF9F1C, #54340E, #FFE8D6"
```

### Key File Structure (Simplified)
```
main.py                     # CLI entry point & pipeline orchestration
utils/
├── content_generation.py   # Azure OpenAI content + posting (consolidated)
├── story_discovery.py      # SerpAPI news discovery (working)
├── image_generation.py     # Replicate FLUX + visual modes (consolidated)
├── sora.py                 # Azure OpenAI Sora video generation
├── evaluation.py           # Content quality scoring
├── telegram_approval.py    # Mobile approval workflow
└── slack_approval.py       # Team approval workflow
brands/
└── givecare.yml            # Brand voice configuration
output/content/             # Generated content archive (JSON)
pyproject.toml              # UV dependencies (Agno 1.7.1+)
```

### Critical Technical Patterns

#### ✅ Agno 1.7.1 Working Patterns
- **Structured Outputs**: All agents use Pydantic response models
- **Correct API**: Use `.arun()` method (not `.generate()`)
- **Proper Models**: Use `AzureOpenAI` from `agno.models.azure`
- **Model Config**: Use `azure_deployment` parameter (not `model`)

#### ✅ SerpAPI Integration (Fixed)
- **Correct Service**: Use SerpAPI.com (not Serper.dev)
- **API Key**: `SERP_API_KEY` environment variable
- **Direct HTTP**: Custom async implementation for reliability
- **Fallback**: Generates contextual content if search fails

#### ✅ Architecture Patterns
- **Async Everything**: All API calls use async/await
- **Error Recovery**: Graceful degradation with fallback content
- **Content Archival**: JSON files with metadata in output/content/
- **Approval Workflow**: Terminal prompts with Telegram/Slack backup
- **Platform Adaptation**: Twitter (280 chars) vs LinkedIn (longer form)
- **Visual Modes**: 3 modes (framed_portrait, lifestyle_scene, illustrative_concept)

### Development Workflow
1. **Test locally** with `uv run main.py --no-stories --no-image`
2. **Review output** in `output/content/` directory
3. **Check logs** for API call success/failure
4. **Use flags** to isolate issues (--no-stories, --no-image)

### Essential Commands
```bash
# Local Development
uv sync                                      # Install dependencies
uv run main.py                              # Run full pipeline
uv run main.py --no-stories                 # Skip story discovery
uv run main.py --no-image                   # Skip image generation
uv run main.py --topic "custom topic"       # Custom topic
uv run main.py --platforms "twitter"        # Single platform

# Testing Components
python -c "from utils.story_discovery import discover_stories_for_topic; import asyncio; asyncio.run(discover_stories_for_topic('test', {}))"
```

### Environment Variables (Required)
```bash
# ✅ Azure OpenAI (Working)
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEFAULT_MODEL=gpt-4.5-preview
AZURE_OPENAI_API_VERSION=2025-01-01-preview

# ✅ SerpAPI (Working) - NOTE: SerpAPI.com not Serper.dev
SERP_API_KEY=your_serpapi_key

# ✅ Replicate (Working)
REPLICATE_API_TOKEN=your_replicate_token

# Optional Approval Workflows
TELEGRAM_BOT_TOKEN=your_telegram_bot
SLACK_BOT_TOKEN=your_slack_bot
SLACK_CHANNEL_ID=your_channel_id
```

### Best Practices
- **Brand Consistency**: All content must align with brand YAML
- **Quality Control**: Human approval required before posting
- **API Error Handling**: Log failures but continue pipeline
- **Content Archive**: Keep all generated content for analysis
- **Structured Data**: Use Pydantic models for all agent responses
- **Simplified Architecture**: Avoid over-engineering, focus on working features

### Common Issues & Solutions

#### SerpAPI 403 Error
- **Problem**: Wrong service (Serper.dev vs SerpAPI.com)
- **Solution**: Use `SERP_API_KEY` with SerpAPI.com endpoint

#### Azure OpenAI Model Error
- **Problem**: Wrong model parameter name
- **Solution**: Use `azure_deployment` not `model` in AzureOpenAI()

#### Agno API Error
- **Problem**: Using deprecated `.generate()` method
- **Solution**: Use `.arun()` method for all agent calls

### Current Status (January 2025)
✅ **Working**: Story discovery, content generation, image generation, approval workflows
✅ **Simplified**: 60% fewer files, consolidated functionality
✅ **Quality**: 0.79/1.0 Twitter, 0.71/1.0 LinkedIn content scores
⚠️ **Future**: Composio social posting (currently dry-run mode)

### Next Priorities
1. Composio integration for actual social posting
2. Docker deployment optimization
3. Multi-brand configuration support
4. Performance analytics dashboard

## Claude Code Integration

### Available Scripts
The project uses standard CLI commands via `uv run main.py` with various flags. No custom Claude Code commands currently configured.

### Development Tips
- Always test with `--no-stories --no-image` first to isolate issues
- Check `output/content/` for generated content JSON files
- Use single quotes in Python one-liners to avoid shell escaping
- Monitor logs for API call success/failure patterns