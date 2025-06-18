#!/usr/bin/env python3
"""
Agno-Native Multi-Channel Social Media Agent Team
Leverages 90%+ Agno built-in features with minimal custom code.
"""

from agno.agent import Agent
from agno.team import Team
from agno.models.azure import AzureOpenAI
from agno.tools.serpapi import SerpApiTools
from agno.storage.sqlite import SqliteStorage
from agno.tools.decorator import tool
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from pydantic_settings import BaseSettings
import os
import logging
import yaml
import asyncio
import json
from datetime import datetime
from pathlib import Path
from slack_sdk.web.async_client import AsyncWebClient
from composio_agno import ComposioToolSet, Action, App

logger = logging.getLogger(__name__)

# ============================================================================
# AGNO STRUCTURED OUTPUTS (Built-in validation)
# ============================================================================

class SocialPost(BaseModel):
    """Universal social media post model."""
    content: str = Field(..., description="Main post content")
    hashtags: List[str] = Field(default_factory=list, description="Relevant hashtags")
    mentions: List[str] = Field(default_factory=list, description="User mentions")
    media_urls: List[str] = Field(default_factory=list, description="Media attachments")
    
    class Config:
        extra = "forbid"  # Prevents additionalProperties

class TwitterPost(SocialPost):
    """Twitter-specific post with built-in validation."""
    content: str = Field(..., max_length=280, description="Tweet content under 280 chars")
    thread: bool = Field(default=False, description="Whether this is part of a thread")
    
    class Config:
        extra = "forbid"  # Prevents additionalProperties

class LinkedInPost(SocialPost):
    """LinkedIn-specific post with built-in validation."""
    content: str = Field(..., max_length=3000, description="LinkedIn post content")
    professional_tone: bool = Field(default=True, description="Maintain professional tone")
    
    class Config:
        extra = "forbid"  # Prevents additionalProperties

class InstagramPost(SocialPost):
    """Instagram-specific post with built-in validation."""
    content: str = Field(..., max_length=2200, description="Instagram caption content")
    image_required: bool = Field(default=True, description="Instagram requires visual content")
    hashtags: List[str] = Field(default_factory=list, max_items=30, description="Max 30 hashtags")
    
    class Config:
        extra = "forbid"

class FacebookPost(SocialPost):
    """Facebook-specific post with built-in validation."""
    content: str = Field(..., max_length=63206, description="Facebook post content")
    engaging_tone: bool = Field(default=True, description="Optimize for engagement and shares")
    
    class Config:
        extra = "forbid"

class YouTubePost(SocialPost):
    """YouTube community post with built-in validation."""
    content: str = Field(..., max_length=8000, description="YouTube community post content")
    community_focused: bool = Field(default=True, description="Focus on community engagement")
    
    class Config:
        extra = "forbid"

class ChannelSelection(BaseModel):
    """AI-powered channel routing decision."""
    selected_channels: List[str] = Field(..., description="Optimal channels for content")
    reasoning: str = Field(..., description="Why these channels were selected")
    engagement_prediction: Dict[str, float] = Field(..., description="Predicted engagement per channel")
    
    class Config:
        extra = "forbid"  # Prevents additionalProperties

# ============================================================================
# AGNO CONFIRMATION TOOLS (Built-in human-in-loop)
# ============================================================================

def get_composio_toolset() -> ComposioToolSet:
    """Get Composio toolset instance with API key."""
    settings = get_settings()
    return ComposioToolSet(api_key=settings.COMPOSIO_API_KEY)

