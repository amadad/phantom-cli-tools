# agents/content_creator.py
from typing import Dict, List
from pydantic import BaseModel, Field
from utils.config import settings
import requests
import logging
import re

logger = logging.getLogger(__name__)

class SocialMediaPost(BaseModel):
    """Represents a social media post with content and metadata."""
    text: str
    hashtags: List[str] = Field(default_factory=list)
    platform: str = "twitter"

class ContentCreator:
    """Simple content creator using Azure OpenAI API directly."""
    
    def __init__(self, brand_cfg: dict):
        self.brand = brand_cfg["brand"]
        self.style_guide = brand_cfg.get("style_guide", {})
        logger.info(f"Initialized ContentCreator for brand: {self.brand['name']}")

    async def craft(self, story: Dict, platform: str = "twitter") -> SocialMediaPost:
        """Create a social media post from a story using Azure OpenAI."""
        prompt = self._build_prompt(story, platform)
        
        headers = {
            "api-key": settings.AZURE_OPENAI_API_KEY,
            "Content-Type": "application/json"
        }
        
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
            "temperature": 0.8
        }
        
        try:
            url = f"{settings.AZURE_OPENAI_BASE_URL}/openai/deployments/{settings.AZURE_OPENAI_GPT45_DEPLOYMENT}/chat/completions?api-version={settings.AZURE_OPENAI_API_VERSION}"
            
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            post_text = response.json()["choices"][0]["message"]["content"].strip()
            
            hashtags = self._extract_hashtags(post_text)
            clean_text = self._clean_post_text(post_text)
            
            return SocialMediaPost(
                text=clean_text,
                hashtags=hashtags,
                platform=platform
            )
            
        except Exception as e:
            logger.error(f"Error crafting post: {e}")
            raise
    
    def _build_prompt(self, story: Dict, platform: str) -> str:
        """Build the prompt for generating social media content."""
        brand_voice = self.style_guide.get("tone", "professional but approachable")
        
        return f"""
        Create a {platform.upper()} post about this story that matches our brand voice ({brand_voice}):
        
        TITLE: {story.get('title', '')}
        SUMMARY: {story.get('summary', '')}
        URL: {story.get('url', '')}
        
        Guidelines:
        - Keep it concise and engaging
        - Include 1-3 relevant hashtags
        - Match our brand voice: {brand_voice}
        - Include a call-to-action
        - Platform: {platform}
        
        Post (just the text, no markdown formatting, no quotes):
        """
    
    @staticmethod
    def _extract_hashtags(text: str) -> List[str]:
        """Extract hashtags from text."""
        return re.findall(r'#(\w+)', text)
    
    @staticmethod
    def _clean_post_text(text: str) -> str:
        """Clean up the post text by removing unwanted characters and formatting."""
        # Remove markdown code blocks if present
        text = re.sub(r'```[\s\S]*?```', '', text)
        # Remove quotes
        text = text.strip('"\'')
        # Remove extra whitespace
        return ' '.join(text.split())