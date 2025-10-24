# backend/app/services/models.py
import os, json, pathlib, requests, re 
from pathlib import Path

# Get the backend directory and create absolute path to data directory
BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/
DATA_DIR = BACKEND_DIR / "data"
REG_PATH = DATA_DIR / "models_registry.json"  # absolute path to registry

def detect_api_key_usage(provider_name: str) -> bool:
    """
    Detect if a provider is using an API key, indicating cloud access.
    This is a general function that can be used for any provider.
    """
    from app.services.config import load_config
    
    # Check environment variables first
    env_key_patterns = [
        f"{provider_name.upper()}_API_KEY",
        f"{provider_name.upper()}_TOKEN",
        f"{provider_name.upper()}_KEY"
    ]
    
    for pattern in env_key_patterns:
        if os.getenv(pattern):
            return True
    
    # Check config file
    try:
        cfg = load_config()
        provider_config = cfg.get(provider_name.lower(), {})
        
        # Check common API key field names
        api_key_fields = ["apiKey", "token", "key", "api_key"]
        for field in api_key_fields:
            if provider_config.get(field):
                return True
    except:
        pass
    
    return False

def _infer_tags_from_id(mid: str):
    tags = []
    # provider/arch guesses (works well enough for catalog)
    if "mixtral" in mid:   tags += ["mistral", "mixtral"]
    if "mistral" in mid:   tags += ["mistral"]
    if "qwen" in mid:      tags += ["qwen"]
    if "llama" in mid or "meta-llama" in mid: tags += ["llama"]
    if "gemma" in mid:     tags += ["gemma"]
    # params
    m = re.search(r"(\d+)\s*(b|B)(?=[^a-zA-Z]|$)", mid)
    if m: tags += [f"{m.group(1)}B"]
    # instruct/coder/etc
    if "instruct" in mid:  tags += ["instruct"]
    if "coder" in mid:     tags += ["coder"]
    if "chat" in mid:      tags += ["chat"]
    if "vision" in mid or "vl" in mid: tags += ["vision"]
    return list(dict.fromkeys(tags))  # de-dup, keep order

def _infer_quant_from_name(name: str):
    m = re.search(r"(Q\d(?:_[A-Z])?(?:_[A-Z])?)", name.upper())
    return m.group(1) if m else None

def _load():
    if REG_PATH.exists():
        try:
            content = REG_PATH.read_text("utf-8")
            if not content.strip():  # Handle empty file
                return {"local": []}
            return json.loads(content)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            # If file is corrupted, return default and log the error
            print(f"Warning: Failed to load models registry: {e}")
            return {"local": []}
    return {"local": []}

def _save(d):
    import tempfile
    import os
    try:
        REG_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Write to a temporary file in the same directory to avoid cross-device issues
        temp_fd, temp_path = tempfile.mkstemp(suffix='.tmp', dir=REG_PATH.parent)
        try:
            with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                json.dump(d, f, indent=2)
            # Atomic rename - improved Windows handling
            temp_path_obj = Path(temp_path)
            if os.name == 'nt':  # Windows
                # On Windows, we need to handle the case where the target file might be locked
                if REG_PATH.exists():
                    try:
                        REG_PATH.unlink()
                    except PermissionError:
                        # If we can't delete the existing file, try to overwrite it directly
                        temp_path_obj.replace(REG_PATH)
                        return
                # Try atomic rename
                try:
                    temp_path_obj.replace(REG_PATH)
                except PermissionError:
                    # Fallback: copy content and delete temp file
                    REG_PATH.write_text(json.dumps(d, indent=2), encoding='utf-8')
                    temp_path_obj.unlink()
            else:
                # Unix-like systems
                temp_path_obj.replace(REG_PATH)
        except Exception as e:
            # Clean up temp file if something went wrong
            try:
                os.unlink(temp_path)
            except:
                pass
            raise e
    except Exception as e:
        print(f"Warning: Failed to save models registry: {e}")
        # Try a simpler approach as fallback
        try:
            REG_PATH.write_text(json.dumps(d, indent=2), encoding='utf-8')
        except Exception as fallback_error:
            print(f"Warning: Fallback save also failed: {fallback_error}")

def register_local_model(m):
    reg = _load()
    # upsert by id
    idx = next((i for i,x in enumerate(reg["local"]) if x["id"] == m["id"]), -1)
    if idx >= 0: reg["local"][idx].update(m)
    else: reg["local"].append(m)
    _save(reg)

import os, json
from pathlib import Path
import requests

DATA = Path(__file__).resolve().parent.parent.parent / "data"
DATA.mkdir(parents=True, exist_ok=True)
LOCAL_REG = DATA / "local_models.json"

def save_local_models(models):
    LOCAL_REG.write_text(json.dumps(models, indent=2), encoding="utf-8")

