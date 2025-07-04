#!/usr/bin/env python3
"""
Direct LinkedIn API integration for agent-social pipeline
Uses Community Management API for organization posting
"""
import os
import requests
import json
from datetime import datetime
from typing import Dict, Any, Optional

class LinkedInDirectPoster:
    def __init__(self, access_token=None):
        self.access_token = access_token or os.getenv('LINKEDIN_ACCESS_TOKEN')
        self.base_url = "https://api.linkedin.com"
        
    def post_to_organization(self, content: str, organization_id: str = "106542185", image_url: Optional[str] = None) -> Dict[str, Any]:
        """Post to LinkedIn organization page using Community Management API."""
        if not self.access_token:
            return {
                "success": False,
                "error": "No LinkedIn access token found. Set LINKEDIN_ACCESS_TOKEN environment variable."
            }
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "LinkedIn-Version": "202505"  # Use the version from your Community API
        }
        
        # Use new /rest/posts endpoint with organization author
        post_data = {
            "author": f"urn:li:organization:{organization_id}",
            "commentary": content,
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED"
            },
            "content": {},
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False
        }
        
        # Add image if provided
        if image_url:
            post_data["content"] = {
                "media": {
                    "title": "GiveCare Content",
                    "id": image_url  # For now, just use the URL
                }
            }
        
        try:
            response = requests.post(
                f"{self.base_url}/rest/posts",
                json=post_data,
                headers=headers
            )
            
            if response.status_code == 201:
                response_data = response.json()
                return {
                    "success": True,
                    "post_id": response_data.get('id'),
                    "platform": "linkedin",
                    "author": f"urn:li:organization:{organization_id}",
                    "timestamp": datetime.now().isoformat(),
                    "response": response_data
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code,
                    "platform": "linkedin"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "platform": "linkedin"
            }

# Integration function for agent-social pipeline
async def post_to_linkedin_organization(content: str, brand_config: Dict[str, Any], image_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Direct LinkedIn posting function for agent-social pipeline.
    Replaces Composio integration.
    """
    poster = LinkedInDirectPoster()
    
    # Get organization ID from brand config
    organization_id = brand_config.get("social", {}).get("linkedin_author", "").replace("urn:li:organization:", "")
    if not organization_id:
        organization_id = "106542185"  # Default to GiveCare
    
    print(f"📤 Posting to LinkedIn organization: {organization_id}")
    
    result = poster.post_to_organization(content, organization_id, image_url)
    
    if result["success"]:
        print(f"✅ Posted to LinkedIn successfully!")
        print(f"📱 Post ID: {result.get('post_id', 'Unknown')}")
    else:
        print(f"❌ LinkedIn posting failed: {result.get('error', 'Unknown error')}")
    
    return result

if __name__ == "__main__":
    # Test the integration
    import asyncio
    
    async def test():
        content = "🎉 Testing direct LinkedIn API integration for GiveCare! Community Management API is working!"
        brand_config = {"social": {"linkedin_author": "urn:li:organization:106542185"}}
        
        result = await post_to_linkedin_organization(content, brand_config)
        print(json.dumps(result, indent=2))
    
    asyncio.run(test())