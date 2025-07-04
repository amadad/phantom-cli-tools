# AGENTS.md - AI Agent Instructions for Agent Social

## Code Style
- Use **Black** for Python formatting with 120 character line length
- Use **type hints** for all function parameters and returns
- Use **async/await** for all I/O operations (API calls, file operations)
- Use **f-strings** for string formatting, not `.format()` or `%`
- Variable names should be **descriptive, not abbreviated** (`content_generation` not `content_gen`)
- Use **Pydantic models** for all structured data (API responses, configuration)

## Testing
- Run `uv run main.py --no-stories --no-image` before finalizing changes
- Test individual components with Python one-liners using `asyncio.run()`
- All API integrations must have **graceful fallback** behavior
- Check `output/content/` directory for generated JSON files after test runs
- Verify environment variables are loaded with `os.getenv()` defaults

## Dependencies & Package Management
- Use **UV package manager** (`uv sync`, `uv add`, `uv run`)
- All dependencies go in `pyproject.toml`, not requirements.txt
- Pin major versions for stability: `"agno>=1.7.1"`, `"pydantic>=2.11.7"`
- New dependencies require justification and testing

## API Integration Patterns
### Azure OpenAI (Agno 1.7.1)
```python
# ✅ CORRECT Pattern
from agno.models.azure import AzureOpenAI
model = AzureOpenAI(
    azure_deployment=os.getenv("AZURE_OPENAI_DEFAULT_MODEL"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
)
response = await agent.arun(prompt)  # Use .arun() not .generate()
```

### SerpAPI Integration
```python
# ✅ CORRECT - Use SerpAPI.com (not Serper.dev)
response = await client.get(
    "https://serpapi.com/search.json",
    params={"engine": "google", "q": query, "api_key": os.getenv("SERP_API_KEY")}
)
```

### Error Handling
```python
# ✅ CORRECT Pattern
try:
    result = await api_call()
    print(f"✅ Success: {result}")
    return result
except Exception as e:
    print(f"❌ Failed: {e}")
    return fallback_value  # Always provide fallback
```

## File Organization Rules
- **Keep 8 core files**: main.py + 7 utils files (includes Sora video generation)
- **Consolidate related functions** in single files (don't split unnecessarily)
- **No redundant modules** - if functionality overlaps, merge files
- **utils/** prefix for all utility modules
- **brands/** for YAML configuration only

## Configuration Management
- All configuration in **YAML files** (`brands/givecare.yml`)
- Environment variables for **secrets only** (API keys, tokens)
- Use `os.getenv()` with sensible defaults
- **No hardcoded values** in source code

## Content Generation Guidelines
- All content must be **brand-aligned** using YAML voice configuration
- Use **structured outputs** (Pydantic models) for consistency
- Generate **platform-specific content** (Twitter 280 chars, LinkedIn longer)
- Include **quality scoring** (0-1 scale) for all generated content
- Save all generated content as **JSON with metadata**

## Approval Workflow Standards
- **Terminal approval** is primary interface (built-in input prompts)
- **Telegram/Slack** are optional secondary channels
- **30-second timeout** for approval prompts in automated environments
- **Always log approval decisions** (approved/rejected/timeout)

## Image Generation Standards
- Use **Replicate FLUX models** for high quality
- Implement **visual modes** (framed_portrait, lifestyle_scene, illustrative_concept)
- Include **fallback models** if primary fails
- **Brand-specific styling** from YAML configuration
- **Async generation** with proper error handling

## Commit Message Format
```
[Fix] Fix SerpAPI integration using correct endpoint
[Feature] Add visual mode selection for image generation  
[Refactor] Consolidate redundant utility modules
[Docs] Update README with current architecture
```

## PR Requirements
- **Test pipeline end-to-end** with `uv run main.py`
- **Update documentation** if changing architecture
- **Include testing instructions** in PR description
- **One feature per PR** - keep changes focused
- **No breaking changes** without migration plan

## Directory Structure Rules
```
agent-social/
├── main.py                     # CLI entry point only
├── utils/                      # All utilities (max 6 files)
├── brands/                     # YAML configs only
├── output/content/             # Generated content archive
└── docs/                       # Essential docs only (3-4 files max)
```

## Environment Setup Commands
```bash
# Initial setup
uv sync
cp .env.example .env

# Development testing
uv run main.py --no-stories --no-image    # Safe testing
uv run main.py --topic "test"             # Custom topic
uv run main.py --platforms "twitter"      # Single platform

# Component testing
python -c "from utils.evaluation import evaluate_content; print(evaluate_content('test', 'twitter'))"
```

## Debugging Guidelines
- Use **descriptive print statements** with emojis (🔍, ✅, ❌, ⚠️)
- **Log API response status codes** for external services
- **Check output/content/** for generated JSON files
- **Use --no-stories --no-image flags** to isolate issues
- **Monitor API quotas** and rate limits

## Performance Requirements
- **Content generation**: < 15 seconds per platform
- **Image generation**: < 30 seconds per image
- **Story discovery**: < 10 seconds with SerpAPI
- **Total pipeline**: < 60 seconds end-to-end
- **Memory usage**: < 500MB for normal operations

## Security Guidelines
- **Never commit API keys** to repository
- **Use environment variables** for all secrets
- **Validate all external input** before processing
- **Sanitize file paths** when saving content
- **Log security-relevant events** (API failures, auth issues)

## Future Development Rules
- **No new files** without removing existing ones (keep at 8 total)
- **Consolidate before expanding** - merge similar functionality
- **Maintain backward compatibility** for CLI interface
- **Document all breaking changes** with migration guides
- **Test on clean environment** before releasing

---

*These instructions ensure Agent Social remains lean, focused, and maintainable while delivering high-quality automated content generation.*