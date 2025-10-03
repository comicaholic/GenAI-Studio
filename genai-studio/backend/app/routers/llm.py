# backend/app/routers/llm.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.llm.providers import list_groq_models, chat_complete
import os, requests
import time

router = APIRouter()

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
    max_tokens: int | None = 512
    temperature: float | None = 0.2
    top_p: float | None = 1.0

class ChatIn(BaseModel):
    model_id: str
    messages: list[ChatMessage]
    params: dict = {}

@router.post("/complete")
def complete(body: CompleteIn):
    if body.provider == "groq":
        key = os.getenv("GROQ_API_KEY")
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
            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": body.model_id,
                    "messages": messages,
                    "max_tokens": body.max_tokens or 512,
                    "temperature": body.temperature or 0.2,
                    "top_p": body.top_p or 1.0,
                },
                timeout=60,
            )
            r.raise_for_status()
            data = r.json()
            text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
            
            # Record usage for analytics
            duration_ms = int((time.time() - start_time) * 1000)
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            
            # Estimate cost (rough approximation based on Groq pricing)
            # This is a simplified calculation - actual pricing may vary
            cost_per_token = 0.0000005  # Rough estimate
            cost_usd = tokens_used * cost_per_token
            
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
    # For now, we'll use Groq for all chat completions
    # In the future, this could route to local models based on model_id
    key = os.getenv("GROQ_API_KEY")
    print(f"GROQ_API_KEY loaded: {bool(key)}")
    if key:
        print(f"GROQ_API_KEY length: {len(key)}")
    if not key:
        raise HTTPException(400, "GROQ_API_KEY not set")

    # No server-side model filtering; attempt request downstream and surface errors

    try:
        start_time = time.time()
        # Extract parameters with defaults
        max_tokens = body.params.get("max_tokens", 512)
        temperature = body.params.get("temperature", 0.2)
        top_p = body.params.get("top_p", 1.0)
        # Note: Groq API doesn't support top_k parameter

        # Convert messages to the format expected by Groq
        messages = [{"role": msg.role, "content": msg.content} for msg in body.messages]

        print(f"Making Groq API request with model: {body.model_id}")
        print(f"Messages: {messages}")
        print(f"Params: max_tokens={max_tokens}, temperature={temperature}, top_p={top_p}")

        # Call Groq API (without top_k as it's not supported)
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": body.model_id,
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
        text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
        
        # Record usage for analytics
        duration_ms = int((time.time() - start_time) * 1000)
        usage = data.get("usage", {})
        tokens_used = usage.get("total_tokens", 0)
        
        # Estimate cost (rough approximation based on Groq pricing)
        cost_per_token = 0.0000005  # Rough estimate
        cost_usd = tokens_used * cost_per_token
        
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
