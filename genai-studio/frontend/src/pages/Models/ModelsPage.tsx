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
  // Additional fields for HF models
  pipeline_tag?: string;
  author?: string;
  description?: string;
  // Additional metadata fields
  intended_uses?: string;
  background?: string;
  training_data?: any;
  library_name?: string;
  // Requirements checking
  requirements?: {
    can_run: boolean;
    warnings: string[];
    errors: string[];
    recommended_gpu_memory?: string;
    estimated_memory?: string;
  };
  // Full model card data
  full_model_card?: any;
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
  const [selectedModelDetails, setSelectedModelDetails] = useState<ModelInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPopular, setIsLoadingPopular] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{[key: string]: any}>({});
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hfTokenStatus, setHfTokenStatus] = useState({ hasToken: false, connected: false });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "card">("info");

  const checkHfTokenStatus = async () => {
    try {
      const response = await api.get("/settings/huggingface/status");
      setHfTokenStatus({
        hasToken: !!response.data?.hasToken,
        connected: !!response.data?.connected
      });
    } catch (error) {
      console.log("Could not check HF token status:", error);
      setHfTokenStatus({ hasToken: false, connected: false });
    }
  };

  const fetchModelDetails = async (modelId: string) => {
    if (!hfTokenStatus.hasToken) return;
    
    setIsLoadingDetails(true);
    try {
      const response = await api.get(`/models/discover/details/${modelId}`);
      setSelectedModelDetails(response.data);
    } catch (error: any) {
      console.error("Failed to fetch model details:", error);
      if (error.response?.status === 401) {
        alert("Hugging Face token not configured or invalid. Please check your token in Settings.");
      } else if (error.response?.status === 404) {
        alert("Model details not found.");
      } else {
        alert("Failed to fetch model details: " + (error.message || error));
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const downloadModel = async (modelId: string) => {
    if (!hfTokenStatus.hasToken) {
      alert("Hugging Face token required for downloading models. Please configure your token in Settings.");
      return;
    }

    console.log(`Starting download for model: ${modelId}`);
    setIsDownloading(true);

    try {
      // Start download using queue system
      console.log("Sending download request to backend...");
      const response = await api.post("/models/download", { model_id: modelId });
      console.log("Download request response:", response.data);
      
      if (response.data.download_id) {
        const downloadId = response.data.download_id;
        console.log(`Download queued with ID: ${downloadId}`);
        setDownloadProgress(prev => ({ ...prev, [modelId]: { status: "queued", progress: 0, downloadId } }));
        
        // Poll for download status
        const pollStatus = async () => {
          try {
            console.log(`Polling status for download: ${downloadId}`);
            const statusResponse = await api.get(`/models/download/status/${downloadId}`);
            const status = statusResponse.data;
            console.log("Download status:", status);
            
            setDownloadProgress(prev => ({ ...prev, [modelId]: status }));
            
            if (status.status === "completed") {
              console.log("Download completed successfully");
              setIsDownloading(false);
              alert(`Model "${modelId}" downloaded successfully! It will appear in your local models list.`);
              
              // Trigger model refresh
              window.dispatchEvent(new Event("models:changed"));
              
              // Clear progress
              setDownloadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[modelId];
                return newProgress;
              });
            } else if (status.status === "failed") {
              console.log("Download failed:", status.error);
              setIsDownloading(false);
              alert(`Download failed: ${status.error || "Unknown error"}`);
              
              // Clear progress
              setDownloadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[modelId];
                return newProgress;
              });
            } else if (status.status === "cancelled") {
              console.log("Download cancelled");
              setIsDownloading(false);
              alert("Download cancelled");
              
              // Clear progress
              setDownloadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[modelId];
                return newProgress;
              });
            } else {
              // Continue polling
              console.log("Download still in progress, continuing to poll...");
              setTimeout(pollStatus, 2000);
            }
          } catch (error) {
            console.error("Error polling download status:", error);
            setIsDownloading(false);
            alert("Failed to check download status");
            
            // Clear progress
            setDownloadProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[modelId];
              return newProgress;
            });
          }
        };
        
        // Start polling after a short delay
        setTimeout(pollStatus, 1000);
      } else {
        console.error("No download ID received from backend");
        setIsDownloading(false);
        alert("Failed to start download - no download ID received");
      }
    } catch (error: any) {
      console.error("Download request failed:", error);
      setIsDownloading(false);
      alert(`Download failed: ${error.response?.data?.detail || error.message || "Unknown error"}`);
      
      // Clear progress
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelId];
        return newProgress;
      });
    }
  };

  const loadModels = async (reset: boolean = true) => {
    if (!hfTokenStatus.hasToken) return;
    
    if (reset) {
      setIsLoadingPopular(true);
      setCurrentOffset(0);
      setHasMoreResults(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const offset = reset ? 0 : currentOffset;
      const response = await api.get("/models/discover", {
        params: { 
          q: searchQuery, 
          sort: sortBy, 
          limit: 50, 
          offset: offset 
        }
      });
      const models = response.data.results || [];
      
      if (reset) {
        setSearchResults(models);
        // Select the first model by default
        if (models.length > 0 && !selectedModel) {
          setSelectedModel(models[0]);
        }
        setCurrentOffset(models.length);
      } else {
        // Only add models that aren't already in the list to prevent duplicates
        setSearchResults(prev => {
          const existingIds = new Set(prev.map((m: ModelInfo) => m.id));
          const newModels = models.filter((m: ModelInfo) => !existingIds.has(m.id));
          return [...prev, ...newModels];
        });
        setCurrentOffset(prev => prev + models.length);
      }
      
      // Check if there are more results - if we got less than requested, we've reached the end
      setHasMoreResults(models.length === 50);
      
    } catch (error: any) {
      console.error("Failed to load models:", error);
      if (error.response?.status === 401) {
        alert("Hugging Face token not configured or invalid. Please check your token in Settings.");
      } else {
        alert("Failed to load models: " + (error.message || error));
      }
    } finally {
      setIsLoadingPopular(false);
      setIsLoadingMore(false);
    }
  };


  const reorderModels = (newSortBy: string) => {
    if (searchResults.length === 0) return;
    
    const sorted = [...searchResults].sort((a, b) => {
      switch (newSortBy) {
        case "downloads":
          return (b.downloads || 0) - (a.downloads || 0);
        case "likes":
          return (b.likes || 0) - (a.likes || 0);
        case "recent":
          return new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime();
        default:
          return 0;
      }
    });
    
    setSearchResults(sorted);
    setSortBy(newSortBy);
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => loadModels(true), 500);
      return () => clearTimeout(timeoutId);
    } else {
      // Load models with current sort when no search query
      loadModels(true);
    }
  }, [searchQuery]);

  // Handle sort changes - triggers new search
  useEffect(() => {
    if (searchResults.length > 0 && !isInitialLoad) {
      loadModels(true);
    }
  }, [sortBy]);

  // Check HF token status and load popular models when modal opens
  useEffect(() => {
    if (isOpen) {
      checkHfTokenStatus();
    }
  }, [isOpen]);

  // Load models when token status changes
  useEffect(() => {
    if (hfTokenStatus.hasToken && isOpen && searchResults.length === 0) {
      loadModels(true).then(() => {
        setIsInitialLoad(false);
      });
    }
  }, [hfTokenStatus.hasToken, isOpen]);

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
        background: "#0b1220",
        border: "1px solid #334155",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)"
      }}>
        {/* Header */}
        <div style={{
          padding: 24,
          borderBottom: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>Discover Models</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Find and download AI models from the community</p>
            </div>
          </div>
          <button onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#94a3b8",
              fontSize: 20,
              cursor: "pointer",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1e293b";
              e.currentTarget.style.borderColor = "#475569";
              e.currentTarget.style.color = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "#334155";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left Panel - Search */}
          <div style={{ width: "50%", padding: 16, borderRight: "1px solid #334155", overflow: "auto" }}>
            {/* HF Token Warning */}
            {!hfTokenStatus.hasToken && (
              <div style={{
                padding: "16px",
                margin: "12px",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "1px solid #f59e0b",
                borderRadius: "8px",
                color: "#ffffff"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2M12,4.5L11.5,7.5L8.5,8L11.5,8.5L12,11.5L12.5,8.5L15.5,8L12.5,7.5L12,4.5Z"/>
                  </svg>
                  <strong style={{ fontSize: "14px" }}>Hugging Face Token Required</strong>
                </div>
                <div style={{ fontSize: "13px", lineHeight: "1.4", marginBottom: "8px" }}>
                  To discover and add models from Hugging Face, you need to configure your access token first.
                </div>
                <div style={{ fontSize: "12px", opacity: "0.9" }}>
                  Go to Settings → Hugging Face to add your token from{" "}
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#ffffff", textDecoration: "underline" }}
                  >
                    huggingface.co/settings/tokens
                  </a>
                </div>
              </div>
            )}
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ color: "#e2e8f0", margin: 0, fontSize: 16, fontWeight: 600 }}>
                  {searchQuery ? "Search Results" : 
                    sortBy === "downloads" ? "Most Downloaded" :
                    sortBy === "likes" ? "Most Liked" :
                    sortBy === "recent" ? "Recently Updated" : "Models"}
                </h3>
                {!searchQuery && (
                  <button
                    onClick={() => loadModels(true)}
                    disabled={isLoadingPopular}
                    style={{
                      padding: "6px 12px",
                      background: "transparent",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#475569";
                      e.currentTarget.style.color = "#e2e8f0";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#334155";
                      e.currentTarget.style.color = "#94a3b8";
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                    </svg>
                    Refresh
                  </button>
                )}
              </div>
              
              {(isSearching || isLoadingPopular) && (
                <div style={{ 
                  color: "#94a3b8", 
                  textAlign: "center", 
                  padding: 20,
                  background: "#1e293b",
                  borderRadius: 8,
                  border: "1px solid #334155"
                }}>
                  <div style={{ 
                    fontSize: 14, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    gap: 8 
                  }}>
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      style={{ 
                        animation: "spin 1s linear infinite" 
                      }}
                    >
                      <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                    </svg>
                    Loading models...
                  </div>
                </div>
              )}
              
              {!isSearching && !isLoadingPopular && searchResults.map((model) => (
                <div
                  key={model.id}
                  style={{
                    padding: 16,
                    marginBottom: 12,
                    border: "1px solid #334155",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: selectedModel?.id === model.id ? "#1e293b" : "#0f172a",
                    transition: "all 0.2s ease",
                    position: "relative"
                  }}
                  onClick={() => {
                    setSelectedModel(model);
                    fetchModelDetails(model.id);
                  }}
                  onMouseEnter={(e) => {
                    if (selectedModel?.id !== model.id) {
                      e.currentTarget.style.background = "#1e293b";
                      e.currentTarget.style.borderColor = "#475569";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedModel?.id !== model.id) {
                      e.currentTarget.style.background = "#0f172a";
                      e.currentTarget.style.borderColor = "#334155";
                    }
                  }}
                >
                  {/* Model Icon */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      background: "#ff6b35",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <img 
                        src="/assets/hf-logo.svg" 
                        alt="Hugging Face" 
                        width="20" 
                        height="20"
                      />
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Model Name */}
                      <div style={{ 
                        fontWeight: 600, 
                        color: "#e2e8f0", 
                        marginBottom: 4,
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {model.label}
                      </div>
                      
                      {/* Description */}
                      {model.description && (
                        <div style={{ 
                          fontSize: 12, 
                          color: "#94a3b8", 
                          marginBottom: 8,
                          lineHeight: "1.4",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}>
                          {model.description}
                        </div>
                      )}
                      
                      {/* Stats */}
                      <div style={{ 
                        display: "flex", 
                        gap: 16, 
                        fontSize: 11, 
                        color: "#64748b",
                        marginBottom: 8
                      }}>
                        <span>📥 {model.downloads?.toLocaleString() || "0"}</span>
                        <span>❤️ {model.likes?.toLocaleString() || "0"}</span>
                        {model.params && <span>⚡ {model.params.toLocaleString()}B</span>}
                      </div>
                      
                      {/* Tags */}
                      {model.tags && model.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {model.tags.slice(0, 4).map((tag, index) => (
                            <span
                              key={index}
                              style={{
                                padding: "2px 6px",
                                background: "#334155",
                                color: "#cbd5e1",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 500
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                          {model.tags.length > 4 && (
                            <span style={{
                              padding: "2px 6px",
                              background: "#334155",
                              color: "#64748b",
                              borderRadius: 4,
                              fontSize: 10
                            }}>
                              +{model.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Selection indicator */}
                    {selectedModel?.id === model.id && (
                      <div style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        width: 20,
                        height: 20,
                        background: "#10b981",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {!isSearching && !isLoadingPopular && searchResults.length === 0 && (
                <div style={{ 
                  color: "#94a3b8", 
                  textAlign: "center", 
                  padding: 40,
                  background: "#1e293b",
                  borderRadius: 8,
                  border: "1px solid #334155"
                }}>
                  <div style={{ fontSize: 14, marginBottom: 8 }}>No models found</div>
                  <div style={{ fontSize: 12 }}>Try adjusting your search terms</div>
                </div>
              )}
              
              {/* Load More Button */}
              {!isSearching && !isLoadingPopular && searchResults.length > 0 && hasMoreResults && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    onClick={() => loadModels(false)}
                    disabled={isLoadingMore}
                    style={{
                      padding: "12px 24px",
                      background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                      border: "none",
                      borderRadius: 8,
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "0 auto",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(59, 130, 246, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(59, 130, 246, 0.3)";
                    }}
                  >
                    {isLoadingMore ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin 1s linear infinite" }}>
                          <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                        </svg>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                        </svg>
                        Load More Models
                      </>
                    )}
                  </button>
                </div>
              )}
        </div>
      </div>

          {/* Right Panel - Model Info */}
          <div style={{ width: "50%", padding: 16, overflow: "auto" }}>
            {selectedModel ? (
              <div>
                {isLoadingDetails && (
                  <div style={{ 
                    color: "#94a3b8", 
                    textAlign: "center", 
                    padding: 20,
                    background: "#1e293b",
                    borderRadius: 8,
                    border: "1px solid #334155",
                    marginBottom: 16
                  }}>
                    <div style={{ 
                      fontSize: 14, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      gap: 8 
                    }}>
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="currentColor" 
                        style={{ 
                          animation: "spin 1s linear infinite" 
                        }}
                      >
                        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                      </svg>
                      Loading model details...
                    </div>
                  </div>
                )}
                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      background: "#ff6b35",
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <img 
                        src="/assets/hf-logo.svg" 
                        alt="Hugging Face" 
                        width="20" 
                        height="20"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>
                        {selectedModel.label}
                      </h3>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                        {selectedModel.author && `by ${selectedModel.author}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        📥 {selectedModel.downloads?.toLocaleString() || "0"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        ❤️ {selectedModel.likes?.toLocaleString() || "0"}
                      </div>
                      {(selectedModelDetails?.size || selectedModel.size) && (
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          💾 {selectedModelDetails?.size || selectedModel.size}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Description */}
                  {(selectedModelDetails?.description || selectedModel.description) && (
                    <div style={{
                      fontSize: 13,
                      color: "#cbd5e1",
                      lineHeight: "1.5",
                      background: "#1e293b",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #334155"
                    }}>
                      {selectedModelDetails?.description || selectedModel.description}
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button
                      onClick={() => setActiveTab("info")}
                      style={{
                        padding: "8px 16px",
                        background: activeTab === "info" ? "#3b82f6" : "transparent",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        color: activeTab === "info" ? "#ffffff" : "#94a3b8",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 500,
                        transition: "all 0.2s ease"
                      }}
                    >
                      Model Information
                    </button>
                    <button
                      onClick={() => setActiveTab("card")}
                      style={{
                        padding: "8px 16px",
                        background: activeTab === "card" ? "#3b82f6" : "transparent",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        color: activeTab === "card" ? "#ffffff" : "#94a3b8",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 500,
                        transition: "all 0.2s ease"
                      }}
                    >
                      Model Card
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === "info" && (
                  <div>
                    {/* Model Information */}
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 }}>
                        Model Information
                      </h4>
                  
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      padding: 12
                    }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Model ID</div>
                      <div style={{ fontSize: 14, color: "#e2e8f0", fontFamily: "monospace" }}>
                        {selectedModel.id}
                      </div>
                    </div>
                    
                    <div style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      padding: 12
                    }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Architecture</div>
                      <div style={{ fontSize: 14, color: "#e2e8f0" }}>
                        {selectedModel.arch ? (
                          <span style={{
                            padding: "4px 8px",
                            background: "#10b981",
                            color: "white",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 500
                          }}>
                            {selectedModel.arch}
                          </span>
                        ) : "N/A"}
                      </div>
                    </div>
                    
                    <div style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      padding: 12
                    }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Parameters</div>
                      <div style={{ fontSize: 14, color: "#e2e8f0" }}>
                        {selectedModel.params ? (
                          <span style={{
                            padding: "4px 8px",
                            background: "#3b82f6",
                            color: "white",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 500
                          }}>
                            {selectedModel.params.toLocaleString()}B
                          </span>
                        ) : "N/A"}
                      </div>
                    </div>
                    
                    <div style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      padding: 12
                    }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Pipeline</div>
                      <div style={{ fontSize: 14, color: "#e2e8f0" }}>
                        {selectedModel.pipeline_tag ? (
                          <span style={{
                            padding: "4px 8px",
                            background: "#8b5cf6",
                            color: "white",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 500
                          }}>
                            {selectedModel.pipeline_tag}
                          </span>
                        ) : "N/A"}
                      </div>
                    </div>
                    
                    <div style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      padding: 12
                    }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Download Size</div>
                      <div style={{ fontSize: 14, color: "#e2e8f0" }}>
                        {selectedModel.size ? (
                          <span style={{
                            padding: "4px 8px",
                            background: "#f59e0b",
                            color: "white",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 500
                          }}>
                            {selectedModel.size}
                          </span>
                        ) : "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {selectedModel.tags && selectedModel.tags.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>
                      Tags
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedModel.tags.map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            padding: "6px 12px",
                            background: "#334155",
                            color: "#e2e8f0",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* System Requirements */}
                {selectedModelDetails?.requirements && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>
                      System Requirements
                    </h4>
                    <div style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      padding: 12
                    }}>
                      {selectedModelDetails.requirements.estimated_memory && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>Estimated Memory: </span>
                          <span style={{ fontSize: 13, color: "#e2e8f0" }}>{selectedModelDetails.requirements.estimated_memory}</span>
                        </div>
                      )}
                      {selectedModelDetails.requirements.recommended_gpu_memory && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>Recommended GPU Memory: </span>
                          <span style={{ fontSize: 13, color: "#e2e8f0" }}>{selectedModelDetails.requirements.recommended_gpu_memory}</span>
                        </div>
                      )}
                      {selectedModelDetails.requirements.warnings && selectedModelDetails.requirements.warnings.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, color: "#f59e0b", marginBottom: 4 }}>⚠️ Warnings:</div>
                          {selectedModelDetails.requirements.warnings.map((warning: string, index: number) => (
                            <div key={index} style={{ fontSize: 12, color: "#fbbf24", marginLeft: 8, marginBottom: 2 }}>
                              • {warning}
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedModelDetails.requirements.errors && selectedModelDetails.requirements.errors.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 4 }}>❌ Errors:</div>
                          {selectedModelDetails.requirements.errors.map((error: string, index: number) => (
                            <div key={index} style={{ fontSize: 12, color: "#f87171", marginLeft: 8, marginBottom: 2 }}>
                              • {error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Metadata Sections */}
                {selectedModelDetails?.intended_uses && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>
                      Intended Uses
                    </h4>
                    <div style={{
                      fontSize: 13,
                      color: "#cbd5e1",
                      lineHeight: "1.5",
                      background: "#1e293b",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #334155"
                    }}>
                      {selectedModelDetails.intended_uses}
                    </div>
                  </div>
                )}

                {selectedModelDetails?.background && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>
                      Background
                    </h4>
                    <div style={{
                      fontSize: 13,
                      color: "#cbd5e1",
                      lineHeight: "1.5",
                      background: "#1e293b",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #334155"
                    }}>
                      {selectedModelDetails.background}
                    </div>
                  </div>
                )}

                {selectedModelDetails?.training_data && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>
                      Training Data
                    </h4>
                    <div style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      overflow: "hidden"
                    }}>
                      {Array.isArray(selectedModelDetails.training_data) ? (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "#334155" }}>
                              <th style={{ padding: 12, textAlign: "left", color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>
                                Dataset
                              </th>
                              <th style={{ padding: 12, textAlign: "left", color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>
                                Description
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedModelDetails.training_data.map((dataset: any, index: number) => (
                              <tr key={index} style={{ borderBottom: "1px solid #334155" }}>
                                <td style={{ padding: 12, color: "#e2e8f0", fontSize: 13 }}>
                                  {dataset.name || dataset.dataset || "Unknown"}
                                </td>
                                <td style={{ padding: 12, color: "#cbd5e1", fontSize: 13 }}>
                                  {dataset.description || dataset.info || "No description available"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: 12, color: "#cbd5e1", fontSize: 13 }}>
                          {typeof selectedModelDetails.training_data === 'string' 
                            ? selectedModelDetails.training_data 
                            : JSON.stringify(selectedModelDetails.training_data, null, 2)
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                  <button 
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                      border: "none",
                      borderRadius: 8,
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)",
                      opacity: (!hfTokenStatus.hasToken || isDownloading) ? 0.6 : 1
                    }}
                    onClick={() => {
                      if (selectedModel?.id) {
                        downloadModel(selectedModel.id);
                      }
                    }}
                    disabled={isDownloading || !hfTokenStatus.hasToken}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 8px rgba(59, 130, 246, 0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(59, 130, 246, 0.3)";
                      }
                    }}
                  >
                    {isDownloading && selectedModel?.id && downloadProgress[selectedModel.id] ? (
                      <div style={{ width: "100%", textAlign: "center" }}>
                        <div style={{ marginBottom: 8 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin 1s linear infinite" }}>
                            <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                          </svg>
                          {downloadProgress[selectedModel.id].status === "queued" ? "Queued..." :
                           downloadProgress[selectedModel.id].status === "downloading" ? "Downloading..." :
                           "Processing..."}
                        </div>
                        <div style={{
                          width: "100%",
                          height: 4,
                          background: "#334155",
                          borderRadius: 2,
                          overflow: "hidden"
                        }}>
                          <div style={{
                            width: `${downloadProgress[selectedModel.id].progress || 0}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #3b82f6, #1d4ed8)",
                            transition: "width 0.3s ease"
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                          {downloadProgress[selectedModel.id].progress ? `${Math.round(downloadProgress[selectedModel.id].progress)}%` : "0%"}
                        </div>
                      </div>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                        </svg>
                        Download Model
                        {selectedModelDetails?.size && (
                          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
                            ({selectedModelDetails.size})
                          </span>
                        )}
                      </>
                    )}
                  </button>
                  
                  <button 
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      border: "none",
                      borderRadius: 8,
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)"
                    }}
                    onClick={() => {
                      if (selectedModel?.id) {
                        // Open Hugging Face model page in new tab for download
                        const hfUrl = `https://huggingface.co/${selectedModel.id}`;
                        window.open(hfUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(16, 185, 129, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(16, 185, 129, 0.3)";
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                    </svg>
                    Open on Hugging Face
                  </button>
                </div>
                  </div>
                )}

                {activeTab === "card" && (
                  <div>
                    {/* Model Card Content */}
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 }}>
                        Full Model Card
                      </h4>
                      <div style={{
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        padding: 16,
                        maxHeight: 400,
                        overflow: "auto"
                      }}>
                        {selectedModelDetails?.full_model_card ? (
                          <pre style={{
                            color: "#cbd5e1",
                            fontSize: 12,
                            lineHeight: "1.4",
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontFamily: "monospace"
                          }}>
                            {JSON.stringify(selectedModelDetails.full_model_card, null, 2)}
                          </pre>
                        ) : (
                          <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center" }}>
                            No model card data available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ 
                color: "#94a3b8", 
                textAlign: "center", 
                marginTop: 100,
                background: "#1e293b",
                padding: 40,
                borderRadius: 12,
                border: "1px solid #334155"
              }}>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                  Select a model to view details
                </div>
                <div style={{ fontSize: 13 }}>
                  Choose from the popular models or search for specific ones
                </div>
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
    loadCurrentDirectory();
  }, []);

  const loadCurrentDirectory = async () => {
    try {
      const response = await api.get("/settings/paths");
      const resolvedPaths = response.data.resolved;
      if (resolvedPaths?.source_dir) {
        setModelsDirectory(resolvedPaths.source_dir);
      }
    } catch (error) {
      console.error("Failed to load current directory:", error);
    }
  };

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

  const handleDirectoryChange = async (newPath: string) => {
    setModelsDirectory(newPath);
    try {
      // Update the backend configuration with the new models directory
      await api.post("/settings/paths", {
        source_dir: newPath,
        reference_dir: "./data/reference", // Keep existing values
        context_dir: "./data/context"
      });
      console.log("Models directory updated successfully");
    } catch (error) {
      console.error("Failed to update models directory:", error);
      // Revert the change if backend update failed
      setModelsDirectory("./data/models");
      alert("Failed to update models directory. Please check the path and try again.");
    }
  };

  const openFileExplorer = async () => {
    try {
      // Prefer native directory picker if available (Chromium/Edge)
      if (typeof (window as any).showDirectoryPicker === "function") {
        try {
          const handle = await (window as any).showDirectoryPicker({ mode: "read" });
          const folderName = handle?.name || "Selected Folder";
          await handleDirectoryChange(folderName);
          return;
        } catch (error) {
          console.log("Directory picker cancelled or failed:", error);
        }
      }

      // Fallback: hidden input with webkitdirectory (also Chromium)
      const input = document.createElement("input");
      (input as any).webkitdirectory = true;
      input.type = "file";
      input.onchange = async (ev: any) => {
        const files: FileList = ev?.target?.files;
        if (files && files.length) {
          const first: any = files[0];
          const relPath = first.webkitRelativePath || first.name;
          const topFolder = (relPath.split("/")[0] || "Selected Folder");
          await handleDirectoryChange(topFolder);
        }
      };
      input.click();
    } catch (error) {
      console.error("Failed to open file explorer:", error);
      // Final fallback: assist user manually
      try {
        await navigator.clipboard.writeText(modelsDirectory);
        alert(`Path copied to clipboard: ${modelsDirectory}\n\nPlease paste this path into your file explorer's address bar.`);
      } catch (clipboardError) {
        alert(`Models directory: ${modelsDirectory}\n\nPlease copy this path and open it in your file explorer.`);
      }
    }
  };

  const resetToDefault = () => {
    setModelsDirectory("./data/models");
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b1220" }}>
      <LeftRail />
      <div style={{ padding: 24, marginLeft: 80, background: "#0b1220", minHeight: "100vh", color: "#e2e8f0", flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#e2e8f0" }}>My Models</h1>
            <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>Manage and discover AI models for your projects</p>
          </div>
        </div>

        {/* Directory Configuration */}
        <div style={{ 
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 16,
          padding: 24,
          marginBottom: 32,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", 
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>Models Directory</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Configure where your models are stored</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input type="text"
              value={modelsDirectory}
              onChange={(e) => setModelsDirectory(e.target.value)}
              style={{
                flex: 1,
                padding: 12,
                border: "1px solid #334155",
                borderRadius: 8,
                background: "#1e293b",
                color: "#e2e8f0",
                fontSize: 14
              }}
            />
            <div ref={menuRef} style={{ position: "relative" }}>
              <button onClick={() => setShowMenu(!showMenu)}
                style={{
                  padding: "12px 16px",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  background: "#1e293b",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#334155";
                  e.currentTarget.style.borderColor = "#475569";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#1e293b";
                  e.currentTarget.style.borderColor = "#334155";
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
                    marginTop: 8,
                    minWidth: 200,
                    background: "#0b1220",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    zIndex: 1000,
                    padding: 8,
                  }}
                >
                  <button onClick={() => {
                      openFileExplorer();
                      setShowMenu(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 6,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                    </svg>
                    Browse Path
                  </button>
                  <button onClick={() => {
                      resetToDefault();
                      setShowMenu(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 6,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                    </svg>
                    Reset to Default
                  </button>
                  <button onClick={() => {
                      loadLocalModels();
                      setShowMenu(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 6,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                    </svg>
                    Refresh
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setIsDiscoverOpen(true)}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(59, 130, 246, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(59, 130, 246, 0.3)";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
              </svg>
              Discover Models
            </button>
          </div>
        </div>

        {/* Models Table */}
        <div style={{ 
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                background: "linear-gradient(135deg, #10b981, #059669)", 
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                </svg>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>Downloaded Models</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>{filteredModels.length} models available</p>
              </div>
            </div>
            <input type="text"
              placeholder="Filter models..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                width: "300px",
                padding: "10px 12px",
                border: "1px solid #334155",
                borderRadius: 8,
                background: "#1e293b",
                color: "#e2e8f0",
                fontSize: 14,
                transition: "all 0.2s ease"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#334155";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          {isLoading ? (
            <div style={{ 
              color: "#94a3b8", 
              textAlign: "center", 
              padding: 60,
              background: "#1e293b",
              borderRadius: 12,
              border: "1px solid #334155"
            }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Loading models...</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Scanning your models directory</div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div style={{ 
              color: "#94a3b8", 
              textAlign: "center", 
              padding: 60,
              background: "#1e293b",
              borderRadius: 12,
              border: "1px solid #334155"
            }}>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                {localModels.length === 0 
                  ? "No models found"
                  : "No models match your filter"
                }
              </div>
              <div style={{ fontSize: 13 }}>
                {localModels.length === 0 
                  ? "Use the Discover button to find and download models."
                  : "Try adjusting your search terms."
                }
              </div>
            </div>
          ) : (
            <div style={{ overflow: "auto", borderRadius: 12, border: "1px solid #334155" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1e293b" }}>
                    <th style={{ width: 50, padding: 16, textAlign: "center", color: "#e2e8f0", borderBottom: "1px solid #334155" }}>
                      <input
                        type="checkbox"
                        id="master-checkbox"
                        checked={disabledIds.size === 0}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (disabledIds.size === 0) {
                            const allKeys = new Set(localModels.map(m => modelKey(m)));
                            setDisabledIds(allKeys);
                            persistEnabled(allKeys);
                          } else {
                            const empty = new Set<string>();
                            setDisabledIds(empty);
                            persistEnabled(empty);
                          }
                        }}
                        title={disabledIds.size === 0 ? "Deselect All" : "Select All"}
                        style={{ transform: "scale(1.2)" }}
                      />
                    </th>
                    <th style={{ padding: 16, textAlign: "left", color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14, fontWeight: 600 }}>
                      Model
                    </th>
                    <th style={{ padding: 16, textAlign: "left", color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14, fontWeight: 600 }}>
                      Category
                    </th>
                    <th style={{ padding: 16, textAlign: "left", color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14, fontWeight: 600 }}>
                      Publisher
                    </th>
                    <th style={{ padding: 16, textAlign: "left", color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14, fontWeight: 600 }}>
                      Parameters
                    </th>
                    <th style={{ padding: 16, textAlign: "left", color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14, fontWeight: 600 }}>
                      Size
                    </th>
                    <th style={{ padding: 16, textAlign: "left", color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14, fontWeight: 600 }}>
                      Quantization
                    </th>
                    <th style={{ padding: 16, textAlign: "left", color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14, fontWeight: 600 }}>
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map((model, index) => {
                    const k = modelKey(model);
                    const modelChecked = !disabledIds.has(k);
                    return (
                      <tr key={k} style={{ 
                        background: index % 2 === 0 ? "#0f172a" : "#1e293b",
                        transition: "background-color 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#334155";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = index % 2 === 0 ? "#0f172a" : "#1e293b";
                      }}
                      >
                        <td style={{ padding: 16, textAlign: "center", borderBottom: "1px solid #334155" }}>
                          <input
                            type="checkbox"
                            id={`model-checkbox-${k}`}
                            checked={modelChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleDisabled(k);
                            }}
                            style={{ transform: "scale(1.2)" }}
                          />
                        </td>
                        <td style={{ padding: 16, color: "#e2e8f0", borderBottom: "1px solid #334155" }}>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{model.name || model.label}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{model.id}</div>
                        </td>
                        <td style={{ padding: 16, color: "#e2e8f0", borderBottom: "1px solid #334155" }}>
                          <span style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            background: getCategoryColor(model.category || "Unknown"),
                            color: "white"
                          }}>
                            {model.category || "Unknown"}
                          </span>
                        </td>
                        <td style={{ padding: 16, color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14 }}>
                          {model.publisher || "Unknown"}
                        </td>
                        <td style={{ padding: 16, color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14 }}>
                          {model.params ? model.params.toLocaleString() : "Unknown"}
                        </td>
                        <td style={{ padding: 16, color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14 }}>
                          {model.size || "Unknown"}
                        </td>
                        <td style={{ padding: 16, color: "#e2e8f0", borderBottom: "1px solid #334155", fontSize: 14 }}>
                          {model.quant || "N/A"}
                        </td>
                        <td style={{ padding: 16, color: "#e2e8f0", borderBottom: "1px solid #334155" }}>
                          <span style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
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