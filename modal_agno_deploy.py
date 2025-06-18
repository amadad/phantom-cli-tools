#!/usr/bin/env python3
"""
Modal deployment for Agno-native social media team.
Ultra-minimal custom code - just Agno team coordination.
"""

import modal
from agno_social_team import create_multi_channel_content, create_social_team
from typing import List, Dict, Any, Optional

# Modal app
app = modal.App("agno-social-team")

# Image with dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "curl")
    .pip_install_from_requirements("requirements.txt")
    .pip_install("PyYAML>=6.0.2", "openai>=1.0.0", "azure-ai-inference>=1.0.0b9", "aiohttp>=3.9.5")
    .env({"PYTHONPATH": "/root", "PYTHONUNBUFFERED": "1"})
    .add_local_dir(".", remote_path="/root", ignore=lambda pth: any(
        part in str(pth) for part in [".git", "__pycache__", ".venv", "node_modules", ".DS_Store"]
    ))
)

# Modal secrets
secrets = [
    modal.secret.Secret.from_name("azure-openai-secrets"),
    modal.secret.Secret.from_name("serper-api-key"),
    modal.secret.Secret.from_name("slack-secrets"),
    modal.secret.Secret.from_name("composio-secrets"),
]

@app.function(image=image, secrets=secrets, timeout=1800)
async def create_content(
    topic: str = "AI automation trends",
    channels_str: str = "twitter,linkedin",
    session_id: str = "default-session"
):
    """
    Create multi-channel social content using Agno team.
    Pure Agno coordination - zero custom logic.
    """
    try:
        print(f"🚀 Creating content for topic: {topic}")
        
        # Parse channels from string
        channels = [c.strip() for c in channels_str.split(",") if c.strip()] if channels_str else None
        print(f"📱 Target channels: {channels or 'Auto-selected'}")
        
        # Pure Agno team execution
        results = await create_multi_channel_content(
            topic=topic,
            channels=channels,
            session_id=session_id
        )
        
        print(f"✅ Content created for {len(results['posts'])} channels")
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "topic": topic}

@app.function(image=image, secrets=secrets, timeout=900)
def handle_approval(
    session_id: str,
    tool_confirmations: str  # JSON string of tool confirmations
):
    """
    Handle approval confirmations for paused agents.
    Agno-native confirmation workflow.
    """
    try:
        import json
        confirmations = json.loads(tool_confirmations)
        
        print(f"🔄 Processing approvals for session {session_id}")
        print(f"📋 Confirmations: {confirmations}")
        
        # This would be used to continue paused agent runs
        # In practice, you'd store the paused agent state and continue from here
        result = {
            "status": "confirmations_processed",
            "session_id": session_id,
            "confirmations": confirmations
        }
        
        return result
        
    except Exception as e:
        print(f"❌ Approval error: {e}")
        return {"error": str(e), "session_id": session_id}

