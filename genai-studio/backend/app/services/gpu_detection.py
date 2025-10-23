import subprocess
import platform
import os
from typing import List, Dict, Any

def detect_available_gpus() -> List[str]:
    """Detect available GPUs and return a list of GPU identifiers"""
    gpus = ["auto"]  # Always include auto-detect
    
    try:
        # Check for NVIDIA GPUs using nvidia-smi
        result = subprocess.run(['nvidia-smi', '--list-gpus'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            for i, line in enumerate(lines):
                if 'GPU' in line:
                    gpus.append(f"cuda:{i}")
            
            # If we found NVIDIA GPUs, add CPU option
            gpus.append("cpu")
            return gpus
    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
        pass
    
    # Check for Apple Silicon (MPS)
    if platform.system() == "Darwin" and platform.machine() == "arm64":
        try:
            # Check if Metal Performance Shaders is available
            import torch
            if torch.backends.mps.is_available():
                gpus.append("mps")
        except ImportError:
            pass
    
    # Check for AMD GPUs (ROCm)
    try:
        result = subprocess.run(['rocm-smi', '--showid'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            # Parse ROCm output to get GPU IDs
            lines = result.stdout.strip().split('\n')
            for i, line in enumerate(lines):
                if 'GPU' in line or 'Card' in line:
                    gpus.append(f"rocm:{i}")
            
            # If we found AMD GPUs, add CPU option
            gpus.append("cpu")
            return gpus
    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
        pass
    
    # Check for Intel GPUs (oneAPI)
    try:
        result = subprocess.run(['sycl-ls'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            if 'gpu' in result.stdout.lower():
                gpus.append("intel_gpu")
    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
        pass
    
    # If no GPUs found, just add CPU
    if len(gpus) == 1:  # Only "auto" is present
        gpus.append("cpu")
    
    return gpus

def get_gpu_info() -> Dict[str, Any]:
    """Get detailed information about available GPUs"""
    info = {
        "available_gpus": detect_available_gpus(),
        "gpu_details": []
    }
    
    # Get detailed info for each GPU
    for gpu_id in info["available_gpus"]:
        if gpu_id == "auto":
            continue
            
        gpu_detail = {"id": gpu_id, "name": "Unknown", "memory": "Unknown"}
        
        if gpu_id.startswith("cuda:"):
            try:
                result = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', 
                                       '--format=csv,noheader,nounits'], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    lines = result.stdout.strip().split('\n')
                    gpu_index = int(gpu_id.split(':')[1])
                    if gpu_index < len(lines):
                        name, memory = lines[gpu_index].split(', ')
                        gpu_detail["name"] = name.strip()
                        gpu_detail["memory"] = f"{memory.strip()} MB"
            except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError, ValueError):
                pass
        
        elif gpu_id == "mps":
            gpu_detail["name"] = "Apple Silicon GPU (MPS)"
            gpu_detail["memory"] = "Unified Memory"
            
        elif gpu_id.startswith("rocm:"):
            try:
                result = subprocess.run(['rocm-smi', '--showproductname', '--showmemuse'], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    gpu_detail["name"] = "AMD GPU (ROCm)"
                    gpu_detail["memory"] = "Available"
            except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
                pass
        
        elif gpu_id == "cpu":
            gpu_detail["name"] = "CPU"
            gpu_detail["memory"] = f"{os.cpu_count()} cores"
            
        info["gpu_details"].append(gpu_detail)
    
    return info

def validate_gpu_selection(gpu_id: str) -> bool:
    """Validate if the selected GPU is actually available"""
    available_gpus = detect_available_gpus()
    return gpu_id in available_gpus










