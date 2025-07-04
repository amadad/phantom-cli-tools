# Build stage
FROM python:3.12-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install UV
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Runtime stage
FROM python:3.12-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 agentsocial

# Set working directory
WORKDIR /app

# Copy UV and Python environment from builder
COPY --from=builder /root/.cargo/bin/uv /usr/local/bin/uv
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY --chown=agentsocial:agentsocial . .

# Set Python path to use UV's virtual environment
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app:$PYTHONPATH"

# Create output directories
RUN mkdir -p output/content output/images && \
    chown -R agentsocial:agentsocial output

# Switch to non-root user
USER agentsocial

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

# Default command - run once
CMD ["python", "main.py"]