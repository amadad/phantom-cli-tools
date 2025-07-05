"""
Facebook Complete Social Management
All Facebook Pages functionality in a single file with brand integration
"""

import os
import asyncio
import aiohttp
import json
import yaml
from typing import Dict, Any, List, Optional
from datetime import datetime


class FacebookSocial:
    """Complete Facebook Pages management with brand integration"""
    
    def __init__(self, access_token: str, brand_config: Dict[str, Any]):
        self.access_token = access_token
        self.brand_config = brand_config
        self.base_url = "https://graph.facebook.com/v19.0"
        
        # Extract Facebook specific config
        self.facebook_config = brand_config.get("platforms", {}).get("facebook", {})
        self.social_config = brand_config.get("social", {})
        self.voice_config = brand_config.get("voice", {})
        
        # Platform settings from brand config
        self.character_limit = self.facebook_config.get("max_chars", 5000)
        self.video_length_limit = self.facebook_config.get("video_length", 60)
        
        # Facebook Page ID from brand config
        self.page_id = self.social_config.get("facebook_page")
    
    @classmethod
    def from_brand_file(cls, access_token: str, brand_file_path: str):
        """Create FacebookSocial from brand YAML file"""
        with open(brand_file_path, 'r') as f:
            brand_config = yaml.safe_load(f)
        return cls(access_token, brand_config)
    
    # =============================================================================
    # CORE FUNCTIONALITY
    # =============================================================================
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Facebook Pages API connection and page access"""
        try:
            if not self.page_id:
                return {
                    "success": False,
                    "platform": "facebook",
                    "error": "No Facebook page ID configured in brand settings",
                    "brand": self.brand_config.get("name")
                }
            
            # Get page information
            params = {
                "access_token": self.access_token,
                "fields": "id,name,category,fan_count,followers_count,link"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/{self.page_id}",
                    params=params
                ) as response:
                    if response.status == 200:
                        page_data = await response.json()
                        return {
                            "success": True,
                            "platform": "facebook",
                            "page_id": page_data.get("id"),
                            "page_name": page_data.get("name"),
                            "category": page_data.get("category"),
                            "fan_count": page_data.get("fan_count", 0),
                            "followers_count": page_data.get("followers_count", 0),
                            "page_url": page_data.get("link"),
                            "brand": self.brand_config.get("name"),
                            "status": "connected"
                        }
                    else:
                        error_data = await response.json()
                        return {
                            "success": False,
                            "platform": "facebook",
                            "error": error_data.get("error", {}).get("message", "Authentication failed"),
                            "error_code": error_data.get("error", {}).get("code"),
                            "status_code": response.status,
                            "brand": self.brand_config.get("name")
                        }
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": str(e),
                "status": "connection_failed",
                "brand": self.brand_config.get("name")
            }
    
    async def post_content(self, content: str, 
                          media_paths: List[str] = None,
                          link_url: str = None,
                          link_title: str = None,
                          link_description: str = None,
                          scheduled_time: datetime = None) -> Dict[str, Any]:
        """Post content to Facebook Page with brand formatting"""
        try:
            if not self.page_id:
                return {
                    "success": False,
                    "platform": "facebook",
                    "error": "No Facebook page ID configured",
                    "brand": self.brand_config.get("name")
                }
            
            # Format content according to brand guidelines
            formatted_content = self._format_content_for_brand(content)
            
            # Determine post type and handle accordingly
            if media_paths and len(media_paths) > 0:
                if len(media_paths) == 1:
                    return await self._post_single_media(formatted_content, media_paths[0], scheduled_time)
                else:
                    return await self._post_multiple_media(formatted_content, media_paths, scheduled_time)
            elif link_url:
                return await self._post_with_link(formatted_content, link_url, link_title, link_description, scheduled_time)
            else:
                return await self._post_text_only(formatted_content, scheduled_time)
                
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": f"Posting failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    # =============================================================================
    # POSTING METHODS
    # =============================================================================
    
    async def _post_text_only(self, content: str, scheduled_time: datetime = None) -> Dict[str, Any]:
        """Post text-only content"""
        try:
            post_data = {
                "message": content,
                "access_token": self.access_token
            }
            
            # Add scheduling if specified
            if scheduled_time:
                # Convert to Unix timestamp
                timestamp = int(scheduled_time.timestamp())
                post_data["scheduled_publish_time"] = timestamp
                post_data["published"] = "false"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/{self.page_id}/feed",
                    data=post_data
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 200:
                        post_id = response_data.get("id")
                        return {
                            "success": True,
                            "platform": "facebook",
                            "post_type": "text",
                            "post_id": post_id,
                            "post_url": f"https://facebook.com/{post_id}",
                            "content_length": len(content),
                            "scheduled": bool(scheduled_time),
                            "scheduled_time": scheduled_time.isoformat() if scheduled_time else None,
                            "brand": self.brand_config.get("name"),
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "platform": "facebook",
                            "error": response_data.get("error", {}).get("message", "Unknown error"),
                            "error_code": response_data.get("error", {}).get("code"),
                            "status_code": response.status,
                            "brand": self.brand_config.get("name")
                        }
                        
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": f"Text posting failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    async def _post_single_media(self, content: str, media_path: str, scheduled_time: datetime = None) -> Dict[str, Any]:
        """Post content with single media file"""
        try:
            # Upload media first
            media_id = await self._upload_media(media_path)
            if not media_id:
                return {
                    "success": False,
                    "platform": "facebook",
                    "error": f"Failed to upload media: {media_path}",
                    "brand": self.brand_config.get("name")
                }
            
            # Determine if it's a photo or video
            is_video = media_path.lower().endswith(('.mp4', '.mov', '.avi'))
            endpoint = f"{self.page_id}/videos" if is_video else f"{self.page_id}/photos"
            
            post_data = {
                "message": content,
                "access_token": self.access_token
            }
            
            if is_video:
                post_data["file_url"] = media_id
            else:
                post_data["url"] = media_id
            
            # Add scheduling if specified
            if scheduled_time:
                timestamp = int(scheduled_time.timestamp())
                post_data["scheduled_publish_time"] = timestamp
                post_data["published"] = "false"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/{endpoint}",
                    data=post_data
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 200:
                        post_id = response_data.get("id") or response_data.get("post_id")
                        return {
                            "success": True,
                            "platform": "facebook",
                            "post_type": "video" if is_video else "photo",
                            "post_id": post_id,
                            "post_url": f"https://facebook.com/{post_id}",
                            "media_path": media_path,
                            "content_length": len(content),
                            "scheduled": bool(scheduled_time),
                            "brand": self.brand_config.get("name"),
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "platform": "facebook",
                            "error": response_data.get("error", {}).get("message", "Media posting failed"),
                            "error_code": response_data.get("error", {}).get("code"),
                            "brand": self.brand_config.get("name")
                        }
                        
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": f"Media posting failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    # =============================================================================
    # ANALYTICS METHODS
    # =============================================================================
    
    async def get_page_insights(self, metrics: List[str] = None, period: str = "day") -> Dict[str, Any]:
        """Get Facebook Page insights and analytics"""
        try:
            if not metrics:
                metrics = [
                    "page_fans", "page_impressions", "page_engaged_users",
                    "page_post_engagements", "page_posts_impressions"
                ]
            
            params = {
                "metric": ",".join(metrics),
                "period": period,
                "access_token": self.access_token
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/{self.page_id}/insights",
                    params=params
                ) as response:
                    if response.status == 200:
                        insights_data = await response.json()
                        
                        # Process insights data
                        processed_insights = {}
                        for insight in insights_data.get("data", []):
                            metric_name = insight.get("name")
                            values = insight.get("values", [])
                            if values:
                                latest_value = values[-1].get("value", 0)
                                processed_insights[metric_name] = latest_value
                        
                        return {
                            "success": True,
                            "platform": "facebook",
                            "page_id": self.page_id,
                            "period": period,
                            "metrics": processed_insights,
                            "brand": self.brand_config.get("name"),
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        error_data = await response.json()
                        return {
                            "success": False,
                            "platform": "facebook",
                            "error": error_data.get("error", {}).get("message", "Insights failed"),
                            "brand": self.brand_config.get("name")
                        }
                        
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": f"Insights error: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    async def generate_analytics_report(self, time_range: str = "30d") -> Dict[str, Any]:
        """Generate comprehensive analytics report"""
        try:
            # Get page insights
            insights = await self.get_page_insights()
            
            # Extract key metrics
            insights_data = []
            
            if insights.get("success"):
                metrics = insights.get("metrics", {})
                page_fans = metrics.get("page_fans", 0)
                page_impressions = metrics.get("page_impressions", 0)
                engaged_users = metrics.get("page_engaged_users", 0)
                
                insights_data.append(f"Page fans: {page_fans:,}")
                insights_data.append(f"Page impressions: {page_impressions:,}")
                insights_data.append(f"Engaged users: {engaged_users:,}")
                
                if page_impressions > 0:
                    engagement_rate = round((engaged_users / page_impressions) * 100, 2)
                    insights_data.append(f"Engagement rate: {engagement_rate}%")
            
            return {
                "success": True,
                "platform": "facebook",
                "brand": self.brand_config.get("name"),
                "report_period": time_range,
                "page_insights": insights,
                "key_insights": insights_data,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": f"Report generation error: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def _format_content_for_brand(self, content: str) -> str:
        """Format content according to Facebook brand guidelines"""
        # Use platform content template if available
        template = self.facebook_config.get("content_template", "{core_message}")
        
        # Apply template
        if "{core_message}" in template:
            formatted_content = template.replace("{core_message}", content)
        elif "{full_story}" in template:
            formatted_content = template.replace("{full_story}", content)
        else:
            formatted_content = content
        
        # Facebook allows longer content, so expand if needed
        if len(formatted_content) < self.character_limit * 0.5:
            voice_attributes = self.voice_config.get("attributes", [])
            if "empathetic" in voice_attributes:
                # Add community-focused language for empathetic brands
                if not any(word in formatted_content.lower() for word in ["community", "together", "support"]):
                    formatted_content += "\n\n👥 Tag someone who needs to see this"
        
        return formatted_content.strip()
    
    async def _upload_media(self, media_path: str, for_album: bool = False) -> Optional[str]:
        """Upload media file to Facebook"""
        try:
            if not os.path.exists(media_path):
                print(f"⚠️ Media file not found: {media_path}")
                return None
            
            # Determine if it's a video or photo
            is_video = media_path.lower().endswith(('.mp4', '.mov', '.avi'))
            
            # For album uploads, use unpublished photos
            if for_album and not is_video:
                endpoint = f"{self.base_url}/{self.page_id}/photos"
                data = {
                    "access_token": self.access_token,
                    "published": "false"
                }
            else:
                endpoint = f"{self.base_url}/{self.page_id}/photos" if not is_video else f"{self.base_url}/{self.page_id}/videos"
                data = {"access_token": self.access_token}
            
            with open(media_path, 'rb') as media_file:
                async with aiohttp.ClientSession() as session:
                    form_data = aiohttp.FormData()
                    form_data.add_field('source', media_file, filename=os.path.basename(media_path))
                    for key, value in data.items():
                        form_data.add_field(key, value)
                    
                    async with session.post(endpoint, data=form_data) as response:
                        if response.status == 200:
                            upload_data = await response.json()
                            return upload_data.get("id")
                        else:
                            error_data = await response.json()
                            print(f"❌ Media upload failed: {error_data}")
                            return None
                            
        except Exception as e:
            print(f"❌ Media upload error: {e}")
            return None
    
    async def _post_with_link(self, content: str, link_url: str, link_title: str = None, 
                            link_description: str = None, scheduled_time: datetime = None) -> Dict[str, Any]:
        """Post content with link attachment"""
        try:
            post_data = {
                "message": content,
                "link": link_url,
                "access_token": self.access_token
            }
            
            if link_title:
                post_data["name"] = link_title
            if link_description:
                post_data["description"] = link_description
            
            # Add scheduling if specified
            if scheduled_time:
                timestamp = int(scheduled_time.timestamp())
                post_data["scheduled_publish_time"] = timestamp
                post_data["published"] = "false"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/{self.page_id}/feed",
                    data=post_data
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 200:
                        post_id = response_data.get("id")
                        return {
                            "success": True,
                            "platform": "facebook",
                            "post_type": "link",
                            "post_id": post_id,
                            "post_url": f"https://facebook.com/{post_id}",
                            "link_url": link_url,
                            "content_length": len(content),
                            "scheduled": bool(scheduled_time),
                            "brand": self.brand_config.get("name"),
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "platform": "facebook",
                            "error": response_data.get("error", {}).get("message", "Link posting failed"),
                            "error_code": response_data.get("error", {}).get("code"),
                            "brand": self.brand_config.get("name")
                        }
                        
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": f"Link posting failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    async def _post_multiple_media(self, content: str, media_paths: List[str], scheduled_time: datetime = None) -> Dict[str, Any]:
        """Post content with multiple media files (album)"""
        try:
            # Upload all media files
            media_ids = []
            for media_path in media_paths:
                media_id = await self._upload_media(media_path, for_album=True)
                if media_id:
                    media_ids.append({"media_fbid": media_id})
                await asyncio.sleep(1)  # Rate limiting
            
            if not media_ids:
                return {
                    "success": False,
                    "platform": "facebook",
                    "error": "Failed to upload any media files",
                    "brand": self.brand_config.get("name")
                }
            
            post_data = {
                "message": content,
                "attached_media": json.dumps(media_ids),
                "access_token": self.access_token
            }
            
            # Add scheduling if specified
            if scheduled_time:
                timestamp = int(scheduled_time.timestamp())
                post_data["scheduled_publish_time"] = timestamp
                post_data["published"] = "false"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/{self.page_id}/feed",
                    data=post_data
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 200:
                        post_id = response_data.get("id")
                        return {
                            "success": True,
                            "platform": "facebook",
                            "post_type": "album",
                            "post_id": post_id,
                            "post_url": f"https://facebook.com/{post_id}",
                            "media_count": len(media_ids),
                            "media_paths": media_paths,
                            "content_length": len(content),
                            "scheduled": bool(scheduled_time),
                            "brand": self.brand_config.get("name"),
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "platform": "facebook",
                            "error": response_data.get("error", {}).get("message", "Album posting failed"),
                            "error_code": response_data.get("error", {}).get("code"),
                            "brand": self.brand_config.get("name")
                        }
                        
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": f"Album posting failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    def get_brand_voice_summary(self) -> Dict[str, Any]:
        """Get brand voice configuration for Facebook"""
        return {
            "brand_name": self.brand_config.get("name"),
            "tone": self.voice_config.get("tone"),
            "style": self.voice_config.get("style"),
            "attributes": self.voice_config.get("attributes", []),
            "platform": "facebook",
            "character_limit": self.character_limit,
            "video_length_limit": self.video_length_limit,
            "community_focused": self.facebook_config.get("community_focused", True)
        }
    
    def get_optimal_posting_times(self) -> List[str]:
        """Get optimal posting times from brand config"""
        return self.facebook_config.get("optimal_times", ["9am", "1pm", "3pm"])
    
    async def delete_post(self, post_id: str) -> Dict[str, Any]:
        """Delete a Facebook post"""
        try:
            params = {"access_token": self.access_token}
            
            async with aiohttp.ClientSession() as session:
                async with session.delete(
                    f"{self.base_url}/{post_id}",
                    params=params
                ) as response:
                    success = response.status == 200
                    return {
                        "success": success,
                        "platform": "facebook",
                        "action": "delete",
                        "post_id": post_id,
                        "brand": self.brand_config.get("name"),
                        "timestamp": datetime.now().isoformat()
                    }
        except Exception as e:
            return {
                "success": False,
                "platform": "facebook",
                "error": f"Delete failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }