import React, { useMemo, useRef, useState, useEffect } from "react";
import { Preset, PresetStore } from "@/stores/presetStore";

type Mode = "normal" | "saveAs" | "createNew";

export default function PresetManager({
  onPresetChange,
  autoApplyOnMount = false,
  presetStore,
}: { 
  onPresetChange: (preset: { title: string; body: string; id: string }) => void;
  autoApplyOnMount?: boolean;
  presetStore: PresetStore;
}) {
  const [presets, setPresets] = useState<Preset[]>(presetStore.getPresets());
  const [selected, setSelected] = useState("default");
  const current = useMemo(() => {
    const found = presets.find((p) => p.title === selected);
    return found ?? presets[0] ?? { id: "preset-empty", title: "(empty)", body: "" };
  }, [presets, selected]);

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
    onPresetChange(current);
    // run once on mount; don't depend on current.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle explicit preset selection (not tab switching)
  const handlePresetChange = (newPresetTitle: string) => {
    setSelected(newPresetTitle);
    // When user explicitly selects a preset, notify parent
    const newPreset = presets.find(p => p.title === newPresetTitle) ?? current;
    if (newPreset) onPresetChange(newPreset);
  };

  const commit = () => {
    // This would commit changes to the current preset
    // For now, just a placeholder since we're not managing text here
  };

  const saveAsNew = () => {
    if (!newTitle.trim()) return;
    const t = newTitle.trim();
    const id = "preset-" + t.toLowerCase().replace(/\s+/g, "-");
    presetStore.savePreset({ id, title: t, body: current.body });
    setPresets(presetStore.getPresets());
    handlePresetChange(t);
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
              Save new preset
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
            disabled={true} // Always disabled since we're not managing text here
            onClick={commit}
            style={{
              opacity: 0.6,
              border: "1px solid #334155",
              padding: "6px 10px",
              borderRadius: 8,
              background: "#1e293b",
              color: "#e2e8f0",
            }}
          >
            Commit changes
          </button>
          <button
            onClick={() => {
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
