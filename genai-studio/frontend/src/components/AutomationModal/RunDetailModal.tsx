// src/components/AutomationModal/RunDetailModal.tsx
import React from 'react';
import { SavedAutomation } from '@/types/history';

interface RunDetailModalProps {
  automation: SavedAutomation;
  runIndex: number;
  onClose: () => void;
  onBack: () => void;
  onLoadRun: (automation: SavedAutomation, runIndex: number) => void;
}

export default function RunDetailModal({ 
  automation, 
  runIndex, 
  onClose, 
  onBack, 
  onLoadRun 
}: RunDetailModalProps) {
  const run = automation.runs[runIndex];
  if (!run) return null;

  const pill = (label: string, value?: number) => (
    <span
      key={label}
      style={{
        background: "#0f172a",
        border: "1px solid #334155",
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        color: "#e2e8f0",
        fontWeight: 500,
      }}
    >
      {label}: {typeof value === "number" ? `${Math.round(value * 100) / 100}` : "N/A"}
    </span>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90vw",
          maxWidth: "1000px",
          height: "80vh",
          maxHeight: "800px",
          background: "#0b1220",
          border: "1px solid #334155",
          borderRadius: 16,
          padding: 24,
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={onBack}
              style={{
                background: "transparent",
                border: "1px solid #334155",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 16,
                padding: "8px 12px",
                borderRadius: 8,
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1e293b";
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
              </svg>
              Back
            </button>
            <div>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 600 }}>
                {run.runName}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14, color: "#94a3b8" }}>
                <span>Automation: {automation.name}</span>
                <span>Type: {automation.type}</span>
                <span>Model: {run.model?.id || automation.model?.id}</span>
                <span>Status: {run.status}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 24,
              padding: 8,
              borderRadius: 8,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1e293b";
              e.currentTarget.style.color = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            ×
          </button>
        </div>

        {/* Status and Error */}
        <div style={{ 
          display: "flex", 
          gap: 16, 
          marginBottom: 24,
          padding: 20,
          background: "#0f172a",
          borderRadius: 12,
          border: "1px solid #334155",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ 
              width: 16, 
              height: 16, 
              borderRadius: "50%", 
              background: run.error ? "#ef4444" : "#10b981",
              boxShadow: run.error ? "0 0 8px rgba(239, 68, 68, 0.5)" : "0 0 8px rgba(16, 185, 129, 0.5)"
            }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>
              {run.error ? "Run Failed" : "Run Successful"}
            </span>
          </div>
          <div style={{ fontSize: 14, color: "#94a3b8" }}>
            Started: {new Date(run.startedAt).toLocaleString()}
          </div>
          {run.finishedAt && (
            <div style={{ fontSize: 14, color: "#94a3b8" }}>
              Duration: {Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
            </div>
          )}
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>
            Status: {run.status}
          </div>
        </div>

        {run.error && (
          <div style={{ 
            marginBottom: 24,
            padding: 16,
            background: "#ef444410",
            border: "1px solid #ef4444",
            borderRadius: 8,
          }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "#ef4444" }}>
              Error Details
            </h4>
            <div style={{ fontSize: 12, color: "#ef4444", fontFamily: "monospace" }}>
              {run.error}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => onLoadRun(automation, runIndex)}
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              border: "none",
              color: "#ffffff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Load This Run
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {/* Results */}
          {run.results && !run.error && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>
                Evaluation Results ({Object.keys(run.results).length} metrics)
              </h3>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
                gap: 16,
                padding: 20,
                background: "#0f172a",
                borderRadius: 12,
                border: "1px solid #334155",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                {Object.entries(run.results).map(([key, value]) => (
                  <div key={key} style={{ 
                    textAlign: "center",
                    padding: "16px 12px",
                    background: "#1e293b",
                    borderRadius: 8,
                    border: "1px solid #334155",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#334155";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#1e293b";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  >
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
                      {typeof value === "number" ? Math.round(value * 10000) / 10000 : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parameters */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>
              Model Parameters
            </h3>
            <div style={{ 
              padding: 20,
              background: "#0f172a",
              borderRadius: 12,
              border: "1px solid #334155",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {Object.entries(run.parameters).map(([key, value]) => (
                  <div key={key} style={{
                    padding: "12px 16px",
                    background: "#1e293b",
                    borderRadius: 8,
                    border: "1px solid #334155"
                  }}>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4, fontWeight: 500 }}>
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>
                      {typeof value === "number" ? Math.round(value * 100) / 100 : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Used Text */}
          {run.usedText && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>
                Text Content Used
              </h3>
              <div style={{ display: "grid", gap: 20 }}>
                {run.usedText.promptText && (
                  <div style={{
                    background: "#0f172a",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    padding: 20,
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: "50%", 
                        background: "#3b82f6" 
                      }} />
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                        Prompt Text
                      </h4>
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
                        {run.usedText.promptText.length} characters
                      </span>
                    </div>
                    <div style={{ 
                      padding: 16,
                      background: "#1e293b",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      fontSize: 13,
                      color: "#e2e8f0",
                      maxHeight: 200,
                      overflow: "auto",
                      fontFamily: "monospace",
                      lineHeight: 1.5
                    }}>
                      {run.usedText.promptText}
                    </div>
                  </div>
                )}
                {run.usedText.ocrText && (
                  <div style={{
                    background: "#0f172a",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    padding: 20,
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: "50%", 
                        background: "#10b981" 
                      }} />
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                        OCR Extracted Text
                      </h4>
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
                        {run.usedText.ocrText.length} characters
                      </span>
                    </div>
                    <div style={{ 
                      padding: 16,
                      background: "#1e293b",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      fontSize: 13,
                      color: "#e2e8f0",
                      maxHeight: 200,
                      overflow: "auto",
                      lineHeight: 1.5
                    }}>
                      {run.usedText.ocrText}
                    </div>
                  </div>
                )}
                {run.usedText.referenceText && (
                  <div style={{
                    background: "#0f172a",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    padding: 20,
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: "50%", 
                        background: "#f59e0b" 
                      }} />
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                        Reference Text
                      </h4>
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
                        {run.usedText.referenceText.length} characters
                      </span>
                    </div>
                    <div style={{ 
                      padding: 16,
                      background: "#1e293b",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      fontSize: 13,
                      color: "#e2e8f0",
                      maxHeight: 200,
                      overflow: "auto",
                      lineHeight: 1.5
                    }}>
                      {run.usedText.referenceText}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Files */}
          {run.files && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>
                Associated Files
              </h3>
              <div style={{ 
                padding: 20,
                background: "#0f172a",
                borderRadius: 12,
                border: "1px solid #334155",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ display: "grid", gap: 12 }}>
                  {Object.entries(run.files).map(([key, value]) => (
                    value && (
                      <div key={key} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        background: "#1e293b",
                        borderRadius: 8,
                        border: "1px solid #334155"
                      }}>
                        <div style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: 8, 
                          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 2, fontWeight: 500 }}>
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </div>
                          <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>
                            {String(value)}
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


