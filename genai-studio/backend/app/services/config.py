from __future__ import annotations
import json, os
from pathlib import Path
from typing import Dict, Tuple

# Repo root:  backend/ is BASE_DIR; project root is BASE_DIR.parent
BASE_DIR = Path(__file__).resolve().parents[2]        # .../backend
PROJECT_ROOT = BASE_DIR                                # keep data under backend/
DATA_DIR = PROJECT_ROOT / "data"

CONFIG_PATH = DATA_DIR / "config.json"

# Defaults are RELATIVE paths (portable)
DEFAULTS = {
    "paths": {
        "source_dir": "data/source",
        "reference_dir": "data/reference",
        "context_dir": "data/context",
    }
}

def _ensure_dirs(abs_paths: Dict[str, Path]) -> None:
    for p in abs_paths.values():
        p.mkdir(parents=True, exist_ok=True)

def _is_subpath(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except Exception:
        return False

def _to_abs(rel_or_abs: str) -> Path:
    p = Path(rel_or_abs)
    return p if p.is_absolute() else (PROJECT_ROOT / rel_or_abs)

def _to_rel_for_save(abs_path: Path) -> str:
    # If inside project root, store as relative; else keep absolute
    if _is_subpath(abs_path, PROJECT_ROOT):
        return str(abs_path.resolve().relative_to(PROJECT_ROOT))
    return str(abs_path.resolve())

def _migrate_if_needed(cfg: Dict) -> Tuple[Dict, bool]:
    """Convert any absolute paths under some other user dir into relative within this repo."""
    changed = False
    paths = cfg.get("paths", {})
    for key, val in list(paths.items()):
        abs_p = _to_abs(val) if not Path(val).is_absolute() else Path(val)
        # If path is not under current PROJECT_ROOT but looks like an old absolute path, move to default relative
        if not _is_subpath(abs_p, PROJECT_ROOT):
            # fall back to default relative path
            default_rel = DEFAULTS["paths"].get(key, f"data/{key.replace('_dir','')}")
            paths[key] = default_rel
            changed = True
    if changed:
        cfg["paths"] = paths
    return cfg, changed

def load_config() -> Dict:
    # first time: write defaults and create folders
    if not CONFIG_PATH.exists():
        cfg = DEFAULTS.copy()
        save_config(cfg)
        abs_paths = {k: _to_abs(v) for k, v in cfg["paths"].items()}
        _ensure_dirs(abs_paths)
        return cfg

    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        cfg = json.load(f)

    # migrate any old absolute user-specific paths to relative
    cfg, changed = _migrate_if_needed(cfg)
    if changed:
        save_config(cfg)

    # create folders if missing
    abs_paths = {k: _to_abs(v) for k, v in cfg["paths"].items()}
    _ensure_dirs(abs_paths)
    return cfg

def save_config(cfg: Dict) -> None:
    # Save all settings, not just paths
    to_save = {}
    
    # Handle paths with relative conversion
    if "paths" in cfg:
        to_save["paths"] = {}
        for k, v in cfg.get("paths", {}).items():
            rel_or_abs = _to_rel_for_save(_to_abs(v))
            to_save["paths"][k] = rel_or_abs
    
    # Save other settings as-is
    for key, value in cfg.items():
        if key != "paths":
            to_save[key] = value

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with CONFIG_PATH.open("w", encoding="utf-8") as f:
        json.dump(to_save, f, indent=2)

def resolve_paths() -> Dict[str, Path]:
    cfg = load_config()
    return {k: _to_abs(v) for k, v in cfg["paths"].items()}
