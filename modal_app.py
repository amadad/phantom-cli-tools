#!/usr/bin/env python3
"""
Production Social Media Pipeline - Agent Social v2
Automated content generation with Slack approval workflow.
"""

import modal
import yaml
import os
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

# Create Modal app
app = modal.App("social-pipeline")

# Required secrets
secrets = [
    modal.Secret.from_name("azure-openai-secrets"),
    modal.Secret.from_name("azure-openai-endpoint"),
    modal.Secret.from_name("azure-deployment"),
    modal.Secret.from_name("serper-api-key"),
    modal.Secret.from_name("slack-secrets"),
    modal.Secret.from_name("composio-current"),
    modal.Secret.from_name("media-api-keys"),
]

# Minimal image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install("agno>=1.6.3", "pydantic>=2.0", "PyYAML>=6.0", "aiohttp>=3.8", 
                 "google-search-results>=2.4.0", "openai>=1.0", "slack-sdk>=3.0", 
                 "composio-core>=0.1.0", "replicate>=0.15.0")
    .add_local_dir("brand/", remote_path="/app/brand/")
    .add_local_dir("utils/", remote_path="/app/utils/")
)

# Storage volume
volume = modal.Volume.from_name("social-storage", create_if_missing=True)


class ContentResult(BaseModel):
    """Content generation result."""
    topic: str
    brand: str
    content: dict[str, str]  # platform -> content
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
    """Run social media pipeline."""
    import sys
    sys.path.append("/app")
    
    from utils.content_generation import generate_platform_content, get_topic_from_rotation, save_content_results, create_content_agent
    from utils.image_generation import generate_visual_prompt
    from utils.visual_mode_generator import generate_brand_image_with_mode
    from utils.social_posting import post_to_platforms, save_posting_results
    from utils.slack_approval import SlackApprovalWorkflow
    
    # Parse platforms
    platform_list = [p.strip() for p in platforms.split(",")]
    
    # Load brand config
    with open("/app/brand/givecare.yml", "r") as f:
        brand_config = yaml.safe_load(f)
    
    brand_name = brand_config.get("name", "GiveCare")
    
    # Handle topic rotation
    if topic is None:
        topic = get_topic_from_rotation(brand_config)
    
    print(f"🚀 Running pipeline for: {topic}")
    print(f"📱 Platforms: {platform_list}")
    
    # Generate visual prompt and image
    agent = create_content_agent(brand_config)
    visual_prompt = generate_visual_prompt(topic, agent)
    
    print("🎨 Generating image with visual mode system...")
    image_url = await generate_brand_image_with_mode(
        scene_description=visual_prompt,
        topic=topic,
        brand_config=brand_config,
        content_type="social_post"
    )
    
    # Generate content for all platforms
    content = await generate_platform_content(
        topic=topic,
        platforms=platform_list,
        brand_config=brand_config,
        has_image=bool(image_url)
    )
    
    # Save content
    save_content_results(
        content=content,
        topic=topic,
        brand_name=brand_name,
        image_url=image_url,
        visual_prompt=visual_prompt,
        platforms=platform_list,
        storage_path="/storage"
    )
    
    # Handle approval and posting
    if not auto_post:
        print("👁️ Requesting Slack approval...")
        try:
            approval_workflow = SlackApprovalWorkflow()
            
            # Request approval for each platform
            all_approved = True
            for platform, platform_content in content.items():
                try:
                    approved = await approval_workflow.request_approval(
                        content={"content": platform_content, "platform": platform, "image_url": image_url},
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
                print("📤 All content approved - posting to platforms...")
                post_results = await post_to_platforms(content, brand_config, image_url)
                save_posting_results(post_results, "/storage")
            else:
                print("🚫 Some content rejected - posting cancelled")
        except Exception as e:
            print(f"⚠️ Slack approval failed: {e}")
            print("👁️ Content ready for manual approval")
    else:
        print("📤 Auto-posting to platforms...")
        post_results = await post_to_platforms(content, brand_config, image_url)
        save_posting_results(post_results, "/storage")
    
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
    import sys
    sys.path.append("/app")
    
    from utils.content_generation import get_topic_from_rotation, generate_platform_content, save_content_results
    from utils.social_posting import post_to_platforms, save_posting_results
    from utils.slack_approval import SlackApprovalWorkflow
    
    # Load brand config
    with open("/app/brand/givecare.yml", "r") as f:
        brand_config = yaml.safe_load(f)
    
    brand_name = brand_config.get("name", "GiveCare")
    topic = get_topic_from_rotation(brand_config)
    platforms = ["twitter", "linkedin"]
    
    print(f"🕒 Scheduled run at {datetime.now()}")
    print(f"🚀 Running pipeline for: {topic}")
    
    # Generate content for default platforms
    content = await generate_platform_content(
        topic=topic,
        platforms=platforms,
        brand_config=brand_config,
        has_image=False  # No image generation in scheduled for now
    )
    
    # Save content
    save_content_results(
        content=content,
        topic=topic,
        brand_name=brand_name,
        platforms=platforms,
        storage_path="/storage"
    )
    
    # Send Slack notification and auto-post
    try:
        approval_workflow = SlackApprovalWorkflow()
        for platform, platform_content in content.items():
            await approval_workflow.request_approval(
                content={"content": platform_content, "platform": platform, "image_url": None},
                platform=platform,
                brand_config=brand_config
            )
            print(f"📱 Slack notification sent for {platform}")
    except Exception as e:
        print(f"⚠️ Slack notification failed: {e}")
    
    # Auto-post scheduled content
    print("📤 Auto-posting scheduled content to platforms...")
    try:
        post_results = await post_to_platforms(content, brand_config, None)
        save_posting_results(post_results, "/storage")
        print("✅ Scheduled posting completed")
    except Exception as e:
        print(f"❌ Scheduled posting failed: {e}")
        post_results = {"error": str(e)}
    
    return {
        "status": "completed",
        "topic": topic,
        "platforms": platforms,
        "timestamp": datetime.now().isoformat(),
        "run_type": "scheduled",
        "post_results": post_results
    }


@app.function(image=image, secrets=secrets)
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "social-pipeline",
        "timestamp": datetime.now().isoformat()
    }