def get_ollama_cloud_models():
    """
    Return (warning_dict_or_None, models_list).
    Uses Ollama's cloud API:
      GET https://ollama.com/api/tags
    """
    from app.services.model_classifier import classify_models
    from app.services.config import load_config
    
    # Try to get API key from environment first, then from config
    key = os.getenv("OLLAMA_API_KEY")
    print(f"Environment OLLAMA_API_KEY present: {bool(key)}")
    if not key:
        # Fallback to config file
        print("Environment key not found, reading from config file")
        cfg = load_config()
        key = cfg.get("ollama", {}).get("apiKey", "")
        print(f"Config file key present: {bool(key)}")
    else:
        print("Using environment variable for API key")
    
    print(f"Getting Ollama cloud models, API key present: {bool(key)}")
    if key:
        print(f"API key length: {len(key)}")
        print(f"API key starts with: {key[:10]}...")
        print(f"API key ends with: ...{key[-10:]}")
    
    if not key:
        return {"error": "OLLAMA_API_KEY not set"}, []

    url = "https://ollama.com/api/tags"
    headers = {"Authorization": f"Bearer {key}"}
    
    # Try to get more models by adding query parameters
    params = {}
    # Some APIs support limit parameter
    params["limit"] = 100

    try:
        print(f"Making request to Ollama cloud models API: {url}")
        r = requests.get(url, headers=headers, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        print(f"Ollama cloud API returned {len(data.get('models', []))} models")
        
        models = []
        for model in data.get("models", []):
            model_name = model.get("name", "")
            if model_name:
                models.append({
                    "id": f"ollama-cloud/{model_name}",
                    "label": f"{model_name} (Cloud)",
                    "tags": ["ollama", "ollama-cloud", "cloud"],
                    "size": model.get("size", 0),
                    "modified_at": model.get("modified_at", ""),
                    "details": model.get("details", {}),
                })
        
        # Classify models for additional metadata
        classified_models = classify_models(models)
        
        return None, classified_models
        
    except requests.exceptions.HTTPError as e:
        print(f"Ollama cloud models API HTTP error: {e}")
        if e.response.status_code == 401:
            return {"error": "Invalid Ollama API key"}, []
        elif e.response.status_code == 403:
            return {"error": "Ollama API key does not have permission to access models"}, []
        else:
            return {"error": f"Ollama cloud API HTTP error: {e.response.status_code}"}, []
    except Exception as e:
        print(f"Ollama cloud models API error: {e}")
        return {"error": f"Ollama cloud API error: {str(e)}"}, []

def get_groq_models():
    """
    Return (warning_dict_or_None, models_list).
    Uses Groq's OpenAI-compatible API:
      GET https://api.groq.com/openai/v1/models
    """
    from app.services.model_classifier import classify_models
    from app.services.config import load_config
    
    # Try to get API key from environment first, then from config
    key = os.getenv("GROQ_API_KEY")
    print(f"Environment GROQ_API_KEY present: {bool(key)}")
    if not key:
        # Fallback to config file
        print("Environment key not found, reading from config file")
        cfg = load_config()
        key = cfg.get("groq", {}).get("apiKey", "")
        print(f"Config file key present: {bool(key)}")
    else:
        print("Using environment variable for API key")
    
    print(f"Getting Groq models, API key present: {bool(key)}")
    if key:
        print(f"API key length: {len(key)}")
        print(f"API key starts with: {key[:10]}...")
        print(f"API key ends with: ...{key[-10:]}")
    
    if not key:
        return {"error": "GROQ_API_KEY not set"}, []

    url = "https://api.groq.com/openai/v1/models"
    headers = {"Authorization": f"Bearer {key}"}

    try:
        print(f"Making request to Groq models API: {url}")
        r = requests.get(url, headers=headers, timeout=20)
        r.raise_for_status()
        payload = r.json() or {}
        data = payload.get("data", [])  # OpenAI format
        print(f"Groq API returned {len(data)} models")
        for m in data[:3]:  # Print first 3 models for debugging
            print(f"  Model: {m.get('id')}")
        
        # Filter out non-chat models (like whisper, embedding models, etc.)
        # Do not filter out any Groq models; return all of them so the UI can decide usage
        mapped = []
        for m in data:
            mid = m.get("id")
            if not mid:
                continue
            mapped.append({
                "id": mid,
                # use id as label; frontend prettifies when needed
                "label": mid,
                "provider": "groq",
                "source": "groq",  # Explicitly set source to groq
                # mark as hosted so UI can suppress size if desired
                "size": "hosted",
                "tags": ["groq", "cloud"],  # Groq always requires API key, so always cloud
            })

        # Classify the models (adds convenience tags/categories)
        classified_models = classify_models(mapped)
        
        # Ensure Groq models maintain their cloud tags and don't get "local" tags
        # Use general API key detection for cloud tagging
        is_cloud_provider = detect_api_key_usage("groq")
        
        for model in classified_models:
            if model.get("provider") == "groq":
                # Ensure cloud tag is present and no local tags
                tags = model.get("tags", [])
                if is_cloud_provider and "cloud" not in tags:
                    tags.append("cloud")
                if "local" in tags:
                    tags.remove("local")
                model["tags"] = tags
                model["source"] = "groq"  # Ensure source stays as groq
        
        return None, classified_models
    except requests.HTTPError as e:
        print(f"Groq models API HTTP error: {e}")
        print(f"Response status: {e.response.status_code}")
        print(f"Response text: {e.response.text}")
        # Keep the app usable and surface a clear message in the UI
        return {"error": f"HTTP {getattr(e.response,'status_code', '?')}"}, []
    except Exception as e:
        print(f"Groq models API error: {e}")
        return {"error": str(e)}, []

def scan_models_dir():
    from app.services.config import load_config
    from ..services.model_classifier import classify_models
    
    root = Path((load_config() or {}).get("models_dir") or "").expanduser()
    res = []
    if not root or not root.exists(): return res
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in {".gguf", ".bin", ".pth", ".safetensors"}:
            q = _infer_quant_from_name(p.name)
            tags = _infer_tags_from_id(p.stem)
            res.append({
                "id": p.stem,
                "label": p.stem,
                "provider": "local",
                "size": f"{p.stat().st_size/1e9:.2f} GB",
                "quant": q,
                "tags": tags,
                "path": str(p),
            })
    
    # Classify the local models
    classified_models = classify_models(res)
    
    # merge with registry as you already do...
    reg = _load()
    ex_ids = {m["id"] for m in reg["local"]}
    for m in classified_models:
        if m["id"] not in ex_ids:
            reg["local"].append(m)
    _save(reg)
    return reg["local"]
