// frontend/src/components/DownloadManager/DownloadManager.tsx
import React, { useState, useEffect } from "react";
import { api } from "@/services/api";

interface DownloadItem {
  id: string;
  model_id: string;
  status: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed: number;
  eta: number;
  error?: string;
  started_at?: number;
  completed_at?: number;
  local_path?: string;
}

interface DownloadManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadManager({ isOpen, onClose }: DownloadManagerProps) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [filterText, setFilterText] = useState("");

  const loadDownloads = async () => {
    try {
      const response = await api.get("/models/download/queue");
      setDownloads(response.data.all || []);
    } catch (error) {
      console.error("Failed to load downloads:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDownloads();
      const interval = setInterval(loadDownloads, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + "/s";
  };

  const formatETA = (seconds: number) => {
    if (seconds <= 0) return "Unknown";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const cancelDownload = async (downloadId: string) => {
    try {
      await api.post(`/models/download/cancel/${downloadId}`);
      loadDownloads();
    } catch (error) {
      console.error("Failed to cancel download:", error);
    }
  };

  const removeDownload = async (downloadId: string) => {
    try {
      await api.delete(`/models/download/${downloadId}`);
      loadDownloads();
    } catch (error) {
      console.error("Failed to remove download:", error);
    }
  };

  const clearCompleted = async () => {
    try {
      await api.post("/models/download/clear-completed");
      loadDownloads();
    } catch (error) {
      console.error("Failed to clear completed downloads:", error);
    }
  };

  const openDownloadsDirectory = async () => {
    try {
      const response = await api.get("/settings/paths");
      const modelsDir = response.data.resolved?.source_dir || "./data/models";
      
      // Try to open directory
      const link = document.createElement('a');
      link.href = `file:///${modelsDir.replace(/\\/g, '/')}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to open downloads directory:", error);
    }
  };

  const filteredDownloads = downloads.filter(download => {
    const matchesFilter = download.model_id.toLowerCase().includes(filterText.toLowerCase());
    
    if (activeTab === "active") {
      return matchesFilter && ["queued", "downloading"].includes(download.status);
    } else {
      return matchesFilter && ["completed", "failed", "cancelled"].includes(download.status);
    }
  });

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
        maxWidth: 800,
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
                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>Downloads</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Manage your model downloads</p>
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

        {/* Filter */}
        <div style={{ padding: 16, borderBottom: "1px solid #334155" }}>
          <input
            type="text"
            placeholder="Filter downloads..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid #334155",
              borderRadius: 8,
              background: "#1e293b",
              color: "#e2e8f0",
              fontSize: 14
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setActiveTab("active")}
              style={{
                padding: "8px 16px",
                background: activeTab === "active" ? "#3b82f6" : "transparent",
                border: "1px solid #334155",
                borderRadius: 6,
                color: activeTab === "active" ? "#ffffff" : "#94a3b8",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                transition: "all 0.2s ease"
              }}
            >
              Active ({downloads.filter(d => ["queued", "downloading"].includes(d.status)).length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              style={{
                padding: "8px 16px",
                background: activeTab === "completed" ? "#3b82f6" : "transparent",
                border: "1px solid #334155",
                borderRadius: 6,
                color: activeTab === "completed" ? "#ffffff" : "#94a3b8",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                transition: "all 0.2s ease"
              }}
            >
              Completed ({downloads.filter(d => ["completed", "failed", "cancelled"].includes(d.status)).length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
          {filteredDownloads.length === 0 ? (
            <div style={{ 
              color: "#94a3b8", 
              textAlign: "center", 
              padding: 40,
              background: "#1e293b",
              borderRadius: 8,
              border: "1px solid #334155"
            }}>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                No {activeTab} downloads
              </div>
              <div style={{ fontSize: 13 }}>
                {activeTab === "active" 
                  ? "No downloads in progress" 
                  : "No completed downloads"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredDownloads.map((download) => (
                <div
                  key={download.id}
                  style={{
                    padding: 16,
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
                        {download.model_id}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        {download.status === "queued" && "Queued for download"}
                        {download.status === "downloading" && "Downloading..."}
                        {download.status === "completed" && "Download completed"}
                        {download.status === "failed" && "Download failed"}
                        {download.status === "cancelled" && "Download cancelled"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {download.status === "completed" && download.local_path && (
                        <button
                          onClick={() => {
                            // Try to reveal in file explorer
                            const link = document.createElement('a');
                            link.href = `file:///${download.local_path?.replace(/\\/g, '/')}`;
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
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
                            gap: 6
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                          </svg>
                          Reveal
                        </button>
                      )}
                      {(download.status === "queued" || download.status === "downloading") && (
                        <button
                          onClick={() => cancelDownload(download.id)}
                          style={{
                            padding: "6px 12px",
                            background: "transparent",
                            border: "1px solid #ef4444",
                            borderRadius: 6,
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: 12
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => removeDownload(download.id)}
                        style={{
                          padding: "6px",
                          background: "transparent",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: 16
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {(download.status === "downloading" || download.status === "completed") && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{
                        width: "100%",
                        height: 6,
                        background: "#334155",
                        borderRadius: 3,
                        overflow: "hidden"
                      }}>
                        <div style={{
                          width: `${download.progress || 0}%`,
                          height: "100%",
                          background: download.status === "completed" ? "#10b981" : "linear-gradient(90deg, #3b82f6, #1d4ed8)",
                          transition: "width 0.3s ease"
                        }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        <span>{Math.round(download.progress || 0)}%</span>
                        {download.total_bytes > 0 && (
                          <span>{formatBytes(download.downloaded_bytes)} / {formatBytes(download.total_bytes)}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Download Stats */}
                  {download.status === "downloading" && (
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b" }}>
                      {download.speed > 0 && <span>Speed: {formatSpeed(download.speed)}</span>}
                      {download.eta > 0 && <span>ETA: {formatETA(download.eta)}</span>}
                    </div>
                  )}

                  {/* Error Message */}
                  {download.status === "failed" && download.error && (
                    <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
                      Error: {download.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: "1px solid #334155", display: "flex", gap: 12 }}>
          <button
            onClick={openDownloadsDirectory}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s ease"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
            </svg>
            Open Downloads Directory
          </button>
          <button
            onClick={clearCompleted}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s ease"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
            </svg>
            Clear History
          </button>
        </div>
      </div>
    </div>
  );
}



