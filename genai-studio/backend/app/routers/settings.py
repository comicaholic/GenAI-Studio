from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from ..services.config import load_config, save_config, resolve_paths, _to_abs
from ..services.gpu_detection import detect_available_gpus, get_gpu_info, validate_gpu_selection
import requests
import os
import re
from dotenv import load_dotenv

router = APIRouter(tags=["settings"])

# Path to .env file
BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/
ENV_PATH = BACKEND_DIR / ".env"

def update_env_file(key: str, value: str):
    """Update or add a key-value pair in the .env file"""
    if not ENV_PATH.exists():
        ENV_PATH.write_text(f"# Environment variables for GenAI Studio\n# This file is automatically managed by the settings page\n\n")
    
    content = ENV_PATH.read_text(encoding="utf-8")
    
    # Pattern to match the key (with optional = and value)
    pattern = rf"^{re.escape(key)}\s*=.*$"
    
    if re.search(pattern, content, re.MULTILINE):
        if value.strip():  # If value is not empty, update the key
            content = re.sub(pattern, f"{key}={value}", content, flags=re.MULTILINE)
        else:  # If value is empty, remove the line entirely
            content = re.sub(pattern, "", content, flags=re.MULTILINE)
            # Clean up any double newlines that might result
            content = re.sub(r'\n\n+', '\n\n', content)
    else:
        # Only add new key if value is not empty
        if value.strip():
            content += f"\n{key}={value}"
    
    ENV_PATH.write_text(content, encoding="utf-8")

