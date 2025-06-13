# Agent Social - GiveCare Brand

A clean, consolidated social media content pipeline built with Agno. Single-file architecture for automated story discovery, content creation, and multi-platform posting with approval workflows.

## 🚀 Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Run the pipeline
python test_pipeline.py --topic "caregiver burnout"

# Start Slack approval app (optional)
python slack_app.py
```

## 📁 Clean Project Structure

```
agent-social/
├── social_pipeline.py      # 🎯 Main pipeline (everything in one file)
├── slack_app.py           # 💬 Slack integration & approval workflow
├── config.py              # ⚙️  Configuration management
├── test_pipeline.py       # 🧪 Testing interface
├── requirements.txt       # 📦 Dependencies
├── README.md             # 📖 Documentation
├── brand/                # 🏢 Brand configurations
│   └── givecare.yml      #     GiveCare brand settings
└── .env.example          # 🔐 Environment template
```

## 🏗️ Architecture

**Single-File Design** - Everything consolidated into `social_pipeline.py`:
- **SocialPipeline**: Main workflow class with embedded agents
- **Story Hunter**: Finds relevant news using Serper API
- **Content Creator**: Generates brand-aligned social posts
- **Media Generator**: Creates visual content prompts
- **Social Poster**: Multi-platform posting via Composio
- **Slack Service**: Approval workflow management
- **All Models**: Pydantic models for type safety

## ✨ Key Features

- **🎯 Single File Architecture**: Everything in one clean, maintainable file
- **🤖 Agno-Native**: Built with latest Agno patterns and structured outputs
- **📱 Multi-Platform**: Twitter, LinkedIn, Facebook posting via Composio
- **✅ Approval Workflow**: Slack-based content approval with interactive buttons
- **🏢 Brand Framework**: YAML-based brand configuration system
- **🔍 Smart Search**: Serper API integration for relevant story discovery
- **📊 Type Safety**: Full Pydantic model validation
- **🧪 Easy Testing**: Simple test interface with multiple modes

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Azure OpenAI (Required)
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com/
AZURE_OPENAI_GPT45_DEPLOYMENT=gpt-4-turbo

# Serper API (Required)
SERPER_API_KEY=your_key

# Slack (Optional - for approval workflow)
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-token

# Composio (Optional - for posting)
COMPOSIO_API_KEY=your_key
```

### Brand Configuration (brand/givecare.yml)
```yaml
name: "GiveCare"
voice_tone: "Compassionate and supportive"
target_audience: "Family caregivers and healthcare professionals"

approval:
  required: true
  channel: "#content-approval"
  timeout_hours: 24

content_themes:
  - name: "Caregiver Support"
    keywords: ["caregiver burnout", "respite care", "support groups"]
```

## 🚀 Usage

### Basic Pipeline Execution
```python
from social_pipeline import SocialPipeline

# Initialize pipeline
pipeline = SocialPipeline()

# Run with approval workflow
async for response in pipeline.run(
    topic="caregiver burnout",
    platforms=["twitter", "linkedin"],
    auto_post=False  # Requires approval
):
    print(f"Step: {response.content.get('step')}")
```

### Testing Interface
```bash
# Test main pipeline
python test_pipeline.py --topic "elderly care"

# Test with auto-posting (skip approval)
python test_pipeline.py --topic "respite care" --auto-post

# Test brand configuration
python test_pipeline.py --test-brand

# Test approval workflow
python test_pipeline.py --test-approval
```

### Slack Integration
```bash
# Start Slack app for approval workflow
python slack_app.py

# Use slash commands in Slack:
/pipeline status          # Check pipeline status
/pipeline run <topic>     # Run pipeline for topic
/pipeline pause          # Pause pipeline
/pipeline resume         # Resume pipeline
```

## 📊 Approval Workflow

1. **Content Generation**: Pipeline creates story, post, and media
2. **Slack Notification**: Sends interactive approval message
3. **User Decision**: Approve/reject via Slack buttons
4. **Automated Posting**: Posts to selected platforms on approval
5. **Status Tracking**: Full audit trail of decisions

## 🧪 Testing

```bash
# Run all tests
python test_pipeline.py

# Test specific components
python test_pipeline.py --test-brand      # Brand config
python test_pipeline.py --test-approval   # Approval workflow

# Test with custom topic
python test_pipeline.py --topic "mental health awareness"
```

## 📦 Dependencies

Core dependencies (see `requirements.txt`):
- `agno` - AI Agent framework
- `pydantic` - Data validation
- `composio-agno` - Social media posting
- `slack-sdk` - Slack integration
- `slack-bolt` - Slack app framework
- `pyyaml` - Configuration management

## 🔄 Workflow Steps

1. **🔍 Story Discovery**: Search for relevant news using Serper API
2. **✍️ Content Creation**: Generate brand-aligned social media posts
3. **🎨 Media Generation**: Create visual content prompts
4. **📋 Approval Request**: Send to Slack for human approval (optional)
5. **📱 Multi-Platform Posting**: Post to Twitter, LinkedIn, Facebook via Composio
6. **📊 Results Tracking**: Comprehensive success/failure reporting

## 🏢 Brand Framework

The pipeline supports multiple brands through YAML configuration:

```python
# Load specific brand
pipeline = SocialPipeline("brand/custom-brand.yml")

# Use factory method
pipeline = SocialPipeline.create_for_brand("brand/givecare.yml")
```

Each brand configuration includes:
- Voice and tone guidelines
- Target audience definition
- Content themes and keywords
- Approval workflow settings
- Social media handles
- Visual identity guidelines

## 🚨 Error Handling

- **Graceful Degradation**: Pipeline continues even if optional services fail
- **Detailed Logging**: Comprehensive logging for debugging
- **Status Tracking**: Clear success/failure indicators
- **Timeout Management**: Configurable timeouts for approval workflow
- **Platform-Specific Errors**: Individual platform posting error handling

## 🔐 Security

- **Environment Variables**: All sensitive data in .env file
- **API Key Management**: Secure credential handling
- **Approval Gates**: Human oversight for content publishing
- **Audit Trail**: Complete logging of all actions

## 📈 Scalability

- **Single File**: Easy to maintain and deploy
- **Async Architecture**: Non-blocking operations
- **Modular Design**: Easy to extend with new platforms
- **Brand Agnostic**: Support for multiple brands/clients
- **Cloud Ready**: Works with Modal, AWS Lambda, etc.

---

**Built with ❤️ using Agno - The AI Agent Framework**