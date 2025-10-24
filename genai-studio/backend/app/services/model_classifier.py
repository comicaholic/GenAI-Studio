# backend/app/services/model_classifier.py
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class ModelMetadata:
    name: str
    publisher: str
    params: str
    quant: Optional[str]
    size: str
    category: str
    source: str
    architecture: Optional[str] = None
    description: Optional[str] = None

class ModelClassifier:
    """Classifies models into functionality categories based on their names and metadata."""
    
    # Category definitions with keywords
    CATEGORIES = {
        "General-purpose chat/instruction": {
            "keywords": [
                "llama", "mistral", "mixtral", "qwen", "gemma", "phi", "claude", "gpt",
                "chat", "instruct", "conversational", "assistant", "general", "base"
            ],
            "exclude": ["code", "coder", "embedding", "embed", "vision", "vl", "math", "reasoning"]
        },
        "Coding assistants": {
            "keywords": [
                "code", "coder", "codestral", "codegen", "starcoder", "wizardcoder", 
                "deepseek-coder", "phind", "code-llama", "octocoder", "polycoder"
            ],
            "exclude": []
        },
        "Embedding / text-vectorization": {
            "keywords": [
                "embedding", "embed", "sentence", "text-embedding", "bge", "e5", 
                "all-minilm", "all-mpnet", "paraphrase", "multilingual-e5"
            ],
            "exclude": []
        },
        "Reasoning / math / tool-use": {
            "keywords": [
                "reasoning", "math", "mathematical", "tool", "tool-use", "function", 
                "agent", "oracle", "calculator", "solver", "logic", "proof"
            ],
            "exclude": []
        },
        "Vision or multimodal": {
            "keywords": [
                "vision", "vl", "visual", "multimodal", "image", "clip", "blip", 
                "llava", "instructblip", "cogvlm", "qwen-vl", "llama-vision"
            ],
            "exclude": []
        },
        "Specialized / domain-specific": {
            "keywords": [
                "medical", "legal", "finance", "scientific", "research", "academic",
                "domain", "specialized", "expert", "professional"
            ],
            "exclude": []
        }
    }
    
    # Publisher mappings
    PUBLISHERS = {
        "meta": "Meta",
        "meta-llama": "Meta",
        "llama": "Meta",
        "mistral": "Mistral AI",
        "mixtral": "Mistral AI", 
        "qwen": "Alibaba",
        "gemma": "Google",
        "phi": "Microsoft",
        "claude": "Anthropic",
        "gpt": "OpenAI",
        "groq": "Groq",
        "deepseek": "DeepSeek",
        "codestral": "Mistral AI",
        "compound": "Groq",
        "openai": "OpenAI"
    }
    
    @classmethod
    def classify_model(cls, model_id: str, model_data: Dict = None) -> Tuple[str, str]:
        """
        Classify a model into a functionality category.
        Returns (category, publisher)
        """
        model_id_lower = model_id.lower()
        
        # Extract publisher from model ID
        publisher = cls._extract_publisher(model_id_lower)
        
        # Classify by category
        category = cls._classify_by_keywords(model_id_lower)
        
        return category, publisher
    
    @classmethod
    def _extract_publisher(cls, model_id: str) -> str:
        """Extract publisher from model ID."""
        # Check for known publishers
        for key, publisher in cls.PUBLISHERS.items():
            if key in model_id:
                return publisher
        
        # Extract from common patterns
        if "/" in model_id:
            parts = model_id.split("/")
            if len(parts) >= 2:
                potential_publisher = parts[0]
                return cls.PUBLISHERS.get(potential_publisher, potential_publisher.title())
        
        # Default fallback
        return "Unknown"
    
    @classmethod
    def _classify_by_keywords(cls, model_id: str) -> str:
        """Classify model based on keywords in the name."""
        # Check each category
        for category, config in cls.CATEGORIES.items():
            keywords = config["keywords"]
            exclude = config["exclude"]
            
            # Check if any keyword matches
            if any(keyword in model_id for keyword in keywords):
                # Check if any exclude keyword matches
                if not any(excl in model_id for excl in exclude):
                    return category
        
        # Default to unknown if no clear category
        return "Unknown / Needs Review"
    
    @classmethod
    def extract_metadata(cls, model_data: Dict) -> ModelMetadata:
        """Extract structured metadata from model data."""
        model_id = model_data.get("id", "")
        category, publisher = cls.classify_model(model_id, model_data)
        
        # Extract parameters
        params = cls._extract_params(model_id)
        
        # Extract quantization
        quant = model_data.get("quant") or cls._extract_quantization(model_id)
        
        # For Groq models, get quantization info if not already present
        if not quant and model_data.get("provider") == "groq":
            quant = cls._get_groq_quantization(model_id)
        
        # Extract size
        size = model_data.get("size", "Unknown")
        
        # Determine source - check for specific provider tags first
        source = model_data.get("source", "local")
        if model_data.get("provider") == "groq":
            source = "groq"
        elif "lmstudio" in model_data.get("tags", []):
            source = "lmstudio"
        elif "ollama" in model_data.get("tags", []):
            source = "ollama"
        elif "vllm" in model_data.get("tags", []):
            source = "vllm"
        
        # Extract architecture
        architecture = cls._extract_architecture(model_id)
        
        return ModelMetadata(
            name=model_id,
            publisher=publisher,
            params=params,
            quant=quant,
            size=size,
            category=category,
            source=source,
            architecture=architecture
        )
    
    @classmethod
    def _extract_params(cls, model_id: str) -> str:
        """Extract parameter count from model ID."""
        # Look for patterns like "7B", "13B", "70B", etc.
        param_match = re.search(r'(\d+(?:\.\d+)?)\s*(b|B)(?=[^a-zA-Z]|$)', model_id)
        if param_match:
            return f"{param_match.group(1)}B"
        
        # Look for specific known patterns
        if "tiny" in model_id.lower():
            return "~1B"
        elif "small" in model_id.lower():
            return "~3B"
        elif "medium" in model_id.lower():
            return "~7B"
        elif "large" in model_id.lower():
            return "~13B"
        elif "xl" in model_id.lower():
            return "~70B"
        
        return "Unknown"
    
    @classmethod
    def _extract_quantization(cls, model_id: str) -> Optional[str]:
        """Extract quantization type from model ID."""
        # Look for GGUF quantization patterns
        quant_match = re.search(r'(Q\d(?:_[A-Z])?(?:_[A-Z])?)', model_id.upper())
        if quant_match:
            return quant_match.group(1)
        
        # Look for other quantization patterns
        if "int4" in model_id.lower():
            return "int4"
        elif "int8" in model_id.lower():
            return "int8"
        elif "fp16" in model_id.lower():
            return "fp16"
        elif "fp32" in model_id.lower():
            return "fp32"
        
        return None
    
    @classmethod
    def _get_groq_quantization(cls, model_id: str) -> Optional[str]:
        """Get quantization information for Groq models."""
        # Groq typically uses quantized models for performance
        # Map known Groq models to their quantization types
        groq_quantization_map = {
            # Llama models - typically Q4_K_M or Q8_0
            "meta-llama/llama-3.1-8b-instruct": "Q4_K_M",
            "meta-llama/llama-3.1-70b-instruct": "Q4_K_M", 
            "meta-llama/llama-3.1-405b-instruct": "Q4_K_M",
            "meta-llama/llama-3.2-1b-instruct": "Q4_K_M",
            "meta-llama/llama-3.2-3b-instruct": "Q4_K_M",
            "meta-llama/llama-3.2-11b-instruct": "Q4_K_M",
            "meta-llama/llama-3.2-90b-instruct": "Q4_K_M",
            "meta-llama/llama-3.3-70b-instruct": "Q4_K_M",
            "meta-llama/llama-3.3-405b-instruct": "Q4_K_M",
            "meta-llama/llama-4-scout-17b-16e-instruct": "Q4_K_M",
            "meta-llama/llama-4-maverick-17b-128e-instruct": "Q4_K_M",
            "meta-llama/llama-prompt-guard-2-22m": "Q4_K_M",
            
            # Mistral models - typically Q4_K_M
            "mistralai/mistral-7b-instruct": "Q4_K_M",
            "mistralai/mixtral-8x7b-instruct": "Q4_K_M",
            "mistralai/mixtral-8x22b-instruct": "Q4_K_M",
            "mistralai/codestral-22b-instruct": "Q4_K_M",
            
            # Qwen models - typically Q4_K_M
            "qwen/qwen-2.5-7b-instruct": "Q4_K_M",
            "qwen/qwen-2.5-14b-instruct": "Q4_K_M",
            "qwen/qwen-2.5-32b-instruct": "Q4_K_M",
            "qwen/qwen-2.5-72b-instruct": "Q4_K_M",
            
            # Gemma models - typically Q4_K_M
            "google/gemma-2-9b-it": "Q4_K_M",
            "google/gemma-2-27b-it": "Q4_K_M",
            
            # DeepSeek models - typically Q4_K_M
            "deepseek/deepseek-coder-6.7b-instruct": "Q4_K_M",
            "deepseek/deepseek-coder-33b-instruct": "Q4_K_M",
            "deepseek/deepseek-math-7b-instruct": "Q4_K_M",
            "deepseek/deepseek-math-67b-instruct": "Q4_K_M",
            
            # Other models
            "moonshotai/kimi-k2-instruct": "Q4_K_M",
        }
        
        # Check exact match first
        if model_id in groq_quantization_map:
            return groq_quantization_map[model_id]
        
        # Check for partial matches based on model family
        model_id_lower = model_id.lower()
        
        # Llama models
        if "llama" in model_id_lower:
            if "70b" in model_id_lower or "405b" in model_id_lower:
                return "Q4_K_M"  # Large models typically use Q4_K_M
            elif "8b" in model_id_lower or "7b" in model_id_lower:
                return "Q4_K_M"  # Medium models typically use Q4_K_M
            else:
                return "Q4_K_M"  # Default for Llama models
        
        # Mistral models
        elif "mistral" in model_id_lower or "mixtral" in model_id_lower:
            return "Q4_K_M"
        
        # Qwen models
        elif "qwen" in model_id_lower:
            return "Q4_K_M"
        
        # Gemma models
        elif "gemma" in model_id_lower:
            return "Q4_K_M"
        
        # DeepSeek models
        elif "deepseek" in model_id_lower:
            return "Q4_K_M"
        
        # Default for unknown Groq models
        return "Q4_K_M"
    
    @classmethod
    def _extract_architecture(cls, model_id: str) -> Optional[str]:
        """Extract architecture from model ID."""
        model_id_lower = model_id.lower()
        
        if "llama" in model_id_lower:
            return "LLaMA"
        elif "mistral" in model_id_lower or "mixtral" in model_id_lower:
            return "Mistral/Mixtral"
        elif "qwen" in model_id_lower:
            return "Qwen"
        elif "gemma" in model_id_lower:
            return "Gemma"
        elif "phi" in model_id_lower:
            return "Phi"
        elif "gpt" in model_id_lower:
            return "GPT"
        elif "claude" in model_id_lower:
            return "Claude"
        elif "codestral" in model_id_lower:
            return "CodeStral"
        elif "deepseek" in model_id_lower:
            return "DeepSeek"
        
        return None

def classify_models(models: List[Dict]) -> List[Dict]:
    """Classify a list of models and return structured metadata."""
    classifier = ModelClassifier()
    classified_models = []
    
    for model in models:
        try:
            metadata = classifier.extract_metadata(model)
            # Preserve original model data and add classification metadata
            classified_model = {
                **model,  # Preserve all original fields including 'id'
                "name": metadata.name,
                "publisher": metadata.publisher,
                "params": metadata.params,
                "quant": metadata.quant,
                "size": metadata.size,
                "category": metadata.category,
                "source": metadata.source,
                "architecture": metadata.architecture,
                "original_data": model  # Keep original data for reference
            }
            classified_models.append(classified_model)
        except Exception as e:
            print(f"Error classifying model {model.get('id', 'unknown')}: {e}")
            # Add fallback entry with original data preserved
            fallback_model = {
                **model,  # Preserve all original fields including 'id'
                "name": model.get("id", "Unknown"),
                "publisher": "Unknown",
                "params": "Unknown",
                "quant": None,
                "size": model.get("size", "Unknown"),
                "category": "Unknown / Needs Review",
                "source": model.get("provider", "unknown"),
                "architecture": None,
                "original_data": model
            }
            classified_models.append(fallback_model)
    
    return classified_models

