# GenAI Studio

A comprehensive AI development platform that combines modern web technologies with powerful AI capabilities. GenAI Studio provides an intuitive interface for working with large language models, conducting evaluations, managing models, and analyzing performance metrics.

## 🌟 Features

### **Core Capabilities**
- **Multi-Provider LLM Support**: Seamlessly work with Groq, local models (LM Studio, Ollama, vLLM), and Hugging Face models
- **Intelligent Model Management**: Discover, download, and manage models with automatic classification and provider detection
- **Advanced Chat Interface**: Multi-turn conversations with context management and parameter tuning
- **Comprehensive Evaluation Suite**: OCR evaluation, prompt testing, and performance benchmarking
- **Real-time Analytics**: System monitoring, GPU utilization, and performance metrics
- **Flexible Deployment**: Docker containers or native installation options
- **Advanced Text Display**: Intelligent text splitting with user-controlled expansion and character limits

### **Model Management**
- **Smart Model Discovery**: Browse and search Hugging Face models with intelligent categorization
- **Multi-Provider Downloads**: Automatic vLLM integration for reliable model downloads
- **Local Model Support**: LM Studio (with CLI unload), Ollama, and vLLM integration with automatic detection
- **Model Classification**: Automatic categorization (chat, coding, embedding, vision, etc.)
- **System Requirements**: GPU memory estimation and compatibility checking
- **Model Unloading**: Proper GPU memory management with provider-specific unload methods

### **Evaluation & Testing**
- **OCR Evaluation**: Test OCR models with PDF/image processing and accuracy metrics
- **Prompt Evaluation**: Systematic prompt testing with multiple models and parameters
- **Performance Benchmarking**: Response time, token usage, and quality metrics
- **Batch Processing**: Run evaluations across multiple models simultaneously

### **Analytics & Monitoring**
- **System Metrics**: Real-time CPU, memory, and GPU utilization monitoring
- **Performance Tracking**: Historical trends and usage analytics
- **Model Performance**: Response times, token consumption, and error rates
- **Resource Management**: GPU memory tracking and optimization recommendations

### **Advanced Text Display System**
- **Intelligent Text Splitting**: Automatically splits long text at word boundaries
- **User-Controlled Expansion**: Individual and bulk reveal/hide controls
- **Performance Optimization**: Collapsed sections by default for better performance
- **Configurable Limits**: User-defined character limits with disable option
- **Safety Mechanisms**: Prevents infinite loops and memory issues

## 🚀 Quick Start

### Option 1 — Docker (Recommended for Development)
```bash
# Windows
run_docker.bat

# macOS/Linux
./run_docker(macos_linux).sh
```
- **Backend**: `http://localhost:8000`
- **Frontend**: `http://localhost:5173`

### Option 2 — Conda (Recommended for Production Analytics)
```bash
# Create environment
conda create -n genai-studio python=3.11 -y
conda activate genai-studio

# Install dependencies
pip install -r backend/requirements.txt
pip install GPUtil pynvml

# Install frontend dependencies
cd frontend && npm install

# Start backend
cd backend && python start.py

# Start frontend (separate terminal)
cd frontend && npm run dev
```

## 🔧 Configuration

### Environment Setup
1. Copy `.env.example` to `.env` in both root and `backend/` directories
2. Configure API keys and settings:
   ```env
   GROQ_API_KEY=your_groq_api_key
   HUGGINGFACE_TOKEN=your_hf_token
   ```

### API Keys & Services
- **Groq**: For high-performance inference
- **Hugging Face**: For model discovery and downloads
- **Local Models**: LM Studio, Ollama, vLLM servers

## 📝 Text Display Features

### Smart Text Handling
GenAI Studio automatically handles long text content with intelligent splitting and user controls:

