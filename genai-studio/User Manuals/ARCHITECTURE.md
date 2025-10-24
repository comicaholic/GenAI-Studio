# GenAI Studio - Architecture Documentation

This document describes the architecture, design decisions, and technical implementation of GenAI Studio - a comprehensive AI evaluation and chat workspace platform.

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
11. [Current Implementation Status](#current-implementation-status)

## 🏗️ System Overview

GenAI Studio follows a modern microservices-inspired architecture with a clear separation between frontend and backend components. The system is designed for flexibility, maintainability, and extensibility.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GenAI Studio System                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript + Vite)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Pages Layer   │  │ Components Layer│  │Services Layer│ │
│  │                 │  │                 │  │              │ │
│  │ • Home          │  │ • AppShell      │  │ • API Client │ │
│  │ • Models        │  │ • LeftRail      │  │ • State Mgmt │ │
│  │ • Chat          │  │ • TopBar        │  │ • Notifications│ │
│  │ • Analytics     │  │ • Modals        │  │ • File Mgmt  │ │
│  │ • Settings      │  │ • Forms         │  │ • LLM Client │ │
│  │ • OCR           │  │ • UI Components │  │ • History    │ │
│  │ • PromptEval    │  │ • TextDisplay   │  │ • Evaluation │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Backend (FastAPI + Python)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   API Layer     │  │ Services Layer  │  │ Data Layer   │ │
│  │                 │  │                 │  │              │ │
│  │ • Routers       │  │ • LLM Services  │  │ • JSON Files │ │
│  │ • Middleware    │  │ • Analytics     │  │ • Config     │ │
│  │ • Schemas       │  │ • Evaluation    │  │ • Models     │ │
│  │ • Validation    │  │ • Model Mgmt    │  │ • Downloads  │ │
│  │ • File Upload   │  │ • OCR Services  │  │ • History    │ │
│  │ • Health Check  │  │ • GPU Detection │  │ • Presets    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  External Services & Integrations                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   AI Providers  │  │ Model Sources   │  │ Local Servers│ │
│  │                 │  │                 │  │              │ │
│  │ • Groq API      │  │ • Hugging Face  │  │ • LM Studio  │ │
│  │ • OpenAI API    │  │ • Model Hub     │  │ • Ollama     │ │
│  │ • Custom APIs   │  │ • Local Models  │  │ • vLLM       │ │
│  │ • Error Mitigation│ │ • Model Discovery│ │ • GPU Support│ │
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
- **Styling**: Tailwind CSS v4 with custom components
- **State Management**: React hooks, Context API, and Zustand stores
- **Routing**: React Router for SPA navigation
- **HTTP Client**: Custom fetch-based API client with retry logic
- **UI Components**: Custom component library with consistent design system

### Component Architecture

