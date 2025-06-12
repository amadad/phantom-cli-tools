"""MediaGenerator: wraps Azure OpenAI image/video generation."""
import os, asyncio, httpx
from pydantic import BaseModel
from .replicate_image import ReplicateImageAgent

class MediaResult(BaseModel):
    url: str
    type: str  # "image" or "video"

class MediaGenerator:
    def __init__(self):
        # Replicate agent for images
        self.replicate_agent = ReplicateImageAgent()
        # Azure for video (optional)
        self.endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        self.key = os.getenv("AZURE_OPENAI_API_KEY")
        self.headers = {"api-key": self.key, "Content-Type": "application/json"}

    async def image(self, prompt: str) -> MediaResult:
        url = await self.replicate_agent.generate(prompt)
        return MediaResult(url=url, type="image")

    async def video(self, prompt: str) -> MediaResult:
        url = f"{self.endpoint}/openai/videos/generations:submit?api-version=2024-02-15-preview"
        async with httpx.AsyncClient() as c:
            res = await c.post(url, headers=self.headers, json={"prompt": prompt, "n": 1, "size": "1024x1024"})
            res.raise_for_status()
            op = res.headers["operation-location"].split("/")[-1]
            op_url = f"{self.endpoint}/openai/operations/{op}?api-version=2024-02-15-preview"
            while True:
                r = await c.get(op_url, headers=self.headers); j = r.json()
                if j.get("status") == "succeeded":
                    return MediaResult(url=j["result"]["data"][0]["url"], type="video")
                await asyncio.sleep(2)
