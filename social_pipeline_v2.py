#!/usr/bin/env python3
"""
Optimized Social Media Pipeline v2 with Content Unit Architecture.
Leverages Agno's built-in features and parallel processing for performance.
"""
import os
import asyncio
import json
import yaml
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from agno import Agent, Team, Storage
from agno.models import AzureOpenAI
from agno.tools import SerpApiTools, Toolkit
from pydantic import BaseModel, Field

from utils.content_unit import ContentUnit, ContentUnitGenerator, PlatformContent
from utils.media_gen_parallel import generate_multimedia_set_async
from utils.slack_approval import SlackApprovalWorkflow

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ResearchResult(BaseModel):
    """Research results from news and trends."""
    stories: List[Dict[str, Any]] = Field(description="Relevant news stories")
    key_insights: List[str] = Field(description="Key insights from research")
    trending_topics: List[str] = Field(description="Current trending topics")
    source_links: List[str] = Field(description="Source URLs")

class PipelineResult(BaseModel):
    """Result from pipeline execution."""
    topic: str
    brand: str
    content_unit: ContentUnit
    platform_content: Dict[str, PlatformContent]
    generated_files: List[str]
    approval_status: Dict[str, bool] = Field(default_factory=dict)
    post_results: Dict[str, Any] = Field(default_factory=dict)

