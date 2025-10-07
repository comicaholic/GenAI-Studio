// frontend/src/components/HistoryModal/HistoryModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { SavedEvaluation, SavedChat, SavedAutomation, EvaluationSelection } from "@/types/history";
import { historyService } from "@/services/history";
import { useModel } from "@/context/ModelContext";
import { useNavigate } from "react-router-dom";

/**
 * HistoryModal - improved snapshot gallery + details panel
 *
 * Key features:
 *  - Snapshot grid (OCR / Reference / Prompt / Messages) - click to open details
 *  - Details panel: full text, copy button, word count, small actions
 *  - Defensive numeric formatter for results (avoids .toFixed on undefined)
 *  - Keeps Load / Run / Export actions intact
 *  - Automation support: shows run cards, clicking shows run details
 */

interface HistoryModalProps {
  item: SavedEvaluation | SavedChat | SavedAutomation | null;
  onClose: () => void;
  onLoad: (item: SavedEvaluation | SavedChat | SavedAutomation) => void;
  onRun: (item: SavedEvaluation | SavedChat | SavedAutomation) => void;
  onDelete?: (item: SavedEvaluation | SavedChat | SavedAutomation) => void;
}

type Snapshot = {
  id: string;
  kind: "ocr" | "reference" | "prompt" | "messages" | "file";
  title: string;
  text?: string;
  filename?: string;
  imageUrl?: string; // optional: wire-up if you store URLs
};

function formatNumber(v: unknown, digits = 3, fallback = "—") {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : fallback;
}