**Key Features:**
- **Automatic Splitting**: Long text is split into manageable sections at word boundaries
- **Individual Controls**: Each section has its own reveal/hide button
- **Bulk Controls**: "Reveal All" / "Hide All" functionality
- **Performance Optimized**: Sections are collapsed by default for better performance
- **Configurable Limits**: Set character limits from 100-10,000 characters
- **Default Expansion Options**: Choose how sections appear initially

**Configuration:**
- **Character Limit**: Set when text should split (100-10,000 characters)
- **Default Expansion**: Choose initial visibility behavior
  - **First Part Expanded**: Shows Part 1 by default, others collapsed
  - **All Parts Collapsed**: All parts hidden by default
  - **All Parts Expanded**: All parts visible by default
- **Enable/Disable**: Turn the feature on/off entirely

**Access Settings:**
1. Go to Settings → UI & Appearance
2. Configure "Text Box Character Limit" section
3. Set character limit and default expansion behavior

## 🛠️ Troubleshooting

### Windows vLLM Installation Issues
**Important:** vLLM does not natively support Windows. The installation errors you're seeing are expected.

**Correct Installation Methods for Windows:**

1. **Using Windows Subsystem for Linux (WSL) - Recommended:**
   ```bash
   # Install WSL with Ubuntu
   wsl --install -d Ubuntu
   
   # In WSL, install NVIDIA drivers and CUDA
   sudo apt update
   sudo apt install nvidia-driver-525
   
   # Install vLLM in WSL
   pip install vllm
   ```

2. **Using Community-Maintained Windows Build:**
   ```bash
   # Use the vllm-windows fork
   pip install git+https://github.com/SystemPanic/vllm-windows.git
   ```

3. **Manual Installation (Advanced Users Only):**
   - Install Visual Studio Build Tools
   - Install CUDA Toolkit 11.8+
   - Install Microsoft C++ Build Tools
   - Run: `pip install vllm --no-build-isolation`

**Alternative Solutions (No vLLM needed):**
- **Groq**: Cloud-based models (works immediately)
- **LM Studio**: Easy Windows installation
- **Ollama**: Simple setup with good model support
- **Docker**: `docker pull vllm/vllm-openai:latest`

**Note:** The app works perfectly without vLLM! You can still download and use Hugging Face models through other methods.

### Common Issues
- **Backend not starting**: Check if port 8000 is available
- **Frontend build errors**: Run `npm install` in the frontend directory
- **Model download failures**: Verify your Hugging Face token is valid
- **GPU detection issues**: Ensure CUDA drivers are properly installed
- **Text display issues**: Check character limit settings and browser console for errors

## 📁 Project Structure

```
genai-studio/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── routers/        # API endpoints
│   │   ├── services/        # Business logic
│   │   └── schemas/         # Data models
│   ├── data/               # Runtime data
│   └── requirements.txt     # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   │   └── TextDisplay/ # Advanced text display component
│   │   ├── pages/          # Main application pages
│   │   ├── services/       # API clients
│   │   ├── stores/         # State management
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/            # Utility libraries
│   └── package.json        # Node dependencies
├── User Manuals/           # Documentation
│   ├── ARCHITECTURE.md     # System architecture
│   ├── TECHNICAL_USER_GUIDE.md # Complete user guide
│   └── USER_MANUAL.md      # User-friendly guide
└── docker-compose.yml      # Container orchestration
```

## 🎯 Key Pages & Features

### **Home Dashboard**
- Quick access to all features
- Recent activity and model status
- System health overview

### **Models Management**
- **Local Models**: View and manage downloaded models
- **Model Discovery**: Browse and download from Hugging Face
- **Provider Integration**: LM Studio, Ollama, vLLM support
- **Smart Downloads**: Automatic vLLM integration for reliable downloads

### **Chat Interface**
- Multi-turn conversations
- Context management
- Parameter tuning (temperature, max tokens, etc.)
- Model switching
- Advanced text display with character limits

### **Evaluation Suite**
- **OCR Evaluation**: Test OCR models with PDFs and images
- **Prompt Evaluation**: Systematic prompt testing
- **Performance Metrics**: Response times and quality scores
- **Text Display Integration**: Long results split into manageable sections

