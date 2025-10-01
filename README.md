# GenAI Studio (React + FastAPI)

## Quick start (Windows)
1) Run `one_time_setup.bat` (right-click → Run with PowerShell).
    - or use docker with the docker-compose.yml 
2) Run `run.bat` to start backend (8000) and frontend (5173).

## One-time requirements
- Python 3.10+
- Node 18+
- (Optional) Tesseract OCR for image PDFs

## Notes
- Copy `.env.example` to `.env` (root and backend) and set `GROQ_API_KEY` for Groq.
- Local models directory: `./data/models`
