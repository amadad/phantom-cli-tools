#!/usr/bin/env python3
"""
Simple LinkedIn OAuth flow for GiveCare Social app
"""
import os
import requests
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import webbrowser
import threading
import time

# Your LinkedIn app credentials
CLIENT_ID = "78slbi3hz7zu0q"
CLIENT_SECRET = "WPL_AP1.nKXVgKig8ziXpu6K.HM6oaQ=="
REDIRECT_URI = "http://localhost:8000/callback"

class OAuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/callback'):
            # Parse the authorization code
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            
            if 'code' in params:
                auth_code = params['code'][0]
                print(f"✅ Got authorization code: {auth_code}")
                
                # Exchange code for access token
                token = exchange_code_for_token(auth_code)
                if token:
                    print(f"✅ Access Token: {token}")
                    
                    # Test posting
                    test_linkedin_post(token)
                else:
                    print("❌ Failed to get access token")
                
                # Send response to browser
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'<h1>Success! You can close this window.</h1>')
            else:
                print("❌ No authorization code received")
                self.send_response(400)
                self.end_headers()

def exchange_code_for_token(auth_code):
    """Exchange authorization code for access token."""
    token_url = "https://www.linkedin.com/oauth/v2/accessToken"
    
    data = {
        'grant_type': 'authorization_code',
        'code': auth_code,
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }
    
    try:
        response = requests.post(token_url, data=data)
        if response.status_code == 200:
            token_data = response.json()
            return token_data.get('access_token')
        else:
            print(f"Token exchange failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Error exchanging token: {e}")
        return None

def test_linkedin_post(access_token):
    """Test posting to LinkedIn using new v2024.01 API."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "LinkedIn-Version": "202401"  # Use 2024.01 API version
    }
    
    try:
        # Use the new /rest/posts endpoint
        post_url = "https://api.linkedin.com/rest/posts"
        
        post_data = {
            "author": f"urn:li:person:{{id}}",  # Will be auto-filled by LinkedIn
            "commentary": "Test post from GiveCare Social automation! 🚀",
            "visibility": "PUBLIC",
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": []
            },
            "content": {},
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False
        }
        
        post_response = requests.post(post_url, json=post_data, headers=headers)
        print(f"✅ Post response: {post_response.status_code}")
        
        if post_response.status_code == 201:
            response_data = post_response.json()
            post_id = response_data.get('id', 'Unknown')
            print(f"🎉 Successfully posted! Post ID: {post_id}")
            print(f"📱 View at: https://www.linkedin.com/feed/update/{post_id}/")
        else:
            print(f"❌ Post failed: {post_response.text}")
            
    except Exception as e:
        print(f"❌ Error testing post: {e}")

def start_oauth_flow():
    """Start the OAuth flow."""
    # LinkedIn OAuth URL with proper encoding - only use available scopes
    scope = "w_member_social"
    auth_url = "https://www.linkedin.com/oauth/v2/authorization?" + urllib.parse.urlencode({
        'response_type': 'code',
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'scope': scope
    })
    
    print("Starting OAuth flow...")
    print(f"Auth URL: {auth_url}")
    print(f"Manual link if browser doesn't open: {auth_url}")
    
    # Start local server
    server = HTTPServer(('localhost', 8000), OAuthHandler)
    
    # Open browser
    webbrowser.open(auth_url)
    
    print("Waiting for authorization...")
    server.handle_request()  # Handle one request then exit

if __name__ == "__main__":
    if not CLIENT_SECRET or CLIENT_SECRET == "YOUR_CLIENT_SECRET":
        print("❌ Please set CLIENT_SECRET in the script")
        print("Get it from: https://www.linkedin.com/developers/apps/YOUR_APP/auth")
    else:
        start_oauth_flow()