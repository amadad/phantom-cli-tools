#!/usr/bin/env python3
"""
Simple GiveCare Social Media Pipeline
Brand YAML → Research → Content Generation → Multi-Channel Posting
"""

import os
import yaml
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from agno.agent import Agent
from agno.models.azure import AzureOpenAI
from agno.tools.serpapi import SerpApiTools
from composio_agno import ComposioToolSet, Action

# Import our modular utilities
from utils.media_gen import generate_multimedia_set
from utils.slack_approval import SlackApprovalWorkflow

# ============================================================================
# BRAND CONFIGURATION
# ============================================================================

def load_brand_config(brand_file: str = "brand/givecare.yml") -> Dict[str, Any]:
    """Load brand configuration from YAML."""
    if not os.path.exists(brand_file):
        return {"name": "GiveCare", "voice_tone": "Warm, honest, and empowering"}
    
    with open(brand_file, 'r') as f:
        return yaml.safe_load(f)

# ============================================================================
# CONTENT MODELS
# ============================================================================

class SocialContent(BaseModel):
    """Simple social media content model."""
    platform: str
    content: str
    hashtags: List[str] = []
    image_path: Optional[str] = None
    video_path: Optional[str] = None
    audio_path: Optional[str] = None

class PipelineResult(BaseModel):
    """Pipeline execution result."""
    topic: str
    brand: str
    content: List[SocialContent]
    generated_files: List[str] = []

# ============================================================================
# SIMPLE PIPELINE
# ============================================================================

class SimpleSocialPipeline:
    """Minimal social media pipeline with multimedia and approval."""
    
    def __init__(self):
        self.brand_config = load_brand_config()
        self.azure_model = AzureOpenAI(
            id="gpt-4.5-preview",
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=os.getenv("AZURE_OPENAI_BASE_URL"),
            azure_deployment="gpt-4.5-preview",
            api_version="2025-01-01-preview"
        )
        
        # Initialize approval workflow
        self.approval_workflow = SlackApprovalWorkflow()
        
        # Research Agent
        self.researcher = Agent(
            name="Brand Researcher",
            model=self.azure_model,
            tools=[SerpApiTools(api_key=os.getenv("SERPER_API_KEY"))],
            instructions=[
                f"Research content for {self.brand_config['name']}",
                f"Brand voice: {self.brand_config.get('voice_tone', 'professional')}",
                "Focus on caregiver-relevant stories and insights"
            ]
        )
        
        # Content Creator Agent  
        self.creator = Agent(
            name="Brand Content Creator",
            model=self.azure_model,
            instructions=[
                f"Create {self.brand_config['name']} social content",
                f"Voice: {self.brand_config.get('voice_tone', 'professional')}",
                f"Style: {self.brand_config.get('voice_style', 'conversational')}",
                "Focus on caregiver experiences and support",
                "Keep content authentic and empathetic"
            ],
            response_model=SocialContent
        )
    
    async def run_pipeline(self, topic: str, platforms: List[str] = None, require_approval: bool = True) -> PipelineResult:
        """Run the complete social media pipeline with multimedia and approval."""
        if platforms is None:
            platforms = ["twitter", "linkedin", "youtube"]
        
        print(f"🚀 Running {self.brand_config['name']} pipeline for: {topic}")
        
        # Step 1: Research
        print("📊 Researching content...")
        research = self.researcher.run(f"Find recent news and insights about: {topic}")
        
        # Step 2: Generate multimedia
        print("🎨 Generating multimedia...")
        multimedia = generate_multimedia_set(topic, platforms, self.brand_config)
        
        # Step 3: Generate content for each platform
        print("✍️ Creating platform content...")
        content_list = []
        
        for platform in platforms:
            print(f"  📱 Creating {platform} content...")
            
            # Platform-specific instructions
            platform_instructions = self._get_platform_instructions(platform)
            content_prompt = f"""
            Create {platform} content about: {research.content}
            
            Platform requirements: {platform_instructions}
            Brand: {self.brand_config['name']}
            Voice: {self.brand_config.get('voice_tone', 'professional')}
            
            Make it authentic and focused on caregiver experiences.
            """
            
            content = self.creator.run(content_prompt)
            if content and hasattr(content, 'content'):
                content_obj = content.content
                content_obj.platform = platform
                
                # Add multimedia paths
                content_obj.image_path = multimedia.get("image_path")
                content_obj.video_path = multimedia.get("video_path") if platform in ["youtube", "instagram", "facebook"] else None
                content_obj.audio_path = multimedia.get("audio_path") if platform in ["youtube", "instagram"] else None
                
                # Request approval if required
                if require_approval:
                    print(f"📱 Requesting approval for {platform}...")
                    content_dict = {
                        "content": content_obj.content,
                        "hashtags": content_obj.hashtags,
                        "image_path": content_obj.image_path,
                        "video_path": content_obj.video_path,
                        "audio_path": content_obj.audio_path
                    }
                    approved = await self.approval_workflow.request_approval(content_dict, platform, self.brand_config)
                    if not approved:
                        print(f"❌ {platform} content rejected")
                        continue
                
                content_list.append(content_obj)
        
        # Step 4: Save results
        result = PipelineResult(
            topic=topic,
            brand=self.brand_config['name'],
            content=content_list,
            generated_files=multimedia.get("generated_files", [])
        )
        
        await self._save_results(result)
        return result
    
    def _get_platform_instructions(self, platform: str) -> str:
        """Get platform-specific content guidelines."""
        guidelines = {
            "twitter": "280 chars max, engaging, hashtag-friendly",
            "linkedin": "Professional tone, 3000 chars max, thought leadership",
            "youtube": "Community post, engaging, discussion-starter",
            "instagram": "Visual-first, storytelling, 2200 chars max",
            "facebook": "Conversational, community-focused, shareable"
        }
        return guidelines.get(platform, "Engaging, brand-appropriate content")
    
    async def _save_results(self, result: PipelineResult):
        """Save pipeline results to output directory."""
        output_dir = Path("output")
        output_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        for content in result.content:
            filename = f"{result.brand.lower()}_{content.platform}_{timestamp}.txt"
            filepath = output_dir / filename
            
            with open(filepath, 'w') as f:
                f.write(f"BRAND: {result.brand}\n")
                f.write(f"PLATFORM: {content.platform.upper()}\n")
                f.write(f"TOPIC: {result.topic}\n")
                f.write(f"TIMESTAMP: {timestamp}\n")
                f.write("=" * 50 + "\n\n")
                f.write(f"CONTENT:\n{content.content}\n\n")
                f.write(f"HASHTAGS: {', '.join(content.hashtags)}\n")
                if content.image_path:
                    f.write(f"IMAGE: {content.image_path}\n")
                if content.video_path:
                    f.write(f"VIDEO: {content.video_path}\n")
                if content.audio_path:
                    f.write(f"AUDIO: {content.audio_path}\n")
            
            result.generated_files.append(str(filepath))
            print(f"✅ Saved: {filepath}")

