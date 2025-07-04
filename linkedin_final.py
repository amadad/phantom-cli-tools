#!/usr/bin/env python3
"""
Working LinkedIn API integration using Microsoft documentation format
"""
import os
import requests
import json

class LinkedInPosterFinal:
    def __init__(self, access_token=None):
        self.access_token = access_token or os.getenv('LINKEDIN_ACCESS_TOKEN')
        self.base_url = "https://api.linkedin.com"
        self.person_urn = None
        
    def get_person_urn(self):
        """Get the person URN for the authenticated user."""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        try:
            response = requests.get(f"{self.base_url}/v2/people/~", headers=headers)
            if response.status_code == 200:
                person_data = response.json()
                person_id = person_data.get('id')
                self.person_urn = f"urn:li:person:{person_id}"
                return self.person_urn
            else:
                print(f"Failed to get person URN: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Error getting person URN: {e}")
            return None
    
    def post_to_linkedin(self, content):
        """Post to LinkedIn using correct Microsoft documentation format."""
        if not self.person_urn:
            self.get_person_urn()
            
        if not self.person_urn:
            return {"success": False, "error": "Could not get person URN"}
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        # Use exact format from Microsoft documentation
        post_data = {
            "author": self.person_urn,
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
        
        try:
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

def test_linkedin_posting():
    """Test the LinkedIn posting functionality."""
    poster = LinkedInPosterFinal()
    
    if not poster.access_token:
        print("❌ No LinkedIn access token found. Set LINKEDIN_ACCESS_TOKEN environment variable.")
        return
    
    print("🔍 Getting person URN...")
    urn = poster.get_person_urn()
    print(f"✅ Person URN: {urn}")
    
    print("📤 Posting to LinkedIn...")
    result = poster.post_to_linkedin("🎉 SUCCESS! Direct LinkedIn API posting is finally working! Using Microsoft's documentation format.")
    
    print("📊 Result:")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    test_linkedin_posting()