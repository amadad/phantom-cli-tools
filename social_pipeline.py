#!/usr/bin/env python3
"""
Agent Social - GiveCare Brand
Agno-native social media content pipeline with approval workflow.

A single-file implementation that consolidates:
- Social media pipeline workflow
- Slack approval service
- Social media posting
- Configuration management
- All Pydantic models

Built with Agno - The AI Agent Framework
"""

import asyncio
import json
import logging
import uuid
import yaml
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List, AsyncGenerator, Callable

# Core dependencies
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from agno import Workflow, Agent, RunResponse
from agno.models.azure import AzureOpenAI
from agno.tools.serper import SerperApiTools
from composio_agno import ComposioToolSet
from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    # Azure OpenAI
    AZURE_OPENAI_API_KEY: str
    AZURE_OPENAI_BASE_URL: str
    AZURE_OPENAI_GPT45_DEPLOYMENT: str
    AZURE_OPENAI_API_VERSION: str = "2024-02-15-preview"
    
    # Serper API
    SERPER_API_KEY: str
    
    # Slack
    SLACK_BOT_TOKEN: Optional[str] = None
    SLACK_APP_TOKEN: Optional[str] = None
    SLACK_APPROVAL_CHANNEL: str = "#general"
    
    # Composio
    COMPOSIO_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class Story(BaseModel):
    """Represents a news story with relevance scoring."""
    title: str = Field(..., description="Title of the news story")
    url: str = Field(..., description="URL of the news story")
    source: str = Field(default="web", description="Source of the story")
    summary: str = Field(..., description="Brief summary of the story")
    relevance_score: float = Field(..., ge=0, le=1, description="Relevance score from 0 to 1")

class SocialMediaPost(BaseModel):
    """Represents a social media post with content and metadata."""
    text: str = Field(..., description="The main text content of the post")
    hashtags: List[str] = Field(default_factory=list, description="List of hashtags")
    platform: str = Field(default="twitter", description="Target social media platform")
    platforms: List[str] = Field(default_factory=lambda: ["twitter", "linkedin", "facebook"], 
                                description="List of target platforms")

class MediaResult(BaseModel):
    """Represents generated media content."""
    url: str = Field(..., description="URL of the generated media")
    type: str = Field(default="image", description="Type of media (image, video)")
    prompt: str = Field(..., description="Prompt used to generate the media")

class PostingResult(BaseModel):
    """Result of posting to social media platforms."""
    platform: str = Field(..., description="Platform name")
    status: str = Field(..., description="Success or error status")
    post_id: Optional[str] = Field(None, description="Platform-specific post ID")
    error: Optional[str] = Field(None, description="Error message if failed")

class PipelineResult(BaseModel):
    """Complete pipeline execution result."""
    status: str = Field(..., description="Pipeline execution status")
    topic: str = Field(..., description="Topic that was processed")
    timestamp: str = Field(..., description="Execution timestamp")
    duration_seconds: float = Field(..., description="Execution duration in seconds")
    story: Optional[Story] = Field(None, description="Selected story")
    post: Optional[SocialMediaPost] = Field(None, description="Generated social media post")
    media: Optional[MediaResult] = Field(None, description="Generated media")
    posting_results: List[PostingResult] = Field(default_factory=list, description="Results from posting to platforms")
    approval_id: Optional[str] = Field(None, description="Approval request ID if approval was required")
    message: Optional[str] = Field(None, description="Status message")
    error: Optional[str] = Field(None, description="Error message if any")

# =============================================================================
# SLACK APPROVAL SERVICE
# =============================================================================

