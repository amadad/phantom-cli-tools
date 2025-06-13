"""Slack webhook + scheduled pipeline for Modal."""
import modal
import json

app = modal.App("slack-webhook-simple")

# Image with all dependencies
image = modal.Image.debian_slim(python_version="3.10").pip_install_from_requirements("requirements.txt")

# Define secrets
secrets = [
    modal.Secret.from_name("azure-openai"),
    modal.Secret.from_name("composio"),
    modal.Secret.from_name("slack"),
    modal.Secret.from_name("search-apis"),
    modal.Secret.from_name("replicate"),
]

def get_pipeline_state():
    """Check if pipeline is paused via state file."""
    try:
        with open("pipeline_state.json", 'r') as f:
            return json.load(f).get('status', 'active')
    except FileNotFoundError:
        return 'active'

# Scheduled pipeline function
@app.function(image=image, secrets=secrets, schedule=modal.Period(hours=6), timeout=900)
async def scheduled_pipeline():
    """Scheduled pipeline run every 6 hours - respects pause state."""
    if get_pipeline_state() == 'paused':
        print("⏸️ Pipeline is paused, skipping scheduled run")
        return {"status": "skipped", "reason": "pipeline_paused"}
    
    from workflows.social_pipeline import SocialPipeline
    pipeline = SocialPipeline()
    return await pipeline.run()

# Manual trigger function
@app.function(image=image, secrets=secrets)
async def trigger_pipeline(topic: str = "caregiver burnout", force: bool = False):
    """Manual pipeline trigger."""
    if not force and get_pipeline_state() == 'paused':
        return {"status": "paused", "message": "Pipeline is paused. Use force=true to override."}
    
    from workflows.social_pipeline import SocialPipeline
    pipeline = SocialPipeline()
    return await pipeline.run(topic)

@app.function(image=image, secrets=secrets)
@modal.asgi_app()
def slack_webhook():
    """Slack webhook with agent integration."""
    from fastapi import FastAPI, Request
    from slack_sdk import WebClient
    import os
    
    fastapi_app = FastAPI()
    slack_client = WebClient(token=os.environ["SLACK_BOT_TOKEN"])
    
    @fastapi_app.post("/slack/events")
    async def events(request: Request):
        """Handle Slack events with agent processing."""
        try:
            body = await request.body()
            data = json.loads(body)
            
            # URL verification challenge
            if data.get("type") == "url_verification":
                return {"challenge": data.get("challenge")}
            
            # Handle actual events
            if data.get("type") == "event_callback":
                event = data.get("event", {})
                
                # Only respond to mentions and direct messages
                if event.get("type") in ["app_mention", "message"]:
                    # Skip bot messages
                    if event.get("bot_id"):
                        return {"status": "ok"}
                    
                    user_message = event.get("text", "").strip()
                    channel = event.get("channel")
                    
                    # Remove bot mention from message
                    if user_message.startswith("<@"):
                        user_message = " ".join(user_message.split(" ")[1:])
                    
                    if user_message:
                        # Import agent (lazy loading)
                        from slack_app import social_agent
                        
                        try:
                            # Process with agent
                            response = social_agent.run(user_message)
                            
                            # Send response back to Slack
                            slack_client.chat_postMessage(
                                channel=channel,
                                text=response.content
                            )
                        except Exception as e:
                            print(f"Agent error: {e}")
                            slack_client.chat_postMessage(
                                channel=channel,
                                text="Sorry, I encountered an error processing your request."
                            )
            
            return {"status": "ok"}
            
        except Exception as e:
            print(f"Slack webhook error: {e}")
            return {"status": "error", "message": str(e)}
    
    return fastapi_app

if __name__ == "__main__":
    # Deploy with: modal deploy slack_simple.py
    pass