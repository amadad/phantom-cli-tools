"""
Unit tests for ContentUnit and related classes.
"""
import pytest
from datetime import datetime
from unittest.mock import Mock, AsyncMock

from utils.content_unit import (
    ContentUnit, MediaRequirements, MediaAssets, 
    PlatformContent, ContentUnitGenerator
)


class TestMediaRequirements:
    """Test MediaRequirements model."""
    
    def test_default_requirements(self):
        """Test default media requirements."""
        reqs = MediaRequirements()
        assert reqs.needs_image is True
        assert reqs.needs_video is False
        assert reqs.needs_audio is False
        assert reqs.image_style is None
        assert reqs.video_length is None
        assert reqs.audio_type is None
    
    def test_custom_requirements(self):
        """Test custom media requirements."""
        reqs = MediaRequirements(
            needs_image=True,
            needs_video=True,
            needs_audio=True,
            video_length=60,
            audio_type="background"
        )
        assert reqs.needs_video is True
        assert reqs.video_length == 60
        assert reqs.audio_type == "background"


class TestPlatformContent:
    """Test PlatformContent model."""
    
    def test_twitter_content_length_validation(self):
        """Test Twitter content length is enforced."""
        content = PlatformContent(
            platform="twitter",
            content="x" * 300  # Too long for Twitter
        )
        assert len(content.content) == 280  # Should be truncated
        assert content.content.endswith("...")
    
    def test_linkedin_content_length_validation(self):
        """Test LinkedIn content length is enforced."""
        content = PlatformContent(
            platform="linkedin",
            content="x" * 3500  # Too long for LinkedIn
        )
        assert len(content.content) == 3000
        assert content.content.endswith("...")
    
    def test_platform_content_attributes(self):
        """Test platform content attributes."""
        content = PlatformContent(
            platform="twitter",
            content="Test tweet",
            hashtags=["#test", "#tweet"],
            mentions=["@user"],
            media_types=["image"]
        )
        assert content.platform == "twitter"
        assert content.content == "Test tweet"
        assert len(content.hashtags) == 2
        assert len(content.mentions) == 1
        assert "image" in content.media_types


class TestContentUnit:
    """Test ContentUnit model."""
    
    def test_content_unit_creation(self):
        """Test basic content unit creation."""
        unit = ContentUnit(
            topic="Caregiver Support",
            core_message="You're not alone in your caregiving journey",
            emotional_tone="hopeful, supportive",
            visual_concept="hands reaching together in support",
            key_points=["community matters", "resources available"],
            brand_name="TestBrand"
        )
        
        assert unit.topic == "Caregiver Support"
        assert unit.core_message == "You're not alone in your caregiving journey"
        assert len(unit.key_points) == 2
        assert unit.unit_id is not None
        assert isinstance(unit.created_at, datetime)
    
    def test_visual_prompt_auto_generation(self):
        """Test automatic visual prompt generation."""
        unit = ContentUnit(
            topic="Test",
            core_message="Test message",
            emotional_tone="hopeful",
            visual_concept="supportive community",
            key_points=["test"],
            brand_name="TestBrand"
        )
        
        assert unit.visual_prompt is not None
        assert "supportive community" in unit.visual_prompt
        assert "hopeful" in unit.visual_prompt
        assert "TestBrand" in unit.visual_prompt
    
    def test_adapt_for_twitter(self, brand_config):
        """Test Twitter adaptation."""
        unit = ContentUnit(
            topic="Caregiver Support",
            core_message="Caregivers need community support",
            emotional_tone="hopeful",
            visual_concept="supportive circle",
            key_points=["You're not alone", "Help is available", "Stay strong"],
            brand_name="TestBrand"
        )
        
        twitter_content = unit.adapt_for_platform("twitter", brand_config['platforms']['twitter'])
        
        assert twitter_content.platform == "twitter"
        assert len(twitter_content.content) <= 280
        assert "Caregivers need community support" in twitter_content.content
        assert len(twitter_content.hashtags) <= 3  # Twitter limit from config
    
    def test_adapt_for_linkedin(self, brand_config):
        """Test LinkedIn adaptation."""
        unit = ContentUnit(
            topic="Caregiver Support",
            core_message="The importance of caregiver support networks",
            emotional_tone="professional, empathetic",
            visual_concept="professional support meeting",
            key_points=["Statistics show 70% feel isolated", "Support reduces burnout"],
            brand_name="TestBrand",
            research_context={
                "key_insights": ["Community support is crucial", "Resources are available"]
            }
        )
        
        linkedin_content = unit.adapt_for_platform("linkedin", brand_config['platforms']['linkedin'])
        
        assert linkedin_content.platform == "linkedin"
        assert len(linkedin_content.content) <= 3000
        assert "importance of caregiver support networks" in linkedin_content.content
        assert "Key Insights:" in linkedin_content.content
        assert "What's your experience?" in linkedin_content.content
    
    def test_adapt_for_youtube(self, brand_config):
        """Test YouTube adaptation."""
        unit = ContentUnit(
            topic="Caregiver Wellness",
            core_message="Self-care isn't selfish for caregivers",
            emotional_tone="encouraging",
            visual_concept="caregiver taking a peaceful break",
            key_points=["Burnout prevention", "Simple self-care tips", "Community support"],
            brand_name="TestBrand"
        )
        
        youtube_content = unit.adapt_for_platform("youtube", brand_config['platforms']['youtube'])
        
        assert youtube_content.platform == "youtube"
        assert "In today's video" in youtube_content.content
        assert "Let us know in the comments" in youtube_content.content
        assert all(point in youtube_content.content for point in ["Burnout prevention", "Simple self-care tips"])
    
    def test_json_serialization(self):
        """Test JSON serialization and deserialization."""
        unit = ContentUnit(
            topic="Test Topic",
            core_message="Test message",
            emotional_tone="neutral",
            visual_concept="test visual",
            key_points=["point1", "point2"],
            brand_name="TestBrand"
        )
        
        # Serialize to JSON
        json_str = unit.to_json()
        assert isinstance(json_str, str)
        
        # Deserialize from JSON
        unit2 = ContentUnit.from_json(json_str)
        assert unit2.topic == unit.topic
        assert unit2.core_message == unit.core_message
        assert unit2.key_points == unit.key_points


