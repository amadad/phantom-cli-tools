from agno.agent import Agent
from agno.app.slack.app import SlackAPI
from agno.models.azure import AzureOpenAI
from composio_agno import ComposioToolSet, App
from utils.config import settings
from workflows.social_pipeline import SocialPipeline
import asyncio
import json
from pathlib import Path

# Create the main agent with Azure OpenAI
social_agent = Agent(
    name="Social Pipeline Agent",
    model=AzureOpenAI(
        id="gpt-4.5-preview",
        azure_endpoint=settings.AZURE_OPENAI_BASE_URL,
        azure_deployment=settings.AZURE_OPENAI_GPT45_DEPLOYMENT,
        api_version=settings.AZURE_OPENAI_API_VERSION,
        api_key=settings.AZURE_OPENAI_API_KEY,
        temperature=0.7
    ),
    tools=[ComposioToolSet()],
    instructions=[
        "You are a social media content pipeline assistant.",
        "You can help create content about caregiving topics and post to social platforms.",
        "When asked to create content, use the social pipeline to generate posts.",
        "You can approve/reject content and post to LinkedIn, Twitter, Facebook via Composio.",
        "Always ask for confirmation before posting to social platforms."
    ],
    show_tool_calls=True,
    markdown=True,
)

# Pipeline state management
PIPELINE_STATE_FILE = Path("pipeline_state.json")

def get_pipeline_state():
    """Get current pipeline state (active/paused)."""
    if PIPELINE_STATE_FILE.exists():
        with open(PIPELINE_STATE_FILE, 'r') as f:
            return json.load(f).get('status', 'active')
    return 'active'

def set_pipeline_state(status: str):
    """Set pipeline state (active/paused)."""
    with open(PIPELINE_STATE_FILE, 'w') as f:
        json.dump({'status': status}, f)

# Initialize the pipeline for programmatic access
pipeline = SocialPipeline()

async def run_pipeline_command(topic: str = "caregiver burnout"):
    """Run the social pipeline and return results."""
    if get_pipeline_state() == 'paused':
        return "🚫 Pipeline is currently paused. Use 'resume pipeline' to continue."
    
    result = await pipeline.execute_pipeline(topic)
    return result

def pause_pipeline():
    """Pause the pipeline."""
    set_pipeline_state('paused')
    return "⏸️ Pipeline paused. Scheduled runs will be skipped until resumed."

def resume_pipeline():
    """Resume the pipeline."""
    set_pipeline_state('active')
    return "▶️ Pipeline resumed. Scheduled runs will continue."

def pipeline_status():
    """Get current pipeline status."""
    status = get_pipeline_state()
    if status == 'paused':
        return "⏸️ Pipeline is currently **PAUSED**"
    else:
        return "▶️ Pipeline is currently **ACTIVE**"

# Add custom functions to agent
social_agent.functions = {
    "run_social_pipeline": run_pipeline_command,
    "pause_pipeline": pause_pipeline,
    "resume_pipeline": resume_pipeline,
    "pipeline_status": pipeline_status
}

# Create Slack API app
slack_api_app = SlackAPI(agent=social_agent)

# Get the FastAPI app
app = slack_api_app.get_app()

if __name__ == "__main__":
    slack_api_app.serve("slack_app:app", port=8000, reload=True)