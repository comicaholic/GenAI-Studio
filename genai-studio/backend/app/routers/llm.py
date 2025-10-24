# backend/app/routers/llm.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.llm.providers import list_groq_models, chat_complete
import os, requests
import time
import json
import re

router = APIRouter()

def fix_truncated_json(text: str) -> str:
    """
    Attempt to fix truncated JSON responses from LLMs.
    This handles common cases where JSON is cut off due to token limits.
    """
    if not text or not text.strip():
        return text
    
    # Check if the text looks like JSON (starts with { or [)
    text = text.strip()
    if not (text.startswith('{') or text.startswith('[')):
        return text
    
    # Try to parse as JSON first
    try:
        json.loads(text)
        return text  # Already valid JSON
    except json.JSONDecodeError:
        pass
    
    # If it's truncated JSON, try to fix it
    if text.startswith('{'):
        # Count opening and closing braces
        open_braces = text.count('{')
        close_braces = text.count('}')
        
        if open_braces > close_braces:
            # Add missing closing braces
            missing_braces = open_braces - close_braces
            text += '}' * missing_braces
            
            # Try to parse again
            try:
                json.loads(text)
                return text
            except json.JSONDecodeError:
                pass
        
        # If still invalid, try to close incomplete strings/objects
        # Look for incomplete string values
        if text.endswith('"') and not text.endswith('":'):
            # Likely incomplete string value
            text = text.rstrip('"') + '"}'
        elif ':' in text and not text.endswith('}'):
            # Likely incomplete object
            if text.endswith(','):
                text = text.rstrip(',') + '}'
            else:
                text += '}'
        
        # Try to parse one more time
        try:
            json.loads(text)
            return text
        except json.JSONDecodeError:
            pass
    
    elif text.startswith('['):
        # Similar logic for arrays
        open_brackets = text.count('[')
        close_brackets = text.count(']')
        
        if open_brackets > close_brackets:
            missing_brackets = open_brackets - close_brackets
            text += ']' * missing_brackets
            
            try:
                json.loads(text)
                return text
            except json.JSONDecodeError:
                pass
    
    # If we can't fix it, return the original text
    # The frontend can handle displaying it as-is
    return text

def calculate_groq_cost(model_id: str, tokens_used: int) -> float:
    """Calculate accurate cost based on Groq model pricing"""
    # Groq pricing as of 2024 (approximate rates)
    pricing = {
        # Llama models
        "llama-3.1-8b-instant": 0.0000002,  # $0.20 per 1M tokens
        "llama-3.1-70b-versatile": 0.0000007,  # $0.70 per 1M tokens
        "llama-3.1-405b-versatile": 0.0000027,  # $2.70 per 1M tokens
        "llama-3.1-90b-versatile": 0.0000009,  # $0.90 per 1M tokens
        
        # Mixtral models
        "mixtral-8x7b-32768": 0.00000027,  # $0.27 per 1M tokens
        
        # Gemma models
        "gemma-7b-it": 0.0000002,  # $0.20 per 1M tokens
        "gemma2-9b-it": 0.0000002,  # $0.20 per 1M tokens
        
        # Code models
        "llama-3.1-8b-instruct": 0.0000002,  # $0.20 per 1M tokens
        "llama-3.1-70b-instruct": 0.0000007,  # $0.70 per 1M tokens
        
        # Default fallback
        "default": 0.0000005  # $0.50 per 1M tokens
    }
    
    # Extract base model name for pricing lookup
    model_key = model_id.lower()
    
    # Try exact match first
    if model_key in pricing:
        cost_per_token = pricing[model_key]
    else:
        # Try partial matches
        cost_per_token = pricing["default"]
        for model_pattern, rate in pricing.items():
            if model_pattern != "default" and model_pattern in model_key:
                cost_per_token = rate
                break
    
    return tokens_used * cost_per_token

def estimate_tokens(text: str) -> int:
    """Estimate token count for local models"""
    if not text:
        return 0
    # Rough estimation: ~1.3 tokens per word, accounting for punctuation and encoding
    word_count = len(text.split())
    return max(1, int(word_count * 1.3))

