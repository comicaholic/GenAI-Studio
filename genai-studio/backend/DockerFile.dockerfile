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
COPY backend/requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt

# Build frontend
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
    && npm ci || npm install \
    && rm -rf /var/lib/apt/lists/*
COPY frontend/ .
RUN npm run build

# Copy backend source
WORKDIR /app
COPY backend/ .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
