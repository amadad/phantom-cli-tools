#!/usr/bin/env python3
"""
Multimedia Generation for GiveCare
Image, video, and audio generation with brand consistency.
"""

import os
import time
import requests
from pathlib import Path
from typing import Optional, Dict, Any

# ============================================================================
# IMAGE GENERATION
# ============================================================================

def generate_brand_image(prompt: str, brand_config: Dict[str, Any], output_dir: str = "output") -> Optional[str]:
    """Generate brand-aligned image using brand YAML configuration."""
    try:
        import replicate
        
        if not os.getenv("REPLICATE_API_TOKEN"):
            print("❌ REPLICATE_API_TOKEN not configured")
            return None
        
        os.environ["REPLICATE_API_TOKEN"] = os.getenv("REPLICATE_API_TOKEN")
        Path(output_dir).mkdir(exist_ok=True)
        
        # Build prompt from brand configuration
        brand_name = brand_config.get("name", "Brand")
        color_palette = brand_config.get("color_palette", "")
        image_style = brand_config.get("image_style", "professional, clean")
        attributes = brand_config.get("attributes", "professional")
        
        # Use brand's image generation prompt if available
        if brand_config.get("prompts", {}).get("image_generation"):
            branded_prompt = brand_config["prompts"]["image_generation"].format(
                context=prompt,
                color_palette=color_palette,
                image_style=image_style,
                attributes=attributes
            )
        else:
            # Fallback generic prompt using brand attributes
            branded_prompt = f"""
            {prompt}
            
            Visual style: {image_style}
            Color palette: {color_palette}
            Brand attributes: {attributes}
            """
        
        output = replicate.run(
            "black-forest-labs/flux-schnell",
            input={
                "prompt": branded_prompt,
                "aspect_ratio": "16:9",
                "output_format": "png",
                "output_quality": 90
            }
        )
        
        if output:
            timestamp = int(time.time())
            brand_name_safe = brand_name.lower().replace(" ", "_")
            filename = f"{output_dir}/{brand_name_safe}_image_{timestamp}.png"
            
            image_url = output[0] if isinstance(output, list) else output
            response = requests.get(image_url)
            
            with open(filename, "wb") as f:
                f.write(response.content)
            
            print(f"✅ Image saved: {filename}")
            return filename
        
        return None
        
    except Exception as e:
        print(f"❌ Image generation failed: {e}")
        return None

# ============================================================================
# VIDEO GENERATION
# ============================================================================

def generate_brand_video(prompt: str, brand_config: Dict[str, Any], output_dir: str = "output") -> Optional[str]:
    """Generate brand-aligned video using Azure Sora and brand YAML configuration."""
    try:
        endpoint = os.getenv("AZURE_OPENAI_BASE_URL")
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        
        if not endpoint or not api_key:
            print("❌ Azure OpenAI credentials not configured")
            return None
        
        Path(output_dir).mkdir(exist_ok=True)
        headers = {"api-key": api_key, "Content-Type": "application/json"}
        
        # Build video prompt from brand configuration
        brand_name = brand_config.get("name", "Brand")
        color_palette = brand_config.get("color_palette", "")
        image_style = brand_config.get("image_style", "professional, clean")
        attributes = brand_config.get("attributes", "professional")
        voice_tone = brand_config.get("voice_tone", "professional")
        
        # Build branded video prompt
        branded_prompt = f"""
        {prompt}
        
        Visual style: {image_style}
        Color palette: {color_palette}
        Mood and tone: {voice_tone}
        Brand attributes: {attributes}
        """
        
        # Create video generation job
        resp = requests.post(
            f"{endpoint}/openai/v1/video/generations/jobs?api-version=preview",
            headers=headers,
            json={
                "model": "sora",
                "prompt": branded_prompt,
                "width": 1080,
                "height": 1080,
                "n_seconds": 6,
                "n_variants": 1
            }
        )
        
        if resp.status_code != 200:
            print(f"❌ Video job failed: {resp.text}")
            return None
        
        job_id = resp.json()["id"]
        print(f"🎬 Video job started: {job_id}")
        
        # Poll for completion (max 5 minutes)
        for _ in range(60):
            time.sleep(5)
            
            status_resp = requests.get(
                f"{endpoint}/openai/v1/video/generations/jobs/{job_id}?api-version=preview",
                headers=headers
            )
            
            if status_resp.status_code != 200:
                continue
            
            status = status_resp.json()
            
            if status["status"] == "succeeded":
                gen_id = status["generations"][0]["id"]
                video_resp = requests.get(
                    f"{endpoint}/openai/v1/video/generations/{gen_id}/content/video?api-version=preview",
                    headers=headers
                )
                
                if video_resp.status_code == 200:
                    timestamp = int(time.time())
                    brand_name_safe = brand_name.lower().replace(" ", "_")
                    filename = f"{output_dir}/{brand_name_safe}_video_{timestamp}.mp4"
                    
                    with open(filename, "wb") as f:
                        f.write(video_resp.content)
                    
                    print(f"✅ Video saved: {filename}")
                    return filename
            
            elif status["status"] == "failed":
                print(f"❌ Video generation failed")
                break
        
        print("⏰ Video generation timed out")
        return None
        
    except Exception as e:
        print(f"❌ Video generation failed: {e}")
        return None

# ============================================================================
# AUDIO GENERATION
# ============================================================================

