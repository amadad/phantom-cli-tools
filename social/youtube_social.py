"""
YouTube Complete Social Management
All YouTube functionality in a single file with brand integration
Following Google's official YouTube Data API v3 documentation
"""

import os
import asyncio
import aiohttp
import json
import yaml
import mimetypes
from typing import Dict, Any, List, Optional
from datetime import datetime


class YouTubeSocial:
    """Complete YouTube management with brand integration following Google's API documentation"""
    
    def __init__(self, access_token: str, brand_config: Dict[str, Any]):
        self.access_token = access_token
        self.brand_config = brand_config
        self.base_url = "https://www.googleapis.com/youtube/v3"
        self.upload_url = "https://www.googleapis.com/upload/youtube/v3"
        
        # Extract YouTube specific config
        self.youtube_config = brand_config.get("platforms", {}).get("youtube", {})
        self.social_config = brand_config.get("social", {})
        self.voice_config = brand_config.get("voice", {})
        
        # Platform settings from brand config
        self.video_length_limit = self.youtube_config.get("video_length", 60)
        self.character_limit = self.youtube_config.get("max_chars", 8000)  # Description limit
        
        # Headers for API requests
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        # Upload scopes required (as per Google documentation)
        self.required_scopes = [
            "https://www.googleapis.com/auth/youtube.upload",
            "https://www.googleapis.com/auth/youtube"
        ]
    
    @classmethod
    def from_brand_file(cls, access_token: str, brand_file_path: str):
        """Create YouTubeSocial from brand YAML file"""
        with open(brand_file_path, 'r') as f:
            brand_config = yaml.safe_load(f)
        return cls(access_token, brand_config)
    
    # =============================================================================
    # CORE FUNCTIONALITY
    # =============================================================================
    
    async def health_check(self) -> Dict[str, Any]:
        """Check YouTube API connection and channel access"""
        try:
            # Get channel information (requires authentication)
            params = {
                "part": "snippet,statistics,brandingSettings",
                "mine": "true"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/channels",
                    headers=self.headers,
                    params=params
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        channels = data.get("items", [])
                        
                        if channels:
                            channel = channels[0]
                            snippet = channel.get("snippet", {})
                            statistics = channel.get("statistics", {})
                            
                            return {
                                "success": True,
                                "platform": "youtube",
                                "channel_id": channel.get("id"),
                                "channel_title": snippet.get("title"),
                                "channel_description": snippet.get("description", "")[:200] + "...",
                                "subscriber_count": int(statistics.get("subscriberCount", 0)),
                                "video_count": int(statistics.get("videoCount", 0)),
                                "view_count": int(statistics.get("viewCount", 0)),
                                "brand": self.brand_config.get("name"),
                                "brand_channel": self.social_config.get("youtube_channel", ""),
                                "status": "connected"
                            }
                        else:
                            return {
                                "success": False,
                                "platform": "youtube",
                                "error": "No YouTube channel found for this account",
                                "brand": self.brand_config.get("name")
                            }
                    else:
                        error_data = await response.json()
                        return {
                            "success": False,
                            "platform": "youtube",
                            "error": error_data.get("error", {}).get("message", "Authentication failed"),
                            "error_code": error_data.get("error", {}).get("code"),
                            "status_code": response.status,
                            "brand": self.brand_config.get("name")
                        }
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": str(e),
                "status": "connection_failed",
                "brand": self.brand_config.get("name")
            }
    
    async def upload_video(self, video_path: str, title: str, description: str = "",
                          tags: List[str] = None, category_id: str = "22",
                          privacy_status: str = "public", thumbnail_path: str = None) -> Dict[str, Any]:
        """
        Upload video to YouTube following Google's official documentation
        
        Args:
            video_path: Path to video file
            title: Video title
            description: Video description  
            tags: List of tags
            category_id: YouTube category ID (default: "22" for People & Blogs)
            privacy_status: "public", "private", "unlisted"
            thumbnail_path: Optional custom thumbnail
            
        Returns:
            Dict with upload results
        """
        try:
            if not os.path.exists(video_path):
                return {
                    "success": False,
                    "platform": "youtube",
                    "error": f"Video file not found: {video_path}",
                    "brand": self.brand_config.get("name")
                }
            
            # Format metadata according to brand guidelines
            formatted_title = self._format_title_for_brand(title)
            formatted_description = self._format_description_for_brand(description)
            brand_tags = self._get_brand_tags(tags)
            
            # Step 1: Create video metadata (as per Google documentation)
            video_metadata = {
                "snippet": {
                    "title": formatted_title,
                    "description": formatted_description,
                    "tags": brand_tags,
                    "categoryId": category_id,
                    "defaultLanguage": "en",
                    "defaultAudioLanguage": "en"
                },
                "status": {
                    "privacyStatus": privacy_status,
                    "selfDeclaredMadeForKids": False
                }
            }
            
            # Check for synthetic/AI content (new requirement)
            if self._contains_synthetic_content(formatted_description):
                video_metadata["status"]["containsSyntheticMedia"] = True
            
            # Step 2: Upload video file
            upload_result = await self._upload_video_file(video_path, video_metadata)
            
            if not upload_result.get("success"):
                return upload_result
            
            video_id = upload_result.get("video_id")
            
            # Step 3: Upload custom thumbnail if provided
            if thumbnail_path and os.path.exists(thumbnail_path):
                thumbnail_result = await self._upload_thumbnail(video_id, thumbnail_path)
                upload_result["thumbnail_uploaded"] = thumbnail_result.get("success", False)
            
            return upload_result
            
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": f"Video upload failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    # =============================================================================
    # UPLOAD METHODS
    # =============================================================================
    
    async def _upload_video_file(self, video_path: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Upload the actual video file following Google's resumable upload protocol"""
        try:
            # Get file info
            file_size = os.path.getsize(video_path)
            mime_type = mimetypes.guess_type(video_path)[0] or "video/mp4"
            
            # Step 1: Initiate resumable upload session
            session_uri = await self._initiate_upload_session(metadata, file_size, mime_type)
            if not session_uri:
                return {
                    "success": False,
                    "platform": "youtube",
                    "error": "Failed to initiate upload session",
                    "brand": self.brand_config.get("name")
                }
            
            # Step 2: Upload video data in chunks (for large files)
            upload_result = await self._upload_video_chunks(session_uri, video_path, file_size)
            
            return upload_result
            
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": f"Video file upload failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    async def _initiate_upload_session(self, metadata: Dict[str, Any], file_size: int, mime_type: str) -> Optional[str]:
        """Initiate resumable upload session"""
        try:
            headers = {
                **self.headers,
                "X-Upload-Content-Type": mime_type,
                "X-Upload-Content-Length": str(file_size)
            }
            
            params = {
                "part": "snippet,status",
                "uploadType": "resumable"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.upload_url}/videos",
                    headers=headers,
                    params=params,
                    json=metadata
                ) as response:
                    if response.status == 200:
                        # Get upload session URI from Location header
                        return response.headers.get("Location")
                    else:
                        error_data = await response.json()
                        print(f"❌ Upload session initiation failed: {error_data}")
                        return None
                        
        except Exception as e:
            print(f"❌ Upload session error: {e}")
            return None
    
    async def _upload_video_chunks(self, session_uri: str, video_path: str, file_size: int) -> Dict[str, Any]:
        """Upload video in chunks using resumable upload"""
        try:
            chunk_size = 1024 * 1024 * 5  # 5MB chunks (recommended by Google)
            
            with open(video_path, 'rb') as video_file:
                uploaded_bytes = 0
                
                async with aiohttp.ClientSession() as session:
                    while uploaded_bytes < file_size:
                        # Read chunk
                        chunk = video_file.read(chunk_size)
                        if not chunk:
                            break
                        
                        chunk_end = min(uploaded_bytes + len(chunk) - 1, file_size - 1)
                        
                        headers = {
                            "Content-Range": f"bytes {uploaded_bytes}-{chunk_end}/{file_size}",
                            "Content-Length": str(len(chunk))
                        }
                        
                        async with session.put(
                            session_uri,
                            headers=headers,
                            data=chunk
                        ) as response:
                            if response.status == 200:
                                # Upload complete
                                response_data = await response.json()
                                video_id = response_data.get("id")
                                snippet = response_data.get("snippet", {})
                                
                                return {
                                    "success": True,
                                    "platform": "youtube",
                                    "video_id": video_id,
                                    "video_url": f"https://www.youtube.com/watch?v={video_id}",
                                    "title": snippet.get("title"),
                                    "description_length": len(snippet.get("description", "")),
                                    "file_size_mb": round(file_size / (1024 * 1024), 2),
                                    "upload_status": "completed",
                                    "brand": self.brand_config.get("name"),
                                    "timestamp": datetime.now().isoformat()
                                }
                            elif response.status == 308:
                                # Continue uploading
                                uploaded_bytes += len(chunk)
                                
                                # Show progress
                                progress = (uploaded_bytes / file_size) * 100
                                print(f"📤 Upload progress: {progress:.1f}% ({uploaded_bytes}/{file_size} bytes)")
                            else:
                                # Upload failed
                                error_data = await response.json()
                                return {
                                    "success": False,
                                    "platform": "youtube",
                                    "error": f"Upload failed at {uploaded_bytes} bytes: {error_data}",
                                    "brand": self.brand_config.get("name")
                                }
            
            # If we get here, something went wrong
            return {
                "success": False,
                "platform": "youtube",
                "error": "Upload completed but no success response received",
                "brand": self.brand_config.get("name")
            }
            
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": f"Chunk upload failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    async def _upload_thumbnail(self, video_id: str, thumbnail_path: str) -> Dict[str, Any]:
        """Upload custom thumbnail for video"""
        try:
            if not os.path.exists(thumbnail_path):
                return {
                    "success": False,
                    "error": f"Thumbnail file not found: {thumbnail_path}"
                }
            
            with open(thumbnail_path, 'rb') as thumb_file:
                thumbnail_data = thumb_file.read()
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "image/jpeg"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.upload_url}/thumbnails/set",
                    headers=headers,
                    params={"videoId": video_id},
                    data=thumbnail_data
                ) as response:
                    if response.status == 200:
                        response_data = await response.json()
                        return {
                            "success": True,
                            "thumbnail_url": response_data.get("items", [{}])[0].get("default", {}).get("url"),
                            "video_id": video_id
                        }
                    else:
                        error_data = await response.json()
                        return {
                            "success": False,
                            "error": f"Thumbnail upload failed: {error_data}"
                        }
                        
        except Exception as e:
            return {
                "success": False,
                "error": f"Thumbnail upload error: {str(e)}"
            }
    
    # =============================================================================
    # ANALYTICS METHODS
    # =============================================================================
    
    async def get_channel_analytics(self) -> Dict[str, Any]:
        """Get channel analytics and statistics"""
        try:
            params = {
                "part": "statistics,snippet",
                "mine": "true"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/channels",
                    headers=self.headers,
                    params=params
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        channels = data.get("items", [])
                        
                        if channels:
                            channel = channels[0]
                            statistics = channel.get("statistics", {})
                            snippet = channel.get("snippet", {})
                            
                            return {
                                "success": True,
                                "platform": "youtube",
                                "channel_id": channel.get("id"),
                                "channel_title": snippet.get("title"),
                                "statistics": {
                                    "subscriber_count": int(statistics.get("subscriberCount", 0)),
                                    "video_count": int(statistics.get("videoCount", 0)),
                                    "view_count": int(statistics.get("viewCount", 0)),
                                    "comment_count": int(statistics.get("commentCount", 0))
                                },
                                "brand": self.brand_config.get("name"),
                                "timestamp": datetime.now().isoformat()
                            }
                        else:
                            return {
                                "success": False,
                                "platform": "youtube",
                                "error": "No channel found",
                                "brand": self.brand_config.get("name")
                            }
                    else:
                        error_data = await response.json()
                        return {
                            "success": False,
                            "platform": "youtube",
                            "error": error_data.get("error", {}).get("message", "Analytics failed"),
                            "brand": self.brand_config.get("name")
                        }
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": f"Analytics error: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    async def get_video_analytics(self, video_id: str) -> Dict[str, Any]:
        """Get analytics for a specific video"""
        try:
            params = {
                "part": "statistics,snippet",
                "id": video_id
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/videos",
                    headers=self.headers,
                    params=params
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        videos = data.get("items", [])
                        
                        if videos:
                            video = videos[0]
                            statistics = video.get("statistics", {})
                            snippet = video.get("snippet", {})
                            
                            return {
                                "success": True,
                                "platform": "youtube",
                                "video_id": video_id,
                                "title": snippet.get("title"),
                                "published_at": snippet.get("publishedAt"),
                                "statistics": {
                                    "view_count": int(statistics.get("viewCount", 0)),
                                    "like_count": int(statistics.get("likeCount", 0)),
                                    "comment_count": int(statistics.get("commentCount", 0)),
                                    "favorite_count": int(statistics.get("favoriteCount", 0))
                                },
                                "brand": self.brand_config.get("name"),
                                "timestamp": datetime.now().isoformat()
                            }
                        else:
                            return {
                                "success": False,
                                "platform": "youtube",
                                "error": "Video not found",
                                "brand": self.brand_config.get("name")
                            }
                    else:
                        error_data = await response.json()
                        return {
                            "success": False,
                            "platform": "youtube",
                            "error": error_data.get("error", {}).get("message", "Video analytics failed"),
                            "brand": self.brand_config.get("name")
                        }
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": f"Video analytics error: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    async def generate_analytics_report(self, time_range: str = "30d") -> Dict[str, Any]:
        """Generate comprehensive analytics report"""
        try:
            # Get channel analytics
            channel_analytics = await self.get_channel_analytics()
            
            # Extract key insights
            insights = []
            
            if channel_analytics.get("success"):
                stats = channel_analytics.get("statistics", {})
                subscriber_count = stats.get("subscriber_count", 0)
                video_count = stats.get("video_count", 0)
                view_count = stats.get("view_count", 0)
                
                insights.append(f"Channel has {subscriber_count:,} subscribers")
                insights.append(f"Total videos: {video_count:,}")
                insights.append(f"Total views: {view_count:,}")
                
                if video_count > 0:
                    avg_views = view_count // video_count
                    insights.append(f"Average views per video: {avg_views:,}")
            
            return {
                "success": True,
                "platform": "youtube",
                "brand": self.brand_config.get("name"),
                "report_period": time_range,
                "channel_analytics": channel_analytics,
                "key_insights": insights,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": f"Report generation error: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def _format_title_for_brand(self, title: str) -> str:
        """Format video title according to brand guidelines"""
        # Use platform content template if available
        template = self.youtube_config.get("content_template", "{core_message}")
        
        if "{core_message}" in template:
            formatted_title = template.replace("{core_message}", title)
        else:
            formatted_title = title
        
        # YouTube title limit is 100 characters
        if len(formatted_title) > 100:
            formatted_title = formatted_title[:97] + "..."
        
        return formatted_title
    
    def _format_description_for_brand(self, description: str) -> str:
        """Format video description according to brand guidelines"""
        # Start with provided description
        formatted_description = description
        
        # Add brand story if description is short
        if len(formatted_description) < 500:
            brand_story = self.brand_config.get("story", "")
            if brand_story:
                formatted_description += f"\n\n{brand_story}"
        
        # Add social links
        social_links = []
        for platform, handle in self.social_config.items():
            if platform == "youtube_channel":
                continue
            if platform == "twitter_handle":
                social_links.append(f"Twitter: https://x.com/{handle.replace('@', '')}")
            elif platform == "linkedin_author":
                social_links.append(f"LinkedIn: https://linkedin.com/company/{handle.split(':')[-1]}")
            elif platform == "instagram_handle":
                social_links.append(f"Instagram: https://instagram.com/{handle.replace('@', '')}")
            elif platform == "facebook_page":
                social_links.append(f"Facebook: https://facebook.com/{handle}")
        
        if social_links:
            formatted_description += "\n\n🔗 Connect with us:\n" + "\n".join(social_links)
        
        # Add brand-specific call-to-action
        brand_name = self.brand_config.get("name", "")
        if brand_name == "GiveCare":
            formatted_description += f"\n\n💛 Subscribe for more caregiver support content!\n\n#Caregiving #Support #Community"
        
        # Ensure within YouTube's 8000 character limit
        if len(formatted_description) > 8000:
            formatted_description = formatted_description[:7997] + "..."
        
        return formatted_description
    
    def _get_brand_tags(self, tags: List[str] = None) -> List[str]:
        """Get brand-appropriate tags for video"""
        if not tags:
            tags = []
        
        # Add brand-relevant tags from topics and keywords
        brand_topics = self.brand_config.get("topics", [])
        research_keywords = self.brand_config.get("research_keywords", [])
        
        brand_tags = list(tags)  # Start with provided tags
        
        # Add topic-based tags
        for topic in brand_topics[:3]:  # Limit to avoid too many tags
            words = topic.split()
            for word in words[:2]:  # Take first 2 words from each topic
                if word.lower() not in [tag.lower() for tag in brand_tags]:
                    brand_tags.append(word.lower())
        
        # Add research keyword tags
        for keyword in research_keywords[:5]:  # Limit to 5 keywords
            if keyword.lower() not in [tag.lower() for tag in brand_tags]:
                brand_tags.append(keyword.lower())
        
        # YouTube allows up to 500 characters total for tags
        # Limit to most relevant tags
        return brand_tags[:15]  # Reasonable limit
    
    def _contains_synthetic_content(self, description: str) -> bool:
        """Check if content contains AI/synthetic media indicators"""
        ai_indicators = [
            "ai generated", "artificial intelligence", "ai-generated",
            "synthetic", "computer generated", "machine learning",
            "ai voice", "deepfake", "synthetic media"
        ]
        
        description_lower = description.lower()
        return any(indicator in description_lower for indicator in ai_indicators)
    
    def get_brand_voice_summary(self) -> Dict[str, Any]:
        """Get brand voice configuration for YouTube"""
        return {
            "brand_name": self.brand_config.get("name"),
            "tone": self.voice_config.get("tone"),
            "style": self.voice_config.get("style"),
            "attributes": self.voice_config.get("attributes", []),
            "platform": "youtube",
            "video_length_limit": self.video_length_limit,
            "description_limit": self.character_limit,
            "brand_channel": self.social_config.get("youtube_channel", "")
        }
    
    async def update_video(self, video_id: str, title: str = None, description: str = None,
                          tags: List[str] = None, privacy_status: str = None) -> Dict[str, Any]:
        """Update video metadata"""
        try:
            # First, get current video data
            params = {"part": "snippet,status", "id": video_id}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/videos",
                    headers=self.headers,
                    params=params
                ) as response:
                    if response.status != 200:
                        return {
                            "success": False,
                            "platform": "youtube",
                            "error": "Video not found",
                            "brand": self.brand_config.get("name")
                        }
                    
                    video_data = await response.json()
                    if not video_data.get("items"):
                        return {
                            "success": False,
                            "platform": "youtube",
                            "error": "Video not found",
                            "brand": self.brand_config.get("name")
                        }
                    
                    current_video = video_data["items"][0]
                    snippet = current_video.get("snippet", {})
                    status = current_video.get("status", {})
                    
                    # Update only provided fields
                    update_data = {
                        "id": video_id,
                        "snippet": {
                            "title": self._format_title_for_brand(title) if title else snippet.get("title"),
                            "description": self._format_description_for_brand(description) if description else snippet.get("description"),
                            "tags": self._get_brand_tags(tags) if tags else snippet.get("tags", []),
                            "categoryId": snippet.get("categoryId")
                        },
                        "status": {
                            "privacyStatus": privacy_status if privacy_status else status.get("privacyStatus")
                        }
                    }
                    
                    # Update video
                    async with session.put(
                        f"{self.base_url}/videos",
                        headers=self.headers,
                        params={"part": "snippet,status"},
                        json=update_data
                    ) as update_response:
                        if update_response.status == 200:
                            return {
                                "success": True,
                                "platform": "youtube",
                                "video_id": video_id,
                                "video_url": f"https://www.youtube.com/watch?v={video_id}",
                                "updated_fields": {
                                    "title": bool(title),
                                    "description": bool(description),
                                    "tags": bool(tags),
                                    "privacy_status": bool(privacy_status)
                                },
                                "brand": self.brand_config.get("name"),
                                "timestamp": datetime.now().isoformat()
                            }
                        else:
                            error_data = await update_response.json()
                            return {
                                "success": False,
                                "platform": "youtube",
                                "error": error_data.get("error", {}).get("message", "Update failed"),
                                "brand": self.brand_config.get("name")
                            }
                            
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": f"Video update failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    async def delete_video(self, video_id: str) -> Dict[str, Any]:
        """Delete a YouTube video"""
        try:
            params = {"id": video_id}
            
            async with aiohttp.ClientSession() as session:
                async with session.delete(
                    f"{self.base_url}/videos",
                    headers=self.headers,
                    params=params
                ) as response:
                    success = response.status == 204  # YouTube returns 204 for successful deletion
                    
                    return {
                        "success": success,
                        "platform": "youtube",
                        "action": "delete",
                        "video_id": video_id,
                        "brand": self.brand_config.get("name"),
                        "timestamp": datetime.now().isoformat()
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "platform": "youtube",
                "error": f"Delete failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }