# Agent Social - Automated Social Media Pipeline

AI-powered social media content generation with brand-aligned multimedia and human approval workflow.

## 🎯 Architecture

```
Brand YAML → Research → Content Unit Generation → Parallel Media Creation → Approval → Multi-Platform Publishing
```

## 📁 Project Structure

```
agent-social/
├── social_pipeline.py          # Main pipeline with Agno integration
├── modal_app.py                # Modal serverless deployment
├── utils/
│   ├── content_unit.py         # Content unit abstraction
│   ├── media_gen_parallel.py   # Parallel multimedia generation
│   └── slack_approval.py       # Interactive approval workflow
├── brand/
│   └── givecare.yml            # Brand configuration (v2)
├── tests/
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── e2e/                    # End-to-end tests
└── output/                     # Generated content archive
```

## 🚀 Features

- **Content Units**: Unified content generation with synchronized text and media
- **Parallel Processing**: Concurrent media generation and platform adaptation
- **Brand-First Design**: YAML configuration drives all content decisions
- **Human-in-the-Loop**: Slack-based approval workflow
- **Multi-Platform Support**: Twitter, LinkedIn, YouTube, Instagram, Facebook
- **Agno Integration**: Leverages Agno 1.6.3 for agent orchestration
- **Modal Deployment**: Serverless execution with scheduled runs

## 🚀 Usage

### Local Testing
```bash
# Test the pipeline
python social_pipeline.py --test

# Generate content with approval
python social_pipeline.py "Your content topic here"

# Generate and auto-post (skip approval)
python social_pipeline.py --post "Your content topic here"

# Generate without approval workflow
python social_pipeline.py --no-approval "Your content topic here"
```

### Test Individual Components
```bash
# Test multimedia generation only
python utils/multimedia_gen.py

# Test Slack approval workflow only
python utils/slack_approval.py
```

### Modal Deployment
```bash
# Deploy to serverless
modal deploy modal_deploy.py

# Run scheduled pipeline
modal run modal_deploy.py::scheduled_pipeline
```

## 🏷️ Brand Configuration

Everything is driven by `brand/givecare.yml`:

```yaml
name: "GiveCare"
voice_tone: "Warm, honest, and empowering"
voice_style: "Conversational, human-first, avoids jargon"
color_palette: "#FF9F1C, #54340E, #FFE8D6"
image_style: "soft, painterly, warm lighting"
attributes: "empathetic, clear, resourceful, responsible"

# Custom prompts (optional)
prompts:
  image_generation: |
    Create {image_style} image with {color_palette} colors.
    Style: {attributes}. Context: {context}
```

## 🎨 Features

### ✅ Multimedia Generation
- **Images**: Brand-aligned with color palette and style
- **Videos**: 6-second Sora videos with brand aesthetics  
- **Audio**: Background music matching brand voice tone

### ✅ Approval Workflow
- **Slack Integration**: Interactive buttons for approve/reject
- **File Storage**: All content saved for review
- **Terminal Fallback**: Works without Slack configuration

### ✅ Platform Support
- **Twitter**: Text + Image
- **LinkedIn**: Text + Image
- **YouTube**: Text + Video + Audio
- **Instagram**: Text + Image + Video (ready)
- **Facebook**: Text + Image + Video (ready)

### ✅ Brand Agnostic
- **No hardcoded content**: Everything from YAML
- **Dynamic filenames**: Uses actual brand name
- **Scalable**: Swap YAML for different brands

## 🔧 Environment Variables

```bash
# AI Models
AZURE_OPENAI_API_KEY=""
AZURE_OPENAI_BASE_URL=""
SERPER_API_KEY=""

# Media Generation  
REPLICATE_API_TOKEN=""
SONAUTO_API_KEY=""

# Social Platforms
COMPOSIO_API_KEY=""
TWITTER_CONNECTION_ID=""
LINKEDIN_CONNECTION_ID=""
YOUTUBE_CONNECTION_ID=""

# Approval Workflow
SLACK_BOT_TOKEN=""
SLACK_APPROVAL_CHANNEL="#general"
```

## 📊 Output

Generated content includes:
- Platform-optimized text content
- Brand-aligned multimedia files
- Approval workflow tracking
- Posting results and analytics

All files saved to `output/` with brand-specific naming.

---

**Simple. Clean. Brand-driven. No bloat.**