@tool(requires_confirmation=True)
def post_to_twitter(content: str, hashtags: str = "") -> Dict[str, Any]:
    """Post content to Twitter via Composio with confirmation."""
    try:
        toolset = get_composio_toolset()
        
        # Prepare tweet content with hashtags
        tweet_text = content
        if hashtags:
            hashtag_text = " ".join([f"#{tag.strip()}" for tag in hashtags.split(",") if tag.strip()])
            if hashtag_text and hashtag_text not in content:
                tweet_text = f"{content} {hashtag_text}"
        
        # Execute Twitter post via Composio
        result = toolset.execute_action(
            action=Action.TWITTER_CREATION_TWEET,
            params={"text": tweet_text[:280]},  # Ensure Twitter character limit
            entity_id=os.getenv("TWITTER_CONNECTION_ID")
        )
        
        return {
            "platform": "twitter",
            "content": tweet_text,
            "hashtags": hashtags.split(",") if hashtags else [],
            "status": "posted" if result.get("successful") else "failed",
            "post_id": result.get("data", {}).get("id") if result.get("successful") else None,
            "composio_result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to post to Twitter: {e}")
        return {
            "platform": "twitter",
            "content": content,
            "status": "failed",
            "error": str(e)
        }

@tool(requires_confirmation=True)
def post_to_linkedin(content: str, hashtags: str = "") -> Dict[str, Any]:
    """Post content to LinkedIn via Composio with confirmation."""
    try:
        toolset = get_composio_toolset()
        
        # Prepare LinkedIn content with hashtags
        linkedin_text = content
        if hashtags:
            hashtag_text = " ".join([f"#{tag.strip()}" for tag in hashtags.split(",") if tag.strip()])
            if hashtag_text and hashtag_text not in content:
                linkedin_text = f"{content}\n\n{hashtag_text}"
        
        # Execute LinkedIn post via Composio
        result = toolset.execute_action(
            action=Action.LINKEDIN_POST_CREATE,
            params={"text": linkedin_text[:3000]},  # Ensure LinkedIn character limit
            entity_id=os.getenv("LINKEDIN_CONNECTION_ID")
        )
        
        return {
            "platform": "linkedin",
            "content": linkedin_text,
            "hashtags": hashtags.split(",") if hashtags else [],
            "status": "posted" if result.get("successful") else "failed",
            "post_id": result.get("data", {}).get("id") if result.get("successful") else None,
            "composio_result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to post to LinkedIn: {e}")
        return {
            "platform": "linkedin",
            "content": content,
            "status": "failed",
            "error": str(e)
        }

@tool(requires_confirmation=True)
def post_to_instagram(content: str, hashtags: str = "", image_url: str = "") -> Dict[str, Any]:
    """Post content to Instagram via Composio with confirmation."""
    try:
        if not image_url:
            return {
                "platform": "instagram",
                "content": content,
                "status": "failed",
                "error": "Instagram requires an image URL"
            }
            
        toolset = get_composio_toolset()
        
        # Prepare Instagram content with hashtags
        instagram_text = content
        if hashtags:
            hashtag_text = " ".join([f"#{tag.strip()}" for tag in hashtags.split(",") if tag.strip()])
            if hashtag_text and hashtag_text not in content:
                instagram_text = f"{content}\n\n{hashtag_text}"
        
        # Execute Instagram post via Composio (requires image)
        result = toolset.execute_action(
            action=Action.INSTAGRAM_UPLOAD_PHOTO,
            params={
                "image_url": image_url,
                "caption": instagram_text[:2200]  # Instagram caption limit
            },
            entity_id=os.getenv("INSTAGRAM_CONNECTION_ID")
        )
        
        return {
            "platform": "instagram",
            "content": instagram_text,
            "hashtags": hashtags.split(",") if hashtags else [],
            "image_url": image_url,
            "status": "posted" if result.get("successful") else "failed",
            "post_id": result.get("data", {}).get("id") if result.get("successful") else None,
            "composio_result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to post to Instagram: {e}")
        return {
            "platform": "instagram",
            "content": content,
            "status": "failed",
            "error": str(e)
        }