def generate_background_audio(prompt: str, brand_config: Dict[str, Any], output_dir: str = "output") -> Optional[str]:
    """Generate brand-aligned background audio using Sonauto and brand configuration."""
    try:
        if not os.getenv("SONAUTO_API_KEY"):
            print("❌ SONAUTO_API_KEY not configured")
            return None
        
        Path(output_dir).mkdir(exist_ok=True)
        
        # Build audio prompt from brand configuration
        brand_name = brand_config.get("name", "Brand")
        voice_tone = brand_config.get("voice_tone", "professional")
        attributes = brand_config.get("attributes", "professional")
        
        # Create brand-aligned audio prompt
        audio_prompt = f"Background music that embodies {voice_tone} and {attributes} qualities for {prompt}"
        
        # Extract mood-based tags from brand attributes
        attribute_words = attributes.split(", ") if isinstance(attributes, str) else []
        brand_tags = ["instrumental"] + attribute_words[:3]  # Limit to 3 brand attributes
        
        payload = {
            "prompt": audio_prompt,
            "tags": brand_tags,
            "instrumental": True,
            "prompt_strength": 2.3,
            "output_format": "mp3"
        }
        
        headers = {
            "Authorization": f"Bearer {os.getenv('SONAUTO_API_KEY')}",
            "Content-Type": "application/json"
        }
        
        # Start generation
        resp = requests.post(
            "https://api.sonauto.ai/v1/generations",
            json=payload,
            headers=headers
        )
        
        if resp.status_code != 200:
            print(f"❌ Audio generation failed: {resp.text}")
            return None
        
        task_id = resp.json()["task_id"]
        print(f"🎵 Audio generation started: {task_id}")
        
        # Poll for completion (max 5 minutes)
        for _ in range(30):
            time.sleep(10)
            
            status_resp = requests.get(
                f"https://api.sonauto.ai/v1/generations/status/{task_id}",
                headers=headers
            )
            
            if status_resp.status_code != 200:
                continue
            
            status = status_resp.text.strip('"')
            
            if status == "SUCCESS":
                result_resp = requests.get(
                    f"https://api.sonauto.ai/v1/generations/{task_id}",
                    headers=headers
                )
                
                if result_resp.status_code == 200:
                    song_url = result_resp.json()["song_paths"][0]
                    timestamp = int(time.time())
                    brand_name_safe = brand_name.lower().replace(" ", "_")
                    filename = f"{output_dir}/{brand_name_safe}_audio_{timestamp}.mp3"
                    
                    audio_resp = requests.get(song_url)
                    with open(filename, "wb") as f:
                        f.write(audio_resp.content)
                    
                    print(f"✅ Audio saved: {filename}")
                    return filename
            
            elif status == "FAILURE":
                print("❌ Audio generation failed")
                break
        
        print("⏰ Audio generation timed out")
        return None
        
    except Exception as e:
        print(f"❌ Audio generation failed: {e}")
        return None

# ============================================================================
# COMPLETE MULTIMEDIA SET
# ============================================================================

def generate_multimedia_set(
    topic: str, 
    platforms: list,
    brand_config: Dict[str, Any], 
    output_dir: str = "output"
) -> Dict[str, Any]:
    """Generate complete multimedia set for social platforms using brand configuration."""
    brand_name = brand_config.get("name", "Brand")
    print(f"🎨 Generating {brand_name} multimedia for: {topic}")
    
    results = {
        "topic": topic,
        "platforms": platforms,
        "brand": brand_name,
        "image_path": None,
        "video_path": None,
        "audio_path": None,
        "generated_files": []
    }
    
    # Generate image for image-supporting platforms
    if any(p in platforms for p in ["twitter", "linkedin", "instagram", "facebook"]):
        print("📸 Generating brand image...")
        image_path = generate_brand_image(topic, brand_config, output_dir)
        if image_path:
            results["image_path"] = image_path
            results["generated_files"].append(image_path)
    
    # Generate video for video-supporting platforms
    if any(p in platforms for p in ["youtube", "instagram", "facebook", "tiktok"]):
        print("🎬 Generating brand video...")
        video_path = generate_brand_video(topic, brand_config, output_dir)
        if video_path:
            results["video_path"] = video_path
            results["generated_files"].append(video_path)
    
    # Generate audio for audio-supporting platforms or video enhancement
    if any(p in platforms for p in ["youtube", "instagram", "tiktok"]) or results["video_path"]:
        print("🎵 Generating brand audio...")
        audio_path = generate_background_audio(topic, brand_config, output_dir)
        if audio_path:
            results["audio_path"] = audio_path
            results["generated_files"].append(audio_path)
    
    print(f"✅ {brand_name} multimedia generation complete! Generated {len(results['generated_files'])} files")
    return results

# ============================================================================
# TESTING
# ============================================================================

def test_multimedia():
    """Test all multimedia generation with brand configuration."""
    print("🧪 Testing brand-agnostic multimedia generation...")
    
    # Load brand config
    import yaml
    try:
        with open("brand/givecare.yml", 'r') as f:
            brand_config = yaml.safe_load(f)
    except:
        brand_config = {
            "name": "TestBrand",
            "color_palette": "#FF6B35, #2D3748, #F7FAFC", 
            "image_style": "modern, clean, professional",
            "attributes": "trustworthy, innovative, accessible"
        }
    
    topic = "Family caregiver self-care during holidays"
    platforms = ["twitter", "linkedin", "youtube"]
    
    results = generate_multimedia_set(topic, platforms, brand_config)
    
    print(f"\n📊 Test Results:")
    print(f"🏷️  Brand: {results['brand']}")
    print(f"📝 Topic: {results['topic']}")
    print(f"📸 Image: {results['image_path'] or 'Not generated'}")
    print(f"🎬 Video: {results['video_path'] or 'Not generated'}")
    print(f"🎵 Audio: {results['audio_path'] or 'Not generated'}")
    print(f"📁 Total files: {len(results['generated_files'])}")

if __name__ == "__main__":
    test_multimedia()