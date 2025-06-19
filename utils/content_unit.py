"""
Content Unit module for unified content generation across platforms.
A content unit represents a cohesive piece of content with synchronized text and media.
"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
import hashlib
import json

class MediaRequirements(BaseModel):
    """Media requirements for a content unit."""
    needs_image: bool = True
    needs_video: bool = False
    needs_audio: bool = False
    image_style: Optional[str] = None
    video_length: Optional[int] = None  # seconds
    audio_type: Optional[str] = None  # "background", "voiceover", etc.

class MediaAssets(BaseModel):
    """Generated media assets for a content unit."""
    image_url: Optional[str] = None
    image_path: Optional[str] = None
    video_url: Optional[str] = None
    video_path: Optional[str] = None
    audio_url: Optional[str] = None
    audio_path: Optional[str] = None
    thumbnails: Dict[str, str] = Field(default_factory=dict)
    generation_time: datetime = Field(default_factory=datetime.now)

class PlatformContent(BaseModel):
    """Platform-specific content adaptation."""
    platform: str
    content: str
    hashtags: List[str] = Field(default_factory=list)
    mentions: List[str] = Field(default_factory=list)
    media_types: List[str] = Field(default_factory=list)
    
    @validator('content')
    def validate_content_length(cls, v, values):
        """Validate content length based on platform limits."""
        platform = values.get('platform')
        limits = {
            'twitter': 280,
            'linkedin': 3000,
            'youtube': 8000,
            'facebook': 5000,
            'instagram': 2200
        }
        
        if platform in limits and len(v) > limits[platform]:
            # Truncate with ellipsis if too long
            v = v[:limits[platform] - 3] + '...'
        return v

class ContentUnit(BaseModel):
    """
    A unified content unit that maintains consistency across all platforms.
    This is the core abstraction for content generation.
    """
    # Core content elements
    topic: str
    core_message: str = Field(..., description="The central message/story")
    emotional_tone: str = Field(..., description="Emotional quality of content")
    visual_concept: str = Field(..., description="Visual narrative description")
    key_points: List[str] = Field(..., description="Key points to convey")
    
    # Brand alignment
    brand_name: str
    brand_voice: Dict[str, Any] = Field(default_factory=dict)
    
    # Research context
    research_context: Dict[str, Any] = Field(default_factory=dict)
    source_links: List[str] = Field(default_factory=list)
    
    # Media specifications
    media_requirements: MediaRequirements = Field(default_factory=MediaRequirements)
    visual_prompt: Optional[str] = None
    audio_prompt: Optional[str] = None
    
    # Generated assets
    media_assets: Optional[MediaAssets] = None
    platform_content: Dict[str, PlatformContent] = Field(default_factory=dict)
    
    # Metadata
    unit_id: str = Field(default_factory=lambda: hashlib.md5(
        str(datetime.now().timestamp()).encode()
    ).hexdigest()[:8])
    created_at: datetime = Field(default_factory=datetime.now)
    
    @validator('visual_prompt', always=True)
    def generate_visual_prompt(cls, v, values):
        """Auto-generate visual prompt if not provided."""
        if not v and values.get('visual_concept'):
            brand_name = values.get('brand_name', '')
            visual_concept = values.get('visual_concept', '')
            emotional_tone = values.get('emotional_tone', '')
            
            v = f"{visual_concept}, {emotional_tone} mood, {brand_name} brand style"
        return v
    
    def adapt_for_platform(self, platform: str, platform_config: Dict[str, Any]) -> PlatformContent:
        """
        Adapt the content unit for a specific platform while maintaining core message.
        """
        # Start with core message
        base_content = self.core_message
        
        # Platform-specific adaptations
        if platform == 'twitter':
            # Concise, punchy format
            content = self._adapt_twitter(base_content, platform_config)
        elif platform == 'linkedin':
            # Professional, detailed format
            content = self._adapt_linkedin(base_content, platform_config)
        elif platform == 'youtube':
            # Video script format
            content = self._adapt_youtube(base_content, platform_config)
        else:
            content = base_content
        
        # Extract hashtags and mentions
        hashtags = self._extract_hashtags(content, platform_config)
        mentions = self._extract_mentions(content, platform_config)
        
        # Determine media types
        media_types = platform_config.get('media', ['image'])
        
        return PlatformContent(
            platform=platform,
            content=content,
            hashtags=hashtags,
            mentions=mentions,
            media_types=media_types
        )
    
    def _adapt_twitter(self, content: str, config: Dict[str, Any]) -> str:
        """Adapt content for Twitter's format."""
        # Keep it concise and impactful
        points = " • ".join(self.key_points[:2])  # Use first 2 key points
        
        # Build tweet
        tweet = f"{self.core_message}\n\n{points}"
        
        # Add call to action if space allows
        if len(tweet) < 200:
            tweet += "\n\n💛 Share if this resonates"
        
        return tweet
    
    def _adapt_linkedin(self, content: str, config: Dict[str, Any]) -> str:
        """Adapt content for LinkedIn's professional format."""
        # Professional headline
        headline = f"💡 {self.core_message}\n\n"
        
        # Expand on key points
        body = ""
        for i, point in enumerate(self.key_points, 1):
            body += f"{i}. {point}\n\n"
        
        # Add context from research
        if self.research_context.get('key_insights'):
            body += "Key Insights:\n"
            for insight in self.research_context['key_insights'][:2]:
                body += f"• {insight}\n"
            body += "\n"
        
        # Professional call to action
        cta = "What's your experience? Share your thoughts below."
        
        return headline + body + cta
    
    def _adapt_youtube(self, content: str, config: Dict[str, Any]) -> str:
        """Adapt content for YouTube community post or video description."""
        # Opening hook
        intro = f"🎥 {self.core_message}\n\n"
        
        # Expand for video format
        body = "In today's video, we're discussing:\n\n"
        for point in self.key_points:
            body += f"✓ {point}\n"
        
        # Add engagement prompt
        body += "\n💬 Let us know in the comments: What resonates most with you?"
        
        return intro + body
    
    def _extract_hashtags(self, content: str, config: Dict[str, Any]) -> List[str]:
        """Extract or generate relevant hashtags."""
        hashtag_limit = config.get('hashtag_limit', 5)
        
        # Base hashtags from brand
        hashtags = []
        
        # Add topic-based hashtags
        if 'caregiv' in self.topic.lower():
            hashtags.extend(['#CaregiverSupport', '#CaregivingCommunity'])
        
        # Add emotional tone hashtags
        if 'empower' in self.emotional_tone.lower():
            hashtags.append('#Empowerment')
        
        return hashtags[:hashtag_limit]
    
    def _extract_mentions(self, content: str, config: Dict[str, Any]) -> List[str]:
        """Extract relevant mentions for the platform."""
        # Platform-specific mention logic
        return []
    
    def to_json(self) -> str:
        """Convert to JSON for storage."""
        return self.json(exclude_none=True, indent=2)
    
    @classmethod
    def from_json(cls, json_str: str) -> 'ContentUnit':
        """Create from JSON string."""
        return cls.parse_raw(json_str)

