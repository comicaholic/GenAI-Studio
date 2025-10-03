@echo off
setlocal
set "ROOT=%~dp0"
set "CONDA_BAT=%UserProfile%\miniconda3\condabin\conda.bat"
if not exist "%CONDA_BAT%" set "CONDA_BAT=%UserProfile%\anaconda3\condabin\conda.bat"
if not exist "%CONDA_BAT%" (
  echo Could not find conda.bat. Install Miniconda/Anaconda or update this path.
  pause & exit /b 1
)

call "%CONDA_BAT%" create -y -n genai-studio python=3.11
call "%CONDA_BAT%" activate genai-studio

rem ---- backend deps (includes uvicorn) ----
pip install -r "%ROOT%backend\requirements.txt"

rem ---- frontend deps ----
pushd "%ROOT%frontend"
if not exist node_modules (call npm ci || call npm install)
popd

echo Setup complete.
pause
cmd /k ".\run.bat"
endlocal
