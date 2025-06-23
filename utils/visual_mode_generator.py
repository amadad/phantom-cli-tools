"""
Visual mode-based image generation with brand system.
"""
import os
import random
from typing import Dict, Any, Optional, List


def select_visual_mode(content_type: str, topic: str, brand_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Select appropriate visual mode based on content type and topic.
    """
    visual_modes = brand_config.get("visual_style", {}).get("visual_modes", [])
    
    if not visual_modes:
        return None
    
    # Content type mapping to visual modes
    mode_mapping = {
        "social_post": ["framed_portrait", "lifestyle_scene"],
        "hero_content": ["lifestyle_scene"],
        "educational": ["lifestyle_scene", "illustrative_concept"],
        "testimonial": ["framed_portrait"],
        "concept": ["illustrative_concept"]
    }
    
    # Topic-based preferences
    if any(word in topic.lower() for word in ["burnout", "wellness", "mental health", "self-care"]):
        preferred_modes = ["framed_portrait", "illustrative_concept"]
    elif any(word in topic.lower() for word in ["technology", "tools", "planning"]):
        preferred_modes = ["lifestyle_scene"]
    elif any(word in topic.lower() for word in ["support", "community", "network"]):
        preferred_modes = ["lifestyle_scene", "framed_portrait"]
    else:
        preferred_modes = mode_mapping.get(content_type, ["framed_portrait"])
    
    # Find matching modes
    available_modes = [mode for mode in visual_modes if mode["name"] in preferred_modes]
    
    if not available_modes:
        available_modes = visual_modes
    
    # Select mode (could add logic for rotation, user preference, etc.)
    selected_mode = random.choice(available_modes)
    
    return selected_mode


def build_visual_prompt(scene_description: str, visual_mode: Dict[str, Any], topic: str, brand_config: Dict[str, Any]) -> str:
    """
    Build a complete visual prompt using the selected mode template.
    """
    if not visual_mode:
        # Fallback to basic prompt
        return f"Professional photograph showing {scene_description}, warm lighting, authentic caregiving moment"
    
    # Get core brand elements
    core_style = brand_config.get("visual_style", {}).get("core", {})
    emotion = core_style.get("emotion", "peaceful, empathetic")
    tone = core_style.get("tone", "authentic, warm")
    
    # Use the mode's prompt template
    prompt_template = visual_mode.get("prompt_template", "")
    
    # Format the template with scene description
    visual_prompt = prompt_template.format(scene_description=scene_description)
    
    # Add core brand elements
    enhanced_prompt = f"""{visual_prompt}
    
BRAND EMOTION: {emotion}
BRAND TONE: {tone}
CONTEXT: {topic} for family caregiving support

TECHNICAL SPECS: High quality, professional composition, 4K resolution
AVOID: Clinical settings, stock photo aesthetic, overly staged poses
FOCUS: Genuine human connection, authentic family moments"""
    
    return enhanced_prompt.strip()


async def generate_brand_image_with_mode(
    scene_description: str, 
    topic: str, 
    brand_config: Dict[str, Any],
    content_type: str = "social_post",
    visual_mode_override: str = None
) -> Optional[str]:
    """
    Generate image using specific visual mode system.
    """
    try:
        import replicate
        
        # Set Replicate API token
        replicate.api_token = os.getenv("REPLICATE_API_TOKEN")
        
        # Select visual mode
        if visual_mode_override:
            visual_modes = brand_config.get("visual_style", {}).get("visual_modes", [])
            visual_mode = next((mode for mode in visual_modes if mode["name"] == visual_mode_override), None)
        else:
            visual_mode = select_visual_mode(content_type, topic, brand_config)
        
        if not visual_mode:
            print("⚠️ No visual mode found, using fallback")
            visual_mode = {"name": "fallback", "prompt_template": "Professional photograph showing {scene_description}"}
        
        print(f"🎨 Using visual mode: {visual_mode['name']}")
        
        # Build complete prompt
        complete_prompt = build_visual_prompt(scene_description, visual_mode, topic, brand_config)
        
        print(f"🎨 Generated mode-specific prompt: {complete_prompt[:100]}...")
        
        # Generate image using FLUX model
        output = replicate.run(
            "black-forest-labs/flux-dev",
            input={
                "prompt": complete_prompt,
                "aspect_ratio": "1:1",
                "output_format": "png",
                "output_quality": 95,
                "num_inference_steps": 28,
                "guidance_scale": 3.5
            }
        )
        
        # Return the image URL
        if output and len(output) > 0:
            image_url = str(output[0])
            print(f"✅ Generated {visual_mode['name']} image: {image_url}")
            return image_url
        else:
            print("❌ No image generated")
            return None
            
    except Exception as e:
        print(f"❌ Image generation failed: {e}")
        # Fallback to simpler model
        try:
            print("🔄 Trying fallback model...")
            import replicate
            output = replicate.run(
                "black-forest-labs/flux-schnell",
                input={
                    "prompt": f"{scene_description}, professional caregiving photography, warm lighting, authentic, high quality",
                    "aspect_ratio": "1:1", 
                    "output_format": "png",
                    "output_quality": 85
                }
            )
            if output and len(output) > 0:
                return str(output[0])
        except Exception as fallback_error:
            print(f"❌ Fallback also failed: {fallback_error}")
        
        return None


def get_mode_info(visual_mode_name: str, brand_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get information about a specific visual mode.
    """
    visual_modes = brand_config.get("visual_style", {}).get("visual_modes", [])
    return next((mode for mode in visual_modes if mode["name"] == visual_mode_name), {})


def list_available_modes(brand_config: Dict[str, Any]) -> List[str]:
    """
    List all available visual modes.
    """
    visual_modes = brand_config.get("visual_style", {}).get("visual_modes", [])
    return [mode["name"] for mode in visual_modes]