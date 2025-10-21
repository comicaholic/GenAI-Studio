import React, { useMemo, useRef, useState, useEffect } from "react";
import { Preset, PresetStore } from "@/stores/presetStore";

type Mode = "normal" | "saveAs" | "createNew";

export default function PresetManager({
  onPresetChange,
  autoApplyOnMount = false,
  presetStore,
  currentContent = "",
  currentParameters,
  currentMetrics,
  selectedPresetTitle,
}: { 
  onPresetChange: (preset: { title: string; body: string; id: string; parameters?: Preset['parameters']; metrics?: any }) => void;
  autoApplyOnMount?: boolean;
  presetStore: PresetStore;
  currentContent?: string;
  currentParameters?: Preset['parameters'];
  currentMetrics?: any;
  selectedPresetTitle?: string;
}) {
  const [presets, setPresets] = useState<Preset[]>(presetStore.getPresets());
  const [selected, setSelected] = useState(() => {
    // Try to restore last selected preset from localStorage
    const lastSelected = localStorage.getItem(`preset-selected-${presetStore.constructor.name}`);
    return lastSelected || "default";
  });
  
  const current = useMemo(() => {
    const found = presets.find((p) => p.title === selected);
    return found ?? presets[0] ?? { id: "preset-empty", title: "(empty)", body: "" };
  }, [presets, selected]);

  // Track if current content differs from selected preset
  const hasChanges = useMemo(() => {
    if (selected === "__new__" || selected === "__import__") return false;
    const currentPreset = presets.find(p => p.title === selected);
    if (!currentPreset) return false;
    
    const contentChanged = currentContent !== currentPreset.body;
    const paramsChanged = currentParameters && JSON.stringify(currentParameters) !== JSON.stringify(currentPreset.parameters);
    const metricsChanged = currentMetrics && JSON.stringify(currentMetrics) !== JSON.stringify(currentPreset.metrics);
    return contentChanged || paramsChanged || metricsChanged;
  }, [selected, currentContent, currentParameters, currentMetrics, presets]);

  const [mode, setMode] = useState<Mode>("normal");
  const [newTitle, setNewTitle] = useState("");
  const [importModal, setImportModal] = useState(false);
  // --- 3-dot menu state ---
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Only apply preset on mount if explicitly enabled
  useEffect(() => {
    if (!autoApplyOnMount) return;
    onPresetChange({
      title: current.title,
      body: current.body,
      id: current.id,
      parameters: current.parameters,
      metrics: current.metrics
    });
    // run once on mount; don't depend on current.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selected preset title from parent if provided
  useEffect(() => {
    if (!selectedPresetTitle) return;
    if (selectedPresetTitle === selected) return;
    const exists = presets.some(p => p.title === selectedPresetTitle);
    if (exists) {
      setSelected(selectedPresetTitle);
      localStorage.setItem(`preset-selected-${presetStore.constructor.name}`, selectedPresetTitle);
    }
  }, [selectedPresetTitle, presets, presetStore.constructor.name, selected]);

  // Handle explicit preset selection (not tab switching)
  const handlePresetChange = (newPresetTitle: string) => {
    // Handle virtual options
    if (newPresetTitle === "__new__") {
      setMode("createNew");
      setNewTitle("");
      return;
    }
    if (newPresetTitle === "__import__") {
      setImportModal(true);
      return;
    }

    setSelected(newPresetTitle);
    // Save selection to localStorage for persistence
    localStorage.setItem(`preset-selected-${presetStore.constructor.name}`, newPresetTitle);
    
    // When user explicitly selects a preset, notify parent
    const newPreset = presets.find(p => p.title === newPresetTitle) ?? current;
    if (newPreset) {
      onPresetChange({
        title: newPreset.title,
        body: newPreset.body,
        id: newPreset.id,
        parameters: newPreset.parameters,
        metrics: newPreset.metrics
      });
    }
  };

  // Save changes to current preset
  const saveCurrentPreset = () => {
    if (selected === "__new__" || selected === "__import__") return;
    
    const currentPreset = presets.find(p => p.title === selected);
    if (!currentPreset) return;

    const updatedPreset = {
      ...currentPreset,
      body: currentContent,
      parameters: currentParameters || currentPreset.parameters,
      metrics: currentMetrics || currentPreset.metrics,
      updatedAt: Date.now()
    };

    presetStore.updatePreset(currentPreset.id, {
      title: updatedPreset.title,
      body: updatedPreset.body,
      parameters: updatedPreset.parameters,
      metrics: updatedPreset.metrics
    });
    
    // Refresh presets
    setPresets(presetStore.getPresets());
  };

  const commit = () => {
    saveCurrentPreset();
  };

  const revert = () => {
    if (!hasChanges) return;
    
    // Revert to the original preset values
    const currentPreset = presets.find(p => p.title === selected);
    if (!currentPreset) return;
    
    // Notify parent to revert to original values
    onPresetChange({
      title: currentPreset.title,
      body: currentPreset.body,
      id: currentPreset.id,
      parameters: currentPreset.parameters,
      metrics: currentPreset.metrics
    });
  };

  const saveAsNew = () => {
    if (!newTitle.trim()) return;
    const t = newTitle.trim();
    const id = "preset-" + t.toLowerCase().replace(/\s+/g, "-");
    
    // Save the new preset with current values (including uncommitted changes)
    presetStore.savePreset({ 
      id, 
      title: t, 
      body: currentContent,
      parameters: currentParameters,
      metrics: currentMetrics
    });
    
    setPresets(presetStore.getPresets());
    // Switch to the new preset and apply it immediately (since it contains current values)
    setSelected(t);
    localStorage.setItem(`preset-selected-${presetStore.constructor.name}`, t);
    
    // Apply the new preset immediately since it contains the current values
    onPresetChange({
      title: t,
      body: currentContent,
      id: id,
      parameters: currentParameters,
      metrics: currentMetrics
    });
    
    setMode("normal");
    setNewTitle("");
  };

  const deletePreset = () => {
    presetStore.deletePreset(current.id);
    const updatedPresets = presetStore.getPresets();
    setPresets(updatedPresets);
    const fallback = updatedPresets[0] ?? { id: "preset-empty", title: "(empty)", body: "" };
    handlePresetChange(fallback.title);
    setMenuOpen(false);
  };

  const dupePreset = async () => {
    await navigator.clipboard.writeText(current.id);
    setMenuOpen(false);
    alert("Copied preset identifier: " + current.id);
  };

  const revealInExplorer = () => {
    // stub: we'll wire this to a backend/electron action later
    setMenuOpen(false);
    alert("Would reveal preset file in Explorer.\n(id: " + current.id + ")");
  };

  const exportPreset = () => {
    const presetData = {
      title: current.title,
      body: current.body,
      id: current.id,
      type: "preset",
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(presetData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${current.title.replace(/[^a-zA-Z0-9]/g, '_')}_preset.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Preset</h3>

        {/* 3-dot menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Preset actions"
            style={{
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "4px 8px",
              background: "#1e293b",
              color: "#e2e8f0",
              cursor: "pointer",
            }}
          >
            ⋯
          </button>

          {/* Popover menu (hidden until clicked) */}
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: 34,
                minWidth: 220,
                background: "#0b1220",
                color: "#e2e8f0",
                border: "1px solid #334155",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                borderRadius: 10,
                padding: 6,
                zIndex: 1000,
              }}
            >
              <MenuItem onClick={dupePreset}>Duplicate Preset</MenuItem>
              <MenuItem onClick={exportPreset}>Export Preset</MenuItem>
              <MenuItem onClick={revealInExplorer}>Reveal in File Explorer</MenuItem>
              <MenuDivider />
              <MenuItem danger onClick={deletePreset}>Delete…</MenuItem>
            </div>
          )}
        </div>
      </div>

      {/* Selector row */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
        {mode === "normal" ? (
          <>
            <select
              value={selected}
              onChange={(e) => handlePresetChange(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#e2e8f0",
              }}
            >
              {/* virtual actions at top */}
              <option value="__new__">+ New preset…</option>
              <option value="__import__">↥ Import…</option>
              <optgroup label="Presets">
                {presets.map((p) => (
                  <option key={p.id} value={p.title}>
                    {p.title}
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              onClick={commit}
              disabled={!hasChanges}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: hasChanges ? "1px solid #16a34a" : "1px solid #334155",
                background: hasChanges ? "#16a34a" : "#1e293b",
                color: hasChanges ? "#fff" : "#94a3b8",
                fontSize: 12,
                fontWeight: 600,
                cursor: hasChanges ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
                opacity: hasChanges ? 1 : 0.6,
              }}
              onMouseEnter={(e) => {
                if (hasChanges) {
                  e.currentTarget.style.background = "#15803d";
                }
              }}
              onMouseLeave={(e) => {
                if (hasChanges) {
                  e.currentTarget.style.background = "#16a34a";
                }
              }}
            >
              Commit
            </button>
            <button
              onClick={revert}
              disabled={!hasChanges}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: hasChanges ? "1px solid #ef4444" : "1px solid #334155",
                background: hasChanges ? "#ef4444" : "#1e293b",
                color: hasChanges ? "#fff" : "#94a3b8",
                fontSize: 12,
                fontWeight: 600,
                cursor: hasChanges ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
                opacity: hasChanges ? 1 : 0.6,
              }}
              onMouseEnter={(e) => {
                if (hasChanges) {
                  e.currentTarget.style.background = "#dc2626";
                }
              }}
              onMouseLeave={(e) => {
                if (hasChanges) {
                  e.currentTarget.style.background = "#ef4444";
                }
              }}
            >
              Revert
            </button>
          </>
        ) : (
          <>
            <input
              autoFocus
              placeholder="Preset title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0" }}
            />
            <button
              onClick={() => {
                setMode("normal");
                setNewTitle("");
              }}
              style={{ border: "1px solid #334155", padding: "6px 10px", borderRadius: 8, background: "#1e293b", color: "#e2e8f0" }}
            >
              Cancel
            </button>
            <button
              onClick={saveAsNew}
              style={{ border: "1px solid #16a34a", padding: "6px 10px", borderRadius: 8, background: "#16a34a", color: "#fff" }}
            >
              Save
            </button>
          </>
        )}
      </div>

      {/* interpret virtual options */}
      {mode === "normal" && selected === "__new__" && (() => {
        setMode("createNew");
        handlePresetChange(presets[0].title);
        return null;
      })()}
      {mode === "normal" && selected === "__import__" && (() => {
        setImportModal(true);
        handlePresetChange(presets[0].title);
        return null;
      })()}

      {/* Action buttons */}
      {mode === "normal" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              // First commit any changes to the current preset
              if (hasChanges) {
                commit();
              }
              // Then open save as new dialog
              setMode("saveAs");
              setNewTitle("");
            }}
            style={{
              border: "1px solid #2563eb",
              padding: "6px 10px",
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
            }}
          >
            Save as new
          </button>
        </div>
      )}

      {/* Import modal */}
      {importModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "min(500px, 90vw)",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>Import Preset</h3>
            <div
              style={{
                border: "2px dashed #334155",
                borderRadius: 8,
                padding: 20,
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              Drag and drop preset files here or click to select
              <br />
              <small>Supported formats: .txt, .json</small>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setImportModal(false)}
                style={{
                  border: "1px solid #334155",
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#1e293b",
                  color: "#e2e8f0",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Import logic would go here
                  setImportModal(false);
                }}
                style={{
                  border: "1px solid #16a34a",
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#16a34a",
                  color: "#fff",
                }}
              >
                Import Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components
function MenuItem({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "8px 12px",
        border: "none",
        background: "transparent",
        color: danger ? "#ef4444" : "#e2e8f0",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 6,
        fontSize: 14,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "#7f1d1d" : "#1e293b";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: "#334155", margin: "4px 0" }} />;
}
