#!/usr/bin/env python3
"""
Production LinkedIn integration for agent-social
"""
import os
import requests
import json
from datetime import datetime, timedelta

class LinkedInPoster:
    def __init__(self, access_token=None):
        self.access_token = access_token or os.getenv('LINKEDIN_ACCESS_TOKEN')
        self.base_url = "https://api.linkedin.com"
        
    def post_to_linkedin(self, content, organization_id=None):
        """Post to LinkedIn (personal or organization)."""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "LinkedIn-Version": "202307"  # Use older stable version
        }
        
        post_data = {
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": content
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }
        
        # If organization_id provided, post as organization
        if organization_id:
            post_data["author"] = f"urn:li:organization:{organization_id}"
        
        try:
            # Use UGC posts endpoint instead
            response = requests.post(
                f"{self.base_url}/v2/ugcPosts",
                json=post_data,
                headers=headers
            )
            
            if response.status_code == 201:
                return {
                    "success": True,
                    "post_id": response.json().get('id'),
                    "response": response.json()
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# For your agent-social integration
async def post_to_linkedin_direct(content, organization_id="106542185"):
    """Direct LinkedIn posting function for agent-social."""
    poster = LinkedInPoster()
    
    if not poster.access_token:
        return {
            "success": False,
            "error": "No LinkedIn access token found. Set LINKEDIN_ACCESS_TOKEN environment variable."
        }
    
    result = poster.post_to_linkedin(content, organization_id)
    return result

if __name__ == "__main__":
    # Test posting
    test_content = "Test post from GiveCare organization via direct LinkedIn API! 🚀"
    result = asyncio.run(post_to_linkedin_direct(test_content))
    print(json.dumps(result, indent=2))