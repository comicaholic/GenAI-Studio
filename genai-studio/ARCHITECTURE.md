# GenAI Studio - Architecture Documentation

This document describes the architecture, design decisions, and technical implementation of GenAI Studio.

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Flow](#data-flow)
6. [Integration Patterns](#integration-patterns)
7. [Security Considerations](#security-considerations)
8. [Performance Design](#performance-design)
9. [Scalability Considerations](#scalability-considerations)
10. [Technology Stack](#technology-stack)

## 🏗️ System Overview

GenAI Studio follows a modern microservices-inspired architecture with a clear separation between frontend and backend components. The system is designed for flexibility, maintainability, and extensibility.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GenAI Studio System                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Pages Layer   │  │ Components Layer │  │ Services Layer│ │
│  │                 │  │                 │  │              │ │
│  │ • Home          │  │ • AppShell      │  │ • API Client │ │
│  │ • Models        │  │ • LeftRail      │  │ • State Mgmt │ │
│  │ • Chat          │  │ • TopBar        │  │ • Notifications│ │
│  │ • Analytics     │  │ • Modals        │  │              │ │
│  │ • Settings      │  │ • Forms         │  │              │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Backend (FastAPI + Python)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   API Layer     │  │ Services Layer   │  │ Data Layer   │ │
│  │                 │  │                 │  │              │ │
│  │ • Routers       │  │ • LLM Services  │  │ • Models     │ │
│  │ • Middleware    │  │ • Analytics     │  │ • Config     │ │
│  │ • Schemas       │  │ • Evaluation    │  │ • Cache      │ │
│  │ • Validation    │  │ • Model Mgmt    │  │ • Storage    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  External Services & Integrations                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   AI Providers  │  │ Model Sources   │  │ Local Servers│ │
│  │                 │  │                 │  │              │ │
│  │ • Groq API      │  │ • Hugging Face  │  │ • LM Studio  │ │
│  │ • OpenAI API    │  │ • Model Hub     │  │ • Ollama     │ │
│  │ • Custom APIs   │  │ • Local Models  │  │ • vLLM       │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Architecture Principles

### 1. Separation of Concerns
- **Frontend**: User interface, state management, API communication
- **Backend**: Business logic, data processing, external integrations
- **Services**: Modular, reusable business logic components

### 2. Modularity
- **Component-based frontend**: Reusable UI components
- **Service-oriented backend**: Independent, testable services
- **Plugin architecture**: Extensible provider system

### 3. API-First Design
- **RESTful APIs**: Standard HTTP methods and status codes
- **OpenAPI documentation**: Auto-generated API documentation
- **Type safety**: TypeScript interfaces and Python schemas

### 4. Configuration-Driven
- **Environment-based config**: Different settings for dev/prod
- **Dynamic configuration**: Runtime configuration updates
- **Provider abstraction**: Easy addition of new AI providers

### 5. Performance-First
- **Async processing**: Non-blocking operations
- **Caching strategies**: Response and data caching
- **Resource optimization**: Efficient memory and GPU usage

## 🎨 Frontend Architecture

### Technology Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Styling**: Inline styles with CSS-in-JS approach
- **State Management**: React hooks and context
- **Routing**: React Router for SPA navigation
- **HTTP Client**: Axios for API communication

### Component Architecture

```
src/
├── components/           # Reusable UI components
│   ├── AppShell.tsx     # Main application layout
│   ├── LeftRail.tsx     # Navigation sidebar
│   ├── TopBar.tsx       # Header with model selector
│   ├── ui/              # Basic UI components
│   └── modals/          # Modal dialogs
├── pages/               # Main application pages
│   ├── Home/            # Dashboard
│   ├── Models/          # Model management
│   ├── Chat/            # Chat interface
│   ├── Analytics/       # System metrics
│   └── Settings/        # Configuration
├── services/            # API clients and utilities
│   ├── api.ts          # Main API client
│   ├── llm.ts          # LLM service client
│   └── models.ts       # Model management client
├── stores/             # State management
│   ├── pageState.ts    # Page-level state
│   ├── presetStore.ts  # Preset management
│   └── automationStore.ts # Automation state
└── types/             # TypeScript type definitions
```

### Design Patterns

#### 1. Component Composition
```typescript
// AppShell provides layout structure
<AppShell left={<LeftRail />} right={<RightPanel />}>
  <PageContent />
</AppShell>
```

#### 2. Custom Hooks
```typescript
// Reusable state logic
const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const showSuccess = (title, message) => { /* ... */ };
  const showError = (title, message) => { /* ... */ };
  return { showSuccess, showError, notifications };
};
```

#### 3. Service Layer Pattern
```typescript
// Centralized API communication
class APIService {
  async getModels() {
    return this.client.get('/models/list');
  }
  
  async downloadModel(modelId: string) {
    return this.client.post('/models/download', { model_id: modelId });
  }
}
```

### State Management Strategy

#### 1. Local State (useState)
- Component-specific state
- Form inputs and UI state
- Temporary data

#### 2. Context State (useContext)
- Global application state
- User preferences
- Theme and settings

#### 3. External State (Zustand)
- Complex state logic
- Persistence requirements
- Cross-component communication

## 🔧 Backend Architecture

### Technology Stack
- **Framework**: FastAPI for high-performance APIs
- **Language**: Python 3.11+ with type hints
- **Database**: JSON file-based storage (extensible to SQL)
- **Authentication**: Token-based (extensible to OAuth)
- **Documentation**: Auto-generated OpenAPI/Swagger
- **Testing**: Pytest for unit and integration tests

### Service Architecture

```
backend/app/
├── routers/            # API endpoint definitions
│   ├── models.py      # Model management endpoints
│   ├── llm.py         # LLM inference endpoints
│   ├── analytics.py   # Metrics and monitoring
│   ├── settings.py    # Configuration management
│   └── eval.py        # Evaluation endpoints
├── services/          # Business logic layer
│   ├── llm/           # LLM provider implementations
│   │   ├── base.py    # Abstract base class
│   │   ├── groq_provider.py
│   │   └── local_llama_cpp.py
│   ├── analytics/     # Metrics collection
│   ├── eval/          # Evaluation logic
│   └── ocr/           # OCR processing
├── schemas/           # Data models and validation
└── utils/             # Utility functions
```

### Design Patterns

#### 1. Provider Pattern
```python
# Abstract base for LLM providers
class BaseLLMProvider(ABC):
    @abstractmethod
    async def complete(self, prompt: str, **kwargs) -> str:
        pass
    
    @abstractmethod
    async def chat(self, messages: List[dict], **kwargs) -> str:
        pass

# Concrete implementations
class GroqProvider(BaseLLMProvider):
    async def complete(self, prompt: str, **kwargs) -> str:
        # Groq-specific implementation
        pass
```

#### 2. Service Layer Pattern
```python
# Business logic separation
class ModelService:
    def __init__(self):
        self.downloader = ModelDownloader()
        self.classifier = ModelClassifier()
    
    async def download_model(self, model_id: str) -> str:
        # Orchestrate download process
        download_id = self.downloader.start_download(model_id)
        return download_id
```

#### 3. Repository Pattern
```python
# Data access abstraction
class ModelRepository:
    def __init__(self, storage_path: str):
        self.storage_path = Path(storage_path)
    
    def save_model(self, model: ModelInfo) -> None:
        # Save model metadata
        pass
    
    def get_model(self, model_id: str) -> ModelInfo:
        # Retrieve model metadata
        pass
```

### API Design Principles

#### 1. RESTful Endpoints
```python
# Resource-based URLs
GET    /api/models              # List models
POST   /api/models/download     # Download model
GET    /api/models/{id}         # Get model details
DELETE /api/models/{id}         # Remove model
```

#### 2. Consistent Response Format
```python
# Standard response structure
{
    "success": True,
    "data": {...},
    "message": "Operation completed",
    "timestamp": "2024-01-01T00:00:00Z"
}
```

#### 3. Error Handling
```python
# Structured error responses
{
    "success": False,
    "error": {
        "code": "MODEL_NOT_FOUND",
        "message": "Model with ID 'xyz' not found",
        "details": {...}
    }
}
```

## 🔄 Data Flow

### Request Flow

```
1. User Action (Frontend)
   ↓
2. API Call (Axios)
   ↓
3. Router (FastAPI)
   ↓
4. Service Layer (Business Logic)
   ↓
5. External API/Service
   ↓
6. Response Processing
   ↓
7. Frontend Update
```

### State Synchronization

#### 1. Real-time Updates
```typescript
// WebSocket-like updates via polling
const pollDownloadStatus = async (downloadId: string) => {
  const status = await api.get(`/download/status/${downloadId}`);
  setDownloadProgress(status);
  
  if (status.status === 'completed') {
    window.dispatchEvent(new Event('models:changed'));
  }
};
```

#### 2. Event-driven Updates
```typescript
// Cross-component communication
window.addEventListener('models:changed', () => {
  // Refresh model list
  loadModels();
});
```

## 🔌 Integration Patterns

### External Service Integration

#### 1. Provider Abstraction
```python
# Unified interface for different providers
class LLMProviderFactory:
    @staticmethod
    def create_provider(provider_type: str) -> BaseLLMProvider:
        if provider_type == "groq":
            return GroqProvider()
        elif provider_type == "local":
            return LocalProvider()
        # Extensible for new providers
```

#### 2. Adapter Pattern
```python
# Adapt external APIs to internal interface
class HuggingFaceAdapter:
    def __init__(self, token: str):
        self.client = HfApi(token=token)
    
    def search_models(self, query: str) -> List[ModelInfo]:
        # Convert HF API response to internal format
        pass
```

#### 3. Circuit Breaker Pattern
```python
# Resilient external service calls
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5):
        self.failure_threshold = failure_threshold
        self.failure_count = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    async def call(self, func, *args, **kwargs):
        if self.state == "OPEN":
            raise ServiceUnavailableError()
        # Implementation...
```

### Local Model Integration

#### 1. Service Discovery
```python
# Automatic detection of local services
class LocalServiceDiscovery:
    def discover_ollama(self) -> Optional[str]:
        try:
            response = requests.get("http://localhost:11434/api/tags")
            return "http://localhost:11434" if response.ok else None
        except:
            return None
```

#### 2. Health Checking
```python
# Continuous health monitoring
class HealthChecker:
    async def check_service_health(self, service_url: str) -> bool:
        try:
            response = await httpx.get(f"{service_url}/health", timeout=5)
            return response.status_code == 200
        except:
            return False
```

## 🔒 Security Considerations

### API Security

#### 1. Input Validation
```python
# Pydantic models for request validation
class ChatRequest(BaseModel):
    model_id: str = Field(..., min_length=1, max_length=100)
    messages: List[ChatMessage] = Field(..., min_items=1)
    params: Dict[str, Any] = Field(default_factory=dict)
```

#### 2. Rate Limiting
```python
# Request rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/llm/chat")
@limiter.limit("10/minute")
async def chat_endpoint(request: Request, body: ChatRequest):
    # Implementation...
```

#### 3. API Key Management
```python
# Secure API key storage
class APIKeyManager:
    def __init__(self):
        self.keys = {}
    
    def store_key(self, provider: str, key: str) -> None:
        # Encrypt and store key
        encrypted_key = self.encrypt(key)
        self.keys[provider] = encrypted_key
```

### Data Security

#### 1. Sensitive Data Handling
```python
# Environment-based configuration
import os
from dotenv import load_dotenv

load_dotenv()

API_KEYS = {
    "groq": os.getenv("GROQ_API_KEY"),
    "huggingface": os.getenv("HUGGINGFACE_TOKEN")
}
```

#### 2. Data Sanitization
```python
# Input sanitization
def sanitize_input(text: str) -> str:
    # Remove potentially harmful content
    return html.escape(text.strip())
```

## ⚡ Performance Design

### Caching Strategy

#### 1. Response Caching
```python
# Redis-based caching (future implementation)
from redis import Redis

class CacheManager:
    def __init__(self):
        self.redis = Redis(host='localhost', port=6379, db=0)
    
    def cache_response(self, key: str, data: dict, ttl: int = 300):
        self.redis.setex(key, ttl, json.dumps(data))
```

#### 2. Model Caching
```python
# In-memory model caching
class ModelCache:
    def __init__(self, max_size: int = 10):
        self.cache = {}
        self.max_size = max_size
    
    def get_model(self, model_id: str) -> Optional[Model]:
        return self.cache.get(model_id)
    
    def cache_model(self, model_id: str, model: Model):
        if len(self.cache) >= self.max_size:
            # LRU eviction
            oldest_key = min(self.cache.keys())
            del self.cache[oldest_key]
        self.cache[model_id] = model
```

### Async Processing

#### 1. Background Tasks
```python
# FastAPI background tasks
@router.post("/models/download")
async def download_model(
    request: DownloadRequest,
    background_tasks: BackgroundTasks
):
    download_id = str(uuid.uuid4())
    background_tasks.add_task(process_download, download_id, request.model_id)
    return {"download_id": download_id}
```

#### 2. Queue System
```python
# Download queue management
class DownloadQueue:
    def __init__(self):
        self.queue = []
        self.processing = set()
    
    async def process_downloads(self):
        while True:
            if self.queue and len(self.processing) < 3:
                download_id = self.queue.pop(0)
                self.processing.add(download_id)
                asyncio.create_task(self.download_worker(download_id))
            await asyncio.sleep(1)
```

### Resource Optimization

#### 1. Memory Management
```python
# Model memory tracking
class ModelMemoryTracker:
    def __init__(self):
        self.loaded_models = {}
    
    def track_model_loading(self, model_id: str, memory_usage: int):
        self.loaded_models[model_id] = {
            "memory_usage": memory_usage,
            "loaded_at": datetime.now()
        }
    
    def unload_unused_models(self):
        # Unload models not used recently
        pass
```

#### 2. GPU Utilization
```python
# GPU resource management
class GPUManager:
    def __init__(self):
        self.gpu_info = self.get_gpu_info()
    
    def allocate_gpu(self, model_size: int) -> Optional[int]:
        # Find available GPU with sufficient memory
        for gpu_id, gpu in enumerate(self.gpu_info):
            if gpu.available_memory >= model_size:
                return gpu_id
        return None
```

## 📈 Scalability Considerations

### Horizontal Scaling

#### 1. Stateless Design
- No server-side session storage
- All state in client or external storage
- Easy horizontal scaling

#### 2. Load Balancing
```python
# Future load balancer configuration
upstream genai_backend {
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}
```

### Database Scaling

#### 1. Current: File-based Storage
- JSON files for simple data
- Suitable for single-instance deployment
- Easy to backup and migrate

#### 2. Future: Database Migration
```python
# SQLAlchemy models for future database
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Model(Base):
    __tablename__ = "models"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    metadata = Column(JSON)
    created_at = Column(DateTime)
```

### Microservices Architecture

#### 1. Service Decomposition
```
Current Monolith → Future Microservices
├── Model Service      # Model management
├── Inference Service  # LLM inference
├── Analytics Service  # Metrics and monitoring
├── Evaluation Service # Testing and evaluation
└── Gateway Service    # API gateway
```

#### 2. Service Communication
```python
# Future gRPC service communication
import grpc
from proto import model_service_pb2_grpc

class ModelServiceClient:
    def __init__(self, service_url: str):
        self.channel = grpc.insecure_channel(service_url)
        self.stub = model_service_pb2_grpc.ModelServiceStub(self.channel)
    
    async def get_model(self, model_id: str):
        request = model_service_pb2.GetModelRequest(id=model_id)
        return await self.stub.GetModel(request)
```

## 🛠️ Technology Stack

### Frontend Stack
- **React 18**: Modern React with concurrent features
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Axios**: HTTP client for API communication
- **React Router**: Client-side routing
- **Zustand**: Lightweight state management

### Backend Stack
- **FastAPI**: Modern Python web framework
- **Python 3.11+**: Latest Python features
- **Pydantic**: Data validation and serialization
- **Uvicorn**: ASGI server for production
- **Pytest**: Testing framework
- **Python-dotenv**: Environment variable management

### External Integrations
- **Groq API**: High-performance inference
- **Hugging Face Hub**: Model repository
- **LM Studio**: Local model management
- **Ollama**: Local AI infrastructure
- **vLLM**: Optimized inference engine

### Development Tools
- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **Git**: Version control
- **ESLint/Prettier**: Code formatting and linting
- **Black**: Python code formatting

### Monitoring & Analytics
- **GPUtil**: GPU monitoring
- **psutil**: System metrics
- **Custom metrics**: Application-specific monitoring
- **Real-time dashboards**: Performance visualization

---

This architecture documentation provides a comprehensive overview of GenAI Studio's design decisions, implementation patterns, and future scalability considerations. The system is designed to be maintainable, extensible, and performant while providing a solid foundation for future enhancements.


