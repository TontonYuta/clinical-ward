# Multi-stage Dockerfile for Clinical Ward FastAPI Backend
# Adheres to Python 3.12-slim, production security, and persistent volume storage

FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

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

COPY --from=builder /install /usr/local

# Copy application source, data, and initial database
COPY . /app/

# Environment Configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    DATABASE_URL="sqlite+aiosqlite:////app/clinical_hospital.db" \
    CORS_ORIGINS="http://localhost:3000,http://localhost:3001,https://clinical-ward.vercel.app,https://clinical-ai-monitor.vercel.app"

# Unpack pre-baked hospital database (54,885 DAV drugs, 702 monographs) in <1s
RUN gzip -dc /app/clinical_prebaked.db.gz > /app/clinical_hospital.db && rm -f /app/clinical_prebaked.db.gz


EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
