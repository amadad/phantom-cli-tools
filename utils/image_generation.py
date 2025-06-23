"""
Image generation utilities with brand-specific styling.
"""
import os
from typing import Dict, Any, Optional


async def generate_brand_image(visual_prompt: str, topic: str, brand_config: Dict[str, Any]) -> Optional[str]:
    """Generate image using Replicate with specific brand style."""
    try:
        import replicate
        
        # Set Replicate API token
        replicate.api_token = os.getenv("REPLICATE_API_TOKEN")
        
        # Get brand visual style from config
        visual_style = brand_config.get("visual_style", {})
        primary_style = visual_style.get("primary", "soft, painterly, warm lighting with editorial vignette style")
        image_style = visual_style.get("image_style", "intimate personal moments with thick tan border frame")
        color_palette = visual_style.get("color_palette", "#FF9F1C, #54340E, #FFE8D6")
        
        # Get content unit media rules
        content_units = brand_config.get("content_units", {})
        media_rules = content_units.get("media_rules", {})
        image_rules = media_rules.get("image", [
            "Always include thick tan/warm beige border for brand recognition",
            "Use editorial vignette style with soft focus edges", 
            "Maintain consistent warm color temperature"
        ])
        
        # Build comprehensive style prompt using brand config
        brand_style_prompt = f"""
        Visual Style: {primary_style}
        Image Composition: {image_style}
        Color Palette: {color_palette} (warm oranges, deep browns, cream tones)
        Brand Rules: {'; '.join(image_rules)}
        
        Additional Requirements:
        - Documentary-style photography with authentic emotions
        - Warm, natural lighting (golden hour feel)
        - Soft vignette edges for editorial style
        - Include thick tan/beige border around the entire image
        - Avoid stock photo aesthetic, overly staged poses
        - Focus on genuine human connection and empathy
        - High quality, professional composition
        """
        
        # Enhanced prompt with brand-specific styling
        enhanced_prompt = f"""
        {visual_prompt}
        
        BRAND STYLING REQUIREMENTS:
        {brand_style_prompt}
        
        SUBJECT: {topic} in family caregiving context
        
        TECHNICAL SPECS: Professional documentary photography, natural lighting, 
        authentic moments, warm color grading, editorial vignette style, 
        thick tan border frame, 4K resolution, sharp focus
        
        MOOD: Hopeful, empowering, supportive, genuine human connection
        """
        
        print(f"🎨 Generating styled image with prompt: {enhanced_prompt[:100]}...")
        
        # Generate image using FLUX model with enhanced prompting
        output = replicate.run(
            "black-forest-labs/flux-dev",  # Use dev model for better quality
            input={
                "prompt": enhanced_prompt,
                "aspect_ratio": "1:1",
                "output_format": "png",
                "output_quality": 95,
                "num_inference_steps": 28,  # Higher quality
                "guidance_scale": 3.5
            }
        )
        
        # Return the image URL
        if output and len(output) > 0:
            image_url = str(output[0])
            print(f"✅ Generated styled image: {image_url}")
            return image_url
        else:
            print("❌ No image generated")
            return None
            
    except Exception as e:
        print(f"❌ Image generation failed: {e}")
        # Fallback to simpler model if dev fails
        try:
            print("🔄 Trying fallback model...")
            import replicate
            output = replicate.run(
                "black-forest-labs/flux-schnell",
                input={
                    "prompt": f"{visual_prompt}, professional caregiving photography, warm lighting, authentic, high quality",
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


def generate_visual_prompt(topic: str, agent) -> str:
    """Generate a detailed visual prompt for image creation."""
    image_prompt_query = f"""
    Create a specific visual description for a photograph about: {topic}
    
    Requirements:
    - Focus on authentic human moments and genuine emotions
    - Show diverse caregivers in real caregiving situations
    - Avoid clinical/medical settings - prefer home environments
    - Include specific details: lighting, composition, subjects, actions
    - Should feel documentary-style, not staged
    - Suitable for GiveCare brand (family caregiving support)
    
    Examples of good descriptions:
    - "A middle-aged daughter gently adjusting her elderly father's blanket in a sunny living room"
    - "Two adult siblings having a quiet conversation over coffee while their mother reads nearby"
    - "A caregiver taking a peaceful moment for herself in a garden while her loved one naps"
    
    Return a detailed 2-3 sentence visual description with specific subjects and setting.
    """
    
    try:
        visual_result = agent.run(image_prompt_query, stream=False)
        if hasattr(visual_result, 'content'):
            visual_prompt = visual_result.content
        else:
            visual_prompt = str(visual_result)
        print(f"✅ Generated visual prompt: {visual_prompt}")
        return visual_prompt
    except Exception as e:
        print(f"❌ Failed to generate visual prompt: {e}")
        return f"Supportive caregiving community illustration about {topic}"