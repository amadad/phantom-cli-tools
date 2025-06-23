#!/usr/bin/env python3
"""
Test the actual posting functionality with a real (but safe) test post.
"""

import os
from composio import ComposioToolSet
import json

def test_actual_post():
    api_key = os.getenv("COMPOSIO_API_KEY", "n66ukdb481d52uttofuhpr")
    
    # Connected account IDs (from initiate_connection)
    TWITTER_CONNECTED_ACCOUNT_ID = "17c7cbe0-7628-4efb-800f-f9de8a50fdd1"
    LINKEDIN_CONNECTED_ACCOUNT_ID = "eeb204c1-7ddc-4ffc-8132-96892cca76e1"
    
    print("🧪 Testing ACTUAL posting functionality...")
    print("⚠️  This will make real posts - make sure you're okay with that!")
    
    # Test Twitter post
    try:
        print(f"\n🐦 Testing Twitter post...")
        
        # Initialize toolset
        toolset = ComposioToolSet(api_key=api_key)
        
        # Execute the Twitter post action
        result = toolset.execute_action(
            action="TWITTER_CREATION_OF_A_POST",
            params={
                "text": "🤖 Test post from Agent Social pipeline - Composio integration working! #AgentSocial #Test"
            },
            entity_id="24b79587-149a-46be-8f02-59621dc9989d"
        )
        
        print(f"✅ Twitter post successful!")
        print(f"Result: {result}")
        
    except Exception as e:
        print(f"❌ Twitter post failed: {e}")
        print(f"Error type: {type(e)}")
    
    # Test LinkedIn post
    try:
        print(f"\n💼 Testing LinkedIn post...")
        
        # Execute the LinkedIn post action
        result = toolset.execute_action(
            action="LINKEDIN_CREATE_LINKED_IN_POST",
            params={
                "text": "🤖 Test post from Agent Social pipeline - Composio integration working! #AgentSocial #Test",
                "visibility": "PUBLIC"
            },
            entity_id="52251831-ff5f-4006-a5a4-ca894bd21eb0"
        )
        
        print(f"✅ LinkedIn post successful!")
        print(f"Result: {result}")
        
    except Exception as e:
        print(f"❌ LinkedIn post failed: {e}")
        print(f"Error type: {type(e)}")
    
    print(f"\n📊 Test complete! Check your social media accounts to see if the posts appeared.")

if __name__ == "__main__":
    # Auto-run for testing
    test_actual_post()