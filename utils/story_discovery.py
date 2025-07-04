#!/usr/bin/env python3
"""
Story Discovery Module for Agent Social
Uses Agno's built-in Serper tools for news discovery.
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# Agno imports
from agno.agent import Agent
from agno.models.azure import AzureOpenAI
import httpx
import asyncio


class NewsStory(BaseModel):
    """Individual news story model."""
    title: str = Field(description="Story headline")
    snippet: str = Field(description="Brief description or summary")
    link: str = Field(description="URL to the full story")
    date: Optional[str] = Field(default=None, description="Publication date")
    source: Optional[str] = Field(default=None, description="News source")
    relevance_score: float = Field(default=0.0, description="Relevance to brand topics (0-1)")


class StoryDiscoveryResult(BaseModel):
    """Result of story discovery."""
    stories: List[NewsStory] = Field(description="List of discovered stories")
    search_query: str = Field(description="Query used for search")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class StoryDiscoveryAgent:
    """Agent for discovering relevant news stories using Serper."""
    
    def __init__(self, brand_config: Dict[str, Any]):
        self.brand_config = brand_config
        self.brand_name = brand_config.get("name", "Brand")
        self.research_keywords = brand_config.get("research_keywords", [])
        self.topics = brand_config.get("topics", [])
        
        # Use SerpAPI (not Serper) since that's what the key is for  
        self.serpapi_key = os.getenv("SERP_API_KEY")
        if not self.serpapi_key:
            raise ValueError("SERP_API_KEY environment variable not set")
        
        print(f"🔧 Using SerpAPI with key: {self.serpapi_key[:10]}...")
        
        # Create discovery agent
        self.agent = self._create_discovery_agent()
    
    async def _search_serpapi(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Search using SerpAPI directly."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google",
                        "q": query,
                        "api_key": self.serpapi_key,
                        "num": num_results,
                        "tbm": "nws"  # News search
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    news_results = data.get("news_results", [])
                    
                    # Convert to our format
                    stories = []
                    for result in news_results[:num_results]:
                        story = {
                            "title": result.get("title", ""),
                            "snippet": result.get("snippet", ""),
                            "link": result.get("link", ""),
                            "date": result.get("date", ""),
                            "source": result.get("source", ""),
                            "relevance_score": 0.8  # Default score
                        }
                        stories.append(story)
                    
                    return stories
                else:
                    print(f"❌ SerpAPI error: {response.status_code} - {response.text}")
                    return []
                    
            except Exception as e:
                print(f"❌ SerpAPI exception: {e}")
                return []
    
    def _create_discovery_agent(self) -> Agent:
        """Create an agent for story discovery and relevance scoring."""
        
        instructions = f"""You are a news discovery specialist for {self.brand_name}.
        
Your task is to find and evaluate news stories relevant to these topics:
{chr(10).join(f'- {topic}' for topic in self.topics)}

Key research areas:
{chr(10).join(f'- {keyword}' for keyword in self.research_keywords)}

When evaluating stories:
1. Prioritize recent news (last 7 days)
2. Focus on human interest stories over statistics
3. Look for emotional, relatable content
4. Score relevance from 0-1 based on brand alignment
5. Filter out negative or controversial content

Return structured results with relevance scores."""
        
        # Configure Azure OpenAI model properly
        model = AzureOpenAI(
            azure_deployment=os.getenv("AZURE_OPENAI_DEFAULT_MODEL", "gpt-4.5-preview"),
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
        )
        
        return Agent(
            name="story_discoverer",
            model=model,
            instructions=instructions,
            tools=[],  # No tools needed, we'll use direct API calls
            response_model=StoryDiscoveryResult
        )
    
    async def discover_stories(
        self, 
        topic: Optional[str] = None, 
        max_stories: int = 5,
        days_back: int = 7
    ) -> StoryDiscoveryResult:
        """Discover relevant news stories for content creation."""
        
        # Build search query
        if topic:
            # Use specific topic
            search_query = f"{topic} news stories"
        else:
            # Use rotating keyword
            keyword_index = datetime.now().day % len(self.research_keywords)
            base_keyword = self.research_keywords[keyword_index]
            search_query = f"{base_keyword} inspiring stories news"
        
        # Add time filter
        search_query += f" after:{(datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')}"
        
        print(f"🔍 Searching for: {search_query}")
        
        try:
            # Search with SerpAPI
            print("🔍 Searching with SerpAPI...")
            search_results = await self._search_serpapi(search_query, max_stories)
            
            if search_results:
                # Convert to NewsStory objects
                stories = []
                for result in search_results:
                    story = NewsStory(
                        title=result["title"],
                        snippet=result["snippet"],
                        link=result["link"],
                        date=result.get("date"),
                        source=result.get("source"),
                        relevance_score=result["relevance_score"]
                    )
                    stories.append(story)
                
                print(f"✅ Found {len(stories)} stories from SerpAPI")
                
                # Use agent to improve relevance scoring
                if stories:
                    prompt = f"""Evaluate these {len(stories)} news stories for relevance to {self.brand_name}'s caregiving community.
                    
