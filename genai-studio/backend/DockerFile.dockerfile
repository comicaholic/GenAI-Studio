# backend/Dockerfile
FROM python:3.11-slim

# System deps once (needed for some Python wheels & llama-cpp)
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential cmake libopenblas-dev \
 && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt

# Copy source last (better caching)
COPY . /app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
