import React, { useMemo, useRef, useState, useEffect } from "react";
import ExpandableTextarea from "@/components/ExpandableTextarea/ExpandableTextarea";
import { Preset, PresetStore } from "@/stores/presetStore";

type Mode = "normal" | "saveAs" | "createNew";

export default function PromptPresetBox({
  onPromptChange,
  value = "",
  presetStore,
}: { 
  onPromptChange: (p: string) => void;
  value?: string;
  presetStore: PresetStore;
}) {
  const [presets, setPresets] = useState<Preset[]>(presetStore.getPresets());
  const [selected, setSelected] = useState("default");
  const current = useMemo(() => {
    const found = presets.find((p) => p.title === selected);
    return found ?? presets[0] ?? { id: "preset-empty", title: "(empty)", body: "" };
  }, [presets, selected]);

  const [text, setText] = useState(value || "");
  const [mode, setMode] = useState<Mode>("normal");
  const [newTitle, setNewTitle] = useState("");
  const [enlarge, setEnlarge] = useState(false);
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

  // Always sync with parent value when it changes
  useEffect(() => {
    if (value !== undefined && value !== text) {
      setText(value);
    }
  }, [value]);

  // Update parent whenever text changes
  useEffect(() => {
    onPromptChange(text);
  }, [text, onPromptChange]);

  const changed = text !== (current?.body ?? "");

  // Handle explicit preset selection (not tab switching)
  const handlePresetChange = (newPresetTitle: string) => {
    setSelected(newPresetTitle);
    // When user explicitly selects a preset, load its content
    const newPreset = presets.find(p => p.title === newPresetTitle) ?? current;
    const body = newPreset?.body ?? "";
    setText(body);
    onPromptChange(body);
  };

  const commit = () => {
    if (!current) return;
    presetStore.updatePreset(current.id, { body: text });
    setPresets(presetStore.getPresets());
  };

  const saveAsNew = () => {
    if (!newTitle.trim()) return;
    const t = newTitle.trim();
    const id = "preset-" + t.toLowerCase().replace(/\s+/g, "-");
    presetStore.savePreset({ id, title: t, body: text });
    setPresets(presetStore.getPresets());
    handlePresetChange(t);
    setMode("normal");
    setNewTitle("");
  };

  const deletePreset = () => {
    if (!current) return;
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
      type: "prompt",
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
        <h3 style={{ margin: 0 }}>Preset</h3>

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
        {mode === "normal" && (
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
        )}
        {mode !== "normal" && (
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
            disabled={!changed}
            onClick={commit}
            style={{
              opacity: changed ? 1 : 0.6,
              border: "1px solid #334155",
              padding: "6px 10px",
              borderRadius: 8,
              background: "#1e293b",
              color: "#e2e8f0",
            }}
          >
            Commit
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

      {/* Textarea + Enlarge */}
      <div style={{ marginTop: 8 }}>
      <h3 style={{ margin: 0 }}>Prompt</h3>
        <ExpandableTextarea
          editable
          initialValue={text}
          onChange={(v) => {
            setText(v);
            onPromptChange(v);
          }}
        />
        <button onClick={() => setEnlarge(true)} style={{ marginTop: 6, padding: "4px 8px", fontSize: 12 }}>
          Enlarge
        </button>
      </div>

      {/* Enlarge modal */}
      {enlarge && (
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
              width: "min(1000px, 90vw)",
              height: "min(80vh, 700px)",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>Edit Prompt</h3>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onPromptChange(e.target.value);
              }}
              style={{
                flex: 1,
                border: "1px solid #334155",
                borderRadius: 8,
                padding: 10,
                fontFamily: "monospace",
                fontSize: 13,
                background: "#1e293b",
                color: "#e2e8f0",
              }}
            />
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              Tip: include the OCR text using <code style={{ background: "#334155", padding: "2px 4px", borderRadius: 4 }}>{`{extracted text}`}</code>.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button 
                onClick={() => setEnlarge(false)} 
                style={{ 
                  padding: "6px 10px", 
                  border: "1px solid #334155", 
                  borderRadius: 6, 
                  background: "#1e293b", 
                  color: "#e2e8f0",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
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
            <div style={{ textAlign: "center", padding: 40, border: "2px dashed #334155", borderRadius: 8 }}>
              <div style={{ color: "#94a3b8", marginBottom: 8 }}>Drag and drop preset files here</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Supported formats: .txt, .json</div>
              <input
                type="file"
                accept=".txt,.json"
                style={{ marginTop: 16 }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      const title = file.name.replace(/\.[^/.]+$/, "");
                      const id = "preset-" + title.toLowerCase().replace(/\s+/g, "-");
                      presetStore.savePreset({ id, title, body: content });
                      setPresets(presetStore.getPresets());
                      handlePresetChange(title);
                      setImportModal(false);
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setImportModal(false)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  background: "#1e293b",
                  color: "#e2e8f0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- tiny menu primitives --- */
function MenuItem({
  children,
  onClick,
  danger = false,
}: React.PropsWithChildren<{ onClick?: () => void; danger?: boolean }>) {
  return (
    <div
      role="menuitem"
      onClick={onClick}
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        color: danger ? "#fecaca" : "#e2e8f0",
      }}
      onMouseEnter={(e) => ((e.currentTarget.style.backgroundColor = "#111827"))}
      onMouseLeave={(e) => ((e.currentTarget.style.backgroundColor = "transparent"))}
    >
      {children}
    </div>
  );
}
function MenuDivider() {
  return <div style={{ height: 1, background: "#334155", margin: "6px 4px" }} />;
}
