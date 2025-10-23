# backend/app/routers/models.py
import os, requests
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from dataclasses import asdict
from app.services.models import scan_models_dir as get_local_models, save_local_models, get_groq_models
from app.services.models_visibility import load_enabled_ids, save_enabled_ids, cleanup_visibility_settings
from app.services.model_downloader import ModelDownloader
from app.services.download_queue import download_queue

router = APIRouter()

# ---------- listing ----------
@router.get("/list")
def list_models(include_groq: bool = True):
    local = get_local_models()
    warn, groq = get_groq_models() if include_groq else (None, [])

    # Augment with LM Studio and Ollama models if available
    try:
        from app.services.config import load_config
        cfg = load_config()
        import requests

        # LM Studio (OpenAI-compatible server)
        lm_cfg = cfg.get("lmstudio", {})
        if lm_cfg.get("baseUrl"):
            try:
                r = requests.get(f"{lm_cfg['baseUrl'].rstrip('/')}/v1/models", timeout=5)
                if r.status_code == 200:
                    data = r.json() or {}
                    for m in (data.get("data") or []):
                        mid = m.get("id")
                        if mid:
                            local.append({
                                "id": f"lmstudio/{mid}",
                                "provider": "local",
                                "source": "lmstudio",
                                "label": mid,
                                "tags": ["lmstudio"],
                            })
            except Exception:
                pass

        # Ollama
        ol_cfg = cfg.get("ollama", {})
        if ol_cfg.get("baseUrl"):
            try:
                headers = {}
                if ol_cfg.get("apiKey"):
                    headers["Authorization"] = f"Bearer {ol_cfg['apiKey']}"
                
                r = requests.get(f"{ol_cfg['baseUrl'].rstrip('/')}/api/tags", timeout=5, headers=headers)
                if r.status_code == 200:
                    data = r.json() or {}
                    for m in (data.get("models") or []):
                        name = m.get("name") or m.get("model")
                        if name:
                            # Enhanced cloud model detection
                            cloud_patterns = [
                                "llama3.1", "llama3", "mistral", "mixtral", "qwen", "gemma", 
                                "codellama", "phi", "neural-chat", "orca-mini", "starling",
                                "claude", "gpt", "palm", "bard", "chatgpt", "openai"
                            ]
                            is_cloud_model = any(pattern in name.lower() for pattern in cloud_patterns)
                            
                            # Add cloud tag for any cloud model
                            tags = ["ollama"]
                            if is_cloud_model:
                                tags.extend(["ollama-cloud", "cloud"])
                            
                            local.append({
                                "id": f"ollama/{name}",
                                "provider": "local",
                                "source": "ollama",
                                "label": name,
                                "tags": tags,
                                "is_cloud_model": is_cloud_model,
                            })
            except Exception:
                pass

        # vLLM (OpenAI-compatible server)
        vllm_cfg = cfg.get("vllm", {})
        if vllm_cfg.get("baseUrl"):
            try:
                r = requests.get(f"{vllm_cfg['baseUrl'].rstrip('/')}/v1/models", timeout=5)
                if r.status_code == 200:
                    data = r.json() or {}
                    for m in (data.get("data") or []):
                        mid = m.get("id")
                        if mid:
                            local.append({
                                "id": f"vllm/{mid}",
                                "provider": "local",
                                "source": "vllm",
                                "label": mid,
                                "tags": ["vllm"],
                            })
            except Exception:
                pass
    except Exception:
        pass

    # Apply visibility filtering
    enabled_ids = load_enabled_ids()
    if enabled_ids is not None:
        # Get all available model IDs first
        available_ids = set()
        for m in local:
            if m.get("id"):
                available_ids.add(m.get("id"))
        if groq:
            for m in groq:
                if m.get("id"):
                    available_ids.add(m.get("id"))
        
        # Only filter if we have models that match the enabled list
        # This prevents filtering out everything when LM Studio/Ollama/vLLM are not running
        matching_enabled_ids = [id for id in enabled_ids if id in available_ids]
        
        if matching_enabled_ids:
            # Filter local models based on visibility settings
            local = [m for m in local if m.get("id") in enabled_ids]
            # Filter groq models based on visibility settings
            if groq:
                groq = [m for m in groq if m.get("id") in enabled_ids]
        else:
            # No matching models found, likely because integrations are not running
            # Clean up the visibility settings and keep all available models
            print(f"Warning: No models match enabled IDs {enabled_ids}. Available IDs: {list(available_ids)}")
            print("Cleaning up visibility settings and keeping all available models.")
            cleanup_visibility_settings(list(available_ids))

    return {"local": local, "groq": groq, "warning": warn}

@router.get("/classified")
def get_classified_models(include_groq: bool = True, apply_visibility_filter: bool = True):
    """
    Return models with classification metadata including categories, publishers, etc.
    """
    from app.services.model_classifier import classify_models
    
    # Get local models
    local_models = get_local_models()

    # Augment with LM Studio and Ollama models (same as /list)
    try:
        from app.services.config import load_config
        cfg = load_config()
        import requests

        lm_cfg = cfg.get("lmstudio", {})
        if lm_cfg.get("baseUrl"):
            try:
                r = requests.get(f"{lm_cfg['baseUrl'].rstrip('/')}/v1/models", timeout=5)
                if r.status_code == 200:
                    data = r.json() or {}
                    for m in (data.get("data") or []):
                        mid = m.get("id")
                        if mid:
                            local_models.append({
                                "id": f"lmstudio/{mid}",
                                "provider": "local",
                                "source": "lmstudio",
                                "label": mid,
                                "tags": ["lmstudio"],
                            })
            except Exception:
                pass

        ol_cfg = cfg.get("ollama", {})
        if ol_cfg.get("baseUrl"):
            try:
                headers = {}
                if ol_cfg.get("apiKey"):
                    headers["Authorization"] = f"Bearer {ol_cfg['apiKey']}"
                
                r = requests.get(f"{ol_cfg['baseUrl'].rstrip('/')}/api/tags", timeout=5, headers=headers)
                if r.status_code == 200:
                    data = r.json() or {}
                    for m in (data.get("models") or []):
                        name = m.get("name") or m.get("model")
                        if name:
                            # Enhanced cloud model detection
                            cloud_patterns = [
                                "llama3.1", "llama3", "mistral", "mixtral", "qwen", "gemma", 
                                "codellama", "phi", "neural-chat", "orca-mini", "starling",
                                "claude", "gpt", "palm", "bard", "chatgpt", "openai"
                            ]
                            is_cloud_model = any(pattern in name.lower() for pattern in cloud_patterns)
                            
                            # Add cloud tag for any cloud model
                            tags = ["ollama"]
                            if is_cloud_model:
                                tags.extend(["ollama-cloud", "cloud"])
                            
                            local_models.append({
                                "id": f"ollama/{name}",
                                "provider": "local",
                                "source": "ollama",
                                "label": name,
                                "tags": tags,
                                "is_cloud_model": is_cloud_model,
                            })
            except Exception:
                pass

        # vLLM (OpenAI-compatible server)
        vllm_cfg = cfg.get("vllm", {})
        if vllm_cfg.get("baseUrl"):
            try:
                r = requests.get(f"{vllm_cfg['baseUrl'].rstrip('/')}/v1/models", timeout=5)
                if r.status_code == 200:
                    data = r.json() or {}
                    for m in (data.get("data") or []):
                        mid = m.get("id")
                        if mid:
                            local_models.append({
                                "id": f"vllm/{mid}",
                                "provider": "local",
                                "source": "vllm",
                                "label": mid,
                                "tags": ["vllm"],
                            })
            except Exception:
                pass
    except Exception:
        pass
    local_classified = classify_models(local_models)
    
    # Get Groq models
    warn, groq_models = get_groq_models() if include_groq else (None, [])
    
    # Combine all models
    all_models = local_classified + groq_models
    
    # Apply visibility filtering only if requested
    if apply_visibility_filter:
        enabled_ids = load_enabled_ids()
        if enabled_ids is not None:
            # Get all available model IDs first
            available_ids = set()
            for m in all_models:
                if m.get("id"):
                    available_ids.add(m.get("id"))
            
            # Only filter if we have models that match the enabled list
            # This prevents filtering out everything when LM Studio/Ollama/vLLM are not running
            matching_enabled_ids = [id for id in enabled_ids if id in available_ids]
            
            if matching_enabled_ids:
                all_models = [m for m in all_models if m.get("id") in enabled_ids]
            else:
                # No matching models found, likely because integrations are not running
                # Clean up the visibility settings and keep all available models
                print(f"Warning: No models match enabled IDs {enabled_ids} in classified endpoint. Available IDs: {list(available_ids)}")
                print("Cleaning up visibility settings and keeping all available models.")
                cleanup_visibility_settings(list(available_ids))
    
    # Group by category for easier frontend consumption
    categories = {}
    for model in all_models:
        category = model.get("category", "Unknown / Needs Review")
        if category not in categories:
            categories[category] = []
        categories[category].append(model)
    
    return {
        "models": all_models,
        "categories": categories,
        "warning": warn
    }

