# Agent Social - Feature Specifications

## Core Features

### 1. Story Discovery

#### Overview
Automated discovery of relevant news and stories based on brand topics using Serper API.

#### Specifications
- **Frequency**: Every 6 hours via scheduled pipeline
- **Query Construction**: Dynamic based on brand topics
- **Result Count**: 5-10 stories per query
- **Filtering**: Relevance score, recency, brand alignment
- **Caching**: 1-hour cache to prevent duplicates

#### Implementation
```python
async def discover_stories(brand_framework):
    topics = " OR ".join(brand_framework.topics)
    query = f"({topics}) news recent"
    
    results = await serper_search(query, num=10)
    filtered = filter_by_relevance(results, brand_framework)
    return select_best_story(filtered)
```

### 2. Content Generation

#### Overview
AI-powered content creation that maintains brand voice across multiple platforms.

#### Specifications
- **Model**: O4 for quality content generation
- **Input**: Story data + brand framework
- **Output**: Platform-specific content + visual prompts
- **Platforms**: Twitter, LinkedIn, Facebook, Instagram (planned)
- **Constraints**: Platform character limits, brand voice

#### Platform Requirements
| Platform | Character Limit | Media Support | Special Requirements |
|----------|----------------|---------------|---------------------|
| Twitter | 280 chars | Images, Video | Hashtags, mentions |
| LinkedIn | 3000 chars | Images, Video | Professional tone |
| Facebook | 63,206 chars | Images, Video | Engaging, shareable |
| Instagram | 2200 chars | Images req'd | Visual-first, hashtags |

#### Content Structure
```python
class GeneratedContent(BaseModel):
    story_url: str
    story_title: str
    platform_content: Dict[str, str]
    visual_suggestions: List[str]
    hashtags: List[str]
    brand_alignment_score: float
```

### 3. Approval Workflow

#### Overview
Human-in-the-loop approval system via Slack before content posting.

#### Specifications
- **Integration**: Slack Socket Mode
- **Timeout**: 30 minutes default
- **Actions**: Approve, Reject, Edit (future)
- **Preview**: Full content preview per platform
- **Audit**: All decisions logged

#### Slack Message Format
```
🤖 New Content for Approval

📰 Story: [Story Title]
🔗 Source: [URL]

📱 Twitter:
[Twitter content preview]

💼 LinkedIn:
[LinkedIn content preview]

🎨 Visual Suggestions:
- [Suggestion 1]
- [Suggestion 2]

[Approve ✅] [Reject ❌]
```

### 4. Multi-Platform Posting

#### Overview
Automated posting to multiple social platforms via Composio API.

#### Specifications
- **Platforms**: Twitter, LinkedIn, Facebook
- **Error Handling**: Per-platform retry logic
- **Rate Limiting**: Respect platform limits
- **Scheduling**: Immediate post after approval
- **Analytics**: Track post IDs for future metrics

#### Posting Flow
```python
async def post_to_platforms(content, platforms):
    results = {}
    for platform in platforms:
        try:
            result = await composio_post(
                platform=platform,
                content=content.platform_content[platform],
                media=content.media_urls
            )
            results[platform] = {"success": True, "id": result.id}
        except Exception as e:
            results[platform] = {"success": False, "error": str(e)}
    return results
```

### 5. Brand Framework

#### Overview
YAML-based configuration system for maintaining brand voice and guidelines.

#### Specifications
- **Format**: YAML for easy editing
- **Components**: Voice, tone, topics, guidelines
- **Extensibility**: Support multiple brands
- **Validation**: Schema validation on load

#### Brand YAML Structure
```yaml
name: "Brand Name"
tagline: "Brand tagline"

voice:
  tone: "adjective1, adjective2, adjective3"
  style: "style1, style2"
  personality_traits:
    - trait1
    - trait2

topics:
  - topic1
  - topic2
  - topic3

guidelines:
  - Guideline 1
  - Guideline 2
  - Guideline 3

content_examples:
  twitter:
    - "Example tweet 1"
    - "Example tweet 2"
  linkedin:
    - "Example LinkedIn post"

prohibited_terms:
  - term1
  - term2
```

## Planned Features

### 1. Instagram Integration

