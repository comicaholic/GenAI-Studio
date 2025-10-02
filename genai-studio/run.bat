@echo off
setlocal
title genai-eval (conda dev)

rem --- repo root ---
set "REPO=%~dp0"
cd /d "%REPO%"

rem --- locate conda.bat ---
set "CONDA_BAT="
if exist "%UserProfile%\miniconda3\condabin\conda.bat" set "CONDA_BAT=%UserProfile%\miniconda3\condabin\conda.bat"
if not defined CONDA_BAT if exist "%UserProfile%\anaconda3\condabin\conda.bat" set "CONDA_BAT=%UserProfile%\anaconda3\condabin\conda.bat"
if not defined CONDA_BAT set "CONDA_BAT=conda"

call "%CONDA_BAT%" activate

rem --- ensure env ---
call conda env list | findstr /i "^genai-studio " >nul
if errorlevel 1 (
  call conda create -y -n genai-studio python=3.11
)
call conda activate genai-studio

rem --- backend deps (first time) ---
if exist backend\requirements.txt (
  python -m pip install --upgrade pip
  pip install -r backend\requirements.txt
)

rem --- start backend in its own window ---
start "backend:8000" cmd /k "call \"%CONDA_BAT%\" activate genai-studio && cd /d \"%REPO%backend\" && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

rem --- start frontend in its own window ---
start "frontend:5173" cmd /k "call \"%CONDA_BAT%\" activate genai-studio && cd /d \"%REPO%frontend\" && npm install && npm run dev"

echo.
echo Launched:
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo.
pause
endlocal
