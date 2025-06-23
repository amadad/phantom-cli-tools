"""
Unit tests for error handling utilities.
"""
import pytest
import asyncio
import time
from unittest.mock import Mock, patch

from utils.error_handling import (
    CircuitBreaker, exponential_backoff, with_fallback,
    PipelineError, ErrorSeverity, error_handler
)


class TestCircuitBreaker:
    """Test circuit breaker functionality."""
    
    def test_circuit_breaker_normal_operation(self):
        """Test circuit breaker in normal (closed) state."""
        cb = CircuitBreaker("test_service", failure_threshold=3)
        
        # Should allow requests when closed
        with cb:
            assert cb.state == "CLOSED"
            # Successful operation
        
        assert cb.failure_count == 0
        assert cb.state == "CLOSED"
    
    def test_circuit_breaker_opens_after_failures(self):
        """Test circuit breaker opens after threshold failures."""
        cb = CircuitBreaker("test_service", failure_threshold=3)
        
        # Simulate failures
        for i in range(3):
            try:
                with cb:
                    raise Exception("Service error")
            except Exception:
                pass
        
        assert cb.state == "OPEN"
        assert cb.failure_count == 3
        
        # Should reject new requests when open
        with pytest.raises(PipelineError) as exc_info:
            with cb:
                pass
        
        assert "Circuit breaker 'test_service' is OPEN" in str(exc_info.value)
    
    def test_circuit_breaker_half_open_recovery(self):
        """Test circuit breaker recovery through half-open state."""
        cb = CircuitBreaker("test_service", failure_threshold=2, recovery_timeout=0.1)
        
        # Open the circuit
        for _ in range(2):
            try:
                with cb:
                    raise Exception("Service error")
            except Exception:
                pass
        
        assert cb.state == "OPEN"
        
        # Wait for recovery timeout
        time.sleep(0.2)
        
        # Should enter half-open state
        with cb:
            assert cb.state == "HALF_OPEN"
            # Successful operation
        
        # Should recover to closed
        assert cb.state == "CLOSED"
        assert cb.failure_count == 0


class TestExponentialBackoff:
    """Test exponential backoff decorator."""
    
    @pytest.mark.asyncio
    async def test_async_exponential_backoff_success(self):
        """Test exponential backoff with eventual success."""
        call_count = 0
        
        @exponential_backoff(max_retries=3, initial_delay=0.1)
        async def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Temporary error")
            return "success"
        
        result = await flaky_function()
        assert result == "success"
        assert call_count == 3
    
    @pytest.mark.asyncio
    async def test_async_exponential_backoff_max_retries(self):
        """Test exponential backoff reaches max retries."""
        call_count = 0
        
        @exponential_backoff(max_retries=2, initial_delay=0.1)
        async def always_fails():
            nonlocal call_count
            call_count += 1
            raise Exception("Persistent error")
        
        with pytest.raises(Exception) as exc_info:
            await always_fails()
        
        assert "Persistent error" in str(exc_info.value)
        assert call_count == 3  # Initial + 2 retries
    
    def test_sync_exponential_backoff(self):
        """Test exponential backoff with sync function."""
        call_count = 0
        
        @exponential_backoff(max_retries=2, initial_delay=0.1)
        def sync_function():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise Exception("Temporary error")
            return "success"
        
        result = sync_function()
        assert result == "success"
        assert call_count == 2


class TestWithFallback:
    """Test fallback decorator."""
    
    @pytest.mark.asyncio
    async def test_async_fallback_with_value(self):
        """Test async fallback with static value."""
        @with_fallback(fallback_value="default")
        async def may_fail(should_fail: bool):
            if should_fail:
                raise Exception("Function failed")
            return "success"
        
        # Normal operation
        result = await may_fail(False)
        assert result == "success"
        
        # Fallback operation
        result = await may_fail(True)
        assert result == "default"
    
    @pytest.mark.asyncio
    async def test_async_fallback_with_function(self):
        """Test async fallback with function."""
        def generate_fallback(*args, **kwargs):
            return f"fallback for {args[0]}"
        
        @with_fallback(fallback_func=generate_fallback)
        async def may_fail(name: str):
            if name == "fail":
                raise Exception("Function failed")
            return f"success for {name}"
        
        result = await may_fail("test")
        assert result == "success for test"
        
        result = await may_fail("fail")
        assert result == "fallback for fail"
    
    def test_sync_fallback(self):
        """Test sync fallback."""
        @with_fallback(fallback_value=42)
        def divide(a: int, b: int):
            return a / b
        
        assert divide(10, 2) == 5
        assert divide(10, 0) == 42  # Division by zero fallback


