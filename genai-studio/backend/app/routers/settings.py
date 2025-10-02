from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from ..services.config import load_config, save_config, resolve_paths, _to_abs
import requests
import os

router = APIRouter(tags=["settings"])

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
    
    return cfg

@router.post("/settings")
def save_settings(settings: SettingsIn):
    """Save all settings"""
    cfg = load_config()
    
    # Update settings
    cfg.update(settings.dict())
    
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