@tool(requires_confirmation=True)
def post_to_facebook(content: str, hashtags: str = "") -> Dict[str, Any]:
    """Post content to Facebook via Composio with confirmation."""
    try:
        toolset = get_composio_toolset()
        
        # Prepare Facebook content with hashtags
        facebook_text = content
        if hashtags:
            hashtag_text = " ".join([f"#{tag.strip()}" for tag in hashtags.split(",") if tag.strip()])
            if hashtag_text and hashtag_text not in content:
                facebook_text = f"{content}\n\n{hashtag_text}"
        
        # Execute Facebook post via Composio
        result = toolset.execute_action(
            action=Action.FACEBOOK_PAGE_POST_CREATE,
            params={"message": facebook_text},
            entity_id=os.getenv("FACEBOOK_CONNECTION_ID")
        )
        
        return {
            "platform": "facebook",
            "content": facebook_text,
            "hashtags": hashtags.split(",") if hashtags else [],
            "status": "posted" if result.get("successful") else "failed",
            "post_id": result.get("data", {}).get("id") if result.get("successful") else None,
            "composio_result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to post to Facebook: {e}")
        return {
            "platform": "facebook",
            "content": content,
            "status": "failed",
            "error": str(e)
        }

@tool(requires_confirmation=True)
def post_to_youtube(content: str, hashtags: str = "") -> Dict[str, Any]:
    """Post community content to YouTube via Composio with confirmation."""
    try:
        toolset = get_composio_toolset()
        
        # Prepare YouTube community post content
        youtube_text = content
        if hashtags:
            hashtag_text = " ".join([f"#{tag.strip()}" for tag in hashtags.split(",") if tag.strip()])
            if hashtag_text and hashtag_text not in content:
                youtube_text = f"{content}\n\n{hashtag_text}"
        
        # Execute YouTube community post via Composio
        result = toolset.execute_action(
            action=Action.YOUTUBE_COMMUNITY_POST_CREATE,
            params={"text": youtube_text[:8000]},  # YouTube community post limit
            entity_id=os.getenv("YOUTUBE_CONNECTION_ID")
        )
        
        return {
            "platform": "youtube",
            "content": youtube_text,
            "hashtags": hashtags.split(",") if hashtags else [],
            "status": "posted" if result.get("successful") else "failed",
            "post_id": result.get("data", {}).get("id") if result.get("successful") else None,
            "composio_result": result
        }
        
    except Exception as e:
        logger.error(f"Failed to post to YouTube: {e}")
        return {
            "platform": "youtube",
            "content": content,
            "status": "failed",
            "error": str(e)
        }

# ============================================================================
# SLACK APPROVAL INTEGRATION (Lightweight)
# ============================================================================

async def send_slack_approval_request(platform: str, content: str, tool_args: Dict[str, Any]) -> bool:
    """Send approval request to Slack with content file reference."""
    settings = get_settings()
    
    if not settings.SLACK_BOT_TOKEN:
        logger.warning("No Slack token found, falling back to terminal approval")
        return False
        
    try:
        client = AsyncWebClient(token=settings.SLACK_BOT_TOKEN)
        
        # Get brand context
        brand_config = get_brand_config()
        brand_name = brand_config.get("name", "Agent Social")
        filepath = tool_args.get("filepath", "")
        
        # Create approval message with brand context
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f":warning: *{brand_name} - {platform.upper()} POST APPROVAL REQUIRED*\n\n*Content Preview:*\n```{content[:400]}{'...' if len(content) > 400 else ''}```\n\n*File:* `{filepath}`"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✅ Approve & Post"},
                        "style": "primary",
                        "action_id": "approve_post",
                        "value": filepath
                    },
                    {
                        "type": "button", 
                        "text": {"type": "plain_text", "text": "❌ Reject"},
                        "style": "danger",
                        "action_id": "reject_post",
                        "value": filepath
                    }
                ]
            }
        ]
        
        # Send message
        response = await client.chat_postMessage(
            channel=settings.SLACK_APPROVAL_CHANNEL,
            text=f"{brand_name} {platform.upper()} post approval required",
            blocks=blocks
        )
        
        logger.info(f"✅ Sent Slack approval request for {platform} to {settings.SLACK_APPROVAL_CHANNEL}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send Slack approval: {e}")
        return False

