#!/usr/bin/env python3
"""
Modal deployment for Agent Social Pipeline
Deploys the social media content pipeline to Modal for serverless execution.
"""

import modal
import os
from pathlib import Path
import json
from social_pipeline import SocialPipeline

# Create Modal app
app = modal.App("agno-social-mvp")

# Define the image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "curl")  # Add system dependencies
    .pip_install_from_requirements("requirements.txt")
    .pip_install("PyYAML>=6.0.2")  # Ensure PyYAML is installed
    .add_local_dir(
        ".",
        remote_path="/root",
        ignore=lambda pth: any(
            part in str(pth) for part in [".git", "__pycache__", ".venv", "node_modules", ".DS_Store"]
        )
    )
    .env({
        "PYTHONPATH": "/root",
        "PYTHONUNBUFFERED": "1"
    })
)

# Define secrets - you'll need to create these in Modal
secrets = [
    modal.secret.Secret.from_name("azure-openai"),  # Azure OpenAI credentials
    modal.secret.Secret.from_name("composio"),      # Composio API key
    modal.secret.Secret.from_name("slack"),         # Slack bot token and signing secret
    modal.secret.Secret.from_name("search-apis"),   # SERP, EXA, TAVILY, FIRECRAWL keys
    modal.secret.Secret.from_name("replicate"),     # Replicate API token
]

def get_pipeline_state():
    """Check if pipeline is paused via state file."""
    try:
        with open("pipeline_state.json", 'r') as f:
            return json.load(f).get('status', 'active')
    except FileNotFoundError:
        return 'active'

@app.function(image=image, secrets=secrets, schedule=modal.Period(hours=6), timeout=900)
async def scheduled():
    """Scheduled pipeline run - respects pause state."""
    if get_pipeline_state() == 'paused':
        print("⏸️ Pipeline is paused, skipping scheduled run")
        return {"status": "skipped", "reason": "pipeline_paused"}
    
    pipeline = SocialPipeline()
    return await pipeline.run()

@app.function(image=image, secrets=secrets)
@modal.web_endpoint(method="POST")
async def trigger(data: dict):
    """Manual trigger - always runs regardless of pause state."""
    topic = data.get("topic", "caregiver burnout")
    force = data.get("force", False)
    
    if not force and get_pipeline_state() == 'paused':
        return {"status": "paused", "message": "Pipeline is paused. Use force=true to override."}
    
    pipeline = SocialPipeline()
    return await pipeline.run(topic)

# Mount the slack_app FastAPI app
@app.function(image=image, secrets=secrets)
@modal.asgi_app()
def slack_app_serve():
    """Serve the existing slack_app with Agno SlackAPI."""
    from slack_app import app as slack_fastapi_app
    return slack_fastapi_app

@app.function(
    image=image,
    secrets=[
        modal.secret.Secret.from_name("azure-openai-secrets"),
        modal.secret.Secret.from_name("serper-api-key"),
        modal.secret.Secret.from_name("slack-secrets"),
        modal.secret.Secret.from_name("composio-secrets"),
    ],
    timeout=1800,  # 30 minutes
    memory=2048,   # 2GB RAM
)
async def run_social_pipeline(
    topic: str = "caregiver burnout",
    platforms: list = None,
    auto_post: bool = False,
    brand_config: str = None
):
    """
    Run the social media pipeline on Modal.
    
    Args:
        topic: The topic to research and create content about
        platforms: List of platforms to post to (twitter, linkedin, facebook)
        auto_post: Whether to automatically post without approval
        brand_config: Path to brand configuration file
    """
    import sys
    sys.path.append("/root")
    
    from social_pipeline import SocialPipeline, SqliteStorage
    import asyncio
    import json
    from datetime import datetime
    
    if platforms is None:
        platforms = ["twitter", "linkedin"]
    
    print(f"🚀 Starting Modal pipeline for topic: {topic}")
    print(f"📱 Target platforms: {platforms}")
    print(f"🤖 Auto-post: {auto_post}")
    
    # Create pipeline with Modal-specific session management
    pipeline = SocialPipeline(
        brand_config_path=brand_config,
        session_id=f"modal-{topic.replace(' ', '-')}-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        storage=SqliteStorage(
            table_name="modal_social_pipeline_workflows",
            db_file="/tmp/modal_social_pipeline.db",
            mode="workflow"
        )
    )
    
    results = []
    
    try:
        async for response in pipeline.run(
            topic=topic,
            platforms=platforms,
            auto_post=auto_post
        ):
            content = response.content
            if isinstance(content, dict):
                step = content.get("step", "unknown")
                message = content.get("message", "Processing...")
                print(f"📝 {step}: {message}")
                
                results.append({
                    "step": step,
                    "message": message,
                    "timestamp": datetime.now().isoformat(),
                    "content": content
                })
                
                # Check for completion
                if content.get("status") in ["success", "error", "rejected", "timeout"]:
                    print(f"✅ Final status: {content.get('status')}")
                    break
        
        return {
            "status": "completed",
            "topic": topic,
            "platforms": platforms,
            "results": results,
            "session_id": pipeline.session_id
        }
        
    except Exception as e:
        print(f"❌ Pipeline error: {e}")
        return {
            "status": "error",
            "topic": topic,
            "error": str(e),
            "results": results
        }

@app.function(
    image=image,
    secrets=[
        modal.secret.Secret.from_name("slack-secrets"),
    ],
    schedule=modal.Cron("0 9 * * 1-5"),  # Run weekdays at 9 AM
)
async def scheduled_pipeline():
    """
    Scheduled pipeline execution for regular content creation.
    """
    topics = [
        "caregiver support resources",
        "mental health for caregivers", 
        "caregiver burnout prevention",
        "family caregiver tips",
        "caregiver community support"
    ]
    
    import random
    topic = random.choice(topics)
    
    print(f"🕘 Scheduled pipeline starting with topic: {topic}")
    
    result = await run_social_pipeline.remote(
        topic=topic,
        platforms=["twitter", "linkedin"],
        auto_post=False  # Always require approval for scheduled runs
    )
    
    print(f"🕘 Scheduled pipeline completed: {result['status']}")
    return result

@app.function(
    image=image,
    mounts=[mount],
)
def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "service": "agent-social-pipeline"}

# CLI interface for local testing
@app.local_entrypoint()
def main(
    topic: str = "caregiver burnout",
    platforms: str = "twitter,linkedin",
    auto_post: bool = False,
    brand_config: str = None
):
    """
    Local entrypoint for testing the Modal deployment.
    
    Usage:
        modal run modal_app.py --topic "caregiver support" --platforms "twitter,linkedin"
    """
    platforms_list = [p.strip() for p in platforms.split(",")]
    
    result = run_social_pipeline.remote(
        topic=topic,
        platforms=platforms_list,
        auto_post=auto_post,
        brand_config=brand_config
    )
    
    print("🎉 Pipeline execution completed!")
    print(f"📊 Result: {result}")

if __name__ == "__main__":
    main() 