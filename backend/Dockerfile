# Multi-stage Dockerfile for Clinical Ward FastAPI Backend
# Adheres to Python 3.12-slim, production security, and persistent volume storage

FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Use Python virtualenv to ensure 100% clean package isolation and eliminate Debian dist-packages path bugs
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Final Runtime Image
FROM python:3.12-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    curl \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-vie \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Environment Configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    DATABASE_URL="sqlite+aiosqlite:////app/clinical_hospital.db" \
    CORS_ORIGINS="http://localhost:3000,http://localhost:3001,https://clinical-ward.vercel.app,https://clinical-ai-monitor.vercel.app"

# Copy prebaked database first to leverage Docker layer caching
COPY clinical_prebaked.db.gz* backend/clinical_prebaked.db.gz* /app/
RUN if [ -f /app/backend/clinical_prebaked.db.gz ]; then mv /app/backend/clinical_prebaked.db.gz /app/clinical_prebaked.db.gz; fi \
    && gzip -dc /app/clinical_prebaked.db.gz > /app/clinical_hospital.db \
    && rm -f /app/clinical_prebaked.db.gz

# Copy application source and data
COPY . /app/
RUN if [ -d /app/backend/app ]; then cp -r /app/backend/* /app/ && rm -rf /app/backend; fi

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
