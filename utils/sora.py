"""
Video generation utilities using Azure OpenAI Sora integration.
Part of the Agent Social pipeline for multimedia content.
"""
import os
import asyncio
from typing import Optional, Dict, Any
import httpx


async def generate_video_with_sora(
    prompt: str, 
    topic: str, 
    brand_config: Dict[str, Any],
    duration: int = 5
) -> Optional[str]:
    """Generate video content using Azure OpenAI Sora."""
    
    try:
        # Build brand-aware video prompt
        brand_style = brand_config.get("visual_style", {})
        brand_tone = brand_config.get("voice", {}).get("tone", "supportive")
        
        enhanced_prompt = f"""
        {prompt}
        
        Brand styling: {brand_style.get('primary', 'warm, documentary style')}
        Tone: {brand_tone} and authentic
        Topic context: {topic} for caregiving community
        
        Video requirements:
        - Documentary-style footage
        - Warm, natural lighting
        - Authentic human moments
        - {duration} seconds duration
        - High quality, professional
        """
        
        # Azure OpenAI Sora endpoint configuration
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
        
        if not all([endpoint, api_key]):
            print("❌ Azure OpenAI credentials not configured for Sora")
            return None
        
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "prompt": enhanced_prompt.strip(),
            "size": "1024x576",  # 16:9 aspect ratio
            "duration": duration,
            "frame_rate": 24,
            "quality": "hd"
        }
        
        sora_url = f"{endpoint}/openai/v1/video/generations/jobs?api-version={api_version}"
        
        print(f"🎬 Generating {duration}s video with Sora...")
        print(f"📝 Prompt: {enhanced_prompt[:100]}...")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Submit video generation job
            response = await client.post(sora_url, json=payload, headers=headers)
            
            if response.status_code == 202:
                job_data = response.json()
                job_id = job_data.get("id")
                
                if job_id:
                    print(f"🔄 Video generation job started: {job_id}")
                    
                    # Poll for completion
                    video_url = await _poll_sora_job(client, endpoint, headers, job_id, api_version)
                    
                    if video_url:
                        print(f"✅ Video generated: {video_url}")
                        return video_url
                    else:
                        print("❌ Video generation timed out or failed")
                        return None
                else:
                    print("❌ No job ID returned from Sora API")
                    return None
            else:
                print(f"❌ Sora API error: {response.status_code} - {response.text}")
                return None
                
    except Exception as e:
        print(f"❌ Video generation failed: {e}")
        return None


async def _poll_sora_job(
    client: httpx.AsyncClient,
    endpoint: str,
    headers: Dict[str, str],
    job_id: str,
    api_version: str,
    max_wait: int = 300
) -> Optional[str]:
    """Poll Sora job status until completion or timeout."""
    
    status_url = f"{endpoint}/openai/v1/video/generations/jobs/{job_id}?api-version={api_version}"
    
    for attempt in range(max_wait // 10):  # Poll every 10 seconds
        try:
            response = await client.get(status_url, headers=headers)
            
            if response.status_code == 200:
                job_data = response.json()
                status = job_data.get("status")
                
                if status == "completed":
                    # Extract video URL from response
                    outputs = job_data.get("outputs", [])
                    if outputs and len(outputs) > 0:
                        video_url = outputs[0].get("url")
                        return video_url
                    else:
                        print("❌ No video URL in completed job")
                        return None
                        
                elif status == "failed":
                    error = job_data.get("error", "Unknown error")
                    print(f"❌ Video generation failed: {error}")
                    return None
                    
                elif status in ["running", "queued"]:
                    print(f"🔄 Video generation in progress... ({status})")
                    await asyncio.sleep(10)
                    continue
                    
                else:
                    print(f"⚠️ Unknown job status: {status}")
                    await asyncio.sleep(10)
                    continue
                    
            else:
                print(f"❌ Status check failed: {response.status_code}")
                await asyncio.sleep(10)
                continue
                
        except Exception as e:
            print(f"⚠️ Status check error: {e}")
            await asyncio.sleep(10)
            continue
    
    print("❌ Video generation timed out")
    return None


def generate_video_prompt(topic: str, content_type: str = "educational") -> str:
    """Generate a video prompt based on topic and content type."""
    
    prompts = {
        "educational": f"Documentary-style footage showing {topic}, with people learning and engaging in a warm, supportive environment",
        "testimonial": f"Authentic testimonial video about {topic}, featuring real people sharing their experiences in a comfortable setting",
        "demonstration": f"Clear demonstration of {topic}, showing step-by-step process in a well-lit, professional environment",
        "lifestyle": f"Lifestyle footage depicting {topic} in everyday life, showing natural interactions and genuine moments"
    }
    
    base_prompt = prompts.get(content_type, prompts["educational"])
    
    return f"""
    {base_prompt}
    
    Style requirements:
    - Documentary photography aesthetic
    - Warm, natural lighting
    - Authentic, non-staged moments
    - Professional quality
    - Soft, muted color palette
    - Focus on human connection and empathy
    """


# Integration with main pipeline
async def generate_multimedia_content(
    topic: str,
    brand_config: Dict[str, Any],
    include_video: bool = False,
    video_duration: int = 5
) -> Dict[str, Optional[str]]:
    """Generate both image and video content for multimedia posts."""
    
    results = {
        "image_url": None,
        "video_url": None
    }
    
    if include_video:
        # Generate video prompt
        video_prompt = generate_video_prompt(topic, "lifestyle")
        
        # Generate video
        video_url = await generate_video_with_sora(
            video_prompt, 
            topic, 
            brand_config, 
            video_duration
        )
        
        results["video_url"] = video_url
    
    return results


# Example usage for testing
if __name__ == "__main__":
    import yaml
    
    async def test_sora():
        # Load brand config
        try:
            with open("brands/givecare.yml", "r") as f:
                brand = yaml.safe_load(f)
        except FileNotFoundError:
            brand = {"name": "GiveCare", "voice": {"tone": "supportive"}}
        
        # Test video generation
        video_url = await generate_video_with_sora(
            "Caregiver taking a peaceful moment for self-care",
            "caregiver wellness",
            brand,
            duration=5
        )
        
        print(f"Generated video: {video_url}")
    
    asyncio.run(test_sora())