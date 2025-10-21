# backend/app/routers/models.py
import os, requests
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.models import scan_models_dir as get_local_models, save_local_models, get_groq_models
from app.services.models_visibility import load_enabled_ids, save_enabled_ids

router = APIRouter()

# ---------- listing ----------
@router.get("/list")
def list_models(include_groq: bool = True):
    local = get_local_models()
    warn, groq = get_groq_models() if include_groq else (None, [])
    return {"local": local, "groq": groq, "warning": warn}

@router.get("/classified")
def get_classified_models(include_groq: bool = True):
    """
    Return models with classification metadata including categories, publishers, etc.
    """
    from app.services.model_classifier import classify_models
    
    # Get local models
    local_models = get_local_models()
    local_classified = classify_models(local_models)
    
    # Get Groq models
    warn, groq_models = get_groq_models() if include_groq else (None, [])
    
    # Combine all models
    all_models = local_classified + groq_models
    
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
def discover_models(q: str = "", sort: str = "downloads", limit: int = 20, offset: int = 0):
    """
    Proxy to Hugging Face search. sort: downloads | likes | lastModified
    Returns minimal fields needed for UI.
    """
    import requests
    
    # Get Hugging Face token
    token = _get_hf_token()
    if not token:
        raise HTTPException(401, "Hugging Face token not configured. Please add your token in Settings.")
    
    # If no search query, use the sort parameter as a filter for the whole repository
    search_query = q if q.strip() else ""
    
    params = {
        "limit": limit,
        "offset": offset,
        "sort": {"downloads":"downloads","likes":"likes","recent":"lastModified"}.get(sort,"downloads"),
    }
    
    # Add search query if provided
    if search_query:
        params["search"] = search_query
    
    headers = {"Authorization": f"Bearer {token}"}
    print(f"HF Discover: Searching '{search_query}' with sort '{sort}', offset {offset}, limit {limit}")
    
    try:
        r = requests.get("https://huggingface.co/api/models", params=params, headers=headers, timeout=20)
        print(f"HF Discover response status: {r.status_code}")
        
        if r.status_code == 401:
            raise HTTPException(401, "Invalid Hugging Face token. Please check your token in Settings.")
        
        r.raise_for_status()
        items = []
        for m in r.json():
            # Extract model information more thoroughly
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
                                print(f"Fetched detailed config for {model_id}")
                except Exception as e:
                    print(f"Failed to fetch detailed config for {m.get('id')}: {e}")
            
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
                print(f"Model {m.get('id')}: Direct params = {params_count}")
            
            # Try estimation from config if no direct count
            if not params_count:
                hidden_size = config.get("hidden_size")
                num_layers = config.get("num_hidden_layers")
                vocab_size = config.get("vocab_size", 50257)
                
                if hidden_size and num_layers:
                    print(f"Model {m.get('id')}: Estimating params from hidden_size={hidden_size}, layers={num_layers}, vocab={vocab_size}")
                    
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
                    print(f"Model {m.get('id')}: Estimating params from n_embd={n_embd}, n_layer={n_layer}")
                    params_count = (n_embd * n_embd * 4 + n_embd * vocab_size) * n_layer
                
                # Try other common parameter fields
                elif config.get("d_model") and config.get("n_layers"):
                    d_model = config["d_model"]
                    n_layers = config["n_layers"]
                    vocab_size = config.get("vocab_size", 50257)
                    print(f"Model {m.get('id')}: Estimating params from d_model={d_model}, n_layers={n_layers}")
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
                print(f"Model {m.get('id')}: Final params = {params_count} ({params_display})")
            else:
                print(f"Model {m.get('id')}: No parameters found")
            
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
        print(f"HF Discover: Found {len(items)} models")
        return {"results": items}
    except requests.exceptions.RequestException as e:
        print(f"HF Discover error: {e}")
        raise HTTPException(502, f"Hugging Face API error: {e}")

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

@router.post("/visibility")
def set_visibility(payload: dict):
    ids = payload.get("enabled_ids", None)
    if ids is not None and not isinstance(ids, list):
        raise HTTPException(400, "enabled_ids must be a list or null")
    save_enabled_ids(ids)
    return {"ok": True}