export default function HistoryModal({ item, onClose, onLoad, onRun, onDelete }: HistoryModalProps) {
  const [editedMetrics, setEditedMetrics] = useState<string[]>([]);
  const [editedParams, setEditedParams] = useState<Record<string, any>>({});
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<"snapshot" | "params" | "results">("snapshot");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { selected } = useModel();
  const navigate = useNavigate();

  useEffect(() => {
    if (item) {
      if ("metrics" in item && !("runs" in item)) {
        setEditedMetrics(Array.isArray(item.metrics) ? item.metrics : []);
        setEditedParams(item.parameters ?? {});
      } else if ("runs" in item) {
        // For automation items, we don't edit metrics/params at the top level
        setEditedMetrics([]);
        setEditedParams({});
      } else {
        setEditedParams(item.parameters ?? {});
      }
      // reset selected snapshot and run
      setSelectedSnapshotId(null);
      setSelectedRunId(null);
      setShowRunDetails(false);
      setRightMode("snapshot");
    }
  }, [item]);

  // Auto-switch to snapshot mode if params tab is selected but no parameters exist
  useEffect(() => {
    if (rightMode === "params" && Object.keys(editedParams).length === 0) {
      setRightMode("snapshot");
    }
  }, [rightMode, editedParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showRunDetails) {
          setShowRunDetails(false);
          setSelectedRunId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showRunDetails]);

  if (!item) return null;

  const isEvaluation = "type" in item && !("runs" in item);
  const isChat = !isEvaluation && !("runs" in item);
  const isAutomation = "runs" in item;

  // Build snapshots defensively from usedText and files
  const snapshots: Snapshot[] = useMemo(() => {
    const s: Snapshot[] = [];
    const used = (item as any).usedText ?? {};
    if (used?.ocrText) s.push({ id: "ocr", kind: "ocr", title: "OCR Text", text: String(used.ocrText) });
    if (used?.referenceText) s.push({ id: "reference", kind: "reference", title: "Reference", text: String(used.referenceText) });
    if (used?.promptText) s.push({ id: "prompt", kind: "prompt", title: "Prompt", text: String(used.promptText) });
    if (isChat && used?.chatHistory) {
      // Format chat messages for display
      const chatMessages = used.chatHistory.map((msg: any, index: number) => 
        `[${msg.role === 'user' ? 'User' : 'AI'}] ${msg.content}`
      ).join('\n\n');
      s.push({ id: "messages", kind: "messages", title: "Chat Messages", text: chatMessages });
    } else if (isChat && (item as any).messagesSummary) {
      s.push({ id: "messages", kind: "messages", title: "Messages Summary", text: String((item as any).messagesSummary) });
    }

    // include files as snapshots (filenames); if you supply imageUrl in item.files, that will be shown
    const files = (item as any).files ?? {};
    if (files.sourceFileName || files.sourceFileUrl) {
      s.push({
        id: "file_source",
        kind: "file",
        title: `Source File${files.sourceFileName ? `: ${files.sourceFileName}` : ""}`,
        filename: files.sourceFileName,
        text: files.sourceFileText ?? undefined,
        imageUrl: files.sourceFileUrl ?? undefined,
      });
    }
    if (files.referenceFileName || files.referenceFileUrl) {
      s.push({
        id: "file_ref",
        kind: "file",
        title: `Reference File${files.referenceFileName ? `: ${files.referenceFileName}` : ""}`,
        filename: files.referenceFileName,
        text: files.referenceFileText ?? undefined,
        imageUrl: files.referenceFileUrl ?? undefined,
      });
    }
    if (files.promptFileName || files.promptFileUrl) {
      s.push({
        id: "file_prompt",
        kind: "file",
        title: `Prompt File${files.promptFileName ? `: ${files.promptFileName}` : ""}`,
        filename: files.promptFileName,
        text: files.promptFileText ?? undefined,
        imageUrl: files.promptFileUrl ?? undefined,
      });
    }
    return s;
  }, [item, isEvaluation, isChat]);

  // selected snapshot object
  const selectedSnapshot = snapshots.find((x) => x.id === selectedSnapshotId) ?? snapshots[0] ?? null;

  // selected run object (for automations)
  const selectedRun = isAutomation ? (item as SavedAutomation).runs.find(r => r.id === selectedRunId) : null;

  const handleLoad = () => {
    const updatedItem = {
      ...item,
      parameters: editedParams,
      ...(isEvaluation && { metrics: editedMetrics }),
    };
    onLoad(updatedItem);
    onClose();
  };

  const handleRun = () => {
    const updatedItem = {
      ...item,
      parameters: editedParams,
      ...(isEvaluation && { metrics: editedMetrics }),
    };
    onRun(updatedItem);
    onClose();
  };

  const handleDelete = () => {
    if (!item || !onDelete) return;
    onDelete(item);
    onClose();
  };

  const handleExport = () => {
    if (isAutomation) return; // Don't export automation items
    
    const selection: EvaluationSelection = {
      type: isEvaluation ? (item as any).type : "chat",
      modelId: item.model.id,
      provider: item.model.provider,
      parameters: editedParams,
      metrics: isEvaluation ? editedMetrics : [],
      context: isChat ? (item as any).context : undefined,
      usedText: isEvaluation ? (item as any).usedText : (item as any).usedText || {},
      files: (item as any).files || {},
      timestamp: new Date().toISOString(),
    };
    historyService.exportSelection(selection);
  };

  const handleRunClick = (runId: string) => {
    setSelectedRunId(runId);
    setShowRunDetails(true);
  };

  const handleBackToRuns = () => {
    setShowRunDetails(false);
    setSelectedRunId(null);
  };

  // Render automation run cards
  const renderAutomationRuns = () => {
    if (!isAutomation) return null;
    const automation = item as SavedAutomation;
    
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>Automation Runs</h3>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            {automation.runs.length} runs • Status: {automation.status}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {automation.runs.map((run) => (
            <div
              key={run.id}
              onClick={() => handleRunClick(run.id)}
              style={{
                padding: 12,
                border: "1px solid #334155",
                borderRadius: 8,
                background: "#0f172a",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1e293b";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#0f172a";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
                    {run.runName}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {run.type.toUpperCase()} • {run.model.id}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: run.error ? "#ef4444" : "#10b981" }}>
                    {run.error ? "Error" : "Completed"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {run.finishedAt ? new Date(run.finishedAt).toLocaleDateString('en-GB') : "—"}
                  </div>
                </div>
              </div>
              {run.results && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(run.results).slice(0, 3).map(([key, value]) => (
                    <span key={key} style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      background: "#1e293b",
                      borderRadius: 4,
                      color: "#e2e8f0",
                    }}>
                      {key}: {formatNumber(value)}
                    </span>
                  ))}
                  {Object.keys(run.results).length > 3 && (
                    <span style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      background: "#1e293b",
                      borderRadius: 4,
                      color: "#94a3b8",
                    }}>
                      +{Object.keys(run.results).length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render run details
  const renderRunDetails = () => {
    if (!showRunDetails || !selectedRun) return null;
    
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={handleBackToRuns}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#e2e8f0",
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ← Back
          </button>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>{selectedRun.runName}</h3>
        </div>
        
        <div style={{ display: "grid", gap: 16 }}>
          {/* Run Info */}
          <div style={{ padding: 12, background: "#1e293b", borderRadius: 8 }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#e2e8f0" }}>Run Information</h4>
            <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <div style={{ color: "#94a3b8" }}>
                Type: <span style={{ color: "#e2e8f0" }}>{selectedRun.type.toUpperCase()}</span>
              </div>
              <div style={{ color: "#94a3b8" }}>
                Model: <span style={{ color: "#e2e8f0" }}>{selectedRun.model.id}</span>
              </div>
              <div style={{ color: "#94a3b8" }}>
                Status: <span style={{ color: selectedRun.error ? "#ef4444" : "#10b981" }}>
                  {selectedRun.error ? "Error" : "Completed"}
                </span>
              </div>
              <div style={{ color: "#94a3b8" }}>
                Started: <span style={{ color: "#e2e8f0" }}>
                  {new Date(selectedRun.startedAt).toLocaleDateString('en-GB')}
                </span>
              </div>
              {selectedRun.finishedAt && (
                <div style={{ color: "#94a3b8" }}>
                  Finished: <span style={{ color: "#e2e8f0" }}>
                    {new Date(selectedRun.finishedAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {selectedRun.error && (
            <div style={{ padding: 12, background: "#4c1d1d", border: "1px solid #ef4444", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#ef4444" }}>Error</h4>
              <div style={{ color: "#fca5a5", fontSize: 12 }}>{selectedRun.error}</div>
            </div>
          )}

          {/* Results */}
          {selectedRun.results && (
            <div style={{ padding: 12, background: "#1e293b", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#e2e8f0" }}>Results</h4>
              <div style={{ display: "grid", gap: 4 }}>
                {Object.entries(selectedRun.results).map(([key, value]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#94a3b8" }}>{key}</span>
                    <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>
                      {formatNumber(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Used Text */}
          {selectedRun.usedText && (
            <div style={{ padding: 12, background: "#1e293b", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#e2e8f0" }}>Used Text</h4>
              <div style={{ display: "grid", gap: 8 }}>
                {selectedRun.usedText.promptText && (
                  <div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Prompt:</div>
                    <div style={{ 
                      background: "#0f172a", 
                      padding: 8, 
                      borderRadius: 4, 
                      fontSize: 12, 
                      color: "#e2e8f0",
                      maxHeight: 300,
                      overflow: "auto",
                      whiteSpace: "pre-wrap"
                    }}>
                      {selectedRun.usedText.promptText}
                    </div>
                  </div>
                )}
                {selectedRun.usedText.referenceText && (
                  <div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Reference:</div>
                    <div style={{ 
                      background: "#0f172a", 
                      padding: 8, 
                      borderRadius: 4, 
                      fontSize: 12, 
                      color: "#e2e8f0",
                      maxHeight: 300,
                      overflow: "auto",
                      whiteSpace: "pre-wrap"
                    }}>
                      {selectedRun.usedText.referenceText}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
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
          maxWidth: "1200px",
          height: "80vh",
          background: "#0b1220",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 24,
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              {isAutomation ? "🤖" : isEvaluation ? "📁" : "💬"} {isAutomation ? (item as SavedAutomation).name : item.title}
            </h2>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              {isAutomation ? "Automation" : isEvaluation ? `${(item as SavedEvaluation).type.toUpperCase()} Evaluation` : "Chat"}
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

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {isAutomation ? (
            showRunDetails ? renderRunDetails() : renderAutomationRuns()
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Left: Snapshots */}
              <div>
                <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 500 }}>Snapshots</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {snapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      onClick={() => setSelectedSnapshotId(snapshot.id)}
                      style={{
                        padding: 12,
                        border: "1px solid #334155",
                        borderRadius: 8,
                        background: selectedSnapshotId === snapshot.id ? "#1e293b" : "#0f172a",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>{snapshot.title}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        {snapshot.text ? `${snapshot.text.length} characters` : snapshot.filename || "No content"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Details */}
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={() => setRightMode("snapshot")}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      background: rightMode === "snapshot" ? "#1e293b" : "#0f172a",
                      color: rightMode === "snapshot" ? "#e2e8f0" : "#94a3b8",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Content
                  </button>
                  {Object.keys(editedParams).length > 0 && (
                    <button
                      onClick={() => setRightMode("params")}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        background: rightMode === "params" ? "#1e293b" : "#0f172a",
                        color: rightMode === "params" ? "#e2e8f0" : "#94a3b8",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Parameters
                    </button>
                  )}
                  {isEvaluation && (
                    <button
                      onClick={() => setRightMode("results")}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        background: rightMode === "results" ? "#1e293b" : "#0f172a",
                        color: rightMode === "results" ? "#e2e8f0" : "#94a3b8",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Results
                    </button>
                  )}
                </div>

                {rightMode === "snapshot" && selectedSnapshot && (
                  <div>
                    <h4 style={{ margin: "0 0 12px 0" }}>{selectedSnapshot.title}</h4>
                    <div style={{
                      background: "#1e293b",
                      padding: 12,
                      borderRadius: 8,
                      maxHeight: 500,
                      overflow: "auto",
                      fontSize: 13,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap"
                    }}>
                      {selectedSnapshot.text || "No content available"}
                    </div>
                  </div>
                )}

                {rightMode === "params" && (
                  <div>
                    <h4 style={{ margin: "0 0 12px 0" }}>Parameters</h4>
                    <div style={{ display: "grid", gap: 8 }}>
                      {Object.entries(editedParams).map(([key, value]) => (
                        <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#94a3b8" }}>{key}</span>
                          <span style={{ color: "#e2e8f0" }}>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rightMode === "results" && isEvaluation && (
                  <div>
                    <h4 style={{ margin: "0 0 12px 0" }}>Results</h4>
                    <div style={{ display: "grid", gap: 8 }}>
                      {Object.entries((item as SavedEvaluation).results || {}).map(([key, value]) => (
                        <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#94a3b8" }}>{key}</span>
                          <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>
                            {formatNumber(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isAutomation && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
            <button
              onClick={handleExport}
              style={{
                padding: "10px 20px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Export
            </button>
            <button
              onClick={handleLoad}
              style={{
                padding: "10px 20px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Load
            </button>
            <button
              onClick={handleRun}
              style={{
                padding: "10px 20px",
                border: "1px solid #2563eb",
                borderRadius: 6,
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Run
            </button>
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: "10px 20px",
                  border: "1px solid #ef4444",
                  borderRadius: 6,
                  background: "#ef4444",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                </svg>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Delete Confirmation Modal */}
    {showDeleteConfirm && (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
        }}
        onClick={() => setShowDeleteConfirm(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#0b1220",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 24,
            color: "#e2e8f0",
            maxWidth: 400,
            width: "90%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40,
              height: 40,
              background: "#ef4444",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Delete {isEvaluation ? "Evaluation" : isChat ? "Chat" : "Automation"}?
            </h3>
          </div>
          
          <p style={{ margin: "0 0 20px 0", color: "#94a3b8", lineHeight: 1.5 }}>
            Are you sure you want to delete this {isEvaluation ? "evaluation" : isChat ? "chat" : "automation"}? 
            This action cannot be undone.
          </p>
          
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                padding: "10px 20px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              style={{
                padding: "10px 20px",
                border: "1px solid #ef4444",
                borderRadius: 6,
                background: "#ef4444",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}