class ContentUnitGenerator:
    """
    Generates unified content units using Agno agents.
    """
    def __init__(self, brand_config: Dict[str, Any], agno_agent):
        self.brand_config = brand_config
        self.agent = agno_agent
        
    async def generate(
        self, 
        topic: str, 
        research_context: Dict[str, Any],
        platforms: List[str]
    ) -> ContentUnit:
        """
        Generate a unified content unit for the given topic and platforms.
        """
        # Determine media requirements based on platforms
        media_reqs = self._determine_media_requirements(platforms)
        
        # Create generation prompt
        prompt = self._create_generation_prompt(topic, research_context, media_reqs)
        
        # Generate content unit using Agno agent
        unit_data = await self.agent.run_async(
            prompt,
            response_model=ContentUnit,
            stream=False
        )
        
        # Enhance with brand config
        unit_data.brand_name = self.brand_config['name']
        unit_data.brand_voice = self.brand_config.get('voice', {})
        unit_data.media_requirements = media_reqs
        unit_data.research_context = research_context
        
        return unit_data
    
    def _determine_media_requirements(self, platforms: List[str]) -> MediaRequirements:
        """Determine what media types are needed based on target platforms."""
        needs_image = any(p in platforms for p in ['twitter', 'linkedin', 'instagram', 'facebook'])
        needs_video = any(p in platforms for p in ['youtube', 'instagram', 'tiktok', 'facebook'])
        needs_audio = any(p in platforms for p in ['youtube', 'tiktok'])
        
        video_length = 60 if 'youtube' in platforms else 30 if 'instagram' in platforms else 15
        
        return MediaRequirements(
            needs_image=needs_image,
            needs_video=needs_video,
            needs_audio=needs_audio,
            video_length=video_length,
            image_style=self.brand_config.get('visual_style', {}).get('primary'),
            audio_type='background' if needs_audio else None
        )
    
    def _create_generation_prompt(
        self, 
        topic: str, 
        research: Dict[str, Any], 
        media_reqs: MediaRequirements
    ) -> str:
        """Create the prompt for content unit generation."""
        return f"""
        Create a unified content unit for our {self.brand_config['name']} brand.
        
        Topic: {topic}
        
        Research Context:
        {json.dumps(research, indent=2)}
        
        Brand Voice:
        - Tone: {self.brand_config.get('voice', {}).get('tone')}
        - Style: {self.brand_config.get('voice', {}).get('style')}
        
        Media Requirements:
        - Needs Image: {media_reqs.needs_image}
        - Needs Video: {media_reqs.needs_video} 
        - Needs Audio: {media_reqs.needs_audio}
        
        Create a cohesive content unit where:
        1. The core message is clear and impactful
        2. The emotional tone aligns with our brand
        3. The visual concept supports the message
        4. Key points can be adapted across platforms
        5. All elements work together harmoniously
        
        Ensure the visual and audio prompts (if needed) align perfectly with the text content.
        """