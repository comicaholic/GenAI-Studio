from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from pathlib import Path

router = APIRouter()

PRESETS_FILE = Path(__file__).resolve().parents[2] / "data" / "presets.json"

class PresetIn(BaseModel):
    type: str  # "ocr" | "prompt" | "chat"
    name: str
    content: str

def load_presets():
    if PRESETS_FILE.exists():
        return json.loads(PRESETS_FILE.read_text(encoding="utf-8"))
    return {"ocr": [], "prompt": [], "chat": []}

def save_presets(data):
    PRESETS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

@router.get("/{preset_type}")
def list_presets(preset_type: str):
    presets = load_presets()
    if preset_type not in presets:
        raise HTTPException(400, "Invalid preset type")
    return presets[preset_type]

@router.post("/")
def create_preset(preset: PresetIn):
    data = load_presets()
    if preset.type not in data:
        raise HTTPException(400, "Invalid preset type")
    data[preset.type].append({"name": preset.name, "content": preset.content})
    save_presets(data)
    return {"ok": True}

@router.delete("/{preset_type}/{name}")
def delete_preset(preset_type: str, name: str):
    data = load_presets()
    if preset_type not in data:
        raise HTTPException(400, "Invalid preset type")
    data[preset_type] = [p for p in data[preset_type] if p["name"] != name]
    save_presets(data)
    return {"ok": True}
