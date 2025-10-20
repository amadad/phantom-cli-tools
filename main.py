#!/usr/bin/env python3
"""
Agent Social - Standalone Application
Run locally or in Docker without Modal dependencies.
"""

import os
import asyncio
import yaml
import schedule
import time
from datetime import datetime
from typing import Optional, List, Dict, Any
import argparse
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import pipeline modules (clear separation of concerns)
from pipeline.content import generate_platform_content, get_topic_from_rotation, save_content_results, post_to_platforms, save_posting_results
from pipeline.media import generate_visual_prompt, generate_brand_image_with_mode
from pipeline.approval import TelegramApprovalWorkflow
from pipeline.discovery import discover_stories_for_topic
from pipeline.evaluation import evaluate_content


class AgentSocial:
    """Main application class for Agent Social."""
    
    def __init__(self, brand_config_path: str = "brands/givecare.yml"):
        """Initialize the Agent Social application."""
        self.brand_config_path = Path(brand_config_path)
        self.load_brand_config()
        self.ensure_directories()
        
    def load_brand_config(self):
        """Load brand configuration from YAML file."""
        if not self.brand_config_path.exists():
            raise FileNotFoundError(f"Brand config not found: {self.brand_config_path}")
            
        with open(self.brand_config_path, "r") as f:
            self.brand_config = yaml.safe_load(f)
            
        self.brand_name = self.brand_config.get("name", "Brand")
        logger.info(f"Loaded brand config: {self.brand_name}")
        
    def ensure_directories(self):
        """Ensure required directories exist."""
        directories = ["output", "output/images", "output/content"]
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
            
    async def run_pipeline(
        self,
        topic: Optional[str] = None,
        platforms: List[str] = None,
        auto_post: bool = False,
        use_story_discovery: bool = True,
        generate_image: bool = True
    ) -> Dict[str, Any]:
        """
        Run the social media content pipeline.
        
        Args:
            topic: Content topic (uses rotation if None)
            platforms: List of platforms to post to
            auto_post: Whether to post without approval
            use_story_discovery: Whether to search for relevant stories
            generate_image: Whether to generate images
            
        Returns:
            Dictionary with pipeline results
        """
        start_time = datetime.now()
        
        # Default platforms
        if platforms is None:
            platforms = ["twitter", "linkedin"]
            
        # Get topic from rotation if not provided
        if topic is None:
            topic = get_topic_from_rotation(self.brand_config)
            
        logger.info(f"🚀 Running pipeline for topic: {topic}")
        logger.info(f"📱 Platforms: {platforms}")
        
        results = {
            "topic": topic,
            "platforms": platforms,
            "brand": self.brand_name,
            "timestamp": start_time.isoformat(),
            "success": False
        }
        
        try:
            # Step 1: Story Discovery (optional)
            stories = []
            if use_story_discovery:
                logger.info("🔍 Discovering relevant stories...")
                try:
                    stories = await discover_stories_for_topic(
                        topic, 
                        self.brand_config, 
                        max_stories=3
                    )
                    if stories:
                        logger.info(f"📰 Found {len(stories)} relevant stories")
                        results["stories"] = stories
                except Exception as e:
                    logger.warning(f"Story discovery failed: {e}")
                    
            # Step 2: Generate Content
            logger.info("📝 Generating content for platforms...")
            content = await generate_platform_content(
                topic=topic,
                platforms=platforms,
                brand_config=self.brand_config,
                has_image=generate_image
            )
            results["content"] = content
            
            # Step 3: Generate Image (optional)
            image_url = None
            if generate_image:
                logger.info("🎨 Generating image...")
                try:
                    # Generate visual prompt
                    visual_prompt = await generate_visual_prompt(topic, self.brand_config)
                    
                    # Generate image
                    image_url = await generate_brand_image_with_mode(
                        visual_prompt=visual_prompt,
                        topic=topic,
                        brand_config=self.brand_config
                    )
                    
                    if image_url:
                        logger.info(f"✅ Image generated: {image_url}")
                        results["image_url"] = image_url
                except Exception as e:
                    logger.warning(f"Image generation failed: {e}")
                    
            # Step 4: Content Evaluation
            logger.info("📊 Evaluating content quality...")
            evaluation_scores = {}
            for platform, platform_content in content.items():
                score = evaluate_content(platform_content, self.brand_config)
                evaluation_scores[platform] = score
                logger.info(f"  {platform}: {score:.2f}/1.0")
            results["evaluation_scores"] = evaluation_scores
            
            # Step 5: Save content locally
            output_file = save_content_results(
                content=content,
                topic=topic,
                brand_name=self.brand_name,
                image_url=image_url,
                visual_prompt=visual_prompt if generate_image else None,
                platforms=platforms,
                storage_path="output/content"
            )
            results["output_file"] = output_file
            
            # Step 6: Approval and Posting
            if not auto_post:
                logger.info("🤔 Requesting approval...")
                approved = await self.request_approval(content, image_url)
                results["approved"] = approved
                
                if not approved:
                    logger.info("❌ Content not approved")
                    results["success"] = True  # Pipeline succeeded, just not approved
                    return results
            else:
                logger.info("🤖 Auto-posting enabled")
                results["approved"] = True
                
            # Step 7: Post to platforms
            logger.info("📤 Posting to platforms...")
            post_results = await post_to_platforms(
                content, 
                self.brand_config, 
                image_url
            )
            
            # Save posting results
            save_posting_results(post_results, "output")
            results["post_results"] = post_results
            results["success"] = True
            
            # Calculate total time
            duration = (datetime.now() - start_time).total_seconds()
            results["duration_seconds"] = duration
            logger.info(f"✅ Pipeline completed in {duration:.1f} seconds")
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}", exc_info=True)
            results["error"] = str(e)
            
        return results
        
    async def request_approval(
        self, 
        content: Dict[str, str], 
        image_url: Optional[str] = None
    ) -> bool:
        """Request approval via Telegram."""
        try:
            workflow = TelegramApprovalWorkflow()
            
            # Request approval for each platform
            all_approved = True
            for platform, platform_content in content.items():
                approved = await workflow.request_approval(
                    content={
                        "content": platform_content,
                        "platform": platform,
                        "image_url": image_url
                    },
                    platform=platform,
                    brand_config=self.brand_config
                )
                
                if not approved:
                    all_approved = False
                    logger.info(f"❌ {platform} content rejected")
                else:
                    logger.info(f"✅ {platform} content approved")
                    
            return all_approved
            
        except Exception as e:
            logger.error(f"Approval workflow failed: {e}")
            # Could fall back to Slack here
            return False
            
    def schedule_pipeline(self, hours: int = 6):
        """Schedule the pipeline to run every N hours."""
        logger.info(f"📅 Scheduling pipeline to run every {hours} hours")
        
        async def run_scheduled():
            logger.info(f"⏰ Running scheduled pipeline at {datetime.now()}")
            await self.run_pipeline(auto_post=False)
            
        # Schedule the job
        schedule.every(hours).hours.do(
            lambda: asyncio.run(run_scheduled())
        )
        
        # Run the scheduler
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute


