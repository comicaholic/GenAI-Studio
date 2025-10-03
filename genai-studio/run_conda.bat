@echo off
setlocal
title genai-eval (local dev)

rem --- repo root ---
set "ROOT=%~dp0"

rem --- conda ---
set "CONDA_BAT=%UserProfile%\miniconda3\condabin\conda.bat"
if not exist "%CONDA_BAT%" set "CONDA_BAT=%UserProfile%\anaconda3\condabin\conda.bat"
if not exist "%CONDA_BAT%" (
  echo Could not find conda.bat. Edit this file to point to your install.
  pause & exit /b 1
)

rem --- BACKEND WINDOW ---
start "backend:8000" /D "%ROOT%" cmd /k ^
  call "%CONDA_BAT%" activate genai-studio ^& ^
  set "PYTHONPATH=%ROOT%backend" ^& ^
  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

rem --- FRONTEND WINDOW ---
start "frontend:5173" /D "%ROOT%frontend" cmd /k ^
  npm run dev -- --host --port 5173

echo.
echo Launched:
echo   Backend  -> http://localhost:8000/api/health
echo   Frontend -> http://localhost:5173
rem --- Wait for backend health, then open browser tabs ---
powershell -NoProfile -Command "try { for ($i=0; $i -lt 60; $i++) { $r = Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/health -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 }; Start-Sleep -Seconds 1 }; exit 1 } catch { exit 1 }"
if %errorlevel%==0 (
  start "" "http://localhost:5173"
  start "" "http://localhost:8000/api/health"
) else (
  echo Backend didn't become healthy in time; not opening browser.
)
start "" http://localhost:5173
echo.
endlocal