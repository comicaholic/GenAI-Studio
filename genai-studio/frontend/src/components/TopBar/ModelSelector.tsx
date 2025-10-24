// frontend/src/components/TopBar/ModelSelector.tsx
import React from "react";
import Switch from "@/components/ui/Switch";
import axios from "axios";
import { useModel } from "@/context/ModelContext";
import { QuantizationTag, ArchitectureTag, FormatTag, ConfigIcon, PreviewIcon, Tag } from "@/components/ui/ModelTags";
import { 
  modelKey, 
  normalizeModelData, 
  prettifyModelId, 
  getProviderColor, 
  getProviderDisplayName,
  validateModelData,
  type ModelInfo 
} from "@/lib/modelUtils";

type SortOption = "recency" | "size";

type ListResponse = {
  local: any[];
  groq: any[];
  warning?: { warning?: string; error?: string } | null;
};

function useClickOutside<T extends HTMLElement>(onAway: () => void) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onAway();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [onAway]);
  return ref;
}

/**
 * Highlights search terms in text
 */
function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm.trim()) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <span key={index} style={{ backgroundColor: '#fbbf24', color: '#1e293b', fontWeight: 600 }}>
        {part}
      </span>
    ) : part
  );
}


export default function ModelSelector() {
  const { selected, setSelected } = useModel();

  const [open, setOpen] = React.useState(false);
  const [localModels, setLocalModels] = React.useState<ModelInfo[]>([]);
  const [groqModels, setGroqModels] = React.useState<ModelInfo[]>([]);
  const [includeGroq, setIncludeGroq] = React.useState(true);
  const [groqConnected, setGroqConnected] = React.useState(false);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [disabledIds, setDisabledIds] = React.useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = React.useState<SortOption>("recency");
  const [modelMemoryUsage, setModelMemoryUsage] = React.useState<{ 
    used: number; 
    total: number; 
    estimated?: number;
    isLoaded: boolean;
  } | null>(null);

  const [query, setQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const rootRef = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const fetchModelMemoryUsage = React.useCallback(async (modelId: string) => {
    if (!modelId || modelId.startsWith('groq/')) {
      setModelMemoryUsage(null);
      return;
    }
    
    try {
      // Get GPU memory usage from analytics system endpoint (like AnalyticsPage)
      const { data: systemData } = await axios.get('/api/analytics/system');
      
      if (systemData.gpu && systemData.gpu.memory_used_gb !== null && systemData.gpu.memory_total_gb !== null) {
        // Show total GPU memory usage like AnalyticsPage
        setModelMemoryUsage({
          used: systemData.gpu.memory_used_gb,
          total: systemData.gpu.memory_total_gb,
          estimated: systemData.gpu.memory_used_gb, // Use actual usage as "estimated"
          isLoaded: true // Always show as loaded since this is real GPU data
        });
      } else {
        // Fallback to model-specific memory endpoint if GPU data not available
        const { data } = await axios.get(`/api/models/memory/${encodeURIComponent(modelId)}`);
        
        if (data.used !== null && data.total !== null) {
          setModelMemoryUsage({
            used: data.used,
            total: data.total,
            estimated: data.estimated,
            isLoaded: data.isLoaded
          });
        } else if (data.tracked_memory_gb && data.tracked_memory_gb > 0) {
          setModelMemoryUsage({
            used: data.tracked_memory_gb,
            total: data.tracked_memory_gb,
            estimated: data.estimated,
            isLoaded: data.isLoaded
          });
        } else if (data.estimated) {
          setModelMemoryUsage({
            used: 0,
            total: data.estimated,
            estimated: data.estimated,
            isLoaded: data.isLoaded
          });
        } else {
          setModelMemoryUsage(null);
        }
      }
    } catch (error) {
      console.warn("Failed to fetch model memory usage:", error);
      setModelMemoryUsage(null);
    }
  }, []);

  const fetchModels = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Get unfiltered models from backend (same as ModelsPage)
      const { data } = await axios.get("/api/models/classified", {
        params: { 
          include_groq: includeGroq,
          include_ollama_cloud: true,  // Include Ollama cloud models
          apply_visibility_filter: false  // Get all models, apply filtering on frontend
        },
      });
      
      // The classified endpoint returns all models in a single array
      const allModels = data.models || [];
      
      // Validate and normalize model data
      const validModels = allModels.filter(validateModelData);
      
      // Separate local, groq, and ollama-cloud models from classified data
      const locals = validModels.filter(m => m.source !== "groq" && m.source !== "ollama-cloud").map(m => normalizeModelData(m, "local"));
      const groqs = validModels.filter(m => m.source === "groq").map(m => normalizeModelData(m, "groq"));
      const ollamaClouds = validModels.filter(m => m.source === "ollama-cloud").map(m => normalizeModelData(m, "ollama-cloud"));
      
      setLocalModels([...locals, ...ollamaClouds]); // Combine local and ollama-cloud models
      setGroqModels(groqs);
      setWarning(data.warning?.warning || data.warning?.error || null);
      setGroqConnected(!data.warning?.error);
    } catch (error) {
      // Fallback to original /list endpoint if classified fails
      console.warn("Failed to fetch classified models, falling back to list endpoint:", error);
      const { data } = await axios.get<ListResponse>("/api/models/list", {
        params: { 
          include_groq: includeGroq,
          include_ollama_cloud: true  // Include Ollama cloud models
        },
      });
      
      // Validate and normalize model data
      const validLocalModels = (data.local || []).filter(validateModelData);
      const validGroqModels = (data.groq || []).filter(validateModelData);
      const validOllamaCloudModels = (data.ollama_cloud || []).filter(validateModelData);
      
      const locals = validLocalModels.map(m => normalizeModelData(m, "local"));
      const groqs = validGroqModels.map(m => normalizeModelData(m, "groq"));
      const ollamaClouds = validOllamaCloudModels.map(m => normalizeModelData(m, "ollama-cloud"));
      
      setLocalModels([...locals, ...ollamaClouds]); // Combine local and ollama-cloud models
      setGroqModels(groqs);
      setWarning(data.warning?.warning || data.warning?.error || null);
      setGroqConnected(!data.warning?.error);
    } finally {
      setIsLoading(false);
    }
  }, [includeGroq]);

  React.useEffect(() => { 
    fetchModels(); 
  }, [fetchModels]);

  // Fetch model memory usage when selected model changes
  React.useEffect(() => {
    if (selected?.id) {
      fetchModelMemoryUsage(selected.id);
      
      // Set up periodic refresh of memory usage
      const interval = setInterval(() => {
        fetchModelMemoryUsage(selected.id);
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [selected?.id, fetchModelMemoryUsage]);

  React.useEffect(() => {
    const handler = () => fetchModels();
    window.addEventListener("models:changed", handler);
    return () => window.removeEventListener("models:changed", handler);
  }, [fetchModels]);

  // listen to visibility changes from Models page
  React.useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get("/api/models/visibility");
        const arr: string[] | null = data.enabled_ids ?? null;
        
        if (arr === null) {
          setDisabledIds(new Set());
        } else {
          // The API returns actual model IDs, not keys
          // We need to convert these to modelKey format for filtering
          const enabled = new Set(arr);
          const allModels = [...localModels, ...groqModels];
          
          // Create disabled set using modelKey format
          const disabledKeys = new Set<string>();
          for (const model of allModels) {
            const key = modelKey(model);
            // If the model's actual ID is not in the enabled list, mark the key as disabled
            if (model.id && !enabled.has(model.id)) {
              disabledKeys.add(key);
            }
          }
          
          setDisabledIds(disabledKeys);
        }
      } catch (error) {
        console.error("Error loading visibility:", error);
        setDisabledIds(new Set());
      }
    };
    load();
    const onChange = () => load();
    window.addEventListener("models:visibility-changed", onChange);
    return () => window.removeEventListener("models:visibility-changed", onChange);
  }, [localModels, groqModels]);

  const allModels = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const filter = (m: ModelInfo) => {
      const key = modelKey(m);
      const isDisabled = disabledIds.has(key);
      
      if (isDisabled) return false;
      if (!q) return true;
      
      // Enhanced search across multiple model properties
      const searchableFields = [
        m.label,
        m.name,
        m.id,
        m.publisher,
        m.category,
        m.architecture,
        m.arch,
        m.quant,
        m.size,
        m.source,
        m.format,
        m.params
      ].filter(Boolean).map(field => String(field).toLowerCase());
      
      // Also search in tags array if it exists
      const tagFields = Array.isArray(m.tags) ? m.tags.map(tag => String(tag).toLowerCase()) : [];
      
      // Check if query matches any field or tag
      const matchesQuery = searchableFields.some(field => field.includes(q)) ||
                          tagFields.some(tag => tag.includes(q));
      
      return matchesQuery;
    };

    const local = localModels.filter(filter);
    const groq = includeGroq ? groqModels.filter(filter) : [];

    // Sort models based on selected sort option
    const sortModels = (models: ModelInfo[]) => {
      return [...models].sort((a, b) => {
        if (sortBy === "recency") {
          // Sort by last used (most recent first)
          const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          return bTime - aTime;
        } else if (sortBy === "size") {
          // Sort by model size (largest first)
          const aSize = parseFloat(a.size || "0");
          const bSize = parseFloat(b.size || "0");
          return bSize - aSize;
        }
        return 0;
      });
    };

    return {
      local: sortModels(local),
      groq: sortModels(groq),
    };
  }, [localModels, groqModels, includeGroq, query, disabledIds, sortBy]);

  const noneAvailable = allModels.local.length === 0 && allModels.groq.length === 0;
  const totalFilteredCount = allModels.local.length + allModels.groq.length;
  const totalAvailableCount = localModels.length + groqModels.length;

  const closedLabel = selected
    ? (selected.label && selected.label.trim() ? selected.label : prettifyModelId(selected.id))
    : (noneAvailable ? "No models available" : "Select a model…");

  const handleEject = async () => {
    if (selected?.id) {
      try {
        // Call the unload endpoint to unload the model from the provider
        const response = await axios.post(`/api/models/unload/${encodeURIComponent(selected.id)}`);
        
        if (response.data.success) {
          console.log(`Model ${selected.id} unloaded from provider:`, response.data.message);
          // Show success notification if you have a notification system
          // You could add a toast notification here
        } else {
          console.warn("Model unload failed:", response.data.message);
          // Show warning notification
        }
      } catch (error: any) {
        console.warn("Failed to unload model from provider:", error);
        // Show error notification
        if (error.response?.data?.message) {
          console.warn("Unload error:", error.response.data.message);
        }
        // Still proceed with ejecting from selection even if unload fails
      }
    }
    setSelected(null);
  };

  const handleRefreshMemory = React.useCallback(() => {
    if (selected?.id) {
      fetchModelMemoryUsage(selected.id);
    }
  }, [selected?.id, fetchModelMemoryUsage]);

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={styles.container}>
      {/* Eject button */}
      <button
        type="button"
        onClick={handleEject}
        title="Eject model"
        style={{
          ...styles.ejectButton,
          opacity: selected ? 1 : 0.3,
          cursor: selected ? "pointer" : "not-allowed",
        }}
        disabled={!selected}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
        </svg>
      </button>

      <div ref={rootRef} style={styles.root}>
        {/* Closed button */}
        <button
          type="button"
          onClick={() => {
            setOpen(o => !o);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          style={styles.button}
        >
          <span style={styles.buttonText}>{closedLabel}</span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z" />
          </svg>
        </button>

        {/* Enhanced Popover */}
        {open && (
          <div style={styles.popover} className="rb-bounce">
            {/* Header with search and memory */}
            <div style={styles.header}>
              <div style={styles.searchContainer}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={styles.searchIcon}>
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input
                  ref={inputRef}
                  placeholder="Search by name, category, architecture, size, quantization..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={styles.search}
                />
              </div>
              {selected && selected.provider === "local" && modelMemoryUsage && (
                <div style={styles.memoryContainer}>
                  <span style={styles.memoryLabel}>
                    GPU Memory Usage:
                  </span>
                  <span style={styles.memoryValue}>
                    {`${modelMemoryUsage.used.toFixed(2)} GB / ${modelMemoryUsage.total.toFixed(2)} GB`}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshMemory}
                    style={styles.refreshButton}
                    title="Refresh GPU memory usage"
                  >
                    🔄
                  </button>
                </div>
              )}
              {query.trim() && (
                <div style={styles.searchResultsCount}>
                  {totalFilteredCount} of {totalAvailableCount} models
                </div>
              )}
              <button
                type="button"
                onClick={fetchModels}
                style={styles.refreshButton}
                title="Refresh models"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={styles.closeButton}
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>

            {/* Currently Loaded Section */}
            {selected && (
              <div style={styles.currentlyLoadedSection}>
                <div style={styles.currentlyLoadedHeader}>
                  Currently Loaded (1)
                </div>
                <div style={styles.currentlyLoadedCard}>
                  <div style={styles.currentlyLoadedContent}>
                    <div style={styles.currentlyLoadedName}>{selected.label || prettifyModelId(selected.id)}</div>
                    <div style={styles.currentlyLoadedTags}>
                      {selected.context && (
                        <Tag variant="quantization" tooltip={`Context window size: ${selected.context} tokens`}>
                          Context: {selected.context}
                        </Tag>
                      )}
                      {selected.format && <FormatTag format={selected.format} />}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleEject}
                    style={styles.ejectButtonInCard}
                    title="Eject model"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                    </svg>
                    Eject
                  </button>
                </div>
              </div>
            )}

            {/* Filter Buttons */}
            <div style={styles.filterSection}>
              <div style={styles.filterButtons}>
                <button
                  type="button"
                  onClick={() => setSortBy("recency")}
                  style={{
                    ...styles.filterButton,
                    ...(sortBy === "recency" ? styles.filterButtonActive : {})
                  }}
                >
                  Recency ↓
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("size")}
                  style={{
                    ...styles.filterButton,
                    ...(sortBy === "size" ? styles.filterButtonActive : {})
                  }}
                >
                  Size
                </button>
              </div>
            </div>

            {/* Models List */}
            <div style={styles.modelsList}>
              {isLoading ? (
                <div style={styles.loadingContainer}>
                  <div style={styles.loadingSpinner}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                    </svg>
                  </div>
                  <div style={styles.loadingText}>Loading models...</div>
                </div>
              ) : noneAvailable ? (
                <div style={styles.empty}>
                  {query.trim() ? (
                    <>
                      No models match "{query}".<br />
                      Try searching for: name, category, architecture, size, or quantization.
                    </>
                  ) : (
                    <>
                      No models available.<br />
                      Use the Models page to discover and load models.
                    </>
                  )}
                </div>
              ) : (
                /* All Models (Local + Groq combined) */
                [...allModels.local, ...allModels.groq].map(m => (
                  <div
                    key={m.id}
                    style={styles.modelCard}
                    onClick={async () => { 
                      setSelected(m); 
                      setOpen(false);
                      
                      // Check if auto-loading is enabled
                      try {
                        const settingsResponse = await axios.get("/api/settings/settings");
                        const autoLoadEnabled = settingsResponse.data?.localModels?.autoLoadOnSelect ?? true;
                        
                        if (autoLoadEnabled) {
                          // Try to load the model in the appropriate provider
                          try {
                            const response = await axios.post(`/api/models/load/${encodeURIComponent(m.id)}`);
                            if (response.data.success) {
                              console.log("Model loaded successfully:", response.data.message);
                              // Show success notification
                              // You can add a notification system here if you have one
                            } else {
                              console.warn("Model load failed:", response.data.message);
                              // Show warning notification
                            }
                          } catch (error: any) {
                            console.error("Failed to load model:", error);
                            // Show error notification
                            if (error.response?.status === 400) {
                              console.warn("No provider configured for model loading");
                            } else if (error.response?.status === 502) {
                              console.warn("Provider not responding - model may not be available");
                            }
                          }
                        } else {
                          console.log("Auto-loading disabled, model not loaded automatically");
                        }
                      } catch (error) {
                        console.warn("Failed to check auto-loading setting:", error);
                        // Default to auto-loading if we can't check the setting
                        try {
                          const response = await axios.post(`/api/models/load/${encodeURIComponent(m.id)}`);
                          if (response.data.success) {
                            console.log("Model loaded successfully:", response.data.message);
                          } else {
                            console.warn("Model load failed:", response.data.message);
                          }
                        } catch (loadError: any) {
                          console.error("Failed to load model:", loadError);
                        }
                      }
                    }}
                    className="rb-hover-lift rb-press"
                  >
                    <div style={styles.modelCardContent}>
                      <div style={styles.modelCardHeader}>
                        <div style={styles.modelCardName}>
                          {highlightSearchTerm(m.label || prettifyModelId(m.id), query)}
                        </div>
                        <div style={styles.modelCardTags}>
                          {m.quant && <QuantizationTag quant={m.quant} />}
                          {m.hasConfig && <ConfigIcon />}
                          {m.hasPreview && <PreviewIcon />}
                        </div>
                      </div>
                      <div style={styles.modelCardMeta}>
                        <div style={styles.modelCardSize}>{m.size || "Unknown"}</div>
                        {m.architecture && <ArchitectureTag arch={m.architecture} />}
                        {m.format && <FormatTag format={m.format} />}
                        {m.downloadedSize && (
                          <span style={styles.modelCardDownloadedSize}>{m.downloadedSize}</span>
                        )}
                        {/* Provider and source tags */}
                        {m.source && m.source !== "local" && (
                          <span style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 500,
                            background: m.source === "groq" ? "#059669" : 
                                       m.source === "lmstudio" ? "#8b5cf6" :
                                       m.source === "ollama" ? "#3b82f6" :
                                       m.source === "vllm" ? "#f59e0b" : "#6b7280",
                            color: "#fff",
                            display: "inline-block"
                          }}>
                            {m.source === "groq" ? "Groq" : 
                             m.source === "lmstudio" ? "LM Studio" :
                             m.source === "ollama" ? "Ollama" :
                             m.source === "vllm" ? "vLLM" : m.source}
                          </span>
                        )}
                        {m.category && (
                          <span style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 500,
                            background: "#6b7280",
                            color: "#fff",
                            display: "inline-block"
                          }}>
                            {m.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

/* ---------- Enhanced styles matching the image design ---------- */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  ejectButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e2e8f0",
    fontSize: 16,
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
  },
  root: { 
    position: "relative", 
    display: "inline-block",
    zIndex: 99999
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    minWidth: 400,
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
  },
  buttonText: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    flex: 1,
    textAlign: "left",
    fontSize: 14,
    fontWeight: 500
  },
  popover: {
    position: "absolute",
    top: "calc(100% + 12px)",
    left: -150,
    zIndex: 99999,
    width: 700,
    maxHeight: 600,
    overflow: "auto",
    background: "#0b1220",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #334155",
    gap: 16,
  },
  searchContainer: {
    display: "flex",
    alignItems: "center",
    position: "relative",
    flex: 1,
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    color: "#94a3b8",
    zIndex: 1,
  },
  search: {
    padding: "10px 12px 10px 40px",
    border: "1px solid #334155",
    borderRadius: 10,
    background: "#1e293b",
    color: "#e2e8f0",
    outline: "none",
    fontSize: 14,
    transition: "all 0.2s ease",
    width: "100%",
  },
  memoryContainer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#cbd5e1",
  },
  memoryLabel: {
    color: "#cbd5e1",
  },
  memoryValue: {
    color: "#60a5fa",
    fontWeight: 500,
  },
  searchResultsCount: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 500,
    padding: "4px 8px",
    borderRadius: 6,
    background: "#1e293b",
    border: "1px solid #334155",
  },
  refreshButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    transition: "all 0.2s ease",
    padding: 0,
  },
  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  currentlyLoadedSection: {
    padding: "16px 20px",
    borderBottom: "1px solid #334155",
  },
  currentlyLoadedHeader: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e2e8f0",
    marginBottom: 12,
  },
  currentlyLoadedCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: "#1e293b",
    borderRadius: 12,
    border: "1px solid #475569",
  },
  currentlyLoadedContent: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  currentlyLoadedName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#e2e8f0",
  },
  currentlyLoadedTags: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  ejectButtonInCard: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 8,
    border: "none",
    background: "#60a5fa",
    color: "#1e293b",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  filterSection: {
    padding: "16px 20px",
    borderBottom: "1px solid #334155",
  },
  filterButtons: {
    display: "flex",
    gap: 8,
  },
  filterButton: {
    padding: "8px 16px",
    borderRadius: 20,
    border: "none",
    background: "#374151",
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  filterButtonActive: {
    background: "#60a5fa",
    color: "#1e293b",
  },
  modelsList: {
    padding: "8px 0",
    maxHeight: 300,
    overflow: "auto",
  },
  modelCard: {
    padding: "16px 20px",
    cursor: "pointer",
    borderBottom: "1px solid #334155",
    transition: "background-color 0.2s ease",
  },
  modelCardContent: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  modelCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modelCardName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#e2e8f0",
  },
  modelCardTags: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  modelCardMeta: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 12,
    color: "#94a3b8",
  },
  modelCardAuthor: {
    color: "#94a3b8",
    fontWeight: 500,
  },
  modelCardSize: {
    color: "#94a3b8",
    fontWeight: 500,
  },
  modelCardDownloadedSize: {
    color: "#94a3b8",
    fontWeight: 500,
  },
  empty: { 
    padding: "40px 20px", 
    fontSize: 14, 
    color: "#94a3b8", 
    textAlign: "center",
    background: "#1e293b",
    margin: "8px 20px",
    borderRadius: 12,
    border: "1px solid #334155"
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    background: "#1e293b",
    margin: "8px 20px",
    borderRadius: 12,
    border: "1px solid #334155"
  },
  loadingSpinner: {
    marginBottom: 12,
    color: "#60a5fa"
  },
  loadingText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: 500
  },
};