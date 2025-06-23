# Error Handling Guide

## Overview

Agent Social implements a comprehensive error handling system with retry logic, circuit breakers, and graceful degradation. This guide explains the error handling patterns and how to work with them.

## Error Handling Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Retry Logic     │────▶│ Circuit Breakers │────▶│ Fallback Values │
│ (Exponential)   │     │ (Service Health) │     │ (Degradation)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Error Types

### 1. Pipeline Errors

Base exception class with severity levels:

```python
from utils.error_handling import PipelineError, ErrorSeverity

# Error severity levels
ErrorSeverity.LOW      # Log and continue
ErrorSeverity.MEDIUM   # Retry with backoff
ErrorSeverity.HIGH     # Circuit break
ErrorSeverity.CRITICAL # Fail fast
```

### 2. Specific Error Classes

```python
# Research phase errors
ResearchError("Failed to fetch news", severity=ErrorSeverity.HIGH)

# Content generation errors
ContentGenerationError("AI generation failed", severity=ErrorSeverity.MEDIUM)

# Media generation errors
MediaGenerationError("Image generation timeout", severity=ErrorSeverity.LOW)

# Approval workflow errors
ApprovalError("Slack connection failed", severity=ErrorSeverity.MEDIUM)

# Posting errors
PostingError("Twitter API rate limited", severity=ErrorSeverity.HIGH)
```

## Retry Logic

### Exponential Backoff

The `@exponential_backoff` decorator implements intelligent retry:

```python
@exponential_backoff(
    max_retries=3,          # Maximum retry attempts
    initial_delay=1.0,      # Initial delay in seconds
    max_delay=60.0,         # Maximum delay between retries
    exponential_base=2.0,   # Backoff multiplier
    jitter=True            # Random jitter to prevent thundering herd
)
async def flaky_api_call():
    # This will retry up to 3 times with delays: 1s, 2s, 4s
    response = await external_api.call()
    return response
```

### Usage in Pipeline

```python
# Research with automatic retry
@exponential_backoff(max_retries=3, initial_delay=2.0)
async def _research_with_retry(self, topic: str):
    return await self.research_agent.run_async(topic)
```

## Circuit Breakers

### How Circuit Breakers Work

Circuit breakers prevent cascading failures:

1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Service is down, requests fail immediately
3. **HALF_OPEN**: Testing if service recovered

### Configuration

```python
from utils.error_handling import CircuitBreaker

# Create circuit breaker
cb = CircuitBreaker(
    name="research_api",
    failure_threshold=5,    # Opens after 5 failures
    recovery_timeout=60,    # Try recovery after 60 seconds
    expected_exception=Exception
)

# Use circuit breaker
with cb:
    result = await risky_operation()
```

### Pipeline Integration

```python
# Research with circuit breaker protection
with error_handler.get_circuit_breaker("research_api"):
    research = await self._research_with_retry(topic)
```

## Fallback Strategies

### Static Fallback Values

```python
@with_fallback(fallback_value=MediaAssets())
async def _generate_media_with_fallback(self, prompt: str):
    # Returns empty MediaAssets if generation fails
    return await generate_multimedia_set_async(prompt)
```

### Dynamic Fallback Functions

```python
@with_fallback(
    fallback_func=lambda self, topic, research, platforms: 
        self._generate_default_content(topic, platforms)
)
async def _generate_content_with_fallback(self, topic, research, platforms):
    # Falls back to default content generation
    return await content_generator.generate(topic, research, platforms)
```

### Default Content Generation

```python
async def _generate_default_content(self, topic: str, platforms: List[str]):
    """Generate safe default content when AI fails."""
    return ContentUnit(
        topic=topic,
        core_message=f"Sharing insights about {topic}",
        emotional_tone="supportive",
        visual_concept="supportive community",
        key_points=[
            f"Important considerations for {topic}",
            "Community support is available",
            "You're not alone in this journey"
        ],
        brand_name=self.brand_name
    )
```

## Error Handling Patterns

### 1. Graceful Degradation

```python
# Media generation with graceful degradation
try:
    media_assets, platform_contents = await asyncio.gather(
        media_task,
        asyncio.gather(*platform_tasks),
        return_exceptions=True  # Don't fail if one task fails
    )
    
    # Handle media generation failures gracefully
    if isinstance(media_assets, Exception):
        logger.warning(f"Media generation failed: {media_assets}")
        media_assets = MediaAssets()  # Empty media assets
        
except Exception as e:
    logger.error(f"Failed to process parallel tasks: {e}")
    raise
```

### 2. Timeout Management

```python
async def _request_approval_with_timeout(self, content, platform, media):
    """Request approval with timeout protection."""
    try:
        return await asyncio.wait_for(
            self.approval_workflow.request_approval(
                content=content,
                platform=platform,
                media=media
            ),
            timeout=300  # 5 minutes
        )
    except asyncio.TimeoutError:
        logger.warning(f"Approval timeout for {platform}")
        return False  # Auto-reject on timeout
```

### 3. Partial Success Handling

```python
# Filter out failed platform adaptations
valid_platform_contents = [
    pc for pc in platform_contents 
    if not isinstance(pc, Exception)
]

# Continue with successful platforms only
if valid_platform_contents:
    logger.info(f"Successfully adapted for {len(valid_platform_contents)} platforms")
else:
    raise ContentGenerationError("All platform adaptations failed")
```

