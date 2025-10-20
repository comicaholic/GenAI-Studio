# GenAI Studio (React + FastAPI)

Modern AI studio with a React frontend and FastAPI backend.

## Quick start

### Option 1 — Docker
- Double-click `run_docker.bat` (Windows) or run `./run_docker(macos_linux).sh` (macOS/Linux)
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

Notes about analytics in Docker:
- The backend runs inside a Linux container and may not have full access to host hardware on Windows.
- The Analytics page will show a non-intrusive warning when metrics may reflect container scope rather than full system.
- For the most accurate system metrics (CPU, Memory, GPU), prefer the Conda/native run below.

### Option 2 — Conda (Windows, recommended for accurate analytics)
1) Create/activate env (first time only):
   - Install Miniconda/Anaconda
   - Open Anaconda Prompt and run:
     - `conda create -n genai-studio python=3.11 -y`
     - `conda activate genai-studio`
     - `pip install -r backend/requirements.txt`
     - `pip install GPUtil pynvml`
     - From `frontend/`: `npm install`
2) Start backend:
   - In `backend/`: `python start.py`
   - Health check: `http://127.0.0.1:8000/api/health` should return ONLINE
3) Start frontend (in a separate terminal):
   - Ensure the frontend proxies to localhost (not Docker)
   - PowerShell: `Remove-Item Env:DOCKER -ErrorAction SilentlyContinue`
   - Optional explicit base: `setx VITE_API_BASE "http://127.0.0.1:8000"` (restart terminal to apply)
   - In `frontend/`: `npm run dev`
   - App: `http://localhost:5173`

Why Conda/native for analytics?
- Direct access to Windows system APIs yields Task Manager-like CPU/Memory/GPU readings.
- Historical performance charts and evaluation metrics populate reliably when the backend is running.

---

## Environment
- Copy `.env.example` to `.env` in the repo root and in `backend/`.
- Set secrets/keys (e.g., `GROQ_API_KEY`) as needed.
- Data directories:
  - Backend runtime data: `backend/data/`
  - Frontend build output: `frontend/dist/`

## Analytics behavior
- In Conda/native runs, analytics auto-detect hardware similar to Task Manager.
- In Docker, a small banner explains that metrics can reflect container scope and may be limited.
- Historical trends require the backend to be running; data is recorded periodically.

## Troubleshooting
### Frontend dev server shows many “vite http proxy ECONNREFUSED” errors
- Cause: Frontend is proxying API calls to a backend that isn’t reachable.
- Fix:
  1. Start the backend first (Conda/native): `cd backend && python start.py`
  2. Ensure Vite proxies to localhost:
     - PowerShell: `Remove-Item Env:DOCKER -ErrorAction SilentlyContinue`
     - Alternatively set `VITE_API_BASE` to `http://127.0.0.1:8000` before `npm run dev`
  3. Verify backend health at `http://127.0.0.1:8000/api/health`

### Port 5173 already in use
- Another dev server or container is using the port.
- Fix: Stop the other process or change the port: `npm run dev -- --port 5174`

### GPU metrics show 0%
- GPU utilization requires appropriate drivers and libraries (e.g., NVIDIA drivers). Inside Docker on Windows, GPU metrics may be limited.
- Run via Conda/native to confirm accurate GPU reporting.

## One-time requirements
- Python 3.10+
- Node 18+
- (Optional) Tesseract OCR for PDFs with images

## Scripts
- `run_docker.bat` / `run_docker(macos_linux).sh`: build and start via Docker Compose
- `setup_docker.bat`: rebuild images and restart containers
- `run_conda.bat` (if present in your fork): convenience launcher for native run

## Notes
- Local models directory: `./data/models`
- Keep the repository clean and “sleek”: no debug files or excessive console logging checked in.
