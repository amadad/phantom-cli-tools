"""
LinkedIn Complete Social Management
All LinkedIn functionality in a single file with brand integration
"""

import os
import requests
import json
import yaml
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio


class LinkedInSocial:
    """Complete LinkedIn management with brand integration"""
    
    def __init__(self, access_token: Optional[str] = None, brand_config: Dict[str, Any] = None, organization_id: str = "106542185"):
        self.access_token = access_token or os.getenv('LINKEDIN_ACCESS_TOKEN')
        self.brand_config = brand_config or {}
        self.organization_id = organization_id
        self.organization_urn = f"urn:li:organization:{organization_id}"
        self.base_url = "https://api.linkedin.com"
        
        # Extract LinkedIn specific config
        self.linkedin_config = self.brand_config.get("platforms", {}).get("linkedin", {})
        self.social_config = self.brand_config.get("social", {})
        self.voice_config = self.brand_config.get("voice", {})
        
        # Platform settings
        self.character_limit = self.linkedin_config.get("max_chars", 3000)
        self.hashtag_limit = self.linkedin_config.get("hashtag_limit", 5)
        
        # Headers for API requests
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "LinkedIn-Version": "202307"
        }
    
    @classmethod
    def from_brand_file(cls, access_token: str, brand_file_path: str, organization_id: str = "106542185"):
        """Create LinkedInSocial from brand YAML file"""
        with open(brand_file_path, 'r') as f:
            brand_config = yaml.safe_load(f)
        return cls(access_token, brand_config, organization_id)
    
    # =============================================================================
    # CORE FUNCTIONALITY
    # =============================================================================
    
    def health_check(self) -> Dict[str, Any]:
        """Check LinkedIn API connection health"""
        try:
            if not self.access_token:
                return {
                    "success": False,
                    "platform": "linkedin",
                    "error": "No access token provided",
                    "brand": self.brand_config.get("name", "Unknown")
                }
            
            # Test API connection with organization info
            response = requests.get(
                f"{self.base_url}/v2/organizations/{self.organization_id}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                org_data = response.json()
                return {
                    "success": True,
                    "platform": "linkedin", 
                    "organization_id": self.organization_id,
                    "organization_name": org_data.get("localizedName", "Unknown"),
                    "follower_count": org_data.get("followersCount", 0),
                    "brand": self.brand_config.get("name", "Unknown"),
                    "status": "connected"
                }
            else:
                return {
                    "success": False,
                    "platform": "linkedin",
                    "error": f"API connection failed: {response.status_code}",
                    "brand": self.brand_config.get("name", "Unknown")
                }
                
        except Exception as e:
            return {
                "success": False,
                "platform": "linkedin",
                "error": str(e),
                "status": "connection_failed",
                "brand": self.brand_config.get("name", "Unknown")
            }
    
    async def post_content(self, content: str, image_path: Optional[str] = None, 
                          visibility: str = "PUBLIC") -> Dict[str, Any]:
        """
        Post content to LinkedIn with brand formatting
        
        Args:
            content: Text content to post
            image_path: Optional path to image file
            visibility: Post visibility (PUBLIC, CONNECTIONS)
            
        Returns:
            Dict with posting results
        """
        try:
            # Format content according to brand guidelines
            formatted_content = self._format_content_for_brand(content)
            
            # Upload image if provided
            media_id = None
            if image_path:
                print(f"📸 Uploading image: {image_path}")
                upload_result = self._upload_image_file(image_path)
                
                if upload_result["success"]:
                    media_id = upload_result["asset_id"]
                    print(f"✅ Image uploaded: {media_id}")
                else:
                    print(f"❌ Image upload failed: {upload_result.get('error')}")
                    # Continue without image
            
            # Create post
            if media_id:
                result = self._create_media_post(formatted_content, media_id, "image", visibility)
            else:
                result = self._create_text_post(formatted_content, visibility)
            
            if result["success"]:
                print(f"✅ Posted to LinkedIn successfully!")
                print(f"📱 Post ID: {result.get('post_info', {}).get('post_id', 'Unknown')}")
            else:
                print(f"❌ LinkedIn posting failed: {result.get('error')}")
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "platform": "linkedin",
                "error": f"LinkedIn posting error: {str(e)}",
                "brand": self.brand_config.get("name", "Unknown")
            }
    
    # =============================================================================
    # POSTING METHODS
    # =============================================================================
    
    def _create_text_post(self, content: str, visibility: str = "PUBLIC") -> Dict[str, Any]:
        """Create a text-only post on LinkedIn organization page"""
        post_data = {
            "author": self.organization_urn,
            "commentary": content,
            "visibility": visibility,
            "distribution": {
                "feedDistribution": "MAIN_FEED"
            },
            "content": {},
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/rest/posts",
                headers=self.headers,
                json=post_data
            )
            
            if response.status_code == 201:
                response_data = response.json()
                return {
                    "success": True,
                    "platform": "linkedin",
                    "post_type": "text",
                    "post_info": {
                        "post_id": response_data.get("id"),
                        "author": self.organization_urn,
                        "content_preview": content[:100] + "..." if len(content) > 100 else content
                    },
                    "content_length": len(content),
                    "brand": self.brand_config.get("name", "Unknown"),
                    "timestamp": datetime.now().isoformat(),
                    "data": response_data
                }
            else:
                return {
                    "success": False,
                    "platform": "linkedin",
                    "error": f"Post creation failed: {response.status_code} - {response.text}",
                    "brand": self.brand_config.get("name", "Unknown")
                }
                
        except Exception as e:
            return {
                "success": False,
                "platform": "linkedin",
                "error": f"Text post creation failed: {str(e)}",
                "brand": self.brand_config.get("name", "Unknown")
            }
    
    def _create_media_post(self, content: str, media_id: str, media_type: str = "image", 
                          visibility: str = "PUBLIC") -> Dict[str, Any]:
        """Create a post with media (image/video) on LinkedIn organization page"""
        
        # Media content structure based on type
        if media_type == "image":
            media_content = {
                "media": {
                    "id": media_id
                }
            }
        elif media_type == "video":
            media_content = {
                "media": {
                    "id": media_id,
                    "title": content[:100]  # Use content as title for video
                }
            }
        else:
            return {
                "success": False,
                "platform": "linkedin",
                "error": f"Unsupported media type: {media_type}",
                "brand": self.brand_config.get("name", "Unknown")
            }
        
        post_data = {
            "author": self.organization_urn,
            "commentary": content,
            "visibility": visibility,
            "distribution": {
                "feedDistribution": "MAIN_FEED"
            },
            "content": media_content,
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/rest/posts",
                headers=self.headers,
                json=post_data
            )
            
            if response.status_code == 201:
                response_data = response.json()
                return {
                    "success": True,
                    "platform": "linkedin",
                    "post_type": f"media_{media_type}",
                    "post_info": {
                        "post_id": response_data.get("id"),
                        "author": self.organization_urn,
                        "media_id": media_id,
                        "media_type": media_type,
                        "content_preview": content[:100] + "..." if len(content) > 100 else content
                    },
                    "content_length": len(content),
                    "brand": self.brand_config.get("name", "Unknown"),
                    "timestamp": datetime.now().isoformat(),
                    "data": response_data
                }
            else:
                return {
                    "success": False,
                    "platform": "linkedin",
                    "error": f"Media post creation failed: {response.status_code} - {response.text}",
                    "brand": self.brand_config.get("name", "Unknown")
                }
                
        except Exception as e:
            return {
                "success": False,
                "platform": "linkedin",
                "error": f"Media post creation failed: {str(e)}",
                "brand": self.brand_config.get("name", "Unknown")
            }
    
    # =============================================================================
    # MEDIA MANAGEMENT
    # =============================================================================
    
    def _upload_image_file(self, image_path: str) -> Dict[str, Any]:
        """Upload an image file to LinkedIn"""
        try:
            if not os.path.exists(image_path):
                return {
                    "success": False,
                    "error": f"Image file not found: {image_path}"
                }
            
            # Step 1: Register upload
            register_data = {
                "registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": self.organization_urn,
                    "serviceRelationships": [{
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent"
                    }]
                }
            }
            
            response = requests.post(
                f"{self.base_url}/v2/assets?action=registerUpload",
                headers=self.headers,
                json=register_data
            )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"Upload registration failed: {response.status_code} - {response.text}"
                }
            
            register_response = response.json()
            upload_url = register_response["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
            asset_id = register_response["value"]["asset"]
            
            # Step 2: Upload the actual image
            with open(image_path, 'rb') as image_file:
                upload_response = requests.post(upload_url, files={'file': image_file})
            
            if upload_response.status_code != 201:
                return {
                    "success": False,
                    "error": f"Image upload failed: {upload_response.status_code}"
                }
            
            return {
                "success": True,
                "asset_id": asset_id,
                "upload_url": upload_url,
                "file_path": image_path
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Image upload error: {str(e)}"
            }
    
    # =============================================================================
    # ANALYTICS METHODS
    # =============================================================================
    
    def get_organization_stats(self, time_range: str = "7d") -> Dict[str, Any]:
        """Get organization page statistics"""
        try:
            # Calculate date range
            if time_range == "7d":
                days = 7
            elif time_range == "30d":
                days = 30
            else:
                days = 7
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Format dates for LinkedIn API (milliseconds since epoch)
            start_timestamp = int(start_date.timestamp() * 1000)
            end_timestamp = int(end_date.timestamp() * 1000)
            
            params = {
                "q": "organizationalEntity",
                "organizationalEntity": self.organization_urn,
                "timeIntervals": f"({start_timestamp},{end_timestamp})"
            }
            
            response = requests.get(
                f"{self.base_url}/v2/organizationPageStatistics",
                headers=self.headers,
                params=params
            )
            
            if response.status_code == 200:
                stats_data = response.json()
                
                # Process statistics
                stats = {
                    "success": True,
                    "platform": "linkedin", 
                    "organization_id": self.organization_id,
                    "time_range": time_range,
                    "stats": stats_data.get("elements", []),
                    "brand": self.brand_config.get("name", "Unknown"),
                    "timestamp": datetime.now().isoformat()
                }
                
                return stats
            else:
                return {
                    "success": False,
                    "platform": "linkedin",
                    "error": f"Stats retrieval failed: {response.status_code} - {response.text}",
                    "brand": self.brand_config.get("name", "Unknown")
                }
                
        except Exception as e:
            return {
                "success": False,
                "platform": "linkedin",
                "error": f"Analytics error: {str(e)}",
                "brand": self.brand_config.get("name", "Unknown")
            }
    
    def get_post_analytics(self, post_id: str) -> Dict[str, Any]:
        """Get analytics for a specific post"""
        try:
            params = {
                "q": "post",
                "post": f"urn:li:share:{post_id}"
            }
            
            response = requests.get(
                f"{self.base_url}/v2/socialMetadata",
                headers=self.headers,
                params=params
            )
            
            if response.status_code == 200:
                analytics_data = response.json()
                return {
                    "success": True,
                    "platform": "linkedin",
                    "post_id": post_id,
                    "analytics": analytics_data.get("elements", []),
                    "brand": self.brand_config.get("name", "Unknown"),
                    "timestamp": datetime.now().isoformat()
                }
            else:
                return {
                    "success": False,
                    "platform": "linkedin",
                    "error": f"Post analytics failed: {response.status_code} - {response.text}",
                    "brand": self.brand_config.get("name", "Unknown")
                }
                
        except Exception as e:
            return {
                "success": False,
                "platform": "linkedin",
                "error": f"Post analytics error: {str(e)}",
                "brand": self.brand_config.get("name", "Unknown")
            }
    
    async def generate_analytics_report(self, time_range: str = "30d") -> Dict[str, Any]:
        """Generate comprehensive analytics report"""
        try:
            # Get organization stats
            org_stats = self.get_organization_stats(time_range)
            
            # Extract key metrics
            insights = []
            
            if org_stats.get("success"):
                stats_elements = org_stats.get("stats", [])
                if stats_elements:
                    # Process latest stats
                    latest_stats = stats_elements[-1] if stats_elements else {}
                    total_stats = latest_stats.get("totalPageStatistics", {})
                    
                    views = total_stats.get("views", {}).get("allPageViews", {}).get("pageViews", 0)
                    unique_views = total_stats.get("views", {}).get("allPageViews", {}).get("uniquePageViews", 0)
                    
                    insights.append(f"Page views: {views:,} total, {unique_views:,} unique")
            
            return {
                "success": True,
                "platform": "linkedin",
                "brand": self.brand_config.get("name", "Unknown"),
                "report_period": time_range,
                "organization_stats": org_stats,
                "key_insights": insights,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "platform": "linkedin",
                "error": f"Report generation error: {str(e)}",
                "brand": self.brand_config.get("name", "Unknown")
            }
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def _format_content_for_brand(self, content: str) -> str:
        """Format content according to LinkedIn brand guidelines"""
        # Use platform content template if available
        template = self.linkedin_config.get("content_template", "{core_message}")
        
        # Apply template
        if "{core_message}" in template:
            formatted_content = template.replace("{core_message}", content)
        elif "{expanded_story}" in template:
            formatted_content = template.replace("{expanded_story}", content)
        else:
            formatted_content = content
        
        # LinkedIn allows longer content, so we can be more detailed
        voice_attributes = self.voice_config.get("attributes", [])
        if "empathetic" in voice_attributes and len(formatted_content) < self.character_limit * 0.7:
            # Add community engagement for empathetic brands
            if self.brand_config.get("name") == "GiveCare":
                if not any(phrase in formatted_content.lower() for phrase in ["share below", "what's your experience", "thoughts?"]):
                    formatted_content += "\n\nWhat's your experience? Share below. 👇"
        
        # Ensure within character limit
        if len(formatted_content) > self.character_limit:
            formatted_content = formatted_content[:self.character_limit-3] + "..."
        
        return formatted_content.strip()
    
    def get_brand_voice_summary(self) -> Dict[str, Any]:
        """Get brand voice configuration for LinkedIn"""
        return {
            "brand_name": self.brand_config.get("name", "Unknown"),
            "tone": self.voice_config.get("tone"),
            "style": self.voice_config.get("style"),
            "attributes": self.voice_config.get("attributes", []),
            "platform": "linkedin",
            "character_limit": self.character_limit,
            "hashtag_limit": self.hashtag_limit,
            "professional_tone": self.linkedin_config.get("professional_tone", True)
        }
    
    def get_optimal_posting_times(self) -> List[str]:
        """Get optimal posting times from brand config"""
        return self.linkedin_config.get("optimal_times", ["8am", "12pm", "5pm"])
    
    async def delete_post(self, post_id: str) -> Dict[str, Any]:
        """Delete a LinkedIn post"""
        try:
            response = requests.delete(
                f"{self.base_url}/rest/posts/{post_id}",
                headers=self.headers
            )
            
            success = response.status_code == 204  # LinkedIn returns 204 for successful deletion
            
            return {
                "success": success,
                "platform": "linkedin",
                "action": "delete",
                "post_id": post_id,
                "brand": self.brand_config.get("name", "Unknown"),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "platform": "linkedin",
                "error": f"Delete failed: {str(e)}",
                "brand": self.brand_config.get("name", "Unknown")
            }


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
        manager = LinkedInSocial(brand_config=brand_config, organization_id=org_id)
        
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