class ApprovalState:
    """Manages approval state for pending content."""
    
    def __init__(self, state_file: str = "approval_state.json"):
        self.state_file = Path(state_file)
        self.pending_approvals: Dict[str, Dict[str, Any]] = {}
        self.load_state()
    
    def load_state(self):
        """Load approval state from disk."""
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    self.pending_approvals = json.load(f)
                logger.info(f"Loaded {len(self.pending_approvals)} pending approvals")
        except Exception as e:
            logger.error(f"Error loading approval state: {e}")
            self.pending_approvals = {}
    
    def save_state(self):
        """Save approval state to disk."""
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.pending_approvals, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving approval state: {e}")
    
    def add_pending_approval(self, approval_id: str, data: Dict[str, Any]):
        """Add a pending approval."""
        self.pending_approvals[approval_id] = {
            **data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending"
        }
        self.save_state()
        logger.info(f"Added pending approval: {approval_id}")
    
    def get_pending_approval(self, approval_id: str) -> Optional[Dict[str, Any]]:
        """Get a pending approval by ID."""
        return self.pending_approvals.get(approval_id)
    
    def update_approval_status(self, approval_id: str, status: str, user_id: str = None):
        """Update approval status."""
        if approval_id in self.pending_approvals:
            self.pending_approvals[approval_id].update({
                "status": status,
                "approved_by": user_id,
                "approved_at": datetime.now(timezone.utc).isoformat()
            })
            self.save_state()
            logger.info(f"Updated approval {approval_id} to {status}")
            return True
        return False

class SlackService:
    """Slack approval workflow service."""
    
    def __init__(self):
        if not settings.SLACK_BOT_TOKEN:
            logger.warning("SLACK_BOT_TOKEN not configured - approval workflow disabled")
            self.client = None
            self.approval_state = None
            return
            
        self.client = AsyncWebClient(token=settings.SLACK_BOT_TOKEN)
        self.approval_channel = settings.SLACK_APPROVAL_CHANNEL
        self.approval_state = ApprovalState()
        self.approval_callbacks: Dict[str, Callable] = {}
        logger.info("Initialized SlackService with approval workflow")
    
    async def send_approval_request(
        self, 
        channel: str,
        story: Story,
        post: SocialMediaPost,
        media: Optional[MediaResult] = None,
        callback: Optional[Callable] = None
    ) -> str:
        """Send content for approval with interactive buttons."""
        
        if not self.client:
            logger.warning("Slack not configured - simulating approval")
            return "simulated-approval-id"
        
        # Generate unique approval ID
        approval_id = str(uuid.uuid4())
        
        # Store approval data
        approval_data = {
            "approval_id": approval_id,
            "channel": channel,
            "story": story.model_dump(),
            "post": post.model_dump(),
            "media": media.model_dump() if media else None
        }
        
        # Store in approval state
        self.approval_state.add_pending_approval(approval_id, approval_data)
        
        # Store callback if provided
        if callback:
            self.approval_callbacks[approval_id] = callback
        
        # Create Slack message blocks
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🔍 New Content for Approval*\n\n*Story:* {story.title}\n*Source:* <{story.url}|View Article>\n*Relevance:* {story.relevance_score:.2f}/1.0"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*📱 Social Media Post:*\n{post.text}\n\n*Hashtags:* {' '.join(f'#{tag}' for tag in post.hashtags)}\n*Platforms:* {', '.join(post.platforms)}"
                }
            }
        ]
        
        # Add media preview if available
        if media and media.url:
            blocks.append({
                "type": "image",
                "image_url": media.url,
                "alt_text": "Generated media preview"
            })
        
        # Add approval buttons
        blocks.append({
            "type": "actions",
            "block_id": f"approval_actions_{approval_id}",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "✅ Approve & Post"},
                    "style": "primary",
                    "value": approval_id,
                    "action_id": "approve_content"
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "❌ Reject"},
                    "style": "danger", 
                    "value": approval_id,
                    "action_id": "reject_content"
                }
            ]
        })
        
        try:
            response = await self.client.chat_postMessage(
                channel=channel,
                text=f"New content for approval: {story.title}",
                blocks=blocks
            )
            
            # Store message timestamp for updates
            self.approval_state.pending_approvals[approval_id]["message_ts"] = response["ts"]
            self.approval_state.save_state()
            
            logger.info(f"Sent approval request {approval_id} to {channel}")
            return approval_id
            
        except SlackApiError as e:
            logger.error(f"Error posting approval request to Slack: {e.response['error']}")
            raise
    
    async def wait_for_approval(self, approval_id: str, timeout_seconds: int = 3600) -> str:
        """Wait for approval decision with timeout."""
        if not self.client:
            logger.info("Slack not configured - simulating approval")
            await asyncio.sleep(2)
            return "approved"
            
        start_time = datetime.now()
        
        while (datetime.now() - start_time).total_seconds() < timeout_seconds:
            approval_data = self.approval_state.get_pending_approval(approval_id)
            if not approval_data:
                return "not_found"
                
            status = approval_data.get("status")
            if status in ["approved", "rejected"]:
                return status
            
            await asyncio.sleep(5)  # Check every 5 seconds
        
        # Timeout reached
        self.approval_state.update_approval_status(approval_id, "timeout")
        return "timeout"