def record_groq_usage(model: str, tokens_used: int, cost_usd: float, duration_ms: int, success: bool = True):
    """Record Groq API usage for analytics"""
    try:
        from app.routers.analytics import record_groq_usage as analytics_record
        analytics_record(model, tokens_used, cost_usd, duration_ms, success)
    except Exception as e:
        print(f"Failed to record Groq usage: {e}")

@router.get("/models")
def get_models():
    """
    Get available models for LLM inference.
    """
    from ..services.models import get_groq_models
    warning, models = get_groq_models()
    return {"models": models, "warning": warning}

class ChatMessage(BaseModel):
    role: str
    content: str

class CompleteIn(BaseModel):
    model_id: str
    provider: str  # "groq" | "local"
    messages: list[ChatMessage] | None = None
    prompt: str | None = None
    max_tokens: int | None = 1024  # Increased from 512 to help prevent JSON truncation
    temperature: float | None = 0.2
    top_p: float | None = 1.0

class ChatIn(BaseModel):
    model_id: str
    messages: list[ChatMessage]
    params: dict = {}

@router.post("/complete")
def complete(body: CompleteIn):
    if body.provider == "ollama-cloud":
        # Handle Ollama cloud API independently (like Groq)
        from app.services.llm.ollama_cloud_provider import OllamaCloudProvider
        
        # Try to get API key from environment first, then from config
        key = os.getenv("OLLAMA_API_KEY")
        if not key:
            from app.services.config import load_config
            cfg = load_config()
            key = cfg.get("ollama", {}).get("apiKey", "")
        
        if not key:
            raise HTTPException(400, "OLLAMA_API_KEY not set")

        # Accept either chat-style messages or a single prompt
        messages = body.messages
        if not messages and body.prompt:
            messages = [{"role": "user", "content": body.prompt}]
        if not messages:
            raise HTTPException(400, "messages or prompt is required")

        try:
            start_time = time.time()
            
            # Strip the ollama-cloud/ prefix if present
            ollama_model_id = body.model_id
            if ollama_model_id.startswith("ollama-cloud/"):
                ollama_model_id = ollama_model_id.split("/", 1)[1]
            
            headers = {"Authorization": f"Bearer {key}"}
            
            # Try chat API first, fallback to generate API
            try:
                r = requests.post(
                    "https://ollama.com/api/chat",
                    headers=headers,
                    json={
                        "model": ollama_model_id,
                        "messages": messages,
                        "stream": False,
                        "options": {
                            "temperature": body.temperature or 0.2,
                            "top_p": body.top_p or 1.0,
                            "num_predict": body.max_tokens or 1024,
                        },
                    },
                    timeout=120,
                )
                r.raise_for_status()
                data = r.json()
                text = (data.get("message") or {}).get("content", "")
            except Exception:
                # Fallback to generate API
                prompt_text = "\n".join([m.get("content", "") for m in messages or []])
                r = requests.post(
                    "https://ollama.com/api/generate",
                    headers=headers,
                    json={
                        "model": ollama_model_id,
                        "prompt": prompt_text,
                        "stream": False,
                        "options": {
                            "temperature": body.temperature or 0.2,
                            "top_p": body.top_p or 1.0,
                            "num_predict": body.max_tokens or 1024,
                        },
                    },
                    timeout=120,
                )
                r.raise_for_status()
                data = r.json()
                text = data.get("response", "")
            
            # Record usage for analytics (using Groq's function for now)
            duration_ms = int((time.time() - start_time) * 1000)
            tokens_estimated = estimate_tokens(text)
            record_groq_usage(body.model_id, tokens_estimated, 0.0, duration_ms, True)
            
            return {"output": text, "raw": data}
        except Exception as e:
            # Record failed request
            duration_ms = int((time.time() - start_time) * 1000)
            record_groq_usage(body.model_id, 0, 0.0, duration_ms, False)
            raise HTTPException(502, f"Ollama cloud completion failed: {e}")

    # Route to local servers (LM Studio, Ollama, or vLLM) if model_id is prefixed
    if body.provider == "local" and (body.model_id.startswith("lmstudio/") or body.model_id.startswith("ollama/") or body.model_id.startswith("vllm/")):
        from app.services.config import load_config
        cfg = load_config()
        is_lm = body.model_id.startswith("lmstudio/")
        is_ol = body.model_id.startswith("ollama/")
        is_vllm = body.model_id.startswith("vllm/")
        model_name = body.model_id.split("/", 1)[1]

        # Build messages from prompt if needed
        messages = body.messages
        if not messages and body.prompt:
            messages = [{"role": "user", "content": body.prompt}]
        if not messages:
            raise HTTPException(400, "messages or prompt is required")

        try:
            start_time = time.time()
            if is_lm:
                base = (cfg.get("lmstudio", {}).get("baseUrl") or "http://localhost:1234").rstrip('/')
                r = requests.post(
                    f"{base}/v1/chat/completions",
                    json={
                        "model": model_name,
                        "messages": messages,
                        "max_tokens": body.max_tokens or 1024,
                        "temperature": body.temperature or 0.2,
                        "top_p": body.top_p or 1.0,
                    },
                    timeout=60,
                )
                r.raise_for_status()
                data = r.json()
                text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
                text = fix_truncated_json(text)
                duration_ms = int((time.time() - start_time) * 1000)
                # Estimate tokens for local models
                tokens_estimated = estimate_tokens(text)
                record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, True)
                return {"output": text, "raw": data}
            elif is_ol:
                ol_cfg = cfg.get("ollama", {})
                
                # Determine if this is a cloud model by checking if API key is available
                # If API key is available, use cloud API; otherwise use local server
                if ol_cfg.get("apiKey") and ol_cfg.get("apiConnected"):
                    # Use Ollama cloud API
                    base = "https://ollama.com"
                else:
                    # Use local Ollama server
                    base = (ol_cfg.get("baseUrl") or "http://localhost:11434").rstrip('/')
                
                # Determine if this is a cloud model by checking if API key is needed
                # We'll try with API key first if available, then fallback to no auth
                headers = {}
                if ol_cfg.get("apiKey"):
                    headers["Authorization"] = f"Bearer {ol_cfg['apiKey']}"
                
                # Convert chat messages into single prompt (Ollama supports /api/chat too, but keep simple)
                try:
                    chat_r = requests.post(
                        f"{base}/api/chat",
                        json={
                            "model": model_name,
                            "messages": messages,
                            "stream": False,
                            "options": {
                                "temperature": body.temperature or 0.2,
                                "top_p": body.top_p or 1.0,
                                "num_predict": body.max_tokens or 1024,
                            },
                        },
                        headers=headers,
                        timeout=120,
                    )
                    chat_r.raise_for_status()
                    data = chat_r.json()
                    text = (data.get("message") or {}).get("content", "")
                except Exception:
                    # Fallback to /api/generate if /api/chat unavailable
                    prompt_text = "\n".join([m.get("content", "") for m in messages or []])
                    gen_r = requests.post(
                        f"{base}/api/generate",
                        json={
                            "model": model_name,
                            "prompt": prompt_text,
                            "stream": False,
                            "options": {
                                "temperature": body.temperature or 0.2,
                                "top_p": body.top_p or 1.0,
                                "num_predict": body.max_tokens or 1024,
                            },
                        },
                        headers=headers,
                        timeout=120,
                    )
                    gen_r.raise_for_status()
                    data = gen_r.json()
                    text = data.get("response", "")
                text = fix_truncated_json(text)
                duration_ms = int((time.time() - start_time) * 1000)
                # Estimate tokens for local models
                tokens_estimated = estimate_tokens(text)
                record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, True)
                return {"output": text, "raw": data}
            elif is_vllm:
                base = (cfg.get("vllm", {}).get("baseUrl") or "http://localhost:8000").rstrip('/')
                r = requests.post(
                    f"{base}/v1/chat/completions",
                    json={
                        "model": model_name,
                        "messages": messages,
                        "max_tokens": body.max_tokens or 1024,
                        "temperature": body.temperature or 0.2,
                        "top_p": body.top_p or 1.0,
                    },
                    timeout=60,
                )
                r.raise_for_status()
                data = r.json()
                text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
                text = fix_truncated_json(text)
                duration_ms = int((time.time() - start_time) * 1000)
                # Estimate tokens for local models
                tokens_estimated = estimate_tokens(text)
                record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, True)
                return {"output": text, "raw": data}
        except requests.exceptions.ConnectionError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Estimate tokens even for failed requests (based on input)
            tokens_estimated = estimate_tokens(str(messages))
            record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, False)
            if is_lm:
                raise HTTPException(502, f"LM Studio server not running. Please start LM Studio and ensure it's running on {base}")
            elif is_ol:
                raise HTTPException(502, f"Ollama server not running. Please start Ollama and ensure it's running on {base}")
            elif is_vllm:
                raise HTTPException(502, f"vLLM server not running. Please start vLLM and ensure it's running on {base}")
        except requests.exceptions.Timeout as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Estimate tokens even for failed requests (based on input)
            tokens_estimated = estimate_tokens(str(messages))
            record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, False)
            raise HTTPException(502, f"Local server timeout. The model may be overloaded or the request is too complex.")
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Estimate tokens even for failed requests (based on input)
            tokens_estimated = estimate_tokens(str(messages))
            record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, False)
            error_msg = str(e)
            if "Connection refused" in error_msg or "No connection could be made" in error_msg:
                if is_lm:
                    raise HTTPException(502, f"LM Studio server not running. Please start LM Studio and ensure it's running on {base}")
                elif is_ol:
                    raise HTTPException(502, f"Ollama server not running. Please start Ollama and ensure it's running on {base}")
                elif is_vllm:
                    raise HTTPException(502, f"vLLM server not running. Please start vLLM and ensure it's running on {base}")
            elif "404" in error_msg or "Not Found" in error_msg:
                raise HTTPException(502, f"Model '{model_name}' not found on local server. Please ensure the model is loaded.")
            elif "500" in error_msg or "Internal Server Error" in error_msg:
                raise HTTPException(502, f"Local server error. The model may be experiencing issues. Try restarting the local server.")
            else:
                raise HTTPException(502, f"Local server completion failed: {e}")

    if body.provider == "groq":
        # Try to get API key from environment first, then from config
        key = os.getenv("GROQ_API_KEY")
        if not key:
            from app.services.config import load_config
            cfg = load_config()
            key = cfg.get("groq", {}).get("apiKey", "")
        
        if not key:
            raise HTTPException(400, "GROQ_API_KEY not set")

        # Accept either chat-style messages or a single prompt
        messages = body.messages
        if not messages and body.prompt:
            messages = [{"role": "user", "content": body.prompt}]
        if not messages:
            raise HTTPException(400, "messages or prompt is required")

        try:
            start_time = time.time()
            # Groq exposes an OpenAI-compatible Chat Completions API
            # Strip the groq/ prefix if present
            groq_model_id = body.model_id
            if groq_model_id.startswith("groq/"):
                groq_model_id = groq_model_id.split("/", 1)[1]
            
            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": groq_model_id,
                    "messages": messages,
                    "max_tokens": body.max_tokens or 1024,
                    "temperature": body.temperature or 0.2,
                    "top_p": body.top_p or 1.0,
                },
                timeout=60,
            )
            r.raise_for_status()
            data = r.json()
            message = (data.get("choices") or [{}])[0].get("message", {})
            text = message.get("content", "")
            
            # Handle Groq models that return content in reasoning field instead of content field
            if not text and "reasoning" in message:
                text = message.get("reasoning", "")
            
            # Check if the response looks like truncated JSON and attempt to fix it
            text = fix_truncated_json(text)
            
            # Record usage for analytics
            duration_ms = int((time.time() - start_time) * 1000)
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            
            # Calculate accurate cost based on model pricing
            cost_usd = calculate_groq_cost(body.model_id, tokens_used)
            
            record_groq_usage(body.model_id, tokens_used, cost_usd, duration_ms, True)
            
            return {"output": text, "raw": data}
        except Exception as e:
            # Record failed request
            duration_ms = int((time.time() - start_time) * 1000)
            record_groq_usage(body.model_id, 0, 0.0, duration_ms, False)
            raise HTTPException(502, f"Groq completion failed: {e}")

    # Local not wired yet
    raise HTTPException(501, "Local model inference not implemented yet")

