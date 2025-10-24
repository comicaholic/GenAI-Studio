# GenAI Studio - User Manual

A user-friendly guide to getting started with GenAI Studio and using its core features.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Text Display Features](#text-display-features)
4. [Model Management](#model-management)
5. [Evaluation Tools](#evaluation-tools)
6. [Settings & Configuration](#settings--configuration)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### Quick Setup (5 Minutes)

**Option 1: Docker (Easiest)**
1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Download GenAI Studio
3. Run: `run_docker.bat` (Windows) or `./run_docker(macos_linux).sh` (Mac/Linux)
4. Open your browser to `http://localhost:5173`

**Option 2: Native Installation**
1. Install Python 3.11+ and Node.js 18+
2. Run: `run_conda.bat` (Windows) or follow conda setup
3. Access at `http://localhost:5173`

### First Steps
1. **Get API Keys**: 
   - Groq API (free): [console.groq.com](https://console.groq.com/)
   - Hugging Face token: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. **Configure Settings**: Go to Settings → API Configuration
3. **Test Your Setup**: Try a chat in the Chat page

---

## 🎯 Basic Usage

### Understanding the Interface

**Main Navigation (Left Sidebar):**
- **Home**: Dashboard with recent activity
- **Models**: Discover and manage AI models
- **Chat**: Talk with AI models
- **Analytics**: System performance monitoring
- **Settings**: Configuration and preferences
- **OCR**: Test OCR models with documents
- **Prompt Eval**: Test prompts across multiple models

**Top Bar:**
- **Model Selector**: Choose which AI model to use
- **Connection Status**: Shows if APIs are working
- **Theme Toggle**: Switch between light and dark modes

### Your First Chat

1. **Select a Model**:
   - Go to Models page
   - Choose from available models (Groq models work immediately)
   - Click "Set as Active"

2. **Start Chatting**:
   - Go to Chat page
   - Type your message
   - Press Enter or click Send
   - View the AI response

3. **Adjust Settings** (Right Panel):
   - **Temperature**: Controls creativity (0.1 = focused, 1.0 = creative)
   - **Max Tokens**: Limits response length
   - **Top-p**: Controls response diversity

4. **Save Your Work**:
   - Chats are automatically saved
   - Find them in Home page → Recent Chats

---

## 📝 Text Display Features

### Smart Text Handling

GenAI Studio automatically handles long text content with intelligent splitting and user controls.

**Key Features:**
- **Automatic Splitting**: Long text is split into manageable sections
- **Individual Controls**: Each section has its own reveal/hide button
- **Bulk Controls**: "Reveal All" / "Hide All" buttons
- **Performance Optimized**: Sections are collapsed by default

### How It Works

**When Text is Long:**
- Text automatically splits at word boundaries
- Each section shows "Part X of Y"
- Individual reveal/hide buttons for each section
- "Reveal All" button to show everything at once

**When Text is Short:**
- Text displays normally in a single area
- No splitting occurs
- Standard expandable text area behavior

### Configuration Options

**Access Settings:**
1. Go to Settings → UI & Appearance
2. Find "Text Box Character Limit" section

**Available Options:**
- **Enable Character Limit**: Turn the feature on/off
- **Character Limit**: Set when text should split (100-10,000 characters)
- **Default Expansion**: Choose how sections appear initially
  - **First Part Expanded**: Shows Part 1, others collapsed
  - **All Parts Collapsed**: All sections hidden by default
  - **All Parts Expanded**: All sections visible by default

**Example Settings:**
- **Character Limit**: 1000 characters
- **Default Expansion**: First Part Expanded
- **Result**: Text longer than 1000 characters splits into sections, with Part 1 visible and others collapsed

### Using Text Controls

**Individual Section Controls:**
- Each section has a "Reveal" / "Hide" button
- Click to show or hide that specific section
- Button text changes based on current state

**Bulk Controls:**
- "Reveal All" button shows all sections at once
- "Hide All" button hides all sections
- Located both above and below text areas for convenience

**Best Practices:**
- Use smaller character limits (500-1000) for better performance
- Set "All Collapsed" for maximum performance
- Use "First Expanded" for balanced performance and usability

---

## 🤖 Model Management

### Discovering Models

**Hugging Face Models:**
1. Go to Models page
2. Click "Discover Models"
3. Search by name or browse categories
4. View model details and requirements

**Model Types:**
- **Chat Models**: For conversations (Llama, Mistral, Qwen)
- **Coding Models**: For programming help (Code Llama, StarCoder)
- **Embedding Models**: For text analysis (BGE, E5)
- **Vision Models**: For image understanding (LLaVA, BLIP)

### Downloading Models

**Easy Download:**
1. Find a model you want
2. Click "Download"
3. Watch progress in the download queue
4. Model appears in "Local Models" when ready

**Download Methods:**
- **Automatic**: Uses vLLM for reliable downloads
- **Direct**: Downloads directly from Hugging Face
- **Progress Tracking**: See download status in real-time

### Using Local Models

**LM Studio (Windows):**
1. Install LM Studio
2. Download models through LM Studio
3. Start server on port 1234
4. **LM Studio CLI is automatically installed** during GenAI Studio setup
5. Configure in GenAI Studio Settings

**Ollama (Cross-platform):**
1. Install Ollama
2. Pull models: `ollama pull llama2`
3. Start server: `ollama serve`
4. Configure in Settings

**vLLM (Advanced):**
1. Go to Settings → Local Models → vLLM Setup
2. Choose installation method
3. Follow setup instructions
4. Test connection

---

## 🧪 Evaluation Tools

### OCR Evaluation

**Purpose**: Test how well OCR models can read text from images and PDFs

**Setup:**
1. **Prepare Files**:
   - Put test files (PDFs, images) in `data/source/`
   - Put reference files (correct text) in `data/reference/`

2. **Run Evaluation**:
   - Go to OCR page
   - Select OCR model
   - Choose evaluation parameters
   - Click "Run Evaluation"

3. **View Results**:
   - See accuracy metrics
   - Compare extracted text with reference
   - Export results

**Metrics Explained:**
- **Accuracy**: How many characters were correct
- **Precision**: How many correct predictions were made
- **Recall**: How many correct characters were found
- **F1 Score**: Overall performance measure

### Prompt Evaluation

**Purpose**: Test how different prompts work with various models

**Setup:**
1. **Create Prompts**:
   - Write prompt templates
   - Use variables like `{input}` for flexibility
   - Save as reusable presets

2. **Configure Tests**:
   - Select models to test
   - Set parameter ranges (temperature, max tokens)
   - Choose evaluation metrics

3. **Run Evaluation**:
   - Process prompts across selected models
   - Compare results
   - Export evaluation reports

**Use Cases:**
- **Prompt Optimization**: Find the best prompt for your task
- **Model Comparison**: See which models work best
- **Parameter Tuning**: Test different settings
- **Quality Assessment**: Measure response quality

---

## ⚙️ Settings & Configuration

### API Configuration

**Groq API:**
- **Purpose**: High-performance AI inference
- **Setup**: Get free API key from Groq Console
- **Test**: Use "Test Connection" button

**Hugging Face:**
- **Purpose**: Model discovery and downloads
- **Setup**: Get token from HF Settings
- **Test**: Use "Test Connection" button

**Local Models:**
- **LM Studio**: Configure server URL and test connection
- **Ollama**: Set up server URL and test connection
- **vLLM**: One-click installation and configuration

### UI Settings

**Theme:**
- **Light Mode**: Bright interface
- **Dark Mode**: Dark interface (default)

**Landing Page:**
- **Home**: Overview dashboard
- **Models**: Model management
- **Chat**: Chat interface

**Text Display:**
- **Character Limit**: Set text splitting threshold
- **Default Expansion**: Choose initial text visibility
- **Enable/Disable**: Turn text splitting on/off

### Path Configuration

**File Paths:**
- **OCR Source**: Where to find test files
- **OCR Reference**: Where to find reference files
- **Prompt Source**: Where to find prompt files
- **Chat Downloads**: Where to save chat exports

**Default Paths:**
- All paths default to `./data/` subdirectories
- Change paths as needed for your setup

---

## 🛠️ Troubleshooting

### Common Issues

**App Won't Start:**
- **Docker**: Make sure Docker Desktop is running
- **Native**: Check if ports 8000 and 5173 are available
- **Solution**: Stop other services using these ports

**API Errors:**
- **Check API Keys**: Verify keys are correct in Settings
- **Test Connections**: Use "Test Connection" buttons
- **Check Quotas**: Ensure API limits aren't exceeded

**Model Issues:**
- **Download Failures**: Check internet connection and disk space
- **Connection Issues**: Verify local model servers are running
- **Performance**: Try smaller models or reduce parameters
- **Model Unloading Issues**: 
  - **LM Studio**: Ensure LM Studio CLI is installed (automatic during setup)
  - **Ollama**: Verify Ollama server is running and accessible
  - **General**: Check console for specific error messages

**Text Display Issues:**
- **Not Splitting**: Check if character limit is enabled and set correctly
- **Performance**: Reduce character limit or use "All Collapsed" setting
- **Errors**: Check browser console for error messages

### Getting Help

**Documentation:**
- **Technical Guide**: Detailed technical information
- **Architecture Guide**: System design and implementation
- **API Docs**: Available at `http://localhost:8000/docs`

**Community:**
- **GitHub Issues**: Report bugs and request features
- **Discussions**: Community Q&A and support

**Professional Support:**
- **Enterprise**: Commercial deployment support
- **Custom Development**: Tailored features and integrations

---

## 💡 Tips & Best Practices

### Performance Tips

**For Better Speed:**
- Use smaller models for testing
- Set lower temperature values (0.1-0.3)
- Limit max tokens for faster responses
- Use "All Collapsed" text display setting

**For Better Quality:**
- Use specialized models for specific tasks
- Experiment with different prompts
- Test multiple models for comparison
- Use appropriate parameter settings

### Workflow Tips

**Organization:**
- Use presets for common configurations
- Organize files in logical folders
- Use consistent naming conventions
- Keep notes on successful setups

**Efficiency:**
- Use batch operations for multiple files
- Enable background processing for long tasks
- Set up automated evaluations
- Export results regularly

### Text Display Tips

**Optimal Settings:**
- **Character Limit**: 500-1000 for most content
- **Default Expansion**: "First Expanded" for balanced performance
- **Performance**: Use "All Collapsed" for maximum speed
- **Usability**: Use "All Expanded" for immediate access

**Best Practices:**
- Test with your typical content length
- Adjust limits based on your workflow
- Monitor performance with large content
- Use individual controls for specific sections

---

*This user manual covers the essential features and workflows for GenAI Studio. For more detailed technical information, refer to the Technical User Guide or Architecture documentation.*