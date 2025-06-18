#!/usr/bin/env python3
"""
Modal deployment for Agent Social Pipeline
Deploys the social media content pipeline to Modal for serverless execution.
"""

import modal
import os
from pathlib import Path
import json
from typing import List
from social_pipeline import SocialPipeline

# Create Modal app
app = modal.App("agno-social-mvp")

# Define the image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "curl")  # Add system dependencies
    .pip_install_from_requirements("requirements.txt")
    .pip_install("PyYAML>=6.0.2")  # Ensure PyYAML is installed
    .pip_install("openai>=1.0.0")  # Required for AzureOpenAI
    .pip_install("azure-ai-inference>=1.0.0b9")  # Fix the Azure dependency error
    .pip_install("aiohttp>=3.9.5")  # Required for Azure AI inference
    .env({
        "PYTHONPATH": "/root",
        "PYTHONUNBUFFERED": "1"
    })
    .add_local_dir(
        ".",
        remote_path="/root",
        ignore=lambda pth: any(
            part in str(pth) for part in [".git", "__pycache__", ".venv", "node_modules", ".DS_Store"]
        )
    )
)

# Define secrets - you'll need to create these in Modal
secrets = [
    modal.secret.Secret.from_name("azure-openai-secrets"),  # Azure OpenAI credentials
    modal.secret.Secret.from_name("composio-secrets"),      # Composio API key
    modal.secret.Secret.from_name("slack-secrets"),         # Slack bot token and signing secret
    modal.secret.Secret.from_name("serper-api-key"),        # Serper API key
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
    results = []
    async for response in pipeline.run():
        results.append(response.model_dump())
        print(f"Pipeline step: {response.content}")
    
    return {"status": "completed", "results": results}

@app.function(image=image, secrets=secrets)
@modal.fastapi_endpoint(method="POST")
async def trigger(data: dict):
    """Manual trigger - always runs regardless of pause state."""
    topic = data.get("topic", "caregiver burnout")
    force = data.get("force", False)
    
    if not force and get_pipeline_state() == 'paused':
        return {"status": "paused", "message": "Pipeline is paused. Use force=true to override."}
    
    pipeline = SocialPipeline()
    results = []
    async for response in pipeline.run(topic=topic):
        results.append(response.model_dump())
        print(f"Pipeline step: {response.content}")
    
    return {"status": "completed", "topic": topic, "results": results}

# Slack API endpoints - proper ASGI app for full Slack integration
@app.function(image=image, secrets=secrets)
@modal.asgi_app()
def slack_app():
    """Serve a FastAPI app that handles Slack events properly."""
    from fastapi import FastAPI, Request
    import json
    
    slack_api = FastAPI()
    
    @slack_api.post("/slack/events")
    async def handle_slack_events(request: Request):
        """Handle Slack events including challenge verification."""
        try:
            body = await request.body()
            data = json.loads(body)
            
            print(f"📥 Received Slack request: {data.get('type', 'unknown')}")
            
            # Handle challenge verification for Event Subscriptions
            if data.get("type") == "url_verification":
                challenge = data.get("challenge")
                print(f"🔐 Slack challenge verification: {challenge}")
                return {"challenge": challenge}
            
            # Handle other Slack events
            if data.get("type") == "event_callback":
                event = data.get("event", {})
                print(f"📩 Received Slack event: {event.get('type')}")
                
                # Handle app mentions and direct messages
                if event.get("type") in ["app_mention", "message"]:
                    text = event.get("text", "")
                    user = event.get("user")
                    channel = event.get("channel")
                    
                    print(f"💬 Message from {user} in {channel}: {text}")
                    
                    # TODO: Integrate with your pipeline here
                
                return {"status": "ok"}
            
            return {"status": "ok"}
            
        except Exception as e:
            print(f"❌ Error handling Slack request: {e}")
            return {"error": str(e)}
    
    @slack_api.get("/health")
    async def health():
        """Health check endpoint."""
        return {"status": "healthy", "service": "agent-social-slack"}
    
    return slack_api



@app.function(image=image, secrets=secrets, timeout=900)
async def run_pipeline(
    topic: str = "caregiver burnout",
    platforms: List[str] = None,
    auto_post: bool = False
):
    """Run the pipeline directly (not webhook) for testing."""
    if platforms is None:
        platforms = ["twitter", "linkedin"]
    
    pipeline = SocialPipeline()
    results = []
    async for response in pipeline.run(topic=topic, platforms=platforms, auto_post=auto_post):
        results.append(response.model_dump())
        print(f"Pipeline step: {response.content}")
    
    return {"status": "completed", "topic": topic, "platforms": platforms, "results": results}

@app.function(
    image=image,
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
    
    # Call trigger function locally
    result = trigger.local({
        "topic": topic,
        "platforms": platforms_list,
        "auto_post": auto_post,
        "brand_config": brand_config
    })
    
    print("🎉 Pipeline execution completed!")
    print(f"📊 Result: {result}")

if __name__ == "__main__":
    main()