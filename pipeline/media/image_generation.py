"""
Brand-Agnostic Image Generation
Pulls all styling and visual modes from the brand configuration passed at runtime.
No hardcoded brand-specific content.
"""
import os
from typing import Dict, Any, Optional, List
import hashlib


async def generate_brand_image(visual_prompt: str, topic: str, brand_config: Dict[str, Any]) -> Optional[str]:
    """
    Generate image using Replicate with brand-specific styling.
    All styling comes from brand_config - no hardcoded brand content.
    """
    try:
        import replicate
        
        # Set Replicate API token
        replicate.api_token = os.getenv("REPLICATE_API_TOKEN")
        
        # Extract brand visual configuration
        visual_style = brand_config.get("visual_style", {})
        content_units = brand_config.get("content_units", {})
        media_rules = content_units.get("media_rules", {})
        image_rules = media_rules.get("image", [])
        
        # Build brand style prompt from configuration
        brand_style_prompt = _build_brand_style_prompt(visual_style, image_rules)
        
        # Get brand emotional context
        brand_emotion = _get_brand_emotion(visual_style, brand_config)
        
        # Get technical specifications from brand config
        technical_specs = _get_brand_technical_specs(brand_config, "image")
        
        # Get negative prompt from brand config
        negative_prompt = _get_brand_negative_prompt(brand_config, "image")
        
        # Build comprehensive prompt
        enhanced_prompt = f"""
        {visual_prompt}
        
        BRAND VISUAL REQUIREMENTS:
        {brand_style_prompt}
        
        SUBJECT CONTEXT: {topic}
        
        EMOTIONAL TONE: {brand_emotion}
        
        TECHNICAL SPECS: {technical_specs}
        
        AVOID: {negative_prompt}
        """
        
        print(f"🎨 Generating brand-aware image...")
        
        # Get API configuration from brand config
        replicate_config = brand_config.get("apis", {}).get("replicate", {})
        image_model = replicate_config.get("image_model", "black-forest-labs/flux-schnell")
        quality = replicate_config.get("quality", 90)
        
        # Generate image using configured model
        output = replicate.run(
            image_model,
            input={
                "prompt": enhanced_prompt,
                "aspect_ratio": "1:1",
                "output_format": "png",
                "output_quality": quality,
                "num_inference_steps": 4,  # FLUX-schnell max is 4
                "guidance_scale": 3.5
            }
        )
        
        if output and len(output) > 0:
            image_url = output[0]
            print(f"✅ Generated brand image: {image_url}")
            return image_url
        else:
            print("❌ No image generated")
            return None
            
    except Exception as e:
        print(f"❌ Brand image generation failed: {e}")
        return None


async def generate_brand_image_with_mode(visual_prompt: str, topic: str, brand_config: Dict[str, Any]) -> Optional[str]:
    """
    Generate image with visual mode selection from brand configuration.
    Uses visual_modes defined in the brand config.
    """
    
    # Get visual modes from brand configuration
    visual_style = brand_config.get("visual_style", {})
    visual_modes = visual_style.get("visual_modes", [])
    
    if not visual_modes:
        print("⚠️ No visual modes found in brand config, using basic generation")
        return await generate_brand_image(visual_prompt, topic, brand_config)
    
    # Select mode based on topic (deterministic but varied)
    mode_index = hash(topic) % len(visual_modes)
    selected_mode = visual_modes[mode_index]
    
    mode_name = selected_mode.get("name", "default")
    print(f"🎨 Using visual mode: {mode_name}")
    
    # Build mode-specific prompt
    mode_prompt = _build_mode_specific_prompt(selected_mode, visual_prompt, topic)
    
    print(f"🎨 Mode-specific prompt: {mode_prompt[:100]}...")
    
    # Generate using the mode-specific configuration
    return await _generate_with_visual_mode(mode_prompt, selected_mode, brand_config)


