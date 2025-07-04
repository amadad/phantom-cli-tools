#!/usr/bin/env python3
"""
Simple LinkedIn posting - hardcode the person URN to avoid permission hell
"""
import os
import requests
import json

def post_to_linkedin_simple(content, access_token):
    """Post to LinkedIn using hardcoded approach."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    
    # Use a placeholder URN that LinkedIn will replace with current user
    post_data = {
        "author": "urn:li:person:~",  # ~ means current authenticated user
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
            "https://api.linkedin.com/v2/ugcPosts",
            json=post_data,
            headers=headers
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        return response.status_code == 201
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    token = "AQXPpJKnXycR-zly9L25GKr0xliEoYY6nO1nLKK2ap4fZ_x995XdrVSQoFf3ZGLEuauV_ippd5zzinVyBuYhSIrMpiouE96p6f196ouUsKHB7qMtv_H5fpjES2Xe6NCMHX5VhGw5kY7u1ZQ0KqWD36hM3EqC2jF0s9PaqEav5fV-2-L6Zlqf8EmXtARrOhktQRnuZbgXvFefS4p5QZHUW9ljBuCxfvY2Lh6xVRF_v4BWDUrRnLkgO7Fwa353FAOoR3BZMrkEyaFo-uFz0e9uU-YGyTsN8PloPhLOs_kHRcDzGuJWzgaadmeu3a1Ta2B2dZH4dkzd6G6DxPl4n7wgDjMfntTvYA"
    
    content = "🎉 Excited to share updates from GiveCare! We're building amazing tools to support caregivers. #GiveCare #Caregiving #Healthcare"
    
    success = post_to_linkedin_simple(content, token)
    print(f"Success: {success}")