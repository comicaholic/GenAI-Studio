import os, requests
from typing import Dict, List, Tuple

GROQ_BASE = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

def _get_groq_key() -> str:
    """Get Groq API key from environment or config"""
    key = os.getenv("GROQ_API_KEY", "")
    if not key:
        from app.services.config import load_config
        cfg = load_config()
        key = cfg.get("groq", {}).get("apiKey", "")
    return key

def _headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {_get_groq_key()}", "Content-Type": "application/json"}

TIMEOUT = 60

def list_groq_models() -> List[Dict]:
    """Return Groq-compatible models."""
    key = _get_groq_key()
    if not key:
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

    key = _get_groq_key()
    if not key:
        raise RuntimeError("GROQ_API_KEY not set")

    import time
    start_time = time.time()
    
    body = {
        "model": mid,
        "messages": messages,
        "temperature": params.get("temperature", 0.2),
        "top_p": params.get("top_p", 1.0),
        "max_tokens": params.get("max_tokens", 512),
    }
    
    try:
        url = f"{GROQ_BASE}/chat/completions"
        r = requests.post(url, json=body, headers=_headers(), timeout=TIMEOUT)
        r.raise_for_status()
        j = r.json()
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Record usage analytics
        try:
            from app.routers.analytics import record_groq_usage
            
            # Calculate tokens and cost
            prompt_text = "\n".join([m.get("content", "") for m in messages])
            prompt_tokens = len(prompt_text.split())  # Rough estimate
            completion_tokens = len(j["choices"][0]["message"]["content"].split())  # Rough estimate
            total_tokens = prompt_tokens + completion_tokens
            
            # Estimate cost (these are rough estimates, actual costs may vary)
            cost_per_token = 0.000001  # Rough estimate
            cost_usd = total_tokens * cost_per_token
            
            record_groq_usage(
                model=mid,
                tokens_used=total_tokens,
                cost_usd=cost_usd,
                duration_ms=duration_ms,
                success=True
            )
        except Exception as e:
            print(f"Error recording Groq usage: {e}")
        
        return j["choices"][0]["message"]["content"]
        
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Record failed request
        try:
            from app.routers.analytics import record_groq_usage
            record_groq_usage(
                model=mid,
                tokens_used=0,
                cost_usd=0.0,
                duration_ms=duration_ms,
                success=False
            )
        except Exception as analytics_error:
            print(f"Error recording failed Groq usage: {analytics_error}")
        
        raise e