@app.function(image=image, secrets=secrets)
def test_composio_auth():
    """Test Composio authentication and connections."""
    try:
        from composio import ComposioToolSet
        import os
        
        api_key = os.getenv("COMPOSIO_API_KEY")
        print(f"Using API key: {api_key}")
        
        composio_toolset = ComposioToolSet(api_key=api_key)
        
        # Try to get integrations
        integrations = composio_toolset.get_integrations()
        print(f"Found integrations: {integrations}")
        
        return {
            "api_key": api_key[:10] + "...",
            "integrations": str(integrations),
            "status": "success"
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
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


@app.function(
    image=image,
    secrets=secrets,
    volumes={"/storage": volume},
    timeout=1800  # 30 minutes for full evaluation
)
async def evaluate_pipeline():
    """
    Run systematic evaluation across test scenarios and models.
    """
    import sys
    sys.path.append("/app")
    
    from utils.evaluation import run_test_scenarios, evaluate_pipeline_run, grade_pipeline_performance
    from utils.content_generation import generate_platform_content, create_content_agent
    from utils.image_generation import generate_visual_prompt
    from utils.visual_mode_generator import generate_brand_image_with_mode
    import json
    from datetime import datetime
    
    # Load brand config
    with open("/app/brand/givecare.yml", "r") as f:
        brand_config = yaml.safe_load(f)
    
    test_scenarios = brand_config.get("test_scenarios", [])
    test_models = brand_config.get("apis", {}).get("test_models", [])
    
    print(f"🧪 Running evaluation with {len(test_scenarios)} scenarios and {len(test_models)} models")
    
    all_results = []
    
    # Test each scenario with each model
    for scenario in test_scenarios:
        topic = scenario["topic"]
        platforms = scenario["platforms"]
        
        for model_config in test_models:
            model_name = model_config["name"]
            deployment = model_config["deployment"]
            
            print(f"🔬 Testing: {topic[:30]}... with {model_name}")
            
            try:
                # Override model deployment for this test
                import os
                original_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
                
                # Get actual deployment name from environment variable
                actual_deployment = os.getenv(deployment)
                if not actual_deployment:
                    print(f"❌ Deployment env var {deployment} not found")
                    continue
                    
                os.environ["AZURE_OPENAI_DEPLOYMENT"] = actual_deployment
                
                # Create agent with test model
                agent = create_content_agent(brand_config)
                
                # Generate content
                content = await generate_platform_content(
                    topic=topic,
                    platforms=platforms,
                    brand_config=brand_config,
                    has_image=False  # Skip image generation for faster testing
                )
                
                # Generate visual prompt (no actual image)
                visual_prompt = generate_visual_prompt(topic, agent)
                
                # Evaluate results
                evaluation = evaluate_pipeline_run(
                    content_results=content,
                    brand_config=brand_config,
                    image_url=None,
                    visual_prompt=visual_prompt
                )
                
                evaluation.update({
                    "topic": topic,
                    "model": model_name,
                    "deployment": actual_deployment,
                    "timestamp": datetime.now().isoformat()
                })
                
                all_results.append(evaluation)
                print(f"✅ Score: {evaluation['pipeline_score']}")
                
                # Restore original deployment
                if original_deployment:
                    os.environ["AZURE_OPENAI_DEPLOYMENT"] = original_deployment
                
            except Exception as e:
                print(f"❌ Failed {model_name} on {topic}: {e}")
                all_results.append({
                    "topic": topic,
                    "model": model_name,
                    "pipeline_score": 0.0,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
    
    # Grade overall performance
    final_grade = grade_pipeline_performance(all_results)
    
    # Save detailed results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/storage/evaluation_results_{timestamp}.json"
    
    with open(results_file, "w") as f:
        json.dump({
            "final_grade": final_grade,
            "detailed_results": all_results,
            "test_summary": {
                "total_scenarios": len(test_scenarios),
                "total_models": len(test_models),
                "total_tests": len(all_results),
                "successful_tests": len([r for r in all_results if r.get("pipeline_score", 0) > 0])
            }
        }, f, indent=2)
    
    print(f"📊 Evaluation complete! Grade: {final_grade['grade']} ({final_grade['average_score']})")
    print(f"📁 Results saved to: {results_file}")
    
    return final_grade


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