# ============================================================================
# POSTING FUNCTIONS (Simple Composio integration)
# ============================================================================

def post_to_platform(content: SocialContent) -> Dict[str, Any]:
    """Post content to social platform via Composio."""
    try:
        toolset = ComposioToolSet(api_key=os.getenv("COMPOSIO_API_KEY"))
        
        # Platform-specific posting
        if content.platform == "twitter":
            result = toolset.execute_action(
                action=Action.TWITTER_TWEET,
                params={"text": content.content[:280]},
                entity_id=os.getenv("TWITTER_CONNECTION_ID")
            )
        elif content.platform == "linkedin":
            result = toolset.execute_action(
                action=Action.LINKEDIN_CREATE_POST,
                params={"text": content.content[:3000]},
                entity_id=os.getenv("LINKEDIN_CONNECTION_ID")
            )
        elif content.platform == "youtube":
            result = toolset.execute_action(
                action=Action.YOUTUBE_CREATE_POST,
                params={"text": content.content[:8000]},
                entity_id=os.getenv("YOUTUBE_CONNECTION_ID")
            )
        else:
            return {"status": "error", "message": f"Platform {content.platform} not supported"}
        
        return {
            "status": "success" if result.get("successful") else "failed",
            "platform": content.platform,
            "post_id": result.get("data", {}).get("id"),
            "result": result
        }
        
    except Exception as e:
        return {
            "status": "error",
            "platform": content.platform,
            "error": str(e)
        }

# ============================================================================
# CLI & TESTING
# ============================================================================

async def test_pipeline():
    """Test the social media pipeline."""
    pipeline = SimpleSocialPipeline()
    
    # Test with caregiver-focused topic
    topic = "Family caregiver burnout during holiday season"
    platforms = ["twitter", "linkedin", "youtube"]
    
    result = await pipeline.run_pipeline(topic, platforms)
    
    print(f"\n✅ Pipeline completed!")
    print(f"📝 Topic: {result.topic}")
    print(f"🏷️ Brand: {result.brand}")
    print(f"📱 Platforms: {len(result.content)}")
    print(f"📁 Files: {len(result.generated_files)}")
    
    return result

async def run_and_post_pipeline(topic: str, platforms: List[str] = None, auto_post: bool = False, skip_approval: bool = False):
    """Run pipeline and optionally post to social media."""
    pipeline = SimpleSocialPipeline()
    result = await pipeline.run_pipeline(topic, platforms, require_approval=not skip_approval)
    
    if auto_post:
        print(f"\n📤 Posting to social media...")
        for content in result.content:
            post_result = post_to_platform(content)
            status = "✅" if post_result["status"] == "success" else "❌"
            print(f"  {status} {content.platform}: {post_result['status']}")
    else:
        print(f"\n💾 Content saved. Use --post flag to publish.")
    
    return result

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--test":
            asyncio.run(test_pipeline())
        elif sys.argv[1] == "--post":
            topic = sys.argv[2] if len(sys.argv) > 2 else "Family caregiver support and resources"
            asyncio.run(run_and_post_pipeline(topic, auto_post=True, skip_approval=True))
        elif sys.argv[1] == "--no-approval":
            topic = sys.argv[2] if len(sys.argv) > 2 else "Family caregiver support and resources"
            asyncio.run(run_and_post_pipeline(topic, skip_approval=True))
        else:
            topic = sys.argv[1]
            asyncio.run(run_and_post_pipeline(topic))
    else:
        print("Usage:")
        print("  python simple_social_pipeline.py --test")
        print("  python simple_social_pipeline.py 'your topic here'")
        print("  python simple_social_pipeline.py --post 'your topic here'")
        print("  python simple_social_pipeline.py --no-approval 'your topic here'")