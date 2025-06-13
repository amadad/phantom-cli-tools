import logging
from typing import Dict, Any, List
from composio_agno import ComposioToolSet, App
from utils.config import settings

logger = logging.getLogger(__name__)

class SocialPoster:
    """Service for posting content to social platforms via Composio."""
    
    def __init__(self):
        self.composio = ComposioToolSet()
        logger.info("Initialized SocialPoster with Composio")
    
    async def post_to_linkedin(
        self, 
        text: str, 
        image_url: str = None,
        hashtags: List[str] = None
    ) -> Dict[str, Any]:
        """Post content to LinkedIn."""
        try:
            # Format post with hashtags
            full_text = text
            if hashtags:
                full_text += "\n\n" + " ".join(f"#{tag}" for tag in hashtags)
            
            # Use Composio to post to LinkedIn
            result = await self.composio.execute_action(
                action="LINKEDIN_CREATE_POST",
                params={
                    "text": full_text,
                    "image_url": image_url
                }
            )
            
            logger.info("Successfully posted to LinkedIn")
            return {"status": "success", "platform": "linkedin", "result": result}
            
        except Exception as e:
            logger.error(f"Error posting to LinkedIn: {e}")
            return {"status": "error", "platform": "linkedin", "error": str(e)}
    
    async def post_to_twitter(
        self, 
        text: str, 
        image_url: str = None,
        hashtags: List[str] = None
    ) -> Dict[str, Any]:
        """Post content to Twitter/X."""
        try:
            # Format post with hashtags (Twitter handles this differently)
            full_text = text
            if hashtags:
                # Add hashtags inline for Twitter
                full_text += " " + " ".join(f"#{tag}" for tag in hashtags)
            
            # Ensure we're under Twitter's character limit
            if len(full_text) > 280:
                # Truncate and add ellipsis
                full_text = full_text[:276] + "..."
            
            result = await self.composio.execute_action(
                action="TWITTER_CREATE_TWEET",
                params={
                    "text": full_text,
                    "media_url": image_url
                }
            )
            
            logger.info("Successfully posted to Twitter")
            return {"status": "success", "platform": "twitter", "result": result}
            
        except Exception as e:
            logger.error(f"Error posting to Twitter: {e}")
            return {"status": "error", "platform": "twitter", "error": str(e)}
    
    async def post_to_facebook(
        self, 
        text: str, 
        image_url: str = None,
        hashtags: List[str] = None
    ) -> Dict[str, Any]:
        """Post content to Facebook."""
        try:
            # Format post with hashtags
            full_text = text
            if hashtags:
                full_text += "\n\n" + " ".join(f"#{tag}" for tag in hashtags)
            
            result = await self.composio.execute_action(
                action="FACEBOOK_CREATE_POST",
                params={
                    "message": full_text,
                    "image_url": image_url
                }
            )
            
            logger.info("Successfully posted to Facebook")
            return {"status": "success", "platform": "facebook", "result": result}
            
        except Exception as e:
            logger.error(f"Error posting to Facebook: {e}")
            return {"status": "error", "platform": "facebook", "error": str(e)}
    
    async def post_to_all_platforms(
        self, 
        text: str, 
        image_url: str = None,
        hashtags: List[str] = None,
        platforms: List[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Post content to multiple social platforms."""
        if platforms is None:
            platforms = ["linkedin", "twitter", "facebook"]
        
        results = []
        
        for platform in platforms:
            if platform == "linkedin":
                result = await self.post_to_linkedin(text, image_url, hashtags)
            elif platform == "twitter":
                result = await self.post_to_twitter(text, image_url, hashtags)
            elif platform == "facebook":
                result = await self.post_to_facebook(text, image_url, hashtags)
            else:
                result = {"status": "error", "platform": platform, "error": "Unsupported platform"}
            
            results.append(result)
        
        return {"results": results}