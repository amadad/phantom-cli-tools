# Agent Social - Automated Social Media Pipeline

AI-powered social media content generation with brand-aligned visual modes and human approval workflow.

## 🎯 Architecture

```
Brand YAML → Content Generation → Visual Mode Selection → Image Generation → Approval → Multi-Platform Publishing
```

**Key Design Principles:**
- **Modular Architecture**: Clean separation of concerns across utils modules
- **Brand-First**: YAML configuration drives all content and visual decisions  
- **Visual Unity**: Discrete visual modes for consistent brand expression
- **Human-in-the-Loop**: Slack approval before posting
- **Entity Authentication**: Serverless-ready social platform connections

## 📁 Project Structure

```
agent-social/
├── modal_app.py                 # Modal serverless deployment (290 lines)
├── utils/
│   ├── content_generation.py    # Content creation and topic rotation
│   ├── visual_mode_generator.py # Brand-consistent image generation
│   ├── social_posting.py        # Multi-platform posting with entity auth
│   ├── image_generation.py      # Base image generation utilities
│   ├── slack_approval.py        # Interactive approval workflow
│   └── evaluation.py            # Pipeline performance testing
├── brand/
│   └── givecare.yml             # Enhanced brand config with visual modes
├── working_entity_ids.json      # Verified Composio entity connections
├── composio_entities.json       # Complete entity mapping
└── output/                      # Generated content archive
```

## 🚀 Features

### ✅ Visual Mode System
- **framed_portrait**: Intimate family moments with signature tan border frame
- **lifestyle_scene**: Environmental shots showing caregiving in context  
- **illustrative_concept**: Soft watercolor illustrations for abstract concepts
- **Unity not Uniformity**: Consistent brand DNA with contextual variation

### ✅ Modular Architecture
- **Content Generation**: Agno-powered content creation with platform optimization
- **Visual Generation**: Brand-aware image creation using Replicate FLUX models
- **Social Posting**: Entity-based authentication for Twitter/LinkedIn
- **Approval Workflow**: Slack-based human review process
- **Evaluation System**: Automated testing across models and scenarios

### ✅ Serverless Deployment
- **Modal Integration**: Production-ready serverless deployment
- **Scheduled Execution**: Automatic content generation every 6 hours
- **Entity Authentication**: Persistent social platform connections
- **Storage Volume**: Content archival and result tracking

## 🚀 Usage

### Local Testing
```bash
# Test content generation
python -c "
from utils.content_generation import generate_platform_content
import yaml
with open('brand/givecare.yml') as f:
    brand = yaml.safe_load(f)
content = await generate_platform_content('Self-care tips', ['twitter'], brand, False)
print(content)
"

# Test visual mode generation
python -c "
from utils.visual_mode_generator import generate_brand_image_with_mode
import yaml
with open('brand/givecare.yml') as f:
    brand = yaml.safe_load(f)
url = await generate_brand_image_with_mode('Family moment', 'caregiving', brand, 'social_post')
print(url)
"

# Test actual posting (with real posts)
python test_actual_post.py
```

### Modal Deployment
```bash
# Deploy to production
modal deploy modal_app.py

# Run pipeline manually
modal run modal_app.py::run_pipeline --topic "Caregiver wellness" --platforms "twitter,linkedin" --auto-post

# Test authentication
modal run modal_app.py::test_composio_auth

# Run evaluation suite
modal run modal_app.py::evaluate_pipeline

# Check health
modal run modal_app.py::health_check
```

### Scheduled Pipeline
```bash
# The pipeline runs automatically every 6 hours via Modal cron
# Manual trigger:
modal run modal_app.py::scheduled_pipeline
```

## 🏷️ Brand Configuration

Enhanced `brand/givecare.yml` with visual mode system:

```yaml
name: "GiveCare"
voice:
  tone: "empathetic, supportive, hopeful"
  style: "conversational, inclusive"

# Visual mode system for brand consistency
visual_style:
  visual_modes:
    - name: "framed_portrait"
      description: "Intimate family moments with signature tan border frame"
      prompt_template: |
        Documentary-style photograph showing {scene_description}.
        Shot with natural lighting, authentic emotions, intimate framing.
        Professional photography with thick tan (#D7B899) border frame.
    
    - name: "lifestyle_scene"  
      description: "Wider environmental shots showing caregiving in context"
      prompt_template: |
        Lifestyle photography capturing {scene_description}.
        Environmental portrait style with contextual storytelling.
        Warm diffuse lighting, soft grain, editorial quality.
    
    - name: "illustrative_concept"
      description: "Soft illustrations for abstract concepts"
      prompt_template: |
        Soft watercolor illustration depicting {scene_description}.
        Gentle brush strokes, muted earth tones, minimal detail.

# Platform-specific configurations
platforms:
  twitter:
    max_chars: 280
    hashtag_count: 2
  linkedin:
    max_chars: 3000
    hashtag_count: 5
```

## 🔧 Environment Variables

```bash
# AI Models
AZURE_OPENAI_API_KEY=""
AZURE_OPENAI_ENDPOINT=""
AZURE_OPENAI_DEPLOYMENT=""
SERPER_API_KEY=""

# Media Generation  
REPLICATE_API_TOKEN=""

# Social Platforms
COMPOSIO_API_KEY=""

# Approval Workflow
SLACK_BOT_TOKEN=""
SLACK_APP_TOKEN=""
SLACK_CHANNEL_ID=""
```

## 🎨 Visual Mode Selection

The system automatically selects visual modes based on content:

- **Mental health/wellness** → `illustrative_concept` or `framed_portrait`
- **Technology/tools** → `lifestyle_scene`
- **Family stories** → `framed_portrait`
- **Educational content** → `lifestyle_scene` or `illustrative_concept`

## 📊 Entity Authentication

Verified Composio entity IDs for serverless deployment:

```json
{
  "twitter": "24b79587-149a-46be-8f02-59621dc9989d",
  "linkedin": "52251831-ff5f-4006-a5a4-ca894bd21eb0",
  "twitter_media": "4357db42-045d-4a9f-9e0b-640b258ff313"
}
```

## 🧪 Testing & Evaluation

```bash
# Run test scenarios across multiple models
modal run modal_app.py::evaluate_pipeline

# Test specific visual modes
python -c "
from utils.visual_mode_generator import select_visual_mode
import yaml
with open('brand/givecare.yml') as f:
    brand = yaml.safe_load(f)
mode = select_visual_mode('social_post', 'caregiver burnout', brand)
print(f'Selected mode: {mode[\"name\"]}')
"
```

## 📈 Performance

- **Content Generation**: ~15-30 seconds per platform
- **Image Generation**: ~10-20 seconds per image (FLUX-schnell)
- **Pipeline Execution**: ~2-3 minutes total (with approval)
- **Scheduled Runs**: Every 6 hours automatically

## 🏗️ Architecture Highlights

1. **Single Modal App**: Streamlined from 624 to 290 lines
2. **Utils Modules**: Clean separation of concerns
3. **Brand-Driven**: Everything flows from YAML configuration
4. **Visual Consistency**: Discrete modes ensure brand unity
5. **Serverless Ready**: Entity-based authentication for production
6. **Human Oversight**: Slack approval maintains quality control

---

**Modular. Brand-driven. Production-ready.**