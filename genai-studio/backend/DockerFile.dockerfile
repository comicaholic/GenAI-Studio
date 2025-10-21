# backend/Dockerfile
FROM python:3.11-slim

# System deps once (needed for some Python wheels & llama-cpp)
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential cmake libopenblas-dev \
 && rm -rf /var/lib/apt/lists/*

# Install system monitoring tools and GPU libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    procps \
    lshw \
    pciutils \
    && rm -rf /var/lib/apt/lists/*

# Install GPU monitoring libraries
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir GPUtil pynvml

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt

# Copy source last (better caching)
COPY . /app

# Create data directory for analytics
RUN mkdir -p /app/data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
