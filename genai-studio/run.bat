@echo off
setlocal
cd /d "%~dp0"
REM start backend from inside backend/ so imports 'from app...' work
start "backend" cmd /k "cd backend && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
start "frontend" cmd /k "cd frontend && npm run dev -- --port 5173"
timeout /t 2 >nul
start http://localhost:5173
endlocal
