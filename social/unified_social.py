"""
Unified Social Media Management
Single interface for posting to all platforms with brand integration
"""

import asyncio
import yaml
from typing import Dict, Any, List, Optional
from datetime import datetime
from .x_social import XSocial
from .facebook_social import FacebookSocial
from .youtube_social import YouTubeSocial
from .linkedin_social import LinkedInSocial


class UnifiedSocialManager:
    """
    Unified social media management across all platforms
    Drop-in replacement for Composio with brand integration
    """
    
    def __init__(self, brand_config: Dict[str, Any], tokens: Dict[str, str]):
        """
        Initialize unified social manager
        
        Args:
            brand_config: Brand configuration dictionary from YAML
            tokens: Dict of platform tokens {'x': 'token', 'facebook': 'token', etc.}
        """
        self.brand_config = brand_config
        self.tokens = tokens
        self.brand_name = brand_config.get("name", "Unknown Brand")
        
        # Initialize platform managers
        self.platforms = {}
        
        # X (Twitter)
        if tokens.get("x") or tokens.get("twitter"):
            self.platforms["x"] = XSocial(
                tokens.get("x") or tokens.get("twitter"), 
                brand_config
            )
        
        # Facebook Pages
        if tokens.get("facebook"):
            self.platforms["facebook"] = FacebookSocial(
                tokens.get("facebook"),
                brand_config
            )
        
        # YouTube
        if tokens.get("youtube"):
            self.platforms["youtube"] = YouTubeSocial(
                tokens.get("youtube"),
                brand_config
            )
        
        # LinkedIn
        if tokens.get("linkedin"):
            organization_id = brand_config.get("social", {}).get("linkedin_author", "").replace("urn:li:organization:", "") or "106542185"
            self.platforms["linkedin"] = LinkedInSocial(
                access_token=tokens.get("linkedin"),
                brand_config=brand_config,
                organization_id=organization_id
            )
    
    @classmethod
    def from_brand_file(cls, brand_file_path: str, tokens: Dict[str, str]):
        """Create UnifiedSocialManager from brand YAML file"""
        with open(brand_file_path, 'r') as f:
            brand_config = yaml.safe_load(f)
        return cls(brand_config, tokens)
    
    async def health_check_all(self) -> Dict[str, Any]:
        """Check health of all configured platforms"""
        health_results = {}
        
        for platform_name, manager in self.platforms.items():
            try:
                health = await manager.health_check()
                health_results[platform_name] = health
            except Exception as e:
                health_results[platform_name] = {
                    "success": False,
                    "platform": platform_name,
                    "error": str(e),
                    "brand": self.brand_name
                }
        
        return {
            "success": len([h for h in health_results.values() if h.get("success")]) > 0,
            "brand": self.brand_name,
            "platforms_configured": list(self.platforms.keys()),
            "platforms_healthy": [name for name, health in health_results.items() if health.get("success")],
            "platform_results": health_results,
            "timestamp": datetime.now().isoformat()
        }
    
    async def post_to_all_platforms(self, content: str, 
                                   platforms: List[str] = None,
                                   media_paths: List[str] = None,
                                   hashtags: List[str] = None,
                                   **platform_specific_args) -> Dict[str, Any]:
        """
        Post content to multiple platforms simultaneously
        
        Args:
            content: Main content text
            platforms: List of platforms to post to (defaults to all configured)
            media_paths: List of media file paths
            hashtags: List of hashtags
            **platform_specific_args: Platform-specific arguments
            
        Returns:
            Dict with results from all platforms
        """
        if not platforms:
            platforms = list(self.platforms.keys())
        
        # Filter to only configured platforms
        platforms = [p for p in platforms if p in self.platforms]
        
        if not platforms:
            return {
                "success": False,
                "error": "No configured platforms specified",
                "brand": self.brand_name,
                "platforms_requested": platforms,
                "platforms_configured": list(self.platforms.keys())
            }
        
        # Post to platforms concurrently
        tasks = []
        for platform in platforms:
            task = self._post_to_platform(
                platform, content, media_paths, hashtags, platform_specific_args
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        platform_results = {}
        successful_posts = 0
        
        for i, result in enumerate(results):
            platform = platforms[i]
            if isinstance(result, Exception):
                platform_results[platform] = {
                    "success": False,
                    "platform": platform,
                    "error": str(result),
                    "brand": self.brand_name
                }
            else:
                platform_results[platform] = result
                if result.get("success"):
                    successful_posts += 1
        
        return {
            "success": successful_posts > 0,
            "brand": self.brand_name,
            "total_platforms": len(platforms),
            "successful_posts": successful_posts,
            "platforms_posted": platforms,
            "content_length": len(content),
            "media_count": len(media_paths) if media_paths else 0,
            "hashtag_count": len(hashtags) if hashtags else 0,
            "platform_results": platform_results,
            "timestamp": datetime.now().isoformat()
        }
    
    async def _post_to_platform(self, platform: str, content: str,
                               media_paths: List[str] = None,
                               hashtags: List[str] = None,
                               platform_args: Dict[str, Any] = None) -> Dict[str, Any]:
        """Post to a specific platform"""
        try:
            manager = self.platforms.get(platform)
            if not manager:
                return {
                    "success": False,
                    "platform": platform,
                    "error": f"Platform {platform} not configured",
                    "brand": self.brand_name
                }
            
            if platform_args is None:
                platform_args = {}
            
            # Platform-specific posting logic
            if platform == "x":
                return await manager.post_content(
                    content, media_paths, hashtags,
                    **platform_args
                )
            elif platform == "facebook":
                return await manager.post_content(
                    content, media_paths,
                    **platform_args
                )
            elif platform == "youtube":
                # YouTube requires different parameters
                video_path = media_paths[0] if media_paths else None
                if not video_path:
                    return {
                        "success": False,
                        "platform": platform,
                        "error": "YouTube requires a video file",
                        "brand": self.brand_name
                    }
                
                title = platform_args.get("title", content[:60])
                return await manager.upload_video(
                    video_path, title, content, hashtags,
                    **{k: v for k, v in platform_args.items() if k != "title"}
                )
            elif platform == "linkedin":
                # LinkedIn uses existing system
                return await manager.post_content(
                    content, media_paths[0] if media_paths else None
                )
            else:
                return {
                    "success": False,
                    "platform": platform,
                    "error": f"Posting not implemented for {platform}",
                    "brand": self.brand_name
                }
                
        except Exception as e:
            return {
                "success": False,
                "platform": platform,
                "error": f"Platform posting failed: {str(e)}",
                "brand": self.brand_name
            }
    
    async def post_to_platform(self, platform: str, content: str,
                              media_paths: List[str] = None,
                              hashtags: List[str] = None,
                              **kwargs) -> Dict[str, Any]:
        """Post to a single specific platform"""
        return await self._post_to_platform(platform, content, media_paths, hashtags, kwargs)
    
    async def get_analytics_summary(self, platforms: List[str] = None,
                                   time_range: str = "7d") -> Dict[str, Any]:
        """Get analytics summary across platforms"""
        if not platforms:
            platforms = list(self.platforms.keys())
        
        analytics_results = {}
        
        for platform in platforms:
            manager = self.platforms.get(platform)
            if not manager:
                continue
            
            try:
                if hasattr(manager, 'generate_analytics_report'):
                    analytics = await manager.generate_analytics_report(time_range)
                elif hasattr(manager, 'get_account_analytics'):
                    analytics = await manager.get_account_analytics()
                else:
                    analytics = {
                        "success": False,
                        "error": "Analytics not available for this platform"
                    }
                
                analytics_results[platform] = analytics
                
            except Exception as e:
                analytics_results[platform] = {
                    "success": False,
                    "platform": platform,
                    "error": str(e),
                    "brand": self.brand_name
                }
        
        return {
            "success": len([a for a in analytics_results.values() if a.get("success")]) > 0,
            "brand": self.brand_name,
            "time_range": time_range,
            "platforms_analyzed": list(analytics_results.keys()),
            "analytics_results": analytics_results,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_configured_platforms(self) -> List[str]:
        """Get list of configured platforms"""
        return list(self.platforms.keys())
    
    def get_brand_voice_summary(self) -> Dict[str, Any]:
        """Get brand voice configuration"""
        voice = self.brand_config.get("voice", {})
        platforms_config = self.brand_config.get("platforms", {})
        
        return {
            "brand_name": self.brand_name,
            "voice": voice,
            "platforms_configured": list(self.platforms.keys()),
            "platform_settings": {
                platform: {
                    "max_chars": config.get("max_chars"),
                    "hashtag_limit": config.get("hashtag_limit"),
                    "optimal_times": config.get("optimal_times", [])
                }
                for platform, config in platforms_config.items()
            },
            "social_handles": self.brand_config.get("social", {}),
            "content_themes": self.brand_config.get("topics", [])
        }
    
    async def schedule_content(self, content: str, scheduled_time: datetime,
                              platforms: List[str] = None,
                              **kwargs) -> Dict[str, Any]:
        """
        Schedule content for future posting
        Note: Implementation depends on platform support
        """
        return {
            "success": False,
            "error": "Scheduling not yet implemented - requires platform-specific scheduling support",
            "brand": self.brand_name,
            "suggestion": "Use external scheduling tools or implement platform-specific scheduling"
        }


# Compatibility function for existing agent-social pipeline
async def post_to_platforms(content: str, brand_config: Dict[str, Any], 
                           platforms: List[str] = None,
                           media_paths: List[str] = None,
                           tokens: Dict[str, str] = None) -> Dict[str, Any]:
    """
    Drop-in replacement for Composio posting function
    
    Args:
        content: Content to post
        brand_config: Brand configuration
        platforms: List of platforms to post to
        media_paths: List of media file paths
        tokens: Platform access tokens
        
    Returns:
        Unified posting results
    """
    if not tokens:
        # Try to get tokens from environment
        import os
        tokens = {
            "x": os.getenv("X_ACCESS_TOKEN"),
            "twitter": os.getenv("TWITTER_ACCESS_TOKEN"),  # Alias
            "facebook": os.getenv("FACEBOOK_ACCESS_TOKEN"),
            "youtube": os.getenv("YOUTUBE_ACCESS_TOKEN"),
            "linkedin": os.getenv("LINKEDIN_ACCESS_TOKEN")
        }
        # Remove None values
        tokens = {k: v for k, v in tokens.items() if v}
    
    if not tokens:
        return {
            "success": False,
            "error": "No platform access tokens provided",
            "platforms_requested": platforms or ["all"]
        }
    
    manager = UnifiedSocialManager(brand_config, tokens)
    return await manager.post_to_all_platforms(content, platforms, media_paths)