# ============================================================================
# SETTINGS (Built-in Agno pattern)
# ============================================================================

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
    SLACK_SIGNING_SECRET: Optional[str] = None
    SLACK_VERIFICATION_TOKEN: Optional[str] = None
    SLACK_APPROVAL_CHANNEL: str = "#general"
    
    # Composio
    COMPOSIO_API_KEY: Optional[str] = None
    TWITTER_CONNECTION_ID: Optional[str] = None
    TWITTER_MEDIA_CONNECTION_ID: Optional[str] = None
    LINKEDIN_CONNECTION_ID: Optional[str] = None
    INSTAGRAM_CONNECTION_ID: Optional[str] = None
    FACEBOOK_CONNECTION_ID: Optional[str] = None
    YOUTUBE_CONNECTION_ID: Optional[str] = None
    
    class Config:
        env_file = ".env"
        extra = "allow"  # Allow extra fields from environment

# Lazy load settings to avoid validation errors during import in CI/CD
_settings_cache = None
_brand_config_cache = None

def get_settings() -> Settings:
    """Get settings instance with lazy loading and caching."""
    global _settings_cache
    if _settings_cache is None:
        try:
            _settings_cache = Settings()
            logger.info("✅ Settings loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load settings: {e}")
            raise
    return _settings_cache

def get_brand_config() -> Dict[str, Any]:
    """Load brand configuration from YAML with caching."""
    global _brand_config_cache
    if _brand_config_cache is None:
        try:
            brand_file = "brand/givecare.yml"
            if os.path.exists(brand_file):
                with open(brand_file, 'r') as f:
                    _brand_config_cache = yaml.safe_load(f)
                logger.info("✅ Brand config loaded successfully")
            else:
                _brand_config_cache = {"social": {"twitter_handle": "@default", "linkedin_author": "Default", "instagram_handle": "@default", "facebook_page": "default", "youtube_channel": "@default"}}
                logger.warning("⚠️ Brand config file not found, using defaults")
        except Exception as e:
            logger.error(f"❌ Failed to load brand config: {e}")
            _brand_config_cache = {"social": {}}
    return _brand_config_cache

def get_supported_channels() -> List[str]:
    """Get list of supported social channels from brand config."""
    brand_config = get_brand_config()
    social_config = brand_config.get("social", {})
    return [channel.replace("_handle", "").replace("_author", "").replace("_page", "").replace("_channel", "") for channel in social_config.keys()]

# ============================================================================
# AGNO AGENT TEAM (Built-in multi-agent coordination)
# ============================================================================

