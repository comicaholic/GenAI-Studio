from fastapi import APIRouter
import psutil
import time
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

router = APIRouter()

# Application start time for uptime calculation
APP_START_TIME = datetime.now()

# Groq usage tracking
GROQ_USAGE_FILE = Path(__file__).resolve().parents[2] / "data" / "groq_usage.json"
SYSTEM_METRICS_FILE = Path(__file__).resolve().parents[2] / "data" / "system_metrics.json"
EVALUATIONS_FILE = Path(__file__).resolve().parents[2] / "data" / "evaluations.json"
CHATS_FILE = Path(__file__).resolve().parents[2] / "data" / "chats.json"

def load_groq_usage() -> List[Dict]:
    """Load Groq usage data from file"""
    if not GROQ_USAGE_FILE.exists():
        return []
    try:
        with open(GROQ_USAGE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading Groq usage: {e}")
        return []

def save_groq_usage(usage_data: List[Dict]):
    """Save Groq usage data to file"""
    GROQ_USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(GROQ_USAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(usage_data, f, indent=2)
    except Exception as e:
        print(f"Error saving Groq usage: {e}")

def load_system_metrics() -> List[Dict]:
    """Load system metrics data from file"""
    if not SYSTEM_METRICS_FILE.exists():
        return []
    try:
        with open(SYSTEM_METRICS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading system metrics: {e}")
        return []

def save_system_metrics(metrics_data: List[Dict]):
    """Save system metrics data to file"""
    try:
        SYSTEM_METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SYSTEM_METRICS_FILE, "w", encoding="utf-8") as f:
            json.dump(metrics_data, f, indent=2)
    except Exception as e:
        print(f"Error saving system metrics: {e}")

def record_system_metrics():
    """Record current system metrics with proper application detection"""
    try:
        # Get current process (this application)
        current_process = psutil.Process()
        
        # Get system-wide metrics with better accuracy
        # Use shorter interval for more responsive updates
        cpu_percent = psutil.cpu_percent(interval=0.05)  # Reduced from 0.1
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get application-specific metrics (more accurate like Task Manager)
        try:
            # CPU usage - get percentage of total system CPU (like Task Manager)
            # Use non-blocking call first to initialize
            current_process.cpu_percent()
            # Use blocking call for accurate measurement
            app_cpu_percent = current_process.cpu_percent(interval=0.1)
            
            cpu_count = psutil.cpu_count()
            # psutil.Process().cpu_percent() returns percentage of ONE CPU core, not total system
            # We need to normalize it to be a percentage of total system CPU
            app_cpu_normalized = app_cpu_percent / cpu_count if cpu_count > 0 else app_cpu_percent
            
            # Additional safeguard: ensure app CPU never exceeds system CPU
            app_cpu_normalized = min(app_cpu_normalized, cpu_percent)
            
            # Memory usage - get RSS (Resident Set Size) like Task Manager
            app_memory_info = current_process.memory_info()
            app_memory_mb = app_memory_info.rss / (1024**2)  # RSS in MB
            app_memory_percent = (app_memory_mb / (memory.total / (1024**2))) * 100
            
            # Get additional process info
            app_threads = current_process.num_threads()
            app_fds = current_process.num_fds() if hasattr(current_process, 'num_fds') else 0
            
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            app_cpu_normalized = 0
            app_memory_mb = 0
            app_memory_percent = 0
            app_threads = 0
            app_fds = 0
        
        # Try to get GPU metrics with improved accuracy
        gpu_percent = None
        app_gpu_percent = None
        gpu_name = None
        gpu_temperature = None
        gpu_memory_used_gb = None
        gpu_memory_total_gb = None
        
        # Method 1: Try GPUtil (most reliable for NVIDIA)
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus and len(gpus) > 0:
                gpu = gpus[0]  # Use first GPU
                gpu_percent = gpu.load * 100
                gpu_name = gpu.name
                gpu_temperature = gpu.temperature
                gpu_memory_used_gb = round(gpu.memoryUsed / 1024, 2)  # Convert MB to GB
                gpu_memory_total_gb = round(gpu.memoryTotal / 1024, 2)  # Convert MB to GB
                
                # Application GPU usage should be much lower than system usage
                # Since we can't easily distinguish per-process GPU usage, we'll estimate it
                # as a small fraction of system usage (typically 5-20% of system usage)
                app_gpu_percent = max(0, gpu_percent * 0.1) if gpu_percent > 0 else 0
                
        except ImportError:
            pass
        except Exception as e:
            print(f"GPUtil error: {e}")
        
        # Method 2: Try nvidia-ml-py if GPUtil failed
        if gpu_percent is None:
            try:
                import pynvml
                pynvml.nvmlInit()
                device_count = pynvml.nvmlDeviceGetCount()
                if device_count > 0:
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    gpu_percent = util.gpu
                    
                    # Get additional GPU info
                    try:
                        name_bytes = pynvml.nvmlDeviceGetName(handle)
                        gpu_name = name_bytes.decode('utf-8') if isinstance(name_bytes, bytes) else str(name_bytes)
                    except:
                        gpu_name = "NVIDIA GPU"
                    
                    try:
                        gpu_temperature = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                    except:
                        gpu_temperature = None
                    
                    try:
                        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                        gpu_memory_used_gb = round(mem_info.used / (1024**3), 2)
                        gpu_memory_total_gb = round(mem_info.total / (1024**3), 2)
                    except:
                        gpu_memory_used_gb = None
                        gpu_memory_total_gb = None
                    
                    # Application GPU usage should be much lower than system usage
                    # Since we can't easily distinguish per-process GPU usage, we'll estimate it
                    # as a small fraction of system usage (typically 5-20% of system usage)
                    app_gpu_percent = max(0, gpu_percent * 0.1) if gpu_percent > 0 else 0
                    
            except ImportError:
                pass
            except Exception as e:
                print(f"pynvml error: {e}")
        
        # Method 3: Try Windows-specific GPU detection for basic info
        if gpu_percent is None:
            try:
                import subprocess
                import platform
                if platform.system() == "Windows":
                    # Try to get GPU info using wmic
                    result = subprocess.run(['wmic', 'path', 'win32_VideoController', 'get', 'name'], 
                                          capture_output=True, text=True, timeout=5)
                    if result.returncode == 0 and result.stdout.strip():
                        lines = result.stdout.strip().split('\n')
                        if len(lines) > 1:
                            gpu_name = lines[1].strip()
                            if gpu_name and gpu_name != "Name":
                                # Set basic GPU info (we can't get usage without proper drivers)
                                gpu_percent = 0
                                app_gpu_percent = 0
            except Exception as e:
                print(f"Windows GPU detection error: {e}")
        
        # Calculate disk percentage with debugging
        disk_percent = (disk.used / disk.total) * 100
        
        # Debug logging for values over 100%
        if cpu_percent > 100:
            print(f"WARNING: CPU usage over 100%: {cpu_percent}%")
        if memory.percent > 100:
            print(f"WARNING: Memory usage over 100%: {memory.percent}%")
        if disk_percent > 100:
            print(f"WARNING: Disk usage over 100%: {disk_percent}% (used: {disk.used}, total: {disk.total})")
        if gpu_percent and gpu_percent > 100:
            print(f"WARNING: GPU usage over 100%: {gpu_percent}%")
        
        metric_record = {
            "timestamp": datetime.now().isoformat(),
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "disk_percent": disk_percent,
            "gpu_percent": gpu_percent,
            "app_cpu_percent": app_cpu_normalized,
            "app_memory_percent": app_memory_percent,
            "app_memory_mb": app_memory_mb,
            "app_gpu_percent": app_gpu_percent,
            "app_threads": app_threads,
            "app_fds": app_fds,
            "gpu_name": gpu_name,
            "gpu_temperature": gpu_temperature,
            "gpu_memory_used_gb": gpu_memory_used_gb,
            "gpu_memory_total_gb": gpu_memory_total_gb
        }
        
        # Load existing data and add new record
        metrics_data = load_system_metrics()
        metrics_data.append(metric_record)
        
        # Keep only last 50000 records (about 35 days at 1-minute intervals, or longer with larger intervals)
        if len(metrics_data) > 50000:
            metrics_data = metrics_data[-50000:]
        
        save_system_metrics(metrics_data)
        return metric_record
    except Exception as e:
        print(f"❌ Error recording system metrics: {e}")
        return None

def load_evaluations() -> List[Dict]:
    """Load evaluations data from file"""
    if not EVALUATIONS_FILE.exists():
        return []
    try:
        with open(EVALUATIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading evaluations: {e}")
        return []

def load_chats() -> List[Dict]:
    """Load chats data from file"""
    if not CHATS_FILE.exists():
        return []
    try:
        with open(CHATS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading chats: {e}")
        return []

def start_metrics_recording():
    """Start metrics recording (simplified - just record current metrics)"""
    try:
        record_system_metrics()
        print("Recorded current system metrics")
    except Exception as e:
        print(f"Error recording system metrics: {e}")

def stop_metrics_recording():
    """Stop metrics recording (no-op for simplified version)"""
    print("Metrics recording stopped")

# Background recording setup
import threading
import time

def background_metrics_recorder():
    """Background thread to record metrics every 10 seconds for more responsive updates"""
    print("🔄 Background metrics recorder started")
    record_count = 0
    
    while True:
        try:
            record_system_metrics()
            record_count += 1
            
            # Log every 10th record (every ~100 seconds) to show it's working
            if record_count % 10 == 0:
                print(f"📊 Background metrics recorded {record_count} times")
            
            time.sleep(10)  # Record every 10 seconds for more responsive updates
        except Exception as e:
            print(f"❌ Error in background metrics recording: {e}")
            time.sleep(30)  # Wait longer on error

# Start background recording if not already running
_metrics_thread = None
def ensure_background_recording():
    """Ensure background metrics recording is running"""
    global _metrics_thread
    
    if _metrics_thread is None or not _metrics_thread.is_alive():
        try:
            _metrics_thread = threading.Thread(target=background_metrics_recorder, daemon=True)
            _metrics_thread.start()
            print("✅ Started background metrics recording")
            
            # Give it a moment to start and record initial metrics
            time.sleep(1)
            record_system_metrics()
            print("📊 Initial metrics recorded")
            
        except Exception as e:
            print(f"❌ Failed to start background metrics recording: {e}")
    else:
        print("ℹ️ Background metrics recording already running")

def record_groq_usage(model: str, tokens_used: int, cost_usd: float, duration_ms: int, success: bool = True):
    """Record a Groq API usage event"""
    usage_data = load_groq_usage()
    
    usage_record = {
        "id": f"groq_{int(time.time() * 1000)}",
        "model": model,
        "timestamp": datetime.now().isoformat(),
        "tokens_used": tokens_used,
        "cost_usd": cost_usd,
        "request_duration_ms": duration_ms,
        "success": success
    }
    
    usage_data.append(usage_record)
    
    # Keep only last 10000 records to prevent file from growing too large
    if len(usage_data) > 10000:
        usage_data = usage_data[-10000:]
    
    save_groq_usage(usage_data)

def get_timeframe_filter(timeframe: str) -> datetime:
    """Get start time for given timeframe"""
    # Use local time instead of UTC to match the stored data timestamps
    now = datetime.now()  # Local time without timezone
    timeframe_map = {
        "30m": timedelta(minutes=30),
        "1h": timedelta(hours=1),
        "3h": timedelta(hours=3),
        "6h": timedelta(hours=6),
        "12h": timedelta(hours=12),
        "24h": timedelta(hours=24),
        "3d": timedelta(days=3),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
        "all": timedelta(days=365)  # Effectively all time
    }
    
    delta = timeframe_map.get(timeframe, timedelta(hours=24))
    return now - delta

@router.get("/ping")
def ping_analytics():
    return {"module":"analytics", "ping":"pong"}

@router.get("/uptime")
def get_uptime():
    """Get application uptime"""
    uptime_seconds = (datetime.now() - APP_START_TIME).total_seconds()
    return {
        "uptime_seconds": int(uptime_seconds),
        "start_time": APP_START_TIME.isoformat(),
        "current_time": datetime.now().isoformat()
    }

@router.get("/system")
def get_system_metrics():
    """Get system performance metrics with improved accuracy"""
    try:
        # Ensure background recording is running
        ensure_background_recording()
        
        # Record current metrics for historical tracking
        record_system_metrics()
        
        # Get current process (this application)
        current_process = psutil.Process()
        
        # CPU usage - use more accurate method
        # Get system CPU usage with proper interval
        cpu_percent = psutil.cpu_percent(interval=0.05)  # Even shorter interval for more accuracy
        cpu_count = psutil.cpu_count()
        
        # Check if running in Docker and try to get host CPU info
        is_docker = os.environ.get('DOCKER', 'false').lower() == 'true'
        if is_docker and cpu_percent == 0.0:
            # Try to get host CPU usage when running in Docker
            try:
                import subprocess
                import platform
                
                if platform.system() == "Windows":
                    # Use Windows wmic to get CPU usage
                    result = subprocess.run(['wmic', 'cpu', 'get', 'loadpercentage', '/value'], 
                                          capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        for line in result.stdout.split('\n'):
                            if 'LoadPercentage=' in line:
                                cpu_percent = float(line.split('=')[1].strip())
                                break
                else:
                    # Linux: Try to read from /proc/stat
                    with open('/proc/stat', 'r') as f:
                        cpu_stats = f.readline().split()
                    if len(cpu_stats) >= 8:
                        # Calculate CPU usage from /proc/stat
                        idle = int(cpu_stats[4])
                        total = sum(int(x) for x in cpu_stats[1:8])
                        cpu_percent = 100.0 - (idle * 100.0 / total) if total > 0 else 0
            except (FileNotFoundError, ValueError, IndexError, subprocess.TimeoutExpired):
                # Fallback to psutil if host access fails
                pass
        
        # Get application-specific CPU usage - use more reliable method
        try:
            # Use blocking call for accurate measurement
            app_cpu_percent = current_process.cpu_percent(interval=0.1)
            # psutil.Process().cpu_percent() returns percentage of ONE CPU core, not total system
            # We need to normalize it to be a percentage of total system CPU
            app_cpu_percent = app_cpu_percent / cpu_count if cpu_count > 0 else app_cpu_percent
            
            # Additional safeguard: ensure app CPU never exceeds system CPU
            app_cpu_percent = min(app_cpu_percent, cpu_percent)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            app_cpu_percent = 0
        
        # Memory usage - get both system-wide and application-specific
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_used_gb = memory.used / (1024**3)
        memory_total_gb = memory.total / (1024**3)
        
        # Check if running in Docker and adjust memory detection
        is_docker = os.environ.get('DOCKER', 'false').lower() == 'true'
        docker_limitations = False
        
        if is_docker:
            # Docker containers on Windows run Linux, so they can't access Windows system commands
            # This means we can only get container-level metrics, not host system metrics
            docker_limitations = True
            # Try to get host system memory info when running in Docker
            try:
                import subprocess
                import platform
                
                if platform.system() == "Windows":
                    # Use Windows systeminfo command to get total memory
                    result = subprocess.run(['systeminfo'], capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        for line in result.stdout.split('\n'):
                            if 'Total Physical Memory:' in line:
                                # Extract memory value (e.g., "Total Physical Memory: 32,768 MB")
                                memory_str = line.split(':')[1].strip()
                                memory_mb = int(memory_str.replace(',', '').replace(' MB', ''))
                                memory_total_gb = memory_mb / 1024
                                # Recalculate memory percentage based on host total
                                memory_percent = (memory_used_gb / memory_total_gb) * 100
                                docker_limitations = False  # Successfully got host info
                                break
                else:
                    # Linux: Try to read from mounted host proc filesystem
                    with open('/host/proc/meminfo', 'r') as f:
                        meminfo = f.read()
                    for line in meminfo.split('\n'):
                        if line.startswith('MemTotal:'):
                            host_mem_kb = int(line.split()[1])
                            memory_total_gb = host_mem_kb / (1024**2)  # Convert KB to GB
                            memory_percent = (memory_used_gb / memory_total_gb) * 100
                            docker_limitations = False  # Successfully got host info
                            break
            except (FileNotFoundError, ValueError, IndexError, subprocess.TimeoutExpired, ImportError):
                # Fallback to container memory if host access fails
                docker_limitations = True
        
        
        # Get application-specific memory usage with better accuracy
        try:
            # Get memory info using multiple methods for accuracy
            app_memory_info = current_process.memory_info()
            app_memory_mb = app_memory_info.rss / (1024**2)  # RSS in MB
            
            # Calculate percentage more accurately
            app_memory_percent = (app_memory_mb / (memory_total_gb * 1024)) * 100
            
            # Also get VMS (Virtual Memory Size) for comparison
            app_memory_vms_mb = app_memory_info.vms / (1024**2)
            
            
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            app_memory_percent = 0
            app_memory_mb = 0
            app_memory_vms_mb = 0
        
        # Disk usage
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        disk_used_gb = disk.used / (1024**3)
        disk_total_gb = disk.total / (1024**3)
        
        # Debug logging for values over 100%
        if cpu_percent > 100:
            print(f"WARNING: CPU usage over 100%: {cpu_percent}%")
        if memory_percent > 100:
            print(f"WARNING: Memory usage over 100%: {memory_percent}%")
        if disk_percent > 100:
            print(f"WARNING: Disk usage over 100%: {disk_percent}% (used: {disk.used}, total: {disk.total})")
        if gpu_percent and gpu_percent > 100:
            print(f"WARNING: GPU usage over 100%: {gpu_percent}%")
        
        # GPU usage - improved detection with multiple methods
        gpu_percent = None
        gpu_system_percent = None
        gpu_name = None
        gpu_temperature = None
        gpu_memory_used_gb = None
        gpu_memory_total_gb = None
        app_gpu_percent = None
        
        # Method 1: Try GPUtil (most reliable for NVIDIA)
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus and len(gpus) > 0:
                gpu = gpus[0]  # Use first GPU
                gpu_percent = gpu.load * 100
                gpu_system_percent = gpu.memoryUtil * 100
                gpu_name = gpu.name
                gpu_temperature = gpu.temperature
                gpu_memory_used_gb = round(gpu.memoryUsed / 1024, 2)  # Convert MB to GB
                gpu_memory_total_gb = round(gpu.memoryTotal / 1024, 2)  # Convert MB to GB
                
                # Application GPU usage should be much lower than system usage
                # Since we can't easily distinguish per-process GPU usage, we'll estimate it
                # as a small fraction of system usage (typically 5-20% of system usage)
                app_gpu_percent = max(0, gpu_percent * 0.1) if gpu_percent > 0 else 0
                
        except ImportError:
            pass
        except Exception as e:
            print(f"GPUtil error in system endpoint: {e}")
        
        # Method 2: Try nvidia-ml-py if GPUtil failed
        if gpu_percent is None:
            try:
                import pynvml
                pynvml.nvmlInit()
                device_count = pynvml.nvmlDeviceGetCount()
                if device_count > 0:
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    gpu_percent = util.gpu
                    gpu_system_percent = util.memory
                    
                    # Get additional GPU info
                    try:
                        name_bytes = pynvml.nvmlDeviceGetName(handle)
                        gpu_name = name_bytes.decode('utf-8') if isinstance(name_bytes, bytes) else str(name_bytes)
                    except:
                        gpu_name = "NVIDIA GPU"
                    
                    try:
                        gpu_temperature = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                    except:
                        gpu_temperature = None
                    
                    try:
                        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                        gpu_memory_used_gb = round(mem_info.used / (1024**3), 2)
                        gpu_memory_total_gb = round(mem_info.total / (1024**3), 2)
                    except:
                        gpu_memory_used_gb = None
                        gpu_memory_total_gb = None
                    
                    # Application GPU usage should be much lower than system usage
                    # Since we can't easily distinguish per-process GPU usage, we'll estimate it
                    # as a small fraction of system usage (typically 5-20% of system usage)
                    app_gpu_percent = max(0, gpu_percent * 0.1) if gpu_percent > 0 else 0
                    
            except ImportError:
                pass
            except Exception as e:
                print(f"pynvml error in system endpoint: {e}")
        
        # Method 3: Try Windows-specific GPU detection
        if gpu_percent is None:
            try:
                import subprocess
                import platform
                if platform.system() == "Windows":
                    # Try to get GPU info using wmic
                    result = subprocess.run(['wmic', 'path', 'win32_VideoController', 'get', 'name'], 
                                          capture_output=True, text=True, timeout=5)
                    if result.returncode == 0 and result.stdout.strip():
                        lines = result.stdout.strip().split('\n')
                        if len(lines) > 1:
                            gpu_name = lines[1].strip()
                            if gpu_name and gpu_name != "Name":
                                # Set basic GPU info (we can't get usage without proper drivers)
                                gpu_percent = 0
                                gpu_system_percent = 0
                                app_gpu_percent = 0
            except Exception as e:
                print(f"Windows GPU detection error in system endpoint: {e}")
        
        result = {
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
                "system_percent": cpu_percent,
                "app_percent": round(app_cpu_percent, 2)
            },
            "memory": {
                "percent": memory_percent,
                "system_percent": memory_percent,
                "app_percent": round(app_memory_percent, 2),
                "used_gb": round(memory_used_gb, 2),
                "total_gb": round(memory_total_gb, 2),
                "app_used_mb": round(app_memory_mb, 2)
            },
            "disk": {
                "percent": round(disk_percent, 2),
                "used_gb": round(disk_used_gb, 2),
                "total_gb": round(disk_total_gb, 2)
            },
            "timestamp": datetime.now().isoformat()
        }
        
        # Add Docker limitations warning
        if docker_limitations:
            result["docker_warning"] = {
                "message": "Docker container limitations detected. Metrics may not reflect actual host system resources.",
                "recommendation": "For accurate system metrics, use the Conda version: run_conda.bat",
                "limitations": [
                    "CPU usage reflects container scope rather than full system",
                    "Memory totals and usage may reflect container limits",
                    "GPU detection and utilization may be unavailable or limited"
                ]
            }
        
        # Add GPU data if available
        if gpu_percent is not None:
            gpu_data = {
                "percent": round(gpu_percent, 2),
                "system_percent": round(gpu_system_percent, 2),
                "app_percent": round(app_gpu_percent, 2) if app_gpu_percent is not None else 0
            }
            
            # Add additional GPU info if available
            if gpu_name:
                gpu_data["name"] = gpu_name
            if gpu_temperature is not None:
                gpu_data["temperature"] = gpu_temperature
            if gpu_memory_used_gb is not None:
                gpu_data["memory_used_gb"] = gpu_memory_used_gb
            if gpu_memory_total_gb is not None:
                gpu_data["memory_total_gb"] = gpu_memory_total_gb
            
            result["gpu"] = gpu_data
        
        return result
    except Exception as e:
        return {"error": str(e)}

@router.get("/performance")
def get_performance_trends(timeframe: str = "24h", interval_minutes: int = 5):
    """Get performance trends data with proper sampling to prevent duplicates"""
    # Validate and clamp interval_minutes
    interval_minutes = max(1, min(60, interval_minutes))  # Clamp between 1-60 minutes
    try:
        # Ensure background recording is running
        ensure_background_recording()
        
        # Load real system metrics data
        metrics_data = load_system_metrics()
        
        if not metrics_data:
            # If no historical data, record current metrics and return empty trends
            record_system_metrics()
            return {
                "trends": [],
                "period": timeframe,
                "note": "No historical data available yet. Metrics will be recorded going forward."
            }
        
        # Get start time based on timeframe
        now = datetime.now()  # Use local time to match stored data
        start_time = get_timeframe_filter(timeframe)
        
        # Filter data by timeframe
        filtered_data = []
        for record in metrics_data:
            try:
                record_time = datetime.fromisoformat(record["timestamp"])
                # No need to add timezone since we're using local time consistently
                if record_time >= start_time:
                    filtered_data.append(record)
            except (ValueError, TypeError):
                continue
        
        if not filtered_data:
            return {
                "trends": [],
                "period": timeframe,
                "note": f"No data available for the last {timeframe}."
            }
        
        # Sort by timestamp (oldest first)
        filtered_data.sort(key=lambda x: x["timestamp"])
        
        # Group data into 5-minute quadrants to prevent jitter and duplicates
        time_span_hours = (now - start_time).total_seconds() / 3600
        data_points = len(filtered_data)
        
        # Group data into configurable intervals
        quadrant_data = {}
        quadrant_size_minutes = interval_minutes
        
        for record in filtered_data:
            timestamp = datetime.fromisoformat(record["timestamp"])
            # Round down to nearest interval
            quadrant_time = timestamp.replace(
                minute=(timestamp.minute // quadrant_size_minutes) * quadrant_size_minutes,
                second=0,
                microsecond=0
            )
            quadrant_key = quadrant_time.isoformat()
            
            if quadrant_key not in quadrant_data:
                quadrant_data[quadrant_key] = {
                    "timestamp": quadrant_key,
                    "cpu_percent": [],
                    "memory_percent": [],
                    "disk_percent": [],
                    "gpu_percent": [],
                    "app_cpu_percent": [],
                    "app_memory_percent": [],
                    "app_gpu_percent": [],
                    "count": 0
                }
            
            # Collect values for averaging (with null safety)
            quadrant_data[quadrant_key]["cpu_percent"].append(record.get("cpu_percent") or 0)
            quadrant_data[quadrant_key]["memory_percent"].append(record.get("memory_percent") or 0)
            quadrant_data[quadrant_key]["disk_percent"].append(record.get("disk_percent") or 0)
            quadrant_data[quadrant_key]["gpu_percent"].append(record.get("gpu_percent") or 0)
            quadrant_data[quadrant_key]["app_cpu_percent"].append(record.get("app_cpu_percent") or 0)
            quadrant_data[quadrant_key]["app_memory_percent"].append(record.get("app_memory_percent") or 0)
            quadrant_data[quadrant_key]["app_gpu_percent"].append(record.get("app_gpu_percent") or 0)
            quadrant_data[quadrant_key]["count"] += 1
        
        # Calculate averages for each quadrant
        trends = []
        for quadrant_key, data in sorted(quadrant_data.items()):
            if data["count"] > 0:
                # Ensure we have valid data before creating trend point
                cpu_avg = sum(data["cpu_percent"]) / len(data["cpu_percent"]) if data["cpu_percent"] else 0
                memory_avg = sum(data["memory_percent"]) / len(data["memory_percent"]) if data["memory_percent"] else 0
                disk_avg = sum(data["disk_percent"]) / len(data["disk_percent"]) if data["disk_percent"] else 0
                gpu_avg = sum(data["gpu_percent"]) / len(data["gpu_percent"]) if data["gpu_percent"] else 0
                app_cpu_avg = sum(data["app_cpu_percent"]) / len(data["app_cpu_percent"]) if data["app_cpu_percent"] else 0
                app_memory_avg = sum(data["app_memory_percent"]) / len(data["app_memory_percent"]) if data["app_memory_percent"] else 0
                app_gpu_avg = sum(data["app_gpu_percent"]) / len(data["app_gpu_percent"]) if data["app_gpu_percent"] else 0
                
                trend_point = {
                    "timestamp": quadrant_key,
                    "cpu_percent": round(cpu_avg, 2),
                    "memory_percent": round(memory_avg, 2),
                    "disk_percent": round(disk_avg, 2),
                    "gpu_percent": round(gpu_avg, 2),
                    "app_cpu_percent": round(app_cpu_avg, 2),
                    "app_memory_percent": round(app_memory_avg, 2),
                    "app_gpu_percent": round(app_gpu_avg, 2),
                    "app_memory_mb": round(app_memory_avg * 100, 2),  # Approximate conversion
                    "app_threads": 0,  # Not tracked in historical data
                    "app_fds": 0  # Not tracked in historical data
                }
                trends.append(trend_point)
        
        return {
            "trends": trends,
            "period": timeframe,
            "data_points": len(trends),
            "total_data_points": data_points,
            "time_span_hours": round(time_span_hours, 2),
            "interval_minutes": quadrant_size_minutes
        }
    except Exception as e:
        return {"error": str(e)}

@router.get("/groq")
def get_groq_analytics(timeframe: str = "24h"):
    """Get Groq API usage analytics"""
    try:
        usage_data = load_groq_usage()
        start_time = get_timeframe_filter(timeframe)
        
        # Filter data by timeframe
        filtered_data = []
        for record in usage_data:
            try:
                record_time = datetime.fromisoformat(record["timestamp"])
                # Make record time timezone-aware if it's naive
                if record_time.tzinfo is None:
                    record_time = record_time.replace(tzinfo=timezone.utc)
                if record_time >= start_time:
                    filtered_data.append(record)
            except (ValueError, TypeError):
                continue
        
        if not filtered_data:
            return {
                "total_requests": 0,
                "total_tokens": 0,
                "total_cost_usd": 0.0,
                "average_duration_ms": 0,
                "success_rate": 0.0,
                "usage_by_model": {},
                "hourly_usage": []
            }
        
        # Calculate summary statistics
        total_requests = len(filtered_data)
        total_tokens = sum(record["tokens_used"] for record in filtered_data)
        total_cost_usd = sum(record["cost_usd"] for record in filtered_data)
        successful_requests = sum(1 for record in filtered_data if record["success"])
        success_rate = successful_requests / total_requests if total_requests > 0 else 0
        average_duration_ms = sum(record["request_duration_ms"] for record in filtered_data) / total_requests
        
        # Group by model
        usage_by_model = {}
        for record in filtered_data:
            model = record["model"]
            if model not in usage_by_model:
                usage_by_model[model] = {
                    "requests": 0,
                    "tokens": 0,
                    "cost_usd": 0.0
                }
            usage_by_model[model]["requests"] += 1
            usage_by_model[model]["tokens"] += record["tokens_used"]
            usage_by_model[model]["cost_usd"] += record["cost_usd"]
        
        # Group by hour
        hourly_usage = {}
        for record in filtered_data:
            timestamp = datetime.fromisoformat(record["timestamp"])
            hour_key = timestamp.strftime("%Y-%m-%d %H:00")
            
            if hour_key not in hourly_usage:
                hourly_usage[hour_key] = {
                    "hour": hour_key,
                    "requests": 0,
                    "tokens": 0,
                    "cost_usd": 0.0
                }
            
            hourly_usage[hour_key]["requests"] += 1
            hourly_usage[hour_key]["tokens"] += record["tokens_used"]
            hourly_usage[hour_key]["cost_usd"] += record["cost_usd"]
        
        # Convert to list and sort by hour
        hourly_usage_list = sorted(hourly_usage.values(), key=lambda x: x["hour"])
        
        return {
            "total_requests": total_requests,
            "total_tokens": total_tokens,
            "total_cost_usd": round(total_cost_usd, 4),
            "average_duration_ms": round(average_duration_ms, 2),
            "success_rate": round(success_rate, 4),
            "usage_by_model": usage_by_model,
            "hourly_usage": hourly_usage_list
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.post("/groq/record")
def record_groq_usage_endpoint(
    model: str,
    tokens_used: int,
    cost_usd: float,
    duration_ms: int,
    success: bool = True
):
    """Record a Groq API usage event"""
    try:
        record_groq_usage(model, tokens_used, cost_usd, duration_ms, success)
        return {"status": "recorded"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/errors")
def get_error_metrics(timeframe: str = "24h"):
    """Get error metrics and trends"""
    try:
        usage_data = load_groq_usage()
        start_time = get_timeframe_filter(timeframe)
        
        # Filter data by timeframe
        filtered_data = []
        for record in usage_data:
            try:
                record_time = datetime.fromisoformat(record["timestamp"])
                # Make record time timezone-aware if it's naive
                if record_time.tzinfo is None:
                    record_time = record_time.replace(tzinfo=timezone.utc)
                if record_time >= start_time:
                    filtered_data.append(record)
            except (ValueError, TypeError):
                continue
        
        # Calculate error metrics
        total_requests = len(filtered_data)
        failed_requests = sum(1 for record in filtered_data if not record["success"])
        error_rate = failed_requests / total_requests if total_requests > 0 else 0
        
        # Group errors by hour
        hourly_errors = {}
        for record in filtered_data:
            timestamp = datetime.fromisoformat(record["timestamp"])
            hour_key = timestamp.strftime("%Y-%m-%d %H:00")
            
            if hour_key not in hourly_errors:
                hourly_errors[hour_key] = {
                    "hour": hour_key,
                    "errors": 0,
                    "error_rate": 0
                }
            
            if not record["success"]:
                hourly_errors[hour_key]["errors"] += 1
        
        # Calculate error rates per hour
        for hour_data in hourly_errors.values():
            hour_requests = sum(1 for record in filtered_data 
                              if datetime.fromisoformat(record["timestamp"]).strftime("%Y-%m-%d %H:00") == hour_data["hour"])
            hour_data["error_rate"] = hour_data["errors"] / hour_requests if hour_requests > 0 else 0
        
        return {
            "total_errors": failed_requests,
            "error_rate": error_rate,
            "errors_by_type": {"api_error": failed_requests},  # Simplified for now
            "hourly_errors": sorted(hourly_errors.values(), key=lambda x: x["hour"])
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.get("/latency")
def get_latency_metrics(timeframe: str = "24h"):
    """Get latency metrics and trends"""
    try:
        usage_data = load_groq_usage()
        start_time = get_timeframe_filter(timeframe)
        
        # Filter data by timeframe
        filtered_data = [
            record for record in usage_data
            if datetime.fromisoformat(record["timestamp"]) >= start_time and record["success"]
        ]
        
        if not filtered_data:
            return {
                "average_response_time_ms": 0,
                "p95_response_time_ms": 0,
                "p99_response_time_ms": 0,
                "hourly_latency": []
            }
        
        # Calculate latency metrics
        durations = [record["request_duration_ms"] for record in filtered_data]
        durations.sort()
        
        avg_latency = sum(durations) / len(durations)
        p95_latency = durations[int(len(durations) * 0.95)] if durations else 0
        p99_latency = durations[int(len(durations) * 0.99)] if durations else 0
        
        # Group by hour
        hourly_latency = {}
        for record in filtered_data:
            timestamp = datetime.fromisoformat(record["timestamp"])
            hour_key = timestamp.strftime("%Y-%m-%d %H:00")
            
            if hour_key not in hourly_latency:
                hourly_latency[hour_key] = {
                    "hour": hour_key,
                    "avg_latency": 0,
                    "p95_latency": 0,
                    "p99_latency": 0,
                    "durations": []
                }
            
            hourly_latency[hour_key]["durations"].append(record["request_duration_ms"])
        
        # Calculate hourly metrics
        for hour_data in hourly_latency.values():
            durations = hour_data["durations"]
            durations.sort()
            hour_data["avg_latency"] = sum(durations) / len(durations) if durations else 0
            hour_data["p95_latency"] = durations[int(len(durations) * 0.95)] if durations else 0
            hour_data["p99_latency"] = durations[int(len(durations) * 0.99)] if durations else 0
            del hour_data["durations"]  # Remove raw data
        
        return {
            "average_response_time_ms": round(avg_latency, 2),
            "p95_response_time_ms": round(p95_latency, 2),
            "p99_response_time_ms": round(p99_latency, 2),
            "hourly_latency": sorted(hourly_latency.values(), key=lambda x: x["hour"])
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.get("/throughput")
def get_throughput_metrics(timeframe: str = "24h"):
    """Get throughput metrics and trends"""
    try:
        usage_data = load_groq_usage()
        start_time = get_timeframe_filter(timeframe)
        
        # Filter data by timeframe
        filtered_data = []
        for record in usage_data:
            try:
                record_time = datetime.fromisoformat(record["timestamp"])
                # Make record time timezone-aware if it's naive
                if record_time.tzinfo is None:
                    record_time = record_time.replace(tzinfo=timezone.utc)
                if record_time >= start_time:
                    filtered_data.append(record)
            except (ValueError, TypeError):
                continue
        
        if not filtered_data:
            return {
                "requests_per_second": 0,
                "evaluations_per_minute": 0,
                "hourly_throughput": []
            }
        
        # Calculate throughput metrics
        total_requests = len(filtered_data)
        time_span_hours = (datetime.now() - start_time).total_seconds() / 3600
        requests_per_second = total_requests / (time_span_hours * 3600) if time_span_hours > 0 else 0
        evaluations_per_minute = requests_per_second * 60  # Assuming 1 request = 1 evaluation
        
        # Group by hour
        hourly_throughput = {}
        for record in filtered_data:
            timestamp = datetime.fromisoformat(record["timestamp"])
            hour_key = timestamp.strftime("%Y-%m-%d %H:00")
            
            if hour_key not in hourly_throughput:
                hourly_throughput[hour_key] = {
                    "hour": hour_key,
                    "requests_per_sec": 0,
                    "evals_per_min": 0,
                    "count": 0
                }
            
            hourly_throughput[hour_key]["count"] += 1
        
        # Calculate hourly throughput
        for hour_data in hourly_throughput.values():
            hour_data["requests_per_sec"] = hour_data["count"] / 3600  # requests per second in that hour
            hour_data["evals_per_min"] = hour_data["requests_per_sec"] * 60
            del hour_data["count"]  # Remove raw count
        
        return {
            "requests_per_second": round(requests_per_second, 2),
            "evaluations_per_minute": round(evaluations_per_minute, 2),
            "hourly_throughput": sorted(hourly_throughput.values(), key=lambda x: x["hour"])
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.get("/evaluations")
def get_evaluation_metrics(timeframe: str = "24h"):
    """Get evaluation metrics and trends"""
    try:
        # Load real evaluation data, excluding automation evaluations
        all_evaluations = load_evaluations()
        evaluations = [eval for eval in all_evaluations if not eval.get('automationId')]
        
        if not evaluations:
            return {
                "total_evaluations": 0,
                "average_pass_rate": 0.0,
                "rouge_scores": [],
                "bleu_scores": [],
                "f1_scores": [],
                "exact_match_scores": [],
                "bertscore_scores": [],
                "perplexity_scores": [],
                "accuracy_scores": [],
                "precision_scores": [],
                "recall_scores": [],
                "model_comparison": {},
                "note": "No evaluation data available yet."
            }
        
        # Filter by timeframe
        start_time = get_timeframe_filter(timeframe)
        filtered_evaluations = []
        
        for eval in evaluations:
            try:
                # Handle different timestamp formats and timezone awareness
                eval_timestamp = eval.get("startedAt", eval.get("timestamp", "1970-01-01T00:00:00"))
                
                # Parse timestamp and ensure it's timezone-aware
                if isinstance(eval_timestamp, str):
                    if eval_timestamp.endswith('Z'):
                        # UTC timestamp
                        eval_dt = datetime.fromisoformat(eval_timestamp.replace('Z', '+00:00'))
                    elif '+' in eval_timestamp or eval_timestamp.count('-') > 2:
                        # Already timezone-aware
                        eval_dt = datetime.fromisoformat(eval_timestamp)
                    else:
                        # Naive timestamp, assume UTC
                        eval_dt = datetime.fromisoformat(eval_timestamp).replace(tzinfo=timezone.utc)
                else:
                    eval_dt = eval_timestamp
                
                if eval_dt >= start_time:
                    filtered_evaluations.append(eval)
            except (ValueError, TypeError) as e:
                # Skip invalid timestamps
                continue
        
        if not filtered_evaluations:
            return {
                "total_evaluations": 0,
                "average_pass_rate": 0.0,
                "rouge_scores": [],
                "bleu_scores": [],
                "f1_scores": [],
                "exact_match_scores": [],
                "bertscore_scores": [],
                "perplexity_scores": [],
                "accuracy_scores": [],
                "precision_scores": [],
                "recall_scores": [],
                "model_comparison": {},
                "note": f"No evaluations found in the last {timeframe}."
            }
        
        # Extract scores from results
        rouge_scores = []
        bleu_scores = []
        f1_scores = []
        exact_match_scores = []
        bertscore_scores = []
        perplexity_scores = []
        accuracy_scores = []
        precision_scores = []
        recall_scores = []
        
        model_stats = {}
        
        for eval in filtered_evaluations:
            results = eval.get("results", {})
            model_id = eval.get("model", {}).get("id", "unknown")
            timestamp = eval.get("startedAt", eval.get("timestamp", datetime.now().isoformat()))
            
            # Initialize model stats if not exists
            if model_id not in model_stats:
                model_stats[model_id] = {
                    "evaluations": 0,
                    "rouge_scores": [],
                    "bleu_scores": [],
                    "f1_scores": [],
                    "em_scores": [],
                    "bertscore_scores": [],
                    "perplexity_scores": [],
                    "accuracy_scores": [],
                    "precision_scores": [],
                    "recall_scores": []
                }
            
            model_stats[model_id]["evaluations"] += 1
            
            # Extract individual scores
            # Handle ROUGE scores - use rougeL as the primary ROUGE score
            if "rougeL" in results:
                score = results["rougeL"]
                rouge_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["rouge_scores"].append(score)
            elif "rouge" in results:
                score = results["rouge"]
                rouge_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["rouge_scores"].append(score)
            
            if "bleu" in results:
                score = results["bleu"]
                bleu_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["bleu_scores"].append(score)
            
            if "f1" in results:
                score = results["f1"]
                f1_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["f1_scores"].append(score)
            
            if "em" in results:
                score = results["em"]
                exact_match_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["em_scores"].append(score)
            
            if "bertscore" in results:
                score = results["bertscore"]
                bertscore_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["bertscore_scores"].append(score)
            
            if "perplexity" in results:
                score = results["perplexity"]
                perplexity_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["perplexity_scores"].append(score)
            
            if "accuracy" in results:
                score = results["accuracy"]
                accuracy_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["accuracy_scores"].append(score)
            
            if "precision" in results:
                score = results["precision"]
                precision_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["precision_scores"].append(score)
            
            if "recall" in results:
                score = results["recall"]
                recall_scores.append({"project": eval.get("title", "Unknown"), "score": score, "timestamp": timestamp})
                model_stats[model_id]["recall_scores"].append(score)
        
        # Calculate model comparison statistics
        model_comparison = {}
        for model_id, stats in model_stats.items():
            if stats["evaluations"] > 0:
                model_comparison[model_id] = {
                    "evaluations": stats["evaluations"],
                    "avg_rouge": sum(stats["rouge_scores"]) / len(stats["rouge_scores"]) if stats["rouge_scores"] else 0,
                    "avg_bleu": sum(stats["bleu_scores"]) / len(stats["bleu_scores"]) if stats["bleu_scores"] else 0,
                    "avg_f1": sum(stats["f1_scores"]) / len(stats["f1_scores"]) if stats["f1_scores"] else 0,
                    "avg_em": sum(stats["em_scores"]) / len(stats["em_scores"]) if stats["em_scores"] else 0,
                    "avg_bertscore": sum(stats["bertscore_scores"]) / len(stats["bertscore_scores"]) if stats["bertscore_scores"] else 0,
                    "avg_perplexity": sum(stats["perplexity_scores"]) / len(stats["perplexity_scores"]) if stats["perplexity_scores"] else 0,
                    "avg_accuracy": sum(stats["accuracy_scores"]) / len(stats["accuracy_scores"]) if stats["accuracy_scores"] else 0,
                    "avg_precision": sum(stats["precision_scores"]) / len(stats["precision_scores"]) if stats["precision_scores"] else 0,
                    "avg_recall": sum(stats["recall_scores"]) / len(stats["recall_scores"]) if stats["recall_scores"] else 0,
                    "pass_rate": 0.8  # Default pass rate, could be calculated from actual pass/fail data
                }
        
        # Calculate average pass rate (simplified - assumes evaluations with results are "passed")
        total_evaluations = len(filtered_evaluations)
        evaluations_with_results = len([e for e in filtered_evaluations if e.get("results")])
        average_pass_rate = evaluations_with_results / total_evaluations if total_evaluations > 0 else 0
        
        return {
            "total_evaluations": total_evaluations,
            "average_pass_rate": round(average_pass_rate, 4),
            "rouge_scores": rouge_scores[-10:],  # Last 10 scores
            "bleu_scores": bleu_scores[-10:],
            "f1_scores": f1_scores[-10:],
            "exact_match_scores": exact_match_scores[-10:],
            "bertscore_scores": bertscore_scores[-10:],
            "perplexity_scores": perplexity_scores[-10:],
            "accuracy_scores": accuracy_scores[-10:],
            "precision_scores": precision_scores[-10:],
            "recall_scores": recall_scores[-10:],
            "model_comparison": model_comparison,
            "debug_info": {
                "all_evaluations_count": len(all_evaluations),
                "after_automation_filter": len(evaluations),
                "filtered_evaluations_count": len(filtered_evaluations)
            }
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.get("/users")
def get_user_analytics(timeframe: str = "24h"):
    """Get user analytics and collaboration metrics"""
    try:
        # Load real data from history files, excluding automation evaluations
        all_evaluations = load_evaluations()
        evaluations = [eval for eval in all_evaluations if not hasattr(eval, 'automationId') or not eval.automationId]
        chats = load_chats()
        
        # Filter by timeframe
        start_time = get_timeframe_filter(timeframe)
        
        # Ensure start_time is timezone-aware
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        
        filtered_evaluations = []
        for eval in evaluations:
            try:
                eval_timestamp = eval.get("startedAt", eval.get("timestamp", "1970-01-01T00:00:00"))
                if isinstance(eval_timestamp, str):
                    if eval_timestamp.endswith('Z'):
                        eval_dt = datetime.fromisoformat(eval_timestamp.replace('Z', '+00:00'))
                    elif '+' in eval_timestamp or eval_timestamp.count('-') > 2:
                        eval_dt = datetime.fromisoformat(eval_timestamp)
                    else:
                        eval_dt = datetime.fromisoformat(eval_timestamp).replace(tzinfo=timezone.utc)
                else:
                    eval_dt = eval_timestamp
                
                if eval_dt >= start_time:
                    filtered_evaluations.append(eval)
            except (ValueError, TypeError):
                continue
        
        filtered_chats = []
        for chat in chats:
            try:
                chat_timestamp = chat.get("lastActivityAt", chat.get("createdAt", "1970-01-01T00:00:00"))
                if isinstance(chat_timestamp, str):
                    if chat_timestamp.endswith('Z'):
                        chat_dt = datetime.fromisoformat(chat_timestamp.replace('Z', '+00:00'))
                    elif '+' in chat_timestamp or chat_timestamp.count('-') > 2:
                        chat_dt = datetime.fromisoformat(chat_timestamp)
                    else:
                        chat_dt = datetime.fromisoformat(chat_timestamp).replace(tzinfo=timezone.utc)
                else:
                    chat_dt = chat_timestamp
                
                if chat_dt >= start_time:
                    filtered_chats.append(chat)
            except (ValueError, TypeError):
                continue
        
        # Calculate user activity metrics
        total_evaluations = len(filtered_evaluations)
        total_chats = len(filtered_chats)
        
        # Count unique users (simplified - using model IDs as user proxies)
        evaluation_users = set()
        chat_users = set()
        
        for eval in filtered_evaluations:
            model_id = eval.get("model", {}).get("id", "unknown")
            evaluation_users.add(model_id)
        
        for chat in filtered_chats:
            model_id = chat.get("model", {}).get("id", "unknown")
            chat_users.add(model_id)
        
        # Combine unique users
        all_users = evaluation_users.union(chat_users)
        total_users = len(all_users)
        active_users = len([user for user in all_users if user != "unknown"])
        
        # Calculate evaluations by user (using model as proxy)
        evaluations_by_user = {}
        for eval in filtered_evaluations:
            model_id = eval.get("model", {}).get("id", "unknown")
            if model_id not in evaluations_by_user:
                evaluations_by_user[model_id] = 0
            evaluations_by_user[model_id] += 1
        
        # Sort by evaluation count and take top users
        sorted_users = sorted(evaluations_by_user.items(), key=lambda x: x[1], reverse=True)
        top_users = {user: count for user, count in sorted_users[:8]}
        
        # Calculate collaboration metrics (simplified)
        shared_projects = len(set(eval.get("title", "") for eval in filtered_evaluations))
        reused_presets = len(set(eval.get("parameters", {}).get("preset", "") for eval in filtered_evaluations if eval.get("parameters", {}).get("preset")))
        team_evaluations = len([eval for eval in filtered_evaluations if eval.get("automationId")])  # Automated evaluations as team work
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "evaluations_by_user": top_users,
            "collaboration_metrics": {
                "shared_projects": shared_projects,
                "reused_presets": reused_presets,
                "team_evaluations": team_evaluations
            },
            "activity_summary": {
                "total_evaluations": total_evaluations,
                "total_chats": total_chats,
                "timeframe": timeframe
            }
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.post("/metrics/start")
def start_recording():
    """Start background system metrics recording"""
    try:
        start_metrics_recording()
        return {"status": "started", "message": "Background metrics recording started"}
    except Exception as e:
        return {"error": str(e)}

@router.post("/metrics/stop")
def stop_recording():
    """Stop background system metrics recording"""
    try:
        stop_metrics_recording()
        return {"status": "stopped", "message": "Background metrics recording stopped"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/metrics/status")
def get_recording_status():
    """Get the status of metrics recording"""
    return {
        "is_recording": True,  # Always true since we record on-demand
        "task_status": "on-demand"
    }
