# Build stage - compile dependencies
FROM arm64v8/python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    gcc g++ make python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Runtime stage - minimal image
FROM arm64v8/python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1

# Install curl for health check
RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . /app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD curl -f http://localhost:8000/api/room/state || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
