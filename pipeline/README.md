# Agent Social Pipeline Architecture

Clear pipeline-based organization for the agent-social content generation workflow.

## Pipeline Structure

```
pipeline/
├── discovery/          # Story & topic discovery
│   └── story_discovery.py
├── content/            # Platform-specific content generation
│   └── content_generation.py
├── media/              # Image & video generation
│   ├── image_generation.py
│   └── sora.py
├── approval/           # Human-in-the-loop workflows
│   ├── telegram_approval.py
│   └── slack_approval.py
└── evaluation/         # Content quality assessment
    └── evaluation.py
```

## Pipeline Flow

1. **Discovery** (`pipeline.discovery`)
   - Discover trending stories via SerpAPI
   - Extract topics from brand configuration
   - Generate fallback content topics

2. **Content** (`pipeline.content`) 
   - Generate platform-specific content using Azure OpenAI
   - Apply brand voice and formatting rules
   - Save content results with metadata

3. **Media** (`pipeline.media`)
   - Create visual prompts for content
   - Generate images via Replicate FLUX models
   - Generate videos via Azure OpenAI Sora (optional)

4. **Approval** (`pipeline.approval`)
   - Terminal-based approval (primary)
   - Telegram mobile approval workflow
   - Slack team approval workflow

5. **Evaluation** (`pipeline.evaluation`)
   - Verdict-based AI content evaluation
   - Brand alignment scoring
   - Platform optimization assessment

6. **Social** (`social/`)
   - Multi-platform posting via unified interface
   - Direct API integration (X, LinkedIn, Facebook, YouTube)
   - Platform-specific optimization

## Usage

```python
from pipeline.discovery import discover_stories_for_topic
from pipeline.content import generate_platform_content
from pipeline.media import generate_brand_image_with_mode
from pipeline.approval import TelegramApprovalWorkflow
from pipeline.evaluation import evaluate_content

# Clear pipeline flow
stories = await discover_stories_for_topic(topic, brand_config)
content = await generate_platform_content(topic, platforms, brand_config)
image_url = await generate_brand_image_with_mode(visual_prompt, brand_config)
approved = await approval_workflow.request_approval(content)
score = evaluate_content(content, brand_config)
```

## Benefits

- **Clear Separation**: Each pipeline stage has dedicated directory
- **Easy Testing**: Test individual pipeline components independently  
- **Maintainable**: Logic grouped by function, not implementation
- **Scalable**: Add new pipeline stages without affecting others
- **Understandable**: Pipeline flow matches business logic