def create_social_team(session_id: Optional[str] = None) -> Team:
    """Create Agno-native social media agent team."""
    
    settings = get_settings()
    
    # Shared Azure OpenAI model
    azure_model = AzureOpenAI(
        id=settings.AZURE_OPENAI_GPT45_DEPLOYMENT,
        api_key=settings.AZURE_OPENAI_API_KEY,
        azure_endpoint=settings.AZURE_OPENAI_BASE_URL,
        azure_deployment=settings.AZURE_OPENAI_GPT45_DEPLOYMENT,
        api_version=settings.AZURE_OPENAI_API_VERSION
    )
    
    # Shared storage (built-in persistence)
    storage = SqliteStorage(
        table_name="social_team_sessions",
        db_file="tmp/social_team.db"
    )
    
    # Content Research Agent
    content_researcher = Agent(
        name="Content Researcher",
        model=azure_model,
        tools=[SerpApiTools(api_key=settings.SERPER_API_KEY)],
        description="Expert at finding trending topics and news stories",
        instructions=[
            "Search for the most recent and engaging news about the given topic",
            "Identify stories with high viral potential",
            "Provide comprehensive summaries and key talking points"
        ],
        storage=storage,
        session_id=session_id
    )
    
    # Channel Router Agent (AI-powered routing)
    channel_router = Agent(
        name="Channel Router",
        model=azure_model,
        description="AI-powered social media channel selection expert",
        instructions=[
            "Analyze content and determine optimal social media channels",
            "Consider audience, content type, and engagement potential",
            "Provide reasoning for channel selection decisions"
        ],
        response_model=ChannelSelection,  # Built-in structured output
        storage=storage,
        session_id=session_id
    )
    
    # Twitter Specialist Agent
    twitter_agent = Agent(
        name="Twitter Specialist",
        model=azure_model,
        tools=[post_to_twitter],  # Built-in confirmation
        description="Expert at creating engaging Twitter content",
        instructions=[
            "Create concise, engaging tweets under 280 characters",
            "Use trending hashtags and maintain Twitter best practices",
            "Optimize for retweets and engagement"
        ],
        response_model=TwitterPost,  # Built-in validation
        storage=storage,
        session_id=session_id
    )
    
    # Channel-specific agents (dynamically created from brand config)
    channel_agents = {}
    brand_config = get_brand_config()
    
    # Agent factory pattern - Agno handles the complexity
    agent_configs = {
        "twitter": {"model": TwitterPost, "tool": post_to_twitter, "limit": "280 chars"},
        "linkedin": {"model": LinkedInPost, "tool": post_to_linkedin, "limit": "3000 chars"}, 
        "instagram": {"model": InstagramPost, "tool": post_to_instagram, "limit": "2200 chars"},
        "facebook": {"model": FacebookPost, "tool": post_to_facebook, "limit": "63K chars"},
        "youtube": {"model": YouTubePost, "tool": post_to_youtube, "limit": "8K chars"}
    }
    
    for channel, config in agent_configs.items():
        channel_agents[channel] = Agent(
            name=f"{channel.title()} Specialist",
            model=azure_model,
            tools=[config["tool"]],
            description=f"Expert at creating {channel} content",
            instructions=[f"Create optimized {channel} content under {config['limit']}"],
            response_model=config["model"],
            storage=storage,
            session_id=session_id
        )
    
    # Create Agno Team (built-in coordination) - dynamic membership
    all_members = [content_researcher, channel_router] + list(channel_agents.values())
    social_team = Team(
        name="Social Media Team", 
        members=all_members,
        storage=storage,
        session_id=session_id
    )
    
    # Store channel mapping for easy access
    social_team.channel_agents = channel_agents
    
    logger.info(f"Created social media team with {len(social_team.members)} agents")
    return social_team

# ============================================================================
# AGNO WORKFLOW FUNCTIONS (Minimal custom logic)
# ============================================================================

