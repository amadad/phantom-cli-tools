"""
Pytest configuration and shared fixtures for all tests.
"""
import os
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from pathlib import Path
import yaml
import json
from datetime import datetime

# Add project root to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

@pytest.fixture
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_env_vars(monkeypatch):
    """Mock environment variables for testing."""
    env_vars = {
        'AZURE_OPENAI_API_KEY': 'test-key',
        'AZURE_OPENAI_BASE_URL': 'https://test.openai.azure.com',
        'AZURE_OPENAI_DEPLOYMENT': 'gpt-4',
        'AZURE_OPENAI_API_VERSION': '2024-02-15-preview',
        'SERPER_API_KEY': 'test-serper-key',
        'COMPOSIO_API_KEY': 'test-composio-key',
        'SLACK_BOT_TOKEN': 'xoxb-test-token',
        'SLACK_APPROVAL_CHANNEL': 'C12345',
        'REPLICATE_API_TOKEN': 'test-replicate',
        'SONAUTO_API_KEY': 'test-sonauto',
    }
    for key, value in env_vars.items():
        monkeypatch.setenv(key, value)
    return env_vars

@pytest.fixture
def brand_config():
    """Load test brand configuration."""
    return {
        'name': 'TestBrand',
        'voice': {
            'tone': 'friendly, professional',
            'style': 'conversational',
            'attributes': ['empathetic', 'knowledgeable']
        },
        'visual_style': {
            'primary': 'modern, clean design',
            'color_palette': '#0066CC, #FFFFFF, #333333',
            'image_style': 'professional photography'
        },
        'content_units': {
            'visual_text_harmony': 'visuals should complement text message',
            'ensure_alignment': True
        },
        'platforms': {
            'twitter': {
                'max_chars': 280,
                'media': ['image'],
                'hashtag_limit': 3
            },
            'linkedin': {
                'max_chars': 3000,
                'media': ['image', 'document'],
                'professional_tone': True
            },
            'youtube': {
                'media': ['video', 'audio'],
                'video_length': 60,
                'community_post': True
            }
        }
    }

@pytest.fixture
def mock_agno_agent():
    """Mock Agno Agent for testing."""
    agent = Mock()
    agent.run = AsyncMock()
    agent.run_async = AsyncMock()
    agent.name = "test_agent"
    agent.model = "gpt-4"
    return agent

@pytest.fixture
def mock_research_result():
    """Mock research result for testing."""
    return {
        'stories': [
            {
                'title': 'New Study on Caregiver Support',
                'snippet': 'Research shows importance of community',
                'link': 'https://example.com/study',
                'relevance': 0.95
            }
        ],
        'key_insights': [
            'Community support reduces caregiver burnout',
            '70% of caregivers report feeling isolated'
        ],
        'trending_topics': ['caregiver wellness', 'support networks']
    }

@pytest.fixture
def mock_content_unit():
    """Mock content unit for testing."""
    return {
        'core_message': 'Caregivers need support networks',
        'emotional_tone': 'hopeful, empowering',
        'visual_concept': 'caregiver surrounded by supportive community',
        'key_points': ['not alone', 'resources available', 'strength in connection'],
        'platform_content': {
            'twitter': 'You\'re not alone in your caregiving journey. Connect with others who understand. #CaregiverSupport',
            'linkedin': 'The Hidden Crisis: 70% of Caregivers Report Feeling Isolated...',
            'youtube': 'Today we\'re talking about the importance of caregiver support networks...'
        }
    }

@pytest.fixture
def mock_media_assets():
    """Mock media assets for testing."""
    return {
        'image_url': 'https://example.com/image.jpg',
        'video_url': 'https://example.com/video.mp4',
        'audio_url': 'https://example.com/audio.mp3',
        'thumbnails': {
            'small': 'https://example.com/thumb_small.jpg',
            'large': 'https://example.com/thumb_large.jpg'
        }
    }

@pytest.fixture
def temp_output_dir(tmp_path):
    """Create temporary output directory for tests."""
    output_dir = tmp_path / "output"
    output_dir.mkdir()
    return output_dir

@pytest.fixture
def mock_slack_client():
    """Mock Slack client for testing."""
    client = Mock()
    client.chat_postMessage = AsyncMock(return_value={'ok': True, 'ts': '123.456'})
    client.conversations_info = AsyncMock(return_value={
        'ok': True,
        'channel': {'name': 'test-channel'}
    })
    return client

@pytest.fixture
def mock_composio_client():
    """Mock Composio client for testing."""
    client = Mock()
    client.get_entity = Mock()
    client.get_entity.return_value.execute = AsyncMock(return_value={
        'status': 'success',
        'post_id': '123456789'
    })
    return client

@pytest.fixture
async def cleanup_test_files():
    """Cleanup any test files created during tests."""
    yield
    # Cleanup logic here if needed
    test_output = Path("output/test_*")
    for file in test_output.parent.glob("test_*"):
        if file.is_file():
            file.unlink()

# Utility functions for tests
def assert_valid_content_unit(content_unit):
    """Assert that a content unit has all required fields."""
    assert 'core_message' in content_unit
    assert 'emotional_tone' in content_unit
    assert 'visual_concept' in content_unit
    assert 'key_points' in content_unit
    assert isinstance(content_unit['key_points'], list)

def assert_valid_social_content(content, platform):
    """Assert that social content is valid for a platform."""
    assert 'content' in content
    assert 'platform' in content
    assert content['platform'] == platform
    
    if platform == 'twitter':
        assert len(content['content']) <= 280
    elif platform == 'linkedin':
        assert len(content['content']) <= 3000