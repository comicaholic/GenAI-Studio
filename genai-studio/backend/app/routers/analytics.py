from fastapi import APIRouter
import psutil
import time
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

router = APIRouter()

# Application start time for uptime calculation
APP_START_TIME = datetime.now()

# Background task for system metrics recording
_metrics_task = None

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
    SYSTEM_METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(SYSTEM_METRICS_FILE, "w", encoding="utf-8") as f:
            json.dump(metrics_data, f, indent=2)
    except Exception as e:
        print(f"Error saving system metrics: {e}")

def record_system_metrics():
    """Record current system metrics"""
    try:
        # Get current system metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Try to get GPU metrics
        gpu_percent = None
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu_percent = gpus[0].load * 100
        except ImportError:
            try:
                import pynvml
                pynvml.nvmlInit()
                device_count = pynvml.nvmlDeviceGetCount()
                if device_count > 0:
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    gpu_percent = util.gpu
            except ImportError:
                pass
        
        metric_record = {
            "timestamp": datetime.now().isoformat(),
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "disk_percent": (disk.used / disk.total) * 100,
            "gpu_percent": gpu_percent
        }
        
        # Load existing data and add new record
        metrics_data = load_system_metrics()
        metrics_data.append(metric_record)
        
        # Keep only last 1000 records (about 16 hours at 1-minute intervals)
        if len(metrics_data) > 1000:
            metrics_data = metrics_data[-1000:]
        
        save_system_metrics(metrics_data)
        return metric_record
    except Exception as e:
        print(f"Error recording system metrics: {e}")
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

async def background_metrics_recorder():
    """Background task to record system metrics every minute"""
    while True:
        try:
            record_system_metrics()
            await asyncio.sleep(60)  # Record every minute
        except Exception as e:
            print(f"Error in background metrics recording: {e}")
            await asyncio.sleep(60)

def start_metrics_recording():
    """Start the background metrics recording task"""
    global _metrics_task
    if _metrics_task is None or _metrics_task.done():
        _metrics_task = asyncio.create_task(background_metrics_recorder())
        print("Started background system metrics recording")

