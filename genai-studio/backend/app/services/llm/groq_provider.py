import os, requests
from .base import LLMProvider

class GroqProvider(LLMProvider):
    def __init__(self):
        # Try to get API key from environment first, then from config
        self.key = os.getenv("GROQ_API_KEY")
        if not self.key:
            from app.services.config import load_config
            cfg = load_config()
            self.key = cfg.get("groq", {}).get("apiKey", "")
        self.session = requests.Session()

    def list_models(self):
        if not self.key:
            return []
        r = self.session.get("https://api.groq.com/openai/v1/models",
                             headers={"Authorization": f"Bearer {self.key}"})
        r.raise_for_status()
        models = r.json().get("data", [])
        return [{"id": m["id"], "label": m["id"], "tags": ["groq"]} for m in models]

    def complete(self, prompt, params, files=None):
        if not self.key:
            raise RuntimeError("GROQ_API_KEY not set")
        payload = {
            "model": params.get("model_id"),
            "messages": [{"role":"user","content":prompt}],
            "temperature": params.get("temperature", 0.2),
            "max_tokens": params.get("max_tokens", 512)
        }
        r = self.session.post("https://api.groq.com/openai/v1/chat/completions",
                              json=payload,
                              headers={"Authorization": f"Bearer {self.key}"})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
