# backend/app/services/vllm_setup.py
import os
import subprocess
import sys
import platform
import requests
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import json

class VLLMSetup:
    """Service for setting up and managing vLLM installation"""
    
    def __init__(self):
        self.system = platform.system().lower()
        self.is_windows = self.system == "windows"
        self.is_mac = self.system == "darwin"
        self.is_linux = self.system == "linux"
        
    def check_vllm_installed(self) -> bool:
        """Check if vLLM is already installed"""
        try:
            import vllm
            return True
        except ImportError:
            return False
    
    def check_docker_available(self) -> bool:
        """Check if Docker is available"""
        try:
            result = subprocess.run(["docker", "--version"], 
                                  capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
    
    def check_conda_available(self) -> bool:
        """Check if Conda is available"""
        try:
            result = subprocess.run(["conda", "--version"], 
                                  capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
    
    def check_cuda_available(self) -> bool:
        """Check if CUDA is available"""
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            return False
    
    def get_installation_options(self) -> Dict:
        """Get available installation options"""
        options = {
            "pip": {
                "available": True,
                "recommended": True,
                "description": "Install vLLM via pip (recommended)",
                "requirements": ["Python 3.8+", "CUDA 11.8+ (for GPU)"],
                "command": "pip install vllm"
            },
            "conda": {
                "available": self.check_conda_available(),
                "recommended": False,
                "description": "Install vLLM via conda",
                "requirements": ["Conda", "CUDA 11.8+ (for GPU)"],
                "command": "conda install -c conda-forge vllm"
            },
            "docker": {
                "available": self.check_docker_available(),
                "recommended": False,
                "description": "Run vLLM in Docker container",
                "requirements": ["Docker", "NVIDIA Container Toolkit (for GPU)"],
                "command": "docker pull vllm/vllm-openai:latest"
            }
        }
        
        return options
    
    def install_vllm_pip(self) -> Tuple[bool, str]:
        """Install vLLM via pip with better error handling and Windows-specific solutions"""
        try:
            print("Installing vLLM via pip...")
            
            if self.is_windows:
                # Windows-specific installation attempts
                return self._install_vllm_windows()
            else:
                # Linux/macOS installation
                result = subprocess.run([
                    sys.executable, "-m", "pip", "install", "vllm"
                ], capture_output=True, text=True, timeout=300)
                
                if result.returncode == 0:
                    return True, "vLLM installed successfully via pip"
                else:
                    return False, f"pip install failed: {result.stderr}"
                
        except subprocess.TimeoutExpired:
            return False, "Installation timed out. vLLM is a large package and may take several minutes to install."
        except Exception as e:
            return False, f"Installation failed: {str(e)}"
    
    def _install_vllm_windows(self) -> Tuple[bool, str]:
        """Windows-specific vLLM installation with multiple fallback strategies"""
        strategies = [
            # Strategy 1: Try pre-built wheel if available
            {
                "name": "Pre-built wheel",
                "command": [sys.executable, "-m", "pip", "install", "vllm", "--only-binary=all"],
                "timeout": 300
            },
            # Strategy 2: Try with no build isolation
            {
                "name": "No build isolation",
                "command": [sys.executable, "-m", "pip", "install", "vllm", "--no-build-isolation", "--no-cache-dir"],
                "timeout": 600
            },
            # Strategy 3: Try with specific Python version compatibility
            {
                "name": "Python compatibility",
                "command": [sys.executable, "-m", "pip", "install", "vllm", "--force-reinstall", "--no-deps"],
                "timeout": 300
            }
        ]
        
        for strategy in strategies:
            try:
                print(f"Trying Windows installation strategy: {strategy['name']}")
                result = subprocess.run(
                    strategy["command"], 
                    capture_output=True, 
                    text=True, 
                    timeout=strategy["timeout"]
                )
                
                if result.returncode == 0:
                    return True, f"vLLM installed successfully using {strategy['name']} strategy"
                else:
                    print(f"Strategy {strategy['name']} failed: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                print(f"Strategy {strategy['name']} timed out")
                continue
            except Exception as e:
                print(f"Strategy {strategy['name']} failed with exception: {e}")
                continue
        
        # If all strategies fail, provide helpful guidance
        return False, self._get_windows_installation_guidance()
    
    def _get_windows_installation_guidance(self) -> str:
        """Provide detailed guidance for Windows vLLM installation issues"""
        return """vLLM does not natively support Windows. Installation errors are expected.

CORRECT INSTALLATION METHODS FOR WINDOWS:

1. WSL INSTALLATION (Recommended):
   - Install WSL: wsl --install -d Ubuntu
   - Install NVIDIA drivers in WSL
   - Install vLLM in WSL: pip install vllm
   - Configure app to connect to WSL vLLM instance

2. COMMUNITY WINDOWS BUILD:
   - pip install git+https://github.com/SystemPanic/vllm-windows.git
   - This is community-supported and may require additional configuration

3. DOCKER INSTALLATION:
   - Install Docker Desktop
   - Run: docker pull vllm/vllm-openai:latest
   - Start vLLM container with appropriate configuration

4. MANUAL INSTALLATION (Advanced):
   - Install Visual Studio Build Tools
   - Install CUDA Toolkit 11.8+
   - Run: pip install vllm --no-build-isolation

ALTERNATIVES (No vLLM needed):
- LM Studio: Easy Windows installation, great for local models
- Ollama: Simple setup, good model support
- Groq: Cloud-based, no installation needed

The app works perfectly without vLLM - you can still download and use Hugging Face models through other methods."""
    
    def install_vllm_conda(self) -> Tuple[bool, str]:
        """Install vLLM via conda"""
        try:
            print("Installing vLLM via conda...")
            result = subprocess.run([
                "conda", "install", "-c", "conda-forge", "vllm", "-y"
            ], capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                return True, "vLLM installed successfully via conda"
            else:
                return False, f"conda install failed: {result.stderr}"
                
        except subprocess.TimeoutExpired:
            return False, "Installation timed out"
        except Exception as e:
            return False, f"Installation failed: {str(e)}"
    
    def setup_docker_vllm(self) -> Tuple[bool, str]:
        """Setup vLLM Docker container with Windows-specific improvements"""
        try:
            print("Setting up vLLM Docker container...")
            
            # Check if Docker is running
            docker_check = subprocess.run(
                ["docker", "ps"], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if docker_check.returncode != 0:
                return False, "Docker is not running. Please start Docker Desktop and try again."
            
            # Pull the vLLM Docker image
            print("Pulling vLLM Docker image...")
            result = subprocess.run([
                "docker", "pull", "vllm/vllm-openai:latest"
            ], capture_output=True, text=True, timeout=600)
            
            if result.returncode != 0:
                return False, f"Failed to pull Docker image: {result.stderr}"
            
            # Create startup scripts for different platforms
            if self.is_windows:
                startup_script = self._create_windows_docker_startup_script()
            else:
                startup_script = self._create_docker_startup_script()
            
            return True, f"vLLM Docker image ready. Use: {startup_script}"
            
        except subprocess.TimeoutExpired:
            return False, "Docker setup timed out. Please ensure Docker Desktop is running."
        except Exception as e:
            return False, f"Docker setup failed: {str(e)}"
    
    def _create_windows_docker_startup_script(self) -> str:
        """Create a Windows-specific Docker startup script"""
        script_content = """@echo off
REM vLLM Docker Startup Script for Windows
REM This script starts vLLM in a Docker container

set MODEL_NAME=microsoft/DialoGPT-medium
set PORT=8000
set GPU_ARGS=

REM Check if NVIDIA GPU is available
nvidia-smi >nul 2>&1
if %errorlevel% == 0 (
    set GPU_ARGS=--gpus all
    echo NVIDIA GPU detected, enabling GPU support
) else (
    echo No NVIDIA GPU detected, running on CPU
)

REM Create models directory if it doesn't exist
if not exist "models" mkdir models

REM Start vLLM container
docker run -d --name vllm-server ^
    -p %PORT%:8000 ^
    %GPU_ARGS% ^
    -v "%cd%\\models:/models" ^
    vllm/vllm-openai:latest ^
    --model %MODEL_NAME% ^
    --host 0.0.0.0 ^
    --port 8000

if %errorlevel% == 0 (
    echo vLLM server starting on http://localhost:%PORT%
    echo To stop: docker stop vllm-server
    echo To remove: docker rm vllm-server
    echo To view logs: docker logs vllm-server
) else (
    echo Failed to start vLLM container
    echo Make sure Docker Desktop is running
)
pause
"""
        
        script_path = Path("start_vllm_docker.bat")
        script_path.write_text(script_content, encoding='utf-8')
        
        return f"{script_path.name}"
    
    def _create_docker_startup_script(self) -> str:
        """Create a startup script for vLLM Docker container"""
        script_content = """#!/bin/bash
# vLLM Docker Startup Script
# This script starts vLLM in a Docker container

MODEL_NAME="microsoft/DialoGPT-medium"  # Default model
PORT=8000
GPU_ARGS=""

# Check if NVIDIA GPU is available
if command -v nvidia-smi &> /dev/null; then
    GPU_ARGS="--gpus all"
    echo "NVIDIA GPU detected, enabling GPU support"
else
    echo "No NVIDIA GPU detected, running on CPU"
fi

# Start vLLM container
docker run -d --name vllm-server \\
    -p $PORT:8000 \\
    $GPU_ARGS \\
    -v $(pwd)/models:/models \\
    vllm/vllm-openai:latest \\
    --model $MODEL_NAME \\
    --host 0.0.0.0 \\
    --port 8000

echo "vLLM server starting on http://localhost:$PORT"
echo "To stop: docker stop vllm-server"
echo "To remove: docker rm vllm-server"
"""
        
        script_path = Path("start_vllm_docker.sh")
        script_path.write_text(script_content)
        script_path.chmod(0o755)
        
        return f"./{script_path.name}"
    
    def test_vllm_connection(self, base_url: str = "http://localhost:8000") -> Tuple[bool, str]:
        """Test connection to vLLM server"""
        try:
            response = requests.get(f"{base_url}/v1/models", timeout=10)
            if response.status_code == 200:
                models = response.json().get("data", [])
                return True, f"Connected successfully. Found {len(models)} models."
            else:
                return False, f"Connection failed: HTTP {response.status_code}"
        except requests.exceptions.ConnectionError:
            return False, "Connection failed: vLLM server not running"
        except Exception as e:
            return False, f"Connection test failed: {str(e)}"
    
    def download_model_via_vllm(self, model_id: str, base_url: str = "http://localhost:8000") -> Tuple[bool, str]:
        """Download a model via vLLM server"""
        try:
            # vLLM will automatically download models when they're first used
            # We can trigger this by making a request to load the model
            print(f"Triggering model download for {model_id} via vLLM...")
            
            # First, check if the model is already available
            response = requests.get(f"{base_url}/v1/models", timeout=30)
            if response.status_code != 200:
                return False, f"Failed to connect to vLLM server: HTTP {response.status_code}"
            
            models = response.json().get("data", [])
            model_names = [m.get("id", "") for m in models]
            
            if model_id in model_names:
                return True, f"Model {model_id} is already available"
            
            # Try to trigger model loading (this will download if needed)
            # Note: This is a simplified approach - in practice, vLLM downloads models
            # when they're first requested for inference
            try:
                # Make a test request to trigger model download
                test_response = requests.post(
                    f"{base_url}/v1/chat/completions",
                    json={
                        "model": model_id,
                        "messages": [{"role": "user", "content": "Hello"}],
                        "max_tokens": 1
                    },
                    timeout=60
                )
                
                if test_response.status_code == 200:
                    return True, f"Model {model_id} downloaded and loaded successfully"
                else:
                    return False, f"Failed to load model: HTTP {test_response.status_code}"
                    
            except requests.exceptions.Timeout:
                return False, "Model download timed out - this is normal for large models"
            except Exception as e:
                return False, f"Model download failed: {str(e)}"
                
        except Exception as e:
            return False, f"Download request failed: {str(e)}"
    
    def get_system_info(self) -> Dict:
        """Get system information for vLLM setup"""
        info = {
            "system": self.system,
            "python_version": sys.version,
            "cuda_available": self.check_cuda_available(),
            "docker_available": self.check_docker_available(),
            "conda_available": self.check_conda_available(),
            "vllm_installed": self.check_vllm_installed(),
            "recommended_method": "pip" if not self.check_docker_available() else "docker"
        }
        
        # Add GPU info if available
        try:
            import torch
            if torch.cuda.is_available():
                info["gpu_count"] = torch.cuda.device_count()
                info["gpu_names"] = [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())]
        except ImportError:
            pass
            
        return info

# Global instance
vllm_setup = VLLMSetup()
