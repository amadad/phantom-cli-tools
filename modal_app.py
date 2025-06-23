#!/usr/bin/env python3
"""
Production Social Media Pipeline - Agent Social v2
Automated content generation with Slack approval workflow.
"""

import modal
import yaml
import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Create Modal app
app = modal.App("social-pipeline")

# Required secrets
secrets = [
    modal.Secret.from_name("azure-openai-secrets"),
    modal.Secret.from_name("azure-openai-endpoint"),
    modal.Secret.from_name("azure-deployment"),
    modal.Secret.from_name("serper-api-key"),
    modal.Secret.from_name("slack-secrets"),
]

# Minimal image - no complex dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install("agno>=1.6.3", "pydantic>=2.0", "PyYAML>=6.0", "aiohttp>=3.8", "google-search-results>=2.4.0", "openai>=1.0", "slack-sdk>=3.0")
    .add_local_dir("brand/", remote_path="/app/brand/")
    .add_local_dir("utils/", remote_path="/app/utils/")
)

# Storage volume
volume = modal.Volume.from_name("social-storage", create_if_missing=True)


class ContentResult(BaseModel):
    """Simple content result."""
    topic: str
    brand: str
    content: Dict[str, str]  # platform -> content
    timestamp: str


@app.function(
    image=image,
    secrets=secrets,
    volumes={"/storage": volume},
    timeout=1200,  # 20 minutes
    memory=2048,   # 2GB
    cpu=1.0        # 1 core
)
async def run_pipeline(
    topic: Optional[str] = None,
    platforms: str = "twitter,linkedin",
    auto_post: bool = False
) -> ContentResult:
    """
    Run minimal social media pipeline.
    """
    from agno.agent import Agent
    from agno.models.azure import AzureOpenAI
    from agno.tools.serpapi import serpapi
    
    # Parse platforms
    platform_list = [p.strip() for p in platforms.split(",")]
    
    # Load brand config
    with open("/app/brand/givecare.yml", "r") as f:
        brand_config = yaml.safe_load(f)
    
    brand_name = brand_config.get("name", "GiveCare")
    
    # Handle topic rotation
    if topic is None:
        topics = brand_config.get("topics", ["Caregiver support"])
        hour = datetime.now().hour
        topic_index = (hour // 6) % len(topics)
        topic = topics[topic_index]
    
    print(f"🚀 Running pipeline for: {topic}")
    print(f"📱 Platforms: {platform_list}")
    
    # Initialize Azure OpenAI
    azure_model = AzureOpenAI(
        id=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.5-preview"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    )
    
    # Create content agent
    content_agent = Agent(
        name=f"{brand_name}_content_creator",
        model=azure_model,
        instructions=[
            f"You are a content creator for {brand_name}.",
            f"Brand voice: {brand_config.get('voice', {})}",
            "Create engaging social media content that resonates with caregivers.",
            "Keep content authentic, empathetic, and supportive.",
            "Adapt content appropriately for each platform."
        ]
    )
    
    # Generate content for each platform
    content = {}
    for platform in platform_list:
        platform_config = brand_config.get("platforms", {}).get(platform, {})
        max_chars = platform_config.get("max_chars", 280)
        
        prompt = f"""
        Create social media content for {platform} about: {topic}
        
        Requirements:
        - Maximum {max_chars} characters
        - {brand_config.get('voice', {}).get('tone', 'supportive')} tone
        - Include relevant hashtags
        - Focus on caregiver community
        
        Return only the final content, ready to post.
        """
        
        try:
            result = content_agent.run(prompt, stream=False)
            # Extract just the content string from the result
            if hasattr(result, 'content'):
                clean_content = result.content
            else:
                clean_content = str(result)
            content[platform] = clean_content[:max_chars]  # Ensure character limit
            print(f"✅ Generated content for {platform}")
        except Exception as e:
            print(f"❌ Failed to generate content for {platform}: {e}")
            content[platform] = f"Sharing insights about {topic} with our caregiver community."
    
    # Save content
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"/storage/{brand_name}_{timestamp}.json"
    
    result_data = {
        "topic": topic,
        "brand": brand_name,
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "platforms": platform_list
    }
    
    with open(output_file, "w") as f:
        json.dump(result_data, f, indent=2)
    
    print(f"💾 Saved content to {output_file}")
    
    # Request approval via Slack if not auto-posting
    if not auto_post:
        print("👁️ Requesting Slack approval...")
        try:
            import sys
            sys.path.append("/app")
            from utils.slack_approval import SlackApprovalWorkflow
            approval_workflow = SlackApprovalWorkflow()
            
            # Request approval for each platform
            all_approved = True
            for platform, platform_content in content.items():
                try:
                    approved = await approval_workflow.request_approval(
                        content={"content": platform_content, "platform": platform},
                        platform=platform,
                        brand_config=brand_config
                    )
                    if not approved:
                        all_approved = False
                        print(f"❌ {platform} content rejected")
                    else:
                        print(f"✅ {platform} content approved")
                except Exception as e:
                    print(f"⚠️ Approval failed for {platform}: {e}")
                    all_approved = False
            
            if all_approved:
                print("📤 All content approved - ready to post")
            else:
                print("🚫 Some content rejected - posting cancelled")
        except Exception as e:
            print(f"⚠️ Slack approval failed: {e}")
            print("👁️ Content ready for manual approval")
    else:
        print("📤 Auto-posting enabled (mock)")
    
    return ContentResult(
        topic=topic,
        brand=brand_name,
        content=content,
        timestamp=datetime.now().isoformat()
    )


@app.function(
    image=image,
    secrets=secrets,
    volumes={"/storage": volume},
    schedule=modal.Cron("0 */6 * * *")  # Every 6 hours
)
async def scheduled_pipeline():
    """Scheduled execution every 6 hours."""
    # Run the pipeline logic directly in scheduled context
    from agno.agent import Agent
    from agno.models.azure import AzureOpenAI
    from agno.tools.serpapi import serpapi
    
    # Load brand config
    with open("/app/brand/givecare.yml", "r") as f:
        brand_config = yaml.safe_load(f)
    
    brand_name = brand_config.get("name", "GiveCare")
    
    # Handle topic rotation
    topics = brand_config.get("topics", ["Caregiver support"])
    hour = datetime.now().hour
    topic_index = (hour // 6) % len(topics)
    topic = topics[topic_index]
    
    print(f"🕒 Scheduled run at {datetime.now()}")
    print(f"🚀 Running pipeline for: {topic}")
    
    # Initialize Azure OpenAI
    azure_model = AzureOpenAI(
        id=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.5-preview"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    )
    
    # Create content agent
    content_agent = Agent(
        name=f"{brand_name}_scheduled_creator",
        model=azure_model,
        instructions=[
            f"You are a content creator for {brand_name}.",
            f"Brand voice: {brand_config.get('voice', {})}",
            "Create engaging social media content that resonates with caregivers.",
            "Keep content authentic, empathetic, and supportive."
        ]
    )
    
    # Generate content for default platforms
    platforms = ["twitter", "linkedin"]
    content = {}
    
    for platform in platforms:
        platform_config = brand_config.get("platforms", {}).get(platform, {})
        max_chars = platform_config.get("max_chars", 280)
        
        prompt = f"""
        Create social media content for {platform} about: {topic}
        
        Requirements:
        - Maximum {max_chars} characters
        - {brand_config.get('voice', {}).get('tone', 'supportive')} tone
        - Include relevant hashtags
        - Focus on caregiver community
        
        Return only the final content, ready to post.
        """
        
        try:
            result = content_agent.run(prompt, stream=False)
            if hasattr(result, 'content'):
                clean_content = result.content
            else:
                clean_content = str(result)
            content[platform] = clean_content[:max_chars]
            print(f"✅ Generated content for {platform}")
        except Exception as e:
            print(f"❌ Failed to generate content for {platform}: {e}")
            content[platform] = f"Sharing insights about {topic} with our caregiver community."
    
    # Save content
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"/storage/{brand_name}_scheduled_{timestamp}.json"
    
    result_data = {
        "topic": topic,
        "brand": brand_name,
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "platforms": platforms,
        "run_type": "scheduled"
    }
    
    with open(output_file, "w") as f:
        json.dump(result_data, f, indent=2)
    
    print(f"💾 Saved scheduled content to {output_file}")
    
    # Send Slack notification
    try:
        import sys
        sys.path.append("/app")
        from utils.slack_approval import SlackApprovalWorkflow
        approval_workflow = SlackApprovalWorkflow()
        
        for platform, platform_content in content.items():
            await approval_workflow.request_approval(
                content={"content": platform_content, "platform": platform},
                platform=platform,
                brand_config=brand_config
            )
            print(f"📱 Slack notification sent for {platform}")
    except Exception as e:
        print(f"⚠️ Slack notification failed: {e}")
    
    return {
        "status": "completed",
        "topic": topic,
        "platforms": platforms,
        "timestamp": datetime.now().isoformat(),
        "run_type": "scheduled"
    }


@app.function(image=image)
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "social-pipeline",
        "timestamp": datetime.now().isoformat()
    }


@app.function(
    image=image,
    secrets=secrets,
    volumes={"/storage": volume}
)
async def test_pipeline():
    """Test pipeline functionality."""
    result = run_pipeline.remote(
        topic="Caregiver wellness tips",
        platforms="twitter",
        auto_post=True
    )
    return {
        "status": "success",
        "content_generated": len(result.content),
        "topic": result.topic
    }


@app.local_entrypoint()
def main(
    topic: str = None,
    platforms: str = "twitter,linkedin",
    auto_post: bool = False,
    test: bool = False
):
    """
    Local entry point.
    
    Usage:
        modal run modal_app.py
        modal run modal_app.py --topic "Caregiver support"
        modal run modal_app.py --test
    """
    if test:
        print("🧪 Running test...")
        result = test_pipeline.remote()
    else:
        print("🚀 Running pipeline...")
        result = run_pipeline.remote(topic, platforms, auto_post)
    
    print(f"✅ Result: {result}")


if __name__ == "__main__":
    main()