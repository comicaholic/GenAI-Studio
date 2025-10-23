from .base import LLMProvider
from llama_cpp import Llama

class LlamaCppProvider(LLMProvider):
    def __init__(self, model_path: str):
        self.llm = Llama(model_path=model_path, n_ctx=8192)
        self.model_path = model_path
    def list_models(self):
        return [{"id": self.model_path, "label": self.model_path.split("/")[-1], "tags": ["local","gguf"]}]
    def complete(self, prompt, params, files=None):
        out = self.llm(prompt=prompt, temperature=params.get("temperature",0.2), max_tokens=params.get("max_tokens",1024))
        return out["choices"][0]["text"]
