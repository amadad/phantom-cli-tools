from agno.agent import Agent
from agno.app.slack.app import SlackAPI
from agno.models.azure import AzureOpenAI
from composio_agno import ComposioToolSet, App
from utils.config import settings
from workflows.social_pipeline import SocialPipeline
import asyncio

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

# Initialize the pipeline for programmatic access
pipeline = SocialPipeline()

async def run_pipeline_command(topic: str = "caregiver burnout"):
    """Run the social pipeline and return results."""
    result = await pipeline.execute_pipeline(topic)
    return result

# Add custom function to agent
social_agent.functions = {
    "run_social_pipeline": run_pipeline_command
}

# Create Slack API app
slack_api_app = SlackAPI(agent=social_agent)

# Get the FastAPI app
app = slack_api_app.get_app()

if __name__ == "__main__":
    slack_api_app.serve("slack_app:app", port=8000, reload=True)