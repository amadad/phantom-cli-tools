"""
Error handling utilities for the social pipeline.
Includes retry logic, circuit breakers, and custom exceptions.
"""
import asyncio
import functools
import logging
import time
from typing import Any, Callable, Optional, Type, Union
from enum import Enum

logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    """Error severity levels for different handling strategies."""
    LOW = "low"  # Log and continue
    MEDIUM = "medium"  # Retry with backoff
    HIGH = "high"  # Circuit break
    CRITICAL = "critical"  # Fail fast


class PipelineError(Exception):
    """Base exception for pipeline errors."""
    def __init__(self, message: str, severity: ErrorSeverity = ErrorSeverity.MEDIUM):
        super().__init__(message)
        self.severity = severity
        self.timestamp = time.time()


class ResearchError(PipelineError):
    """Error during research phase."""
    pass


class ContentGenerationError(PipelineError):
    """Error during content generation."""
    pass


class MediaGenerationError(PipelineError):
    """Error during media generation."""
    pass


class ApprovalError(PipelineError):
    """Error during approval workflow."""
    pass


class PostingError(PipelineError):
    """Error during social media posting."""
    pass


class CircuitBreaker:
    """
    Circuit breaker implementation to prevent cascading failures.
    
    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Requests fail immediately
    - HALF_OPEN: Testing if service recovered
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: Type[Exception] = Exception
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"
    
    def __enter__(self):
        if self.state == "OPEN":
            if self._should_attempt_reset():
                self.state = "HALF_OPEN"
                logger.info(f"Circuit breaker '{self.name}' entering HALF_OPEN state")
            else:
                raise PipelineError(
                    f"Circuit breaker '{self.name}' is OPEN",
                    severity=ErrorSeverity.HIGH
                )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self._on_success()
        elif isinstance(exc_val, self.expected_exception):
            self._on_failure()
        return False
    
    def _should_attempt_reset(self) -> bool:
        return (
            self.last_failure_time and
            time.time() - self.last_failure_time >= self.recovery_timeout
        )
    
    def _on_success(self):
        self.failure_count = 0
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            logger.info(f"Circuit breaker '{self.name}' recovered to CLOSED state")
    
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(
                f"Circuit breaker '{self.name}' opened after {self.failure_count} failures"
            )


def exponential_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True
):
    """
    Decorator for exponential backoff retry logic.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries
        exponential_base: Base for exponential backoff
        jitter: Add random jitter to prevent thundering herd
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if attempt == max_retries:
                        logger.error(
                            f"Max retries ({max_retries}) exceeded for {func.__name__}: {e}"
                        )
                        raise
                    
                    delay = min(
                        initial_delay * (exponential_base ** attempt),
                        max_delay
                    )
                    
                    if jitter:
                        import random
                        delay *= (0.5 + random.random())
                    
                    logger.warning(
                        f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                        f"after {delay:.2f}s delay. Error: {e}"
                    )
                    
                    await asyncio.sleep(delay)
            
            raise last_exception
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if attempt == max_retries:
                        logger.error(
                            f"Max retries ({max_retries}) exceeded for {func.__name__}: {e}"
                        )
                        raise
                    
                    delay = min(
                        initial_delay * (exponential_base ** attempt),
                        max_delay
                    )
                    
                    if jitter:
                        import random
                        delay *= (0.5 + random.random())
                    
                    logger.warning(
                        f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                        f"after {delay:.2f}s delay. Error: {e}"
                    )
                    
                    time.sleep(delay)
            
            raise last_exception
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


class ErrorHandler:
    """
    Centralized error handling for the pipeline.
    """
    
    def __init__(self):
        self.circuit_breakers = {}
        self.error_counts = {}
    
    def get_circuit_breaker(self, name: str) -> CircuitBreaker:
        """Get or create a circuit breaker for a service."""
        if name not in self.circuit_breakers:
            self.circuit_breakers[name] = CircuitBreaker(name)
        return self.circuit_breakers[name]
    
    def handle_error(
        self,
        error: Exception,
        context: str,
        severity: Optional[ErrorSeverity] = None
    ) -> bool:
        """
        Handle an error based on its severity.
        
        Returns:
            bool: True if error was handled and execution can continue
        """
        if severity is None:
            severity = getattr(error, 'severity', ErrorSeverity.MEDIUM)
        
        # Track error counts
        self.error_counts[context] = self.error_counts.get(context, 0) + 1
        
        logger.error(
            f"Error in {context}: {error} "
            f"(severity: {severity.value}, count: {self.error_counts[context]})"
        )
        
        if severity == ErrorSeverity.LOW:
            # Log and continue
            return True
        elif severity == ErrorSeverity.MEDIUM:
            # Retry logic handled by decorator
            return False
        elif severity == ErrorSeverity.HIGH:
            # Circuit breaker should handle
            return False
        else:  # CRITICAL
            # Fail fast
            raise error
    
    def get_error_summary(self) -> dict:
        """Get summary of all errors encountered."""
        return {
            "error_counts": self.error_counts.copy(),
            "circuit_breaker_states": {
                name: cb.state
                for name, cb in self.circuit_breakers.items()
            }
        }


# Global error handler instance
error_handler = ErrorHandler()


def with_fallback(
    fallback_value: Any = None,
    fallback_func: Optional[Callable] = None,
    exceptions: tuple = (Exception,)
):
    """
    Decorator to provide fallback behavior on failure.
    
    Args:
        fallback_value: Static fallback value
        fallback_func: Function to generate fallback value
        exceptions: Tuple of exceptions to catch
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except exceptions as e:
                logger.warning(
                    f"Using fallback for {func.__name__} due to error: {e}"
                )
                
                if fallback_func:
                    return fallback_func(*args, **kwargs)
                return fallback_value
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except exceptions as e:
                logger.warning(
                    f"Using fallback for {func.__name__} due to error: {e}"
                )
                
                if fallback_func:
                    return fallback_func(*args, **kwargs)
                return fallback_value
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator