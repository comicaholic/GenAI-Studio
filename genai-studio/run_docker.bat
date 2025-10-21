@echo off
setlocal
title GenAI Studio - Docker Run

cd /d "%~dp0"
echo ========================================
echo GenAI Studio - Starting Containers
echo ========================================
echo Starting existing Docker containers...
echo.

echo Stopping any running containers...
docker compose down >nul 2>&1

if %errorlevel% neq 0 (
  echo Docker is not running. Starting Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

  echo Waiting for Docker Desktop to start...
  :wait_for_docker
  timeout /t 5 >nul
  docker info >nul 2>&1
  if %errorlevel% neq 0 goto wait_for_docker
)

echo Starting containers...
docker compose up -d
if errorlevel 1 (
  echo.
  echo Docker failed to start. Make sure Docker Desktop is running.
  echo If this is your first time running the project, use 'setup_docker.bat' instead.
  pause
  exit /b 1
)

echo Waiting for backend health...
for /l %%i in (1,1,30) do (
  curl -fsS http://localhost:8000/api/health >nul 2>&1 && goto :ok
  timeout /t 2 >nul
)
echo Backend did not become healthy. Opening logs...
docker compose logs -f
goto :eof

:ok
echo.
echo ========================================
echo Containers Started!
echo ========================================
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000/api/health
echo.
echo Opening browser...
start "" http://localhost:5173
start "" http://localhost:8000/api/health
echo.
echo Containers are running in the background.
echo Use 'docker compose down' to stop them.
echo.
pause
endlocal
