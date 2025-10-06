import React, { useState, useEffect, useRef } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { api } from "@/services/api";

interface ModelInfo {
  id: string;
  label: string;
  provider: "local" | "groq";
  size?: string | null;
  quant?: string | null;
  tags?: string[];
  arch?: string;
  params?: number;
  likes?: number;
  downloads?: number;
  lastModified?: string;
  formats?: string;
  // New classification fields
  name?: string;
  publisher?: string;
  category?: string;
  source?: string;
  architecture?: string;
}

interface DiscoverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function DiscoverModal({ isOpen, onClose }: DiscoverModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("downloads");
  const [searchResults, setSearchResults] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchModels = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await api.get("/models/discover", {
        params: { q: searchQuery, sort: sortBy, limit: 20 }
      });
      setSearchResults(response.data.results || []);
    } catch (error: any) {
      alert("Search failed: " + (error.message || error));
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(searchModels, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, sortBy]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        width: "90%",
        maxWidth: 1200,
        height: "80%",
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
      <div style={{
          padding: 16,
          borderBottom: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100" style={{ margin: 0, color: "#e2e8f0" }}>Discover Models</h2>
          <button className="btn h-10 min-w-[96px]" onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: 24,
              cursor: "pointer",
            }}>
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left Panel - Search */}
          <div style={{ width: "50%", padding: 16, borderRight: "1px solid #334155", overflow: "auto" }}>
            <div style={{ marginBottom: 16 }}>
          <input className="input h-10 text-sm" type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                style={{
                  width: "100%",
                  padding: 12,
                  border: "1px solid #334155",
                  borderRadius: 8,
                  background: "#1e293b",
                  color: "#e2e8f0",
                  marginBottom: 12,
                }}
              />
              <select className="select h-10 text-sm" value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  border: "1px solid #334155",
                  borderRadius: 8,
                  background: "#1e293b",
                  color: "#e2e8f0",
                }}
              >
                <option value="downloads">Most Downloaded</option>
                <option value="likes">Most Liked</option>
                <option value="recent">Recently Updated</option>
              </select>
        </div>

            {/* Search Results */}
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100" style={{ color: "#e2e8f0", marginBottom: 12 }}>Search Results</h3>
              {isSearching && <div style={{ color: "#94a3b8", textAlign: "center" }}>Searching...</div>}
              {searchResults.map((model) => (
                <div
                  key={model.id}
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    border: "1px solid #334155",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: selectedModel?.id === model.id ? "#1e293b" : "transparent",
                  }}
                  onClick={() => setSelectedModel(model)}
                >
                  <div style={{ fontWeight: "bold", color: "#e2e8f0", marginBottom: 4 }}>
                    {model.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Downloads: {model.downloads?.toLocaleString() || "N/A"} • 
                    Likes: {model.likes?.toLocaleString() || "N/A"}
                  </div>
                  {model.tags && model.tags.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {model.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            display: "inline-block",
                            padding: "2px 6px",
                            margin: "2px 4px 2px 0",
                            background: "#334155",
                            color: "#e2e8f0",
                            borderRadius: 4,
                            fontSize: 10,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
        </div>
      </div>

          {/* Right Panel - Model Info */}
          <div style={{ width: "50%", padding: 16, overflow: "auto" }}>
            {selectedModel ? (
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100" style={{ color: "#e2e8f0", marginBottom: 16 }}>Model Information</h3>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ color: "#e2e8f0" }}>Name:</strong>
                  <div style={{ color: "#94a3b8", marginTop: 4 }}>{selectedModel.label}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ color: "#e2e8f0" }}>Architecture:</strong>
                  <div style={{ color: "#94a3b8", marginTop: 4 }}>{selectedModel.arch || "N/A"}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ color: "#e2e8f0" }}>Parameters:</strong>
                  <div style={{ color: "#94a3b8", marginTop: 4 }}>
                    {selectedModel.params ? selectedModel.params.toLocaleString() : "N/A"}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ color: "#e2e8f0" }}>Downloads:</strong>
                  <div style={{ color: "#94a3b8", marginTop: 4 }}>
                    {selectedModel.downloads?.toLocaleString() || "N/A"}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ color: "#e2e8f0" }}>Likes:</strong>
                  <div style={{ color: "#94a3b8", marginTop: 4 }}>
                    {selectedModel.likes?.toLocaleString() || "N/A"}
                  </div>
                </div>
                {selectedModel.tags && selectedModel.tags.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ color: "#e2e8f0" }}>Tags:</strong>
                    <div style={{ marginTop: 4 }}>
                      {selectedModel.tags.map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            margin: "2px 4px 2px 0",
                            background: "#334155",
                            color: "#e2e8f0",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button className="btn h-10 min-w-[96px]" style={{
                    padding: "8px 16px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#e2e8f0",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    alert("Download functionality would be implemented here");
                  }}
                >
                  Download Model
                </button>
              </div>
            ) : (
              <div style={{ color: "#94a3b8", textAlign: "center", marginTop: 50 }}>
                Select a model to view details
        </div>
      )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ModelsPage() {
  const [modelsDirectory, setModelsDirectory] = useState("./data/models");
  const [localModels, setLocalModels] = useState<ModelInfo[]>([]);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [filterText, setFilterText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Helper to create stable keys for each model
  const modelKey = (m: ModelInfo): string => {
    // prefer canonical ids; otherwise fall back to deterministic label/name-based keys
    if (m.id && m.id.trim()) return m.id.trim();
    if (m.label && m.label.trim()) return `label:${m.label.trim()}`;
    if (m.name && m.name.trim()) return `name:${m.name.trim()}`;
    // last resort: a deterministic composite so rows don't share a key
    return `anon:${(m.publisher||'')}:${(m.arch||'')}:${(m.size||'')}:${(m.quant||'')}`;
  };

  // Click outside handler for menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper function to get category color
  const getCategoryColor = (category: string) => {
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
  };

  // Filter models based on search text
  const filteredModels = localModels.filter(model =>
    (model.name || model.label || "").toLowerCase().includes(filterText.toLowerCase()) ||
    (model.id || "").toLowerCase().includes(filterText.toLowerCase()) ||
    (model.category || "").toLowerCase().includes(filterText.toLowerCase()) ||
    (model.publisher || "").toLowerCase().includes(filterText.toLowerCase()) ||
    (model.arch && model.arch.toLowerCase().includes(filterText.toLowerCase())) ||
    (model.quant && model.quant.toLowerCase().includes(filterText.toLowerCase()))
  );

  const loadLocalModels = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/models/classified");
      setLocalModels(response.data.models || []);
    } catch (error: any) {
      // Fallback to regular scan if classified endpoint fails
      try {
        const fallbackResponse = await api.get("/models/scan");
        setLocalModels(fallbackResponse.data.local || []);
      } catch (fallbackError: any) {
        console.log("Models API not available yet:", fallbackError.message);
        setLocalModels([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLocalModels();
  }, []);

  // Warn about models missing IDs
  useEffect(() => {
    const anon = localModels.filter(m => !m.id);
    if (anon.length) {
      console.warn("Models missing id; using synthetic keys:", anon.map(m => modelKey(m)));
    }
  }, [localModels]);

  // Load persisted visibility configuration from backend
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/models/visibility");
        const arr: string[] | null = data.enabled_ids ?? null;
        if (arr === null) {
          setDisabledIds(new Set()); // all enabled
        } else {
          const enabledById = new Set(arr);
          const disabledKeys = new Set(
            localModels
              .filter(m => m.id) // only models tracked by backend
              .filter(m => !enabledById.has(m.id!))
              .map(m => modelKey(m))
          );
          setDisabledIds(disabledKeys);
        }
      } catch {
        setDisabledIds(new Set());
      }
    })();
  }, [localModels]);

  const persistEnabled = async (disabledKeys: Set<string>) => {
    try {
      // Convert disabled -> enabled for the API
      if (disabledKeys.size === 0) {
        await api.post("/models/visibility", { enabled_ids: null });
      } else {
        const withIds = localModels.filter(m => m.id);
        const allIds = new Set(withIds.map(m => m.id!));
        // which *ids* are disabled? -> keys in disabledKeys that correspond to models with ids
        const disabledIds = new Set(
          withIds
            .filter(m => disabledKeys.has(modelKey(m)))
            .map(m => m.id!)
        );
        const enabledIds = Array.from(allIds).filter(id => !disabledIds.has(id));
        await api.post("/models/visibility", { enabled_ids: enabledIds });
      }
      window.dispatchEvent(new Event("models:visibility-changed"));
    } catch {}
  };

  const toggleDisabled = (key: string) => {
    console.log('Toggling disabled for key:', key, 'Current disabled:', Array.from(disabledIds));
    const next = new Set(disabledIds);
    if (next.has(key)) {
      next.delete(key);
      console.log('Enabling', key);
    } else {
      next.add(key);
      console.log('Disabling', key);
    }
    console.log('New disabled set:', Array.from(next));
    setDisabledIds(next);
    persistEnabled(next);
  };

  const handleDirectoryChange = (newPath: string) => {
    setModelsDirectory(newPath);
    // In a real implementation, this would update the backend configuration
  };

  const openFileExplorer = () => {
    // In a real implementation, this would open the file explorer
    alert("File explorer would open to: " + modelsDirectory);
  };

  const resetToDefault = () => {
    setModelsDirectory("./data/models");
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <LeftRail />
      <div style={{ padding: 24, marginLeft: 56, background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", flex: 1, overflow: "auto" }}>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100" style={{ margin: "0 0 24px 0", color: "#e2e8f0" }}>My Models</h1>

        {/* Directory Configuration */}
        <div style={{ marginBottom: 32 }}>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100" style={{ color: "#e2e8f0", marginBottom: 12 }}>Models Directory</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input h-10 text-sm" type="text"
              value={modelsDirectory}
              onChange={(e) => setModelsDirectory(e.target.value)}
              style={{
                width: "400px",
                padding: 12,
                border: "1px solid #334155",
                borderRadius: 8,
                background: "#1e293b",
                color: "#e2e8f0",
              }}
            />
            <div ref={menuRef} style={{ position: "relative" }}>
              <button className="btn h-10 min-w-[96px]" onClick={() => setShowMenu(!showMenu)}
                style={{
                  padding: "12px 16px",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  background: "#1e293b",
                  color: "#e2e8f0",
                  cursor: "pointer",
                }}
              >
                ⋯
              </button>
              {showMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 4,
                    minWidth: 200,
                    background: "#0b1220",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                    zIndex: 1000,
                    padding: 8,
                  }}
                >
                  <button className="btn h-10 min-w-[96px]" onClick={() => {
                      openFileExplorer();
                      setShowMenu(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#1e293b";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Browse Path
                  </button>
                  <button className="btn h-10 min-w-[96px]" onClick={() => {
                      resetToDefault();
                      setShowMenu(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#1e293b";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Reset to Default
                  </button>
                  <button className="btn h-10 min-w-[96px]" onClick={() => {
                      loadLocalModels();
                      setShowMenu(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#1e293b";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Refresh
                  </button>
                  <button className="btn h-10 min-w-[96px]" onClick={() => {
                      openFileExplorer();
                      setShowMenu(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#1e293b";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Open in Explorer
                  </button>
        </div>
      )}
            </div>
            <button className="btn h-10 min-w-[96px]" onClick={() => setIsDiscoverOpen(true)}
              style={{
                padding: "12px 24px",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 8,
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              Discover Models
            </button>
          </div>
        </div>

        {/* Models Table */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100" style={{ color: "#e2e8f0", margin: 0 }}>Downloaded Models</h2>
            <input className="input h-10 text-sm" type="text"
              placeholder="Filter models..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                width: "300px",
                padding: "8px 12px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#1e293b",
                color: "#e2e8f0",
                fontSize: 14,
              }}
            />
          </div>
          {isLoading ? (
            <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
              Loading models...
            </div>
          ) : filteredModels.length === 0 ? (
            <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
              {localModels.length === 0 
                ? "No models found. Use the Discover button to find and download models."
                : "No models match your filter."
              }
            </div>
          ) : (
            <div style={{ overflow: "auto" }}>
              <table className="w-full text-sm" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead className="bg-neutral-50 dark:bg-neutral-800 text-left">
                  <tr style={{ background: "#1e293b" }}>
                  <th className="px-4 py-3 font-medium" style={{ width: 36, padding: 12, textAlign: "center", color: "#e2e8f0", border: "1px solid #334155" }}>
                    <input
                      type="checkbox"
                      id="master-checkbox"
                      checked={disabledIds.size === 0}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (disabledIds.size === 0) {
                          // disable all rows **by key** (UI). Backend persistence will only include models with real ids.
                          const allKeys = new Set(localModels.map(m => modelKey(m)));
                          setDisabledIds(allKeys);
                          persistEnabled(allKeys);
                        } else {
                          // enable all
                          const empty = new Set<string>();
                          setDisabledIds(empty);
                          persistEnabled(empty);
                        }
                      }}
                      title={disabledIds.size === 0 ? "Deselect All" : "Select All"}
                    />
                  </th>
                    <th className="px-4 py-3 font-medium" style={{ padding: 12, textAlign: "left", color: "#e2e8f0", border: "1px solid #334155" }}>
                      Model
                    </th>
                    <th className="px-4 py-3 font-medium" style={{ padding: 12, textAlign: "left", color: "#e2e8f0", border: "1px solid #334155" }}>
                      Category
                    </th>
                    <th className="px-4 py-3 font-medium" style={{ padding: 12, textAlign: "left", color: "#e2e8f0", border: "1px solid #334155" }}>
                      Publisher
                    </th>
                    <th className="px-4 py-3 font-medium" style={{ padding: 12, textAlign: "left", color: "#e2e8f0", border: "1px solid #334155" }}>
                      Parameters
                    </th>
                    <th className="px-4 py-3 font-medium" style={{ padding: 12, textAlign: "left", color: "#e2e8f0", border: "1px solid #334155" }}>
                      Size
                    </th>
                    <th className="px-4 py-3 font-medium" style={{ padding: 12, textAlign: "left", color: "#e2e8f0", border: "1px solid #334155" }}>
                      Quantization
                    </th>
                    <th className="px-4 py-3 font-medium" style={{ padding: 12, textAlign: "left", color: "#e2e8f0", border: "1px solid #334155" }}>
                      Source
                    </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-700/60">
                  {filteredModels.map((model, index) => {
                    const k = modelKey(model);
                    const modelChecked = !disabledIds.has(k);
                    console.log(`Rendering checkbox for ${k}:`, modelChecked, 'disabledIds:', Array.from(disabledIds));
                    return (
                  <tr key={k} style={{ background: index % 2 === 0 ? "#0f172a" : "#1e293b" }}>
                    <td className="px-4 py-3 align-top" style={{ padding: 12, textAlign: "center", border: "1px solid #334155" }}>
                      <input
                        type="checkbox"
                        id={`model-checkbox-${k}`}
                        checked={modelChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          console.log(`Checkbox clicked for ${k}, current checked:`, e.target.checked);
                          toggleDisabled(k);
                        }}
                      />
                    </td>
                      <td className="px-4 py-3 align-top" style={{ padding: 12, color: "#e2e8f0", border: "1px solid #334155" }}>
                        <div style={{ fontWeight: "bold" }}>{model.name || model.label}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>{model.id}</div>
                      </td>
                      <td className="px-4 py-3 align-top" style={{ padding: 12, color: "#e2e8f0", border: "1px solid #334155" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          background: getCategoryColor(model.category || "Unknown"),
                          color: "white"
                        }}>
                          {model.category || "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top" style={{ padding: 12, color: "#e2e8f0", border: "1px solid #334155" }}>
                        {model.publisher || "Unknown"}
                      </td>
                      <td className="px-4 py-3 align-top" style={{ padding: 12, color: "#e2e8f0", border: "1px solid #334155" }}>
                        {model.params || "Unknown"}
                      </td>
                      <td className="px-4 py-3 align-top" style={{ padding: 12, color: "#e2e8f0", border: "1px solid #334155" }}>
                        {model.size || "Unknown"}
                      </td>
                      <td className="px-4 py-3 align-top" style={{ padding: 12, color: "#e2e8f0", border: "1px solid #334155" }}>
                        {model.quant || "N/A"}
                      </td>
                      <td className="px-4 py-3 align-top" style={{ padding: 12, color: "#e2e8f0", border: "1px solid #334155" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          background: model.source === "groq" ? "#059669" : "#6b7280",
                          color: "#fff",
                        }}>
                          {model.source === "groq" ? "Groq" : "Local"}
                        </span>
                  </td>
                </tr>
                    );
                  })}
          </tbody>
        </table>
            </div>
          )}
        </div>

        <DiscoverModal isOpen={isDiscoverOpen} onClose={() => setIsDiscoverOpen(false)} />
      </div>
    </div>
  );
}