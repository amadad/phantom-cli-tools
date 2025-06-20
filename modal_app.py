#!/usr/bin/env python3
"""
Optimized Modal Deployment for Social Pipeline v2.
Leverages Modal's performance features and persistent storage.
"""

import modal
from pathlib import Path

# Create Modal app with optimizations
app = modal.App(
    "social-pipeline-v2",
    secrets=[
        modal.Secret.from_name("azure-openai-secrets"),
        modal.Secret.from_name("serper-api-key"),
        modal.Secret.from_name("composio-secrets"),
        modal.Secret.from_name("slack-secrets"),
        modal.Secret.from_name("media-api-keys"),  # Replicate, Sonauto
    ]
)

# Create persistent volume for storage
storage_volume = modal.Volume.from_name("social-pipeline-storage", create_if_missing=True)

# Optimized image with caching and pre-built dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install_from_requirements("requirements.txt")
    # Pre-install heavy dependencies
    .pip_install("torch", "torchvision", "torchaudio", gpu="t4")  # If using AI models
    .run_commands([
        "mkdir -p /app/cache/agno",
        "mkdir -p /app/cache/media"
    ])
    # Add application files
    .add_local_file("social_pipeline_v2.py", remote_path="/app/social_pipeline_v2.py")
    .add_local_dir("utils/", remote_path="/app/utils/")
    .add_local_dir("brand/", remote_path="/app/brand/")
)

# Class-based deployment for connection reuse and warm starts
@app.cls(
    image=image,
    volumes={
        "/storage": storage_volume  # Single mount path for persistent storage
    },
    gpu="t4",  # GPU for faster AI operations
    min_containers=1,  # Keep 1 instance warm
    scaledown_window=300,  # 5 minutes idle timeout
    timeout=1800,  # 30 minutes max execution
    retries=2,  # Automatic retries on failure
    cpu=2.0,  # 2 CPU cores
    memory=4096,  # 4GB RAM
)
class SocialPipelineService:
    """
    Persistent service class for optimal performance.
    Connections and agents are initialized once and reused.
    """
    
    def __init__(self):
        """Initialize pipeline once when container starts."""
        import sys
        sys.path.append("/app")
        
        from social_pipeline_v2 import OptimizedSocialPipeline
        
        # Create storage subdirectories
        import os
        os.makedirs("/storage/output", exist_ok=True)
        os.makedirs("/storage/cache", exist_ok=True)
        
        # Initialize with persistent storage
        self.pipeline = OptimizedSocialPipeline(
            brand_config_path="/app/brand/givecare.yml",
            storage_path="/storage/agno.db"
        )
        
        # Pre-warm the agents
        print("🚀 Pre-warming agents and connections...")
        # Agent initialization happens in pipeline __init__
        
        self.topics = [
            "Family caregiver burnout and self-care strategies",
            "Navigating healthcare systems as a family caregiver",
            "Building resilient support networks for caregivers",
            "Caregiver wellness during challenging times",
            "Technology tools for modern caregiving",
            "Financial planning for family caregivers",
            "Balancing work and caregiving responsibilities",
            "Mental health resources for caregivers"
        ]
    
    @modal.method()
    async def run_pipeline(
        self,
        topic: str = None,
        platforms: list = None,
        auto_post: bool = False
    ):
        """
        Run the social media pipeline.
        
        Args:
            topic: Topic to generate content for (uses rotation if not provided)
            platforms: List of platforms (defaults to all configured)
            auto_post: Whether to auto-approve and post
        """
        import datetime
        
        if platforms is None:
            platforms = ["twitter", "linkedin", "youtube"]
        
        # Use topic rotation if not specified
        if topic is None:
            hour = datetime.datetime.now().hour
            topic_index = (hour // 6) % len(self.topics)
            topic = self.topics[topic_index]
        
        print(f"📝 Running pipeline for: {topic}")
        print(f"📱 Platforms: {platforms}")
        print(f"🤖 Auto-post: {auto_post}")
        
        # Run the optimized pipeline
        result = await self.pipeline.run_pipeline(
            topic=topic,
            platforms=platforms,
            require_approval=not auto_post
        )
        
        # Return summary
        return {
            "topic": result.topic,
            "brand": result.brand,
            "platforms": list(result.platform_content.keys()),
            "content_unit_id": result.content_unit.unit_id,
            "files_generated": len(result.generated_files),
            "approval_status": result.approval_status,
            "post_results": result.post_results,
            "status": "completed"
        }
    
    @modal.method()
    async def test_pipeline(self):
        """Quick test of the pipeline functionality."""
        return await self.run_pipeline(
            topic="Test: Caregiver self-care tips",
            platforms=["twitter"],
            auto_post=False
        )

# Scheduled function (runs every 6 hours)
@app.function(
    schedule=modal.Cron("0 */6 * * *"),  # Every 6 hours
    volumes={"/storage": storage_volume},
)
async def scheduled_social_pipeline():
    """Scheduled execution of social pipeline."""
    service = SocialPipelineService()
    return await service.run_pipeline.remote(auto_post=True)

# Manual trigger endpoint
@app.function()
async def run_social_pipeline(
    topic: str = None,
    platforms: str = "twitter,linkedin,youtube",
    auto_post: bool = False
):
    """
    Manual endpoint to run the pipeline.
    Can be triggered via Modal CLI or API.
    """
    platform_list = [p.strip() for p in platforms.split(",")]
    service = SocialPipelineService()
    return await service.run_pipeline.remote(
        topic=topic,
        platforms=platform_list,
        auto_post=auto_post
    )

# Health check endpoint
@app.function()
def health_check():
    """Health check endpoint for monitoring."""
    import datetime
    return {
        "status": "healthy",
        "service": "social-pipeline-v2",
        "timestamp": datetime.datetime.now().isoformat(),
        "version": "2.0.0"
    }

# Test endpoint for development
@app.function()
async def test_endpoint():
    """Test endpoint to verify deployment."""
    service = SocialPipelineService()
    return await service.test_pipeline.remote()

# Local development entry point
@app.local_entrypoint()
def main(
    topic: str = None,
    platforms: str = "twitter,linkedin",
    post: bool = False,
    test: bool = False
):
    """
    Local testing of the pipeline.
    
    Usage:
        modal run modal_deploy_v2.py
        modal run modal_deploy_v2.py --topic "Caregiver wellness" --platforms "twitter,youtube"
        modal run modal_deploy_v2.py --test
    """
    if test:
        print("🧪 Running test pipeline...")
        result = test_endpoint.remote()
    else:
        print(f"🚀 Running pipeline locally...")
        result = run_social_pipeline.remote(topic, platforms, post)
    
    print(f"✅ Result: {result}")

# Deployment commands:
# - Deploy: modal deploy modal_deploy_v2.py
# - Run: modal run modal_deploy_v2.py
# - Test: modal run modal_deploy_v2.py --test
# - Logs: modal logs -f

if __name__ == "__main__":
    main()