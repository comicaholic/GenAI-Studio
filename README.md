# 🚀 GenAI Studio

A full-stack application for running LLM evaluations, OCR-based file ingestion, and analytics.  
Built with **React (Vite) frontend** + **FastAPI backend**, with support for **Groq API models** and local resources.  

---

## 📦 Prerequisites

Depending on your setup, install the following:

### 🐍 Local / Conda Environment
- [Python 3.10+](https://www.python.org/downloads/)
- [Conda](https://docs.conda.io/en/latest/miniconda.html) (Miniconda or Anaconda)
- [Node.js 18+](https://nodejs.org/en/) (with npm/yarn)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) (required for OCR features)
  - Ensure `tesseract` is available in your system PATH

### 🐳 Docker
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

---

## ⚙️ Environment Setup

1. Copy `.env.example` → `.env` in both:
   - Project root
   - Backend folder (`./backend`)
2. Add your keys if needed:
   ```ini
   GROQ_API_KEY=your_api_key_here