```
src/
├── components/           # Reusable UI components
│   ├── AppShell.tsx     # Main application layout
│   ├── LeftRail.tsx     # Navigation sidebar
│   ├── TopBar/          # Header with model selector
│   ├── AutomationModal/ # Automation configuration modals
│   ├── AutomationProgress/ # Progress tracking components
│   ├── DownloadManager/ # Model download management
│   ├── FileDrop/        # File upload components
│   ├── HistoryModal/    # History viewing modals
│   ├── Layout/          # Layout components
│   ├── ModelLoader/     # Model loading components
│   ├── Notification/     # Notification system
│   ├── PresetEditor/    # Preset editing components
│   ├── PresetPanel/     # Preset management panels
│   ├── RightPanel/      # Parameter and metrics panels
│   ├── TextDisplay/     # Advanced text display with character limits
│   └── ui/              # Basic UI components
├── pages/               # Main application pages
│   ├── Home/            # Dashboard with history
│   ├── Models/          # Model management and discovery
│   ├── Chat/            # Chat interface
│   ├── Analytics/       # System metrics and monitoring
│   ├── Settings/        # Configuration management
│   ├── OCR/             # OCR evaluation interface
│   └── PromptEval/      # Prompt evaluation interface
├── services/            # API clients and utilities
│   ├── api.ts          # Main API client with retry logic
│   ├── llm.ts          # LLM service client with error mitigation
│   ├── history.ts      # History management client
│   ├── files.ts        # File management client
│   ├── eval.ts         # Evaluation metrics client
│   └── ocr.ts          # OCR processing client
├── stores/             # State management
│   ├── automationStore.ts # Automation progress tracking
│   ├── backgroundState.ts # Background operations state
│   ├── pageState.ts    # Page-level state
│   ├── presetStore.ts  # Preset management
│   ├── promptEvalStore.ts # Prompt evaluation state
│   └── resourceStore.ts # Resource management
├── context/            # React context providers
│   └── ModelContext.tsx # Global model selection context
├── hooks/              # Custom React hooks
│   ├── useSelectedModelId.ts # Model selection hook
│   └── useSettings.ts  # Settings management hook
├── lib/                # Utility libraries
│   ├── files.ts        # File handling utilities
│   ├── groqErrorMitigation.ts # Error handling
│   ├── llm.ts          # LLM utilities
│   ├── modelUtils.ts   # Model data utilities
│   ├── pathUtils.ts    # Path handling utilities
│   └── textUtils.ts    # Text processing and character limit utilities
└── types/              # TypeScript type definitions
    ├── history.ts      # History data types
    └── promptEval.ts   # Evaluation types
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
// Centralized API communication with retry logic
export const api = {
  get: <T = any>(path: string, cfg?: ApiConfig) =>
    request<T>('GET', path, cfg),
  post: <T = any>(path: string, body?: Json, cfg?: ApiConfig) =>
    request<T>('POST', path, { ...cfg, body }),
  put: <T = any>(path: string, body?: Json, cfg?: ApiConfig) =>
    request<T>('PUT', path, { ...cfg, body }),
  delete: <T = any>(path: string, cfg?: ApiConfig) =>
    request<T>('DELETE', path, cfg),
};

// LLM service with error mitigation
export async function chatComplete(
  model_id: string,
  messages: ChatMessage[],
  params: ModelParams,
  retryCount: number = 0
): Promise<string> {
  // Automatic error mitigation and retry logic
  const mitigation = getAutomaticMitigation(errorMessage, prompt);
  if (mitigation.shouldRetry && retryCount < 2) {
    return chatComplete(model_id, modifiedMessages, modifiedParams, retryCount + 1);
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
- Complex state logic with persistence
- Cross-component communication
- Background operations tracking
- Automation progress management

```typescript
// Automation store for tracking progress
class AutomationStore {
  private progress: AutomationProgress[] = [];
  private listeners: Set<() => void> = new Set();

  startAutomation(type: 'ocr' | 'prompt' | 'chat', config: AutomationConfig): string {
    const progress: AutomationProgress = {
      id: config.id,
      type,
      config,
      currentRunIndex: 0,
      status: 'running',
      startTime: Date.now(),
    };
    this.progress.push(progress);
    this.notify();
    return config.id;
  }
}

