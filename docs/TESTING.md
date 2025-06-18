# Agent Social - Testing Guide

## Testing Philosophy

Agent Social uses a pragmatic testing approach focused on integration testing of the full pipeline with individual component testing for critical functions.

## Test Structure

```
tests/                          # Test directory (to be created)
├── conftest.py                # Pytest configuration
├── test_pipeline.py           # Full pipeline tests
├── test_agents.py             # Agent behavior tests
├── test_brand.py              # Brand framework tests
├── test_approval.py           # Slack approval tests
├── test_posting.py            # Platform posting tests
└── fixtures/                  # Test data
    ├── sample_stories.json
    ├── sample_content.json
    └── test_brand.yaml
```

## Setting Up Tests

### Install Test Dependencies
```bash
pip install pytest pytest-asyncio pytest-mock httpx
```

### Environment Configuration
```bash
# Create test environment file
cp .env .env.test

# Update with test values
SLACK_CHANNEL_ID=test-channel
APPROVAL_TIMEOUT_MINUTES=1  # Quick timeout for tests
TEST_MODE=true
```

## Writing Tests

### Pipeline Integration Tests
```python
# tests/test_pipeline.py
import pytest
from social_pipeline import social_pipeline

@pytest.mark.asyncio
async def test_full_pipeline_flow():
    """Test complete pipeline from discovery to posting."""
    # Run in test mode (no actual posting)
    result = await social_pipeline(test_mode=True)
    
    assert result["story_discovered"] is True
    assert result["content_generated"] is True
    assert "approval_requested" in result
    assert len(result["platform_content"]) > 0

@pytest.mark.asyncio
async def test_pipeline_with_approval_timeout():
    """Test pipeline behavior when approval times out."""
    # Set very short timeout
    result = await social_pipeline(
        test_mode=True,
        approval_timeout_seconds=1
    )
    
    assert result["approval_status"] == "timeout"
    assert result["posted"] is False
```

### Agent Testing
```python
# tests/test_agents.py
import pytest
from social_pipeline import create_story_agent, create_content_agent

@pytest.mark.asyncio
async def test_story_discovery_agent():
    """Test story discovery with mock data."""
    agent = create_story_agent()
    
    # Mock Serper API response
    with mock.patch('serper_api.search') as mock_search:
        mock_search.return_value = load_fixture('sample_stories.json')
        
        stories = await agent.discover_stories(
            topics=["caregiving", "eldercare"]
        )
        
        assert len(stories) > 0
        assert all(story.get("url") for story in stories)

@pytest.mark.asyncio
async def test_content_generation():
    """Test content generation for different platforms."""
    agent = create_content_agent()
    story = load_fixture('sample_stories.json')[0]
    
    content = await agent.generate_content(
        story=story,
        platforms=["twitter", "linkedin"]
    )
    
    assert "twitter" in content.platform_content
    assert len(content.platform_content["twitter"]) <= 280
    assert "linkedin" in content.platform_content
    assert content.visual_suggestions
```

### Brand Framework Testing
```python
# tests/test_brand.py
import pytest
from social_pipeline import BrandFramework

def test_brand_framework_loading():
    """Test loading brand configuration from YAML."""
    brand = BrandFramework.from_yaml("tests/fixtures/test_brand.yaml")
    
    assert brand.name == "TestBrand"
    assert len(brand.topics) > 0
    assert brand.voice.tone
    assert brand.guidelines

def test_brand_to_instructions():
    """Test converting brand to agent instructions."""
    brand = BrandFramework.from_yaml("brands/givecare.yaml")
    instructions = brand.to_instructions()
    
    assert isinstance(instructions, list)
    assert any("tone" in inst for inst in instructions)
    assert any("topics" in inst for inst in instructions)
```

### Approval Workflow Testing
```python
# tests/test_approval.py
import pytest
from social_pipeline import SlackApprovalBot

@pytest.mark.asyncio
async def test_slack_approval_message_format():
    """Test Slack message formatting."""
    bot = SlackApprovalBot(test_mode=True)
    
    content = {
        "story_title": "Test Story",
        "story_url": "https://example.com",
        "platform_content": {
            "twitter": "Test tweet content",
            "linkedin": "Test LinkedIn content"
        }
    }
    
    message = bot.format_approval_message(content)
    
    assert "Test Story" in message["text"]
    assert "twitter" in message["blocks"][0]["text"]["text"].lower()
    assert len(message["blocks"]) > 2  # Content + buttons

@pytest.mark.asyncio
async def test_approval_timeout():
    """Test approval timeout behavior."""
    bot = SlackApprovalBot(test_mode=True)
    
    # Start approval with 1 second timeout
    result = await bot.request_approval(
        content={},
        timeout_seconds=1
    )
    
    assert result["status"] == "timeout"
    assert result["approved"] is False
```

### Platform Posting Tests
```python
# tests/test_posting.py
import pytest
from social_pipeline import post_to_platforms

@pytest.mark.asyncio
async def test_multi_platform_posting():
    """Test posting to multiple platforms."""
    content = {
        "twitter": "Test tweet",
        "linkedin": "Test LinkedIn post"
    }
    
    # Mock Composio API
    with mock.patch('composio.post') as mock_post:
        mock_post.return_value = {"id": "123", "success": True}
        
        results = await post_to_platforms(
            content=content,
            platforms=["twitter", "linkedin"],
            test_mode=True
        )
        
        assert results["twitter"]["success"] is True
        assert results["linkedin"]["success"] is True
        assert mock_post.call_count == 2

@pytest.mark.asyncio
async def test_platform_failure_handling():
    """Test graceful handling of platform failures."""
    content = {"twitter": "Test", "linkedin": "Test"}
    
    with mock.patch('composio.post') as mock_post:
        # Twitter succeeds, LinkedIn fails
        mock_post.side_effect = [
            {"id": "123", "success": True},
            Exception("Rate limit exceeded")
        ]
        
        results = await post_to_platforms(
            content=content,
            platforms=["twitter", "linkedin"]
        )
        
        assert results["twitter"]["success"] is True
        assert results["linkedin"]["success"] is False
        assert "Rate limit" in results["linkedin"]["error"]
```

