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
          padding: 16,
          background: "#0f172a",
          borderRadius: 8,
          border: "1px solid #334155"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ 
              width: 12, 
              height: 12, 
              borderRadius: "50%", 
              background: run.error ? "#ef4444" : "#10b981" 
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
              {run.error ? "Failed" : "Success"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Started: {new Date(run.startedAt).toLocaleString()}
          </div>
          {run.finishedAt && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              Finished: {new Date(run.finishedAt).toLocaleString()}
            </div>
          )}
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
              <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>Results</h3>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", 
                gap: 12,
                padding: 16,
                background: "#0f172a",
                borderRadius: 8,
                border: "1px solid #334155"
              }}>
                {Object.entries(run.results).map(([key, value]) => (
                  <div key={key} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                      {key.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>
                      {typeof value === "number" ? Math.round(value * 100) / 100 : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parameters */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>Parameters</h3>
            <div style={{ 
              padding: 16,
              background: "#0f172a",
              borderRadius: 8,
              border: "1px solid #334155"
            }}>
              <pre style={{ 
                margin: 0, 
                fontSize: 12, 
                color: "#e2e8f0", 
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
                {JSON.stringify(run.parameters, null, 2)}
              </pre>
            </div>
          </div>

          {/* Used Text */}
          {run.usedText && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>Used Text</h3>
              <div style={{ display: "grid", gap: 16 }}>
                {run.usedText.promptText && (
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                      Prompt Text
                    </h4>
                    <div style={{ 
                      padding: 12,
                      background: "#0f172a",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      fontSize: 12,
                      color: "#e2e8f0",
                      maxHeight: 200,
                      overflow: "auto"
                    }}>
                      {run.usedText.promptText}
                    </div>
                  </div>
                )}
                {run.usedText.ocrText && (
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                      OCR Text
                    </h4>
                    <div style={{ 
                      padding: 12,
                      background: "#0f172a",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      fontSize: 12,
                      color: "#e2e8f0",
                      maxHeight: 200,
                      overflow: "auto"
                    }}>
                      {run.usedText.ocrText}
                    </div>
                  </div>
                )}
                {run.usedText.referenceText && (
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                      Reference Text
                    </h4>
                    <div style={{ 
                      padding: 12,
                      background: "#0f172a",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      fontSize: 12,
                      color: "#e2e8f0",
                      maxHeight: 200,
                      overflow: "auto"
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
              <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>Files</h3>
              <div style={{ 
                padding: 16,
                background: "#0f172a",
                borderRadius: 8,
                border: "1px solid #334155"
              }}>
                <pre style={{ 
                  margin: 0, 
                  fontSize: 12, 
                  color: "#e2e8f0", 
                  fontFamily: "monospace"
                }}>
                  {JSON.stringify(run.files, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
