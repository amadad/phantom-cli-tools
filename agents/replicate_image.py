"""ReplicateImageAgent: generate images via ReplicateTools."""
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.replicate import ReplicateTools

class ReplicateImageAgent(Agent):
    """Agent that uses Replicate photon-flash (or any configured) to create images."""

    def __init__(self, model: str = "luma/photon-flash"):
        super().__init__(
            name="Replicate Image Generator",
            model=OpenAIChat(id="gpt-4o-mini"),
            tools=[ReplicateTools(model=model)],
            description="Generate images using Replicate API.",
            instructions=[
                "When asked to create an image, call `generate_media`.",
                "Return only the raw URL of the generated media."
            ],
            markdown=False,
            debug_mode=False,
            show_tool_calls=False,
        )

    async def generate(self, prompt: str) -> str:
        """Generate an image and return the URL."""
        resp = await self.run(f"Create an image of: {prompt}")
        # The replicate toolkit returns the URL directly in content
        return str(resp.content).strip()