// Background state with persistence
export const useBackgroundState = create<BackgroundState>()(
  persist(
    (set, get) => ({
      operations: [],
      isEnabled: true,
      addOperation: (operation) => { /* ... */ },
      updateOperation: (id, updates) => { /* ... */ },
    }),
    { name: 'background-state' }
  )
);
```

### Advanced Text Display System

The TextDisplay component represents a sophisticated approach to handling large text content with intelligent splitting and user-controlled expansion:

```typescript
// TextDisplay component with character limit management
interface TextDisplayProps {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Character limit configuration
interface TextBoxSettings {
  characterLimit: number;
  characterLimitEnabled: boolean;
  defaultExpansion: "all-collapsed" | "all-expanded" | "first-expanded";
}

// Text splitting algorithm with safety checks
export function splitTextByCharacterLimit(
  text: string, 
  characterLimit: number | null
): string[] {
  // Safety checks and iteration limits
  // Word boundary detection
  // Progress guarantees
  // Fallback handling
}
```

**Key Features:**
- **Intelligent Text Splitting**: Breaks long text at word boundaries
- **User-Controlled Expansion**: Individual and bulk reveal/hide controls
- **Performance Optimization**: Collapsed sections by default
- **Safety Mechanisms**: Prevents infinite loops and memory issues
- **Configurable Limits**: User-defined character limits with disable option

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
│   ├── models.py      # Model management and discovery
│   ├── llm.py         # LLM inference endpoints
│   ├── analytics.py   # Metrics and monitoring
│   ├── settings.py    # Configuration management
│   ├── eval.py        # Evaluation endpoints
│   ├── history.py     # History management
│   ├── presets.py     # Preset management
│   ├── files.py       # File upload/download
│   ├── ocr.py         # OCR processing
│   ├── chat.py        # Chat endpoints
│   ├── custom.py      # Custom endpoints
│   └── health.py      # Health checks
├── services/          # Business logic layer
│   ├── llm/           # LLM provider implementations
│   │   ├── base.py    # Abstract base class
│   │   ├── groq_provider.py
│   │   ├── local_llama_cpp.py
│   │   └── providers.py
│   ├── analytics/     # Metrics collection
│   ├── eval/          # Evaluation logic and metrics
│   ├── ocr/           # OCR processing services
│   ├── reports/       # Report generation (PDF, CSV)
│   ├── presets/       # Preset management
│   ├── custom/        # Custom service implementations
│   ├── config.py      # Configuration management
│   ├── download_queue.py # Download management
│   ├── gpu_detection.py # GPU detection and management
│   ├── model_classifier.py # Model classification
│   ├── model_downloader.py # Model downloading
│   ├── model_memory_tracker.py # Memory tracking
│   ├── models_visibility.py # Model visibility management
│   ├── models.py      # Model registry and management
│   ├── paths.py       # Path management
│   ├── vllm_setup.py  # vLLM setup and management
│   └── metrics.py     # Metrics computation
├── schemas/           # Data models and validation
└── utils/             # Utility functions
    └── files.py       # File utilities
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
# Model Management
GET    /api/models/list         # List available models
GET    /api/models/classified   # Get classified models
GET    /api/models/search       # Search models
POST   /api/models/download     # Download model
GET    /api/models/download/status/{id} # Get download status
POST   /api/models/download/cancel/{id} # Cancel download
GET    /api/models/local        # Get local models
POST   /api/models/local        # Add local model
DELETE /api/models/local        # Remove local model

# LLM Inference
POST   /api/llm/complete        # Text completion
POST   /api/llm/chat           # Chat completion
GET    /api/llm/models         # List LLM models

# Analytics and Monitoring
GET    /api/analytics/system   # System metrics
GET    /api/analytics/performance # Performance trends
GET    /api/analytics/groq     # Groq usage analytics
GET    /api/analytics/errors   # Error metrics
GET    /api/analytics/latency  # Latency metrics
GET    /api/analytics/throughput # Throughput metrics

# History Management
GET    /api/history/evals      # Get evaluations
POST   /api/history/evals      # Save evaluation
GET    /api/history/chats      # Get chats
POST   /api/history/chats      # Save chat
GET    /api/history/automations # Get automations
POST   /api/history/automations # Save automation

# File Management
GET    /api/files/list         # List files
GET    /api/files/load         # Load file content
POST   /api/files/upload       # Upload file

# OCR Processing
POST   /api/ocr/extract        # Extract text from image
POST   /api/ocr/reference      # Process reference file

# Settings and Configuration
GET    /api/settings/settings  # Get settings
POST   /api/settings/settings # Save settings
GET    /api/settings/paths     # Get paths
POST   /api/settings/paths     # Set paths
POST   /api/settings/groq/test # Test Groq connection
POST   /api/settings/huggingface/test # Test HF connection
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
2. API Call (Custom fetch client with retry)
   ↓
3. Router (FastAPI)
   ↓
4. Service Layer (Business Logic)
   ↓
5. External API/Service (Groq, HF, Local)
   ↓
6. Response Processing & Analytics
   ↓
7. Frontend Update with Error Mitigation
```

### State Synchronization

#### 1. Real-time Updates
```typescript
// Download progress polling
const pollDownloadStatus = async (downloadId: string) => {
  const status = await api.get(`/models/download/status/${downloadId}`);
  setDownloadProgress(status);
  
  if (status.status === 'completed') {
    window.dispatchEvent(new Event('models:changed'));
  }
};

// Background operations tracking
const automationStore = new AutomationStore();
automationStore.subscribe(() => {
  // Update UI when automation progress changes
  updateAutomationProgress(automationStore.getProgress());
});
```

#### 2. Event-driven Updates
```typescript
// Cross-component communication
window.addEventListener('models:changed', () => {
  // Refresh model list across all components
  loadModels();
});

// Error mitigation events
window.addEventListener('groq-mitigation', (event) => {
  const { error, mitigation, retryCount } = event.detail;
  showNotification(`Retrying request (${retryCount}/2): ${mitigation.suggestedAction}`);
});
```

## 🔌 Integration Patterns

### External Service Integration

#### 1. Provider Abstraction
```python
# Unified interface for different providers
class LLMProvider(ABC):
    @abstractmethod
    def list_models(self) -> Iterable[Dict]: 
        pass
    
    @abstractmethod
    def complete(self, prompt: str, params: Dict, files: List = None) -> str:
        pass

# Groq provider implementation
class GroqProvider(LLMProvider):
    def __init__(self):
        self.key = os.getenv("GROQ_API_KEY")
        self.session = requests.Session()

    def list_models(self):
        r = self.session.get("https://api.groq.com/openai/v1/models",
                           headers={"Authorization": f"Bearer {self.key}"})
        return r.json().get("data", [])

# Provider factory
def create_provider(provider_type: str) -> LLMProvider:
    if provider_type == "groq":
        return GroqProvider()
    elif provider_type == "local":
        return LocalProvider()
    # Extensible for new providers
```

#### 2. Adapter Pattern
```python
# Hugging Face model discovery adapter
class HuggingFaceAdapter:
    def __init__(self, token: str):
        self.client = HfApi(token=token)
    
    def search_models(self, query: str) -> List[ModelInfo]:
        models = self.client.list_models(search=query, limit=20)
        return [self._convert_to_internal_format(model) for model in models]
    
    def _convert_to_internal_format(self, hf_model) -> ModelInfo:
        return ModelInfo(
            id=hf_model.id,
            name=hf_model.id.split('/')[-1],
            publisher=hf_model.id.split('/')[0],
            downloads=hf_model.downloads,
            tags=hf_model.tags
        )

# Model downloader with progress tracking
class ModelDownloader:
    def download_model(self, model_id: str, progress_callback: Callable = None) -> Dict:
        def monitor_progress():
            while download_in_progress:
                progress = get_download_progress(model_id)
                if progress_callback:
                    progress_callback(progress)
                time.sleep(1)
        
        # Start download and monitoring
        download_id = self._start_download(model_id)
        threading.Thread(target=monitor_progress).start()
        return {"download_id": download_id}
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
            response = requests.get("http://localhost:11434/api/tags", timeout=5)
            return "http://localhost:11434" if response.ok else None
        except:
            return None
    
    def discover_lmstudio(self) -> Optional[str]:
        try:
            response = requests.get("http://localhost:1234/v1/models", timeout=5)
            return "http://localhost:1234" if response.ok else None
        except:
            return None
    
    def discover_vllm(self) -> Optional[str]:
        try:
            response = requests.get("http://localhost:8000/v1/models", timeout=5)
            return "http://localhost:8000" if response.ok else None
        except:
            return None
```

#### 2. GPU Detection and Management
```python
# Multi-platform GPU detection
def detect_available_gpus() -> List[str]:
    gpus = ["auto"]  # Always include auto-detect
    
    # NVIDIA GPUs
    try:
        result = subprocess.run(['nvidia-smi', '--list-gpus'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            for i, line in enumerate(result.stdout.strip().split('\n')):
                if 'GPU' in line:
                    gpus.append(f"cuda:{i}")
            gpus.append("cpu")
            return gpus
    except:
        pass
    
    # Apple Silicon (MPS)
    if platform.system() == "Darwin" and platform.machine() == "arm64":
        try:
            import torch
            if torch.backends.mps.is_available():
                gpus.append("mps")
        except ImportError:
            pass
    
    # AMD GPUs (ROCm)
    try:
        result = subprocess.run(['rocm-smi', '--showid'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            for i, line in enumerate(result.stdout.strip().split('\n')):
                if 'GPU' in line or 'Card' in line:
                    gpus.append(f"rocm:{i}")
            gpus.append("cpu")
            return gpus
    except:
        pass
    
    return gpus
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
- **Groq API**: High-performance inference with error mitigation
- **Hugging Face Hub**: Model repository and discovery
- **LM Studio**: Local model management and inference with CLI-based model unloading
- **Ollama**: Local AI infrastructure with proper API-based model unloading
- **vLLM**: Optimized inference engine with GPU support
- **OpenAI API**: GPT models (planned)
- **Custom APIs**: Extensible provider system

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

## 📊 Current Implementation Status

### ✅ Completed Features

#### Frontend
- **Core Pages**: Home, Models, Chat, Analytics, Settings, OCR, PromptEval
- **Component Library**: Comprehensive UI components with Tailwind CSS v4
- **State Management**: React Context, Zustand stores for complex state
- **API Client**: Custom fetch-based client with retry logic and error handling
- **Model Management**: Model discovery, download tracking, local model support
- **Automation System**: OCR, Prompt, and Chat automation with progress tracking
- **File Management**: Upload, download, and file type detection
- **History System**: Evaluation, chat, and automation history
- **Preset System**: Configurable presets for different use cases
- **Error Mitigation**: Automatic Groq error handling and retry logic
- **Background Operations**: Persistent background task management
- **Advanced Text Display**: Character limit management with intelligent splitting

#### Backend
- **API Endpoints**: Complete REST API with 50+ endpoints
- **LLM Integration**: Groq API with local model support (LM Studio, Ollama, vLLM)
- **Model Management**: Download queue, progress tracking, model classification
- **Analytics**: System metrics, performance monitoring, usage tracking
- **OCR Processing**: Text extraction from images using Tesseract
- **Evaluation Metrics**: ROUGE, BLEU, BERTScore, exact match, accuracy
- **File Handling**: Upload/download with type validation
- **Configuration**: Dynamic settings management with environment variables
- **GPU Detection**: Multi-platform GPU support (NVIDIA, AMD, Apple Silicon)
- **Memory Tracking**: Model memory usage monitoring
- **Report Generation**: PDF and CSV export functionality

#### Integrations
- **Groq API**: Full integration with error mitigation
- **Hugging Face**: Model discovery and download
- **Local Services**: LM Studio (with CLI unload support), Ollama, vLLM support
- **GPU Support**: CUDA, ROCm, MPS detection and management
- **Model Unloading**: Proper GPU memory management with provider-specific unload methods

### 🚧 In Progress Features

#### Planned Enhancements
- **OpenAI Integration**: GPT model support
- **Advanced Analytics**: More detailed performance metrics
- **Model Fine-tuning**: Local model training capabilities
- **Multi-user Support**: User authentication and authorization
- **API Rate Limiting**: Request throttling and quota management
- **Database Migration**: SQL database support for scalability

### 🎯 Architecture Strengths

1. **Modular Design**: Clear separation of concerns with well-defined interfaces
2. **Error Resilience**: Comprehensive error handling and automatic mitigation
3. **Performance**: Optimized for speed with caching and background processing
4. **Extensibility**: Plugin architecture for easy addition of new providers
5. **User Experience**: Intuitive interface with real-time feedback
6. **Monitoring**: Comprehensive analytics and system health monitoring
7. **Cross-platform**: Support for Windows, macOS, and Linux
8. **Local-first**: Strong support for local model inference
9. **Advanced Text Handling**: Intelligent text splitting with user control

### 🔧 Technical Debt & Improvements

1. **Database Layer**: Currently using JSON files, planning SQL migration
2. **Authentication**: Basic token-based auth, planning OAuth integration
3. **Testing**: Need comprehensive test coverage
4. **Documentation**: API documentation could be more comprehensive
5. **Performance**: Some areas could benefit from optimization
6. **Security**: Additional security hardening needed for production

This architecture documentation provides a comprehensive overview of GenAI Studio's current implementation, design decisions, and future scalability considerations. The system is designed to be maintainable, extensible, and performant while providing a solid foundation for continued development.