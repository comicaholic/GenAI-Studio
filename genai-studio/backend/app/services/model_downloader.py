# backend/app/services/model_downloader.py
import os
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Callable
from huggingface_hub import hf_hub_download, HfApi, snapshot_download
from huggingface_hub.utils import RepositoryNotFoundError, RevisionNotFoundError
import requests
import psutil
from .models import register_local_model, _load, _save
import torch
import threading
import time

class ModelDownloader:
    """Service for downloading and managing Hugging Face models"""
    
    def __init__(self):
        # Get models directory and HF token from config
        from app.services.config import load_config
        config = load_config()
        self.cache_dir = Path(config.get("models_dir", "data/models")).expanduser()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Get Hugging Face token
        hf_token = config.get("huggingface_token")
        if hf_token:
            self.api = HfApi(token=hf_token)
            print(f"Model downloader initialized with HF token and cache directory: {self.cache_dir}")
        else:
            self.api = HfApi()
            print(f"Model downloader initialized without HF token and cache directory: {self.cache_dir}")
    
    def _headers(self) -> Dict[str, str]:
        try:
            token = getattr(self.api, "token", None)
            return {"Authorization": f"Bearer {token}"} if token else {}
        except Exception:
            return {}
    
    def _sum_dir_bytes(self, directory: Path) -> int:
        total = 0
        if directory.exists():
            for p in directory.rglob("*"):
                if p.is_file():
                    try:
                        total += p.stat().st_size
                    except Exception:
                        pass
        return total
    
    def _fetch_model_card_text(self, model_id: str) -> Optional[str]:
        try:
            card = self.api.model_card(model_id)
            if hasattr(card, "text"):
                return card.text
            # Fallback via raw README from hub
            r = requests.get(f"https://huggingface.co/{model_id}/raw/main/README.md", headers=self._headers(), timeout=15)
            if r.status_code == 200:
                return r.text
        except Exception:
            pass
        return None
    
    def _fetch_hub_model_json(self, model_id: str) -> Optional[Dict]:
        try:
            r = requests.get(f"https://huggingface.co/api/models/{model_id}", headers=self._headers(), timeout=20)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        return None
    
    def get_model_info(self, model_id: str) -> Dict:
        """Get comprehensive model information from Hugging Face"""
        try:
            print(f"Fetching model info for: {model_id}")
            # Ensure files metadata to get sizes
            model_info = self.api.model_info(model_id, files_metadata=True)
            print(f"Model info fetched successfully for: {model_id}")
            
            # Extract basic info
            result: Dict = {
                "id": model_id,
                "author": getattr(model_info, "author", None),
                "description": (model_info.card_data.get("description", "") if getattr(model_info, "card_data", None) else ""),
                "likes": getattr(model_info, "likes", 0),
                "downloads": getattr(model_info, "downloads", 0),
                "tags": getattr(model_info, "tags", []) or [],
                "pipeline_tag": getattr(model_info, "pipeline_tag", None),
                "library_name": getattr(model_info, "library_name", None),
                "size": None,
                "total_bytes": 0,
                "files": [],
                "params": None,
                "model_card": None,
                "full_model_card": None
            }
            
            # Extract file information and calculate total size
            total_size = 0
            siblings = getattr(model_info, "siblings", []) or []
            print(f"Processing {len(siblings)} files for {model_id}")
            for sibling in siblings:
                file_size = getattr(sibling, "size", None) or 0
                file_info = {
                    "filename": getattr(sibling, "rfilename", None),
                    "size": file_size,
                    "size_mb": file_size / (1024 * 1024) if file_size else 0,
                    "size_gb": file_size / (1024 * 1024 * 1024) if file_size else 0
                }
                result["files"].append(file_info)
                total_size += file_size
            result["total_bytes"] = int(total_size)
            if total_size > 0:
                result["size"] = f"{total_size / (1024**3):.2f} GB"
                print(f"Total model size: {result['size']}")
            
            # Pull hub JSON for config/params and richer cardData
            hub_json = self._fetch_hub_model_json(model_id)
            if hub_json:
                config = hub_json.get("config") or {}
                # Parameters count may be provided directly
                params_count = config.get("num_parameters") or hub_json.get("parameterCount")
                if not params_count:
                    # Try common fields for estimation
                    hidden_size = config.get("hidden_size") or config.get("d_model") or config.get("n_embd")
                    num_layers = config.get("num_hidden_layers") or config.get("n_layer") or config.get("n_layers")
                    vocab_size = config.get("vocab_size") or 50257
                    if hidden_size and num_layers:
                        try:
                            params_count = int((hidden_size * hidden_size * 4 + hidden_size * vocab_size) * num_layers)
                        except Exception:
                            pass
                if params_count:
                    result["params"] = params_count
                # Use cardData text as a short description fallback
                if not result["description"] and hub_json.get("cardData", {}).get("text"):
                    result["description"] = (hub_json.get("cardData", {}).get("text") or "")
            
            # Model card markdown text
            card_text = self._fetch_model_card_text(model_id)
            if card_text:
                result["model_card"] = card_text
                result["full_model_card"] = card_text
            
            return result
            
        except (RepositoryNotFoundError, RevisionNotFoundError) as e:
            raise ValueError(f"Model '{model_id}' not found: {e}")
        except Exception as e:
            raise Exception(f"Failed to get model info: {e}")
    
    def check_system_requirements(self, model_id: str, model_info: Dict) -> Dict:
        """Check if system meets requirements to run the model"""
        requirements = {
            "can_run": True,
            "warnings": [],
            "errors": [],
            "recommended_gpu_memory": None,
            "estimated_memory": None
        }
        
        try:
            # Get system memory
            memory = psutil.virtual_memory()
            total_memory_gb = memory.total / (1024**3)
            
            # Estimate model memory requirements based on size
            if model_info.get("size"):
                size_str = model_info["size"]
                if "GB" in size_str:
                    size_gb = float(size_str.replace(" GB", ""))
                    requirements["estimated_memory"] = f"{size_gb:.1f} GB"
                    
                    # Rough estimation: model needs 2-3x its size in memory
                    estimated_ram_needed = size_gb * 2.5
                    estimated_vram_needed = size_gb * 1.5
                    
                    requirements["recommended_gpu_memory"] = f"{estimated_vram_needed:.1f} GB"
                    
                    if total_memory_gb < estimated_ram_needed:
                        requirements["warnings"].append(
                            f"System RAM ({total_memory_gb:.1f} GB) may be insufficient. "
                            f"Model may need ~{estimated_ram_needed:.1f} GB RAM."
                        )
                    
                    # Check GPU memory if available
                    if torch.cuda.is_available():
                        gpu_memory_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                        if gpu_memory_gb < estimated_vram_needed:
                            requirements["warnings"].append(
                                f"GPU memory ({gpu_memory_gb:.1f} GB) may be insufficient. "
                                f"Model may need ~{estimated_vram_needed:.1f} GB VRAM."
                            )
                    else:
                        requirements["warnings"].append(
                            "No GPU detected. Model will run on CPU, which may be slow."
                        )
            
            # Check for specific model requirements
            tags = model_info.get("tags", [])
            if "text-generation" in tags:
                if not torch.cuda.is_available():
                    requirements["warnings"].append(
                        "Text generation models perform much better with GPU acceleration."
                    )
            
            return requirements
            
        except Exception as e:
            requirements["errors"].append(f"Failed to check requirements: {e}")
            return requirements
    
    def download_model(self, model_id: str, progress_callback: Optional[Callable[[Dict], None]] = None) -> Dict:
        """Download a model from Hugging Face with progress tracking"""
        try:
            print(f"Starting download process for: {model_id}")
            
            # Get model info first (ensures we have expected total size)
            model_info = self.get_model_info(model_id)
            print(f"Model info retrieved for: {model_id}")
            total_bytes_expected = int(model_info.get("total_bytes") or 0)
            
            # Check requirements
            requirements = self.check_system_requirements(model_id, model_info)
            print(f"Requirements checked for: {model_id}")
            
            # Create model directory
            model_dir = self.cache_dir / model_id.replace("/", "_")
            model_dir.mkdir(parents=True, exist_ok=True)
            print(f"Created model directory: {model_dir}")
            
            print(f"Starting download of {model_id} to {model_dir}")
            
            # Progress monitoring thread
            stop_event = threading.Event()
            start_time = time.time()
            last_bytes = 0
            last_time = start_time
            
            def monitor_progress():
                while not stop_event.is_set():
                    try:
                        downloaded = self._sum_dir_bytes(model_dir)
                        now = time.time()
                        dt = max(now - last_time, 1e-6)
                        delta = max(downloaded - monitor_progress.last_bytes_seen, 0)
                        speed = delta / dt  # bytes/sec
                        progress = 0.0
                        eta = None
                        if total_bytes_expected > 0:
                            progress = min(100.0, (downloaded / total_bytes_expected) * 100.0)
                            remaining = max(total_bytes_expected - downloaded, 0)
                            eta = int(remaining / speed) if speed > 0 else None
                        if progress_callback:
                            progress_callback({
                                "downloaded_bytes": int(downloaded),
                                "total_bytes": int(total_bytes_expected),
                                "progress": float(progress),
                                "speed": float(speed),
                                "eta": eta
                            })
                        monitor_progress.last_bytes_seen = downloaded
                    except Exception:
                        pass
                    stop_event.wait(1.5)
            monitor_progress.last_bytes_seen = 0
            
            monitor_thread = threading.Thread(target=monitor_progress, daemon=True)
            monitor_thread.start()
            
            # Use snapshot_download to get all model files
            print(f"Calling snapshot_download for: {model_id}")
            
            # Get token for download
            from app.services.config import load_config
            config = load_config()
            hf_token = config.get("huggingface_token")
            
            local_path = snapshot_download(
                repo_id=model_id,
                cache_dir=str(self.cache_dir),
                local_dir=str(model_dir),
                local_dir_use_symlinks=False,
                token=hf_token
            )
            
            print(f"Download completed for {model_id} at {local_path}")
            stop_event.set()
            try:
                monitor_thread.join(timeout=5)
            except Exception:
                pass
            
            if progress_callback:
                # Final callback to mark 100%
                final_downloaded = self._sum_dir_bytes(model_dir)
                progress_callback({
                    "downloaded_bytes": int(final_downloaded),
                    "total_bytes": int(total_bytes_expected),
                    "progress": 100.0,
                    "speed": 0.0,
                    "eta": 0
                })
            
            # Register the model in the local registry
            self._register_local_model(model_id, str(model_dir), model_info)
            print(f"Model registered locally: {model_id}")
            
            return {
                "success": True,
                "local_path": local_path,
                "model_dir": str(model_dir),
                "model_info": model_info,
                "requirements": requirements
            }
            
        except Exception as e:
            print(f"Download failed for {model_id}: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "model_info": model_info if 'model_info' in locals() else None
            }
    
    def _register_local_model(self, model_id: str, model_path: str, model_info: Dict):
        """Register downloaded model in the local models registry"""
        try:
            # Create model entry
            model_entry = {
                "id": model_id,
                "label": model_info.get("author", "Unknown") + "/" + model_id.split("/")[-1],
                "provider": "local",
                "size": model_info.get("size"),
                "path": model_path,
                "tags": model_info.get("tags", []),
                "pipeline_tag": model_info.get("pipeline_tag"),
                "library_name": model_info.get("library_name"),
                "downloaded_at": str(Path().cwd()),
                "source": "huggingface"
            }
            
            # Use the robust registry functions from models.py
            register_local_model(model_entry)
            
            # Trigger model refresh event
            import threading
            def trigger_refresh():
                import time
                time.sleep(1)  # Small delay to ensure file is written
                # This will be handled by the frontend listening for model changes
                
            threading.Thread(target=trigger_refresh).start()
            
        except Exception as e:
            print(f"Failed to register model: {e}")
    
    def get_download_progress(self, model_id: str) -> Dict:
        """Get download progress for a model"""
        # This would be implemented with a more sophisticated progress tracking system
        # For now, return basic status
        model_dir = self.cache_dir / model_id.replace("/", "_")
        if model_dir.exists():
            return {"status": "completed", "progress": 100}
        else:
            return {"status": "not_started", "progress": 0}
    
    def delete_model(self, model_id: str) -> bool:
        """Delete a downloaded model"""
        try:
            model_dir = self.cache_dir / model_id.replace("/", "_")
            if model_dir.exists():
                shutil.rmtree(model_dir)
            
            # Remove from registry using robust functions
            registry = _load()
            registry["local"] = [m for m in registry["local"] if m.get("id") != model_id]
            _save(registry)
            
            return True
        except Exception as e:
            print(f"Failed to delete model: {e}")
            return False