async def main():
    """Main entry point for the application."""
    parser = argparse.ArgumentParser(description="Agent Social - Automated Social Media Pipeline")
    parser.add_argument("--topic", help="Content topic (uses rotation if not provided)")
    parser.add_argument("--platforms", default="twitter,linkedin", help="Comma-separated platforms")
    parser.add_argument("--auto-post", action="store_true", help="Post without approval")
    parser.add_argument("--no-image", action="store_true", help="Skip image generation")
    parser.add_argument("--no-stories", action="store_true", help="Skip story discovery")
    parser.add_argument("--schedule", type=int, help="Run every N hours")
    parser.add_argument("--brand-config", default="brands/givecare.yml", help="Brand config file")
    
    args = parser.parse_args()
    
    # Initialize application
    app = AgentSocial(brand_config_path=args.brand_config)
    
    # Run scheduled or one-time
    if args.schedule:
        app.schedule_pipeline(hours=args.schedule)
    else:
        # Parse platforms
        platforms = [p.strip() for p in args.platforms.split(",")]
        
        # Run pipeline once
        results = await app.run_pipeline(
            topic=args.topic,
            platforms=platforms,
            auto_post=args.auto_post,
            use_story_discovery=not args.no_stories,
            generate_image=not args.no_image
        )
        
        # Print summary
        print("\n📊 Pipeline Results:")
        print(f"   Topic: {results['topic']}")
        print(f"   Success: {results['success']}")
        print(f"   Duration: {results.get('duration_seconds', 0):.1f}s")
        
        if results.get("error"):
            print(f"   Error: {results['error']}")


if __name__ == "__main__":
    # Load environment variables from .env file
    from dotenv import load_dotenv
    load_dotenv()
    
    # Check required environment variables
    required_vars = [
        "OPENAI_API_KEY",
        "SERP_API_KEY",
        "REPLICATE_API_TOKEN"
    ]

    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
        logger.error("Please set them in .env file or environment")
        exit(1)
        
    # Run the application
    asyncio.run(main())