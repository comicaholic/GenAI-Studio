// frontend/src/components/HistoryModal/HistoryModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { SavedEvaluation, SavedChat, EvaluationSelection } from "@/types/history";
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
 */

interface HistoryModalProps {
  item: SavedEvaluation | SavedChat | null;
  onClose: () => void;
  onLoad: (item: SavedEvaluation | SavedChat) => void;
  onRun: (item: SavedEvaluation | SavedChat) => void;
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

export default function HistoryModal({ item, onClose, onLoad, onRun }: HistoryModalProps) {
  const [editedMetrics, setEditedMetrics] = useState<string[]>([]);
  const [editedParams, setEditedParams] = useState<Record<string, any>>({});
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<"snapshot" | "params" | "results">("snapshot");
  const { selected } = useModel();
  const navigate = useNavigate();

  useEffect(() => {
    if (item) {
      if ("metrics" in item) {
        setEditedMetrics(Array.isArray(item.metrics) ? item.metrics : []);
        setEditedParams(item.parameters ?? {});
      } else {
        setEditedParams(item.parameters ?? {});
      }
      // reset selected snapshot
      setSelectedSnapshotId(null);
      setRightMode("snapshot");
    }
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return null;

  const isEvaluation = "type" in item;
  const isChat = !isEvaluation;

  // Build snapshots defensively from usedText and files
  const snapshots: Snapshot[] = useMemo(() => {
    const s: Snapshot[] = [];
    const used = (item as any).usedText ?? {};
    if (used?.ocrText) s.push({ id: "ocr", kind: "ocr", title: "OCR Text", text: String(used.ocrText) });
    if (used?.referenceText) s.push({ id: "reference", kind: "reference", title: "Reference", text: String(used.referenceText) });
    if (used?.promptText) s.push({ id: "prompt", kind: "prompt", title: "Prompt", text: String(used.promptText) });
    if (isChat && (item as any).messagesSummary) s.push({ id: "messages", kind: "messages", title: "Messages Summary", text: String((item as any).messagesSummary) });

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
  }, [item, isEvaluation]);

  // selected snapshot object
  const selectedSnapshot = snapshots.find((x) => x.id === selectedSnapshotId) ?? snapshots[0] ?? null;

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

  const handleExport = () => {
    const selection: EvaluationSelection = {
      type: isEvaluation ? (item as any).type : "chat",
      modelId: item.model.id,
      provider: item.model.provider,
      parameters: editedParams,
      metrics: isEvaluation ? editedMetrics : [],
      context: isChat ? (item as any).context : undefined,
      usedText: isEvaluation ? (item as any).usedText : (item as any).usedText || {},
      files: isEvaluation ? (item as any).files : {},
      timestamp: new Date().toISOString(),
    };
    historyService.exportSelection(selection);
  };

  // small helpers
  const copyToClipboard = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      // visual affordance could be added - using alert for simplicity
      // replace with toast if you have one
      alert("Copied to clipboard");
    } catch (e) {
      console.error("copy failed", e);
    }
  };

  const wordCount = (t?: string) => {
    if (!t) return 0;
    return String(t).trim().split(/\s+/).filter(Boolean).length;
  };

  // available metrics (same as before)
  const availableMetrics = [
    "rouge",
    "bleu",
    "f1",
    "em",
    "bertscore",
    "perplexity",
    "accuracy",
    "precision",
    "recall",
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: "#0b1220",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 20,
          maxWidth: "90vw",
          maxHeight: "86vh",
          width: 1100,
          overflow: "hidden",
          color: "#e2e8f0",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              {isEvaluation ? `${(item as any).type?.toUpperCase() ?? "EVALUATION"} Evaluation` : "Chat Session"}
            </h2>
            <p style={{ margin: "6px 0 0 0", color: "#94a3b8", fontSize: 13 }}>{(item as any).title}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer" }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, marginTop: 12, overflow: "hidden" }}>
          {/* Left: Model → Files → Evaluation Parameters (collapsible) → Results (anchor) → Snapshots */}
          <div style={{ overflow: "auto", paddingRight: 6 }}>
            {/* Model */}
            <section style={{ marginBottom: 12 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Model</h4>
              <div style={{ padding: 10, borderRadius: 8, border: "1px solid #334155", background: "#071022" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.model.id}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.model.provider}</div>
              </div>
            </section>

            {/* Files Used */}
            <section style={{ marginBottom: 12 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Files Used</h4>
              <div style={{ padding: 12, borderRadius: 8, border: "1px solid #334155", background: "#071022" }}>
                {isEvaluation ? (
                  <>
                    {(item as any).files?.sourceFileName && <div style={{ fontSize: 13, marginBottom: 6 }}>Source: {(item as any).files.sourceFileName}</div>}
                    {(item as any).files?.referenceFileName && <div style={{ fontSize: 13, marginBottom: 6 }}>Reference: {(item as any).files.referenceFileName}</div>}
                    {(item as any).files?.promptFileName && <div style={{ fontSize: 13 }}>Prompt: {(item as any).files.promptFileName}</div>}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>No files attached</div>
                )}
              </div>
            </section>

            {/* Evaluation Parameters button */}
            <section style={{ marginBottom: 12 }}>
              <button
                onClick={() => setRightMode("params")}
                className="rb-hover-lift rb-press"
                style={{ width: "100%", textAlign: "left", padding: 10, borderRadius: 8, border: "1px solid #334155", background: rightMode === "params" ? "#0f2236" : "#071022", color: "#e2e8f0", cursor: "pointer" }}
              >
                Evaluation Parameters
              </button>
            </section>

            {/* Results button */}
            <section style={{ marginBottom: 12 }}>
              <button
                onClick={() => setRightMode("results")}
                className="rb-hover-lift rb-press"
                style={{ width: "100%", textAlign: "left", padding: 10, borderRadius: 8, border: "1px solid #334155", background: rightMode === "results" ? "#0f2236" : "#071022", color: "#e2e8f0", cursor: "pointer" }}
              >
                Results
              </button>
            </section>

            {/* Snapshot Gallery */}
            <section>
              <h4 style={{ margin: "12px 0 8px 0" }}>Snapshots</h4>
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "#071022",
                }}
              >
                {snapshots.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>No snapshots available</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {snapshots.map((s) => {
                      const isSelected = s.id === selectedSnapshotId || (!selectedSnapshotId && s.id === snapshots[0]?.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedSnapshotId(s.id); setRightMode("snapshot"); }}
                          style={{
                            textAlign: "left",
                            padding: 8,
                            background: isSelected ? "#0f2236" : "transparent",
                            border: isSelected ? "1px solid #2a4b73" : "1px solid transparent",
                            borderRadius: 8,
                            color: "#e2e8f0",
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-start",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ flex: "0 0 56px", height: 56, borderRadius: 6, background: "#07182a", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12, overflow: "hidden" }}>
                            {/* If imageUrl exists you can show an <img />, otherwise show an icon or small preview */}
                            {s.imageUrl ? (
                              <img src={s.imageUrl} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ padding: 6 }}>{s.kind.toUpperCase()}</div>
                            )}
                          </div>

                          <div style={{ flex: "1 1 auto" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div>
                            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
                              {s.text ? `${String(s.text).slice(0, 120)}${String(s.text).length > 120 ? "…" : ""}` : s.filename ?? "No preview"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Main: Results + Selected Snapshot details */}
          <div style={{ overflow: "auto", padding: "6px 8px" }}>
            {/* Results (only when selected) */}
            {rightMode === "results" && isEvaluation && (item as any).results && (
              <section style={{ marginBottom: 12 }}>
                <h4 style={{ margin: "0 0 8px 0" }}>Results</h4>
                <div style={{ padding: 12, borderRadius: 8, border: "1px solid #334155", background: "#071022" }}>
                  {Object.entries((item as any).results).map(([key, value]) => (
                    <div key={key} style={{ fontSize: 13, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                      <div style={{ color: "#cfe6ff" }}>{key}</div>
                      <div style={{ color: "#e2e8f0" }}>{typeof value === "number" ? formatNumber(value, 3) : String(value)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            
            {/* Right mode: params */}
            {(rightMode as any) === "params" && (
              <section style={{ marginBottom: 12 }}>
                <h4 style={{ margin: "0 0 8px 0" }}>Evaluation Parameters</h4>
                <div style={{ padding: 10, borderRadius: 8, border: "1px solid #334155", background: "#071022" }}>
                  {isEvaluation && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Metrics</div>
                      {availableMetrics.map((metric) => {
                        const checked = editedMetrics.includes(metric);
                        return (
                          <label key={metric} style={{ display: "flex", alignItems: "center", marginBottom: 8, fontSize: 13 }}>
                            <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setEditedMetrics((m) => [...m, metric]); else setEditedMetrics((m) => m.filter((x) => x !== metric)); }} style={{ marginRight: 8 }} />
                            {metric.toUpperCase()}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Parameters</div>
                    <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Temperature</label>
                    <input type="number" min="0" max="2" step="0.1" value={editedParams.temperature ?? 0.7} onChange={(e) => setEditedParams({ ...editedParams, temperature: parseFloat(e.target.value) })} style={{ width: "100%", padding: 6, backgroundColor: "#0b1220", border: "1px solid #223044", borderRadius: 6, color: "#e2e8f0", fontSize: 13, marginBottom: 8 }} />
                    <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Max Tokens</label>
                    <input type="number" min="1" value={editedParams.max_tokens ?? 1000} onChange={(e) => setEditedParams({ ...editedParams, max_tokens: parseInt(e.target.value, 10) })} style={{ width: "100%", padding: 6, backgroundColor: "#0b1220", border: "1px solid #223044", borderRadius: 6, color: "#e2e8f0", fontSize: 13, marginBottom: 8 }} />
                    <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Top P</label>
                    <input type="number" min="0" max="1" step="0.1" value={editedParams.top_p ?? 1.0} onChange={(e) => setEditedParams({ ...editedParams, top_p: parseFloat(e.target.value) })} style={{ width: "100%", padding: 6, backgroundColor: "#0b1220", border: "1px solid #223044", borderRadius: 6, color: "#e2e8f0", fontSize: 13 }} />
                  </div>
                </div>
              </section>
            )}

            {/* Selected snapshot details */}
            {(rightMode as any) === "snapshot" && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>{selectedSnapshot ? selectedSnapshot.title : "Selected Snapshot"}</h4>
              <div style={{ padding: 12, borderRadius: 8, border: "1px solid #334155", background: "#071022", minHeight: 260 }}>
                {!selectedSnapshot ? (
                  <div style={{ color: "#94a3b8" }}>Select a snapshot to see details</div>
                ) : (
                  <>
                    {/* If snapshot has an imageUrl, show it top */}
                    {selectedSnapshot.imageUrl && (
                      <div style={{ marginBottom: 8 }}>
                        <img src={selectedSnapshot.imageUrl} alt={selectedSnapshot.title} style={{ width: "100%", borderRadius: 6 }} />
                      </div>
                    )}

                    {/* Text content */}
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#e6eef8", marginBottom: 10 }}>
                      {selectedSnapshot.text ?? (selectedSnapshot.filename ? `[File: ${selectedSnapshot.filename}]` : "No text available")}
                    </div>

                    {/* Small metadata / actions */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>
                        Words: {formatNumber(wordCount(selectedSnapshot.text), 0, "0")}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => copyToClipboard(selectedSnapshot.text)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid #2a3b56",
                            background: "transparent",
                            color: "#e2e8f0",
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => {
                            // If you have a route to view a full file, navigate there.
                            // Otherwise open a new tab with blob containing the text:
                            if (selectedSnapshot.text) {
                              const blob = new Blob([selectedSnapshot.text], { type: "text/plain" });
                              const url = URL.createObjectURL(blob);
                              window.open(url, "_blank");
                              setTimeout(() => URL.revokeObjectURL(url), 1000 * 30);
                            }
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "none",
                            background: "#1f6feb",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          Open Full
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            )}
            {/* Actions are moved to sticky footer below */}
          </div>
        </div>

        {/* Footer — sticky actions always visible */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>Timestamp: {(item as any).timestamp ?? "unknown"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="rb-hover-lift rb-press" onClick={handleExport} style={{ padding: "10px", borderRadius: 8, border: "1px solid #334155", background: "#091322", color: "#e2e8f0", cursor: "pointer", fontSize: 14 }}>Export</button>
            <button className="rb-hover-lift rb-press" onClick={handleLoad} style={{ padding: "10px", borderRadius: 8, border: "1px solid #334155", background: "#091322", color: "#e2e8f0", cursor: "pointer", fontSize: 14 }}>Load</button>
            <button className="rb-hover-lift rb-press" onClick={handleRun} style={{ padding: "10px", borderRadius: 8, border: "none", background: "#1f6feb", color: "#fff", cursor: "pointer", fontSize: 14 }}>Run</button>
          </div>
        </div>
      </div>
    </div>
  );
}
