@echo off
setlocal enabledelayedexpansion
title genai-eval (local dev)
set "ROOT=%~dp0"

rem ---- locate conda.bat (change if you use anaconda3) ----
set "CONDA_BAT=%UserProfile%\miniconda3\condabin\conda.bat"
if not exist "%CONDA_BAT%" set "CONDA_BAT=%UserProfile%\anaconda3\condabin\conda.bat"
if not exist "%CONDA_BAT%" (
  echo Could not find conda.bat. Edit run.bat to point to your install.
  pause & exit /b 1
)

rem ---- BACKEND WINDOW (target pkg path works from ANY folder) ----
start "backend:8000" cmd /k ^
"echo === BACKEND === & cd & call "%CONDA_BAT%" activate genai-studio & python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

rem ---- FRONTEND WINDOW (run inside frontend so 'dev' exists) ----
start "frontend:5173" /D "%ROOT%frontend" cmd /k ^
"echo === FRONTEND === & cd & call npm run dev -- --host --port 5173"

echo.
echo Launched:
echo   Backend  -> http://localhost:8000/api/health
echo   Frontend -> http://localhost:5173
echo.
endlocal