class TestContentUnitGenerator:
    """Test ContentUnitGenerator."""
    
    @pytest.mark.asyncio
    async def test_generate_content_unit(self, brand_config, mock_agno_agent):
        """Test content unit generation."""
        # Setup mock agent response
        mock_response = ContentUnit(
            topic="Test Topic",
            core_message="Generated message",
            emotional_tone="hopeful",
            visual_concept="test visual",
            key_points=["point1", "point2"],
            brand_name="TestBrand"
        )
        mock_agno_agent.run_async.return_value = mock_response
        
        # Create generator
        generator = ContentUnitGenerator(brand_config, mock_agno_agent)
        
        # Generate content unit
        research = {"stories": ["test story"], "insights": ["test insight"]}
        platforms = ["twitter", "linkedin", "youtube"]
        
        unit = await generator.generate("Test Topic", research, platforms)
        
        # Verify generation
        assert unit.topic == "Test Topic"
        assert unit.brand_name == brand_config['name']
        assert unit.media_requirements.needs_image is True
        assert unit.media_requirements.needs_video is True  # YouTube requires video
        assert unit.media_requirements.needs_audio is True  # YouTube can use audio
        assert unit.research_context == research
        
        # Verify agent was called
        mock_agno_agent.run_async.assert_called_once()
        call_args = mock_agno_agent.run_async.call_args
        assert "Test Topic" in call_args[0][0]
        assert "TestBrand" in call_args[0][0]
    
    def test_determine_media_requirements(self, brand_config):
        """Test media requirements determination based on platforms."""
        generator = ContentUnitGenerator(brand_config, Mock())
        
        # Test Twitter only
        reqs = generator._determine_media_requirements(["twitter"])
        assert reqs.needs_image is True
        assert reqs.needs_video is False
        assert reqs.needs_audio is False
        
        # Test YouTube
        reqs = generator._determine_media_requirements(["youtube"])
        assert reqs.needs_image is True
        assert reqs.needs_video is True
        assert reqs.needs_audio is True
        assert reqs.video_length == 60
        
        # Test Instagram
        reqs = generator._determine_media_requirements(["instagram"])
        assert reqs.needs_image is True
        assert reqs.needs_video is True
        assert reqs.video_length == 30
        
        # Test multiple platforms
        reqs = generator._determine_media_requirements(["twitter", "youtube", "linkedin"])
        assert reqs.needs_image is True
        assert reqs.needs_video is True
        assert reqs.needs_audio is True
    
    def test_create_generation_prompt(self, brand_config):
        """Test prompt creation for content generation."""
        generator = ContentUnitGenerator(brand_config, Mock())
        
        research = {"stories": ["test story"], "insights": ["test insight"]}
        media_reqs = MediaRequirements(needs_image=True, needs_video=True)
        
        prompt = generator._create_generation_prompt("Test Topic", research, media_reqs)
        
        assert "Test Topic" in prompt
        assert "TestBrand" in prompt
        assert "test story" in prompt
        assert "Needs Image: True" in prompt
        assert "Needs Video: True" in prompt
        assert brand_config['voice']['tone'] in prompt