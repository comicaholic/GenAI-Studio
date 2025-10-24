@echo off
setlocal
set "ROOT=%~dp0"
set "CONDA_BAT=%UserProfile%\miniconda3\condabin\conda.bat"
if not exist "%CONDA_BAT%" set "CONDA_BAT=%UserProfile%\anaconda3\condabin\conda.bat"
if not exist "%CONDA_BAT%" (
  echo Could not find conda.bat. Install Miniconda/Anaconda or update this path.
  pause & exit /b 1
)

echo Creating conda environment...
call "%CONDA_BAT%" create -y -n genai-studio python=3.11
call "%CONDA_BAT%" activate genai-studio

echo Installing backend dependencies...
rem ---- backend deps (includes uvicorn) ----
pip install -r "%ROOT%backend\requirements.txt"

rem ---- LM Studio CLI setup ----
echo Setting up LM Studio CLI...
if not exist "%UserProfile%\.lmstudio\bin\lms.exe" (
    echo Installing LM Studio CLI...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/lmstudio-ai/lmstudio-cli/releases/latest/download/lms-windows-x64.exe' -OutFile '%UserProfile%\.lmstudio\bin\lms.exe'}" 2>nul
    if exist "%UserProfile%\.lmstudio\bin\lms.exe" (
        echo LM Studio CLI installed successfully.
    ) else (
        echo Warning: Failed to install LM Studio CLI automatically. You may need to install it manually.
        echo To install manually, run: ~/.lmstudio/bin/lms bootstrap
    )
) else (
    echo LM Studio CLI already installed.
)

rem ---- frontend deps ----
echo Installing frontend dependencies...
pushd "%ROOT%frontend"
if not exist node_modules (call npm ci || call npm install)
popd

echo.
echo ========================================
echo Setup complete! 
echo ========================================
echo.
echo The app is ready to launch. vLLM is optional - you can:
echo   - Use Groq models (cloud-based)
echo   - Use LM Studio or Ollama for local models
echo   - Install vLLM later if needed using: install_vllm_windows.bat
echo.
echo Launching app...
call run_conda.bat
pause
endlocal