## Running Tests

### Basic Test Execution
```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_pipeline.py

# Run specific test function
pytest tests/test_pipeline.py::test_full_pipeline_flow

# Run tests matching pattern
pytest -k "approval"
```

### Test Coverage
```bash
# Run with coverage report
pytest --cov=social_pipeline --cov-report=html

# View coverage report
open htmlcov/index.html

# Coverage targets
# - Pipeline core: > 80%
# - Agents: > 70%
# - Error handling: > 90%
```

### Continuous Integration
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      
      - name: Run tests
        env:
          TEST_MODE: true
        run: pytest -v --cov=social_pipeline
```

## Mock Strategies

### API Mocking
```python
# conftest.py - Shared test fixtures
import pytest
from unittest.mock import Mock, patch

@pytest.fixture
def mock_serper():
    """Mock Serper API responses."""
    with patch('social_pipeline.serper_search') as mock:
        mock.return_value = [
            {
                "title": "Test Story",
                "snippet": "Test content",
                "link": "https://example.com"
            }
        ]
        yield mock

@pytest.fixture
def mock_openai():
    """Mock OpenAI API responses."""
    with patch('agno.Agent.run') as mock:
        mock.return_value = Mock(
            platform_content={"twitter": "Test tweet"},
            visual_suggestions=["Test image"]
        )
        yield mock
```

### Environment Mocking
```python
@pytest.fixture
def test_env(monkeypatch):
    """Set test environment variables."""
    monkeypatch.setenv("TEST_MODE", "true")
    monkeypatch.setenv("APPROVAL_TIMEOUT_MINUTES", "0.1")
    monkeypatch.setenv("SLACK_CHANNEL_ID", "test-channel")
```

## Performance Testing

### Load Testing
```python
# tests/test_performance.py
import asyncio
import time

@pytest.mark.asyncio
async def test_concurrent_content_generation():
    """Test concurrent content generation performance."""
    start_time = time.time()
    
    # Generate content for 10 stories concurrently
    tasks = []
    for i in range(10):
        task = generate_content(test_story)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks)
    
    end_time = time.time()
    duration = end_time - start_time
    
    assert len(results) == 10
    assert duration < 30  # Should complete in 30 seconds
    print(f"Generated 10 pieces of content in {duration:.2f} seconds")
```

### API Rate Limit Testing
```python
@pytest.mark.asyncio
async def test_rate_limit_handling():
    """Test graceful handling of rate limits."""
    # Simulate hitting rate limit
    with patch('serper_api.search') as mock_search:
        mock_search.side_effect = [
            RateLimitError("Rate limit exceeded"),
            RateLimitError("Rate limit exceeded"),
            [{"title": "Story", "link": "url"}]  # Success on 3rd try
        ]
        
        result = await discover_stories_with_retry()
        assert result is not None
        assert mock_search.call_count == 3
```

## Test Data Management

### Fixtures Directory
```
tests/fixtures/
├── sample_stories.json      # Serper API response examples
├── sample_content.json      # Generated content examples
├── test_brand.yaml         # Test brand configuration
└── mock_responses/         # API response mocks
    ├── twitter_post.json
    └── linkedin_post.json
```

### Sample Test Data
```json
// tests/fixtures/sample_stories.json
[
  {
    "title": "New Study on Caregiving Impact",
    "snippet": "Research shows caregiving affects...",
    "link": "https://example.com/study",
    "date": "2024-01-15"
  }
]
```

## Best Practices

### Test Organization
1. **Group by functionality**: Pipeline, agents, approval, posting
2. **Use descriptive names**: `test_approval_timeout_returns_false`
3. **One assertion focus**: Each test validates one behavior
4. **Mock external dependencies**: APIs, databases, file systems

### Async Testing
```python
# Always use pytest.mark.asyncio for async tests
@pytest.mark.asyncio
async def test_async_function():
    result = await async_function()
    assert result
```

### Error Testing
```python
@pytest.mark.asyncio
async def test_error_handling():
    """Test specific error scenarios."""
    with pytest.raises(ValueError, match="Invalid platform"):
        await post_to_platform("invalid_platform", {})
```

### Parameterized Testing
```python
@pytest.mark.parametrize("platform,limit", [
    ("twitter", 280),
    ("linkedin", 3000),
    ("facebook", 63206),
])
async def test_platform_character_limits(platform, limit):
    """Test character limits for each platform."""
    content = await generate_content(story, platform)
    assert len(content) <= limit
```

## Debugging Tests

### Verbose Output
```bash
# Show print statements
pytest -s

# Show full diff on assertions
pytest -vv

# Stop on first failure
pytest -x

# Drop into debugger on failure
pytest --pdb
```

### Test Logging
```python
import logging

# Enable logging in tests
logging.basicConfig(level=logging.DEBUG)

@pytest.mark.asyncio
async def test_with_logging(caplog):
    """Test that captures log output."""
    with caplog.at_level(logging.INFO):
        await social_pipeline()
    
    assert "Pipeline completed" in caplog.text
```

---

*Testing ensures Agent Social delivers reliable, high-quality social media automation.*