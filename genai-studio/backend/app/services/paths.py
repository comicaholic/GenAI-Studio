# backend/app/services/paths.py
from __future__ import annotations
from pathlib import Path
import os, json

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR    = BACKEND_DIR / "data"
CONFIG_FILE = DATA_DIR / "config.json"

_DEFAULTS = {
    "paths": {
        "source_dir": "data/source",
        "reference_dir": "data/reference",
        "context_dir": "data/context",
    }
}

def _read_cfg() -> dict:
    try:
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return _DEFAULTS

def _with_env(paths: dict) -> dict:
    return {
        "source_dir": os.getenv("APP_SOURCE_DIR", paths["source_dir"]),
        "reference_dir": os.getenv("APP_REFERENCE_DIR", paths["reference_dir"]),
        "context_dir": os.getenv("APP_CONTEXT_DIR", paths["context_dir"]),
    }

def _to_abs(p: str | os.PathLike) -> Path:
    p = Path(p)
    return p if p.is_absolute() else (BACKEND_DIR / p)

def get_paths() -> dict[str, Path]:
    cfg   = _read_cfg()
    paths = cfg.get("paths", _DEFAULTS["paths"])
    paths = _with_env(paths)

    out = {k: _to_abs(v) for k, v in paths.items()}
    for v in out.values():
        v.mkdir(parents=True, exist_ok=True)
    return out
