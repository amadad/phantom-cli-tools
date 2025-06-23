"""
Content generation utilities for social media platforms.
"""
import os
from typing import Dict, Any, List
from agno.agent import Agent
from agno.models.azure import AzureOpenAI


def create_content_agent(brand_config: Dict[str, Any]) -> Agent:
    """Create an AI agent for content generation."""
    brand_name = brand_config.get("name", "GiveCare")
    
    # Initialize Azure OpenAI
    azure_model = AzureOpenAI(
        id=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.5-preview"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    )
    
    # Create content agent
    return Agent(
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


async def generate_platform_content(
    topic: str, 
    platforms: List[str], 
    brand_config: Dict[str, Any],
    has_image: bool = False
) -> Dict[str, str]:
    """Generate content for multiple platforms."""
    agent = create_content_agent(brand_config)
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
        {f"- Will include an image, so consider visual context" if has_image else ""}
        
        Return only the final content, ready to post.
        """
        
        try:
            result = agent.run(prompt, stream=False)
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
    
    return content


def get_topic_from_rotation(brand_config: Dict[str, Any], hour: int = None) -> str:
    """Get topic based on rotation schedule."""
    from datetime import datetime
    
    topics = brand_config.get("topics", ["Caregiver support"])
    if hour is None:
        hour = datetime.now().hour
    
    topic_index = (hour // 6) % len(topics)
    return topics[topic_index]


def save_content_results(
    content: Dict[str, str], 
    topic: str,
    brand_name: str,
    image_url: str = None,
    visual_prompt: str = None,
    platforms: List[str] = None,
    storage_path: str = "/storage"
) -> str:
    """Save generated content to storage."""
    import json
    from datetime import datetime
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"{storage_path}/{brand_name}_{timestamp}.json"
    
    result_data = {
        "topic": topic,
        "brand": brand_name,
        "content": content,
        "image_url": image_url,
        "visual_prompt": visual_prompt,
        "timestamp": datetime.now().isoformat(),
        "platforms": platforms or list(content.keys())
    }
    
    try:
        with open(output_file, "w") as f:
            json.dump(result_data, f, indent=2)
        
        print(f"💾 Saved content to {output_file}")
        return output_file
    except Exception as e:
        print(f"❌ Failed to save content: {e}")
        return ""