#!/usr/bin/env python3
"""
Script to connect LinkedIn to the correct Composio entity.
"""
import os
from composio import ComposioToolSet, App

def connect_linkedin_to_entity():
    """Connect LinkedIn to the specific entity used by the codebase."""
    api_key = os.getenv('COMPOSIO_API_KEY')
    if not api_key:
        print("❌ COMPOSIO_API_KEY not found in environment")
        return
    
    # The entity ID that the codebase expects for LinkedIn
    expected_entity_id = "52251831-ff5f-4006-a5a4-ca894bd21eb0"
    
    try:
        # Initialize toolset with the expected entity
        toolset = ComposioToolSet(api_key=api_key, entity_id=expected_entity_id)
        
        # Try to initiate LinkedIn connection for this entity
        print(f"🔗 Connecting LinkedIn to entity: {expected_entity_id}")
        
        integration = toolset.get_entity().initiate_connection(App.LINKEDIN)
        print(f"✅ LinkedIn connection URL generated:")
        print(f"🔗 {integration.redirectUrl}")
        print()
        print("📋 Instructions:")
        print("1. Visit the URL above")
        print("2. Log in with your LinkedIn account (must have GiveCare admin access)")
        print("3. Grant all requested permissions")
        print("4. Complete the OAuth flow")
        print("5. Test posting with: uv run main.py --topic 'Test' --platforms 'linkedin'")
        
    except Exception as e:
        print(f"❌ Error connecting LinkedIn: {e}")
        
        # Try checking existing connections
        print("\n🔍 Checking existing connections...")
        try:
            toolset_default = ComposioToolSet(api_key=api_key)
            # This might show connections on different entities
            print("✅ Default toolset initialized")
            
            # Try to get a new connection URL anyway
            integration = toolset_default.get_entity().initiate_connection(App.LINKEDIN)
            print(f"🔗 Alternative connection URL: {integration.redirectUrl}")
            
        except Exception as e2:
            print(f"❌ Alternative approach failed: {e2}")

if __name__ == "__main__":
    connect_linkedin_to_entity()