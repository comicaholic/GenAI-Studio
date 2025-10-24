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
        return [{"id": m["id"], "label": m["id"], "tags": ["groq", "cloud"]} for m in models]

    def complete(self, prompt, params, files=None):
        if not self.key:
            raise RuntimeError("GROQ_API_KEY not set")
        
        import time
        start_time = time.time()
        
        payload = {
            "model": params.get("model_id"),
            "messages": [{"role":"user","content":prompt}],
            "temperature": params.get("temperature", 0.2),
            "max_tokens": params.get("max_tokens", 1024)
        }
        
        try:
            r = self.session.post("https://api.groq.com/openai/v1/chat/completions",
                                  json=payload,
                                  headers={"Authorization": f"Bearer {self.key}"})
            r.raise_for_status()
            
            response_data = r.json()
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Analytics recording is handled centrally in llm.py router
            
            message = response_data["choices"][0]["message"]
            content = message.get("content", "")
            
            # Handle Groq models that return content in reasoning field instead of content field
            if not content and "reasoning" in message:
                content = message.get("reasoning", "")
            
            return content
            
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Analytics recording is handled centrally in llm.py router
            
            raise e
