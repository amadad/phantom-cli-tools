"""
LinkedIn Media Management
Handles image and video uploads to LinkedIn
"""
import os
import requests
from typing import Dict, Any, Optional, BinaryIO
from .base import LinkedInBaseClient

class LinkedInMediaManager(LinkedInBaseClient):
    """Handles LinkedIn media upload and management operations."""
    
    def __init__(self, access_token: Optional[str] = None, organization_id: str = "106542185"):
        super().__init__(access_token)
        self.organization_id = organization_id
        self.organization_urn = f"urn:li:organization:{organization_id}"
    
    def initialize_image_upload(self, file_size: int, filename: str) -> Dict[str, Any]:
        """
        Initialize an image upload session.
        
        Args:
            file_size: Size of the image file in bytes
            filename: Name of the image file
            
        Returns:
            Dict with upload session details
        """
        upload_data = {
            "registerUploadRequest": {
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                "owner": self.organization_urn,
                "serviceRelationships": [
                    {
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent"
                    }
                ]
            }
        }
        
        result = self._make_request("POST", "/rest/images?action=initializeUpload", data=upload_data)
        
        if result["success"]:
            upload_info = result.get("data", {})
            result["upload_info"] = {
                "upload_url": upload_info.get("value", {}).get("uploadMechanism", {}).get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {}).get("uploadUrl"),
                "asset_id": upload_info.get("value", {}).get("asset"),
                "upload_instructions": upload_info.get("value", {}).get("uploadMechanism")
            }
            
        return result
    
    def upload_image_binary(self, upload_url: str, image_data: bytes, content_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Upload image binary data to LinkedIn.
        
        Args:
            upload_url: Upload URL from initialize_image_upload
            image_data: Binary image data
            content_type: MIME type of the image
            
        Returns:
            Dict with upload status
        """
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": content_type
        }
        
        try:
            response = requests.post(upload_url, data=image_data, headers=headers)
            
            return {
                "success": response.status_code in [200, 201],
                "status_code": response.status_code,
                "response": response.text if response.content else "Upload completed"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def upload_image_file(self, file_path: str) -> Dict[str, Any]:
        """
        Complete image upload workflow from file path.
        
        Args:
            file_path: Path to the image file
            
        Returns:
            Dict with asset ID and upload status
        """
        if not os.path.exists(file_path):
            return {
                "success": False,
                "error": f"File not found: {file_path}"
            }
        
        # Get file info
        file_size = os.path.getsize(file_path)
        filename = os.path.basename(file_path)
        
        # Determine content type
        ext = filename.lower().split('.')[-1]
        content_type_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg', 
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        }
        content_type = content_type_map.get(ext, 'image/jpeg')
        
        # Initialize upload
        init_result = self.initialize_image_upload(file_size, filename)
        if not init_result["success"]:
            return init_result
        
        upload_url = init_result["upload_info"]["upload_url"]
        asset_id = init_result["upload_info"]["asset_id"]
        
        # Upload file
        with open(file_path, 'rb') as f:
            image_data = f.read()
            
        upload_result = self.upload_image_binary(upload_url, image_data, content_type)
        
        if upload_result["success"]:
            return {
                "success": True,
                "asset_id": asset_id,
                "file_info": {
                    "filename": filename,
                    "size": file_size,
                    "content_type": content_type
                }
            }
        else:
            return upload_result
    
    def initialize_video_upload(self, file_size: int, filename: str) -> Dict[str, Any]:
        """
        Initialize a video upload session.
        
        Args:
            file_size: Size of the video file in bytes
            filename: Name of the video file
            
        Returns:
            Dict with upload session details
        """
        upload_data = {
            "registerUploadRequest": {
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-video"],
                "owner": self.organization_urn,
                "serviceRelationships": [
                    {
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent"
                    }
                ]
            }
        }
        
        return self._make_request("POST", "/rest/videos?action=initializeUpload", data=upload_data)
    
    def finalize_video_upload(self, asset_id: str, upload_token: str) -> Dict[str, Any]:
        """
        Finalize video upload after all chunks are uploaded.
        
        Args:
            asset_id: The video asset ID
            upload_token: Upload token from initialization
            
        Returns:
            Dict with finalization status
        """
        finalize_data = {
            "finalizeUploadRequest": {
                "video": asset_id,
                "uploadToken": upload_token,
                "uploadedPartIds": []  # LinkedIn handles this automatically for single uploads
            }
        }
        
        return self._make_request("POST", "/rest/videos?action=finalizeUpload", data=finalize_data)
    
    def get_media_status(self, asset_id: str, media_type: str = "image") -> Dict[str, Any]:
        """
        Get the processing status of uploaded media.
        
        Args:
            asset_id: The media asset ID
            media_type: Type of media (image, video)
            
        Returns:
            Dict with media status
        """
        if media_type.lower() == "image":
            return self._make_request("GET", f"/rest/images/{asset_id}")
        else:
            return self._make_request("GET", f"/rest/videos/{asset_id}")
    
    def get_organization_media(self, media_type: str = "image", count: int = 10) -> Dict[str, Any]:
        """
        Get media assets associated with the organization.
        
        Args:
            media_type: Type of media to retrieve (image, video)
            count: Number of media items to retrieve
            
        Returns:
            Dict with media list
        """
        params = {
            "q": "associatedAccount",
            "account": self.organization_urn,
            "count": count
        }
        
        if media_type.lower() == "image":
            return self._make_request("GET", "/rest/images", params=params)
        else:
            return self._make_request("GET", "/rest/videos", params=params)
    
    def delete_media(self, asset_id: str, media_type: str = "image") -> Dict[str, Any]:
        """
        Delete a media asset.
        
        Args:
            asset_id: The media asset ID to delete
            media_type: Type of media (image, video)
            
        Returns:
            Dict with deletion status
        """
        if media_type.lower() == "image":
            return self._make_request("DELETE", f"/rest/images/{asset_id}")
        else:
            return self._make_request("DELETE", f"/rest/videos/{asset_id}")