Stories found:
{chr(10).join([f"- {s.title}: {s.snippet[:100]}..." for s in stories])}

Rate each story's relevance (0-1) based on:
- Practical value for caregivers
- Emotional resonance 
- Brand alignment with {self.brand_name}
- Human interest appeal

Return the stories with updated relevance scores."""
                
                    response = await self.agent.arun(prompt)
                    result = response.content if hasattr(response, 'content') else response
                    
                    # Use the agent's evaluation if available, otherwise use our stories
                    if hasattr(result, 'stories') and result.stories:
                        print("✅ Agent improved story relevance scoring")
                        result = result
                    else:
                        # Use our original stories if agent failed
                        result = StoryDiscoveryResult(
                            stories=stories,
                            search_query=search_query
                        )
                else:
                    result = StoryDiscoveryResult(stories=[], search_query=search_query)
            else:
                print("⚠️ No results from SerpAPI, generating contextual content")
                # Fallback to generated content
                prompt = f"""Generate {max_stories} relevant story concepts about "{topic}" for {self.brand_name}'s caregiving community.
                
Create realistic, relevant story ideas:
- Focus on practical caregiving tips and emotional support
- Include human interest angles that resonate with caregivers
- Make them current and actionable
- Score relevance 0.8-0.9 for brand alignment
                
Return structured results with titles, descriptions, and relevance scores."""
                
                response = await self.agent.arun(prompt)
                result = response.content if hasattr(response, 'content') else response
            
            # Filter stories by relevance score
            if hasattr(result, 'stories'):
                result.stories = [s for s in result.stories if s.relevance_score >= 0.6]
                result.stories = result.stories[:max_stories]
            
            return result
            
        except Exception as e:
            print(f"❌ Story discovery failed: {e}")
            print("📝 Continuing without story discovery...")
            # Return empty result on error - pipeline will continue normally
            return StoryDiscoveryResult(
                stories=[],
                search_query=search_query
            )
    
    async def discover_trending_topics(self) -> List[str]:
        """Discover currently trending topics in our domain."""
        
        trending_topics = []
        
        for keyword in self.research_keywords[:3]:  # Check top 3 keywords
            try:
                prompt = f"""Search for trending topics related to "{keyword}" in the last 48 hours.
                Focus on emerging trends, new research, or viral discussions.
                Return a list of 3-5 trending topic phrases."""
                
                # We'll need to adjust this to work with the actual response
                response = await self.agent.arun(prompt)
                result = response.content if hasattr(response, 'content') else response
                
                # Extract topics from response (this is simplified)
                if hasattr(result, 'stories'):
                    for story in result.stories[:2]:
                        trending_topics.append(story.title)
                
            except Exception as e:
                print(f"⚠️ Failed to get trends for {keyword}: {e}")
        
        return trending_topics
    
    def filter_duplicate_stories(
        self, 
        stories: List[NewsStory], 
        recent_posts: List[Dict[str, Any]]
    ) -> List[NewsStory]:
        """Filter out stories that have been recently posted."""
        
        # Create set of recent story URLs
        recent_urls = {post.get("source_url") for post in recent_posts if post.get("source_url")}
        
        # Filter out duplicates
        filtered_stories = [s for s in stories if s.link not in recent_urls]
        
        return filtered_stories


async def discover_stories_for_topic(
    topic: str, 
    brand_config: Dict[str, Any],
    max_stories: int = 5
) -> List[Dict[str, Any]]:
    """Convenience function to discover stories for a specific topic."""
    
    agent = StoryDiscoveryAgent(brand_config)
    result = await agent.discover_stories(topic=topic, max_stories=max_stories)
    
    # Convert to dict format for compatibility
    stories = []
    for story in result.stories:
        stories.append({
            "title": story.title,
            "description": story.snippet,
            "url": story.link,
            "published_date": story.date,
            "source": story.source,
            "relevance_score": story.relevance_score
        })
    
    return stories


async def get_trending_topics(brand_config: Dict[str, Any]) -> List[str]:
    """Get currently trending topics in the brand's domain."""
    
    agent = StoryDiscoveryAgent(brand_config)
    return await agent.discover_trending_topics()


# Example usage for testing
if __name__ == "__main__":
    import asyncio
    import yaml
    
    # Load test brand config
    with open("brand/givecare.yml", "r") as f:
        test_brand = yaml.safe_load(f)
    
    async def test_discovery():
        # Test story discovery
        stories = await discover_stories_for_topic(
            "caregiver burnout support",
            test_brand
        )
        
        print(f"\n📰 Found {len(stories)} stories:")
        for i, story in enumerate(stories, 1):
            print(f"\n{i}. {story['title']}")
            print(f"   📎 {story['url']}")
            print(f"   📊 Relevance: {story['relevance_score']:.2f}")
        
        # Test trending topics
        trends = await get_trending_topics(test_brand)
        print(f"\n🔥 Trending topics: {trends}")
    
    asyncio.run(test_discovery())