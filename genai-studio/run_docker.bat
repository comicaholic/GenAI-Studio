@echo off
setlocal
title genai-eval (Docker)

cd /d "%~dp0"
echo Stopping old containers...
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

echo Building and starting...
docker compose up --build -d
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
echo Opening browser...
start "" http://localhost:5173
start "" http://localhost:8000/api/health
echo Done. Containers are running in the background.
endlocal