@app.function(image=image, secrets=secrets, timeout=1800)
async def create_content_with_approval(
    topic: str = "AI automation trends",
    channels_str: str = "twitter,linkedin", 
    session_id: str = "default-session",
    auto_approve: bool = False
):
    """
    Create content with Agno-native approval workflow.
    Returns approval requirements or final results.
    """
    try:
        print(f"🚀 Creating content with approval workflow...")
        print(f"📝 Topic: {topic}")
        
        # Parse channels
        channels = [c.strip() for c in channels_str.split(",") if c.strip()] if channels_str else None
        print(f"📱 Target channels: {channels}")
        
        # Create team and start content creation
        team = create_social_team(session_id)
        content_researcher = team.members[0]
        
        # Step 1: Research content
        research_response = content_researcher.run(
            f"Find trending news and stories about: {topic}"
        )
        
        results = {
            "topic": topic,
            "channels": channels,
            "session_id": session_id,
            "posts": [],
            "pending_approvals": []
        }
        
        # Step 2: Generate content with approval points
        for channel in channels:
            if channel.lower() == "twitter":
                twitter_agent = team.members[2]  # Twitter Specialist
                response = twitter_agent.run(
                    f"Create and post Twitter content about: {research_response.content}"
                )
                
                if response.is_paused and not auto_approve:
                    # Collect approval requirements
                    for tool in response.tools_requiring_confirmation:
                        results["pending_approvals"].append({
                            "platform": "twitter",
                            "tool_name": tool.tool_name,
                            "tool_args": tool.tool_args,
                            "requires_confirmation": True
                        })
                    
                    results["posts"].append({
                        "platform": "twitter",
                        "status": "pending_approval",
                        "content": "Awaiting approval..."
                    })
                else:
                    # Auto-approve or no approval needed
                    if response.is_paused and auto_approve:
                        for tool in response.tools_requiring_confirmation:
                            tool.confirmed = True
                        final_response = twitter_agent.continue_run()
                        content = final_response.content
                    else:
                        content = response.content
                    
                    results["posts"].append({
                        "platform": "twitter",
                        "status": "completed",
                        "content": content.model_dump() if hasattr(content, 'model_dump') else str(content)
                    })
                    
            elif channel.lower() == "linkedin":
                linkedin_agent = team.members[3]  # LinkedIn Specialist
                response = linkedin_agent.run(
                    f"Create and post LinkedIn content about: {research_response.content}"
                )
                
                if response.is_paused and not auto_approve:
                    # Collect approval requirements
                    for tool in response.tools_requiring_confirmation:
                        results["pending_approvals"].append({
                            "platform": "linkedin",
                            "tool_name": tool.tool_name,
                            "tool_args": tool.tool_args,
                            "requires_confirmation": True
                        })
                    
                    results["posts"].append({
                        "platform": "linkedin",
                        "status": "pending_approval",
                        "content": "Awaiting approval..."
                    })
                else:
                    # Auto-approve or no approval needed
                    if response.is_paused and auto_approve:
                        for tool in response.tools_requiring_confirmation:
                            tool.confirmed = True
                        final_response = linkedin_agent.continue_run()
                        content = final_response.content
                    else:
                        content = response.content
                    
                    results["posts"].append({
                        "platform": "linkedin",
                        "status": "completed",
                        "content": content.model_dump() if hasattr(content, 'model_dump') else str(content)
                    })
        
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "topic": topic}

@app.function(image=image, secrets=secrets)
def get_session_status(session_id: str) -> Dict[str, Any]:
    """
    Get session status using Agno built-in session management.
    Pure Agno state retrieval - zero custom logic.
    """
    try:
        team = create_social_team(session_id)
        
        # Agno built-in session state access
        session_state = team.session_state
        
        return {
            "session_id": session_id,
            "state": session_state,
            "pending_approvals": session_state.get("pending_approvals", []),
            "completed_posts": session_state.get("completed_posts", [])
        }
        
    except Exception as e:
        return {"error": str(e), "session_id": session_id}

@app.function(image=image)
def health_check() -> Dict[str, Any]:
    """Health check endpoint."""
    return {"status": "healthy", "service": "agno-social-team"}

# Local testing
@app.local_entrypoint()
def main(
    topic: str = "AI automation trends",
    channels: str = "twitter,linkedin"
):
    """Local testing of Agno social team."""
    import asyncio
    
    channels_list = [c.strip() for c in channels.split(",")]
    
    print(f"🧪 Testing Agno social team...")
    print(f"📝 Topic: {topic}")
    print(f"📱 Channels: {channels_list}")
    
    # Test the team creation
    try:
        team = create_social_team("test-session")
        print(f"✅ Team created with {len(team.members)} agents:")
        for agent in team.members:
            print(f"  - {agent.name}")
        
        # Test content creation
        result = asyncio.run(create_multi_channel_content(
            topic=topic,
            channels=channels_list,
            session_id="test-session"
        ))
        
        print(f"\n✅ Content creation test completed:")
        print(f"📊 Results: {result}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()