def _build_brand_style_prompt(visual_style: Dict[str, Any], image_rules: List[str]) -> str:
    """Build brand style prompt from configuration."""
    
    core_style = visual_style.get("core", {})
    
    # Extract palette information
    palette = core_style.get("palette", {})
    palette_str = ""
    if palette:
        colors = []
        if palette.get("primary"):
            colors.append(f"primary: {palette['primary']}")
        if palette.get("secondary"):
            colors.append(f"secondary: {palette['secondary']}")
        if palette.get("accent"):
            colors.append(f"accent: {palette['accent']}")
        if colors:
            palette_str = f"Color Palette: {', '.join(colors)}"
    
    # Extract emotion and tone
    emotion = core_style.get("emotion", "")
    tone = core_style.get("tone", "")
    
    # Build style requirements
    style_parts = []
    if emotion:
        style_parts.append(f"Emotional Quality: {emotion}")
    if tone:
        style_parts.append(f"Visual Tone: {tone}")
    if palette_str:
        style_parts.append(palette_str)
    if image_rules:
        style_parts.append(f"Brand Rules: {'; '.join(image_rules)}")
    
    return "\n".join(style_parts) if style_parts else "Standard professional photography style"


def _get_brand_emotion(visual_style: Dict[str, Any], brand_config: Dict[str, Any]) -> str:
    """Extract emotional context from brand configuration."""
    
    # Try visual style emotion first
    core_emotion = visual_style.get("core", {}).get("emotion", "")
    if core_emotion:
        return core_emotion
    
    # Fall back to voice attributes
    voice = brand_config.get("voice", {})
    attributes = voice.get("attributes", [])
    if attributes:
        return ", ".join(attributes)
    
    # Default emotional context
    return "authentic, professional, engaging"


def _build_mode_specific_prompt(visual_mode: Dict[str, Any], visual_prompt: str, topic: str) -> str:
    """Build prompt using visual mode template from brand config."""
    
    # Get mode template
    template = visual_mode.get("prompt_template", "")
    
    if template and "{scene_description}" in template:
        # Use brand-defined template
        scene_description = f"{visual_prompt} related to {topic}"
        return template.format(scene_description=scene_description)
    else:
        # Fallback: build from mode properties
        technique = visual_mode.get("technique", "photography")
        lighting = visual_mode.get("lighting", "natural lighting")
        composition = visual_mode.get("composition", "professional composition")
        
        return f"{technique} showing {visual_prompt}. {lighting}, {composition}. Subject: {topic}."


async def _generate_with_visual_mode(prompt: str, visual_mode: Dict[str, Any], brand_config: Dict[str, Any]) -> Optional[str]:
    """Generate image using visual mode specifications."""
    
    try:
        import replicate
        
        # Get API configuration
        replicate_config = brand_config.get("apis", {}).get("replicate", {})
        image_model = replicate_config.get("image_model", "black-forest-labs/flux-schnell")
        quality = replicate_config.get("quality", 90)
        
        # Get mode-specific settings
        style = visual_mode.get("style", "")
        finish = visual_mode.get("finish", "")
        
        # Enhance prompt with mode details
        enhanced_prompt = prompt
        if style:
            enhanced_prompt += f" Style: {style}."
        if finish:
            enhanced_prompt += f" Finish: {finish}."
        
        output = replicate.run(
            image_model,
            input={
                "prompt": enhanced_prompt,
                "aspect_ratio": "1:1",
                "output_format": "png", 
                "output_quality": quality,
                "num_inference_steps": 4,  # FLUX-schnell max is 4
                "guidance_scale": 3.5
            }
        )
        
        if output and len(output) > 0:
            return output[0]
        return None
        
    except Exception as e:
        print(f"❌ Visual mode generation failed: {e}")
        return None