# ---------- Hugging Face discovery ----------
def _get_hf_token():
    """Get Hugging Face token from environment or settings"""
    token = os.getenv("HUGGINGFACE_TOKEN", "")
    if not token:
        # Try to load from settings
        try:
            from app.services.config import load_config
            cfg = load_config()
            token = cfg.get("huggingface", {}).get("token", "")
        except:
            pass
    return token

def _hf_headers(): 
    token = _get_hf_token()
    return {"Authorization": f"Bearer {token}"} if token else {}

@router.get("/search")
def search_models(q: str = "", sort: str = Query("downloads", pattern="^(downloads|likes|recent)$"), limit: int = 20):
    try:
        params = {"search": q, "limit": limit}
        params["sort"] = {"downloads":"downloads", "likes":"likes", "recent":"lastModified"}[sort]
        r = requests.get("https://huggingface.co/api/models", params=params, headers=_hf_headers(), timeout=30)
        r.raise_for_status()
        items = r.json()
        return {"results": [{
            "id": it.get("id"),
            "author": it.get("author"),
            "likes": it.get("likes", 0),
            "downloads": it.get("downloads", 0),
            "tags": it.get("tags", []),
            "lastModified": it.get("lastModified"),
            "private": it.get("private", False),
        } for it in items]}
    except Exception as e:
        raise HTTPException(502, f"HF search error: {e}")

# ---------- manage local_models.json ----------
class LocalModelIn(BaseModel):
    id: str
    provider: str = "local"
    size: str | None = None
    quant: str | None = None
    tags: list[str] | None = None
    label: str | None = None  # friendly label (optional)

@router.get("/local")
def get_local():
    return {"models": get_local_models()}

@router.post("/local")
def add_local(model: LocalModelIn):
    items = get_local_models()
    if any(m.get("id") == model.id for m in items):
        return {"ok": True, "message": "Already exists"}
    items.append(model.dict())
    save_local_models(items)
    return {"ok": True}

@router.delete("/local")
def remove_local(id: str):
    items = get_local_models()
    new_items = [m for m in items if m.get("id") != id]
    if len(new_items) == len(items):
        return {"ok": True, "message": "Not found"}
    save_local_models(new_items)
    return {"ok": True}

# /api/models/discover?q=gemma&sort=downloads&limit=20
@router.get("/discover")
def discover_models(q: str = "", sort: str = "downloads", limit: int = 100, offset: int = 0):
    """
    Proxy to Hugging Face search. sort: downloads | likes | lastModified
    Returns minimal fields needed for UI. Optimized for performance.
    """
    import requests
    
    # Get Hugging Face token
    token = _get_hf_token()
    if not token:
        raise HTTPException(401, "Hugging Face token not configured. Please add your token in Settings.")
    
    # If no search query, use the sort parameter as a filter for the whole repository
    search_query = q if q.strip() else ""
    
    params = {
        "limit": min(limit, 100),  # Cap at 100 for performance
        "offset": offset,
        "sort": {"downloads":"downloads","likes":"likes","recent":"lastModified"}.get(sort,"downloads"),
    }
    
    # Add search query if provided
    if search_query:
        params["search"] = search_query
    
    headers = {"Authorization": f"Bearer {token}"}
    print(f"HF Discover: Searching '{search_query}' with sort '{sort}', offset {offset}, limit {limit}")
    
    try:
        r = requests.get("https://huggingface.co/api/models", params=params, headers=headers, timeout=15)
        print(f"HF Discover response status: {r.status_code}")
        
        if r.status_code == 401:
            raise HTTPException(401, "Invalid Hugging Face token. Please check your token in Settings.")
        
        r.raise_for_status()
        items = []
        for m in r.json():
            # Extract model information efficiently - no additional API calls
            config = m.get("config") or {}
            tags = m.get("tags") or []
            
            # Get architecture from available data only
            arch = None
            if config.get("architectures"):
                arch = config["architectures"][0]
            elif config.get("model_type"):
                arch = config["model_type"]
            elif "transformers" in tags:
                arch = "transformers"
            
            # Get parameters from available config only (no additional API calls)
            params_count = None
            
            # Try direct parameter count first
            if config.get("num_parameters"):
                params_count = config["num_parameters"]
            
            # Try estimation from config if no direct count
            if not params_count:
                hidden_size = config.get("hidden_size")
                num_layers = config.get("num_hidden_layers")
                vocab_size = config.get("vocab_size", 50257)
                
                if hidden_size and num_layers:
                    if arch in ["gpt2", "gpt", "transformer", "llama", "mistral", "qwen"]:
                        # Transformer estimation: attention + MLP + embeddings
                        params_count = (hidden_size * hidden_size * 4 + hidden_size * vocab_size) * num_layers
                    elif arch in ["bert", "roberta", "albert"]:
                        params_count = (hidden_size * hidden_size * 4 + hidden_size * vocab_size) * num_layers
                    else:
                        # Generic transformer estimation
                        params_count = (hidden_size * hidden_size * 4 + hidden_size * vocab_size) * num_layers
                
                # Try GPT-style config (n_embd, n_layer)
                elif config.get("n_embd") and config.get("n_layer"):
                    n_embd = config["n_embd"]
                    n_layer = config["n_layer"]
                    vocab_size = config.get("vocab_size", 50257)
                    params_count = (n_embd * n_embd * 4 + n_embd * vocab_size) * n_layer
                
                # Try other common parameter fields
                elif config.get("d_model") and config.get("n_layers"):
                    d_model = config["d_model"]
                    n_layers = config["n_layers"]
                    vocab_size = config.get("vocab_size", 50257)
                    params_count = (d_model * d_model * 4 + d_model * vocab_size) * n_layers
            
            # Format parameters for display
            params_display = None
            if params_count:
                if params_count >= 1e9:
                    params_display = f"{params_count/1e9:.1f}B"
                elif params_count >= 1e6:
                    params_display = f"{params_count/1e6:.1f}M"
                elif params_count >= 1e3:
                    params_display = f"{params_count/1e3:.1f}K"
                else:
                    params_display = str(params_count)
            
            items.append({
                "id": m.get("id"),
                "label": m.get("id"),
                "provider": "local",  # becomes local once downloaded
                "params": params_display,
                "arch": arch,
                "likes": m.get("likes", 0),
                "downloads": m.get("downloads", 0),
                "lastModified": m.get("lastModified"),
                "formats": m.get("library_name") or "",
                "tags": tags[:8],
                "pipeline_tag": m.get("pipeline_tag"),
                "author": m.get("author"),
                "description": m.get("cardData", {}).get("text", "")[:200] if m.get("cardData") else ""
            })
        print(f"HF Discover: Found {len(items)} models")
        return {"results": items}
    except requests.exceptions.RequestException as e:
        print(f"HF Discover error: {e}")
        raise HTTPException(502, f"Hugging Face API error: {e}")

