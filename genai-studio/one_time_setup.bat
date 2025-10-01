@echo off
setlocal ENABLEDELAYEDEXPANSION

echo.
echo ================================
echo  GenAI Eval - One Time Setup
echo ================================
echo.

REM --- Resolve repo root (this script's folder) ---
set "ROOT=%~dp0"
pushd "%ROOT%"

REM --- Check Python ---
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found on PATH. Install Python 3.10+ and re-run.
  goto :end_fail
)

for /f "tokens=2 delims= " %%v in ('python -V') do set "PYVER=%%v"
echo [OK] Python %PYVER%

REM --- Create venv if missing ---
if exist ".venv\Scripts\python.exe" (
  echo [OK] Virtual environment already exists: .venv
) else (
  echo [INFO] Creating virtual environment at .venv ...
  python -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    goto :end_fail
  )
  echo [OK] .venv created
)

REM --- Upgrade pip/wheel in venv ---
echo [INFO] Upgrading pip and wheel ...
".venv\Scripts\python.exe" -m pip install -U pip wheel
if errorlevel 1 (
  echo [ERROR] Failed to upgrade pip/wheel.
  goto :end_fail
)

REM --- Install backend requirements ---
if exist "backend\requirements.txt" (
  echo [INFO] Installing backend requirements ...
  ".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
  if errorlevel 1 (
    echo [ERROR] Backend requirements installation failed.
    goto :end_fail
  )
  echo [OK] Backend dependencies installed
) else (
  echo [WARN] backend\requirements.txt not found (skipping)
)

REM --- Install frontend dependencies ---
if exist "frontend\package.json" (
  echo [INFO] Installing frontend dependencies (npm install) ...
  pushd frontend
  call npm install
  if errorlevel 1 (
    popd
    echo [ERROR] npm install failed. Ensure Node.js 18+ is installed and in PATH.
    goto :end_fail
  )
  popd
  echo [OK] Frontend dependencies installed
) else (
  echo [WARN] frontend\package.json not found (skipping)
)

REM --- Copy env files if missing ---
if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [OK] Created .env from .env.example (root)
  ) else (
    echo [WARN] .env.example missing at root
  )
) else (
  echo [OK] .env already exists (root)
)

if not exist "backend\.env" (
  if exist "backend\.env.example" (
    copy /Y "backend\.env.example" "backend\.env" >nul
    echo [OK] Created backend\.env from backend\.env.example
  ) else (
    echo [WARN] backend\.env.example missing
  )
) else (
  echo [OK] backend\.env already exists
)

REM --- Create data directories ---
echo [INFO] Ensuring data folders exist ...
mkdir "data\presets\ocr"    >nul 2>&1
mkdir "data\presets\prompt" >nul 2>&1
mkdir "data\presets\chat"   >nul 2>&1
mkdir "data\uploads"        >nul 2>&1
mkdir "data\reports"        >nul 2>&1
mkdir "data\models"         >nul 2>&1
mkdir "data\cache"          >nul 2>&1
echo [OK] Data folders ready

echo.
echo ================================
echo  Setup complete! 🎉
echo ================================
echo.
echo Next:
echo   1) Start the app with run.bat
echo   2) Backend: http://localhost:8000/api/health  (should return {"status":"ok"})
echo   3) Frontend: http://localhost:5173
echo.
goto :end_ok

:end_fail
echo.
echo Setup failed. See messages above for details.
echo.
exit /b 1

:end_ok
popd
exit /b 0