class OptimizedSocialPipeline:
    """
    Optimized social media pipeline using Content Units and Agno's built-in features.
    """
    
    def __init__(self, brand_config_path: str = "brand/givecare.yml", storage_path: str = None):
        """Initialize pipeline with brand configuration."""
        # Load brand config
        self.brand_config = self._load_brand_config(brand_config_path)
        self.brand_name = self.brand_config['name']
        
        # Initialize storage (use Agno's built-in storage)
        if storage_path:
            self.storage = Storage(path=storage_path)
        else:
            self.storage = None
        
        # Initialize Azure OpenAI model
        self.azure_model = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            base_url=os.getenv("AZURE_OPENAI_BASE_URL"),
            deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        )
        
        # Create specialized agents with Agno's built-in features
        self._create_agents()
        
        # Initialize approval workflow
        self.approval_workflow = SlackApprovalWorkflow()
        
        # Create output directory
        self.output_dir = Path("output")
        self.output_dir.mkdir(exist_ok=True)
    
    def _load_brand_config(self, config_path: str) -> Dict[str, Any]:
        """Load brand configuration from YAML file."""
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        # Ensure required fields
        required_fields = ['name', 'voice', 'content_units', 'platforms']
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Brand config missing required field: {field}")
        
        return config
    
    def _create_agents(self):
        """Create specialized agents with Agno's built-in capabilities."""
        # Research agent with built-in retry and tool management
        self.research_agent = Agent(
            name=f"{self.brand_name}_researcher",
            model=self.azure_model,
            tools=[SerpApiTools(api_key=os.getenv("SERPER_API_KEY"))],
            tool_call_limit=3,  # Built-in retry logic
            enable_agentic_memory=True,  # Use Agno's memory features
            storage=self.storage,
            response_model=ResearchResult,
            instructions=[
                f"You are a research specialist for {self.brand_name}.",
                f"Find recent, relevant news and stories about the given topic.",
                f"Focus on: {', '.join(self.brand_config.get('topics', []))}",
                "Prioritize human interest stories and actionable insights.",
                "Return structured research results."
            ]
        )
        
        # Content unit generator with structured output
        self.content_agent = Agent(
            name=f"{self.brand_name}_content_creator",
            model=self.azure_model,
            enable_agentic_memory=True,
            storage=self.storage,
            response_model=ContentUnit,
            instructions=[
                f"You are the content creator for {self.brand_name}.",
                f"Brand voice: {self.brand_config['voice']}",
                f"Content style: {self.brand_config.get('content_units', {}).get('style', '')}",
                "Create cohesive content units with aligned text and visual concepts.",
                "Ensure all elements support the core message.",
                "Generate content that resonates emotionally with our audience."
            ]
        )
        
        # Create agent team for parallel operations
        self.pipeline_team = Team(
            name=f"{self.brand_name}_pipeline_team",
            agents=[self.research_agent, self.content_agent],
            storage=self.storage,
            parallel=True  # Enable parallel execution
        )
    
    async def run_pipeline(
        self, 
        topic: str, 
        platforms: List[str] = None,
        require_approval: bool = True
    ) -> PipelineResult:
        """
        Run the optimized pipeline with parallel processing.
        """
        if platforms is None:
            platforms = list(self.brand_config['platforms'].keys())
        
        logger.info(f"🚀 Starting {self.brand_name} pipeline for topic: {topic}")
        logger.info(f"📱 Target platforms: {platforms}")
        
        try:
            # Step 1: Research (using Agno's built-in features)
            logger.info("🔍 Researching topic...")
            research = await self.research_agent.run_async(
                f"Find recent news and insights about: {topic}",
                stream=False
            )
            
            # Step 2: Generate Content Unit (unified content generation)
            logger.info("✍️ Creating unified content unit...")
            content_generator = ContentUnitGenerator(self.brand_config, self.content_agent)
            content_unit = await content_generator.generate(
                topic, 
                research.dict() if hasattr(research, 'dict') else research,
                platforms
            )
            
            # Step 3: Generate media assets in parallel
            logger.info("🎨 Generating media assets...")
            media_task = asyncio.create_task(
                generate_multimedia_set_async(
                    content_unit.visual_prompt,
                    platforms,
                    self.brand_config,
                    audio_prompt=content_unit.audio_prompt
                )
            )
            
            # Step 4: Adapt content for platforms in parallel
            logger.info("📝 Adapting content for platforms...")
            platform_tasks = []
            for platform in platforms:
                platform_config = self.brand_config['platforms'].get(platform, {})
                task = asyncio.create_task(
                    self._adapt_content_for_platform(content_unit, platform, platform_config)
                )
                platform_tasks.append(task)
            
            # Wait for parallel tasks
            media_assets, platform_contents = await asyncio.gather(
                media_task,
                asyncio.gather(*platform_tasks)
            )
            
            # Update content unit with media assets
            content_unit.media_assets = media_assets
            
            # Convert platform contents to dict
            platform_content_dict = {
                pc.platform: pc for pc in platform_contents
            }
            
            # Step 5: Save content unit
            generated_files = await self._save_content_unit(content_unit, platform_content_dict)
            
            # Step 6: Request approval if required
            approval_status = {}
            if require_approval:
                logger.info("👁️ Requesting approval...")
                for platform, content in platform_content_dict.items():
                    approved = await self.approval_workflow.request_approval(
                        content=content.content,
                        platform=platform,
                        media=media_assets,
                        brand=self.brand_name
                    )
                    approval_status[platform] = approved
            else:
                approval_status = {p: True for p in platforms}
            
            # Step 7: Post approved content
            post_results = {}
            if any(approval_status.values()):
                logger.info("📤 Posting approved content...")
                post_results = await self._post_approved_content(
                    platform_content_dict, 
                    approval_status,
                    media_assets
                )
            
            # Create pipeline result
            result = PipelineResult(
                topic=topic,
                brand=self.brand_name,
                content_unit=content_unit,
                platform_content=platform_content_dict,
                generated_files=generated_files,
                approval_status=approval_status,
                post_results=post_results
            )
            
            logger.info(f"✅ Pipeline completed successfully!")
            return result
            
        except Exception as e:
            logger.error(f"❌ Pipeline failed: {str(e)}")
            raise
    
    async def _adapt_content_for_platform(
        self, 
        content_unit: ContentUnit,
        platform: str,
        platform_config: Dict[str, Any]
    ) -> PlatformContent:
        """Adapt content unit for specific platform."""
        try:
            # Use content unit's built-in adaptation
            platform_content = content_unit.adapt_for_platform(platform, platform_config)
            
            # Add any platform-specific enhancements
            if platform == "twitter" and not platform_content.hashtags:
                # Add default hashtags if none generated
                platform_content.hashtags = ["#" + self.brand_name, "#CaregiverSupport"]
            
            return platform_content
            
        except Exception as e:
            logger.error(f"Error adapting content for {platform}: {str(e)}")
            raise
    
    async def _save_content_unit(
        self, 
        content_unit: ContentUnit,
        platform_content: Dict[str, PlatformContent]
    ) -> List[str]:
        """Save content unit and platform adaptations."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_filename = f"{self.brand_name}_{content_unit.unit_id}_{timestamp}"
        
        files = []
        
        # Save content unit as JSON
        unit_path = self.output_dir / f"{base_filename}_unit.json"
        with open(unit_path, 'w') as f:
            f.write(content_unit.to_json())
        files.append(str(unit_path))
        
        # Save platform-specific content
        for platform, content in platform_content.items():
            platform_path = self.output_dir / f"{base_filename}_{platform}.json"
            with open(platform_path, 'w') as f:
                json.dump(content.dict(), f, indent=2)
            files.append(str(platform_path))
        
        logger.info(f"💾 Saved {len(files)} files to {self.output_dir}")
        return files
    
    async def _post_approved_content(
        self,
        platform_content: Dict[str, PlatformContent],
        approval_status: Dict[str, bool],
        media_assets: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Post approved content to platforms."""
        # This would integrate with Composio or direct platform APIs
        # For now, return mock results
        results = {}
        for platform, approved in approval_status.items():
            if approved:
                results[platform] = {
                    "status": "posted",
                    "post_id": f"mock_{platform}_12345",
                    "timestamp": datetime.now().isoformat()
                }
        return results

async def run_and_test_pipeline(
    topic: str = "Family caregiver support and wellness",
    platforms: List[str] = None,
    auto_post: bool = False
):
    """Run the pipeline with test configuration."""
    if platforms is None:
        platforms = ["twitter", "linkedin", "youtube"]
    
    pipeline = OptimizedSocialPipeline()
    result = await pipeline.run_pipeline(
        topic=topic,
        platforms=platforms,
        require_approval=not auto_post
    )
    
    return result

if __name__ == "__main__":
    # Run the pipeline locally for testing
    asyncio.run(run_and_test_pipeline())