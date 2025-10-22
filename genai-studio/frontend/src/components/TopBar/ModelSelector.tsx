// frontend/src/components/TopBar/ModelSelector.tsx
import React from "react";
import Switch from "@/components/ui/Switch";
import axios from "axios";
import { useModel } from "@/context/ModelContext";
import { QuantizationTag, ArchitectureTag, FormatTag, ConfigIcon, PreviewIcon, Tag } from "@/components/ui/ModelTags";

type Provider = "local" | "groq";
type ModelInfo = {
  id: string;
  label: string;
  provider: Provider;
  size?: string | null;
  quant?: string | null;
  tags?: string[];
  context?: number | null;
  architecture?: string | null;
  downloadedSize?: string | null;
  lastUsed?: string | null;
  hasConfig?: boolean;
  hasPreview?: boolean;
  format?: string | null;
};

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

function prettifyModelId(id: string | undefined | null): string {
  if (!id) return "Unknown model";
  const trimmed = id.trim();
  const parts = trimmed.split(/[/:]/);
  const last = parts[parts.length - 1] || trimmed;
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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
  const rootRef = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const normalize = (raw: any, provider: Provider): ModelInfo => {
    // Handle classified models structure where id is in original_data
    const originalData = raw?.original_data || raw;
    const id = originalData?.id || raw?.id || raw?.name || raw?.model_id || raw?.model || "";
    const label = (raw?.label && String(raw.label).trim())
      ? String(raw.label)
      : (raw?.name || prettifyModelId(id));
    const sizeRaw = raw?.size || raw?.details?.size || null;
    const size = sizeRaw === "hosted" ? null : sizeRaw;
    const quant = raw?.quant || raw?.details?.quantization || null;
    const tags = Array.isArray(raw?.tags) ? raw.tags : undefined;
    const context = raw?.context || raw?.details?.context || null;
    const architecture = raw?.architecture || raw?.details?.architecture || null;
    const downloadedSize = raw?.downloaded_size || raw?.details?.downloaded_size || null;
    const lastUsed = raw?.last_used || raw?.details?.last_used || null;
    const hasConfig = raw?.has_config || raw?.details?.has_config || false;
    const hasPreview = raw?.has_preview || raw?.details?.has_preview || false;
    
    // Determine format based on file path or other indicators
    let format = null;
    if (provider === "local") {
      const path = raw?.path || "";
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
      format
    };
  };

  const fetchModelMemoryUsage = React.useCallback(async (modelId: string) => {
    if (!modelId || modelId.startsWith('groq/')) {
      setModelMemoryUsage(null);
      return;
    }
    
    try {
      const { data } = await axios.get(`/api/models/memory/${encodeURIComponent(modelId)}`);
      if (data.gpu_memory_used_gb !== null && data.gpu_memory_total_gb !== null) {
        setModelMemoryUsage({
          used: data.gpu_memory_used_gb,
          total: data.gpu_memory_total_gb,
          estimated: data.estimated_memory_gb,
          isLoaded: data.is_loaded
        });
      } else if (data.tracked_memory_gb && data.tracked_memory_gb > 0) {
        // Use tracked memory data if available
        setModelMemoryUsage({
          used: data.tracked_memory_gb,
          total: data.tracked_memory_gb,
          estimated: data.estimated_memory_gb,
          isLoaded: data.is_loaded
        });
      } else if (data.estimated_memory_gb) {
        setModelMemoryUsage({
          used: 0,
          total: data.estimated_memory_gb,
          estimated: data.estimated_memory_gb,
          isLoaded: false
        });
      } else {
        setModelMemoryUsage(null);
      }
    } catch (error) {
      console.warn("Failed to fetch model memory usage:", error);
      setModelMemoryUsage(null);
    }
  }, []);

  const fetchModels = React.useCallback(async () => {
    const { data } = await axios.get<ListResponse>("/api/models/list", {
      params: { include_groq: includeGroq },
    });
    const locals = (data.local || []).map(m => normalize(m, "local"));
    const groqs = (data.groq || []).map(m => normalize(m, "groq"));
    setLocalModels(locals);
    setGroqModels(groqs);
    setWarning(data.warning?.warning || data.warning?.error || null);
    setGroqConnected(!data.warning?.error);
  }, [includeGroq]);

  React.useEffect(() => { 
    fetchModels(); 
  }, [fetchModels]);

  // Fetch model memory usage when selected model changes
  React.useEffect(() => {
    if (selected?.id) {
      fetchModelMemoryUsage(selected.id);
    }
  }, [selected?.id, fetchModelMemoryUsage]);

  React.useEffect(() => {
    const handler = () => fetchModels();
    window.addEventListener("models:changed", handler);
    return () => window.removeEventListener("models:changed", handler);
  }, []);

  // listen to visibility changes from Models page
  React.useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get("/api/models/visibility");
        const arr: string[] | null = data.enabled_ids ?? null;
        if (arr === null) {
          setDisabledIds(new Set());
        } else {
          // Convert enabled list to disabled set
          const enabled = new Set(arr);
          const allModelIds = [...localModels, ...groqModels].map(m => m.id);
          setDisabledIds(new Set(allModelIds.filter(id => !enabled.has(id))));
        }
      } catch { setDisabledIds(new Set()); }
    };
    load();
    const onChange = () => load();
    window.addEventListener("models:visibility-changed", onChange);
    return () => window.removeEventListener("models:visibility-changed", onChange);
  }, [localModels, groqModels]);

  const allModels = React.useMemo(() => {
    const q = query.toLowerCase();
    const filter = (m: ModelInfo) =>
      !disabledIds.has(m.id) && (!q || m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));

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

  const closedLabel = selected
    ? (selected.label && selected.label.trim() ? selected.label : prettifyModelId(selected.id))
    : (noneAvailable ? "No models available" : "Select a model…");

  const handleEject = () => {
    setSelected(null);
  };

  return (
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
                  placeholder="Type to filter models..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={styles.search}
                />
              </div>
              {selected && selected.provider === "local" && modelMemoryUsage && (
                <div style={styles.memoryContainer}>
                  <span style={styles.memoryLabel}>
                    {modelMemoryUsage.isLoaded ? "Model Memory Usage:" : "Estimated Memory:"}
                  </span>
                  <span style={styles.memoryValue}>
                    {modelMemoryUsage.isLoaded ? (
                      `${modelMemoryUsage.used.toFixed(2)} GB${modelMemoryUsage.total > modelMemoryUsage.used ? ` / ${modelMemoryUsage.total} GB` : ''}`
                    ) : (
                      `~${modelMemoryUsage.estimated?.toFixed(2) || 'Unknown'} GB`
                    )}
                  </span>
                </div>
              )}
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
              {noneAvailable && (
                <div style={styles.empty}>
                  No models available.<br />
                  Use the Models page to discover and load models.
                </div>
              )}

              {/* All Models (Local + Groq combined) */}
              {[...allModels.local, ...allModels.groq].map(m => (
                <div
                  key={m.id}
                  style={styles.modelCard}
                  onClick={() => { 
                    setSelected(m); 
                    setOpen(false); 
                  }}
                  className="rb-hover-lift rb-press"
                >
                  <div style={styles.modelCardContent}>
                    <div style={styles.modelCardHeader}>
                      <div style={styles.modelCardName}>{m.label || prettifyModelId(m.id)}</div>
                      <div style={styles.modelCardTags}>
                        {m.quant && <QuantizationTag quant={m.quant} />}
                        {m.hasConfig && <ConfigIcon />}
                        {m.hasPreview && <PreviewIcon />}
                      </div>
                    </div>
                    <div style={styles.modelCardMeta}>
                      <div style={styles.modelCardAuthor}>{m.provider}</div>
                      <div style={styles.modelCardSize}>{m.size || "Unknown"}</div>
                      {m.architecture && <ArchitectureTag arch={m.architecture} />}
                      {m.format && <FormatTag format={m.format} />}
                      {m.downloadedSize && (
                        <span style={styles.modelCardDownloadedSize}>{m.downloadedSize}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
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
  root: { position: "relative", display: "inline-block" },
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
    left: 0,
    zIndex: 1000,
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
};