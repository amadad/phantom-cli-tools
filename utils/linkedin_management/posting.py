"""
LinkedIn Posting Management
Handles content posting to LinkedIn organization pages
"""
from typing import Dict, Any, Optional, List
from .base import LinkedInBaseClient

class LinkedInPoster(LinkedInBaseClient):
    """Handles LinkedIn content posting operations."""
    
    def __init__(self, access_token: Optional[str] = None, organization_id: str = "106542185"):
        super().__init__(access_token)
        self.organization_id = organization_id
        self.organization_urn = f"urn:li:organization:{organization_id}"
    
    def create_text_post(self, content: str, visibility: str = "PUBLIC") -> Dict[str, Any]:
        """
        Create a text-only post on LinkedIn organization page.
        
        Args:
            content: The text content of the post
            visibility: Post visibility (PUBLIC, CONNECTIONS)
            
        Returns:
            Dict with success status and post details
        """
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
        
        result = self._make_request("POST", "/rest/posts", data=post_data)
        
        if result["success"]:
            result["post_info"] = {
                "post_id": result.get("data", {}).get("id"),
                "author": self.organization_urn,
                "content_preview": content[:100] + "..." if len(content) > 100 else content
            }
            
        return result
    
    def create_media_post(self, content: str, media_id: str, media_type: str = "image", 
                         visibility: str = "PUBLIC") -> Dict[str, Any]:
        """
        Create a post with media (image or video).
        
        Args:
            content: The text content of the post
            media_id: LinkedIn media asset ID
            media_type: Type of media (image, video)
            visibility: Post visibility
            
        Returns:
            Dict with success status and post details
        """
        # Media content structure
        if media_type.lower() == "image":
            media_content = {
                "media": {
                    "title": content[:100] if content else "GiveCare Content",
                    "id": media_id
                }
            }
        else:  # video
            media_content = {
                "media": {
                    "title": content[:100] if content else "GiveCare Video",
                    "id": media_id
                }
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
        
        result = self._make_request("POST", "/rest/posts", data=post_data)
        
        if result["success"]:
            result["post_info"] = {
                "post_id": result.get("data", {}).get("id"),
                "author": self.organization_urn,
                "media_type": media_type,
                "media_id": media_id,
                "content_preview": content[:100] + "..." if len(content) > 100 else content
            }
            
        return result
    
    def get_organization_posts(self, count: int = 10) -> Dict[str, Any]:
        """
        Get recent posts from the organization.
        
        Args:
            count: Number of posts to retrieve
            
        Returns:
            Dict with posts data
        """
        params = {
            "author": self.organization_urn,
            "count": count
        }
        
        return self._make_request("GET", "/rest/posts", params=params)
    
    def delete_post(self, post_urn: str) -> Dict[str, Any]:
        """
        Delete a LinkedIn post.
        
        Args:
            post_urn: The URN of the post to delete
            
        Returns:
            Dict with success status
        """
        return self._make_request("DELETE", f"/rest/posts/{post_urn}")
    
    def update_post(self, post_urn: str, updated_content: str) -> Dict[str, Any]:
        """
        Update an existing LinkedIn post.
        
        Args:
            post_urn: The URN of the post to update
            updated_content: New content for the post
            
        Returns:
            Dict with success status
        """
        update_data = {
            "commentary": updated_content
        }
        
        return self._make_request("PATCH", f"/rest/posts/{post_urn}", data=update_data)
    
    def schedule_post(self, content: str, scheduled_time: str, media_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Schedule a post for future publishing.
        
        Args:
            content: Post content
            scheduled_time: ISO 8601 formatted timestamp
            media_id: Optional media asset ID
            
        Returns:
            Dict with scheduling status
        """
        post_data = {
            "author": self.organization_urn,
            "commentary": content,
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED"
            },
            "lifecycleState": "DRAFT",  # Schedule as draft first
            "isReshareDisabledByAuthor": False,
            "publishedAt": scheduled_time
        }
        
        if media_id:
            post_data["content"] = {
                "media": {
                    "title": content[:100] if content else "GiveCare Content",
                    "id": media_id
                }
            }
        else:
            post_data["content"] = {}
        
        return self._make_request("POST", "/rest/posts", data=post_data)