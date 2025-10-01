@echo off
echo === Starting genai-eval with Docker ===

:: Check if Docker is responding
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to start...
    :waitloop
    timeout /t 5 >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto waitloop
)

echo Docker is running. Launching containers...
docker compose up
pause
