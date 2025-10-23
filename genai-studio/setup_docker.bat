@echo off
setlocal
title GenAI Studio - Docker Setup (One-time)

cd /d "%~dp0"
echo ========================================
echo GenAI Studio - Docker Setup
echo ========================================
echo This is a one-time setup to build the Docker containers.
echo Run this only when you first set up the project or when
echo you make changes to Dockerfiles or dependencies.
echo.

echo Stopping any existing containers...
docker compose down -v >nul 2>&1

if %errorlevel% neq 0 (
  echo Docker is not running. Starting Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

  echo Waiting for Docker Desktop to start...
  :wait_for_docker
  timeout /t 5 >nul
  docker info >nul 2>&1
  if %errorlevel% neq 0 goto wait_for_docker
)

echo.
echo Building Docker containers (this may take several minutes)...
docker compose build --no-cache
if errorlevel 1 (
  echo.
  echo Docker build failed. Check the error messages above.
  pause
  exit /b 1
)

echo.
echo Starting containers...
docker compose up -d
if errorlevel 1 (
  echo.
  echo Docker failed to start. Make sure Docker Desktop is running.
  pause
  exit /b 1
)

echo Waiting for backend health...
for /l %%i in (1,1,50) do (
  curl -fsS http://localhost:8000/api/health >nul 2>&1 && goto :ok
  timeout /t 2 >nul
)
echo Backend did not become healthy. Opening logs...
docker compose logs -f
goto :eof

:ok
echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo Your Docker containers are now built and running.
echo.
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000/api/health
echo.
echo Opening browser...
start "" http://localhost:5173
start "" http://localhost:8000/api/health
echo.
echo You can now use 'run_docker.bat' to quickly start/stop the containers.
echo Run 'setup_docker.bat' again only if you modify Dockerfiles or dependencies.
echo.
pause
endlocal

