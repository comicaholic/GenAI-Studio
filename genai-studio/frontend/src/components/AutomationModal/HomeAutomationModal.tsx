// src/components/AutomationModal/HomeAutomationModal.tsx
import React from 'react';
import { SavedAutomation } from '@/types/history';

interface HomeAutomationModalProps {
  automation: SavedAutomation | null;
  onClose: () => void;
  onLoad: (automation: SavedAutomation) => void;
  onRun: (automation: SavedAutomation) => void;
  onLoadRun: (automation: SavedAutomation, runIndex: number) => void;
}

export default function HomeAutomationModal({ 
  automation, 
  onClose, 
  onLoad, 
  onRun, 
  onLoadRun 
}: HomeAutomationModalProps) {
  if (!automation) return null;

  const successCount = automation.runs?.filter(run => run.status === 'completed' && !run.error).length || 0;
  const errorCount = automation.runs?.filter(run => run.status === 'error' || run.error).length || 0;
  const totalRuns = automation.runs?.length || 0;

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
          borderRadius: 12,
          padding: 24,
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 600 }}>{automation.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14, color: "#94a3b8" }}>
              <span>Type: {automation.type}</span>
              <span>Model: {automation.model?.label || automation.model?.id}</span>
              <span>Provider: {automation.model?.provider}</span>
              <span>Runs: {totalRuns}</span>
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
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Status Summary */}
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
              background: successCount > 0 ? "#10b981" : "#6b7280" 
            }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Success: {successCount}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ 
              width: 12, 
              height: 12, 
              borderRadius: "50%", 
              background: errorCount > 0 ? "#ef4444" : "#6b7280" 
            }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Errors: {errorCount}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ 
              width: 12, 
              height: 12, 
              borderRadius: "50%", 
              background: "#3b82f6" 
            }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Total: {totalRuns}</span>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>
            Created: {new Date(automation.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => onLoad(automation)}
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
            Load Automation
          </button>
          <button
            onClick={() => onRun(automation)}
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, #10b981, #059669)",
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
              <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
            </svg>
            Run Automation
          </button>
        </div>

        {/* Runs List */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>Individual Runs</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {automation.runs?.map((run, index) => (
              <div
                key={run.id}
                style={{
                  padding: 16,
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => onLoadRun(automation, index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1e293b";
                  e.currentTarget.style.borderColor = "#475569";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#0f172a";
                  e.currentTarget.style.borderColor = "#334155";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                    {run.name}
                  </h4>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: "50%", 
                      background: run.error ? "#ef4444" : "#10b981" 
                    }} />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {run.error ? "Error" : "Success"}
                    </span>
                  </div>
                </div>
                
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                  Model: {run.modelId || automation.model?.id} | 
                  Status: {run.status} | 
                  Started: {new Date(run.startedAt).toLocaleString()}
                </div>
                
                {run.error && (
                  <div style={{ 
                    fontSize: 12, 
                    color: "#ef4444", 
                    background: "#ef444410", 
                    padding: 8, 
                    borderRadius: 4,
                    marginBottom: 8
                  }}>
                    Error: {run.error}
                  </div>
                )}
                
                {run.results && !run.error && (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Results: {Object.keys(run.results).length} metrics computed
                  </div>
                )}
                
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
                  Click to load this run as a single evaluation
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

