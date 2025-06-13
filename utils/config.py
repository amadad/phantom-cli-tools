# config.py
import logging
from pydantic import Field
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # Azure OpenAI
    AZURE_OPENAI_BASE_URL: str = Field(..., env="AZURE_OPENAI_BASE_URL")
    AZURE_OPENAI_GPT45_DEPLOYMENT: str = Field(..., env="AZURE_OPENAI_GPT45_DEPLOYMENT")
    AZURE_OPENAI_API_VERSION: str = Field("2024-10-21", env="AZURE_OPENAI_API_VERSION")
    AZURE_OPENAI_API_KEY: str = Field(..., env="AZURE_OPENAI_API_KEY")
    
    # External Services  
    SERPER_API_KEY: str = Field(..., env="SERPER_API_KEY")
    REPLICATE_API_TOKEN: str = Field(..., env="REPLICATE_API_TOKEN")
    
    # Slack Configuration
    SLACK_BOT_TOKEN: str = Field(..., env="SLACK_BOT_TOKEN")
    SLACK_VERIFICATION_TOKEN: str = Field(..., env="SLACK_VERIFICATION_TOKEN")
    SLACK_APPROVAL_CHANNEL: str = Field("#general", env="SLACK_APPROVAL_CHANNEL")
    SLACK_SIGNING_SECRET: str = Field(..., env="SLACK_SIGNING_SECRET")
    
    # Paths
    OUTPUT_BASE: str = Field("output", env="OUTPUT_BASE")
    IMAGES_DIR: str = Field("output/images", env="IMAGES_DIR")
    ARTICLES_DIR: str = Field("output/articles", env="ARTICLES_DIR")
    
    @property
    def output_paths(self) -> dict:
        """Return all output paths as a dictionary."""
        return {
            "base": Path(self.OUTPUT_BASE),
            "images": Path(self.IMAGES_DIR),
            "articles": Path(self.ARTICLES_DIR)
        }
    
    def ensure_paths_exist(self) -> None:
        """Ensure all output directories exist."""
        for path in self.output_paths.values():
            path.mkdir(parents=True, exist_ok=True)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields in .env file

# Lazy settings initialization - only load when accessed
_settings = None

def get_settings():
    """Get settings instance, initializing if needed."""
    global _settings
    if _settings is None:
        _settings = Settings()
        _settings.ensure_paths_exist()
        
        # Validate required environment variables are set
        required_vars = [
            "AZURE_OPENAI_BASE_URL",
            "AZURE_OPENAI_GPT45_DEPLOYMENT", 
            "AZURE_OPENAI_API_KEY",
            "SERPER_API_KEY",
            "REPLICATE_API_TOKEN",
            "SLACK_BOT_TOKEN",
            "SLACK_VERIFICATION_TOKEN", 
            "SLACK_SIGNING_SECRET"
        ]
        
        missing_vars = [var for var in required_vars if not getattr(_settings, var, None)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
            
        logger = logging.getLogger(__name__)
        logger.info("Configuration loaded successfully")
    
    return _settings

# For backward compatibility
@property
def settings():
    return get_settings()

# Create a settings proxy that loads lazily
class SettingsProxy:
    def __getattr__(self, name):
        return getattr(get_settings(), name)

settings = SettingsProxy()