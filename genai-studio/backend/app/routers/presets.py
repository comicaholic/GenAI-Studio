from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from pathlib import Path
from typing import Dict, Any

router = APIRouter()

PRESETS_FILE = Path(__file__).resolve().parents[2] / "data" / "presets.json"

class PresetIn(BaseModel):
    type: str  # "ocr" | "prompt" | "chat"
    name: str
    content: Dict[str, Any]  # Changed from str to Dict to match actual format

def load_presets():
    if PRESETS_FILE.exists():
        return json.loads(PRESETS_FILE.read_text(encoding="utf-8"))
    return {"ocr": [], "prompt": [], "chat": []}

def save_presets(data):
    PRESETS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

@router.get("/")
def get_all_presets():
    """Get all presets organized by type"""
    presets = load_presets()
    # Convert from objects to just names for frontend compatibility
    result = {}
    for preset_type, preset_list in presets.items():
        result[preset_type] = [preset["name"] for preset in preset_list]
    return result

@router.get("/{preset_type}")
def list_presets(preset_type: str):
    presets = load_presets()
    if preset_type not in presets:
        raise HTTPException(400, "Invalid preset type")
    # Return just the names for frontend compatibility
    return [preset["name"] for preset in presets[preset_type]]

@router.get("/{preset_type}/{name}")
def get_preset(preset_type: str, name: str):
    """Get a specific preset by type and name"""
    presets = load_presets()
    if preset_type not in presets:
        raise HTTPException(400, "Invalid preset type")
    
    for preset in presets[preset_type]:
        if preset["name"] == name:
            return preset
    
    raise HTTPException(404, "Preset not found")

@router.post("/")
def create_preset(preset: PresetIn):
    data = load_presets()
    if preset.type not in data:
        raise HTTPException(400, "Invalid preset type")
    data[preset.type].append({"name": preset.name, "content": preset.content})
    save_presets(data)
    return {"ok": True}

@router.put("/{preset_type}/{name}")
def update_preset(preset_type: str, name: str, preset: PresetIn):
    """Update an existing preset"""
    data = load_presets()
    if preset_type not in data:
        raise HTTPException(400, "Invalid preset type")
    
    # Find and update the preset
    for i, p in enumerate(data[preset_type]):
        if p["name"] == name:
            data[preset_type][i] = {"name": preset.name, "content": preset.content}
            save_presets(data)
            return {"ok": True}
    
    raise HTTPException(404, "Preset not found")

@router.delete("/{preset_type}/{name}")
def delete_preset(preset_type: str, name: str):
    data = load_presets()
    if preset_type not in data:
        raise HTTPException(400, "Invalid preset type")
    data[preset_type] = [p for p in data[preset_type] if p["name"] != name]
    save_presets(data)
    return {"ok": True}