### **Analytics Dashboard**
- Real-time system metrics
- GPU utilization monitoring
- Performance trends
- Resource usage analytics

### **Settings & Configuration**
- API key management
- Local model server configuration
- vLLM setup and installation
- Path configuration
- Preset management
- **Text Display Settings**: Character limits and expansion behavior

## 🔌 Local Model Integration

### **LM Studio**
- Automatic detection and connection
- Model loading and inference
- Parameter configuration
- **CLI-based model unloading**: Proper GPU memory management

### **Ollama**
- Local model management
- Cloud model detection
- Automatic model pulling
- **API-based model unloading**: Proper GPU memory management

### **vLLM (New!)**
- High-performance inference engine
- One-click installation (pip, conda, docker)
- Reliable Hugging Face model downloads
- OpenAI-compatible API

## 📊 Analytics & Monitoring

### **System Metrics**
- CPU and memory utilization
- GPU performance monitoring
- Historical trend analysis
- Resource optimization recommendations

### **Model Performance**
- Response time tracking
- Token usage analytics
- Error rate monitoring
- Quality metrics

## 🛠️ Troubleshooting

### Common Issues

**Frontend dev server shows "vite http proxy ECONNREFUSED" errors**
- Ensure backend is running: `cd backend && python start.py`
- Check backend health: `http://127.0.0.1:8000/api/health`
- Verify Vite proxy configuration

**Port 5173 already in use**
- Stop other processes or change port: `npm run dev -- --port 5174`

**GPU metrics show 0%**
- Install appropriate GPU drivers
- Use Conda/native installation for accurate metrics
- Check CUDA installation

**Model downloads failing**
- Configure Hugging Face token in Settings
- Use vLLM for reliable downloads (automatic installation available)
- Check internet connection and disk space

**Model unloading issues**
- **LM Studio**: Ensure LM Studio CLI is installed (automatic during setup)
- **Ollama**: Verify Ollama server is running and accessible
- **General**: Check console for specific error messages

**Text display issues**
- Check character limit settings in Settings → UI & Appearance
- Verify character limit is enabled and set to a valid value
- Check browser console for error messages
- Try reducing character limit or disabling the feature

### Performance Optimization

**For accurate analytics**: Use Conda/native installation instead of Docker
**For reliable downloads**: Install and configure vLLM via Settings
**For GPU acceleration**: Ensure CUDA drivers and libraries are installed
**For text display performance**: Use smaller character limits and "All Collapsed" setting
**For model unloading**: LM Studio CLI is automatically installed during setup

## 🔄 Development

### Backend Development
```bash
cd backend
python start.py  # Development server with auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev      # Development server with hot reload
```

### Adding New Features
- Backend: Add routers in `backend/app/routers/`
- Frontend: Add pages in `frontend/src/pages/`
- Services: Add business logic in `backend/app/services/`

## 📋 Requirements

- **Python**: 3.10+
- **Node.js**: 18+
- **GPU**: NVIDIA GPU with CUDA support (optional, for local models)
- **Memory**: 8GB+ RAM recommended
- **Storage**: 10GB+ free space for models

## 📚 Documentation

- **User Manual**: `User Manuals/USER_MANUAL.md` - User-friendly guide
- **Technical Guide**: `User Manuals/TECHNICAL_USER_GUIDE.md` - Complete technical documentation
- **Architecture Guide**: `User Manuals/ARCHITECTURE.md` - System design and implementation
- **API Documentation**: Available at `http://localhost:8000/docs`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Groq** for high-performance inference
- **Hugging Face** for model hub and community
- **LM Studio** for local model management
- **Ollama** for local AI infrastructure
- **vLLM** for optimized inference engine

---

**GenAI Studio** - Empowering AI development with modern tools, intuitive interfaces, and advanced text handling capabilities.