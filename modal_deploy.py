#!/usr/bin/env python3
"""
Modal Deployment for Brand-Agnostic Social Pipeline
Clean, minimal serverless deployment.
"""

import modal
from social_pipeline import SimpleSocialPipeline, run_and_post_pipeline

# Modal app
app = modal.App("brand-social-pipeline")

# Simple image with requirements
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install_from_requirements("requirements.txt")
    .add_local_file("brand/givecare.yml", remote_path="/root/brand/givecare.yml")
    .add_local_file("social_pipeline.py", remote_path="/root/social_pipeline.py")
    .add_local_dir("utils/", remote_path="/root/utils/")
)

# Environment secrets
secrets = [
    modal.secret.Secret.from_name("azure-openai-secrets"),
    modal.secret.Secret.from_name("serper-api-key"),
    modal.secret.Secret.from_name("composio-secrets"),
]

@app.function(
    image=image,
    secrets=secrets,
    timeout=1800  # 30 minutes
)
async def run_social_pipeline(
    topic: str = "Family caregiver support and wellness",
    platforms: str = "twitter,linkedin,youtube",
    auto_post: bool = False
):
    """Run the social media pipeline on Modal."""
    platform_list = [p.strip() for p in platforms.split(",")]
    
    print(f"🚀 Starting GiveCare social pipeline...")
    print(f"📝 Topic: {topic}")
    print(f"📱 Platforms: {platform_list}")
    
    result = await run_and_post_pipeline(topic, platform_list, auto_post)
    
    return {
        "topic": result.topic,
        "brand": result.brand,
        "platforms": len(result.content),
        "files_generated": len(result.generated_files),
        "status": "completed"
    }

@app.function(image=image, secrets=secrets)
def health_check():
    """Simple health check."""
    return {"status": "healthy", "service": "givecare-social-simple"}

# Scheduled function (every 6 hours)
@app.function(
    image=image,
    secrets=secrets,
    schedule=modal.Cron("0 */6 * * *")  # Every 6 hours
)
async def scheduled_pipeline():
    """Scheduled social media pipeline."""
    topics = [
        "Family caregiver burnout and self-care",
        "Navigating healthcare systems as a caregiver",
        "Building support networks for caregivers",
        "Caregiver wellness during challenging times"
    ]
    
    # Rotate through topics
    import datetime
    topic_index = datetime.datetime.now().hour // 6 % len(topics)
    topic = topics[topic_index]
    
    return await run_social_pipeline(topic, auto_post=True)

@app.local_entrypoint()
def main(
    topic: str = "Family caregiver support",
    platforms: str = "twitter,linkedin",
    post: bool = False
):
    """Local testing of the pipeline."""
    print(f"🧪 Testing GiveCare pipeline locally...")
    
    result = run_social_pipeline.remote(topic, platforms, post)
    print(f"✅ Pipeline result: {result}")

if __name__ == "__main__":
    main()