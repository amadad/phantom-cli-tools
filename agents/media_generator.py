"""Simple media generation using Replicate."""
import os
import requests
from pydantic import BaseModel

class MediaResult(BaseModel):
    url: str
    type: str = "image"

class MediaGenerator:
    """Simplified media generator using Replicate API directly."""
    
    def __init__(self):
        self.api_key = os.getenv("REPLICATE_API_TOKEN")
        if not self.api_key:
            raise ValueError("REPLICATE_API_TOKEN environment variable required")
    
    async def image(self, prompt: str) -> MediaResult:
        """Generate image using Replicate."""
        headers = {"Authorization": f"Token {self.api_key}"}
        
        # Use simple Flux model
        data = {
            "version": "black-forest-labs/flux-schnell",
            "input": {"prompt": f"{prompt}, high quality, detailed"}
        }
        
        response = requests.post(
            "https://api.replicate.com/v1/predictions",
            headers=headers,
            json=data
        )
        response.raise_for_status()
        
        prediction = response.json()
        prediction_id = prediction["id"]
        
        # Poll for completion
        while True:
            response = requests.get(
                f"https://api.replicate.com/v1/predictions/{prediction_id}",
                headers=headers
            )
            result = response.json()
            
            if result["status"] == "succeeded":
                return MediaResult(url=result["output"][0])
            elif result["status"] == "failed":
                raise Exception("Image generation failed")
                
            import time
            time.sleep(2)
    
    async def video(self, prompt: str) -> MediaResult:
        """Simple video generation - can be expanded later."""
        # For now, just return a placeholder or use same image logic
        image_result = await self.image(f"video thumbnail: {prompt}")
        return MediaResult(url=image_result.url, type="video")