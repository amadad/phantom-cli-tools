"""
End-to-end tests for the social pipeline.
Tests the complete system with all components integrated.
"""
import pytest
import asyncio
import json
import os
from pathlib import Path
from unittest.mock import patch, AsyncMock, Mock
import yaml

from social_pipeline import run_and_test_pipeline
from utils.content_unit import ContentUnit, MediaAssets


class TestPipelineE2E:
    """End-to-end tests simulating real usage scenarios."""
    
    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_full_pipeline_twitter_only(self, mock_env_vars, tmp_path):
        """Test complete pipeline for Twitter only."""
        # Create temporary brand config
        brand_config = {
            'name': 'TestBrand',
            'voice': {
                'tone': 'friendly, supportive',
                'style': 'conversational'
            },
            'content_units': {
                'style': 'cohesive and aligned',
                'visual_text_harmony': 'perfect alignment'
            },
            'platforms': {
                'twitter': {
                    'max_chars': 280,
                    'media': ['image'],
                    'hashtag_limit': 3
                }
            },
            'topics': ['caregiving', 'support'],
            'color_palette': '#FF6B35, #2D3748',
            'image_style': 'warm and inviting',
            'attributes': 'caring, supportive'
        }
        
        # Write temp brand config
        brand_path = tmp_path / "brand"
        brand_path.mkdir()
        config_file = brand_path / "test.yml"
        with open(config_file, 'w') as f:
            yaml.dump(brand_config, f)
        
        with patch('social_pipeline.OptimizedSocialPipeline._load_brand_config') as mock_load, \
             patch('agno.Agent') as MockAgent, \
             patch('agno.Team') as MockTeam, \
             patch('agno.models.AzureOpenAI') as MockAzure, \
             patch('utils.media_gen_parallel.generate_brand_image_async') as mock_image_gen, \
             patch('utils.slack_approval.SlackApprovalWorkflow.request_approval') as mock_approval, \
             patch('social_pipeline.Path.mkdir'):
            
            # Setup mocks
            mock_load.return_value = brand_config
            
            # Mock research agent
            research_agent = Mock()
            research_agent.run_async = AsyncMock(return_value={
                'stories': [{
                    'title': 'Caregiving Support Study',
                    'snippet': 'New research shows importance of community',
                    'link': 'https://example.com'
                }],
                'key_insights': ['Community support is crucial'],
                'trending_topics': ['caregiver wellness']
            })
            
            # Mock content agent
            content_agent = Mock()
            content_agent.run_async = AsyncMock(return_value=ContentUnit(
                topic="Caregiver Support",
                core_message="You're not alone in your journey",
                emotional_tone="supportive, hopeful",
                visual_concept="hands reaching together",
                key_points=["Support is available", "Community matters"],
                brand_name="TestBrand",
                visual_prompt="hands reaching together in support"
            ))
            
            MockAgent.side_effect = [research_agent, content_agent]
            
            # Mock media generation
            mock_image_gen.return_value = f"{tmp_path}/test_image.png"
            
            # Mock approval (auto-approve)
            mock_approval.return_value = True
            
            # Run pipeline
            result = await run_and_test_pipeline(
                topic="Caregiver support and wellness",
                platforms=["twitter"],
                auto_post=True
            )
            
            # Verify results
            assert result.topic == "Caregiver support and wellness"
            assert result.brand == "TestBrand"
            assert "twitter" in result.platform_content
            
            # Verify Twitter content
            twitter_content = result.platform_content["twitter"]
            assert len(twitter_content.content) <= 280
            assert "You're not alone" in twitter_content.content
            
            # Verify media was generated
            assert result.content_unit.media_assets is not None
            
            # Verify approval status
            assert result.approval_status["twitter"] is True
    
    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_full_pipeline_multi_platform(self, mock_env_vars, tmp_path):
        """Test complete pipeline for multiple platforms."""
        platforms = ["twitter", "linkedin", "youtube"]
        
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.Team') as MockTeam, \
             patch('social_pipeline.AzureOpenAI') as MockAzure, \
             patch('utils.media_gen_parallel.generate_multimedia_set_async') as mock_media_gen, \
             patch('utils.slack_approval.SlackApprovalWorkflow.request_approval') as mock_approval, \
             patch('social_pipeline.Path.mkdir'):
            
            # Mock agents
            research_agent = Mock()
            research_agent.run_async = AsyncMock(return_value={
                'stories': [{'title': 'Test Story', 'snippet': 'Test snippet'}],
                'key_insights': ['Test insight'],
                'trending_topics': ['test topic']
            })
            
            content_agent = Mock()
            content_agent.run_async = AsyncMock(return_value=ContentUnit(
                topic="Multi-platform Test",
                core_message="Testing across platforms",
                emotional_tone="professional",
                visual_concept="unified message",
                key_points=["Point 1", "Point 2", "Point 3"],
                brand_name="GiveCare",
                visual_prompt="unified brand message"
            ))
            
            MockAgent.side_effect = [research_agent, content_agent]
            
            # Mock media generation for all platforms
            mock_media_gen.return_value = MediaAssets(
                image_path=f"{tmp_path}/image.png",
                video_path=f"{tmp_path}/video.mp4",
                audio_path=f"{tmp_path}/audio.mp3"
            )
            
            # Mock approval
            mock_approval.return_value = True
            
            # Run pipeline
            result = await run_and_test_pipeline(
                topic="Multi-platform content test",
                platforms=platforms,
                auto_post=True
            )
            
            # Verify all platforms have content
            assert len(result.platform_content) == 3
            for platform in platforms:
                assert platform in result.platform_content
                content = result.platform_content[platform]
                assert content.platform == platform
                assert len(content.content) > 0
                
                # Verify platform-specific adaptations
                if platform == "twitter":
                    assert len(content.content) <= 280
                elif platform == "linkedin":
                    assert len(content.content) > 280  # Should be longer
                    assert "Key Insights:" in content.content or "experience" in content.content
                elif platform == "youtube":
                    assert "video" in content.content.lower() or "today" in content.content.lower()
            
            # Verify media assets
            assert result.content_unit.media_assets.image_path is not None
            assert result.content_unit.media_assets.video_path is not None
            assert result.content_unit.media_assets.audio_path is not None
    
    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_pipeline_with_approval_rejection(self, mock_env_vars):
        """Test pipeline when content is rejected during approval."""
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.Team') as MockTeam, \
             patch('social_pipeline.AzureOpenAI') as MockAzure, \
             patch('utils.media_gen_parallel.generate_multimedia_set_async') as mock_media_gen, \
             patch('utils.slack_approval.SlackApprovalWorkflow.request_approval') as mock_approval, \
             patch('social_pipeline.Path.mkdir'):
            
            # Setup basic mocks
            MockAgent.return_value.run_async = AsyncMock()
            mock_media_gen.return_value = MediaAssets()
            
            # Mock approval rejection
            mock_approval.side_effect = [False, True, False]  # Reject Twitter, approve LinkedIn, reject YouTube
            
            # Run pipeline
            result = await run_and_test_pipeline(
                topic="Test with rejections",
                platforms=["twitter", "linkedin", "youtube"],
                auto_post=False
            )
            
            # Verify approval statuses
            assert result.approval_status["twitter"] is False
            assert result.approval_status["linkedin"] is True
            assert result.approval_status["youtube"] is False
            
            # Verify only approved content would be posted
            assert len(result.post_results) == 1
            assert "linkedin" in result.post_results
    
    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_pipeline_error_recovery(self, mock_env_vars):
        """Test pipeline handles and recovers from errors."""
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.Team') as MockTeam, \
             patch('social_pipeline.AzureOpenAI') as MockAzure, \
             patch('utils.media_gen_parallel.generate_brand_image_async') as mock_image_gen, \
             patch('utils.media_gen_parallel.generate_brand_video_async') as mock_video_gen, \
             patch('social_pipeline.Path.mkdir'):
            
            # Mock successful research
            research_agent = Mock()
            research_agent.run_async = AsyncMock(return_value={'stories': [], 'key_insights': []})
            
            content_agent = Mock()
            content_agent.run_async = AsyncMock(return_value=ContentUnit(
                topic="Test",
                core_message="Test",
                emotional_tone="neutral",
                visual_concept="test",
                key_points=["test"],
                brand_name="GiveCare"
            ))
            
            MockAgent.side_effect = [research_agent, content_agent]
            
            # Mock image generation success but video generation failure
            mock_image_gen.return_value = "/tmp/image.png"
            mock_video_gen.side_effect = Exception("Video API down")
            
            # Run pipeline - should handle video failure gracefully
            result = await run_and_test_pipeline(
                topic="Error recovery test",
                platforms=["twitter", "youtube"],
                auto_post=True
            )
            
            # Pipeline should complete despite video failure
            assert result is not None
            assert result.content_unit.media_assets.image_path is not None
            # Video should be None due to failure
            assert result.content_unit.media_assets.video_path is None
    
    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.slow
    async def test_pipeline_performance_e2e(self, mock_env_vars):
        """Test pipeline performance in realistic scenario."""
        import time
        
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.Team') as MockTeam, \
             patch('social_pipeline.AzureOpenAI') as MockAzure, \
             patch('utils.media_gen_parallel.generate_multimedia_set_async') as mock_media_gen, \
             patch('utils.slack_approval.SlackApprovalWorkflow.request_approval') as mock_approval, \
             patch('social_pipeline.Path.mkdir'):
            
            # Setup mocks with realistic delays
            async def mock_research_delay(*args, **kwargs):
                await asyncio.sleep(0.5)  # Simulate API call
                return {'stories': [], 'key_insights': []}
            
            async def mock_content_delay(*args, **kwargs):
                await asyncio.sleep(0.3)  # Simulate content generation
                return ContentUnit(
                    topic="Test",
                    core_message="Test",
                    emotional_tone="neutral",
                    visual_concept="test",
                    key_points=["test"],
                    brand_name="GiveCare"
                )
            
            async def mock_media_delay(*args, **kwargs):
                await asyncio.sleep(1.0)  # Simulate media generation
                return MediaAssets(
                    image_path="/tmp/image.png",
                    video_path="/tmp/video.mp4"
                )
            
            research_agent = Mock()
            research_agent.run_async = mock_research_delay
            
            content_agent = Mock()
            content_agent.run_async = mock_content_delay
            
            MockAgent.side_effect = [research_agent, content_agent]
            mock_media_gen.side_effect = mock_media_delay
            mock_approval.return_value = True
            
            # Time the pipeline
            start = time.time()
            result = await run_and_test_pipeline(
                topic="Performance test",
                platforms=["twitter", "linkedin", "youtube"],
                auto_post=True
            )
            elapsed = time.time() - start
            
            # With parallel processing:
            # - Research: 0.5s
            # - Content + Media (parallel): max(0.3s, 1.0s) = 1.0s
            # - Platform adaptation (parallel): ~0.1s
            # Total should be under 2s
            assert elapsed < 2.5  # Allow some overhead
            assert result is not None
            
            print(f"Pipeline completed in {elapsed:.2f} seconds")