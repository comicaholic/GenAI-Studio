# backend/app/services/models.py
import os, json, pathlib, requests, re 
from pathlib import Path
REG_PATH = Path("data/models_registry.json")  # portable per-project registry

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
        return json.loads(REG_PATH.read_text("utf-8"))
    return {"local": []}

def _save(d): REG_PATH.parent.mkdir(parents=True, exist_ok=True); REG_PATH.write_text(json.dumps(d, indent=2))

def scan_models_dir():
    # read from config for portability
    from app.services.config import load_config
    cfg = load_config()
    root = Path(cfg.get("models_dir") or "").expanduser()
    res = []
    if not root or not root.exists(): return res
    for p in root.glob("**/*"):
        if p.is_file() and p.suffix.lower() in {".gguf", ".bin", ".pth", ".safetensors"}:
            res.append({
                "id": p.stem,
                "label": p.stem,
                "provider": "local",
                "size": f"{p.stat().st_size/1e9:.2f} GB",
                "quant": "Q?" if ".gguf" in p.suffix.lower() else None,
                "path": str(p),
            })
    # merge into registry (dedupe by id)
    reg = _load()
    ex_ids = {m["id"] for m in reg["local"]}
    for m in res:
        if m["id"] not in ex_ids:
            reg["local"].append(m)
    _save(reg)
    return reg["local"]

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

def get_groq_models():
    """
    Return (warning_dict_or_None, models_list).
    Uses Groq's OpenAI-compatible API:
      GET https://api.groq.com/openai/v1/models
    """
    from app.services.model_classifier import classify_models
    
    key = os.getenv("GROQ_API_KEY")
    print(f"Getting Groq models, API key present: {bool(key)}")

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
                # mark as hosted so UI can suppress size if desired
                "size": "hosted",
                "tags": ["groq"],
            })

        # Classify the models (adds convenience tags/categories)
        classified_models = classify_models(mapped)
        
        return None, classified_models
    except requests.HTTPError as e:
        print(f"Groq models API HTTP error: {e}")
        print(f"Response status: {e.response.status_code}")
        print(f"Response text: {e.response.text}")
        # Keep the app usable and surface a clear message in the UI
        
    except Exception as e:
        print(f"Groq models API error: {e}")
        

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
        if m["name"] not in ex_ids:
            reg["local"].append(m)
    _save(reg)
    return reg["local"]