@router.get("/discover/details/{model_id}")
def get_model_details(model_id: str):
    """
    Get detailed information about a specific model from Hugging Face
    """
    try:
        downloader = ModelDownloader()
        model_info = downloader.get_model_info(model_id)
        requirements = downloader.check_system_requirements(model_id, model_info)
        
        return {
            **model_info,
            "requirements": requirements
        }
        
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(502, f"Failed to get model details: {e}")

class DownloadRequest(BaseModel):
    model_id: str

@router.post("/download")
def download_model(request: DownloadRequest):
    """
    Add a model to the download queue (original method)
    """
    try:
        download_id = download_queue.add_download(request.model_id)
        return {"message": "Download queued", "download_id": download_id, "model_id": request.model_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to queue download: {e}")

@router.post("/download/vllm")
def download_model_via_vllm(request: dict):
    """
    Download a model via vLLM server instead of direct Hugging Face download
    """
    model_id = request.get("model_id")
    if not model_id:
        raise HTTPException(400, "model_id is required")
    
    # Get vLLM configuration
    from app.services.config import load_config
    cfg = load_config()
    vllm_config = cfg.get("vllm", {})
    base_url = vllm_config.get("baseUrl", "http://localhost:8000")
    
    if not vllm_config.get("connected", False):
        raise HTTPException(400, "vLLM server is not connected. Please configure vLLM in Settings.")
    
    try:
        from app.services.vllm_setup import vllm_setup
        success, message = vllm_setup.download_model_via_vllm(model_id, base_url)
        
        if success:
            return {
                "success": True,
                "message": message,
                "model_id": model_id,
                "method": "vllm"
            }
        else:
            raise HTTPException(500, f"vLLM download failed: {message}")
            
    except Exception as e:
        raise HTTPException(500, f"Download request failed: {str(e)}")

@router.get("/download/status/{download_id}")
def get_download_status(download_id: str):
    """
    Get download status by download ID
    """
    try:
        download_item = download_queue.get_download_status(download_id)
        if not download_item:
            raise HTTPException(404, "Download not found")
        
        return {
            "id": download_item.id,
            "model_id": download_item.model_id,
            "status": download_item.status.value,
            "progress": download_item.progress,
            "downloaded_bytes": download_item.downloaded_bytes,
            "total_bytes": download_item.total_bytes,
            "speed": download_item.speed,
            "eta": download_item.eta,
            "error": download_item.error,
            "started_at": download_item.started_at,
            "completed_at": download_item.completed_at,
            "local_path": download_item.local_path
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to get download status: {e}")

@router.get("/download/queue")
def get_download_queue():
    """
    Get all downloads in the queue
    """
    try:
        all_downloads = download_queue.get_all_downloads()
        active_downloads = download_queue.get_active_downloads()
        completed_downloads = download_queue.get_completed_downloads()
        
        return {
            "all": [asdict(item) for item in all_downloads],
            "active": [asdict(item) for item in active_downloads],
            "completed": [asdict(item) for item in completed_downloads]
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to get download queue: {e}")

@router.post("/download/cancel/{download_id}")
def cancel_download(download_id: str):
    """
    Cancel a download
    """
    try:
        success = download_queue.cancel_download(download_id)
        if success:
            return {"message": "Download cancelled"}
        else:
            raise HTTPException(404, "Download not found or cannot be cancelled")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to cancel download: {e}")

@router.delete("/download/{download_id}")
def remove_download(download_id: str):
    """
    Remove a download from the queue
    """
    try:
        success = download_queue.remove_download(download_id)
        if success:
            return {"message": "Download removed"}
        else:
            raise HTTPException(404, "Download not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to remove download: {e}")

@router.post("/download/clear-completed")
def clear_completed_downloads():
    """
    Clear all completed downloads
    """
    try:
        count = download_queue.clear_completed()
        return {"message": f"Cleared {count} completed downloads"}
    except Exception as e:
        raise HTTPException(500, f"Failed to clear completed downloads: {e}")

@router.get("/discover/popular")
def get_popular_models(limit: int = 20, offset: int = 0):
    """
    Get popular models from Hugging Face for default display
    """
    import requests
    
    # Get Hugging Face token
    token = _get_hf_token()
    if not token:
        raise HTTPException(401, "Hugging Face token not configured. Please add your token in Settings.")
    
    params = {
        "limit": limit,
        "offset": offset,
        "sort": "downloads",
        "filter": "text-generation"  # Focus on text generation models
    }
    
    headers = {"Authorization": f"Bearer {token}"}
    print(f"HF Popular: Fetching popular models with token {token[:10]}...")
    
    try:
        r = requests.get("https://huggingface.co/api/models", params=params, headers=headers, timeout=20)
        print(f"HF Popular response status: {r.status_code}")
        
        if r.status_code == 401:
            raise HTTPException(401, "Invalid Hugging Face token. Please check your token in Settings.")
        
        r.raise_for_status()
        items = []
        for m in r.json():
            # Focus on popular text generation models
            config = m.get("config") or {}
            tags = m.get("tags") or []
            
            # Fetch detailed config if not present
            if not config or not config.get("num_parameters"):
                try:
                    model_id = m.get("id")
                    if model_id:
                        config_response = requests.get(f"https://huggingface.co/api/models/{model_id}", headers=headers, timeout=10)
                        if config_response.status_code == 200:
                            detailed_model = config_response.json()
                            detailed_config = detailed_model.get("config") or {}
                            if detailed_config:
                                config.update(detailed_config)
                                print(f"Fetched detailed config for popular model {model_id}")
                except Exception as e:
                    print(f"Failed to fetch detailed config for popular model {m.get('id')}: {e}")
            
            # Skip if not a text generation model
            if "text-generation" not in tags and "text2text-generation" not in tags:
                continue
            
            # Get architecture from multiple possible sources
            arch = None
            if config.get("architectures"):
                arch = config["architectures"][0]
            elif config.get("model_type"):
                arch = config["model_type"]
            elif "transformers" in tags:
                arch = "transformers"
            
            # Get parameters from multiple possible sources
            params_count = None
            
            # Try direct parameter count first
            if config.get("num_parameters"):
                params_count = config["num_parameters"]
                print(f"Popular Model {m.get('id')}: Direct params = {params_count}")
            
            # Try estimation from config if no direct count
            if not params_count:
                hidden_size = config.get("hidden_size")
                num_layers = config.get("num_hidden_layers")
                vocab_size = config.get("vocab_size", 50257)
                
                if hidden_size and num_layers:
                    print(f"Popular Model {m.get('id')}: Estimating params from hidden_size={hidden_size}, layers={num_layers}, vocab={vocab_size}")
                    
                    if arch in ["gpt2", "gpt", "transformer", "llama", "mistral", "qwen"]:
                        # Transformer estimation: attention + MLP + embeddings
                        params_count = (hidden_size * hidden_size * 4 + hidden_size * vocab_size) * num_layers
                    elif arch in ["bert", "roberta", "albert"]:
                        params_count = (hidden_size * hidden_size * 4 + hidden_size * vocab_size) * num_layers
                    else:
                        # Generic transformer estimation
                        params_count = (hidden_size * hidden_size * 4 + hidden_size * vocab_size) * num_layers
                
                # Try GPT-style config (n_embd, n_layer)
                elif config.get("n_embd") and config.get("n_layer"):
                    n_embd = config["n_embd"]
                    n_layer = config["n_layer"]
                    vocab_size = config.get("vocab_size", 50257)
                    print(f"Popular Model {m.get('id')}: Estimating params from n_embd={n_embd}, n_layer={n_layer}")
                    params_count = (n_embd * n_embd * 4 + n_embd * vocab_size) * n_layer
                
                # Try other common parameter fields
                elif config.get("d_model") and config.get("n_layers"):
                    d_model = config["d_model"]
                    n_layers = config["n_layers"]
                    vocab_size = config.get("vocab_size", 50257)
                    print(f"Popular Model {m.get('id')}: Estimating params from d_model={d_model}, n_layers={n_layers}")
                    params_count = (d_model * d_model * 4 + d_model * vocab_size) * n_layers
            
            # Format parameters for display
            if params_count:
                if params_count >= 1e9:
                    params_display = f"{params_count/1e9:.1f}B"
                elif params_count >= 1e6:
                    params_display = f"{params_count/1e6:.1f}M"
                elif params_count >= 1e3:
                    params_display = f"{params_count/1e3:.1f}K"
                else:
                    params_display = str(params_count)
                print(f"Popular Model {m.get('id')}: Final params = {params_count} ({params_display})")
            else:
                print(f"Popular Model {m.get('id')}: No parameters found")
                
            items.append({
                "id": m.get("id"),
                "label": m.get("id"),
                "provider": "local",  # becomes local once downloaded
                "params": params_display if params_count else None,
                "arch": arch,
                "likes": m.get("likes", 0),
                "downloads": m.get("downloads", 0),
                "lastModified": m.get("lastModified"),
                "formats": m.get("library_name") or "",
                "tags": tags[:8],
                "pipeline_tag": m.get("pipeline_tag"),
                "author": m.get("author"),
                "description": m.get("cardData", {}).get("text", "")[:200] if m.get("cardData") else ""
            })
        print(f"HF Popular: Found {len(items)} popular models")
        return {"results": items}
    except requests.exceptions.RequestException as e:
        print(f"HF Popular error: {e}")
        raise HTTPException(502, f"Hugging Face API error: {e}")

# /api/models/scan — read your configured models directory & return local models
@router.get("/scan")
def scan_local_models():
    from app.services.models import scan_models_dir
    return {"local": scan_models_dir()}

@router.get("/memory/{model_id}")
def get_model_memory_usage(model_id: str):
    """
    Get memory usage for a specific model.
    Returns GPU memory usage if the model is currently loaded, otherwise returns estimated usage.
    """
    try:
        from app.services.model_memory_tracker import model_memory_tracker
        
        # Check if we have tracking data for this model
        tracked_record = model_memory_tracker.get_current_memory_usage(model_id)
        
        # Try to get actual GPU memory usage if model is loaded
        gpu_memory_used = None
        gpu_memory_total = None
        
        # Try multiple methods to get GPU memory
        print(f"Attempting to get GPU memory for model: {model_id}")
        
        try:
            # Method 1: GPUtil (if available)
            import GPUtil
            gpus = GPUtil.getGPUs()
            print(f"GPUtil found {len(gpus)} GPUs")
            if gpus and len(gpus) > 0:
                gpu = gpus[0]  # Use first GPU
                gpu_memory_used = round(gpu.memoryUsed / 1024, 2)  # Convert MB to GB
                gpu_memory_total = round(gpu.memoryTotal / 1024, 2)  # Convert MB to GB
                print(f"GPUtil: Used {gpu_memory_used}GB / Total {gpu_memory_total}GB")
        except ImportError:
            print("GPUtil not available")
        except Exception as e:
            print(f"GPUtil error: {e}")
        
        # Method 2: nvidia-smi (if GPUtil fails)
        if gpu_memory_used is None:
            try:
                import subprocess
                print("Trying nvidia-smi...")
                result = subprocess.run(['nvidia-smi', '--query-gpu=memory.used,memory.total', 
                                       '--format=csv,noheader,nounits'], 
                                      capture_output=True, text=True, timeout=5)
                print(f"nvidia-smi return code: {result.returncode}")
                print(f"nvidia-smi stdout: {result.stdout}")
                print(f"nvidia-smi stderr: {result.stderr}")
                
                if result.returncode == 0:
                    lines = result.stdout.strip().split('\n')
                    if lines and lines[0]:
                        used_mb, total_mb = lines[0].split(', ')
                        gpu_memory_used = round(float(used_mb) / 1024, 2)  # Convert MB to GB
                        gpu_memory_total = round(float(total_mb) / 1024, 2)  # Convert MB to GB
                        print(f"nvidia-smi: Used {gpu_memory_used}GB / Total {gpu_memory_total}GB")
            except Exception as e:
                print(f"nvidia-smi error: {e}")
        
        # Method 3: Try PyTorch CUDA (if available)
        if gpu_memory_used is None:
            try:
                import torch
                print("Trying PyTorch CUDA...")
                if torch.cuda.is_available():
                    gpu_memory_used = round(torch.cuda.memory_allocated() / 1024**3, 2)  # Convert bytes to GB
                    gpu_memory_total = round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2)  # Convert bytes to GB
                    print(f"PyTorch CUDA: Used {gpu_memory_used}GB / Total {gpu_memory_total}GB")
                else:
                    print("PyTorch CUDA not available")
            except Exception as e:
                print(f"PyTorch CUDA error: {e}")
        
        # Method 4: Try Windows WMI (if on Windows)
        if gpu_memory_used is None:
            try:
                import platform
                if platform.system() == "Windows":
                    print("Trying Windows WMI...")
                    import wmi
                    c = wmi.WMI()
                    for gpu in c.Win32_VideoController():
                        if gpu.Name and "NVIDIA" in gpu.Name:
                            # WMI doesn't give real-time usage, but we can get total memory
                            if gpu.AdapterRAM:
                                gpu_memory_total = round(gpu.AdapterRAM / 1024**3, 2)
                                print(f"Windows WMI: Total {gpu_memory_total}GB (no usage data)")
                                break
            except Exception as e:
                print(f"Windows WMI error: {e}")
        
        # If we can't get actual GPU usage, estimate based on model size
        estimated_memory = None
        try:
            # Try to get model info to estimate memory usage
            downloader = ModelDownloader()
            model_info = downloader.get_model_info(model_id)
            
            if model_info.get("size"):
                size_str = model_info["size"]
                if "GB" in size_str:
                    size_gb = float(size_str.replace(" GB", ""))
                    # Estimate GPU memory needed (typically 1.5x model size)
                    estimated_memory = round(size_gb * 1.5, 2)
        except Exception as e:
            print(f"Failed to get model info for memory estimation: {e}")
        
        # Determine if model is loaded based on tracking data or GPU usage
        is_loaded = False
        if tracked_record and tracked_record.is_loaded:
            is_loaded = True
        elif gpu_memory_used is not None and gpu_memory_used > 0:
            is_loaded = True
        
        # If we have GPU memory data, use it for the response
        if gpu_memory_used is not None and gpu_memory_total is not None:
            return {
                "model_id": model_id,
                "used": gpu_memory_used,
                "total": gpu_memory_total,
                "isLoaded": is_loaded,
                "estimated": estimated_memory,
                "tracked_memory_gb": tracked_record.memory_used_gb if tracked_record else None
            }
        
        # Fallback to estimated memory if no GPU data
        return {
            "model_id": model_id,
            "used": None,
            "total": None,
            "isLoaded": is_loaded,
            "estimated": estimated_memory,
            "tracked_memory_gb": tracked_record.memory_used_gb if tracked_record else None
        }
        
    except Exception as e:
        raise HTTPException(500, f"Failed to get model memory usage: {e}")

@router.post("/memory/{model_id}/loaded")
def record_model_loaded(model_id: str, memory_used_gb: float, memory_total_gb: float):
    """
    Record that a model has been loaded with specific memory usage.
    """
    try:
        from app.services.model_memory_tracker import model_memory_tracker
        model_memory_tracker.record_model_loaded(model_id, memory_used_gb, memory_total_gb)
        return {"message": f"Recorded model {model_id} as loaded with {memory_used_gb:.2f} GB memory usage"}
    except Exception as e:
        raise HTTPException(500, f"Failed to record model loaded: {e}")

@router.post("/memory/{model_id}/unloaded")
def record_model_unloaded(model_id: str):
    """
    Record that a model has been unloaded.
    """
    try:
        from app.services.model_memory_tracker import model_memory_tracker
        model_memory_tracker.record_model_unloaded(model_id)
        return {"message": f"Recorded model {model_id} as unloaded"}
    except Exception as e:
        raise HTTPException(500, f"Failed to record model unloaded: {e}")

@router.get("/memory/tracking/history/{model_id}")
def get_model_memory_history(model_id: str, limit: int = 50):
    """
    Get memory usage history for a specific model.
    """
    try:
        from app.services.model_memory_tracker import model_memory_tracker
        history = model_memory_tracker.get_memory_history(model_id, limit)
        return {"model_id": model_id, "history": history}
    except Exception as e:
        raise HTTPException(500, f"Failed to get model memory history: {e}")

@router.get("/memory/tracking/current")
def get_current_loaded_models():
    """
    Get all currently loaded models with their memory usage.
    """
    try:
        from app.services.model_memory_tracker import model_memory_tracker
        current_models = model_memory_tracker.get_all_current_models()
        return {"loaded_models": current_models}
    except Exception as e:
        raise HTTPException(500, f"Failed to get current loaded models: {e}")

@router.get("/memory/debug")
def debug_gpu_memory():
    """
    Debug endpoint to test GPU memory detection methods
    """
    try:
        results = {
            "gputil": None,
            "nvidia_smi": None,
            "pytorch_cuda": None,
            "windows_wmi": None,
            "platform": None
        }
        
        import platform
        results["platform"] = {
            "system": platform.system(),
            "machine": platform.machine(),
            "processor": platform.processor()
        }
        
        # Test GPUtil
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                results["gputil"] = {
                    "available": True,
                    "gpu_count": len(gpus),
                    "gpu_name": gpu.name,
                    "memory_used_mb": gpu.memoryUsed,
                    "memory_total_mb": gpu.memoryTotal,
                    "memory_used_gb": round(gpu.memoryUsed / 1024, 2),
                    "memory_total_gb": round(gpu.memoryTotal / 1024, 2)
                }
            else:
                results["gputil"] = {"available": True, "gpu_count": 0}
        except ImportError:
            results["gputil"] = {"available": False, "error": "GPUtil not installed"}
        except Exception as e:
            results["gputil"] = {"available": False, "error": str(e)}
        
        # Test nvidia-smi
        try:
            import subprocess
            result = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.used,memory.total', 
                                   '--format=csv,noheader,nounits'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                if lines and lines[0]:
                    parts = lines[0].split(', ')
                    if len(parts) >= 3:
                        results["nvidia_smi"] = {
                            "available": True,
                            "gpu_name": parts[0],
                            "memory_used_mb": int(parts[1]),
                            "memory_total_mb": int(parts[2]),
                            "memory_used_gb": round(int(parts[1]) / 1024, 2),
                            "memory_total_gb": round(int(parts[2]) / 1024, 2)
                        }
                    else:
                        results["nvidia_smi"] = {"available": True, "error": "Unexpected output format"}
                else:
                    results["nvidia_smi"] = {"available": True, "error": "No GPU data"}
            else:
                results["nvidia_smi"] = {
                    "available": False, 
                    "error": f"nvidia-smi failed with code {result.returncode}",
                    "stderr": result.stderr
                }
        except FileNotFoundError:
            results["nvidia_smi"] = {"available": False, "error": "nvidia-smi not found"}
        except Exception as e:
            results["nvidia_smi"] = {"available": False, "error": str(e)}
        
        # Test PyTorch CUDA
        try:
            import torch
            if torch.cuda.is_available():
                device_count = torch.cuda.device_count()
                if device_count > 0:
                    device = torch.cuda.get_device_properties(0)
                    results["pytorch_cuda"] = {
                        "available": True,
                        "device_count": device_count,
                        "device_name": device.name,
                        "memory_total_bytes": device.total_memory,
                        "memory_total_gb": round(device.total_memory / 1024**3, 2),
                        "memory_allocated_bytes": torch.cuda.memory_allocated(),
                        "memory_allocated_gb": round(torch.cuda.memory_allocated() / 1024**3, 2)
                    }
                else:
                    results["pytorch_cuda"] = {"available": True, "device_count": 0}
            else:
                results["pytorch_cuda"] = {"available": False, "error": "CUDA not available"}
        except ImportError:
            results["pytorch_cuda"] = {"available": False, "error": "PyTorch not installed"}
        except Exception as e:
            results["pytorch_cuda"] = {"available": False, "error": str(e)}
        
        # Test Windows WMI
        if platform.system() == "Windows":
            try:
                import wmi
                c = wmi.WMI()
                gpus = []
                for gpu in c.Win32_VideoController():
                    if gpu.Name:
                        gpu_info = {
                            "name": gpu.Name,
                            "adapter_ram_bytes": gpu.AdapterRAM,
                            "adapter_ram_gb": round(gpu.AdapterRAM / 1024**3, 2) if gpu.AdapterRAM else None
                        }
                        gpus.append(gpu_info)
                results["windows_wmi"] = {
                    "available": True,
                    "gpus": gpus
                }
            except ImportError:
                results["windows_wmi"] = {"available": False, "error": "WMI not available"}
            except Exception as e:
                results["windows_wmi"] = {"available": False, "error": str(e)}
        else:
            results["windows_wmi"] = {"available": False, "error": "Not Windows"}
        
        return results
        
    except Exception as e:
        raise HTTPException(500, f"Failed to debug GPU memory: {e}")

# /api/models/add-local (POST) — register a local model (e.g., after user downloads)
class AddLocalIn(BaseModel):
    id: str
    path: str
    size: str | None = None
    quant: str | None = None
    label: str | None = None

@router.post("/add-local")
def add_local(m: AddLocalIn):
    from ..services.models import register_local_model
    register_local_model(m.model_dump())
    return {"ok": True}

# ---------- visibility persistence ----------
@router.get("/visibility")
def get_visibility():
    ids = load_enabled_ids()
    return {"enabled_ids": ids}

@router.post("/load/{model_id}")
def load_model_in_provider(model_id: str):
    """
    Load a model in the appropriate provider (LM Studio, Ollama, vLLM, etc.)
    """
    try:
        from app.services.config import load_config
        cfg = load_config()
        
        # Determine which provider to use based on model_id prefix or configuration
        provider = None
        base_url = None
        
        if model_id.startswith("lmstudio/"):
            provider = "lmstudio"
            lm_cfg = cfg.get("lmstudio", {})
            base_url = lm_cfg.get("baseUrl")
        elif model_id.startswith("ollama/"):
            provider = "ollama"
            ol_cfg = cfg.get("ollama", {})
            base_url = ol_cfg.get("baseUrl")
        elif model_id.startswith("vllm/"):
            provider = "vllm"
            vllm_cfg = cfg.get("vllm", {})
            base_url = vllm_cfg.get("baseUrl")
        else:
            # For local models, try to determine the best provider
            # Check which providers are available and connected
            lm_cfg = cfg.get("lmstudio", {})
            ol_cfg = cfg.get("ollama", {})
            vllm_cfg = cfg.get("vllm", {})
            
            if lm_cfg.get("connected"):
                provider = "lmstudio"
                base_url = lm_cfg.get("baseUrl")
            elif ol_cfg.get("connected"):
                provider = "ollama"
                base_url = ol_cfg.get("baseUrl")
            elif vllm_cfg.get("connected"):
                provider = "vllm"
                base_url = vllm_cfg.get("baseUrl")
        
        if not provider or not base_url:
            raise HTTPException(400, f"No suitable provider found for model {model_id}. Please configure LM Studio, Ollama, or vLLM in Settings.")
        
        # Load the model based on provider
        if provider == "lmstudio":
            return load_model_in_lmstudio(model_id, base_url)
        elif provider == "ollama":
            return load_model_in_ollama(model_id, base_url)
        elif provider == "vllm":
            return load_model_in_vllm(model_id, base_url)
        else:
            raise HTTPException(400, f"Unsupported provider: {provider}")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to load model: {e}")

@router.post("/unload/{model_id}")
def unload_model_from_provider(model_id: str):
    """
    Unload a model from the appropriate provider (LM Studio, Ollama, vLLM, etc.)
    """
    try:
        from app.services.config import load_config
        cfg = load_config()
        
        # Determine which provider to use based on model_id prefix or configuration
        provider = None
        base_url = None
        
        if model_id.startswith("lmstudio/"):
            provider = "lmstudio"
            lm_cfg = cfg.get("lmstudio", {})
            base_url = lm_cfg.get("baseUrl")
        elif model_id.startswith("ollama/"):
            provider = "ollama"
            ol_cfg = cfg.get("ollama", {})
            base_url = ol_cfg.get("baseUrl")
        elif model_id.startswith("vllm/"):
            provider = "vllm"
            vllm_cfg = cfg.get("vllm", {})
            base_url = vllm_cfg.get("baseUrl")
        else:
            # For local models, try to determine the best provider
            # Check which providers are available and connected
            lm_cfg = cfg.get("lmstudio", {})
            ol_cfg = cfg.get("ollama", {})
            vllm_cfg = cfg.get("vllm", {})
            
            if lm_cfg.get("connected"):
                provider = "lmstudio"
                base_url = lm_cfg.get("baseUrl")
            elif ol_cfg.get("connected"):
                provider = "ollama"
                base_url = ol_cfg.get("baseUrl")
            elif vllm_cfg.get("connected"):
                provider = "vllm"
                base_url = vllm_cfg.get("baseUrl")
        
        if not provider or not base_url:
            raise HTTPException(400, f"No suitable provider found for model {model_id}. Please configure LM Studio, Ollama, or vLLM in Settings.")
        
        # Unload the model based on provider
        if provider == "lmstudio":
            return unload_model_from_lmstudio(model_id, base_url)
        elif provider == "ollama":
            return unload_model_from_ollama(model_id, base_url)
        elif provider == "vllm":
            return unload_model_from_vllm(model_id, base_url)
        else:
            raise HTTPException(400, f"Unsupported provider: {provider}")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to unload model: {e}")

@router.get("/load/{model_id}/progress")
def get_model_load_progress(model_id: str):
    """
    Get the loading progress of a model
    """
    try:
        from app.services.model_memory_tracker import model_memory_tracker
        
        # Check if model is currently loading
        tracked_record = model_memory_tracker.get_current_memory_usage(model_id)
        
        if tracked_record and tracked_record.is_loaded:
            return {
                "model_id": model_id,
                "status": "loaded",
                "progress": 100,
                "message": "Model is loaded and ready"
            }
        else:
            # Check if model is available in any provider
            from app.services.config import load_config
            cfg = load_config()
            
            providers_status = {}
            
            # Check LM Studio
            lm_cfg = cfg.get("lmstudio", {})
            if lm_cfg.get("baseUrl"):
                try:
                    response = requests.get(f"{lm_cfg['baseUrl'].rstrip('/')}/v1/models", timeout=5)
                    if response.status_code == 200:
                        models = response.json().get("data", [])
                        model_names = [m.get("id") for m in models]
                        clean_id = model_id.replace("lmstudio/", "")
                        providers_status["lmstudio"] = {
                            "available": clean_id in model_names,
                            "connected": True
                        }
                except:
                    providers_status["lmstudio"] = {"available": False, "connected": False}
            
            # Check Ollama
            ol_cfg = cfg.get("ollama", {})
            if ol_cfg.get("baseUrl"):
                try:
                    response = requests.get(f"{ol_cfg['baseUrl'].rstrip('/')}/api/tags", timeout=5)
                    if response.status_code == 200:
                        models_data = response.json()
                        model_names = [m.get("name") for m in models_data.get("models", [])]
                        clean_id = model_id.replace("ollama/", "")
                        providers_status["ollama"] = {
                            "available": clean_id in model_names,
                            "connected": True
                        }
                except:
                    providers_status["ollama"] = {"available": False, "connected": False}
            
            # Check vLLM
            vllm_cfg = cfg.get("vllm", {})
            if vllm_cfg.get("baseUrl"):
                try:
                    response = requests.get(f"{vllm_cfg['baseUrl'].rstrip('/')}/v1/models", timeout=5)
                    if response.status_code == 200:
                        models = response.json().get("data", [])
                        model_names = [m.get("id") for m in models]
                        clean_id = model_id.replace("vllm/", "")
                        providers_status["vllm"] = {
                            "available": clean_id in model_names,
                            "connected": True
                        }
                except:
                    providers_status["vllm"] = {"available": False, "connected": False}
            
            # Determine status
            available_providers = [p for p, status in providers_status.items() if status.get("available")]
            
            if available_providers:
                return {
                    "model_id": model_id,
                    "status": "available",
                    "progress": 0,
                    "message": f"Model is available in {', '.join(available_providers)} but not loaded",
                    "providers": providers_status
                }
            else:
                return {
                    "model_id": model_id,
                    "status": "not_found",
                    "progress": 0,
                    "message": "Model not found in any connected provider",
                    "providers": providers_status
                }
        
    except Exception as e:
        raise HTTPException(500, f"Failed to get model load progress: {e}")

def unload_model_from_lmstudio(model_id: str, base_url: str):
    """Unload model from LM Studio"""
    try:
        # Remove lmstudio/ prefix if present
        clean_model_id = model_id.replace("lmstudio/", "")
        
        # LM Studio doesn't have a direct unload API, but we can try to stop the server
        # or just return success since the model will be unloaded when the server stops
        return {
            "success": True,
            "message": f"Model {clean_model_id} unloaded from LM Studio (server may need restart)",
            "provider": "lmstudio",
            "model_id": clean_model_id
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to unload model from LM Studio: {str(e)}",
            "provider": "lmstudio",
            "model_id": clean_model_id
        }

def unload_model_from_ollama(model_id: str, base_url: str):
    """Unload model from Ollama"""
    try:
        # Remove ollama/ prefix if present
        clean_model_id = model_id.replace("ollama/", "")
        
        # Get Ollama configuration for API key
        from app.services.config import load_config
        cfg = load_config()
        ol_cfg = cfg.get("ollama", {})
        
        headers = {}
        if ol_cfg.get("apiKey"):
            headers["Authorization"] = f"Bearer {ol_cfg['apiKey']}"
        
        # Ollama doesn't have a direct unload API, but we can try to stop the model
        # by making a request to stop any running generation
        try:
            stop_url = f"{base_url.rstrip('/')}/api/generate"
            stop_data = {"model": clean_model_id, "prompt": "", "stream": False}
            response = requests.post(stop_url, json=stop_data, timeout=5, headers=headers)
            
            return {
                "success": True,
                "message": f"Model {clean_model_id} unloaded from Ollama",
                "provider": "ollama",
                "model_id": clean_model_id
            }
        except:
            return {
                "success": True,
                "message": f"Model {clean_model_id} unloaded from Ollama (may still be in memory)",
                "provider": "ollama",
                "model_id": clean_model_id
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to unload model from Ollama: {str(e)}",
            "provider": "ollama",
            "model_id": clean_model_id
        }

def unload_model_from_vllm(model_id: str, base_url: str):
    """Unload model from vLLM"""
    try:
        # Remove vllm/ prefix if present
        clean_model_id = model_id.replace("vllm/", "")
        
        # vLLM doesn't have a direct unload API, but we can try to stop the server
        return {
            "success": True,
            "message": f"Model {clean_model_id} unloaded from vLLM (server may need restart)",
            "provider": "vllm",
            "model_id": clean_model_id
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to unload model from vLLM: {str(e)}",
            "provider": "vllm",
            "model_id": clean_model_id
        }

def load_model_in_lmstudio(model_id: str, base_url: str):
    """Load model in LM Studio"""
    try:
        # Remove lmstudio/ prefix if present
        clean_model_id = model_id.replace("lmstudio/", "")
        
        # LM Studio uses OpenAI-compatible API
        # First check if the model is available
        response = requests.get(f"{base_url.rstrip('/')}/v1/models", timeout=10)
        if response.status_code == 200:
            models = response.json().get("data", [])
            model_names = [m.get("id") for m in models]
            
            if clean_model_id in model_names:
                # Try to trigger model loading by making a chat completion request
                # This will cause LM Studio to load the model if it's not already loaded
                try:
                    load_response = requests.post(
                        f"{base_url.rstrip('/')}/v1/chat/completions",
                        json={
                            "model": clean_model_id,
                            "messages": [{"role": "user", "content": "Hello"}],
                            "max_tokens": 1,
                            "temperature": 0.1
                        },
                        timeout=30
                    )
                    
                    if load_response.status_code == 200:
                        return {
                            "success": True,
                            "message": f"Model {clean_model_id} loaded successfully in LM Studio",
                            "provider": "lmstudio",
                            "model_id": clean_model_id
                        }
                    else:
                        return {
                            "success": False,
                            "message": f"Failed to load model {clean_model_id} in LM Studio. Status: {load_response.status_code}",
                            "provider": "lmstudio",
                            "model_id": clean_model_id
                        }
                except requests.exceptions.Timeout:
                    return {
                        "success": True,
                        "message": f"Model {clean_model_id} loading started in LM Studio (may take time)",
                        "provider": "lmstudio",
                        "model_id": clean_model_id
                    }
                except Exception as e:
                    return {
                        "success": False,
                        "message": f"Failed to trigger model loading: {str(e)}",
                        "provider": "lmstudio",
                        "model_id": clean_model_id
                    }
            else:
                return {
                    "success": False,
                    "message": f"Model {clean_model_id} not found in LM Studio. Available models: {', '.join(model_names[:5])}",
                    "provider": "lmstudio",
                    "model_id": clean_model_id
                }
        else:
            raise HTTPException(502, f"LM Studio not responding: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Failed to connect to LM Studio: {e}")

def load_model_in_ollama(model_id: str, base_url: str):
    """Load model in Ollama"""
    try:
        # Remove ollama/ prefix if present
        clean_model_id = model_id.replace("ollama/", "")
        
        # Get Ollama configuration for API key
        from app.services.config import load_config
        cfg = load_config()
        ol_cfg = cfg.get("ollama", {})
        
        headers = {}
        if ol_cfg.get("apiKey"):
            headers["Authorization"] = f"Bearer {ol_cfg['apiKey']}"
        
        # Ollama has a specific API for pulling/loading models
        pull_url = f"{base_url.rstrip('/')}/api/pull"
        pull_data = {"name": clean_model_id}
        
        # Start the pull process
        response = requests.post(pull_url, json=pull_data, timeout=30, headers=headers)
        if response.status_code == 200:
            return {
                "success": True,
                "message": f"Model {clean_model_id} pull started in Ollama",
                "provider": "ollama",
                "model_id": clean_model_id
            }
        else:
            # Check if model is already available
            models_url = f"{base_url.rstrip('/')}/api/tags"
            models_response = requests.get(models_url, timeout=10, headers=headers)
            if models_response.status_code == 200:
                models_data = models_response.json()
                model_names = [m.get("name") for m in models_data.get("models", [])]
                if clean_model_id in model_names:
                    return {
                        "success": True,
                        "message": f"Model {clean_model_id} is already available in Ollama",
                        "provider": "ollama",
                        "model_id": clean_model_id
                    }
            
            raise HTTPException(502, f"Failed to pull model in Ollama: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Failed to connect to Ollama: {e}")

def load_model_in_vllm(model_id: str, base_url: str):
    """Load model in vLLM"""
    try:
        # Remove vllm/ prefix if present
        clean_model_id = model_id.replace("vllm/", "")
        
        # vLLM automatically loads models when first requested
        # We can check if it's available
        response = requests.get(f"{base_url.rstrip('/')}/v1/models", timeout=10)
        if response.status_code == 200:
            models = response.json().get("data", [])
            model_names = [m.get("id") for m in models]
            
            if clean_model_id in model_names:
                return {
                    "success": True,
                    "message": f"Model {clean_model_id} is available in vLLM",
                    "provider": "vllm",
                    "model_id": clean_model_id
                }
            else:
                # Try to trigger model loading by making a request
                # vLLM will download the model if it's not available
                try:
                    from app.services.vllm_setup import vllm_setup
                    success, message = vllm_setup.download_model_via_vllm(clean_model_id, base_url)
                    return {
                        "success": success,
                        "message": message,
                        "provider": "vllm",
                        "model_id": clean_model_id
                    }
                except Exception as e:
                    return {
                        "success": False,
                        "message": f"Model {clean_model_id} not found in vLLM and failed to download: {e}",
                        "provider": "vllm",
                        "model_id": clean_model_id
                    }
        else:
            raise HTTPException(502, f"vLLM not responding: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Failed to connect to vLLM: {e}")

@router.get("/load/{model_id}")
def get_model_load_status(model_id: str):
    """
    Get the load status of a model in its provider
    """
    try:
        from app.services.config import load_config
        cfg = load_config()
        
        # Check all providers for the model
        status = {
            "model_id": model_id,
            "providers": {}
        }
        
        # Check LM Studio
        lm_cfg = cfg.get("lmstudio", {})
        if lm_cfg.get("baseUrl"):
            try:
                response = requests.get(f"{lm_cfg['baseUrl'].rstrip('/')}/v1/models", timeout=5)
                if response.status_code == 200:
                    models = response.json().get("data", [])
                    model_names = [m.get("id") for m in models]
                    clean_id = model_id.replace("lmstudio/", "")
                    status["providers"]["lmstudio"] = {
                        "available": clean_id in model_names,
                        "connected": True
                    }
                else:
                    status["providers"]["lmstudio"] = {"available": False, "connected": False}
            except:
                status["providers"]["lmstudio"] = {"available": False, "connected": False}
        
        # Check Ollama
        ol_cfg = cfg.get("ollama", {})
        if ol_cfg.get("baseUrl"):
            try:
                response = requests.get(f"{ol_cfg['baseUrl'].rstrip('/')}/api/tags", timeout=5)
                if response.status_code == 200:
                    models_data = response.json()
                    model_names = [m.get("name") for m in models_data.get("models", [])]
                    clean_id = model_id.replace("ollama/", "")
                    status["providers"]["ollama"] = {
                        "available": clean_id in model_names,
                        "connected": True
                    }
                else:
                    status["providers"]["ollama"] = {"available": False, "connected": False}
            except:
                status["providers"]["ollama"] = {"available": False, "connected": False}
        
        # Check vLLM
        vllm_cfg = cfg.get("vllm", {})
        if vllm_cfg.get("baseUrl"):
            try:
                response = requests.get(f"{vllm_cfg['baseUrl'].rstrip('/')}/v1/models", timeout=5)
                if response.status_code == 200:
                    models = response.json().get("data", [])
                    model_names = [m.get("id") for m in models]
                    clean_id = model_id.replace("vllm/", "")
                    status["providers"]["vllm"] = {
                        "available": clean_id in model_names,
                        "connected": True
                    }
                else:
                    status["providers"]["vllm"] = {"available": False, "connected": False}
            except:
                status["providers"]["vllm"] = {"available": False, "connected": False}
        
        return status
        
    except Exception as e:
        raise HTTPException(500, f"Failed to get model load status: {e}")

@router.post("/visibility")
def set_visibility(payload: dict):
    ids = payload.get("enabled_ids", None)
    if ids is not None and not isinstance(ids, list):
        raise HTTPException(400, "enabled_ids must be a list or null")
    save_enabled_ids(ids)
    return {"ok": True}