#### Specifications
- **Content Type**: Image + caption
- **Image Generation**: AI prompt to image service
- **Caption**: 2200 character limit
- **Hashtags**: 30 max, strategically placed
- **Stories**: Future support for stories format

#### Implementation Plan
1. Add Instagram to Composio configuration
2. Integrate image generation API (DALL-E, Midjourney)
3. Update content generation for visual-first approach
4. Modify approval flow to show images
5. Test posting with media

### 2. Analytics Dashboard

#### Specifications
- **Metrics**: Engagement, reach, clicks, shares
- **Storage**: PostgreSQL for historical data
- **Visualization**: Simple web dashboard
- **Integration**: Platform APIs for metrics
- **Reporting**: Weekly performance emails

#### Data Model
```sql
CREATE TABLE social_posts (
    id UUID PRIMARY KEY,
    platform VARCHAR(50),
    post_id VARCHAR(255),
    content TEXT,
    posted_at TIMESTAMP,
    story_url TEXT,
    approval_time_seconds INTEGER
);

CREATE TABLE post_metrics (
    post_id UUID REFERENCES social_posts(id),
    metric_date DATE,
    impressions INTEGER,
    engagements INTEGER,
    clicks INTEGER,
    shares INTEGER
);
```

### 3. Auto-Approval Rules

#### Specifications
- **Criteria**: Content score, time of day, platform
- **Rules Engine**: Configurable per brand
- **Safety**: Always require approval for sensitive topics
- **Override**: Manual approval always available

#### Rule Examples
```yaml
auto_approval_rules:
  - name: "High confidence off-hours"
    conditions:
      - brand_alignment_score: ">0.9"
      - time: "22:00-06:00"
      - platform: "twitter"
    action: "auto_approve"
    
  - name: "Always review LinkedIn"
    conditions:
      - platform: "linkedin"
    action: "require_approval"
```

### 4. Content Calendar Integration

#### Specifications
- **Format**: iCal, Google Calendar API
- **Planning**: Schedule content in advance
- **Themes**: Daily/weekly content themes
- **Coordination**: Avoid duplicate topics
- **Buffer**: Maintain content queue

### 5. A/B Testing Framework

#### Specifications
- **Variables**: Tone, length, hashtags, timing
- **Metrics**: Engagement rate comparison
- **Statistical Significance**: Built-in calculator
- **Reporting**: Winner selection and insights

#### Test Configuration
```yaml
ab_tests:
  - name: "Emoji usage"
    variants:
      - name: "with_emoji"
        modifier: "add_emojis"
      - name: "without_emoji"
        modifier: "remove_emojis"
    platforms: ["twitter"]
    duration_days: 7
    success_metric: "engagement_rate"
```

## Technical Requirements

### Performance
- **Pipeline Execution**: < 5 minutes total
- **Content Generation**: < 30 seconds per platform
- **Approval Timeout**: Configurable (default 30 min)
- **API Rate Limits**: Respect all platform limits

### Reliability
- **Uptime Target**: 99.5%
- **Error Recovery**: Graceful degradation
- **Monitoring**: Real-time alerts for failures
- **Backup**: Manual execution always possible

### Security
- **API Keys**: Stored in Modal secrets only
- **Access Control**: Slack approval from authorized users
- **Audit Trail**: All actions logged
- **Data Privacy**: No PII stored

### Scalability
- **Multi-Brand**: Support 10+ brands concurrently
- **Platform Count**: Easily add new platforms
- **Content Volume**: 100+ posts/day capacity
- **Storage**: Archived content management

## Success Metrics

### Engagement Metrics
- **Approval Rate**: > 80% content approved
- **Engagement Rate**: Platform-specific targets
- **Click-through Rate**: > 2% average
- **Share Rate**: Viral content identification

### Operational Metrics
- **Pipeline Success**: > 95% completion
- **Approval Time**: < 15 minutes average
- **Error Rate**: < 5% posting failures
- **Cost per Post**: Track API usage costs

### Quality Metrics
- **Brand Alignment**: Manual scoring
- **Content Diversity**: Topic distribution
- **Platform Optimization**: Tailored content
- **Feedback Integration**: Continuous improvement

---

*Specifications designed for scalable, brand-aligned social media automation.*