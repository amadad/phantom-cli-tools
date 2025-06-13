# workflows/social_pipeline.py
import asyncio
import re
import sys
import yaml
import backoff
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any
import httpx

from agno.workflow import Workflow
from agno.utils.log import logger
from agents.story_hunter import StoryHunter, Story
from agents.content_creator import ContentCreator, SocialMediaPost
from agents.media_generator import MediaGenerator, MediaResult
from services.slack_service import SlackService
from utils.config import settings

class SocialPipeline(Workflow):
    """
    Orchestrates the social media content creation workflow.
    
    The pipeline performs the following steps:
    1. Finds relevant stories using StoryHunter
    2. Creates social media posts using ContentCreator
    3. Generates media using MediaGenerator
    4. Saves outputs and sends for approval via Slack
    """
    
    def __init__(self):
        super().__init__()
        # Load brand configuration
        brand_path = Path(__file__).parent.parent / "brand" / "givecare.yml"
        self.brand_cfg = yaml.safe_load(brand_path.read_text())
        
        # Initialize components
        self.hunter = StoryHunter(self.brand_cfg)
        self.writer = ContentCreator(self.brand_cfg)
        self.media = MediaGenerator()
        self.slack = SlackService()
        
        logger.info("Initialized SocialPipeline")

    @backoff.on_exception(backoff.expo, Exception, max_tries=3)
    async def _run_with_retry(self, func, *args, **kwargs):
        """Helper method to retry failed operations."""
        return await func(*args, **kwargs)

    async def _save_outputs(
        self,
        story: Story,
        post: SocialMediaPost,
        media: MediaResult
    ) -> Dict[str, str]:
        """Save generated content to disk."""
        try:
            # Create a filesystem-safe filename
            filename_slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", story.title.lower())[:50]
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            base_filename = f"{timestamp}_{filename_slug}"
            
            # Save image
            img_path = settings.output_paths["images"] / f"{base_filename}.jpg"
            async with httpx.AsyncClient() as client:
                resp = await client.get(media.url)
                resp.raise_for_status()
                img_path.write_bytes(resp.content)
            
            # Save post as markdown
            article_path = settings.output_paths["articles"] / f"{base_filename}.md"
            article_content = (
                f"# {story.title}\n\n"
                f"**Source:** [{story.url}]({story.url})\n\n"
                f"**Summary:** {story.summary}\n\n"
                f"**Post:**\n{post.text}\n\n"
                f"**Hashtags:** {', '.join(f'#{tag}' for tag in post.hashtags)}\n"
            )
            article_path.write_text(article_content)
            
            return {
                "image": str(img_path),
                "article": str(article_path)
            }
            
        except Exception as e:
            logger.error(f"Error saving outputs: {e}")
            raise

    async def execute_pipeline(self, topic: str = "caregiver burnout") -> Dict[str, Any]:
        """
        Execute the social media pipeline for a given topic.
        
        Args:
            topic: The topic to generate content about
            
        Returns:
            Dict containing the results of the pipeline execution with the following structure:
            {
                'status': 'success'|'no_stories'|'error',
                'topic': str,
                'timestamp': str (ISO format),
                'duration_seconds': float,
                'message': str (optional),
                'error': str (optional, only on error),
                'saved_paths': dict (only on success)
            }
        """
        logger.info(f"Starting pipeline for topic: {topic}")
        start_time = datetime.now(timezone.utc)
        
        try:
            # Step 1: Find relevant stories
            logger.info("Searching for stories...")
            try:
                stories = await self._run_with_retry(
                    self.hunter.find,
                    topic=topic,
                    n=3
                )
                
                if not stories:
                    logger.warning("No relevant stories found")
                    end_time = datetime.now(timezone.utc)
                    duration = (end_time - start_time).total_seconds()
                    return {
                        "status": "no_stories",
                        "topic": topic,
                        "timestamp": end_time.isoformat(),
                        "duration_seconds": duration,
                        "message": f"No relevant stories found for topic: {topic}"
                    }
                    
            except Exception as e:
                logger.error(f"Error finding stories: {e}")
                end_time = datetime.now(timezone.utc)
                duration = (end_time - start_time).total_seconds()
                return {
                    "status": "error",
                    "error": str(e),
                    "topic": topic,
                    "timestamp": start_time.isoformat(),
                    "message": f"Error finding stories: {str(e)}",
                    "duration_seconds": duration
                }
            
            # Select the most relevant story
            story = max(stories, key=lambda x: x.relevance_score)
            logger.info(f"Selected story: {story.title}")
            
            # Step 2: Create social media post
            logger.info("Creating social media post...")
            post = await self._run_with_retry(
                self.writer.craft,
                story=story.model_dump(),
                platform="twitter"
            )
            
            # Step 3: Generate media
            logger.info("Generating media...")
            media = await self._run_with_retry(
                self.media.image,
                prompt=f"{story.title} - {story.summary}"
            )
            
            # Step 4: Save outputs
            logger.info("Saving outputs...")
            saved_paths = await self._save_outputs(story, post, media)
            
            # Step 5: Send for approval
            logger.info("Sending for approval...")
            await self._run_with_retry(
                self.slack.post_approval,
                title=story.title,
                text=post.text,
                image_url=media.url
            )
            
            # Calculate duration and get end time
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            # Return success response
            return {
                "status": "success",
                "topic": topic,
                "story": story.model_dump(),
                "post": post.model_dump(),
                "media": media.model_dump(),
                "saved_paths": saved_paths,
                "timestamp": end_time.isoformat(),
                "duration_seconds": duration
            }
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}", exc_info=True)
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            return {
                "status": "error",
                "error": str(e),
                "topic": topic,
                "timestamp": end_time.isoformat(),
                "duration_seconds": duration,
                "message": f"Pipeline failed: {str(e)}"
            }

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Run the social media content pipeline.')
    parser.add_argument('--topic', type=str, default='caregiver burnout',
                      help='Topic for content generation (default: caregiver burnout)')
    args = parser.parse_args()
    
    pipeline = SocialPipeline()
    
    try:
        print(f"🚀 Starting social pipeline with topic: {args.topic}")
        result = asyncio.run(pipeline.execute_pipeline(args.topic))
        
        duration = result.get('duration_seconds', 0)
        
        if result["status"] == "success":
            print(f"✅ Pipeline completed successfully in {duration:.2f}s")
            story = result.get('story', {})
            post = result.get('post', {})
            print(f"📰 Story: {story.get('title', 'No title')}")
            print(f"📱 Post: {post.get('text', 'No text')[:100]}...")
            if 'saved_paths' in result:
                print(f"💾 Saved to: {result['saved_paths'].get('image', 'No image')}")
        elif result["status"] == "no_stories":
            print(f"⚠️  No stories found in {duration:.2f}s")
        elif result["status"] == "error":
            print(f"❌ Pipeline failed after {duration:.2f}s: {result.get('error', 'Unknown error')}")
            sys.exit(1)
            
    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
        sys.exit(1)