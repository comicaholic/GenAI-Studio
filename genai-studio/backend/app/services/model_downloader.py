# backend/app/services/model_downloader.py
import os
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from huggingface_hub import hf_hub_download, HfApi, snapshot_download
from huggingface_hub.utils import RepositoryNotFoundError, RevisionNotFoundError
import requests
import psutil
import torch

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
    
    def get_model_info(self, model_id: str) -> Dict:
        """Get comprehensive model information from Hugging Face"""
        try:
            print(f"Fetching model info for: {model_id}")
            model_info = self.api.model_info(model_id)
            print(f"Model info fetched successfully for: {model_id}")
            
            # Extract basic info
            result = {
                "id": model_id,
                "author": model_info.author,
                "description": model_info.card_data.get("description", "") if model_info.card_data else "",
                "likes": model_info.likes,
                "downloads": model_info.downloads,
                "tags": model_info.tags,
                "pipeline_tag": model_info.pipeline_tag,
                "library_name": model_info.library_name,
                "size": None,
                "files": [],
                "intended_uses": None,
                "background": None,
                "training_data": None,
                "model_card": None,
                "full_model_card": None
            }
            
            # Extract file information and calculate total size
            total_size = 0
            print(f"Processing {len(model_info.siblings)} files for {model_id}")
            
            for sibling in model_info.siblings:
                file_size = sibling.size if sibling.size else 0
                file_info = {
                    "filename": sibling.rfilename,
                    "size": file_size,
                    "size_mb": file_size / (1024 * 1024) if file_size else 0,
                    "size_gb": file_size / (1024 * 1024 * 1024) if file_size else 0
                }
                result["files"].append(file_info)
                total_size += file_size
                print(f"File: {sibling.rfilename}, Size: {file_size} bytes")
            
            # If we couldn't get sizes from API, try to estimate from model config
            if total_size == 0:
                print(f"No file sizes available from API for {model_id}, trying to estimate...")
                
                # Try to get model config to estimate size
                try:
                    from transformers import AutoConfig
                    config = AutoConfig.from_pretrained(model_id, token=self.api.token)
                    
                    # Estimate size based on model parameters
                    if hasattr(config, 'vocab_size') and hasattr(config, 'hidden_size'):
                        # Rough estimation for transformer models
                        vocab_size = config.vocab_size
                        hidden_size = config.hidden_size
                        num_layers = getattr(config, 'num_hidden_layers', 12)
                        num_heads = getattr(config, 'num_attention_heads', 12)
                        
                        # Rough calculation: embedding + transformer layers + output layer
                        embedding_size = vocab_size * hidden_size * 4  # 4 bytes per float32
                        layer_size = (hidden_size * hidden_size * 4 * 4) * num_layers  # attention + feedforward
                        output_size = vocab_size * hidden_size * 4
                        
                        estimated_size = embedding_size + layer_size + output_size
                        total_size = estimated_size
                        result["size"] = f"{total_size / (1024**3):.2f} GB (estimated)"
                        print(f"Estimated model size: {result['size']}")
                    else:
                        result["size"] = "Unknown"
                        print(f"Could not estimate model size for {model_id}")
                        
                except Exception as e:
                    print(f"Failed to estimate model size: {e}")
                    result["size"] = "Unknown"
            else:
                result["size"] = f"{total_size / (1024**3):.2f} GB"
                print(f"Total model size: {result['size']}")
            
            # Extract model card data with more comprehensive parsing
            if model_info.card_data:
                card_data = model_info.card_data
                
                # Store full model card
                result["full_model_card"] = card_data
                
                # Extract intended uses with multiple possible keys
                intended_uses_keys = ["intended_uses", "usage", "intended_use", "use_cases", "applications"]
                for key in intended_uses_keys:
                    if key in card_data and card_data[key]:
                        result["intended_uses"] = card_data[key]
                        break
                
                # Extract background with multiple possible keys
                background_keys = ["background", "model_description", "description", "overview", "about"]
                for key in background_keys:
                    if key in card_data and card_data[key]:
                        result["background"] = card_data[key]
                        break
                
                # Extract training data with multiple possible keys
                training_data_keys = ["training_data", "dataset", "datasets", "training_datasets", "data"]
                for key in training_data_keys:
                    if key in card_data and card_data[key]:
                        result["training_data"] = card_data[key]
                        break
                
                # If we still don't have description, try to get it from the main description
                if not result["description"] and model_info.card_data.get("description"):
                    result["description"] = model_info.card_data["description"]
            
            # Try to get README content for additional metadata
            try:
                readme_content = self.api.model_info(model_id).card_data.get("README.md", "")
                if readme_content and not result["intended_uses"]:
                    # Try to extract intended uses from README
                    import re
                    intended_uses_match = re.search(r'##?\s*Intended\s*Uses?.*?(?=##|\Z)', readme_content, re.IGNORECASE | re.DOTALL)
                    if intended_uses_match:
                        result["intended_uses"] = intended_uses_match.group(0).strip()
                
                if readme_content and not result["background"]:
                    # Try to extract background from README
                    background_match = re.search(r'##?\s*Background.*?(?=##|\Z)', readme_content, re.IGNORECASE | re.DOTALL)
                    if background_match:
                        result["background"] = background_match.group(0).strip()
                
                if readme_content and not result["training_data"]:
                    # Try to extract training data from README
                    training_match = re.search(r'##?\s*Training\s*Data.*?(?=##|\Z)', readme_content, re.IGNORECASE | re.DOTALL)
                    if training_match:
                        result["training_data"] = training_match.group(0).strip()
                        
            except Exception as e:
                print(f"Failed to parse README for {model_id}: {e}")
            
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
    
    def download_model(self, model_id: str, progress_callback=None) -> Dict:
        """Download a model from Hugging Face with progress tracking"""
        try:
            print(f"Starting download process for: {model_id}")
            
            # Get model info first
            model_info = self.get_model_info(model_id)
            print(f"Model info retrieved for: {model_id}")
            
            # Check requirements
            requirements = self.check_system_requirements(model_id, model_info)
            print(f"Requirements checked for: {model_id}")
            
            # Create model directory
            model_dir = self.cache_dir / model_id.replace("/", "_")
            model_dir.mkdir(parents=True, exist_ok=True)
            print(f"Created model directory: {model_dir}")
            
            print(f"Starting download of {model_id} to {model_dir}")
            
            # Download the model with progress tracking
            if progress_callback:
                progress_callback("Starting download...")
            
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
            
            if progress_callback:
                progress_callback("Download completed!")
            
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
            # Load existing registry
            registry_path = Path("data/models_registry.json")
            if registry_path.exists():
                with open(registry_path, 'r') as f:
                    registry = json.load(f)
            else:
                registry = {"local": []}
            
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
            
            # Check if model already exists
            existing_index = None
            for i, model in enumerate(registry["local"]):
                if model.get("id") == model_id:
                    existing_index = i
                    break
            
            if existing_index is not None:
                registry["local"][existing_index] = model_entry
            else:
                registry["local"].append(model_entry)
            
            # Save registry
            with open(registry_path, 'w') as f:
                json.dump(registry, f, indent=2)
            
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
            
            # Remove from registry
            registry_path = Path("data/models_registry.json")
            if registry_path.exists():
                with open(registry_path, 'r') as f:
                    registry = json.load(f)
                
                registry["local"] = [m for m in registry["local"] if m.get("id") != model_id]
                
                with open(registry_path, 'w') as f:
                    json.dump(registry, f, indent=2)
            
            return True
        except Exception as e:
            print(f"Failed to delete model: {e}")
            return False
