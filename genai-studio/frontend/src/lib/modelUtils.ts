// frontend/src/lib/modelUtils.ts
// Shared utilities for model identification and key generation

export interface ModelInfo {
  id: string;
  label?: string;
  name?: string;
  publisher?: string;
  arch?: string;
  size?: string;
  quant?: string;
  provider?: string;
  source?: string;
  category?: string;
  params?: string;
  architecture?: string;
  tags?: string[];
  // Additional fields for compatibility
  [key: string]: any;
}

/**
 * Creates a stable, deterministic key for model identification.
 * This function must be consistent across all components to ensure
 * proper React key generation and state management.
 */
export function modelKey(m: ModelInfo): string {
  // Prefer canonical IDs; otherwise fall back to deterministic label/name-based keys
  if (m.id && m.id.trim()) {
    return m.id.trim();
  }
  
  // Try label as fallback
  if (m.label && m.label.trim()) {
    return `label:${m.label.trim()}`;
  }
  
  // Try name as fallback
  if (m.name && m.name.trim()) {
    return `name:${m.name.trim()}`;
  }
  
  // Last resort: a deterministic composite so rows don't share a key
  return `anon:${(m.publisher || '')}:${(m.arch || m.architecture || '')}:${(m.size || '')}:${(m.quant || '')}`;
}

/**
 * Normalizes model data from various sources to ensure consistent structure
 */
export function normalizeModelData(raw: any, provider: "local" | "groq"): ModelInfo {
  // Handle classified models structure where original data is in original_data
  const originalData = raw?.original_data || raw;
  const id = originalData?.id || raw?.id || raw?.name || raw?.model_id || raw?.model || "";
  
  // Clean up label by removing provider prefixes
  let label = raw?.name || originalData?.label || originalData?.name || prettifyModelId(id);
  label = String(label).trim();
  
  // Remove common provider prefixes from the label
  const providerPrefixes = ['lmstudio/', 'ollama/', 'vllm/', 'groq/'];
  for (const prefix of providerPrefixes) {
    if (label.toLowerCase().startsWith(prefix.toLowerCase())) {
      label = label.substring(prefix.length);
      break;
    }
  }
  
  const sizeRaw = raw?.size || originalData?.size || originalData?.details?.size || null;
  const size = sizeRaw; // Keep "hosted" as is, don't convert to null
  const quant = raw?.quant || originalData?.quant || originalData?.details?.quantization || null;
  const tags = Array.isArray(raw?.tags) ? raw.tags : (Array.isArray(originalData?.tags) ? originalData.tags : undefined);
  const context = originalData?.context || originalData?.details?.context || null;
  const architecture = raw?.architecture || originalData?.architecture || originalData?.details?.architecture || null;
  const downloadedSize = originalData?.downloaded_size || originalData?.details?.downloaded_size || null;
  const lastUsed = originalData?.last_used || originalData?.details?.last_used || null;
  const hasConfig = originalData?.has_config || originalData?.details?.has_config || false;
  const hasPreview = originalData?.has_preview || originalData?.details?.has_preview || false;
  
  // Get additional metadata from classified models
  const source = raw?.source || originalData?.source || "local";
  const category = raw?.category || null;
  const publisher = raw?.publisher || null;
  const params = raw?.params || null;
  
  // Determine format based on file path or other indicators
  let format = null;
  if (provider === "local") {
    const path = originalData?.path || "";
    if (path.toLowerCase().includes(".gguf")) {
      format = "GGUF";
    } else if (path.toLowerCase().includes(".safetensors")) {
      format = "Safetensors";
    } else if (path.toLowerCase().includes(".bin")) {
      format = "GGML";
    } else if (path.toLowerCase().includes(".pth")) {
      format = "PyTorch";
    }
  } else if (provider === "groq") {
    // Groq models are hosted, no specific format
    format = null;
  }
  
  return { 
    id: String(id), 
    label: String(label), 
    provider, 
    size: size ? String(size) : null, 
    quant: quant ? String(quant) : null, 
    tags,
    context: context ? Number(context) : null,
    architecture: architecture ? String(architecture) : null,
    downloadedSize: downloadedSize ? String(downloadedSize) : null,
    lastUsed: lastUsed ? String(lastUsed) : null,
    hasConfig,
    hasPreview,
    format,
    // Additional metadata from classified models
    source: String(source),
    category: category ? String(category) : null,
    publisher: publisher ? String(publisher) : null,
    params: params ? String(params) : null
  };
}

/**
 * Prettifies model ID for display purposes
 */
export function prettifyModelId(id: string | undefined | null): string {
  if (!id) return "Unknown model";
  const trimmed = id.trim();
  const parts = trimmed.split(/[/:]/);
  const last = parts[parts.length - 1] || trimmed;
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Validates model data structure
 */
export function validateModelData(model: any): boolean {
  if (!model || typeof model !== 'object') {
    return false;
  }
  
  // Must have either id, label, or name
  const hasIdentifier = !!(model.id || model.label || model.name);
  if (!hasIdentifier) {
    console.warn('Model missing identifier:', model);
    return false;
  }
  
  return true;
}

/**
 * Gets category color for UI display
 */
export function getCategoryColor(category: string): string {
  const colors: { [key: string]: string } = {
    "General-purpose chat/instruction": "#3b82f6",
    "Coding assistants": "#10b981",
    "Embedding / text-vectorization": "#8b5cf6",
    "Reasoning / math / tool-use": "#f59e0b",
    "Vision or multimodal": "#ef4444",
    "Specialized / domain-specific": "#06b6d4",
    "Unknown / Needs Review": "#6b7280"
  };
  return colors[category] || "#6b7280";
}

/**
 * Gets provider color for UI display
 */
export function getProviderColor(source: string): string {
  const colors: { [key: string]: string } = {
    "groq": "#059669",
    "lmstudio": "#8b5cf6",
    "ollama": "#3b82f6",
    "vllm": "#f59e0b",
    "local": "#6b7280"
  };
  return colors[source] || "#6b7280";
}

/**
 * Gets provider display name
 */
export function getProviderDisplayName(source: string): string {
  const names: { [key: string]: string } = {
    "groq": "Groq",
    "lmstudio": "LM Studio",
    "ollama": "Ollama",
    "vllm": "vLLM",
    "local": "Local"
  };
  return names[source] || "Unknown";
}


