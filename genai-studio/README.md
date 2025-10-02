# GenAI Studio (React + FastAPI)

## Quick start (Windows)


### Option 1 — Docker
Double-click `run_docker.bat`
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

### Option 2 — Anaconda/Miniconda
1) Double-click `one_time_setup_conda.bat` (first time only)
2) Double-click `run_conda.bat`
   - or `run_conda.bat backend` / `run_conda.bat frontend`



## One-time requirements
- Python 3.10+
- Node 18+
- (Optional) Tesseract OCR for image PDFs

## Notes
- Copy `.env.example` to `.env` (root and backend) and set `GROQ_API_KEY` for Groq.
- Local models directory: `./data/models`