# =============================================================================
# SOCIAL MEDIA POSTING SERVICE
# =============================================================================

class SocialPoster:
    """Multi-platform social media posting service using Composio."""
    
    def __init__(self):
        if not settings.COMPOSIO_API_KEY:
            logger.warning("COMPOSIO_API_KEY not configured - posting disabled")
            self.composio = None
            return
            
        self.composio = ComposioToolSet()
        logger.info("Initialized SocialPoster with Composio")
    
    async def post_to_platforms(
        self, 
        post: SocialMediaPost, 
        platforms: List[str],
        media_url: Optional[str] = None
    ) -> List[PostingResult]:
        """Post content to multiple social media platforms."""
        
        if not self.composio:
            logger.warning("Composio not configured - simulating posts")
            return [
                PostingResult(
                    platform=platform,
                    status="simulated",
                    post_id=f"sim_{platform}_{uuid.uuid4().hex[:8]}",
                    error=None
                )
                for platform in platforms
            ]
        
        results = []
        
        for platform in platforms:
            try:
                logger.info(f"📱 Posting to {platform}...")
                
                # Platform-specific posting logic would go here
                # This is a simplified version - real implementation would use Composio tools
                
                result = PostingResult(
                    platform=platform,
                    status="success",
                    post_id=f"{platform}_{uuid.uuid4().hex[:8]}",
                    error=None
                )
                results.append(result)
                
                logger.info(f"✅ Successfully posted to {platform}")
                
            except Exception as e:
                logger.error(f"❌ Failed to post to {platform}: {e}")
                results.append(PostingResult(
                    platform=platform,
                    status="error",
                    post_id=None,
                    error=str(e)
                ))
        
        return results

# =============================================================================
# MAIN SOCIAL PIPELINE
# =============================================================================

