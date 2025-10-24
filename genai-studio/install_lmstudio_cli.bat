@echo off
setlocal
title Install LM Studio CLI

echo ========================================
echo Installing LM Studio CLI
echo ========================================
echo This script will download and install the LM Studio CLI tool
echo which is required for unloading models from GPU memory.
echo.

rem Create the directory if it doesn't exist
if not exist "%UserProfile%\.lmstudio\bin" (
    echo Creating directory: %UserProfile%\.lmstudio\bin
    mkdir "%UserProfile%\.lmstudio\bin"
)

echo Downloading LM Studio CLI...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/lmstudio-ai/lmstudio-cli/releases/latest/download/lms-windows-x64.exe' -OutFile '%UserProfile%\.lmstudio\bin\lms.exe'}"

if exist "%UserProfile%\.lmstudio\bin\lms.exe" (
    echo.
    echo ========================================
    echo Installation Successful!
    echo ========================================
    echo LM Studio CLI has been installed to: %UserProfile%\.lmstudio\bin\lms.exe
    echo.
    echo You can now use the model unload feature in GenAI Studio.
    echo The CLI will be automatically detected when you eject models.
    echo.
) else (
    echo.
    echo ========================================
    echo Installation Failed!
    echo ========================================
    echo Failed to download LM Studio CLI.
    echo Please check your internet connection and try again.
    echo.
    echo You can also install manually by:
    echo 1. Going to: https://github.com/lmstudio-ai/lmstudio-cli/releases
    echo 2. Downloading the latest lms-windows-x64.exe
    echo 3. Placing it in: %UserProfile%\.lmstudio\bin\
    echo.
)

echo Press any key to continue...
pause >nul
endlocal



