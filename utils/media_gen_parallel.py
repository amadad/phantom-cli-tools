#!/usr/bin/env python3
"""
Parallel Multimedia Generation with exponential backoff and improved error handling.
Optimized for performance with concurrent generation of all media types.
"""

import os
import asyncio
import aiohttp
import time
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
import logging
from functools import wraps
import backoff

from utils.content_unit import MediaAssets

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Retry decorator with exponential backoff
def retry_with_backoff(max_tries=3, backoff_factor=2):
    """Decorator for retry with exponential backoff."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_tries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_tries - 1:
                        raise
                    wait_time = backoff_factor ** attempt
                    logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
            return None
        return wrapper
    return decorator

# ============================================================================
# ASYNC IMAGE GENERATION
# ============================================================================

@retry_with_backoff(max_tries=3)
async def generate_brand_image_async(
    prompt: str, 
    brand_config: Dict[str, Any], 
    output_dir: str = "output"
) -> Optional[str]:
    """Generate brand-aligned image asynchronously."""
    try:
        import replicate
        
        if not os.getenv("REPLICATE_API_TOKEN"):
            logger.error("REPLICATE_API_TOKEN not configured")
            return None
        
        Path(output_dir).mkdir(exist_ok=True)
        
        # Build branded prompt
        brand_name = brand_config.get("name", "Brand")
        color_palette = brand_config.get("color_palette", "")
        image_style = brand_config.get("image_style", "professional, clean")
        attributes = brand_config.get("attributes", "professional")
        
        branded_prompt = f"""
        {prompt}
        
        Visual style: {image_style}
        Color palette: {color_palette}
        Brand attributes: {attributes}
        """
        
        # Run replicate asynchronously
        loop = asyncio.get_event_loop()
        output = await loop.run_in_executor(
            None,
            lambda: replicate.run(
                "black-forest-labs/flux-schnell",
                input={
                    "prompt": branded_prompt,
                    "aspect_ratio": "16:9",
                    "output_format": "png",
                    "output_quality": 90
                }
            )
        )
        
        if output:
            timestamp = int(time.time())
            brand_name_safe = brand_name.lower().replace(" ", "_")
            filename = f"{output_dir}/{brand_name_safe}_image_{timestamp}.png"
            
            image_url = output[0] if isinstance(output, list) else output
            
            # Download image asynchronously
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url) as response:
                    content = await response.read()
                    
                    with open(filename, "wb") as f:
                        f.write(content)
            
            logger.info(f"✅ Image saved: {filename}")
            return filename
        
        return None
        
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        raise

# ============================================================================
# ASYNC VIDEO GENERATION WITH EXPONENTIAL BACKOFF
# ============================================================================

async def poll_with_exponential_backoff(
    check_func, 
    max_wait: int = 300,
    initial_delay: float = 2,
    max_delay: float = 30
):
    """Poll with exponential backoff until condition is met."""
    delay = initial_delay
    total_waited = 0
    
    while total_waited < max_wait:
        result = await check_func()
        if result:
            return result
        
        await asyncio.sleep(delay)
        total_waited += delay
        delay = min(delay * 1.5, max_delay)  # Cap at max_delay
    
    return None

@retry_with_backoff(max_tries=2)  # Fewer retries for expensive operations
async def generate_brand_video_async(
    prompt: str,
    brand_config: Dict[str, Any],
    output_dir: str = "output",
    video_length: int = 60  # Support longer videos
) -> Optional[str]:
    """Generate brand-aligned video asynchronously with exponential backoff polling."""
    try:
        endpoint = os.getenv("AZURE_OPENAI_BASE_URL")
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        
        if not endpoint or not api_key:
            logger.error("Azure OpenAI credentials not configured")
            return None
        
        Path(output_dir).mkdir(exist_ok=True)
        headers = {"api-key": api_key, "Content-Type": "application/json"}
        
        # Build branded video prompt
        brand_name = brand_config.get("name", "Brand")
        branded_prompt = f"""
        {prompt}
        
        Visual style: {brand_config.get('image_style', 'professional')}
        Color palette: {brand_config.get('color_palette', '')}
        Mood and tone: {brand_config.get('voice_tone', 'professional')}
        Brand attributes: {brand_config.get('attributes', 'professional')}
        """
        
        async with aiohttp.ClientSession() as session:
            # Create video generation job
            async with session.post(
                f"{endpoint}/openai/v1/video/generations/jobs?api-version=preview",
                headers=headers,
                json={
                    "model": "sora",
                    "prompt": branded_prompt,
                    "width": 1080,
                    "height": 1080,
                    "n_seconds": min(video_length, 60),  # Cap at 60 seconds for now
                    "n_variants": 1
                }
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Video job failed: {error_text}")
                    return None
                
                job_data = await resp.json()
                job_id = job_data["id"]
                logger.info(f"🎬 Video job started: {job_id}")
            
            # Poll with exponential backoff
            async def check_video_status():
                async with session.get(
                    f"{endpoint}/openai/v1/video/generations/jobs/{job_id}?api-version=preview",
                    headers=headers
                ) as status_resp:
                    if status_resp.status != 200:
                        return None
                    
                    status_data = await status_resp.json()
                    
                    if status_data["status"] == "succeeded":
                        return status_data
                    elif status_data["status"] == "failed":
                        logger.error("Video generation failed")
                        return False  # Explicitly failed
                    
                    return None  # Still processing
            
            # Wait for completion with exponential backoff
            status = await poll_with_exponential_backoff(check_video_status, max_wait=600)
            
            if status and status != False:
                gen_id = status["generations"][0]["id"]
                
                # Download video
                async with session.get(
                    f"{endpoint}/openai/v1/video/generations/{gen_id}/content/video?api-version=preview",
                    headers=headers
                ) as video_resp:
                    if video_resp.status == 200:
                        timestamp = int(time.time())
                        brand_name_safe = brand_name.lower().replace(" ", "_")
                        filename = f"{output_dir}/{brand_name_safe}_video_{timestamp}.mp4"
                        
                        content = await video_resp.read()
                        with open(filename, "wb") as f:
                            f.write(content)
                        
                        logger.info(f"✅ Video saved: {filename}")
                        return filename
        
        logger.warning("Video generation timed out")
        return None
        
    except Exception as e:
        logger.error(f"Video generation failed: {e}")
        raise

# ============================================================================
# ASYNC AUDIO GENERATION
# ============================================================================

@retry_with_backoff(max_tries=3)
async def generate_background_audio_async(
    prompt: str,
    brand_config: Dict[str, Any],
    output_dir: str = "output"
) -> Optional[str]:
    """Generate brand-aligned background audio asynchronously."""
    try:
        if not os.getenv("SONAUTO_API_KEY"):
            logger.error("SONAUTO_API_KEY not configured")
            return None
        
        Path(output_dir).mkdir(exist_ok=True)
        
        # Build audio prompt
        brand_name = brand_config.get("name", "Brand")
        voice_tone = brand_config.get("voice_tone", "professional")
        attributes = brand_config.get("attributes", "professional")
        
        audio_prompt = f"Background music that embodies {voice_tone} and {attributes} qualities for {prompt}"
        
        attribute_words = attributes.split(", ") if isinstance(attributes, str) else []
        brand_tags = ["instrumental"] + attribute_words[:3]
        
        headers = {
            "Authorization": f"Bearer {os.getenv('SONAUTO_API_KEY')}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            # Start generation
            async with session.post(
                "https://api.sonauto.ai/v1/generations",
                json={
                    "prompt": audio_prompt,
                    "tags": brand_tags,
                    "instrumental": True,
                    "prompt_strength": 2.3,
                    "output_format": "mp3"
                },
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Audio generation failed: {error_text}")
                    return None
                
                data = await resp.json()
                task_id = data["task_id"]
                logger.info(f"🎵 Audio generation started: {task_id}")
            
            # Poll with exponential backoff
            async def check_audio_status():
                async with session.get(
                    f"https://api.sonauto.ai/v1/generations/status/{task_id}",
                    headers=headers
                ) as status_resp:
                    if status_resp.status != 200:
                        return None
                    
                    status = (await status_resp.text()).strip('"')
                    
                    if status == "SUCCESS":
                        return True
                    elif status == "FAILURE":
                        logger.error("Audio generation failed")
                        return False
                    
                    return None
            
            # Wait for completion
            success = await poll_with_exponential_backoff(check_audio_status, max_wait=300)
            
            if success:
                # Get result
                async with session.get(
                    f"https://api.sonauto.ai/v1/generations/{task_id}",
                    headers=headers
                ) as result_resp:
                    if result_resp.status == 200:
                        result_data = await result_resp.json()
                        song_url = result_data["song_paths"][0]
                        
                        # Download audio
                        async with session.get(song_url) as audio_resp:
                            timestamp = int(time.time())
                            brand_name_safe = brand_name.lower().replace(" ", "_")
                            filename = f"{output_dir}/{brand_name_safe}_audio_{timestamp}.mp3"
                            
                            content = await audio_resp.read()
                            with open(filename, "wb") as f:
                                f.write(content)
                            
                            logger.info(f"✅ Audio saved: {filename}")
                            return filename
        
        logger.warning("Audio generation timed out")
        return None
        
    except Exception as e:
        logger.error(f"Audio generation failed: {e}")
        raise

# ============================================================================
# PARALLEL MULTIMEDIA GENERATION
# ============================================================================

async def generate_multimedia_set_async(
    visual_prompt: str,
    platforms: List[str],
    brand_config: Dict[str, Any],
    output_dir: str = "output",
    audio_prompt: Optional[str] = None,
    video_length: int = 60
) -> MediaAssets:
    """
    Generate complete multimedia set in parallel for optimal performance.
    All media types are generated concurrently.
    """
    brand_name = brand_config.get("name", "Brand")
    logger.info(f"🎨 Generating {brand_name} multimedia in parallel")
    
    tasks = []
    task_types = []
    
    # Determine what media to generate based on platforms
    needs_image = any(p in platforms for p in ["twitter", "linkedin", "instagram", "facebook"])
    needs_video = any(p in platforms for p in ["youtube", "instagram", "facebook", "tiktok"])
    needs_audio = any(p in platforms for p in ["youtube", "instagram", "tiktok"])
    
    # Create parallel tasks
    if needs_image:
        tasks.append(generate_brand_image_async(visual_prompt, brand_config, output_dir))
        task_types.append("image")
    
    if needs_video:
        tasks.append(generate_brand_video_async(visual_prompt, brand_config, output_dir, video_length))
        task_types.append("video")
    
    if needs_audio:
        audio_p = audio_prompt or visual_prompt
        tasks.append(generate_background_audio_async(audio_p, brand_config, output_dir))
        task_types.append("audio")
    
    # Execute all tasks in parallel
    start_time = time.time()
    results = await asyncio.gather(*tasks, return_exceptions=True)
    elapsed_time = time.time() - start_time
    
    logger.info(f"⚡ Parallel generation completed in {elapsed_time:.2f} seconds")
    
    # Process results
    media_assets = MediaAssets()
    
    for task_type, result in zip(task_types, results):
        if isinstance(result, Exception):
            logger.error(f"Failed to generate {task_type}: {result}")
            continue
        
        if result:
            if task_type == "image":
                media_assets.image_path = result
                media_assets.image_url = f"file://{result}"  # Local file URL
            elif task_type == "video":
                media_assets.video_path = result
                media_assets.video_url = f"file://{result}"
            elif task_type == "audio":
                media_assets.audio_path = result
                media_assets.audio_url = f"file://{result}"
    
    # Count generated files
    generated_count = sum(1 for attr in [media_assets.image_path, media_assets.video_path, media_assets.audio_path] if attr)
    logger.info(f"✅ Generated {generated_count} media files in parallel")
    
    return media_assets

# ============================================================================
# BACKWARDS COMPATIBILITY
# ============================================================================

def generate_multimedia_set(
    topic: str,
    platforms: list,
    brand_config: Dict[str, Any],
    output_dir: str = "output"
) -> Dict[str, Any]:
    """
    Synchronous wrapper for backwards compatibility.
    Uses the async parallel version internally.
    """
    # Run async function in sync context
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        media_assets = loop.run_until_complete(
            generate_multimedia_set_async(topic, platforms, brand_config, output_dir)
        )
        
        # Convert to legacy format
        results = {
            "topic": topic,
            "platforms": platforms,
            "brand": brand_config.get("name", "Brand"),
            "image_path": media_assets.image_path,
            "video_path": media_assets.video_path,
            "audio_path": media_assets.audio_path,
            "generated_files": [
                f for f in [media_assets.image_path, media_assets.video_path, media_assets.audio_path]
                if f is not None
            ]
        }
        
        return results
        
    finally:
        loop.close()

# Keep original function names for compatibility
generate_brand_image = generate_brand_image_async
generate_brand_video = generate_brand_video_async
generate_background_audio = generate_background_audio_async