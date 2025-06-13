# Agent Social Pipeline

Automated social content pipeline for GiveCare, generating and approving branded posts using AI agents.

## 🌟 Features

- **Story Hunting**: Finds trending caregiving topics using web search
- **Content Creation**: Writes platform-specific posts in brand voice
- **Media Generation**: Creates images via Replicate (with Azure OpenAI video support)
- **Human-in-the-Loop**: Rich Slack-based approval workflow with interactive components
- **Multi-Platform**: Ready for LinkedIn, Twitter, Instagram, etc.
- **Serverless**: Deploy on Modal with scheduled runs
- **Secure**: Request verification and signature validation for all Slack events

## 🏗 Project Structure

 Usage:
  - python slack_app.py
  - python -m workflows.social_pipeline 
  - Push to main branch (auto-deploys via CI/CD) 

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
└── .env.example             ## 📝 Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Azure OpenAI
AZURE_OPENAI_BASE_URL=
AZURE_OPENAI_GPT45_DEPLOYMENT=
AZURE_OPENAI_API_KEY=

# SerpAPI for web search
SERP_API_KEY=

# Slack Configuration
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_VERIFICATION_TOKEN=
SLACK_APPROVAL_CHANNEL=#general

# Output Directories
OUTPUT_BASE=output
IMAGES_DIR=output/images
ARTICLES_DIR=output/articles
```

## 🔍 API Reference

### Endpoints

- `POST /slack/events` - Handle Slack events and URL verification
- `POST /slack/commands` - Handle Slack slash commands
- `POST /slack/actions` - Handle Slack interactive components
- `GET /health` - Health check endpoint

### Interactive Components

The Slack integration includes the following interactive components:

1. **Approval Buttons**
   - Approve: Approves the content for posting
   - Reject: Rejects the content with optional feedback

2. **Slash Commands**
   - `/social-pipeline [topic]` - Start a new content pipeline for the given topic

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Agno](https://github.com/agno-ai/agno) for the agent framework
- [Slack Bolt](https://slack.dev/bolt-python/concepts) for the Slack integration
- [Azure OpenAI](https://azure.microsoft.com/en-us/services/cognitive-services/openai-service/) for language models
- [Replicate](https://replicate.com/) for image generation

## 🔄 Workflow

1. **Story Discovery**
   - Searches for trending caregiving topics
   - Scores relevance to GiveCare's mission
   - Selects top stories for content creation
   - Posts content approval requests to Slack with rich formatting
   - Handles user approval/rejection through interactive buttons

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

### Prerequisites

1. **Python 3.8+**
2. **Slack Workspace** with admin access
3. **Azure OpenAI** API access
4. **SerpAPI** key for web searches

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-org/agent-social.git
   cd agent-social
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your credentials.

### Slack App Setup

1. Create a new Slack App at [api.slack.com/apps](https://api.slack.com/apps)
2. Add the following OAuth scopes:
   - `chat:write`
   - `commands`
   - `incoming-webhook`
   - `app_mentions:read`
   - `channels:history`

3. Enable Events and set the Request URL to your server's `/slack/events` endpoint
4. Add a Slash Command:
   - Command: `/social-pipeline`
   - Request URL: `https://your-domain.com/slack/commands`
   - Description: `Start a new social media content pipeline`

### Running the App

```bash
# Start the Slack app locally
python slack_app.py
```

### Running the Pipeline

```bash
# Run the social pipeline
python -m workflows.social_pipeline --topic "caregiver support"
```

## 🔒 Security

- All Slack requests are verified using the signing secret
- Environment variables are used for sensitive configuration
- Rate limiting and request validation are implemented
- HTTPS is required for all Slack API endpoints

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

### CI/CD Pipeline (Recommended)
Push to main branch to auto-deploy:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Manual Deployment
```bash
modal deploy modal_app.py
```

Setup requires GitHub secrets:
- `MODAL_TOKEN_ID`: From ~/.modal.toml
- `MODAL_TOKEN_SECRET`: From ~/.modal.toml

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