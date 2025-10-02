@echo off
setlocal
cd /d "%~dp0"
title Setup Debug Shell (stays open)
echo === DEBUG shell started %DATE% %TIME% ===
echo Running run.bat inside an interactive cmd…
echo.
REM /K keeps the window open even if the script calls exit /b or fails.
cmd /k ".\run.bat"