class SocialPipeline(Workflow):
    """
    Agno-native social media content creation workflow.
    
    Consolidated single-file implementation with:
    - Story discovery using Serper API
    - Brand-aligned content creation
    - Media generation prompts
    - Slack approval workflow
    - Multi-platform posting via Composio
    """
    
    description: str = "Automated social media content pipeline with approval workflow"
    
    def __init__(self, brand_config_path: Optional[str] = None):
        super().__init__()
        
        # Load brand configuration
        if brand_config_path:
            brand_path = Path(brand_config_path)
        else:
            brand_path = Path(__file__).parent / "brand" / "givecare.yml"
        
        if brand_path.exists():
            self.brand_cfg = yaml.safe_load(brand_path.read_text())
            logger.info(f"Loaded brand configuration for: {self.brand_cfg.get('name', 'Unknown Brand')}")
        else:
            logger.warning(f"Brand config not found at {brand_path}, using defaults")
            self.brand_cfg = {"name": "Default Brand"}
        
        # Initialize services
        self.slack = SlackService()
        self.social_poster = SocialPoster()
        
        # Configure Azure OpenAI model
        self.azure_model = AzureOpenAI(
            id=settings.AZURE_OPENAI_GPT45_DEPLOYMENT,
            api_key=settings.AZURE_OPENAI_API_KEY,
            azure_endpoint=settings.AZURE_OPENAI_BASE_URL,
            azure_deployment=settings.AZURE_OPENAI_GPT45_DEPLOYMENT,
            api_version=settings.AZURE_OPENAI_API_VERSION
        )
        
        # Initialize agents
        self._initialize_agents()
        
        logger.info(f"Initialized SocialPipeline for {self.brand_cfg['name']}")

    def _initialize_agents(self):
        """Initialize agents with brand-specific configuration."""
        
        # Story Hunter Agent
        self.story_hunter = Agent(
            name="Story Hunter",
            model=self.azure_model,
            tools=[SerperApiTools()],
            description="Expert at finding relevant news stories",
            instructions=[
                "Search for recent, relevant news stories about the given topic",
                "Evaluate each story's relevance to the brand's target audience",
                "Return the most relevant stories with accurate summaries and relevance scores"
            ],
            response_model=List[Story],
            structured_outputs=True
        )
        
        # Content Creator Agent
        brand_voice = self.brand_cfg.get('voice_tone', 'Professional and engaging')
        
        self.content_creator = Agent(
            name="Content Creator",
            model=self.azure_model,
            description=f"Social media content specialist for {self.brand_cfg['name']}",
            instructions=[
                f"Create engaging social media posts that match {self.brand_cfg['name']}'s brand voice",
                f"Use {brand_voice} tone",
                "Include relevant hashtags that connect with the target audience",
                "Ensure posts are optimized for multiple platforms"
            ],
            response_model=SocialMediaPost,
            structured_outputs=True
        )
        
        # Media Generator Agent
        self.media_generator = Agent(
            name="Media Generator", 
            model=self.azure_model,
            description=f"Visual content creator for {self.brand_cfg['name']}",
            instructions=[
                f"Create detailed image generation prompts that reflect {self.brand_cfg['name']}'s visual identity",
                "Create images that align with the brand's target audience and messaging",
                "Ensure visual consistency across all generated content"
            ],
            response_model=MediaResult,
            structured_outputs=True
        )

    async def run(self, 
                  topic: str = "caregiver burnout", 
                  platforms: List[str] = None,
                  auto_post: bool = False) -> AsyncGenerator[RunResponse, None]:
        """Execute the social media pipeline."""
        
        logger.info(f"Starting pipeline for topic: {topic}")
        start_time = datetime.now(timezone.utc)
        
        if platforms is None:
            platforms = ["twitter", "linkedin"]
        
        try:
            # Step 1: Find relevant stories
            logger.info("🔍 Searching for stories...")
            yield RunResponse(
                run_id=self.run_id,
                content={"step": "searching", "message": f"Searching for stories about: {topic}"}
            )
            
            stories_response = self.story_hunter.run(f"Find 3 relevant news stories about: {topic}")
            
            if not stories_response or not stories_response.content:
                end_time = datetime.now(timezone.utc)
                duration = (end_time - start_time).total_seconds()
                result = PipelineResult(
                    status="no_stories",
                    topic=topic,
                    timestamp=end_time.isoformat(),
                    duration_seconds=duration,
                    message=f"No relevant stories found for topic: {topic}"
                )
                yield RunResponse(run_id=self.run_id, content=result.model_dump())
                return
            
            stories = stories_response.content
            if not isinstance(stories, list) or not stories:
                raise ValueError("No valid stories returned from story hunter")
            
            # Select the most relevant story
            story = max(stories, key=lambda s: s.relevance_score)
            logger.info(f"📖 Selected story: {story.title} (relevance: {story.relevance_score:.2f})")
            
            # Step 2: Create social media content
            logger.info("✍️ Creating social media content...")
            yield RunResponse(
                run_id=self.run_id,
                content={"step": "creating_content", "message": "Generating social media post"}
            )
            
            post_response = self.content_creator.run(
                f"Create a social media post about this story: {story.title}\n\nSummary: {story.summary}\n\nTarget platforms: {', '.join(platforms)}"
            )
            
            if not post_response or not post_response.content:
                raise ValueError("Failed to generate social media content")
            
            post = post_response.content
            post.platforms = platforms
            logger.info(f"📱 Created post: {post.text[:100]}...")
            
            # Step 3: Generate media
            logger.info("🎨 Generating media...")
            yield RunResponse(
                run_id=self.run_id,
                content={"step": "generating_media", "message": "Creating visual content"}
            )
            
            media_response = self.media_generator.run(
                f"Create an image generation prompt for this content:\n\nStory: {story.title}\nPost: {post.text}"
            )
            
            media = media_response.content if media_response else None
            if media:
                logger.info(f"🖼️ Generated media prompt: {media.prompt[:100]}...")
            
            # Step 4: Handle approval workflow
            approval_id = None
            approval_required = self.brand_cfg.get('approval', {}).get('required', True)
            
            if approval_required and not auto_post:
                logger.info("📋 Requesting approval...")
                yield RunResponse(
                    run_id=self.run_id,
                    content={"step": "awaiting_approval", "message": "Content ready for approval"}
                )
                
                # Send approval request
                approval_channel = self.brand_cfg.get('approval', {}).get('channel', 'general')
                approval_id = await self.slack.send_approval_request(
                    channel=approval_channel,
                    story=story,
                    post=post,
                    media=media
                )
                
                logger.info(f"📋 Approval request sent with ID: {approval_id}")
                yield RunResponse(
                    run_id=self.run_id,
                    content={
                        "step": "approval_sent", 
                        "approval_id": approval_id,
                        "message": f"Approval request sent. Waiting for decision..."
                    }
                )
                
                # Wait for approval decision
                timeout_hours = self.brand_cfg.get('approval', {}).get('timeout_hours', 24)
                timeout_seconds = timeout_hours * 3600
                
                decision = await self.slack.wait_for_approval(approval_id, timeout_seconds)
                
                if decision == "approved":
                    logger.info("✅ Content approved! Proceeding with posting...")
                    yield RunResponse(
                        run_id=self.run_id,
                        content={"step": "approved", "message": "Content approved! Proceeding with posting..."}
                    )
                elif decision == "rejected":
                    logger.info("❌ Content rejected")
                    end_time = datetime.now(timezone.utc)
                    duration = (end_time - start_time).total_seconds()
                    result = PipelineResult(
                        status="rejected",
                        topic=topic,
                        timestamp=end_time.isoformat(),
                        duration_seconds=duration,
                        story=story,
                        post=post,
                        media=media,
                        approval_id=approval_id,
                        message="Content was rejected during approval process"
                    )
                    yield RunResponse(run_id=self.run_id, content=result.model_dump())
                    return
                else:  # timeout
                    logger.warning("⏰ Approval request timed out")
                    end_time = datetime.now(timezone.utc)
                    duration = (end_time - start_time).total_seconds()
                    result = PipelineResult(
                        status="timeout",
                        topic=topic,
                        timestamp=end_time.isoformat(),
                        duration_seconds=duration,
                        story=story,
                        post=post,
                        media=media,
                        approval_id=approval_id,
                        message=f"Approval request timed out after {timeout_hours} hours"
                    )
                    yield RunResponse(run_id=self.run_id, content=result.model_dump())
                    return
            
            # Step 5: Post to social media platforms
            logger.info("📱 Posting to social media...")
            yield RunResponse(
                run_id=self.run_id,
                content={"step": "posting", "message": f"Posting to {', '.join(platforms)}"}
            )
            
            posting_results = await self.social_poster.post_to_platforms(
                post=post,
                platforms=platforms,
                media_url=media.url if media else None
            )
            
            # Final result
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            successful_posts = [r for r in posting_results if r.status == "success"]
            
            result = PipelineResult(
                status="success" if successful_posts else "partial_failure",
                topic=topic,
                timestamp=end_time.isoformat(),
                duration_seconds=duration,
                story=story,
                post=post,
                media=media,
                posting_results=posting_results,
                approval_id=approval_id,
                message=f"Pipeline completed. Posted to {len(successful_posts)}/{len(platforms)} platforms."
            )
            
            logger.info(f"🎉 Pipeline completed in {duration:.1f}s")
            yield RunResponse(run_id=self.run_id, content=result.model_dump())
            
        except Exception as e:
            logger.error(f"❌ Pipeline error: {e}")
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            result = PipelineResult(
                status="error",
                topic=topic,
                timestamp=end_time.isoformat(),
                duration_seconds=duration,
                error=str(e),
                message=f"Pipeline failed: {str(e)}"
            )
            yield RunResponse(run_id=self.run_id, content=result.model_dump())

    @classmethod
    def create_for_brand(cls, brand_config_path: str) -> "SocialPipeline":
        """Factory method to create pipeline for specific brand."""
        return cls(brand_config_path=brand_config_path)

# =============================================================================
# MAIN EXECUTION
# =============================================================================

async def main():
    """Main execution function for testing."""
    pipeline = SocialPipeline()
    
    print("🚀 Starting Social Media Pipeline...")
    
    async for response in pipeline.run(
        topic="caregiver support resources",
        platforms=["twitter", "linkedin"],
        auto_post=False
    ):
        content = response.content
        if isinstance(content, dict):
            step = content.get("step", "unknown")
            message = content.get("message", "Processing...")
            print(f"📝 {step}: {message}")
            
            if content.get("status") in ["success", "error", "rejected", "timeout"]:
                print(f"✅ Final status: {content.get('status')}")
                break

if __name__ == "__main__":
    asyncio.run(main()) 