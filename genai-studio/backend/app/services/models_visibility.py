import os, json

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
_DATA_DIR = os.path.join(_ROOT, "data")
_FILE = os.path.join(_DATA_DIR, "model_visibility.json")

def _ensure_dir():
    os.makedirs(_DATA_DIR, exist_ok=True)

def load_enabled_ids():
    """Return a list of enabled model ids or None meaning 'all enabled'."""
    if not os.path.exists(_FILE):
        return None
    try:
        with open(_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            ids = data.get("enabled_ids", None)
            if ids is None:
                return None
            if isinstance(ids, list):
                return [str(x) for x in ids]
    except Exception:
        pass
    return None

def save_enabled_ids(enabled_ids):
    """Persist a list of enabled ids, or None for 'all enabled'."""
    _ensure_dir()
    data = {"enabled_ids": enabled_ids if enabled_ids is None else list(enabled_ids)}
    with open(_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def cleanup_visibility_settings(available_model_ids):
    """
    Clean up visibility settings by removing IDs for models that no longer exist.
    This prevents the "no models available" issue when integrations are not running.
    """
    enabled_ids = load_enabled_ids()
    if enabled_ids is None:
        return  # No filtering applied
    
    available_set = set(available_model_ids)
    valid_enabled_ids = [id for id in enabled_ids if id in available_set]
    
    # If we have valid enabled IDs, update the settings
    if valid_enabled_ids:
        save_enabled_ids(valid_enabled_ids)
    else:
        # No valid enabled IDs found, reset to "all enabled"
        save_enabled_ids(None)
        print("Cleaned up visibility settings: reset to all enabled due to no matching models")