class TestPipelineErrors:
    """Test custom pipeline error classes."""
    
    def test_pipeline_error_severity(self):
        """Test pipeline error with severity levels."""
        error = PipelineError("Test error", severity=ErrorSeverity.HIGH)
        assert str(error) == "Test error"
        assert error.severity == ErrorSeverity.HIGH
        assert hasattr(error, 'timestamp')
    
    def test_error_hierarchy(self):
        """Test error class hierarchy."""
        from utils.error_handling import (
            ResearchError, ContentGenerationError, 
            MediaGenerationError, ApprovalError, PostingError
        )
        
        errors = [
            ResearchError("Research failed"),
            ContentGenerationError("Content failed"),
            MediaGenerationError("Media failed"),
            ApprovalError("Approval failed"),
            PostingError("Posting failed")
        ]
        
        for error in errors:
            assert isinstance(error, PipelineError)
            assert hasattr(error, 'severity')
            assert hasattr(error, 'timestamp')


class TestErrorHandler:
    """Test centralized error handler."""
    
    def test_error_handler_tracking(self):
        """Test error handler tracks errors correctly."""
        handler = error_handler
        handler.error_counts.clear()  # Reset counts
        
        # Handle different errors
        handler.handle_error(Exception("Test 1"), "component_a")
        handler.handle_error(Exception("Test 2"), "component_a")
        handler.handle_error(Exception("Test 3"), "component_b")
        
        summary = handler.get_error_summary()
        assert summary["error_counts"]["component_a"] == 2
        assert summary["error_counts"]["component_b"] == 1
    
    def test_error_handler_severity_handling(self):
        """Test error handler responds to severity levels."""
        handler = error_handler
        
        # Low severity - should return True (continue)
        error = PipelineError("Low error", severity=ErrorSeverity.LOW)
        assert handler.handle_error(error, "test") is True
        
        # Medium severity - should return False (retry)
        error = PipelineError("Medium error", severity=ErrorSeverity.MEDIUM)
        assert handler.handle_error(error, "test") is False
        
        # Critical severity - should raise
        error = PipelineError("Critical error", severity=ErrorSeverity.CRITICAL)
        with pytest.raises(PipelineError):
            handler.handle_error(error, "test")
    
    def test_circuit_breaker_management(self):
        """Test error handler manages circuit breakers."""
        handler = error_handler
        
        # Get circuit breaker
        cb1 = handler.get_circuit_breaker("service_1")
        cb2 = handler.get_circuit_breaker("service_1")
        
        # Should return same instance
        assert cb1 is cb2
        
        # Different service should get different breaker
        cb3 = handler.get_circuit_breaker("service_2")
        assert cb3 is not cb1


class TestIntegration:
    """Integration tests for error handling components."""
    
    @pytest.mark.asyncio
    async def test_retry_with_circuit_breaker(self):
        """Test retry logic with circuit breaker integration."""
        cb = CircuitBreaker("api_service", failure_threshold=2)
        call_count = 0
        
        @exponential_backoff(max_retries=3, initial_delay=0.1)
        async def api_call():
            nonlocal call_count
            with cb:
                call_count += 1
                if call_count <= 3:
                    raise Exception("API error")
                return "success"
        
        # First attempt should fail and open circuit
        with pytest.raises(Exception):
            await api_call()
        
        # Circuit should be open
        assert cb.state == "OPEN"
        
        # Further attempts should fail immediately
        with pytest.raises(PipelineError) as exc_info:
            await api_call()
        
        assert "Circuit breaker" in str(exc_info.value)