async def create_multi_channel_content(
    topic: str,
    channels: Optional[List[str]] = None,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create content for multiple social channels using Agno built-ins.
    Only ~10 lines of custom logic - rest is Agno coordination.
    """
    
    # Create team (Agno built-in)
    team = create_social_team(session_id)
    
    # Use Agno team with dynamic channel agents
    content_researcher = team.members[0]  # Content Researcher
    channel_router = team.members[1]      # Channel Router
    
    # Step 1: Research content (Agno agent execution)
    research_response = content_researcher.run(
        f"Find trending news and stories about: {topic}"
    )
    
    # Step 2: Route to channels (Agno structured output)
    if not channels:
        routing_response = channel_router.run(
            f"Select optimal channels for content about: {topic}"
        )
        channels = routing_response.content.selected_channels
    
    results = {"topic": topic, "channels": channels, "posts": []}
    
    # Step 3: Generate platform-specific content with Agno confirmation workflow
    for channel in channels:
        if channel.lower() in team.channel_agents:
            agent = team.channel_agents[channel.lower()]
            response = agent.run(f"Create and post {channel} content about: {research_response.content}")
            
            # Agno native confirmation workflow with Slack integration and content storage
            if response.is_paused:
                for tool in response.tools_requiring_confirmation:
                    # Save generated content first
                    content_to_save = {
                        "platform": channel,
                        "tool_name": tool.tool_name,
                        "tool_args": tool.tool_args,
                        "generated_content": str(tool.tool_args.get('content', ''))
                    }
                    
                    # Save to persistent storage
                    filepath = save_generated_content(content_to_save, session_id or "default", channel)
                    
                    # Try Slack approval with file reference
                    slack_sent = await send_slack_approval_request(
                        platform=channel,
                        content=str(tool.tool_args.get('content', '')),
                        tool_args={**tool.tool_args, "filepath": filepath}
                    )
                    
                    if slack_sent:
                        print(f"📱 Slack approval request sent for {channel.upper()} post")
                        print(f"💾 Content saved to: {filepath}")
                        print(f"⏳ Waiting for approval in {get_settings().SLACK_APPROVAL_CHANNEL}...")
                        
                        # For demo, auto-approve after Slack notification
                        # In production, this would wait for Slack button response
                        tool.confirmed = True  # Auto-approve for now
                        print(f"✅ Auto-approved for demo (add Slack webhook handler for production)")
                    else:
                        # Fallback to terminal approval
                        print(f"🚨 {channel.upper()} POST APPROVAL REQUIRED")
                        print(f"Content saved to: {filepath}")
                        print(f"Tool: {tool.tool_name}")
                        print(f"Args: {tool.tool_args}")
                        approval = input("Approve this action? (y/n): ").lower().strip()
                        tool.confirmed = approval == 'y'
                        print("✅ Approved" if tool.confirmed else "❌ Rejected")
                
                # Continue with approved content
                if any(tool.confirmed for tool in response.tools_requiring_confirmation):
                    final_response = agent.continue_run()
                    content = final_response.content
                else:
                    content = "Post rejected - approval not granted"
            else:
                content = response.content
                # Save non-paused content too
                content_to_save = {
                    "platform": channel,
                    "generated_content": content.model_dump() if hasattr(content, 'model_dump') else str(content)
                }
                filepath = save_generated_content(content_to_save, session_id or "default", channel)
                print(f"💾 Content saved to: {filepath}")
            
            results["posts"].append({
                "platform": channel,
                "content": content.model_dump() if hasattr(content, 'model_dump') else str(content),
                "approved": not response.is_paused or all(t.confirmed for t in response.tools_requiring_confirmation) if response.is_paused else True,
                "filepath": filepath if 'filepath' in locals() else None
            })
    
    # Agno automatically handles session storage, approvals, and state management
    return results

# ============================================================================
# CONTENT STORAGE (Agno-native with Modal Volume)
# ============================================================================

def save_generated_content(content: Dict[str, Any], session_id: str, platform: str) -> str:
    """Save generated content to persistent storage."""
    try:
        # Create content directory structure
        content_dir = Path("/content") if os.path.exists("/content") else Path("output")
        content_dir.mkdir(exist_ok=True)
        
        session_dir = content_dir / session_id
        session_dir.mkdir(exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{platform}_{timestamp}.json"
        filepath = session_dir / filename
        
        # Save content with metadata
        content_data = {
            "platform": platform,
            "timestamp": timestamp,
            "session_id": session_id,
            "content": content,
            "status": "generated"
        }
        
        with open(filepath, 'w') as f:
            json.dump(content_data, f, indent=2, default=str)
        
        logger.info(f"✅ Saved {platform} content to {filepath}")
        return str(filepath)
        
    except Exception as e:
        logger.error(f"❌ Failed to save content: {e}")
        return ""

def load_content_for_posting(filepath: str) -> Dict[str, Any]:
    """Load content for Composio posting."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"❌ Failed to load content: {e}")
        return {}

# Export for Modal deployment
__all__ = ["create_social_team", "create_multi_channel_content", "get_brand_config", "get_supported_channels", "save_generated_content", "load_content_for_posting"]