@router.post("/chat")
def chat(body: ChatIn):
    """
    Chat completion endpoint for LLM processing.
    """
    # Handle Ollama cloud API independently (like Groq)
    if body.model_id.startswith("ollama-cloud/"):
        # Try to get API key from environment first, then from config
        key = os.getenv("OLLAMA_API_KEY")
        if not key:
            from app.services.config import load_config
            cfg = load_config()
            key = cfg.get("ollama", {}).get("apiKey", "")
        
        if not key:
            raise HTTPException(400, "OLLAMA_API_KEY not set")

        # Convert messages to the format expected by Ollama
        messages = [{"role": msg.role, "content": msg.content} for msg in body.messages]

        try:
            start_time = time.time()
            
            # Strip the ollama-cloud/ prefix
            ollama_model_id = body.model_id.split("/", 1)[1]
            
            headers = {"Authorization": f"Bearer {key}"}
            
            # Try chat API first
            try:
                r = requests.post(
                    "https://ollama.com/api/chat",
                    headers=headers,
                    json={
                        "model": ollama_model_id,
                        "messages": messages,
                        "stream": False,
                        "options": {
                            "temperature": body.params.get("temperature", 0.2),
                            "top_p": body.params.get("top_p", 1.0),
                            "num_predict": body.params.get("max_tokens", 1024),
                        },
                    },
                    timeout=120,
                )
                r.raise_for_status()
                data = r.json()
                text = (data.get("message") or {}).get("content", "")
            except Exception:
                # Fallback to generate API
                prompt_text = "\n".join([m.get("content", "") for m in messages])
                r = requests.post(
                    "https://ollama.com/api/generate",
                    headers=headers,
                    json={
                        "model": ollama_model_id,
                        "prompt": prompt_text,
                        "stream": False,
                        "options": {
                            "temperature": body.params.get("temperature", 0.2),
                            "top_p": body.params.get("top_p", 1.0),
                            "num_predict": body.params.get("max_tokens", 1024),
                        },
                    },
                    timeout=120,
                )
                r.raise_for_status()
                data = r.json()
                text = data.get("response", "")
            
            text = fix_truncated_json(text)
            
            # Record usage for analytics
            duration_ms = int((time.time() - start_time) * 1000)
            tokens_estimated = estimate_tokens(text)
            record_groq_usage(body.model_id, tokens_estimated, 0.0, duration_ms, True)
            
            return {"output": text, "raw": data}
        except Exception as e:
            # Record failed request
            duration_ms = int((time.time() - start_time) * 1000)
            record_groq_usage(body.model_id, 0, 0.0, duration_ms, False)
            raise HTTPException(502, f"Ollama cloud chat failed: {e}")

    # Route to local servers if prefixed
    if body.model_id.startswith("lmstudio/") or body.model_id.startswith("ollama/") or body.model_id.startswith("vllm/"):
        from app.services.config import load_config
        cfg = load_config()
        is_lm = body.model_id.startswith("lmstudio/")
        is_ol = body.model_id.startswith("ollama/")
        is_vllm = body.model_id.startswith("vllm/")
        model_name = body.model_id.split("/", 1)[1]
        messages = [{"role": m.role, "content": m.content} for m in body.messages]
        try:
            start_time = time.time()
            if is_lm:
                base = (cfg.get("lmstudio", {}).get("baseUrl") or "http://localhost:1234").rstrip('/')
                r = requests.post(
                    f"{base}/v1/chat/completions",
                    json={
                        "model": model_name,
                        "messages": messages,
                        "temperature": body.params.get("temperature", 0.2),
                        "max_tokens": body.params.get("max_tokens", 1024),
                        "top_p": body.params.get("top_p", 1.0),
                    },
                    timeout=60,
                )
                r.raise_for_status()
                data = r.json()
                text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
                text = fix_truncated_json(text)
                duration_ms = int((time.time() - start_time) * 1000)
                # Estimate tokens for local models
                tokens_estimated = estimate_tokens(text)
                record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, True)
                return {"output": text, "raw": data}
            elif is_ol:
                base = (cfg.get("ollama", {}).get("baseUrl") or "http://localhost:11434").rstrip('/')
                ol_cfg = cfg.get("ollama", {})
                
                # Add authentication headers if API key is available
                headers = {}
                if ol_cfg.get("apiKey"):
                    headers["Authorization"] = f"Bearer {ol_cfg['apiKey']}"
                
                chat_r = requests.post(
                    f"{base}/api/chat",
                    json={
                        "model": model_name,
                        "messages": messages,
                        "stream": False,
                        "options": {
                            "temperature": body.params.get("temperature", 0.2),
                            "top_p": body.params.get("top_p", 1.0),
                            "num_predict": body.params.get("max_tokens", 1024),
                        },
                    },
                    headers=headers,
                    timeout=120,
                )
                chat_r.raise_for_status()
                data = chat_r.json()
                text = (data.get("message") or {}).get("content", "")
                text = fix_truncated_json(text)
                duration_ms = int((time.time() - start_time) * 1000)
                # Estimate tokens for local models
                tokens_estimated = estimate_tokens(text)
                record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, True)
                return {"output": text, "raw": data}
            elif is_vllm:
                base = (cfg.get("vllm", {}).get("baseUrl") or "http://localhost:8000").rstrip('/')
                r = requests.post(
                    f"{base}/v1/chat/completions",
                    json={
                        "model": model_name,
                        "messages": messages,
                        "temperature": body.params.get("temperature", 0.2),
                        "max_tokens": body.params.get("max_tokens", 1024),
                        "top_p": body.params.get("top_p", 1.0),
                    },
                    timeout=60,
                )
                r.raise_for_status()
                data = r.json()
                text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
                text = fix_truncated_json(text)
                duration_ms = int((time.time() - start_time) * 1000)
                # Estimate tokens for local models
                tokens_estimated = estimate_tokens(text)
                record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, True)
                return {"output": text, "raw": data}
        except requests.exceptions.ConnectionError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Estimate tokens even for failed requests (based on input)
            tokens_estimated = estimate_tokens(str(messages))
            record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, False)
            if is_lm:
                raise HTTPException(502, f"LM Studio server not running. Please start LM Studio and ensure it's running on {base}")
            elif is_ol:
                raise HTTPException(502, f"Ollama server not running. Please start Ollama and ensure it's running on {base}")
            elif is_vllm:
                raise HTTPException(502, f"vLLM server not running. Please start vLLM and ensure it's running on {base}")
        except requests.exceptions.Timeout as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Estimate tokens even for failed requests (based on input)
            tokens_estimated = estimate_tokens(str(messages))
            record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, False)
            raise HTTPException(502, f"Local server timeout. The model may be overloaded or the request is too complex.")
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Estimate tokens even for failed requests (based on input)
            tokens_estimated = estimate_tokens(str(messages))
            record_groq_usage(model_name, tokens_estimated, 0.0, duration_ms, False)
            error_msg = str(e)
            if "Connection refused" in error_msg or "No connection could be made" in error_msg:
                if is_lm:
                    raise HTTPException(502, f"LM Studio server not running. Please start LM Studio and ensure it's running on {base}")
                elif is_ol:
                    raise HTTPException(502, f"Ollama server not running. Please start Ollama and ensure it's running on {base}")
                elif is_vllm:
                    raise HTTPException(502, f"vLLM server not running. Please start vLLM and ensure it's running on {base}")
            elif "404" in error_msg or "Not Found" in error_msg:
                raise HTTPException(502, f"Model '{model_name}' not found on local server. Please ensure the model is loaded.")
            elif "500" in error_msg or "Internal Server Error" in error_msg:
                raise HTTPException(502, f"Local server error. The model may be experiencing issues. Try restarting the local server.")
            else:
                raise HTTPException(502, f"Local server chat failed: {e}")
    # For now, we'll use Groq for all chat completions
    # In the future, this could route to local models based on model_id
    
    # Try to get API key from environment first, then from config
    key = os.getenv("GROQ_API_KEY")
    if not key:
        from app.services.config import load_config
        cfg = load_config()
        key = cfg.get("groq", {}).get("apiKey", "")
    
    print(f"GROQ_API_KEY loaded: {bool(key)}")
    if key:
        print(f"GROQ_API_KEY length: {len(key)}")
    if not key:
        raise HTTPException(400, "GROQ_API_KEY not set")

    # No server-side model filtering; attempt request downstream and surface errors

    try:
        start_time = time.time()
        # Extract parameters with defaults
        max_tokens = body.params.get("max_tokens", 1024)
        temperature = body.params.get("temperature", 0.2)
        top_p = body.params.get("top_p", 1.0)
        # Note: Groq API doesn't support top_k parameter

        # Convert messages to the format expected by Groq
        messages = [{"role": msg.role, "content": msg.content} for msg in body.messages]

        print(f"Making Groq API request with model: {body.model_id}")
        print(f"Messages: {messages}")
        print(f"Params: max_tokens={max_tokens}, temperature={temperature}, top_p={top_p}")

        # Call Groq API (without top_k as it's not supported)
        # Strip the groq/ prefix if present
        groq_model_id = body.model_id
        if groq_model_id.startswith("groq/"):
            groq_model_id = groq_model_id.split("/", 1)[1]
        
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": groq_model_id,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
            },
            timeout=60,
        )
        
        print(f"Groq API response status: {r.status_code}")
        print(f"Groq API response text: {r.text}")
        
        r.raise_for_status()
        data = r.json()
        message = (data.get("choices") or [{}])[0].get("message", {})
        text = message.get("content", "")
        
        # Handle Groq models that return content in reasoning field instead of content field
        if not text and "reasoning" in message:
            text = message.get("reasoning", "")
        
        # Check if the response looks like truncated JSON and attempt to fix it
        text = fix_truncated_json(text)
        
        # Record usage for analytics
        duration_ms = int((time.time() - start_time) * 1000)
        usage = data.get("usage", {})
        tokens_used = usage.get("total_tokens", 0)
        
        # Calculate accurate cost based on model pricing
        cost_usd = calculate_groq_cost(body.model_id, tokens_used)
        
        record_groq_usage(body.model_id, tokens_used, cost_usd, duration_ms, True)
        
        return {"output": text, "raw": data}
    except requests.exceptions.HTTPError as e:
        # Record failed request
        duration_ms = int((time.time() - start_time) * 1000)
        record_groq_usage(body.model_id, 0, 0.0, duration_ms, False)
        print(f"HTTP Error from Groq API: {e}")
        print(f"Response status: {e.response.status_code}")
        print(f"Response text: {e.response.text}")
        raise HTTPException(502, f"Groq API HTTP error: {e.response.status_code} - {e.response.text}")
    except requests.exceptions.RequestException as e:
        # Record failed request
        duration_ms = int((time.time() - start_time) * 1000)
        record_groq_usage(body.model_id, 0, 0.0, duration_ms, False)
        print(f"Request error: {e}")
        raise HTTPException(502, f"Request failed: {e}")
    except Exception as e:
        # Record failed request
        duration_ms = int((time.time() - start_time) * 1000)
        record_groq_usage(body.model_id, 0, 0.0, duration_ms, False)
        print(f"Unexpected error: {e}")
        raise HTTPException(502, f"Chat completion failed: {e}")
