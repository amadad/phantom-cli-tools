# Agent Social Pipeline

Automated social content pipeline for GiveCare, generating and approving branded posts using AI agents.

## 🌟 Features

- **Story Hunting**: Finds trending caregiving topics using web search
- **Content Creation**: Writes platform-specific posts in brand voice
- **Media Generation**: Creates images via Replicate (with Azure OpenAI video support)
- **Human-in-the-Loop**: Slack-based approval workflow
- **Multi-Platform**: Ready for LinkedIn, Twitter, Instagram, etc.
- **Serverless**: Deploy on Modal with scheduled runs

## 🏗 Project Structure

```
agent-social/
├── agents/                    # AI agent implementations
│   ├── __init__.py
│   ├── story_hunter.py        # Finds and scores relevant stories
│   ├── content_creator.py     # Crafts social posts
│   ├── media_generator.py     # Handles image/video generation
│   └── replicate_image.py     # Replicate image generation agent
│
├── services/                 # External service integrations
│   ├── __init__.py
│   └── slack_service.py       # Slack notifications and approvals
│
├── workflows/                # Business logic flows
│   ├── __init__.py
│   └── social_pipeline.py     # Main content generation workflow
│
├── output/                   # Generated content
│   ├── images/               # Generated images
│   └── articles/             # Post content as markdown
│
├── brand/
│   └── givecare.yml         # Brand configuration
│
├── modal_app.py             # Modal deployment config
├── requirements.txt          # Python dependencies
└── .env.example             # Environment template
```

## 🔄 Workflow

1. **Story Discovery**
   - Searches for trending caregiving topics
   - Scores relevance to GiveCare's mission
   - Selects top stories for content creation

2. **Content Generation**
   - Writes platform-optimized posts
   - Generates matching images using Replicate
   - Applies brand voice and styling

3. **Approval**
   - Posts drafts to Slack for review
   - Awaits human approval/rejection
   - Tracks status in `output/`

4. **Publishing**
   - Ready for integration with social platforms
   - Archive published content

## 🚀 Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   # Edit .env with your tokens
   ```

3. Required services:
   - Replicate API key (for image generation)
   - Slack app with bot token (for approvals)
   - Azure OpenAI (for video generation, optional)

## 🏃 Running Locally

```bash
# Run the pipeline
python -m workflows.social_pipeline

# Or via Modal (if deployed)
modal run modal_app.py::trigger --data '{"topic":"caregiver burnout"}'
```

## 🚀 Deployment

Deploy to Modal:

```bash
modal deploy modal_app.py
```

## 🔧 Configuration

Edit `brand/givecare.yml` to customize:
- Brand voice and styling
- Content themes and topics
- Agent behavior (models, temperature)
- Approval workflow settings

## 📝 License

MIT

---

Built with ❤️ for GiveCare