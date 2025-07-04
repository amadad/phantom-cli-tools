"""
LinkedIn Integration for Agent Social Pipeline
Replaces Composio with direct LinkedIn API management
"""
import os
import asyncio
from typing import Dict, Any, Optional
from .linkedin_management import (
    LinkedInPoster, 
    LinkedInMediaManager, 
    LinkedInAnalytics, 
    LinkedInEngagement, 
    LinkedInMonitoring
)

class LinkedInManager:
    """
    Comprehensive LinkedIn management for agent-social pipeline.
    Replaces Composio integration completely.
    """
    
    def __init__(self, access_token: Optional[str] = None, organization_id: str = "106542185"):
        self.access_token = access_token or os.getenv('LINKEDIN_ACCESS_TOKEN')
        self.organization_id = organization_id
        
        # Initialize all management modules
        self.poster = LinkedInPoster(access_token, organization_id)
        self.media = LinkedInMediaManager(access_token, organization_id)
        self.analytics = LinkedInAnalytics(access_token, organization_id)
        self.engagement = LinkedInEngagement(access_token, organization_id)
        self.monitoring = LinkedInMonitoring(access_token, organization_id)
    
    async def post_content(self, content: str, image_path: Optional[str] = None, 
                          visibility: str = "PUBLIC") -> Dict[str, Any]:
        """
        Main posting function for agent-social pipeline.
        
        Args:
            content: Text content to post
            image_path: Optional path to image file
            visibility: Post visibility
            
        Returns:
            Dict with posting results
        """
        try:
            # Upload image if provided
            media_id = None
            if image_path:
                print(f"📸 Uploading image: {image_path}")
                upload_result = self.media.upload_image_file(image_path)
                
                if upload_result["success"]:
                    media_id = upload_result["asset_id"]
                    print(f"✅ Image uploaded: {media_id}")
                else:
                    print(f"❌ Image upload failed: {upload_result.get('error')}")
                    # Continue without image
            
            # Create post
            if media_id:
                result = self.poster.create_media_post(content, media_id, "image", visibility)
            else:
                result = self.poster.create_text_post(content, visibility)
            
            if result["success"]:
                print(f"✅ Posted to LinkedIn successfully!")
                print(f"📱 Post ID: {result.get('post_info', {}).get('post_id', 'Unknown')}")
                
                # Get post analytics after a brief delay
                await asyncio.sleep(2)
                analytics_result = await self.get_post_performance(result.get('post_info', {}).get('post_id'))
                if analytics_result:
                    result["initial_analytics"] = analytics_result
            else:
                print(f"❌ LinkedIn posting failed: {result.get('error')}")
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": f"LinkedIn posting error: {str(e)}"
            }
    
    async def get_post_performance(self, post_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get performance metrics for posts.
        
        Args:
            post_id: Specific post ID, or None for recent posts
            
        Returns:
            Dict with performance metrics
        """
        if post_id:
            # Get specific post metrics
            return self.engagement.get_social_metadata(post_id)
        else:
            # Get overall analytics
            return self.analytics.get_comprehensive_analytics("7d")
    
    async def auto_engage(self, keywords: list = None, max_interactions: int = 5) -> Dict[str, Any]:
        """
        Automatically engage with relevant content.
        
        Args:
            keywords: Keywords to search for (defaults to brand keywords)
            max_interactions: Maximum number of interactions
            
        Returns:
            Dict with engagement results
        """
        if not keywords:
            keywords = ["caregiving", "caregiver", "eldercare", "healthcare", "family care"]
        
        return self.engagement.auto_engage_with_keywords(keywords, "LIKE", max_interactions)
    
    async def monitor_mentions(self, callback_function=None) -> Dict[str, Any]:
        """
        Start monitoring for brand mentions.
        
        Args:
            callback_function: Function to call when mentions are found
            
        Returns:
            Dict with monitoring status
        """
        keywords = ["givecare", "give care", "@givecareapp"]
        monitor_config = self.monitoring.monitor_brand_mentions(keywords)
        
        if monitor_config["success"]:
            return self.monitoring.start_monitoring(callback_function)
        
        return monitor_config
    
    async def generate_analytics_report(self, time_range: str = "30d") -> Dict[str, Any]:
        """
        Generate comprehensive analytics report.
        
        Args:
            time_range: Time range for analytics
            
        Returns:
            Dict with analytics report
        """
        analytics = self.analytics.get_comprehensive_analytics(time_range)
        
        if analytics["success"]:
            # Export to CSV
            export_result = self.analytics.export_analytics_csv(time_range, f"linkedin_analytics_{time_range}.csv")
            if export_result["success"]:
                analytics["export_file"] = export_result["output_file"]
        
        return analytics
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check LinkedIn API connection health.
        
        Returns:
            Dict with health status
        """
        return self.poster.health_check()

# Integration function for agent-social pipeline (replaces Composio)
async def post_to_linkedin_direct(content: str, brand_config: Dict[str, Any], 
                                 image_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Direct LinkedIn posting function for agent-social pipeline.
    Drop-in replacement for Composio integration.
    
    Args:
        content: Content to post
        brand_config: Brand configuration dict
        image_url: Optional image URL
        
    Returns:
        Dict with posting results matching Composio format
    """
    try:
        # Extract organization ID from brand config
        linkedin_author = brand_config.get("social", {}).get("linkedin_author", "")
        if linkedin_author.startswith("urn:li:organization:"):
            org_id = linkedin_author.replace("urn:li:organization:", "")
        else:
            org_id = "106542185"  # Default GiveCare
        
        # Initialize LinkedIn manager
        manager = LinkedInManager(organization_id=org_id)
        
        # Convert image URL to local path if needed
        image_path = None
        if image_url and image_url.startswith("http"):
            # In a real implementation, you'd download the image
            # For now, we'll skip image posting from URLs
            print(f"⚠️ Image URL provided but not downloaded: {image_url}")
        elif image_url and os.path.exists(image_url):
            image_path = image_url
        
        # Post content
        result = await manager.post_content(content, image_path)
        
        # Format result to match Composio format for compatibility
        if result["success"]:
            return {
                "status": "posted",
                "platform": "linkedin",
                "result": result.get("data", {}),
                "image_included": bool(image_path),
                "timestamp": result.get("timestamp"),
                "post_info": result.get("post_info", {})
            }
        else:
            return {
                "status": "failed",
                "error": result.get("error"),
                "platform": "linkedin",
                "timestamp": result.get("timestamp")
            }
            
    except Exception as e:
        return {
            "status": "failed",
            "error": f"LinkedIn integration error: {str(e)}",
            "platform": "linkedin"
        }