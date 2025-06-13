import modal, yaml, pathlib, json
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

# Add Slack app endpoint - fast challenge response, lazy agent loading
@app.function(image=image, secrets=secrets)
@modal.fastapi_endpoint()
async def slack_events():
    """Slack events webhook endpoint with fast challenge response."""
    from fastapi import FastAPI, Request
    import json
    
    slack_app = FastAPI()
    
    @slack_app.post("/slack/events")
    async def handle_slack_events(request: Request):
        """Handle Slack events with immediate challenge response."""
        try:
            body = await request.body()
            data = json.loads(body)
            
            # Handle URL verification challenge IMMEDIATELY
            if data.get("type") == "url_verification":
                challenge = data.get("challenge")
                print(f"Slack challenge received: {challenge}")
                return {"challenge": challenge}
            
            # For actual events, import heavy dependencies only when needed
            if data.get("type") == "event_callback":
                print("Processing Slack event...")
                # Lazy import to avoid slowing down challenge response
                from slack_app import social_agent
                
                event = data.get("event", {})
                if event.get("type") in ["app_mention", "message"]:
                    user_message = event.get("text", "").strip()
                    
                    # Remove bot mention
                    if user_message.startswith("<@"):
                        user_message = " ".join(user_message.split(" ")[1:])
                    
                    # Process with agent
                    try:
                        response = social_agent.run(user_message)
                        return {"response_type": "in_channel", "text": response.content}
                    except Exception as e:
                        print(f"Agent error: {e}")
                        return {"text": "Sorry, I encountered an error processing your request."}
                
            return {"status": "ok"}
            
        except Exception as e:
            print(f"Slack webhook error: {e}")
            return {"status": "error", "message": str(e)}
    
    return slack_app
