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
        # Build brand-aware video prompt from configuration
        enhanced_prompt = _build_brand_video_prompt(prompt, topic, brand_config, duration)
        
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


def _build_brand_video_prompt(prompt: str, topic: str, brand_config: Dict[str, Any], duration: int) -> str:
    """Build brand-aware video prompt from configuration."""
    
    # Extract brand visual configuration
    visual_style = brand_config.get("visual_style", {})
    content_units = brand_config.get("content_units", {})
    media_rules = content_units.get("media_rules", {})
    video_rules = media_rules.get("video", [])
    
    # Get brand emotional context
    core_style = visual_style.get("core", {})
    emotion = core_style.get("emotion", "")
    tone = core_style.get("tone", "")
    
    # Build video style requirements from brand config
    style_parts = []
    if emotion:
        style_parts.append(f"Emotional Quality: {emotion}")
    if tone:
        style_parts.append(f"Visual Tone: {tone}")
    if video_rules:
        style_parts.append(f"Brand Video Rules: {'; '.join(video_rules)}")
    
    brand_style = "\n".join(style_parts) if style_parts else "Documentary style, warm and authentic"
    
    # Get brand color palette
    palette = core_style.get("palette", {})
    color_guidance = ""
    if palette:
        colors = []
        if palette.get("primary"):
            colors.append(f"primary: {palette['primary']}")
        if palette.get("secondary"):
            colors.append(f"secondary: {palette['secondary']}")
        if palette.get("accent"):
            colors.append(f"accent: {palette['accent']}")
        if colors:
            color_guidance = f"Color Palette: {', '.join(colors)}"
    
    # Get technical specifications from brand config
    technical_specs = _get_brand_technical_specs(brand_config, "video")
    
    # Get negative prompt from brand config
    negative_prompt = _get_brand_negative_prompt(brand_config, "video")
    
    # Build comprehensive video prompt
    enhanced_prompt = f"""
    {prompt}
    
    BRAND VISUAL REQUIREMENTS:
    {brand_style}
    
    SUBJECT CONTEXT: {topic}
    
    TECHNICAL SPECS:
    - Duration: {duration} seconds
    - {technical_specs}
    
    AVOID: {negative_prompt}
    
    {color_guidance}
    """
    
    return enhanced_prompt


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


def _get_brand_technical_specs(brand_config: Dict[str, Any], media_type: str) -> str:
    """Get technical specifications from brand configuration."""
    
    # Check for media-specific technical specs
    content_units = brand_config.get("content_units", {})
    media_rules = content_units.get("media_rules", {})
    
    # Look for technical specs in media rules
    media_specs = media_rules.get(f"{media_type}_technical_specs", [])
    if media_specs:
        return ", ".join(media_specs)
    
    # Check for general technical specs
    technical_specs = content_units.get("technical_specs", {})
    if technical_specs:
        specs_for_media = technical_specs.get(media_type, [])
        if specs_for_media:
            return ", ".join(specs_for_media)
    
    # Check visual style for technical requirements
    visual_style = brand_config.get("visual_style", {})
    core = visual_style.get("core", {})
    technical_requirements = core.get("technical_requirements", "")
    if technical_requirements:
        return technical_requirements
    
    # Default fallback specs
    default_specs = {
        "image": "Professional photography, natural lighting, authentic moments, high resolution, sharp focus",
        "video": "Professional video quality, smooth camera movements, natural lighting, authentic moments and expressions"
    }
    
    return default_specs.get(media_type, "Professional quality, natural lighting, authentic moments")


def _get_brand_negative_prompt(brand_config: Dict[str, Any], media_type: str) -> str:
    """Get negative prompt (what to avoid) from brand configuration."""
    
    # Check for media-specific negative prompts
    content_units = brand_config.get("content_units", {})
    media_rules = content_units.get("media_rules", {})
    
    # Look for negative prompts in media rules
    negative_prompts = media_rules.get(f"{media_type}_negative_prompts", [])
    if negative_prompts:
        return ", ".join(negative_prompts)
    
    # Check for general negative prompts
    negative_rules = content_units.get("negative_prompts", {})
    if negative_rules:
        media_negatives = negative_rules.get(media_type, [])
        if media_negatives:
            return ", ".join(media_negatives)
    
    # Check visual style for things to avoid
    visual_style = brand_config.get("visual_style", {})
    core = visual_style.get("core", {})
    avoid_list = core.get("avoid", [])
    if avoid_list:
        return ", ".join(avoid_list)
    
    # Check for brand-level avoid rules
    brand_avoid = brand_config.get("avoid", [])
    if brand_avoid:
        return ", ".join(brand_avoid)
    
    # Default negative prompts for professional content
    default_negatives = {
        "image": "cliché stock photography, staged poses, artificial lighting, corporate headshots, cheesy smiles, overly polished, generic backgrounds",
        "video": "cliché scenarios, staged acting, artificial movements, corporate presentation style, cheesy transitions, overly polished production"
    }
    
    return default_negatives.get(media_type, "cliché, staged, artificial, overly polished, generic")