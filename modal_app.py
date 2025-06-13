import modal, pathlib, json

app = modal.App("agno-social-mvp")
image = modal.Image.debian_slim(python_version="3.10").pip_install_from_requirements("requirements.txt").add_local_dir(".", "/root")

# Define secrets - you'll need to create these in Modal
secrets = [
    modal.Secret.from_name("azure-openai"),  # Azure OpenAI credentials
    modal.Secret.from_name("composio"),      # Composio API key
    modal.Secret.from_name("slack"),         # Slack bot token and signing secret
    modal.Secret.from_name("search-apis"),   # SERP, EXA, TAVILY, FIRECRAWL keys
    modal.Secret.from_name("replicate"),     # Replicate API token
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
    from workflows.social_pipeline import SocialPipeline
    
    if get_pipeline_state() == 'paused':
        print("⏸️ Pipeline is paused, skipping scheduled run")
        return {"status": "skipped", "reason": "pipeline_paused"}
    
    pipeline = SocialPipeline()
    return await pipeline.execute_pipeline()

@app.function(image=image, secrets=secrets)
@modal.fastapi_endpoint(method="POST")
async def trigger(data: dict):
    """Manual trigger - always runs regardless of pause state."""
    from workflows.social_pipeline import SocialPipeline
    
    topic = data.get("topic", "caregiver burnout")
    force = data.get("force", False)
    
    if not force and get_pipeline_state() == 'paused':
        return {"status": "paused", "message": "Pipeline is paused. Use force=true to override."}
    
    pipeline = SocialPipeline()
    return await pipeline.execute_pipeline(topic)

# Simple Slack endpoint
from fastapi import FastAPI, Request

slack_app = FastAPI()

@slack_app.post("/slack/events")
async def handle_slack_events(request: Request):
    """Handle Slack events with immediate challenge response."""
    import json
    
    try:
        body = await request.body()
        data = json.loads(body)
        
        # Handle URL verification challenge IMMEDIATELY
        if data.get("type") == "url_verification":
            challenge = data.get("challenge")
            print(f"Slack challenge received: {challenge}")
            return {"challenge": challenge}
        
        return {"status": "ok"}
        
    except Exception as e:
        print(f"Slack webhook error: {e}")
        return {"status": "error", "message": str(e)}

@app.function(image=image, secrets=secrets)
@modal.asgi_app()
def slack_events():
    """Serve simple Slack app."""
    return slack_app
