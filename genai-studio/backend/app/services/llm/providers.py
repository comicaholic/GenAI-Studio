import os, requests
from typing import Dict, List, Tuple

GROQ_BASE = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_KEY  = os.getenv("GROQ_API_KEY", "")

TIMEOUT = 60

def _headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"}

def list_groq_models() -> List[Dict]:
    """Return Groq-compatible models."""
    if not GROQ_KEY:
        # keep a stub so the UI boots, but call will fail if used
        return [{"id":"stub:echo", "label":"Stub • Echo (no GROQ_API_KEY)", "tags":["stub"]}]
    try:
        r = requests.get(f"{GROQ_BASE}/models", headers=_headers(), timeout=TIMEOUT)
        r.raise_for_status()
        data = r.json().get("data", [])
        out = []
        for m in data:
            mid = m.get("id")
            if not mid: continue
            out.append({
                "id": f"groq:{mid}",
                "label": f"Groq • {mid}",
                "tags": ["groq"],
                "raw": m
            })
        return out
    except Exception:
        return [{"id":"stub:echo", "label":"Stub • Echo (models error)", "tags":["stub"]}]

def route_model(model_id: str) -> Tuple[str, str]:
    """'groq:mixtral-8x7b' -> ('groq', 'mixtral-8x7b') ; 'stub:echo' -> ('stub','echo')"""
    parts = model_id.split(":", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return ("groq", model_id)

def chat_complete(model_id: str, messages, **params) -> str:
    ns, mid = route_model(model_id)
    if ns == "stub":
        content = "\n\n".join([m.get("content","") for m in messages])
        return f"[STUB ECHO]\n{content[:4000]}"

    if not GROQ_KEY:
        raise RuntimeError("GROQ_API_KEY not set")

    body = {
        "model": mid,
        "messages": messages,
        "temperature": params.get("temperature", 0.2),
        "top_p": params.get("top_p", 1.0),
        "max_tokens": params.get("max_tokens", 512),
    }
    url = f"{GROQ_BASE}/chat/completions"
    r = requests.post(url, json=body, headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    j = r.json()
    return j["choices"][0]["message"]["content"]