## Error Monitoring

### Centralized Error Handler

```python
from utils.error_handling import error_handler

# Handle error with context
handled = error_handler.handle_error(
    error=exception,
    context="media_generation",
    severity=ErrorSeverity.MEDIUM
)

# Get error summary
summary = error_handler.get_error_summary()
# {
#     "error_counts": {"media_generation": 3, "research": 1},
#     "circuit_breaker_states": {"research_api": "OPEN", "media_api": "CLOSED"}
# }
```

### Telemetry Integration

```python
# Record error metrics
self.telemetry.record_metric(
    "pipeline_error", 
    1, 
    {"error_type": type(e).__name__, "phase": "research"}
)
```

## Best Practices

### 1. Choose Appropriate Severity

```python
# LOW: Non-critical, can continue
if missing_optional_field:
    raise PipelineError("Optional field missing", ErrorSeverity.LOW)

# MEDIUM: Should retry
if temporary_api_error:
    raise ResearchError("API temporarily unavailable", ErrorSeverity.MEDIUM)

# HIGH: Circuit break to prevent cascade
if service_down:
    raise MediaGenerationError("Service down", ErrorSeverity.HIGH)

# CRITICAL: Unrecoverable, fail immediately
if invalid_config:
    raise PipelineError("Invalid configuration", ErrorSeverity.CRITICAL)
```

### 2. Provide Context in Errors

```python
# Bad
raise Exception("Failed")

# Good
raise ContentGenerationError(
    f"Failed to generate content for topic '{topic}': {original_error}",
    severity=ErrorSeverity.MEDIUM
)
```

### 3. Log Before Raising

```python
except Exception as e:
    logger.error(f"Detailed error context: {full_context}")
    logger.error(f"Error type: {type(e).__name__}")
    logger.error(f"Error message: {str(e)}")
    raise PipelineError(f"Operation failed: {e}", severity=ErrorSeverity.HIGH)
```

### 4. Test Error Paths

```python
# Test retry behavior
@pytest.mark.asyncio
async def test_retry_on_failure():
    with patch('api.call') as mock_call:
        mock_call.side_effect = [Exception("Fail"), Exception("Fail"), "Success"]
        
        result = await function_with_retry()
        assert result == "Success"
        assert mock_call.call_count == 3
```

## Debugging Failed Pipelines

### 1. Check Logs

```bash
# View recent errors
modal logs -f | grep ERROR

# Check specific error type
modal logs -f | grep "ResearchError"
```

### 2. Examine Error Summary

```python
# In pipeline catch block
error_summary = error_handler.get_error_summary()
logger.error(f"Pipeline failed with summary: {json.dumps(error_summary, indent=2)}")
```

### 3. Circuit Breaker Status

```python
# Check if services are circuit broken
for name, state in error_summary["circuit_breaker_states"].items():
    if state == "OPEN":
        logger.warning(f"Service {name} is circuit broken")
```

### 4. Telemetry Analysis

- Check error rates by type
- Identify error patterns
- Monitor retry success rates
- Track circuit breaker trips

## Recovery Procedures

### 1. Reset Circuit Breakers

Circuit breakers auto-reset after recovery timeout, but you can force reset:

```python
# In maintenance script
error_handler.circuit_breakers["research_api"].state = "CLOSED"
error_handler.circuit_breakers["research_api"].failure_count = 0
```

### 2. Clear Error Counts

```python
# Reset error tracking
error_handler.error_counts.clear()
```

### 3. Bypass Retries (Emergency)

```python
# Temporarily disable retries
@exponential_backoff(max_retries=0)  # No retries
async def emergency_call():
    pass
```

## Common Error Scenarios

### Scenario 1: API Rate Limiting

```python
# Implement rate limit aware retry
@exponential_backoff(
    max_retries=5,
    initial_delay=60.0,  # Start with 1 minute
    max_delay=300.0      # Max 5 minutes
)
async def rate_limited_call():
    try:
        return await api.call()
    except RateLimitError as e:
        wait_time = e.retry_after or 60
        await asyncio.sleep(wait_time)
        raise
```

### Scenario 2: Partial Media Failure

```python
# Continue without media if generation fails
if not media_assets.image_path:
    logger.warning("No image generated, posting text only")
    platform_config["media"] = []  # Remove media requirement
```

### Scenario 3: Approval Timeout

```python
# Auto-approve after timeout with notification
if approval_timeout:
    await notify_admin("Auto-approved due to timeout", content)
    return True  # Proceed with posting
```

## Integration with Modal

### Container Retries

Modal automatically retries failed containers:

```python
@app.cls(
    retries=2,  # Modal will retry container failures
)
```

### Error Notifications

Set up alerts for critical errors:

```python
if severity == ErrorSeverity.CRITICAL:
    # Send alert via Modal's notification system
    await send_critical_alert(error)
```

## Summary

The error handling system provides multiple layers of protection:

1. **Retry Logic**: Handles temporary failures
2. **Circuit Breakers**: Prevent cascade failures  
3. **Fallbacks**: Ensure pipeline completes
4. **Monitoring**: Track and analyze errors
5. **Recovery**: Clear paths to restore service

By following these patterns, Agent Social maintains high reliability even when external services fail.