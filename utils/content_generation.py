"""
Content generation utilities for social media platforms.
Uses Agno 1.7.1 with structured outputs for consistency.
"""
import os
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from agno.agent import Agent
from agno.models.azure import AzureOpenAI


class PlatformContent(BaseModel):
    """Content for a specific social media platform."""
    platform: str = Field(description="Platform name (twitter, linkedin, etc.)")
    content: str = Field(description="The actual content text")
    hashtags: List[str] = Field(default_factory=list, description="Relevant hashtags")
    char_count: int = Field(description="Character count of the content")
    has_cta: bool = Field(default=False, description="Whether content includes call-to-action")


class ContentGenerationResult(BaseModel):
    """Result of content generation across platforms."""
    topic: str = Field(description="The topic or theme of the content")
    twitter_content: str = Field(description="Content for Twitter")
    linkedin_content: str = Field(description="Content for LinkedIn")  
    visual_prompt: str = Field(description="Prompt for image generation")
    brand_alignment_score: float = Field(default=0.9, description="How well content aligns with brand voice (0-1)")


# Extended result for backward compatibility
class ExtendedContentResult(ContentGenerationResult):
    """Extended result with platform content structure."""
    platforms: Dict[str, PlatformContent] = Field(default_factory=dict)


def create_content_agent(brand_config: Dict[str, Any]) -> Agent:
    """Create an AI agent for content generation with Agno 1.7.1 patterns."""
    brand_name = brand_config.get("name", "GiveCare")
    voice = brand_config.get("voice", {})
    topics = brand_config.get("topics", [])
    
    # Build comprehensive instructions
    instructions = [
        f"You are a content creator for {brand_name}, a brand focused on supporting caregivers.",
        f"Brand voice: {voice.get('tone', 'empathetic, supportive, hopeful')}",
        f"Writing style: {voice.get('style', 'conversational, inclusive, authentic')}",
        "",
        "Content Guidelines:",
        "- Create engaging social media content that resonates with caregivers",
        "- Keep content authentic, empathetic, and supportive",
        "- Include relevant hashtags for each platform",
        "- Adapt tone and format appropriately for each platform",
        "- Focus on human stories and practical support",
        "",
        f"Key topics to cover: {', '.join(topics)}",
        "",
        "Platform-specific requirements:",
        "- Twitter/X: Concise, impactful, 280 chars max",
        "- LinkedIn: Professional yet warm, can be longer",
        "- Instagram: Visual-first, emoji-friendly",
        "- Facebook: Community-focused, conversational"
    ]
    
    # Configure Azure OpenAI model properly
    model = AzureOpenAI(
        azure_deployment=os.getenv("AZURE_OPENAI_DEFAULT_MODEL", "gpt-4.5-preview"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    )
    
    return Agent(
        name=f"{brand_name}_content_creator",
        model=model,
        instructions=instructions,
        response_model=ContentGenerationResult  # Structured output
    )


async def generate_content_for_platforms(
    topic: str, 
    platforms: List[str], 
    brand_config: Dict[str, Any],
    has_image: bool = False,
    story_context: Optional[Dict[str, Any]] = None
) -> ContentGenerationResult:
    """Generate content for multiple platforms with structured output."""
    
    agent = create_content_agent(brand_config)
    
    # Build enhanced prompt with story context if available
    prompt_parts = [
        f"Create social media content about: {topic}",
        ""
    ]
    
    if story_context:
        prompt_parts.extend([
            "Inspired by this news story:",
            f"Title: {story_context.get('title', '')}",
            f"Summary: {story_context.get('description', '')}",
            ""
        ])
    
    prompt_parts.extend([
        f"Generate content for these platforms: {', '.join(platforms)}",
        "",
        "Requirements:",
        "- Create engaging Twitter content (max 280 characters)",
        "- Create professional LinkedIn content (can be longer)",
        "- Include relevant hashtags for caregiving community",
        "- Ensure content aligns with brand voice",
        f"- {'Consider that an image will accompany the post' if has_image else 'Text-only post'}",
        "",
        "Also create a detailed visual prompt for image generation that would complement this content."
    ])
    
    prompt = "\n".join(prompt_parts)
    
    try:
        print(f"🚀 Generating content for {len(platforms)} platforms...")
        
        # Use .arun() with response_model for structured output
        response = await agent.arun(prompt)
        result = response.content if hasattr(response, 'content') else response
        
        # The result is already typed as ContentGenerationResult
        print(f"✅ Generated content for all platforms")
        
        # Convert simplified result to full structure for backward compatibility
        platforms_dict = {}
        if hasattr(result, 'twitter_content'):
            platforms_dict['twitter'] = PlatformContent(
                platform='twitter',
                content=result.twitter_content,
                hashtags=['caregiving', 'support', 'community'],
                char_count=len(result.twitter_content)
            )
        if hasattr(result, 'linkedin_content'):
            platforms_dict['linkedin'] = PlatformContent(
                platform='linkedin', 
                content=result.linkedin_content,
                hashtags=['caregiving', 'support', 'community'],
                char_count=len(result.linkedin_content)
            )
        
        # Create extended result with platform content structure
        enhanced_result = ExtendedContentResult(
            topic=result.topic,
            twitter_content=result.twitter_content if hasattr(result, 'twitter_content') else "",
            linkedin_content=result.linkedin_content if hasattr(result, 'linkedin_content') else "",
            visual_prompt=result.visual_prompt if hasattr(result, 'visual_prompt') else "",
            brand_alignment_score=result.brand_alignment_score if hasattr(result, 'brand_alignment_score') else 0.9,
            platforms=platforms_dict
        )
        
        return enhanced_result
        
    except Exception as e:
        print(f"❌ Failed to generate content: {e}")
        
        # Return fallback content
        fallback_platforms = {}
        for platform in platforms:
            fallback_platforms[platform] = PlatformContent(
                platform=platform,
                content=f"Sharing insights about {topic} with our caregiver community. 💙",
                hashtags=["caregiving", "support", "community"],
                char_count=60,
                has_cta=False
            )
        
        return ExtendedContentResult(
            topic=topic,
            twitter_content=f"Sharing insights about {topic} with our caregiver community. 💙",
            linkedin_content=f"Sharing insights about {topic} with our caregiver community. 💙", 
            visual_prompt=f"Supportive caregiving community illustration about {topic}",
            platforms=fallback_platforms,
            brand_alignment_score=0.5
        )


async def generate_platform_content(
    topic: str, 
    platforms: List[str], 
    brand_config: Dict[str, Any],
    has_image: bool = False,
    story_context: Optional[Dict[str, Any]] = None
) -> Dict[str, str]:
    """
    Legacy wrapper for backward compatibility.
    Returns simple dict of platform->content mappings.
    """
    result = await generate_content_for_platforms(
        topic=topic,
        platforms=platforms,
        brand_config=brand_config,
        has_image=has_image,
        story_context=story_context
    )
    
    # Convert to simple dict format for compatibility
    content = {}
    for platform, platform_content in result.platforms.items():
        # Include hashtags in the content
        full_content = platform_content.content
        if platform_content.hashtags:
            hashtag_str = " ".join(f"#{tag}" for tag in platform_content.hashtags)
            full_content = f"{full_content}\n\n{hashtag_str}"
        content[platform] = full_content
    
    return content


def get_topic_from_rotation(brand_config: Dict[str, Any], hour: int = None) -> str:
    """Get topic based on rotation schedule."""
    from datetime import datetime
    
    topics = brand_config.get("topics", ["Caregiver support"])
    if hour is None:
        hour = datetime.now().hour
    
    topic_index = (hour // 6) % len(topics)
    return topics[topic_index]


def save_content_results(
    content: Dict[str, str], 
    topic: str,
    brand_name: str,
    image_url: str = None,
    visual_prompt: str = None,
    platforms: List[str] = None,
    storage_path: str = "/storage",
    structured_result: Optional[ContentGenerationResult] = None
) -> str:
    """Save generated content to storage with enhanced metadata."""
    import json
    from datetime import datetime
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"{storage_path}/{brand_name}_{timestamp}.json"
    
    result_data = {
        "topic": topic,
        "brand": brand_name,
        "content": content,
        "image_url": image_url,
        "visual_prompt": visual_prompt,
        "timestamp": datetime.now().isoformat(),
        "platforms": platforms or list(content.keys()),
        "generation_metadata": {
            "has_image": image_url is not None,
            "platform_count": len(content),
            "total_chars": sum(len(c) for c in content.values())
        }
    }
    
    # Include structured result if available
    if structured_result:
        try:
            # Convert Pydantic models to dict for JSON serialization
            platforms_dict = {}
            if hasattr(structured_result, 'platforms'):
                for p, pc in structured_result.platforms.items():
                    platforms_dict[p] = {
                        "content": pc.content,
                        "hashtags": pc.hashtags,
                        "char_count": pc.char_count,
                        "has_cta": pc.has_cta
                    }
            
            result_data["structured_content"] = {
                "platforms": platforms_dict,
                "brand_alignment_score": getattr(structured_result, 'brand_alignment_score', 0.9),
                "visual_prompt": getattr(structured_result, 'visual_prompt', ''),
                "twitter_content": getattr(structured_result, 'twitter_content', ''),
                "linkedin_content": getattr(structured_result, 'linkedin_content', '')
            }
        except Exception as e:
            print(f"⚠️ Could not serialize structured content: {e}")
            # Just include basic info
            result_data["structured_content"] = {
                "error": "Could not serialize structured content",
                "type": str(type(structured_result))
            }
    
    try:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(result_data, f, indent=2)
        
        print(f"💾 Saved content to {output_file}")
        return output_file
    except Exception as e:
        print(f"❌ Failed to save content: {e}")
        return ""


# Import the actual social posting function
from .social_posting import post_to_platforms as composio_post_to_platforms

async def post_to_platforms(content: Dict[str, str], brand_config: Dict[str, Any], image_url: str = None, dry_run: bool = False) -> Dict[str, Dict]:
    """Post content to social platforms using Composio."""
    if dry_run:
        print("📱 Social posting (dry run mode)")
        results = {}
        for platform, text in content.items():
            results[platform] = {
                "success": True,
                "platform": platform,
                "content": text,
                "image_url": image_url,
                "dry_run": dry_run
            }
            print(f"  ✅ {platform}: Content ready")
        return results
    
    # Use actual Composio posting
    return await composio_post_to_platforms(content, brand_config, image_url)


def save_posting_results(results: Dict, output_dir: str) -> None:
    """Save posting results to file."""
    import json
    from datetime import datetime
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"{output_dir}/posting_results_{timestamp}.json"
    
    try:
        os.makedirs(output_dir, exist_ok=True)
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
        print(f"💾 Saved posting results to {results_file}")
    except Exception as e:
        print(f"❌ Failed to save posting results: {e}")