def load_env_file():
    """Load environment variables from .env file"""
    if not ENV_PATH.exists():
        return {}
    
    env_vars = {}
    content = ENV_PATH.read_text(encoding="utf-8")
    
    for line in content.split('\n'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env_vars[key.strip()] = value.strip()
    
    return env_vars

def reload_env_file():
    """Reload environment variables from .env file"""
    if ENV_PATH.exists():
        load_dotenv(dotenv_path=ENV_PATH, override=True)
        print("Reloaded environment variables from .env file")

class PathsIn(BaseModel):
    source_dir: str
    reference_dir: str
    context_dir: str

class SettingsIn(BaseModel):
    ui: dict
    paths: dict
    presets: dict
    groq: dict
    huggingface: dict

@router.get("/paths")
def get_paths():
    # return both the saved (relative) config and the resolved absolute paths
    cfg = load_config()
    resolved = {k: str(v) for k, v in resolve_paths().items()}
    return {"config": cfg["paths"], "resolved": resolved}

@router.post("/paths")
def set_paths(payload: PathsIn):
    # accept relative or absolute; validate dirs (create if needed)
    cfg = load_config()
    cfg["paths"]["source_dir"] = payload.source_dir
    cfg["paths"]["reference_dir"] = payload.reference_dir
    cfg["paths"]["context_dir"] = payload.context_dir
    save_config(cfg)  # normalizes to relative where possible

    # ensure they exist
    for v in (payload.source_dir, payload.reference_dir, payload.context_dir):
        _to_abs(v).mkdir(parents=True, exist_ok=True)

    return {"ok": True}

@router.get("/settings")
def get_settings():
    """Get all settings"""
    cfg = load_config()
    
    # Ensure all required settings exist with defaults
    default_settings = {
        "ui": {
            "theme": "dark",
            "defaultLandingPage": "/",
            "backgroundStateManagement": True
        },
        "paths": {
            "ocrSource": "./data/source",
            "ocrReference": "./data/reference", 
            "promptSource": "./data/source",
            "promptReference": "./data/reference",
            "chatDownloadPath": "./data/downloads"
        },
        "presets": {
            "ocr": [],
            "prompt": [],
            "chat": []
        },
        "groq": {
            "apiKey": "",
            "connected": False
        },
        "huggingface": {
            "token": "",
            "connected": False
        },
        # New: local model servers
        "lmstudio": {
            "baseUrl": "http://localhost:1234",
            "connected": False
        },
        "ollama": {
            "baseUrl": "http://localhost:11434",
            "connected": False,
            "apiKey": "",
            "apiConnected": False
        },
        "vllm": {
            "baseUrl": "http://localhost:8000",
            "connected": False
        },
        "localModels": {
            "selectedGpu": "auto",
            "availableGpus": detect_available_gpus(),
            "autoLoadOnSelect": True
        }
    }
    
    # Merge with existing config
    for key, value in default_settings.items():
        if key not in cfg:
            cfg[key] = value
        elif isinstance(value, dict):
            for subkey, subvalue in value.items():
                if subkey not in cfg[key]:
                    cfg[key][subkey] = subvalue
    
    # Load presets from presets file
    try:
        from .presets import load_presets
        presets_data = load_presets()
        cfg["presets"] = {
            "ocr": [preset["name"] for preset in presets_data.get("ocr", [])],
            "prompt": [preset["name"] for preset in presets_data.get("prompt", [])],
            "chat": [preset["name"] for preset in presets_data.get("chat", [])]
        }
    except Exception as e:
        print(f"Warning: Could not load presets: {e}")
        # Keep default empty presets if loading fails
    
    # Load environment variables from .env file and set them
    env_vars = load_env_file()
    for key, value in env_vars.items():
        if value:  # Only set non-empty values
            os.environ[key] = value
    
    # Set environment variables from config if they exist and aren't already set
    if "groq" in cfg and "apiKey" in cfg["groq"] and cfg["groq"]["apiKey"]:
        if not os.getenv("GROQ_API_KEY"):
            os.environ["GROQ_API_KEY"] = cfg["groq"]["apiKey"]
    
    if "huggingface" in cfg and "token" in cfg["huggingface"] and cfg["huggingface"]["token"]:
        if not os.getenv("HUGGINGFACE_TOKEN"):
            os.environ["HUGGINGFACE_TOKEN"] = cfg["huggingface"]["token"]
    
    if "ollama" in cfg and "apiKey" in cfg["ollama"] and cfg["ollama"]["apiKey"]:
        if not os.getenv("OLLAMA_API_KEY"):
            os.environ["OLLAMA_API_KEY"] = cfg["ollama"]["apiKey"]
    
    # Validate connection status based on actual API key presence
    # Only mark as connected if there's actually an API key
    if "groq" in cfg:
        groq_api_key = cfg["groq"].get("apiKey", "") or os.getenv("GROQ_API_KEY", "")
        cfg["groq"]["connected"] = bool(groq_api_key.strip())
    
    if "huggingface" in cfg:
        hf_token = cfg["huggingface"].get("token", "") or os.getenv("HUGGINGFACE_TOKEN", "")
        cfg["huggingface"]["connected"] = bool(hf_token.strip())
    
    if "ollama" in cfg:
        ollama_api_key = cfg["ollama"].get("apiKey", "") or os.getenv("OLLAMA_API_KEY", "")
        cfg["ollama"]["apiConnected"] = bool(ollama_api_key.strip())

    # Ensure lmstudio/ollama/vllm blocks exist
    for key, url in ("lmstudio", "http://localhost:1234"), ("vllm", "http://localhost:8000"):
        if key not in cfg:
            cfg[key] = {"baseUrl": url, "connected": False}
    
    # Special handling for ollama to include API key fields
    if "ollama" not in cfg:
        cfg["ollama"] = {"baseUrl": "http://localhost:11434", "connected": False, "apiKey": "", "apiConnected": False}
    else:
        # Ensure API key fields exist
        if "apiKey" not in cfg["ollama"]:
            cfg["ollama"]["apiKey"] = ""
        if "apiConnected" not in cfg["ollama"]:
            cfg["ollama"]["apiConnected"] = False
    
    return cfg

@router.post("/settings")
def save_settings(settings: SettingsIn):
    """Save all settings"""
    print(f"Received settings: {settings.dict()}")  # Debug log
    cfg = load_config()
    
    # Update settings
    cfg.update(settings.dict())
    
    # Set environment variables for API keys and write to .env file
    if "groq" in settings.dict() and "apiKey" in settings.groq:
        api_key = settings.groq["apiKey"]
        if api_key.strip():
            os.environ["GROQ_API_KEY"] = api_key
        else:
            # Remove from environment if empty
            os.environ.pop("GROQ_API_KEY", None)
        update_env_file("GROQ_API_KEY", api_key)
        print(f"Updated GROQ_API_KEY in environment: {bool(api_key.strip())}")
    
    if "huggingface" in settings.dict() and "token" in settings.huggingface:
        token = settings.huggingface["token"]
        if token.strip():
            os.environ["HUGGINGFACE_TOKEN"] = token
        else:
            # Remove from environment if empty
            os.environ.pop("HUGGINGFACE_TOKEN", None)
        update_env_file("HUGGINGFACE_TOKEN", token)
        print(f"Updated HUGGINGFACE_TOKEN in environment: {bool(token.strip())}")
    
    if "ollama" in settings.dict() and "apiKey" in settings.ollama:
        api_key = settings.ollama["apiKey"]
        if api_key.strip():
            os.environ["OLLAMA_API_KEY"] = api_key
        else:
            # Remove from environment if empty
            os.environ.pop("OLLAMA_API_KEY", None)
        update_env_file("OLLAMA_API_KEY", api_key)
        print(f"Updated OLLAMA_API_KEY in environment: {bool(api_key.strip())}")
    
    # Reload environment variables from .env file to ensure all services pick up changes
    reload_env_file()
    
    # Re-validate connection status after saving settings
    if "groq" in cfg:
        groq_api_key = cfg["groq"].get("apiKey", "") or os.getenv("GROQ_API_KEY", "")
        cfg["groq"]["connected"] = bool(groq_api_key.strip())
    
    if "huggingface" in cfg:
        hf_token = cfg["huggingface"].get("token", "") or os.getenv("HUGGINGFACE_TOKEN", "")
        cfg["huggingface"]["connected"] = bool(hf_token.strip())
    
    if "ollama" in cfg:
        ollama_api_key = cfg["ollama"].get("apiKey", "") or os.getenv("OLLAMA_API_KEY", "")
        cfg["ollama"]["apiConnected"] = bool(ollama_api_key.strip())

    # Normalize lmstudio/ollama/vllm shapes
    for key in ["lmstudio", "vllm"]:
        if key not in cfg:
            cfg[key] = {}
        default_urls = {
            "lmstudio": "http://localhost:1234",
            "vllm": "http://localhost:8000"
        }
        cfg[key]["baseUrl"] = cfg[key].get("baseUrl") or default_urls[key]
        cfg[key]["connected"] = bool(cfg[key].get("connected", False))
    
    # Special handling for ollama
    if "ollama" not in cfg:
        cfg["ollama"] = {}
    cfg["ollama"]["baseUrl"] = cfg["ollama"].get("baseUrl") or "http://localhost:11434"
    cfg["ollama"]["connected"] = bool(cfg["ollama"].get("connected", False))
    cfg["ollama"]["apiKey"] = cfg["ollama"].get("apiKey", "")
    cfg["ollama"]["apiConnected"] = bool(cfg["ollama"].get("apiConnected", False))
    
    # Ensure directories exist
    paths = cfg.get("paths", {})
    for path_key in ["ocrSource", "ocrReference", "promptSource", "promptReference", "chatDownloadPath"]:
        if path_key in paths:
            path_obj = Path(paths[path_key])
            path_obj.mkdir(parents=True, exist_ok=True)
    
    save_config(cfg)
    return {"ok": True}

@router.post("/groq/test")
def test_groq_connection(request: dict):
    """Test Groq API connection"""
    api_key = request.get("apiKey", "")
    if not api_key:
        return {"connected": False, "error": "No API key provided"}
    
    try:
        # Test with a simple models list request
        headers = {"Authorization": f"Bearer {api_key}"}
        response = requests.get("https://api.groq.com/openai/v1/models", headers=headers, timeout=10)
        
        if response.status_code == 200:
            # Update the connection status in config
            cfg = load_config()
            if "groq" not in cfg:
                cfg["groq"] = {}
            cfg["groq"]["connected"] = True
            cfg["groq"]["apiKey"] = api_key
            save_config(cfg)
            
            return {"connected": True, "models_count": len(response.json().get("data", []))}
        else:
            # Update the connection status in config
            cfg = load_config()
            if "groq" not in cfg:
                cfg["groq"] = {}
            cfg["groq"]["connected"] = False
            save_config(cfg)
            
            return {"connected": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        # Update the connection status in config
        cfg = load_config()
        if "groq" not in cfg:
            cfg["groq"] = {}
        cfg["groq"]["connected"] = False
        save_config(cfg)
        
        return {"connected": False, "error": str(e)}

@router.post("/lmstudio/test")
def test_lmstudio_connection(request: dict):
    """Test LM Studio server (OpenAI-compatible) by listing models"""
    base_url = (request or {}).get("baseUrl") or load_config().get("lmstudio", {}).get("baseUrl", "http://localhost:1234")
    try:
        r = requests.get(f"{base_url.rstrip('/')}/v1/models", timeout=10)
        ok = r.status_code == 200
        cfg = load_config()
        if "lmstudio" not in cfg:
            cfg["lmstudio"] = {}
        cfg["lmstudio"]["baseUrl"] = base_url
        cfg["lmstudio"]["connected"] = ok
        save_config(cfg)
        if ok:
            data = r.json() or {}
            return {"connected": True, "models_count": len((data.get("data") or []))}
        return {"connected": False, "error": f"HTTP {r.status_code}"}
    except Exception as e:
        cfg = load_config()
        if "lmstudio" not in cfg:
            cfg["lmstudio"] = {}
        cfg["lmstudio"]["baseUrl"] = base_url
        cfg["lmstudio"]["connected"] = False
        save_config(cfg)
        return {"connected": False, "error": str(e)}

@router.post("/ollama/test")
def test_ollama_connection(request: dict):
    """Test Ollama local server by listing tags"""
    base_url = (request or {}).get("baseUrl") or load_config().get("ollama", {}).get("baseUrl", "http://localhost:11434")
    try:
        r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=10)
        ok = r.status_code == 200
        cfg = load_config()
        if "ollama" not in cfg:
            cfg["ollama"] = {}
        cfg["ollama"]["baseUrl"] = base_url
        cfg["ollama"]["connected"] = ok
        save_config(cfg)
        if ok:
            data = r.json() or {}
            return {"connected": True, "models_count": len((data.get("models") or []))}
        return {"connected": False, "error": f"HTTP {r.status_code}"}
    except Exception as e:
        cfg = load_config()
        if "ollama" not in cfg:
            cfg["ollama"] = {}
        cfg["ollama"]["baseUrl"] = base_url
        cfg["ollama"]["connected"] = False
        save_config(cfg)
        return {"connected": False, "error": str(e)}

@router.post("/ollama/api/test")
def test_ollama_api_connection(request: dict):
    """Test Ollama API connection (for cloud-hosted Ollama instances)"""
    api_key = request.get("apiKey", "")
    
    if not api_key:
        return {"connected": False, "error": "No API key provided"}
    
    # For cloud API, always use https://ollama.com
    cloud_base_url = "https://ollama.com"
    
    try:
        # Test with Ollama cloud API using the provided API key
        headers = {"Authorization": f"Bearer {api_key}"}
        
        # Test the connection by listing models from cloud API
        test_url = f"{cloud_base_url}/api/tags"
        response = requests.get(test_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            # Update the connection status in config
            cfg = load_config()
            if "ollama" not in cfg:
                cfg["ollama"] = {}
            cfg["ollama"]["apiKey"] = api_key
            cfg["ollama"]["baseUrl"] = cloud_base_url
            cfg["ollama"]["apiConnected"] = True
            save_config(cfg)
            
            # Parse response to get model count
            try:
                data = response.json() or {}
                models_count = len(data.get("models", []))
                return {"connected": True, "models_count": models_count, "endpoint": test_url}
            except:
                return {"connected": True, "models_count": 0, "endpoint": test_url}
                
        elif response.status_code == 401:
            # Update the connection status in config to reflect failure
            cfg = load_config()
            if "ollama" not in cfg:
                cfg["ollama"] = {}
            cfg["ollama"]["apiKey"] = api_key
            cfg["ollama"]["baseUrl"] = cloud_base_url
            cfg["ollama"]["apiConnected"] = False
            save_config(cfg)
            return {"connected": False, "error": "Invalid API key"}
        else:
            # Update the connection status in config to reflect failure
            cfg = load_config()
            if "ollama" not in cfg:
                cfg["ollama"] = {}
            cfg["ollama"]["apiKey"] = api_key
            cfg["ollama"]["baseUrl"] = cloud_base_url
            cfg["ollama"]["apiConnected"] = False
            save_config(cfg)
            return {"connected": False, "error": f"API endpoint returned status {response.status_code}"}
            
    except Exception as e:
        # Update the connection status in config
        cfg = load_config()
        if "ollama" not in cfg:
            cfg["ollama"] = {}
        cfg["ollama"]["apiKey"] = api_key
        cfg["ollama"]["baseUrl"] = cloud_base_url
        cfg["ollama"]["apiConnected"] = False
        save_config(cfg)
        
        return {"connected": False, "error": str(e)}

@router.post("/vllm/test")
def test_vllm_connection(request: dict):
    """Test vLLM server (OpenAI-compatible) by listing models"""
    base_url = (request or {}).get("baseUrl") or load_config().get("vllm", {}).get("baseUrl", "http://localhost:8000")
    try:
        r = requests.get(f"{base_url.rstrip('/')}/v1/models", timeout=10)
        ok = r.status_code == 200
        cfg = load_config()
        if "vllm" not in cfg:
            cfg["vllm"] = {}
        cfg["vllm"]["baseUrl"] = base_url
        cfg["vllm"]["connected"] = ok
        save_config(cfg)
        if ok:
            data = r.json() or {}
            return {"connected": True, "models_count": len((data.get("data") or []))}
        return {"connected": False, "error": f"HTTP {r.status_code}"}
    except Exception as e:
        cfg = load_config()
        if "vllm" not in cfg:
            cfg["vllm"] = {}
        cfg["vllm"]["baseUrl"] = base_url
        cfg["vllm"]["connected"] = False
        save_config(cfg)
        return {"connected": False, "error": str(e)}

@router.get("/vllm/setup/info")
def get_vllm_setup_info():
    """Get vLLM setup information and available installation options"""
    from app.services.vllm_setup import vllm_setup
    
    return {
        "system_info": vllm_setup.get_system_info(),
        "installation_options": vllm_setup.get_installation_options(),
        "vllm_installed": vllm_setup.check_vllm_installed()
    }

@router.post("/vllm/setup/install")
def install_vllm(request: dict):
    """Install vLLM using the specified method"""
    method = request.get("method", "pip")
    from app.services.vllm_setup import vllm_setup
    
    if method == "pip":
        success, message = vllm_setup.install_vllm_pip()
    elif method == "conda":
        success, message = vllm_setup.install_vllm_conda()
    elif method == "docker":
        success, message = vllm_setup.setup_docker_vllm()
    else:
        return {"success": False, "message": f"Unknown installation method: {method}"}
    
    return {"success": success, "message": message}

@router.post("/vllm/setup/test")
def test_vllm_setup(request: dict):
    """Test vLLM setup and connection"""
    base_url = request.get("baseUrl", "http://localhost:8000")
    from app.services.vllm_setup import vllm_setup
    
    success, message = vllm_setup.test_vllm_connection(base_url)
    return {"success": success, "message": message}

@router.get("/gpu/info")
def get_gpu_info_endpoint():
    """Get detailed GPU information"""
    return get_gpu_info()

@router.post("/gpu/validate")
def validate_gpu_selection_endpoint(request: dict):
    """Validate if a GPU selection is available"""
    gpu_id = request.get("gpu_id", "auto")
    is_valid = validate_gpu_selection(gpu_id)
    return {"valid": is_valid, "gpu_id": gpu_id}

@router.get("/huggingface/status")
def get_huggingface_status():
    """Get Hugging Face token status"""
    try:
        cfg = load_config()
        hf_config = cfg.get("huggingface", {})
        token = hf_config.get("token", "")
        connected = hf_config.get("connected", False)
        
        return {
            "hasToken": bool(token),
            "connected": connected,
            "tokenLength": len(token) if token else 0
        }
    except Exception as e:
        return {
            "hasToken": False,
            "connected": False,
            "error": str(e)
        }

@router.post("/huggingface/test")
def test_huggingface_connection(request: dict):
    """Test Hugging Face token connection"""
    token = request.get("token", "")
    if not token:
        return {"connected": False, "error": "No token provided"}
    
    print(f"Testing HF token: {token[:10]}... (length: {len(token)})")
    
    try:
        # Clean the token (remove any whitespace)
        clean_token = token.strip()
        print(f"Original token length: {len(token)}, Clean token length: {len(clean_token)}")
        
        # Test with a simple API call to get user info
        headers = {"Authorization": f"Bearer {clean_token}"}
        print(f"Making request to HF API with headers: Authorization: Bearer {clean_token[:10]}...")
        
        # Try multiple endpoints to test the token (using correct HF API endpoints)
        endpoints_to_try = [
            "https://huggingface.co/api/whoami-v2",  # Updated to v2 endpoint
            "https://huggingface.co/api/whoami",    # Fallback to v1
            "https://huggingface.co/api/user",
            "https://huggingface.co/api/models?limit=1"
        ]
        
        response = None
        working_endpoint = None
        
        for endpoint in endpoints_to_try:
            print(f"Trying endpoint: {endpoint}")
            try:
                test_response = requests.get(endpoint, headers=headers, timeout=10)
                print(f"Endpoint {endpoint} returned status: {test_response.status_code}")
                if test_response.status_code == 200:
                    response = test_response
                    working_endpoint = endpoint
                    break
                elif test_response.status_code != 401:
                    # If it's not 401, the token might be working but endpoint is different
                    print(f"Non-401 response from {endpoint}: {test_response.status_code}")
            except Exception as e:
                print(f"Error testing {endpoint}: {e}")
        
        if not response:
            # If no endpoint worked, try the original whoami endpoint
            response = requests.get("https://huggingface.co/api/whoami", headers=headers, timeout=10)
        print(f"HF API response status: {response.status_code}")
        print(f"HF API response text: {response.text[:200]}...")
        
        if response.status_code == 200:
            user_info = response.json()
            print(f"HF API user info: {user_info}")
            
            # Update the connection status in config
            cfg = load_config()
            if "huggingface" not in cfg:
                cfg["huggingface"] = {}
            cfg["huggingface"]["connected"] = True
            cfg["huggingface"]["token"] = token
            save_config(cfg)
            
            return {"connected": True, "username": user_info.get("name", "Unknown")}
        else:
            print(f"HF API error: {response.status_code} - {response.text}")
            # Update the connection status in config
            cfg = load_config()
            if "huggingface" not in cfg:
                cfg["huggingface"] = {}
            cfg["huggingface"]["connected"] = False
            save_config(cfg)
            
            return {"connected": False, "error": f"HTTP {response.status_code}: {response.text[:100]}"}
    except Exception as e:
        print(f"HF API exception: {str(e)}")
        # Update the connection status in config
        cfg = load_config()
        if "huggingface" not in cfg:
            cfg["huggingface"] = {}
        cfg["huggingface"]["connected"] = False
        save_config(cfg)
        
        return {"connected": False, "error": str(e)}