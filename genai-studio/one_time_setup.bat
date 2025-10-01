@echo off
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ================================
echo  GenAI Eval - One Time Setup
echo ================================
echo.

REM -------- Resolve repo root --------
set "ROOT=%~dp0"
pushd "%ROOT%"

REM -------- Check Python --------
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found on PATH. Install Python 3.10+ and re-run.
  goto :end_fail_pause
)
for /f "tokens=2 delims= " %%v in ('python -V 2^>nul') do set "PYVER=%%v"
echo [OK] Python %PYVER%

REM -------- Create venv if missing --------
if exist ".venv\Scripts\python.exe" (
  echo [OK] Virtual environment already exists: .venv
) else (
  echo [INFO] Creating virtual environment at .venv ...
  python -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    goto :end_fail_pause
  )
  echo [OK] .venv created
)

REM -------- Upgrade pip/wheel --------
echo [INFO] Upgrading pip/setuptools/wheel ...
".venv\Scripts\python.exe" -m pip install -U pip setuptools wheel --prefer-binary
if errorlevel 1 (
  echo [ERROR] Failed to upgrade pip/setuptools/wheel.
  goto :end_fail_pause
)

REM -------- Install backend requirements (root or backend/) --------
set "REQFILE="
if exist "backend\requirements.txt" set "REQFILE=backend\requirements.txt"
if not defined REQFILE if exist "requirements.txt" set "REQFILE=requirements.txt"

if defined REQFILE (
  echo [INFO] Installing Python requirements from %REQFILE% ...
  ".venv\Scripts\python.exe" -m pip install -r "%REQFILE%" --prefer-binary
  if errorlevel 1 (
    echo [ERROR] Backend requirements installation failed.
    echo [HINT] If build errors mention PyMuPDF / pytesseract / llama-cpp-python, you may need MSVC Build Tools or pinned wheels.
    goto :end_fail_pause
  )
  echo [OK] Backend dependencies installed
) else (
  echo [WARN] No requirements file found (skipping Python deps)
)

REM -------- Sanity: Uvicorn present? --------
".venv\Scripts\python.exe" -c "import uvicorn, sys; sys.stdout.write(uvicorn.__version__)" >nul 2>&1
if errorlevel 1 (
  echo [WARN] Uvicorn not importable in venv; installing uvicorn[standard]...
  ".venv\Scripts\python.exe" -m pip install "uvicorn[standard]" --prefer-binary
  if errorlevel 1 (
    echo [ERROR] Could not install uvicorn[standard].
    goto :end_fail_pause
  )
) else (
  echo [OK] Uvicorn detected
)

REM -------- Check Node / npm --------
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found on PATH. Install Node 18+ and re-run.
  goto :end_fail_pause
)
for /f %%v in ('node -v 2^>nul') do set "NODEVER=%%v"
echo [OK] Node %NODEVER%

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found on PATH. Install Node.js with npm.
  goto :end_fail_pause
)

REM -------- Install frontend deps --------
if exist "frontend\package.json" (
  echo [INFO] Installing frontend dependencies ...
  pushd frontend
  if exist package-lock.json (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    popd
    echo [ERROR] npm install failed. Ensure Node 18+ is installed.
    goto :end_fail_pause
  )
  REM optional: verify vite available via npx
  call npx --yes vite --version >nul 2>&1
  if errorlevel 1 (
    echo [WARN] Vite CLI not found globally; using local dev script will still work.
  ) else (
    for /f %%v in ('npx vite --version 2^>nul') do set "VITEVER=%%v"
    echo [OK] Vite %%VITEVER%%
  )
  popd
  echo [OK] Frontend dependencies installed
) else (
  echo [WARN] frontend\package.json not found (skipping frontend)
)

REM -------- ENV templates --------
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

REM -------- Data directories --------
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
echo   2) If Vite fails to bind on Windows, try: npm run dev -- --host --port 5173
echo   3) Backend health: http://localhost:8000/api/health
echo   4) Frontend:       http://localhost:5173
echo.
goto :end_ok

:end_fail_pause
echo.
echo Setup failed. See messages above for details.
echo (Window stays open so you can read errors.)
echo.
pause
exit /b 1

:end_ok
popd
exit /b 0
