import modal, pathlib, json
from workflows.social_pipeline import SocialPipeline

app = modal.App("agno-social-mvp")
image = modal.Image.debian_slim(python_version="3.10").pip_install_from_requirements("requirements.txt")

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

pipeline = SocialPipeline()

@app.function(image=image, secrets=secrets, schedule=modal.Period(hours=6), timeout=900)
async def scheduled():
    """Scheduled pipeline run - respects pause state."""
    if get_pipeline_state() == 'paused':
        print("⏸️ Pipeline is paused, skipping scheduled run")
        return {"status": "skipped", "reason": "pipeline_paused"}
    
    return await pipeline.run()

@app.function(image=image, secrets=secrets)
@modal.fastapi_endpoint(method="POST")
async def trigger(data: dict):
    """Manual trigger - always runs regardless of pause state."""
    topic = data.get("topic", "caregiver burnout")
    force = data.get("force", False)
    
    if not force and get_pipeline_state() == 'paused':
        return {"status": "paused", "message": "Pipeline is paused. Use force=true to override."}
    
    return await pipeline.run(topic)

# Mount the slack_app FastAPI app
@app.function(image=image, secrets=secrets)
@modal.asgi_app()
def slack_app_serve():
    """Serve the existing slack_app with Agno SlackAPI."""
    from slack_app import app as slack_fastapi_app
    return slack_fastapi_app
