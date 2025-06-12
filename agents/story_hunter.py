"""StoryHunter agent: finds and scores relevant news stories."""
from typing import List
from pydantic import BaseModel, Field
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.duckduckgo import DuckDuckGoTools

class Story(BaseModel):
    title: str
    url: str
    source: str = "web"
    summary: str = ""
    relevance_score: float = Field(..., ge=0, le=1)

class StoryHunter(Agent):
    """Agent that hunts for news stories with DuckDuckGo, then ranks them."""

    def __init__(self, brand_cfg: dict):
        super().__init__(
            model=OpenAIChat(id="gpt-4o-mini"),
            tools=[DuckDuckGoTools()],
            description="Finds top stories and scores for brand alignment"
        )
        self.brand = brand_cfg["brand"]["name"]

    async def find(self, topic: str, n: int = 3) -> List[Story]:
        prompt = (
            f"Search web for {topic}. Return a JSON list of {n} items with keys: title, url, summary, relevance_score (0-1 for {self.brand})."
        )
        resp = await self.run(prompt)
        data = resp.content if isinstance(resp.content, list) else []
        return [Story(**item) for item in data]
