@echo off
setlocal ENABLEDELAYEDEXPANSION

REM ===========================================
REM  GenAI Studio - One Time Setup (Windows)
REM ===========================================

REM -- cd to repo root (folder of this script)
cd /d "%~dp0"

echo:
echo === Checking prerequisites =====================================

REM --- Python check ---
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found on PATH. Install Python 3.10+ and reopen terminal.
  exit /b 1
)
for /f "tokens=2 delims= " %%v in ('python -V') do set "PYVER=%%v"
echo [OK] Python %PYVER%

REM --- Node.js check ---
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found on PATH. Install Node LTS (>=18) from https://nodejs.org/
  exit /b 1
)
for /f %%v in ('node -v') do set "NODEVER=%%v"
echo [OK] Node %NODEVER%

echo:
echo === Python virtual environment & deps ===========================

REM Create venv if missing
if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Creating .venv ...
  py -m venv .venv 2>nul || python -m venv .venv
)

REM Upgrade pip & install backend requirements
set "VENV_PY=.venv\Scripts\python.exe"
"%VENV_PY%" -m pip install --upgrade pip setuptools wheel

REM Prefer backend\requirements.txt; fallback to repo root requirements.txt
set "REQ=backend\requirements.txt"
if not exist "%REQ%" (
  if exist "requirements.txt" (
    set "REQ=requirements.txt"
  ) else (
    echo [WARN] Could not locate requirements.txt (checked backend\ and root). Skipping backend install.
    goto :after_backend
  )
)

echo [INFO] Installing backend dependencies from %REQ% ...
"%VENV_PY%" -m pip install -r "%REQ%"
if errorlevel 1 (
  echo [ERROR] pip install failed. See messages above.
  exit /b 1
)

:after_backend
echo:
echo === Frontend dependencies & Vite =================================

pushd frontend

REM Detect package manager
set "PM=npm"
if exist "pnpm-lock.yaml" set "PM=pnpm"
if exist "yarn.lock" set "PM=yarn"

echo [INFO] Using package manager: %PM%

if /I "%PM%"=="pnpm" (
  call corepack enable 1>nul 2>nul
  pnpm -v >nul 2>&1 || (echo [ERROR] pnpm not available via Corepack. Install pnpm or use npm/yarn. & exit /b 1)
  pnpm install
) else if /I "%PM%"=="yarn" (
  call corepack enable 1>nul 2>nul
  yarn -v >nul 2>&1 || (echo [ERROR] yarn not available via Corepack. Install yarn or use npm/pnpm. & exit /b 1)
  yarn install
) else (
  if exist package-lock.json (
    npm ci
  ) else (
    npm install
  )
)

REM Ensure Vite + React SWC plugin exist (fixes "'vite' is not recognized")
if not exist "node_modules\.bin\vite.cmd" (
  echo [INFO] Installing Vite + @vitejs/plugin-react-swc locally...
  if /I "%PM%"=="pnpm" (
    pnpm add -D vite @vitejs/plugin-react-swc
  ) else if /I "%PM%"=="yarn" (
    yarn add -D vite @vitejs/plugin-react-swc
  ) else (
    npm install -D vite @vitejs/plugin-react-swc
  )
)

REM Ensure dev script exists (non-fatal if already present)
REM NOTE: If you already have scripts, this step is just a reminder.
REM Make sure package.json contains:  "dev": "vite --port 5173"
echo [INFO] Verify your package.json has a 'dev' script like: "dev": "vite --port 5173"

REM Quick Vite sanity check
npx vite --version || (echo [ERROR] Vite sanity check failed. & exit /b 1)

popd

echo:
echo === Final verification (dry run) =================================
echo [INFO] Checking uvicorn import in venv...
"%VENV_PY%" -c "import uvicorn; import fastapi; print('Uvicorn OK')"

echo [INFO] Setup complete.
echo You can now start both servers with run.bat (opens two terminals).
echo:
echo   1) Backend: %CD%\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000 --app-dir backend
echo   2) Frontend: cd frontend && npm run dev -- --port 5173
echo:
echo Or just double-click run.bat from Explorer.
echo:

endlocal
exit /b 0
