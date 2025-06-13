# agents/story_hunter.py
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from agno.tools.serperapi import SerperApiTools
import logging
import json

logger = logging.getLogger(__name__)

class Story(BaseModel):
    """Represents a news story with relevance scoring."""
    title: str
    url: str
    source: str = "web"
    summary: str = ""
    relevance_score: float = Field(..., ge=0, le=1)

class StoryHunter:
    """Simple story finder using built-in agno SerperAPI."""
    
    def __init__(self, brand_config: Dict[str, Any]):
        self.serper = SerperApiTools()
        self.brand = brand_config.get("name", "the brand")
        logger.info(f"Initialized StoryHunter for brand: {self.brand}")

    async def find(self, topic: str, n: int = 3) -> List[Story]:
        """Find relevant news stories using agno's built-in SerperAPI."""
        search_query = f"{topic} elderly care technology news"
        logger.info(f"Searching for: {search_query}")
        
        try:
            # Use agno's built-in serper tool (regular search)
            result_str = self.serper.search_google(search_query)
            results = json.loads(result_str)
            
            # Get organic results since agno tool doesn't do news search
            organic_results = results.get("organic", [])
            
            stories = []
            for result in organic_results[:n]:
                story = Story(
                    title=result.get('title', ''),
                    url=result.get('link', ''),
                    source=result.get('displayLink', 'web'),
                    summary=result.get('snippet', ''),
                    relevance_score=0.7
                )
                stories.append(story)
            
            logger.info(f"Found {len(stories)} stories")
            return stories
            
        except Exception as e:
            logger.error(f"Error finding stories: {e}")
            return []