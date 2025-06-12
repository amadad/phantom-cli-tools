"""ContentCreator agent: crafts social posts from a story."""
from typing import List
from pydantic import BaseModel
from agno.agent import Agent
from agno.models.openai import OpenAIChat

class SocialMediaPost(BaseModel):
    platform: str
    text: str
    hashtags: List[str]

class ContentCreator(Agent):
    def __init__(self, brand_cfg: dict):
        voice = brand_cfg["brand"]["voice"]["style_guide"]
        super().__init__(
            model=OpenAIChat(id="gpt-4o-mini"),
            description="Create brand-voice social copy"
        )
        self.voice = voice

    async def craft(self, story: dict, platform: str = "twitter") -> SocialMediaPost:
        prompt = (
            f"Write a concise {platform} post about this story in the following voice:\n{self.voice}\n\n"
            f"TITLE: {story['title']}\nSUMMARY: {story.get('summary','')}\n"
            "Include 3 relevant hashtags. Return only the post text."
        )
        resp = await self.run(prompt)
        text = resp.content.strip()
        hashtags = [h.strip("#") for h in text.split() if h.startswith("#")]
        return SocialMediaPost(platform=platform, text=text, hashtags=hashtags)
