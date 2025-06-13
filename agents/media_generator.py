"""Brand-aware media generation using agno and Replicate."""
import os
import yaml
import requests
from pathlib import Path
from pydantic import BaseModel
from agno.agent import Agent
from agno.models.azure import AzureOpenAI

class MediaResult(BaseModel):
    url: str
    type: str = "image"

class MediaGenerator:
    """Brand-aware media generator using agno Agent system."""
    
    def __init__(self, brand_file: str = "brand/givecare.yml"):
        self.api_key = os.getenv("REPLICATE_API_TOKEN")
        if not self.api_key:
            raise ValueError("REPLICATE_API_TOKEN environment variable required")
        
        # Load brand data
        self.brand_path = Path(brand_file)
        self.brand_data = self._load_brand_data()
        
        # Create brand-aware image agent
        self.image_agent = self._create_image_agent()
    
    def _load_brand_data(self):
        """Load brand configuration from YAML."""
        if not self.brand_path.exists():
            raise FileNotFoundError(f"Brand file not found: {self.brand_path}")
        
        with open(self.brand_path, 'r') as f:
            return yaml.safe_load(f)
    
    def _create_image_agent(self) -> Agent:
        """Create agno Agent for brand-aware image generation."""
        agent_config = self.brand_data.get('agents', {}).get('image', {})
        
        # Build brand context for additional_context
        brand_context = f"Brand: {self.brand_data.get('name')} | Style: {self.brand_data.get('image_style')} | Colors: {self.brand_data.get('color_palette')} | Attributes: {self.brand_data.get('attributes')} | Positioning: {self.brand_data.get('positioning')}"
        
        # Configure Azure OpenAI model
        azure_model = AzureOpenAI(
            id=os.getenv("AZURE_OPENAI_DEFAULT_MODEL", "gpt-4.5-preview"),
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=os.getenv("AZURE_OPENAI_BASE_URL"),
            azure_deployment=os.getenv("AZURE_OPENAI_DEFAULT_MODEL", "gpt-4.5-preview"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview")
        )
        
        return Agent(
            model=azure_model,
            description=agent_config.get('description', 'Brand-aligned visual creator'),
            instructions=agent_config.get('instructions', []),
            additional_context=brand_context,
            expected_output="Detailed image generation prompt that reflects brand visual identity"
        )
    
    async def image(self, prompt: str, context: str = "") -> MediaResult:
        """Generate brand-aware image using agno Agent."""
        # Use agno agent to create brand-aware prompt
        brand_prompt_response = self.image_agent.run(
            f"Create image generation prompt for: {prompt}",
            context=context,
            add_context=True
        )
        
        # Extract the enhanced prompt from agent response
        enhanced_prompt = brand_prompt_response.content
        
        headers = {"Authorization": f"Token {self.api_key}"}
        
        # Use Flux model with brand-enhanced prompt
        data = {
            "version": "black-forest-labs/flux-schnell",
            "input": {"prompt": f"{enhanced_prompt}, high quality, detailed"}
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
    
    async def video(self, prompt: str, context: str = "") -> MediaResult:
        """Generate brand-aware video using Azure OpenAI Sora."""
        # Check for Azure OpenAI credentials
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        
        if not endpoint or not api_key:
            # Fallback to image generation
            print("Azure OpenAI credentials not found, generating image thumbnail instead")
            image_result = await self.image(f"video thumbnail: {prompt}", context)
            return MediaResult(url=image_result.url, type="video")
        
        # Use agno agent to create brand-aware video prompt
        brand_prompt_response = self.image_agent.run(
            f"Create video generation prompt for: {prompt}",
            context=f"Video format - {context}",
            add_context=True
        )
        
        enhanced_prompt = brand_prompt_response.content
        
        headers = {"api-key": api_key, "Content-Type": "application/json"}
        
        # Create Sora video generation job
        resp = requests.post(
            f"{endpoint}/openai/v1/video/generations/jobs?api-version=preview", 
            headers=headers, 
            json={
                "model": "sora",
                "prompt": enhanced_prompt,
                "width": 1080,
                "height": 1080,
                "n_seconds": 6,
                "n_variants": 1
            }
        )
        resp.raise_for_status()
        
        job_id = resp.json()["id"]
        
        # Poll for completion
        import time
        while True:
            status = requests.get(
                f"{endpoint}/openai/v1/video/generations/jobs/{job_id}?api-version=preview", 
                headers=headers
            ).json()
            
            if status["status"] == "succeeded":
                break
            elif status["status"] == "failed":
                raise Exception("Video generation failed")
                
            time.sleep(5)
        
        # Get video URL
        gen_id = status["generations"][0]["id"]
        video_url = f"{endpoint}/openai/v1/video/generations/{gen_id}/content/video?api-version=preview"
        
        return MediaResult(url=video_url, type="video")