def generate_visual_prompt(topic: str, brand_config: Dict[str, Any]) -> str:
    """
    Generate visual prompt using brand context.
    Brand-agnostic - uses configuration for style guidance.
    """
    
    try:
        from agno.agent import Agent
        from agno.models.azure import AzureOpenAI
        
        # Get brand context for visual prompt generation
        brand_name = brand_config.get("name", "Brand")
        brand_voice = brand_config.get("voice", {})
        content_units = brand_config.get("content_units", {})
        
        # Build brand-aware visual prompt instructions
        visual_guidance = _build_visual_guidance(brand_config)
        
        # Configure Azure OpenAI
        model = AzureOpenAI(
            azure_deployment=os.getenv("AZURE_OPENAI_DEFAULT_MODEL", "gpt-4.5-preview"),
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
        )
        
        # Create visual prompt agent
        agent = Agent(
            name=f"{brand_name.replace(' ', '_')}_visual_prompter",
            model=model,
            instructions=[
                f"You create visual prompts for {brand_name} content.",
                f"Brand voice: {brand_voice.get('tone', 'professional')}",
                f"Visual style requirements: {visual_guidance}",
                "",
                "Create detailed visual descriptions that align with the brand identity.",
                "Focus on authentic moments and emotional connection.",
                "Be specific about subjects, setting, lighting, and mood.",
                "Return 2-3 sentences maximum."
            ]
        )
        
        # Generate visual prompt
        image_prompt_query = f"""
        Create a visual description for an image about: {topic}
        
        Brand context: {brand_name}
        Visual requirements: {visual_guidance}
        
        Return a detailed 2-3 sentence visual description with specific subjects and setting.
        """
        
        visual_result = agent.run(image_prompt_query, stream=False)
        if hasattr(visual_result, 'content'):
            visual_prompt = visual_result.content
        else:
            visual_prompt = str(visual_result)
        
        print(f"✅ Generated visual prompt: {visual_prompt}")
        return visual_prompt
        
    except Exception as e:
        print(f"❌ Failed to generate visual prompt: {e}")
        # Brand-agnostic fallback
        return f"Professional image depicting {topic} with authentic human moments and warm, natural lighting"


def _build_visual_guidance(brand_config: Dict[str, Any]) -> str:
    """Build visual guidance from brand configuration."""
    
    visual_style = brand_config.get("visual_style", {})
    content_units = brand_config.get("content_units", {})
    
    guidance_parts = []
    
    # Core visual identity
    core = visual_style.get("core", {})
    if core.get("emotion"):
        guidance_parts.append(f"Emotional quality: {core['emotion']}")
    if core.get("tone"):
        guidance_parts.append(f"Visual tone: {core['tone']}")
    
    # Content unit requirements
    visual_text_harmony = content_units.get("visual_text_harmony", "")
    if visual_text_harmony:
        guidance_parts.append(visual_text_harmony)
    
    # Media rules
    media_rules = content_units.get("media_rules", {})
    image_rules = media_rules.get("image", [])
    if image_rules:
        guidance_parts.append(f"Style requirements: {'; '.join(image_rules)}")
    
    return ". ".join(guidance_parts) if guidance_parts else "Professional, authentic imagery"


def get_visual_mode_by_usage(usage_type: str, brand_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Get visual mode by suggested usage from brand configuration.
    Useful for specific content types.
    """
    
    visual_modes = brand_config.get("visual_style", {}).get("visual_modes", [])
    
    for mode in visual_modes:
        suggested_usage = mode.get("suggested_usage", [])
        if usage_type in suggested_usage:
            return mode
    
    return None


def get_available_visual_modes(brand_config: Dict[str, Any]) -> List[str]:
    """Get list of available visual mode names from brand configuration."""
    
    visual_modes = brand_config.get("visual_style", {}).get("visual_modes", [])
    return [mode.get("name", f"mode_{i}") for i, mode in enumerate(visual_modes)]


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


# Compatibility function for existing code
async def generate_brand_aware_image(visual_prompt: str, topic: str, brand_config: Dict[str, Any]) -> Optional[str]:
    """Alias for generate_brand_image_with_mode for backward compatibility."""
    return await generate_brand_image_with_mode(visual_prompt, topic, brand_config)