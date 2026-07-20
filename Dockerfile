# =============================================================================
# AI RFP Scout API — FastAPI + Uvicorn
# =============================================================================
# Build:  docker build -t ai-rfp-scout-api .
# Run:    docker run --rm -p 8000:8000 --env-file .env ai-rfp-scout-api
# Compose: docker compose up --build
# =============================================================================

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Default listen port (platforms may override with PORT)
    PORT=8000 \
    # App paths
    UPLOAD_DIR=/app/uploads

WORKDIR /app

# Runtime OS packages:
#   libpq5  — PostgreSQL client library for psycopg2
#   curl    — healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Dependencies layer (cached until requirements.txt changes)
# ---------------------------------------------------------------------------
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# ---------------------------------------------------------------------------
# Application code
# ---------------------------------------------------------------------------
COPY app ./app
COPY alembic.ini .
COPY alembic ./alembic
COPY scripts ./scripts

# Writable upload directory + non-root user
RUN mkdir -p /app/uploads /app/logs \
    && useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app \
    && chmod +x /app/scripts/start.sh

USER appuser

EXPOSE 8000

# Healthcheck used by Docker / Compose / orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/health" || exit 1

# Entrypoint supports PORT injection (Render, Railway, Azure, Compose)
CMD ["/app/scripts/start.sh"]
