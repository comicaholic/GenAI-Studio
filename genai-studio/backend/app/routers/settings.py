from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from ..services.config import load_config, save_config, resolve_paths, _to_abs
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
        # Update existing key
        content = re.sub(pattern, f"{key}={value}", content, flags=re.MULTILINE)
    else:
        # Add new key
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
    
    return cfg

@router.post("/settings")
def save_settings(settings: SettingsIn):
    """Save all settings"""
    cfg = load_config()
    
    # Update settings
    cfg.update(settings.dict())
    
    # Set environment variables for API keys and write to .env file
    if "groq" in settings.dict() and "apiKey" in settings.groq:
        api_key = settings.groq["apiKey"]
        os.environ["GROQ_API_KEY"] = api_key
        update_env_file("GROQ_API_KEY", api_key)
        print(f"Updated GROQ_API_KEY in environment: {bool(api_key)}")
    
    if "huggingface" in settings.dict() and "token" in settings.huggingface:
        token = settings.huggingface["token"]
        os.environ["HUGGINGFACE_TOKEN"] = token
        update_env_file("HUGGINGFACE_TOKEN", token)
        print(f"Updated HUGGINGFACE_TOKEN in environment: {bool(token)}")
    
    # Reload environment variables from .env file to ensure all services pick up changes
    reload_env_file()
    
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
            return {"connected": True, "models_count": len(response.json().get("data", []))}
        else:
            return {"connected": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"connected": False, "error": str(e)}

@router.post("/huggingface/test")
def test_huggingface_connection(request: dict):
    """Test Hugging Face token connection"""
    token = request.get("token", "")
    if not token:
        return {"connected": False, "error": "No token provided"}
    
    try:
        # Test with a simple API call to get user info
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get("https://huggingface.co/api/whoami", headers=headers, timeout=10)
        
        if response.status_code == 200:
            user_info = response.json()
            return {"connected": True, "username": user_info.get("name", "Unknown")}
        else:
            return {"connected": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"connected": False, "error": str(e)}