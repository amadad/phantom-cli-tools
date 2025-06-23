"""
Social media posting utilities using Composio.
"""
import os
import json
from datetime import datetime
from typing import Dict, Any, Optional


async def post_to_platforms(content: Dict[str, str], brand_config: Dict[str, Any], image_url: Optional[str] = None) -> Dict[str, Any]:
    """Actually post content to social media platforms using Composio."""
    try:
        from composio import ComposioToolSet
        
        # Initialize Composio toolset with API key only  
        api_key = os.getenv("COMPOSIO_API_KEY")
        toolset = ComposioToolSet(api_key=api_key)
        
        post_results = {}
        
        for platform, platform_content in content.items():
            try:
                print(f"📤 Posting to {platform.upper()}...")
                
                if platform.lower() == "twitter":
                    # Initialize Twitter-specific toolset
                    twitter_toolset = ComposioToolSet(
                        api_key=api_key,
                        entity_id="24b79587-149a-46be-8f02-59621dc9989d"
                    )
                    
                    # Post to Twitter with optional image
                    params = {"text": platform_content}
                    if image_url:
                        params["media"] = [image_url]
                    
                    result = twitter_toolset.execute_action(
                        action="TWITTER_CREATION_OF_A_POST",
                        params=params
                    )
                    post_results[platform] = {
                        "status": "posted",
                        "platform": platform,
                        "result": result,
                        "image_included": bool(image_url),
                        "timestamp": datetime.now().isoformat()
                    }
                    print(f"✅ Posted to Twitter successfully{' with image' if image_url else ''}")
                    
                elif platform.lower() == "linkedin":
                    # Initialize LinkedIn-specific toolset
                    linkedin_toolset = ComposioToolSet(
                        api_key=api_key,
                        entity_id="52251831-ff5f-4006-a5a4-ca894bd21eb0"
                    )
                    
                    # Post to LinkedIn company page with optional image
                    linkedin_author = brand_config.get("social", {}).get("linkedin_author")
                    
                    params = {
                        "text": platform_content,
                        "visibility": "PUBLIC"
                    }
                    
                    # Post as company page if author URN is provided
                    if linkedin_author:
                        params["author"] = linkedin_author
                        print(f"📢 Posting to LinkedIn company page: {linkedin_author}")
                    else:
                        print(f"📢 Posting to LinkedIn personal profile")
                    
                    if image_url:
                        params["media"] = [{"url": image_url}]
                    
                    result = linkedin_toolset.execute_action(
                        action="LINKEDIN_CREATE_LINKED_IN_POST",
                        params=params
                    )
                    post_results[platform] = {
                        "status": "posted", 
                        "platform": platform,
                        "result": result,
                        "image_included": bool(image_url),
                        "timestamp": datetime.now().isoformat()
                    }
                    print(f"✅ Posted to LinkedIn successfully{' with image' if image_url else ''}")
                    
                else:
                    print(f"⚠️ Platform {platform} not supported yet")
                    post_results[platform] = {
                        "status": "skipped",
                        "reason": "platform not supported",
                        "timestamp": datetime.now().isoformat()
                    }
                    
            except Exception as e:
                print(f"❌ Failed to post to {platform}: {e}")
                post_results[platform] = {
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
        
        return post_results
        
    except Exception as e:
        print(f"❌ Composio posting failed: {e}")
        return {"error": str(e)}


def save_posting_results(post_results: Dict[str, Any], storage_path: str = "/storage") -> str:
    """Save posting results to storage."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"{storage_path}/posting_results_{timestamp}.json"
    
    try:
        with open(results_file, "w") as f:
            json.dump(post_results, f, indent=2)
        
        print(f"📊 Posting results saved to {results_file}")
        return results_file
    except Exception as e:
        print(f"❌ Failed to save posting results: {e}")
        return ""


def get_platform_config(platform: str, brand_config: Dict[str, Any]) -> Dict[str, Any]:
    """Get platform-specific configuration from brand config."""
    return brand_config.get("platforms", {}).get(platform, {})


def validate_content_length(content: str, platform: str, brand_config: Dict[str, Any]) -> str:
    """Validate and truncate content to platform limits."""
    platform_config = get_platform_config(platform, brand_config)
    max_chars = platform_config.get("max_chars", 280)
    
    if len(content) > max_chars:
        truncated = content[:max_chars-3] + "..."
        print(f"⚠️ Content truncated for {platform}: {len(content)} -> {len(truncated)} chars")
        return truncated
    
    return content