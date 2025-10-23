# GenAI Studio - Technical User Guide

This comprehensive guide covers advanced usage, configuration, and troubleshooting for GenAI Studio.

## 📋 Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Configuration Management](#configuration-management)
3. [Model Management](#model-management)
4. [Local Model Integration](#local-model-integration)
5. [Evaluation & Testing](#evaluation--testing)
6. [Analytics & Monitoring](#analytics--monitoring)
7. [API Usage](#api-usage)
8. [Troubleshooting](#troubleshooting)
9. [Performance Optimization](#performance-optimization)
10. [Advanced Features](#advanced-features)

## 🚀 Installation & Setup

### Prerequisites

**System Requirements:**
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher
- **Memory**: 8GB RAM minimum, 16GB recommended
- **Storage**: 10GB free space minimum
- **GPU**: NVIDIA GPU with CUDA support (optional, for local models)

**Required Software:**
- Git
- Docker Desktop (for containerized deployment)
- Miniconda/Anaconda (for native deployment)

### Installation Methods

#### Method 1: Docker Deployment (Recommended for Development)

**Advantages:**
- Isolated environment
- Easy setup and teardown
- Consistent across platforms
- No dependency conflicts

**Limitations:**
- Limited GPU access on Windows
- Less accurate system metrics
- Larger resource overhead

```bash
# Windows
run_docker.bat

# macOS/Linux
./run_docker(macos_linux).sh
```

#### Method 2: Native Installation (Recommended for Production)

**Advantages:**
- Direct hardware access
- Accurate system metrics
- Better GPU utilization
- Lower resource overhead

**Setup Steps:**
```bash
# 1. Create conda environment
conda create -n genai-studio python=3.11 -y
conda activate genai-studio

# 2. Install Python dependencies
pip install -r backend/requirements.txt
pip install GPUtil pynvml

# 3. Install frontend dependencies
cd frontend
npm install

# 4. Start backend
cd ../backend
python start.py

# 5. Start frontend (separate terminal)
cd ../frontend
npm run dev
```

## ⚙️ Configuration Management

### Environment Variables

**Backend Configuration** (`backend/.env`):
```env
# API Keys
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACE_TOKEN=your_huggingface_token_here

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=False

# Model Configuration
MODELS_DIR=./data/models
CACHE_DIR=./data/cache

# GPU Configuration
CUDA_VISIBLE_DEVICES=0,1
```

**Frontend Configuration** (`frontend/.env`):
```env
# API Configuration
VITE_API_BASE=http://localhost:8000
VITE_DOCKER_MODE=false

# Development
VITE_DEV_SERVER_PORT=5173
```

### Settings Management

**Access Settings:**
1. Navigate to Settings page
2. Configure API keys and connections
3. Set up local model servers
4. Configure paths and preferences

**Key Settings Categories:**

#### UI Settings
- **Theme**: Light/Dark mode
- **Default Landing Page**: Choose startup page
- **Background State Management**: Enable/disable state persistence

#### API Configuration
- **Groq API**: High-performance inference
- **Hugging Face**: Model discovery and downloads
- **Local Models**: LM Studio, Ollama, vLLM servers

#### Path Configuration
- **OCR Source**: Input files for OCR evaluation
- **OCR Reference**: Reference files for comparison
- **Prompt Source**: Input files for prompt evaluation
- **Chat Downloads**: Output directory for chat exports

## 🤖 Model Management

### Model Discovery

**Hugging Face Integration:**
1. Configure Hugging Face token in Settings
2. Use Discover Models feature
3. Search by name, tags, or categories
4. View model details and requirements

**Model Categories:**
- **General-purpose chat/instruction**: Llama, Mistral, Qwen, Gemma
- **Coding assistants**: Code Llama, StarCoder, DeepSeek-Coder
- **Embedding models**: BGE, E5, All-MiniLM
- **Vision/multimodal**: LLaVA, BLIP, Qwen-VL
- **Reasoning/math**: Specialized reasoning models

### Model Downloads

**Download Methods:**

#### Method 1: vLLM Integration (Recommended)
- **Advantages**: Reliable downloads, automatic model management
- **Setup**: Install vLLM via Settings → Local Models → vLLM Setup
- **Usage**: Automatic when vLLM is available

#### Method 2: Direct Hugging Face Download
- **Advantages**: Direct control, no additional setup
- **Limitations**: May fail with large models, slower downloads
- **Usage**: Fallback method when vLLM unavailable

**Download Process:**
1. Browse models in Discover Models
2. Click "Download" on desired model
3. Monitor progress in download queue
4. Model appears in Local Models when complete

### Local Model Management

**Supported Providers:**

#### LM Studio
- **Default URL**: `http://localhost:1234`
- **Features**: Model loading, parameter tuning
- **Setup**: Install LM Studio, start server

#### Ollama
- **Default URL**: `http://localhost:11434`
- **Features**: Local model management, cloud model access
- **Setup**: Install Ollama, pull models

#### vLLM
- **Default URL**: `http://localhost:8000`
- **Features**: High-performance inference, reliable downloads
- **Setup**: One-click installation via Settings

## 🔌 Local Model Integration

### vLLM Setup (New Feature)

**Installation Options:**

#### Pip Installation
```bash
pip install vllm
```

#### Conda Installation
```bash
conda install -c conda-forge vllm
```

#### Docker Installation
```bash
docker pull vllm/vllm-openai:latest
```

**Server Startup:**
```bash
python -m vllm.entrypoints.openai.api_server \
  --model microsoft/DialoGPT-medium \
  --host 0.0.0.0 \
  --port 8000
```

**Configuration:**
1. Go to Settings → Local Models → vLLM Setup
2. Click "Install" for your preferred method
3. Configure server URL
4. Test connection

### Model Server Configuration

**LM Studio:**
1. Install LM Studio
2. Start server on port 1234
3. Configure in Settings → Local Models
4. Test connection

**Ollama:**
1. Install Ollama
2. Start server on port 11434
3. Pull desired models: `ollama pull llama2`
4. Configure in Settings → Local Models

## 🧪 Evaluation & Testing

### OCR Evaluation

**Purpose**: Test OCR models with PDF and image processing

**Setup:**
1. Configure source and reference directories
2. Upload test files (PDFs, images)
3. Select OCR model
4. Run evaluation

**Metrics:**
- **Accuracy**: Character-level accuracy
- **Precision**: Correct positive predictions
- **Recall**: Correctly identified characters
- **F1 Score**: Harmonic mean of precision and recall

**Process:**
1. Upload source files to `data/source/`
2. Upload reference files to `data/reference/`
3. Select model and parameters
4. Run evaluation
5. Review results and metrics

### Prompt Evaluation

**Purpose**: Systematic testing of prompts across multiple models

**Features:**
- **Batch Testing**: Test multiple prompts simultaneously
- **Model Comparison**: Compare results across different models
- **Parameter Sweeping**: Test different temperature, max_tokens settings
- **Context Management**: Test with different context lengths

**Process:**
1. Create prompt templates
2. Configure test parameters
3. Select models for testing
4. Run evaluation
5. Analyze results and metrics

**Metrics:**
- **Response Time**: Time to generate response
- **Token Usage**: Input/output token counts
- **Quality Score**: Subjective quality assessment
- **Consistency**: Variance across multiple runs

## 📊 Analytics & Monitoring

### System Metrics

**Real-time Monitoring:**
- **CPU Usage**: Processor utilization percentage
- **Memory Usage**: RAM consumption and available memory
- **GPU Utilization**: GPU usage percentage and memory
- **Disk Usage**: Storage consumption and available space

**Historical Trends:**
- **Performance Charts**: Time-series data for all metrics
- **Usage Patterns**: Peak usage times and patterns
- **Resource Trends**: Long-term resource consumption

**Access Analytics:**
1. Navigate to Analytics page
2. View real-time metrics
3. Analyze historical trends
4. Export data for external analysis

### Model Performance Analytics

**Metrics Tracked:**
- **Response Time**: Average, min, max response times
- **Token Consumption**: Input/output token usage
- **Error Rates**: Failed requests and error types
- **Quality Metrics**: User ratings and feedback

**Performance Optimization:**
- **Model Selection**: Choose optimal models for tasks
- **Parameter Tuning**: Optimize temperature, max_tokens
- **Resource Allocation**: Balance performance vs. resource usage

## 🔌 API Usage

### REST API Endpoints

**Base URL**: `http://localhost:8000/api`

#### Model Management
```http
GET /models/list                    # List all models
GET /models/discover                # Discover HF models
POST /models/download               # Download model
GET /models/download/status/{id}   # Check download status
```

#### LLM Inference
```http
POST /llm/complete                  # Text completion
POST /llm/chat                     # Chat completion
```

#### Evaluation
```http
POST /eval/ocr                     # OCR evaluation
POST /eval/prompt                  # Prompt evaluation
```

#### Analytics
```http
GET /analytics/metrics             # System metrics
GET /analytics/gpu/info           # GPU information
```

### Python API Client

```python
import requests

# Base configuration
BASE_URL = "http://localhost:8000/api"
headers = {"Content-Type": "application/json"}

# Chat completion
def chat_completion(messages, model_id, **params):
    response = requests.post(
        f"{BASE_URL}/llm/chat",
        json={
            "model_id": model_id,
            "messages": messages,
            "params": params
        },
        headers=headers
    )
    return response.json()

# Model discovery
def discover_models(query="", limit=20):
    response = requests.get(
        f"{BASE_URL}/models/discover",
        params={"q": query, "limit": limit}
    )
    return response.json()
```

## 🛠️ Troubleshooting

### Common Issues

#### Backend Issues

**Port 8000 already in use:**
```bash
# Find process using port
netstat -ano | findstr :8000

# Kill process (Windows)
taskkill /PID <PID> /F

# Kill process (Linux/macOS)
kill -9 <PID>
```

**Python dependencies missing:**
```bash
# Reinstall requirements
pip install -r backend/requirements.txt

# Clear cache and reinstall
pip cache purge
pip install --no-cache-dir -r backend/requirements.txt
```

**GPU not detected:**
```bash
# Check CUDA installation
nvidia-smi

# Install CUDA toolkit
# Windows: Download from NVIDIA website
# Linux: apt install nvidia-cuda-toolkit
# macOS: Not supported
```

#### Frontend Issues

**Vite proxy errors:**
```bash
# Ensure backend is running
cd backend && python start.py

# Check backend health
curl http://localhost:8000/api/health

# Clear Vite cache
rm -rf frontend/node_modules/.vite
npm run dev
```

**Port 5173 in use:**
```bash
# Use different port
npm run dev -- --port 5174

# Or kill existing process
lsof -ti:5173 | xargs kill -9
```

#### Model Issues

**Download failures:**
1. Check internet connection
2. Verify Hugging Face token
3. Ensure sufficient disk space
4. Try vLLM download method
5. Check model compatibility

**Local model connection issues:**
1. Verify server is running
2. Check URL configuration
3. Test connection in Settings
4. Check firewall settings
5. Verify model is loaded

### Performance Issues

**Slow response times:**
1. Check system resources (CPU, memory, GPU)
2. Optimize model parameters
3. Use smaller models for testing
4. Enable GPU acceleration
5. Close unnecessary applications

**High memory usage:**
1. Monitor model memory consumption
2. Use quantized models
3. Implement model unloading
4. Increase system RAM
5. Optimize batch sizes

## ⚡ Performance Optimization

### System Optimization

**Hardware Recommendations:**
- **CPU**: Multi-core processor (8+ cores recommended)
- **RAM**: 16GB+ for large models
- **GPU**: NVIDIA RTX 3060+ with 8GB+ VRAM
- **Storage**: SSD for faster model loading

**Software Optimization:**
- Use native installation for better performance
- Enable GPU acceleration
- Optimize Python environment
- Use quantized models when possible

### Model Optimization

**Model Selection:**
- Choose appropriate model size for task
- Use quantized versions (4-bit, 8-bit)
- Consider specialized models for specific tasks
- Balance performance vs. resource usage

**Parameter Tuning:**
- **Temperature**: Lower for focused responses (0.1-0.3)
- **Max Tokens**: Limit output length for faster responses
- **Top-p**: Control response diversity
- **Top-k**: Limit vocabulary choices

### Resource Management

**GPU Memory:**
- Monitor GPU memory usage
- Use model unloading when not needed
- Implement memory-efficient loading
- Consider model sharding for large models

**CPU Optimization:**
- Use multi-threading for batch processing
- Optimize data loading pipelines
- Implement caching for frequent requests
- Use async processing where possible

## 🔧 Advanced Features

### Custom Model Integration

**Adding New Providers:**
1. Create provider service in `backend/app/services/llm/`
2. Implement base provider interface
3. Add configuration in Settings
4. Update frontend integration

**Custom Evaluation Metrics:**
1. Extend evaluation service
2. Add custom metric calculations
3. Implement result visualization
4. Add export functionality

### Automation & Scripting

**Batch Processing:**
```python
# Example: Batch model evaluation
import requests

models = ["llama2-7b", "mistral-7b", "qwen-7b"]
prompts = ["prompt1.txt", "prompt2.txt", "prompt3.txt"]

for model in models:
    for prompt in prompts:
        result = evaluate_model(model, prompt)
        save_results(model, prompt, result)
```

**API Automation:**
```bash
# Example: Automated model testing
curl -X POST "http://localhost:8000/api/eval/prompt" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "llama2-7b",
    "prompt": "Test prompt",
    "parameters": {"temperature": 0.7}
  }'
```

### Integration Examples

**Jupyter Notebook Integration:**
```python
# Connect to GenAI Studio API
import requests
import json

def genai_chat(messages, model="llama2-7b"):
    response = requests.post(
        "http://localhost:8000/api/llm/chat",
        json={
            "model_id": model,
            "messages": messages,
            "params": {"temperature": 0.7}
        }
    )
    return response.json()["output"]

# Use in notebook
result = genai_chat([
    {"role": "user", "content": "Explain quantum computing"}
])
print(result)
```

**External Tool Integration:**
```python
# Example: Integration with external tools
def process_with_genai(text, task="summarize"):
    response = requests.post(
        "http://localhost:8000/api/llm/complete",
        json={
            "model_id": "mistral-7b",
            "prompt": f"{task}: {text}",
            "params": {"max_tokens": 200}
        }
    )
    return response.json()["output"]
```

---

This technical guide provides comprehensive information for advanced users, developers, and system administrators working with GenAI Studio. For additional support, refer to the troubleshooting section or consult the project documentation.


