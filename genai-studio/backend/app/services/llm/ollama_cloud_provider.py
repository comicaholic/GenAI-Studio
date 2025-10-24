import os
import requests
from .base import LLMProvider

class OllamaCloudProvider(LLMProvider):
    def __init__(self):
        # Try to get API key from environment first, then from config
        self.key = os.getenv("OLLAMA_API_KEY")
        if not self.key:
            from app.services.config import load_config
            cfg = load_config()
            self.key = cfg.get("ollama", {}).get("apiKey", "")
        
        self.base_url = "https://ollama.com"
        self.session = requests.Session()

    def list_models(self):
        """List available Ollama cloud models"""
        if not self.key:
            return []
        
        try:
            headers = {"Authorization": f"Bearer {self.key}"}
            r = self.session.get(f"{self.base_url}/api/tags", headers=headers, timeout=10)
            r.raise_for_status()
            
            data = r.json()
            models = data.get("models", [])
            
            return [{"id": f"ollama-cloud/{m['name']}", "label": f"{m['name']} (Cloud)", "tags": ["ollama", "ollama-cloud", "cloud"]} for m in models]
        except Exception as e:
            print(f"Error listing Ollama cloud models: {e}")
            return []

    def complete(self, prompt, params, files=None):
        """Complete a prompt using Ollama cloud API"""
        if not self.key:
            raise RuntimeError("OLLAMA_API_KEY not set")
        
        import time
        start_time = time.time()
        
        # Extract model name (remove ollama-cloud/ prefix if present)
        model_id = params.get("model_id", "")
        if model_id.startswith("ollama-cloud/"):
            model_id = model_id.split("/", 1)[1]
        
        headers = {"Authorization": f"Bearer {self.key}"}
        
        payload = {
            "model": model_id,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": params.get("temperature", 0.2),
                "top_p": params.get("top_p", 1.0),
                "num_predict": params.get("max_tokens", 1024),
            }
        }
        
        try:
            r = self.session.post(f"{self.base_url}/api/generate", 
                                 json=payload, 
                                 headers=headers, 
                                 timeout=120)
            r.raise_for_status()
            
            response_data = r.json()
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Analytics recording is handled centrally in llm.py router
            
            content = response_data.get("response", "")
            return content
            
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Analytics recording is handled centrally in llm.py router
            
            raise e

    def chat_complete(self, messages, params):
        """Complete a chat using Ollama cloud API"""
        if not self.key:
            raise RuntimeError("OLLAMA_API_KEY not set")
        
        import time
        start_time = time.time()
        
        # Extract model name (remove ollama-cloud/ prefix if present)
        model_id = params.get("model_id", "")
        if model_id.startswith("ollama-cloud/"):
            model_id = model_id.split("/", 1)[1]
        
        headers = {"Authorization": f"Bearer {self.key}"}
        
        payload = {
            "model": model_id,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": params.get("temperature", 0.2),
                "top_p": params.get("top_p", 1.0),
                "num_predict": params.get("max_tokens", 1024),
            }
        }
        
        try:
            r = self.session.post(f"{self.base_url}/api/chat", 
                                 json=payload, 
                                 headers=headers, 
                                 timeout=120)
            r.raise_for_status()
            
            response_data = r.json()
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Analytics recording is handled centrally in llm.py router
            
            message = response_data.get("message", {})
            content = message.get("content", "")
            return content
            
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Analytics recording is handled centrally in llm.py router
            
            raise e


