@echo off
setlocal enabledelayedexpansion

set "REPO=%~dp0"
pushd "%REPO%"

echo === Detecting Anaconda/Miniconda ===
set "CONDA_CMD="

where conda >nul 2>&1 && set "CONDA_CMD=conda"
if not defined CONDA_CMD (
  for %%P in (
    "%UserProfile%\anaconda3\Scripts\conda.exe"
    "%UserProfile%\anaconda3\condabin\conda.bat"
    "%UserProfile%\miniconda3\Scripts\conda.exe"
    "%UserProfile%\miniconda3\condabin\conda.bat"
    "%ProgramData%\Anaconda3\Scripts\conda.exe"
    "%ProgramData%\Miniconda3\Scripts\conda.exe"
  ) do (
    if exist %%~fP set "CONDA_CMD=%%~fP"
  )
)

if not defined CONDA_CMD (
  echo ERROR: Could not find conda. Install Anaconda or Miniconda, then re-run.
  goto :end
)

echo Using: %CONDA_CMD%
set "ENV=genai-studio"

echo.
echo === Creating/Updating Python 3.11 env ===
"%CONDA_CMD%" create -y -n %ENV% python=3.11 -c conda-forge
if errorlevel 1 (
  echo Failed to create/update the conda env.
  goto :end
)

echo.
echo === Installing backend requirements (excluding llama-cpp-python) ===
if not exist "%REPO%\backend\requirements.txt" (
  echo ERROR: "%REPO%\backend\requirements.txt" not found.
  goto :end
)
set "REQ_NOLLAMA=%TEMP%\req_nollama_%RANDOM%.txt"
type "%REPO%\backend\requirements.txt" | findstr /r /v "^llama-cpp-python" > "%REQ_NOLLAMA%"

"%CONDA_CMD%" run -n %ENV% python -m pip install --upgrade pip
"%CONDA_CMD%" run -n %ENV% python -m pip install -r "%REQ_NOLLAMA%"
del "%REQ_NOLLAMA%" >nul 2>&1

echo.
echo === Installing llama-cpp-python (CPU wheel; no compile) ===
set "LLAMA_WHL_IDX=https://abetlen.github.io/llama-cpp-python/whl/cpu"
"%CONDA_CMD%" run -n %ENV% python -m pip install --prefer-binary --only-binary=llama-cpp-python --extra-index-url %LLAMA_WHL_IDX% llama-cpp-python==0.2.90
if errorlevel 1 (
  echo ERROR: Failed to install llama-cpp-python wheel.
  echo If you need GPU later, switch to the CUDA wheel index documented upstream.
  goto :end
)

echo.
echo === Frontend setup ===
pushd "%REPO%frontend"
if not exist package.json npm init -y
call npm install -D vite
node -e "const fs=require('fs');const p='package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.scripts=j.scripts||{};if(!j.scripts.dev){j.scripts.dev='vite --port 5173'};fs.writeFileSync(p,JSON.stringify(j,null,2));console.log('dev script ready')"
popd

echo.
echo === Setup complete! ===
echo Run app with:  run_conda.bat
echo Or separately: run_conda.bat backend   /   run_conda.bat frontend

:end
popd
endlocal
