"""SocialPipeline workflow glues agents together."""
from typing import Dict, Any
from agno.workflow import Workflow
import asyncio, yaml, pathlib
import httpx
import re
from agents import StoryHunter, ContentCreator, MediaGenerator
from services.slack_service import SlackService

BRAND_YAML = pathlib.Path(__file__).parent.parent / "brand" / "givecare.yml"
brand_cfg: Dict[str, Any] = yaml.safe_load(BRAND_YAML.read_text())

# Local output directories
OUTPUT_BASE = pathlib.Path(__file__).parent.parent / "output"
IMAGES_DIR = OUTPUT_BASE / "images"
ARTICLES_DIR = OUTPUT_BASE / "articles"

# Ensure directories exist
for _d in (OUTPUT_BASE, IMAGES_DIR, ARTICLES_DIR):
    _d.mkdir(parents=True, exist_ok=True)

class SocialPipeline(Workflow):
    def __init__(self):
        self.hunter = StoryHunter(brand_cfg)
        self.writer = ContentCreator(brand_cfg)
        self.media = MediaGenerator()
        self.slack = SlackService()

    async def run(self, topic: str = "caregiver burnout") -> Dict[str, Any]:
        stories = await self.hunter.find(topic)
        if not stories:
            return {"status": "no_stories"}
        story = stories[0]
        post = await self.writer.craft(story.dict())
        img = await self.media.image(post.text)

        # Store image locally
        filename_slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", story.title.lower())[:50]
        img_path = IMAGES_DIR / f"{filename_slug}.jpg"
        async with httpx.AsyncClient() as client:
            resp = await client.get(img.url)
            resp.raise_for_status()
            img_path.write_bytes(resp.content)

        # Store post text as markdown
        article_path = ARTICLES_DIR / f"{filename_slug}.md"
        article_path.write_text(f"# {story.title}\n\n{post.text}\n")

        # Send for Slack approval
        await self.slack.post_approval(story.title, post.text, img.url)

        return {
            "status": "sent_for_approval",
            "story": story.dict(),
            "post": post.dict(),
            "image_url": img.url,
            "saved_image": str(img_path),
            "article": str(article_path),
        }
