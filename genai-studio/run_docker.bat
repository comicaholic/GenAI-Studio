@echo off
echo === Starting genai-eval with Docker ===

:: 1) If the engine isn't up, start Docker Desktop from your exact path
docker info >nul 2>&1
if %errorlevel% neq 0 (
  echo Docker is not running. Starting Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

  echo Waiting for Docker Desktop to start...
  :wait_for_docker
  timeout /t 5 >nul
  docker info >nul 2>&1
  if %errorlevel% neq 0 goto wait_for_docker
)

:: 2) Launch the stack
echo Docker is running. Launching containers...
docker compose up --build
pause