def stop_metrics_recording():
    """Stop the background metrics recording task"""
    global _metrics_task
    if _metrics_task and not _metrics_task.done():
        _metrics_task.cancel()
        print("Stopped background system metrics recording")

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
    now = datetime.now()
    timeframe_map = {
        "30m": timedelta(minutes=30),
        "1h": timedelta(hours=1),
        "3h": timedelta(hours=3),
        "6h": timedelta(hours=6),
        "12h": timedelta(hours=12),
        "24h": timedelta(hours=24),
        "3d": timedelta(days=3),
        "7d": timedelta(days=7)
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
    """Get system performance metrics"""
    try:
        # Start background recording if not already running
        start_metrics_recording()
        
        # Record current metrics for historical tracking
        record_system_metrics()
        
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        
        # Memory usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_used_gb = memory.used / (1024**3)
        memory_total_gb = memory.total / (1024**3)
        
        # Disk usage
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        disk_used_gb = disk.used / (1024**3)
        disk_total_gb = disk.total / (1024**3)
        
        # GPU usage (try to get GPU info if available)
        gpu_percent = None
        gpu_system_percent = None
        gpu_name = None
        gpu_temperature = None
        gpu_memory_used_gb = None
        gpu_memory_total_gb = None
        
        try:
            # Try to import and use GPUtil if available
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]  # Use first GPU
                gpu_percent = gpu.load * 100
                gpu_system_percent = gpu.memoryUtil * 100
                gpu_name = gpu.name
                gpu_temperature = gpu.temperature
                gpu_memory_used_gb = round(gpu.memoryUsed / 1024, 2)  # Convert MB to GB
                gpu_memory_total_gb = round(gpu.memoryTotal / 1024, 2)  # Convert MB to GB
                print(f"GPU detected via GPUtil: {gpu_name}, Load: {gpu_percent:.1f}%, Memory: {gpu_system_percent:.1f}%, Temp: {gpu_temperature}°C")
        except ImportError:
            # GPUtil not available, try nvidia-ml-py
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
                    name_bytes = pynvml.nvmlDeviceGetName(handle)
                    gpu_name = name_bytes.decode('utf-8') if isinstance(name_bytes, bytes) else str(name_bytes)
                    
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
                    
                    print(f"GPU detected via pynvml: {gpu_name}, GPU: {gpu_percent}%, Memory: {gpu_system_percent}%, Temp: {gpu_temperature}°C")
            except ImportError:
                print("No GPU monitoring libraries available (GPUtil or pynvml)")
                # Don't use mock data - return None to indicate no GPU data
            except Exception as e:
                print(f"Error accessing GPU via pynvml: {e}")
        except Exception as e:
            print(f"Error accessing GPU via GPUtil: {e}")
        
        result = {
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count
            },
            "memory": {
                "percent": memory_percent,
                "used_gb": round(memory_used_gb, 2),
                "total_gb": round(memory_total_gb, 2)
            },
            "disk": {
                "percent": round(disk_percent, 2),
                "used_gb": round(disk_used_gb, 2),
                "total_gb": round(disk_total_gb, 2)
            },
            "timestamp": datetime.now().isoformat()
        }
        
        # Add GPU data if available
        if gpu_percent is not None:
            gpu_data = {
                "percent": round(gpu_percent, 2),
                "system_percent": round(gpu_system_percent, 2)
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
def get_performance_trends():
    """Get performance trends data"""
    try:
        # Load real system metrics data
        metrics_data = load_system_metrics()
        
        if not metrics_data:
            # If no historical data, record current metrics and return empty trends
            record_system_metrics()
            return {
                "trends": [],
                "period": "24h",
                "note": "No historical data available yet. Metrics will be recorded going forward."
            }
        
        # Filter data for the last 24 hours
        now = datetime.now()
        start_time = now - timedelta(hours=24)
        
        filtered_data = [
            record for record in metrics_data
            if datetime.fromisoformat(record["timestamp"]) >= start_time
        ]
        
        # If we have less than 24 hours of data, pad with available data
        if len(filtered_data) < 24:
            # Use all available data
            trends = filtered_data
        else:
            # Sample every hour for the last 24 hours
            trends = []
        for i in range(24):
                target_time = now - timedelta(hours=i)
                # Find the closest record to this hour
                closest_record = min(
                    filtered_data,
                    key=lambda x: abs((datetime.fromisoformat(x["timestamp"]) - target_time).total_seconds())
                )
                trends.append(closest_record)
        
        # Sort by timestamp (oldest first)
        trends.sort(key=lambda x: x["timestamp"])
        
        return {
            "trends": trends,
            "period": "24h",
            "data_points": len(trends)
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
        filtered_data = [
            record for record in usage_data
            if datetime.fromisoformat(record["timestamp"]) >= start_time
        ]
        
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
        filtered_data = [
            record for record in usage_data
            if datetime.fromisoformat(record["timestamp"]) >= start_time
        ]
        
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
        filtered_data = [
            record for record in usage_data
            if datetime.fromisoformat(record["timestamp"]) >= start_time
        ]
        
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
        # Load real evaluation data
        evaluations = load_evaluations()
        
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
        filtered_evaluations = [
            eval for eval in evaluations
            if datetime.fromisoformat(eval.get("startedAt", eval.get("timestamp", "1970-01-01T00:00:00"))) >= start_time
        ]
        
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
            if "rouge" in results:
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
            "model_comparison": model_comparison
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.get("/users")
def get_user_analytics(timeframe: str = "24h"):
    """Get user analytics and collaboration metrics"""
    try:
        # Load real data from history files
        evaluations = load_evaluations()
        chats = load_chats()
        
        # Filter by timeframe
        start_time = get_timeframe_filter(timeframe)
        
        filtered_evaluations = [
            eval for eval in evaluations
            if datetime.fromisoformat(eval.get("startedAt", eval.get("timestamp", "1970-01-01T00:00:00"))) >= start_time
        ]
        
        filtered_chats = [
            chat for chat in chats
            if datetime.fromisoformat(chat.get("lastActivityAt", chat.get("createdAt", "1970-01-01T00:00:00"))) >= start_time
        ]
        
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
    """Get the status of background metrics recording"""
    global _metrics_task
    is_running = _metrics_task is not None and not _metrics_task.done()
    return {
        "is_recording": is_running,
        "task_status": "running" if is_running else "stopped"
    }
