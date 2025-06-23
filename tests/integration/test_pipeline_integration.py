"""
Integration tests for the optimized social pipeline.
Tests the complete flow with mocked external services.
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import json

from social_pipeline import OptimizedSocialPipeline, PipelineResult
from utils.content_unit import ContentUnit, MediaAssets, PlatformContent


class TestPipelineIntegration:
    """Integration tests for the social pipeline."""
    
    @pytest.mark.asyncio
    async def test_complete_pipeline_flow(
        self, 
        mock_env_vars, 
        brand_config, 
        mock_research_result,
        mock_content_unit,
        temp_output_dir,
        monkeypatch
    ):
        """Test the complete pipeline flow from research to content generation."""
        # Mock Agno agents
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.Team') as MockTeam, \
             patch('social_pipeline.AzureOpenAI') as MockAzure, \
             patch('utils.media_gen_parallel.generate_multimedia_set_async') as mock_media_gen, \
             patch('utils.slack_approval.SlackApprovalWorkflow') as MockApproval:
            
            # Configure mocks
            mock_agent = AsyncMock()
            mock_agent.run_async = AsyncMock(return_value=mock_research_result)
            MockAgent.return_value = mock_agent
            
            # Mock content generation
            mock_content_agent = AsyncMock()
            mock_content_agent.run_async = AsyncMock(return_value=ContentUnit(
                topic="Test Topic",
                core_message="Test message",
                emotional_tone="hopeful",
                visual_concept="test visual",
                key_points=["point1", "point2"],
                brand_name="TestBrand",
                visual_prompt="test visual prompt"
            ))
            
            # Mock media generation
            mock_media_gen.return_value = MediaAssets(
                image_path="/tmp/test_image.png",
                video_path="/tmp/test_video.mp4",
                audio_path="/tmp/test_audio.mp3"
            )
            
            # Mock approval workflow
            mock_approval = MockApproval.return_value
            mock_approval.request_approval = AsyncMock(return_value=True)
            
            # Setup output directory
            monkeypatch.setattr(Path, 'mkdir', lambda self, **kwargs: None)
            
            # Create pipeline
            pipeline = OptimizedSocialPipeline()
            pipeline.content_agent = mock_content_agent
            
            # Run pipeline
            result = await pipeline.run_pipeline(
                topic="Test Topic",
                platforms=["twitter", "linkedin", "youtube"],
                require_approval=True
            )
            
            # Verify result structure
            assert isinstance(result, PipelineResult)
            assert result.topic == "Test Topic"
            assert result.brand == "GiveCare"  # Default from brand config
            assert isinstance(result.content_unit, ContentUnit)
            assert len(result.platform_content) == 3
            assert all(platform in result.platform_content for platform in ["twitter", "linkedin", "youtube"])
            
            # Verify platform content
            for platform, content in result.platform_content.items():
                assert isinstance(content, PlatformContent)
                assert content.platform == platform
                assert len(content.content) > 0
            
            # Verify approval was requested
            assert mock_approval.request_approval.call_count == 3
            assert all(result.approval_status.values())
            
            # Verify media generation was called
            mock_media_gen.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_pipeline_with_parallel_processing(
        self,
        mock_env_vars,
        brand_config,
        monkeypatch
    ):
        """Test that pipeline processes platforms in parallel."""
        processing_times = []
        
        async def mock_adapt_content(unit, platform, config):
            """Mock content adaptation that tracks timing."""
            start = asyncio.get_event_loop().time()
            await asyncio.sleep(0.1)  # Simulate processing
            processing_times.append({
                'platform': platform,
                'start': start,
                'end': asyncio.get_event_loop().time()
            })
            return PlatformContent(
                platform=platform,
                content=f"Content for {platform}"
            )
        
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.ContentUnitGenerator') as MockGenerator, \
             patch('utils.media_gen_parallel.generate_multimedia_set_async') as mock_media_gen:
            
            # Setup mocks
            MockAgent.return_value.run_async = AsyncMock()
            
            mock_generator = MockGenerator.return_value
            mock_generator.generate = AsyncMock(return_value=ContentUnit(
                topic="Test",
                core_message="Test",
                emotional_tone="neutral",
                visual_concept="test",
                key_points=["test"],
                brand_name="Test"
            ))
            
            mock_media_gen.return_value = MediaAssets()
            
            # Create pipeline
            pipeline = OptimizedSocialPipeline()
            pipeline._adapt_content_for_platform = mock_adapt_content
            
            # Run pipeline with multiple platforms
            platforms = ["twitter", "linkedin", "youtube", "facebook"]
            start_time = asyncio.get_event_loop().time()
            
            result = await pipeline.run_pipeline(
                topic="Test",
                platforms=platforms,
                require_approval=False
            )
            
            total_time = asyncio.get_event_loop().time() - start_time
            
            # Verify parallel processing
            assert len(processing_times) == 4
            
            # Check that platforms were processed in parallel
            # If sequential, total time would be ~0.4s (4 * 0.1s)
            # If parallel, total time should be ~0.1s
            assert total_time < 0.2  # Allow some overhead
            
            # Verify all platforms processed
            assert len(result.platform_content) == 4
    
    @pytest.mark.asyncio
    async def test_pipeline_error_handling(
        self,
        mock_env_vars,
        monkeypatch
    ):
        """Test pipeline handles errors gracefully."""
        with patch('social_pipeline.Agent') as MockAgent:
            # Mock agent that fails
            mock_agent = MockAgent.return_value
            mock_agent.run_async = AsyncMock(side_effect=Exception("Research failed"))
            
            pipeline = OptimizedSocialPipeline()
            
            # Pipeline should raise the exception
            with pytest.raises(Exception) as exc_info:
                await pipeline.run_pipeline("Test Topic")
            
            assert "Research failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_pipeline_with_no_approval(
        self,
        mock_env_vars,
        brand_config,
        monkeypatch
    ):
        """Test pipeline when approval is not required."""
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.ContentUnitGenerator') as MockGenerator, \
             patch('utils.media_gen_parallel.generate_multimedia_set_async') as mock_media_gen, \
             patch('utils.slack_approval.SlackApprovalWorkflow') as MockApproval:
            
            # Setup basic mocks
            MockAgent.return_value.run_async = AsyncMock()
            MockGenerator.return_value.generate = AsyncMock(return_value=ContentUnit(
                topic="Test",
                core_message="Test",
                emotional_tone="neutral",
                visual_concept="test",
                key_points=["test"],
                brand_name="Test"
            ))
            mock_media_gen.return_value = MediaAssets()
            
            mock_approval = MockApproval.return_value
            mock_approval.request_approval = AsyncMock()
            
            pipeline = OptimizedSocialPipeline()
            
            result = await pipeline.run_pipeline(
                topic="Test",
                platforms=["twitter"],
                require_approval=False
            )
            
            # Verify approval was not requested
            mock_approval.request_approval.assert_not_called()
            
            # Verify approval status is automatically True
            assert result.approval_status["twitter"] is True
    
    @pytest.mark.asyncio
    async def test_media_generation_integration(
        self,
        mock_env_vars,
        brand_config
    ):
        """Test integration with media generation module."""
        from utils.media_gen_parallel import generate_multimedia_set_async
        
        with patch('utils.media_gen_parallel.generate_brand_image_async') as mock_image, \
             patch('utils.media_gen_parallel.generate_brand_video_async') as mock_video, \
             patch('utils.media_gen_parallel.generate_background_audio_async') as mock_audio:
            
            # Setup media generation mocks
            mock_image.return_value = "/tmp/image.png"
            mock_video.return_value = "/tmp/video.mp4"
            mock_audio.return_value = "/tmp/audio.mp3"
            
            # Test parallel generation
            media_assets = await generate_multimedia_set_async(
                visual_prompt="Test visual",
                platforms=["twitter", "youtube"],
                brand_config=brand_config
            )
            
            # Verify all media types were generated
            assert media_assets.image_path == "/tmp/image.png"
            assert media_assets.video_path == "/tmp/video.mp4"
            assert media_assets.audio_path == "/tmp/audio.mp3"
            
            # Verify functions were called
            mock_image.assert_called_once()
            mock_video.assert_called_once()
            mock_audio.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_content_unit_platform_adaptation(
        self,
        brand_config
    ):
        """Test content unit adaptation for different platforms."""
        unit = ContentUnit(
            topic="Caregiver Support",
            core_message="You're not alone",
            emotional_tone="supportive",
            visual_concept="hands together",
            key_points=["Community matters", "Help available", "Stay strong"],
            brand_name="TestBrand"
        )
        
        # Test Twitter adaptation
        twitter_content = unit.adapt_for_platform("twitter", brand_config['platforms']['twitter'])
        assert len(twitter_content.content) <= 280
        assert twitter_content.platform == "twitter"
        assert "You're not alone" in twitter_content.content
        
        # Test LinkedIn adaptation
        linkedin_content = unit.adapt_for_platform("linkedin", brand_config['platforms']['linkedin'])
        assert len(linkedin_content.content) <= 3000
        assert linkedin_content.platform == "linkedin"
        assert "You're not alone" in linkedin_content.content
        assert len(linkedin_content.content) > len(twitter_content.content)  # Should be longer
        
        # Test YouTube adaptation
        youtube_content = unit.adapt_for_platform("youtube", brand_config['platforms']['youtube'])
        assert youtube_content.platform == "youtube"
        assert "video" in youtube_content.content.lower() or "today" in youtube_content.content.lower()


class TestPipelinePerformance:
    """Performance-related integration tests."""
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_pipeline_performance_metrics(
        self,
        mock_env_vars,
        brand_config,
        monkeypatch
    ):
        """Test pipeline performance meets requirements."""
        import time
        
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.ContentUnitGenerator') as MockGenerator, \
             patch('utils.media_gen_parallel.generate_multimedia_set_async') as mock_media_gen:
            
            # Setup fast mocks
            MockAgent.return_value.run_async = AsyncMock(return_value={})
            MockGenerator.return_value.generate = AsyncMock(return_value=ContentUnit(
                topic="Test",
                core_message="Test",
                emotional_tone="neutral",
                visual_concept="test",
                key_points=["test"],
                brand_name="Test"
            ))
            
            # Simulate realistic media generation time
            async def mock_media_delay(*args, **kwargs):
                await asyncio.sleep(0.5)  # Simulate API call
                return MediaAssets()
            
            mock_media_gen.side_effect = mock_media_delay
            
            pipeline = OptimizedSocialPipeline()
            
            # Measure pipeline execution time
            start = time.time()
            result = await pipeline.run_pipeline(
                topic="Test",
                platforms=["twitter", "linkedin", "youtube"],
                require_approval=False
            )
            elapsed = time.time() - start
            
            # Pipeline should complete in under 2 seconds
            # (media generation is the bottleneck at 0.5s)
            assert elapsed < 2.0
            assert result is not None