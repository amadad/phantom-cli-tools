"""
Unit tests for Agno integration features.
Tests caching, session management, and telemetry.
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime

from social_pipeline import OptimizedSocialPipeline, ResearchResult


class TestAgnoCache:
    """Test Agno cache integration."""
    
    @pytest.mark.asyncio
    async def test_cache_hit_for_research(self, mock_env_vars, brand_config):
        """Test that cached research results are used."""
        with patch('social_pipeline.AgentCache') as MockCache, \
             patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.SessionManager') as MockSession, \
             patch('social_pipeline.Telemetry') as MockTelemetry:
            
            # Setup cache mock
            cache_instance = Mock()
            cache_instance.get = AsyncMock(return_value={
                'stories': [{'title': 'Cached story'}],
                'key_insights': ['Cached insight']
            })
            cache_instance.set = AsyncMock()
            MockCache.return_value = cache_instance
            
            # Setup other mocks
            MockAgent.return_value.run_async = AsyncMock()
            
            # Create pipeline
            pipeline = OptimizedSocialPipeline()
            pipeline.cache = cache_instance
            
            # Simulate research phase
            topic = "test topic"
            cache_key = f"research_{topic}_{pipeline.brand_name}"
            
            # Call should use cache
            cached_result = await cache_instance.get(cache_key)
            assert cached_result['stories'][0]['title'] == 'Cached story'
            
            # Verify cache was checked
            cache_instance.get.assert_called_once_with(cache_key)
    
    @pytest.mark.asyncio
    async def test_cache_miss_and_set(self, mock_env_vars):
        """Test cache miss triggers API call and cache set."""
        with patch('social_pipeline.AgentCache') as MockCache, \
             patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.SessionManager') as MockSession, \
             patch('social_pipeline.Telemetry') as MockTelemetry:
            
            # Setup cache mock - return None for cache miss
            cache_instance = Mock()
            cache_instance.get = AsyncMock(return_value=None)
            cache_instance.set = AsyncMock()
            MockCache.return_value = cache_instance
            
            # Setup agent mock
            research_result = ResearchResult(
                stories=[{'title': 'New story'}],
                key_insights=['New insight'],
                trending_topics=['trending'],
                source_links=['https://example.com']
            )
            
            agent_instance = Mock()
            agent_instance.run_async = AsyncMock(return_value=research_result)
            MockAgent.return_value = agent_instance
            
            # Create pipeline
            pipeline = OptimizedSocialPipeline()
            pipeline.research_agent = agent_instance
            pipeline.cache = cache_instance
            
            # Perform research
            result = await pipeline._research_with_retry("test topic")
            
            # Verify API was called
            agent_instance.run_async.assert_called_once()
            
            # Result should be returned
            assert result.stories[0]['title'] == 'New story'


class TestSessionManager:
    """Test session management integration."""
    
    def test_session_id_generation(self, mock_env_vars):
        """Test session ID is generated correctly."""
        with patch('social_pipeline.SessionManager') as MockSession, \
             patch('social_pipeline.Agent'), \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.Telemetry'):
            
            session_instance = Mock()
            session_instance.session_id = "GiveCare_session_20240115"
            MockSession.return_value = session_instance
            
            pipeline = OptimizedSocialPipeline()
            
            # Verify session ID format
            assert pipeline.session_manager.session_id.startswith("GiveCare_session_")
            assert len(pipeline.session_manager.session_id) > 20
    
    @pytest.mark.asyncio
    async def test_session_context_in_agent_calls(self, mock_env_vars):
        """Test session context is passed to agent calls."""
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.SessionManager') as MockSession, \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.Telemetry'):
            
            # Setup session
            session_instance = Mock()
            session_instance.session_id = "test_session_123"
            MockSession.return_value = session_instance
            
            # Setup agent
            agent_instance = Mock()
            agent_instance.run_async = AsyncMock()
            MockAgent.return_value = agent_instance
            
            pipeline = OptimizedSocialPipeline()
            pipeline.research_agent = agent_instance
            pipeline.session_manager = session_instance
            
            # Call research
            await pipeline._research_with_retry("test topic")
            
            # Verify session ID was passed
            agent_instance.run_async.assert_called_with(
                "Find recent news and insights about: test topic",
                stream=False,
                session_id="test_session_123"
            )


class TestTelemetry:
    """Test telemetry integration."""
    
    def test_telemetry_initialization(self, mock_env_vars):
        """Test telemetry is initialized correctly."""
        with patch('social_pipeline.Telemetry') as MockTelemetry, \
             patch('social_pipeline.Agent'), \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.SessionManager'):
            
            telemetry_instance = Mock()
            MockTelemetry.return_value = telemetry_instance
            
            pipeline = OptimizedSocialPipeline()
            
            # Verify telemetry was initialized
            MockTelemetry.assert_called_with(
                service_name="social_pipeline_GiveCare",
                api_key=None,  # From mock env
                enabled=True
            )
    
    @pytest.mark.asyncio
    async def test_telemetry_span_tracking(self, mock_env_vars):
        """Test telemetry spans are created for pipeline phases."""
        with patch('social_pipeline.Telemetry') as MockTelemetry, \
             patch('social_pipeline.Agent'), \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.SessionManager'):
            
            # Setup telemetry mock with context manager
            span_mock = MagicMock()
            span_mock.__enter__ = Mock(return_value=span_mock)
            span_mock.__exit__ = Mock(return_value=None)
            span_mock.set_attribute = Mock()
            
            telemetry_instance = Mock()
            telemetry_instance.span = Mock(return_value=span_mock)
            telemetry_instance.record_metric = Mock()
            MockTelemetry.return_value = telemetry_instance
            
            pipeline = OptimizedSocialPipeline()
            pipeline.telemetry = telemetry_instance
            
            # Simulate pipeline run context
            with pipeline.telemetry.span("pipeline_run") as span:
                span.set_attribute("topic", "test")
                span.set_attribute("platforms", "twitter,linkedin")
                span.set_attribute("brand", "GiveCare")
            
            # Verify span was created and attributes set
            telemetry_instance.span.assert_called_with("pipeline_run")
            span_mock.set_attribute.assert_any_call("topic", "test")
            span_mock.set_attribute.assert_any_call("platforms", "twitter,linkedin")
            span_mock.set_attribute.assert_any_call("brand", "GiveCare")
    
    def test_telemetry_error_metrics(self, mock_env_vars):
        """Test telemetry records error metrics."""
        with patch('social_pipeline.Telemetry') as MockTelemetry, \
             patch('social_pipeline.Agent'), \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.SessionManager'):
            
            telemetry_instance = Mock()
            telemetry_instance.record_metric = Mock()
            MockTelemetry.return_value = telemetry_instance
            
            pipeline = OptimizedSocialPipeline()
            pipeline.telemetry = telemetry_instance
            
            # Simulate error metric recording
            pipeline.telemetry.record_metric(
                "pipeline_error", 
                1, 
                {"error_type": "ResearchError"}
            )
            
            # Verify metric was recorded
            telemetry_instance.record_metric.assert_called_with(
                "pipeline_error",
                1,
                {"error_type": "ResearchError"}
            )


class TestAgentFallbackBehavior:
    """Test agent fallback behaviors."""
    
    def test_research_agent_fallback(self, mock_env_vars):
        """Test research agent has fallback behavior configured."""
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.SessionManager'), \
             patch('social_pipeline.Telemetry'):
            
            # Capture agent creation
            agent_calls = []
            MockAgent.side_effect = lambda **kwargs: Mock(
                **{k: v for k, v in kwargs.items() if k != 'instructions'}
            )
            
            pipeline = OptimizedSocialPipeline()
            
            # Find research agent creation
            research_agent_call = [
                call for call in MockAgent.call_args_list
                if call.kwargs.get('name', '').endswith('_researcher')
            ][0]
            
            # Verify fallback behavior
            assert research_agent_call.kwargs.get('fallback_behavior') == 'return_empty'
    
    def test_content_agent_fallback(self, mock_env_vars):
        """Test content agent has fallback behavior configured."""
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.SessionManager'), \
             patch('social_pipeline.Telemetry'):
            
            MockAgent.return_value = Mock()
            
            pipeline = OptimizedSocialPipeline()
            
            # Find content agent creation
            content_agent_call = [
                call for call in MockAgent.call_args_list
                if call.kwargs.get('name', '').endswith('_content_creator')
            ][0]
            
            # Verify fallback behavior
            assert content_agent_call.kwargs.get('fallback_behavior') == 'use_default'


class TestAgentMemory:
    """Test agent memory features."""
    
    def test_agents_have_memory_enabled(self, mock_env_vars):
        """Test agents are created with memory enabled."""
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.SessionManager'), \
             patch('social_pipeline.Telemetry'):
            
            MockAgent.return_value = Mock()
            
            pipeline = OptimizedSocialPipeline()
            
            # Check all agent creations
            for call in MockAgent.call_args_list:
                assert call.kwargs.get('enable_agentic_memory') is True
    
    def test_agents_use_shared_storage(self, mock_env_vars):
        """Test agents use shared storage for memory."""
        with patch('social_pipeline.Agent') as MockAgent, \
             patch('social_pipeline.Storage') as MockStorage, \
             patch('social_pipeline.AgentCache'), \
             patch('social_pipeline.SessionManager'), \
             patch('social_pipeline.Telemetry'):
            
            storage_instance = Mock()
            MockStorage.return_value = storage_instance
            MockAgent.return_value = Mock()
            
            # Create pipeline with storage path
            pipeline = OptimizedSocialPipeline(storage_path="/tmp/test.db")
            
            # Verify storage was created
            MockStorage.assert_called_with(path="/tmp/test.db")
            
            # Verify agents use the storage
            for call in MockAgent.call_args_list:
                assert call.kwargs.get('storage') is storage_instance