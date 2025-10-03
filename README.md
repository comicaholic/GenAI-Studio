# GenAI Studio (React + FastAPI)

## Quick start

### Option 1 — Docker
- Double-click `run_docker.bat`
- Backend will start at: [http://localhost:8000](http://localhost:8000)  
- Frontend will start at: [http://localhost:5173](http://localhost:5173)  
- The browser will open automatically.

### Option 2 — Conda (Windows)
1. Run `one_time_setup.bat` (first time only)  
   - Installs Python, Node, and dependencies.  
   - Automatically launches the app after setup.
2. Next time, just double-click `run.bat`.  
   - Backend: [http://localhost:8000](http://localhost:8000)  
   - Frontend: [http://localhost:5173](http://localhost:5173)  
   - Browser will open automatically.

---

## One-time requirements
- Python 3.10+
- Node 18+
- (Optional) Tesseract OCR for PDFs with images

## Notes
- Copy `.env.example` to `.env` (both root and backend folders).  
- Set `GROQ_API_KEY` in `.env` to use Groq models.  
- Local models directory: `./data/models`
