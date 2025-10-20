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
        
        import time
        start_time = time.time()
        
        payload = {
            "model": params.get("model_id"),
            "messages": [{"role":"user","content":prompt}],
            "temperature": params.get("temperature", 0.2),
            "max_tokens": params.get("max_tokens", 512)
        }
        
        try:
            r = self.session.post("https://api.groq.com/openai/v1/chat/completions",
                                  json=payload,
                                  headers={"Authorization": f"Bearer {self.key}"})
            r.raise_for_status()
            
            response_data = r.json()
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Record usage analytics
            try:
                from app.routers.analytics import record_groq_usage
                
                # Calculate tokens and cost
                model_id = params.get("model_id", "unknown")
                prompt_tokens = len(prompt.split())  # Rough estimate
                completion_tokens = len(response_data["choices"][0]["message"]["content"].split())  # Rough estimate
                total_tokens = prompt_tokens + completion_tokens
                
                # Estimate cost (these are rough estimates, actual costs may vary)
                cost_per_token = 0.000001  # Rough estimate
                cost_usd = total_tokens * cost_per_token
                
                record_groq_usage(
                    model=model_id,
                    tokens_used=total_tokens,
                    cost_usd=cost_usd,
                    duration_ms=duration_ms,
                    success=True
                )
            except Exception as e:
                print(f"Error recording Groq usage: {e}")
            
            return response_data["choices"][0]["message"]["content"]
            
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Record failed request
            try:
                from app.routers.analytics import record_groq_usage
                record_groq_usage(
                    model=params.get("model_id", "unknown"),
                    tokens_used=0,
                    cost_usd=0.0,
                    duration_ms=duration_ms,
                    success=False
                )
            except Exception as analytics_error:
                print(f"Error recording failed Groq usage: {analytics_error}")
            
            raise e
