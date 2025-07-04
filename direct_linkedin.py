#!/usr/bin/env python3
"""
Direct LinkedIn API posting - bypass Composio's bullshit
"""
import requests
import json

def post_to_linkedin_direct(access_token, content, organization_id=None):
    """Post directly to LinkedIn API without Composio."""
    
    # LinkedIn API endpoint
    url = "https://api.linkedin.com/v2/ugcPosts"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    
    # Determine author (organization or personal)
    if organization_id:
        author = f"urn:li:organization:{organization_id}"
    else:
        # Would need to get person URN, but let's focus on org
        author = f"urn:li:organization:{organization_id}"
    
    payload = {
        "author": author,
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
        response = requests.post(url, headers=headers, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    # You'd need to extract the access token from Composio or get it directly
    # This is just a template - we'd need the actual token
    print("Direct LinkedIn API approach - need access token")
    print("Check Composio dashboard for the actual access token")