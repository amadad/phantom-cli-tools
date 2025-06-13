#!/usr/bin/env python3
"""
Configuration management for Agent Social pipeline.
Consolidates all settings and environment variables.
"""

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    # Azure OpenAI (Required)
    AZURE_OPENAI_API_KEY: str
    AZURE_OPENAI_BASE_URL: str
    AZURE_OPENAI_GPT45_DEPLOYMENT: str
    AZURE_OPENAI_API_VERSION: str = "2024-02-15-preview"
    
    # Serper API (Required for search)
    SERPER_API_KEY: str
    
    # Slack (Optional - for approval workflow)
    SLACK_BOT_TOKEN: Optional[str] = None
    SLACK_APP_TOKEN: Optional[str] = None
    SLACK_APPROVAL_CHANNEL: str = "#general"
    
    # Composio (Optional - for social media posting)
    COMPOSIO_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Global settings instance
settings = Settings() 