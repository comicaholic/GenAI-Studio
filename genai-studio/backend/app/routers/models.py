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
HF_TOKEN = os.getenv("HF_TOKEN","")
def _hf_headers(): return {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}

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
def discover_models(q: str = "", sort: str = "downloads", limit: int = 20):
    """
    Proxy to Hugging Face search. sort: downloads | likes | lastModified
    Returns minimal fields needed for UI.
    """
    import requests
    params = {
        "search": q,
        "limit": limit,
        "sort": {"downloads":"downloads","likes":"likes","recency":"lastModified"}.get(sort,"downloads"),
    }
    r = requests.get("https://huggingface.co/api/models", params=params, timeout=20)
    r.raise_for_status()
    items = []
    for m in r.json():
        # Only LLMs (common filters — you can loosen later)
        arch = (m.get("config") or {}).get("architectures") or []
        tags = m.get("tags") or []
        items.append({
            "id": m.get("id"),
            "label": m.get("id"),
            "provider": "local",  # becomes local once downloaded
            "params": (m.get("config") or {}).get("num_parameters"),
            "arch": arch[0] if arch else None,
            "likes": m.get("likes"),
            "downloads": m.get("downloads"),
            "lastModified": m.get("lastModified"),
            "formats": m.get("library_name") or "",
            "tags": tags[:8],
        })
    return {"results": items}

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