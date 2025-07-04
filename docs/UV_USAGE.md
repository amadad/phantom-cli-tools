# UV Package Manager Usage

## Overview

Agent Social uses [UV](https://github.com/astral-sh/uv), a fast Python package manager written in Rust, instead of pip/venv.

## Installation

### macOS/Linux
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Windows
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

## Common Commands

### Initial Setup
```bash
# Clone the repository
git clone <repo-url>
cd agent-social

# Install all dependencies
uv sync
```

### Running Code
```bash
# Run with UV's managed Python
uv run python modal_app.py

# Run Modal commands
uv run modal deploy modal_app.py
uv run modal run modal_app.py::run_pipeline
```

### Managing Dependencies
```bash
# Add a new dependency
uv add package-name

# Add a dev dependency
uv add --dev package-name

# Update dependencies
uv lock --upgrade

# Show installed packages
uv pip list
```

### Python Version
The project uses Python 3.12 as specified in `pyproject.toml`. UV will automatically download and use the correct Python version.

## Project Files

- **`pyproject.toml`** - Project configuration and dependencies
- **`uv.lock`** - Locked dependency versions
- **`.python-version`** - Python version specification (if exists)

## CI/CD Integration

The GitHub Actions workflow uses UV:
```yaml
- name: Install UV
  uses: astral-sh/setup-uv@v3
  with:
    enable-cache: true

- name: Install dependencies
  run: uv sync
```

## Benefits over pip

1. **Speed**: 10-100x faster than pip
2. **Reproducibility**: Lock file ensures exact versions
3. **Python Management**: Automatically handles Python versions
4. **No Virtual Env**: UV manages isolation automatically
5. **Better Resolution**: More reliable dependency resolution

## Troubleshooting

### UV not found
```bash
# Add to PATH
export PATH="$HOME/.cargo/bin:$PATH"
```

### Clear cache
```bash
uv cache clean
```

### Force reinstall
```bash
uv sync --reinstall
```

## Migration from pip

If you have an existing pip environment:
1. UV reads `pyproject.toml` directly
2. No need for `requirements.txt`
3. Virtual environments not needed
4. Just run `uv sync`