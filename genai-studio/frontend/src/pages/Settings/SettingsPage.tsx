// src/pages/Settings/SettingsPage.tsx
import React, { useEffect, useRef, useState } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { api } from "@/services/api";
import { useNotifications } from "@/components/Notification/Notification";
import PresetEditor from "@/components/PresetEditor/PresetEditor";

/** ------------------------------
 *  Types & defaults (robust to partial backend payloads)
 *  ------------------------------ */
type Settings = {
  ui: {
    theme: "light" | "dark";
    defaultLandingPage: string;
    backgroundStateManagement: boolean;
  };
  paths: {
    ocrSource: string;
    ocrReference: string;
    promptSource: string;
    promptReference: string;
    chatDownloadPath: string;
  };
  presets: {
    ocr: string[];
    prompt: string[];
    chat: string[];
  };
  groq: {
    apiKey: string;
    connected: boolean;
  };
  huggingface: {
    token: string;
    connected: boolean;
  };
};

type PresetData = {
  id?: string;
  name: string;
  type: "ocr" | "prompt" | "chat";
  content: {
    prompt?: string;
    context?: string;
    params?: {
      temperature: number;
      max_tokens: number;
      top_p: number;
      top_k: number;
    };
    metrics?: {
      rouge: boolean;
      bleu: boolean;
      f1: boolean;
      em: boolean;
      em_avg: boolean;
      bertscore: boolean;
      perplexity: boolean;
      accuracy: boolean;
      accuracy_avg: boolean;
      precision: boolean;
      precision_avg: boolean;
      recall: boolean;
      recall_avg: boolean;
    };
  };
};

const defaultSettings: Settings = {
  ui: { theme: "dark", defaultLandingPage: "/", backgroundStateManagement: true },
  paths: {
    ocrSource: "./data/source",
    ocrReference: "./data/reference",
    promptSource: "./data/source",
    promptReference: "./data/reference",
    chatDownloadPath: "./data/downloads",
  },
  presets: { ocr: [], prompt: [], chat: [] },
  groq: { apiKey: "", connected: false },
  huggingface: { token: "", connected: false },
};

/** ------------------------------
 *  Component
 *  ------------------------------ */
export default function SettingsPage() {
  const { showSuccess, showError, showInfo } = useNotifications();

  // state
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<"ui" | "paths" | "presets" | "groq" | "huggingface">("ui");
  const [isLoading, setIsLoading] = useState(true);

  // preset editor state
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetData | null>(null);
  const [presetDetails, setPresetDetails] = useState<Record<string, PresetData>>({});

  // folder picker cache (optionally move to context later)
  const dirHandlesRef = useRef<Record<string, any>>({});

  // platform capability
  const canPickDirectory = typeof (window as any).showDirectoryPicker === "function";

  /** load settings from backend */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/settings");
        // merge so we never render undefined sub-objects
        setSettings({ ...defaultSettings, ...(res.data || {}) });
      } catch (err: any) {
        console.error("Failed to load settings:", err);
        setSettings(defaultSettings);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  /** helpers */
  const updateSetting = (path: string, value: any) => {
    setSettings((prev) => {
      const next: any = { ...prev };
      const keys = path.split(".");
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
        cur = cur[k];
      }
      cur[keys[keys.length - 1]] = value;
      return next as Settings;
    });
  };

  const saveSettings = async () => {
    try {
      await api.post("/settings", settings); // backend persists & writes .env as needed
      showSuccess("Settings Saved", "Your settings have been saved successfully.");
    } catch (err: any) {
      showError("Save Failed", err?.message || "Failed to save settings.");
    }
  };

  const testGroqConnection = async () => {
    if (!settings.groq.apiKey.trim()) {
      showError("Missing API Key", "Enter a Groq API key first.");
      return;
    }
    try {
      const res = await api.post("/groq/test", { apiKey: settings.groq.apiKey });
      setSettings((prev) => ({ ...prev, groq: { ...prev.groq, connected: !!res.data?.connected } }));
      res.data?.connected
        ? showSuccess("Groq Connected", `OK${res.data?.models_count ? ` — ${res.data.models_count} models` : ""}.`)
        : showError("Groq Failed", res.data?.error || "Connection failed.");
    } catch (e: any) {
      showError("Groq Failed", e?.message || "Connection failed.");
    }
  };

  const testHuggingFaceConnection = async () => {
    if (!settings.huggingface.token.trim()) {
      showError("Missing Token", "Enter a Hugging Face token first.");
      return;
    }
    try {
      const res = await api.post("/huggingface/test", { token: settings.huggingface.token });
      setSettings((p) => ({ ...p, huggingface: { ...p.huggingface, connected: !!res.data?.connected } }));
      res.data?.connected
        ? showSuccess("Hugging Face Connected", `Connected as ${res.data?.username || "user"}.`)
        : showError("HF Failed", res.data?.error || "Connection failed.");
    } catch (e: any) {
      showError("HF Failed", e?.message || "Connection failed.");
    }
  };

  /** folder picking (Chromium native or fallback) */
  async function browseForFolder(settingKey: keyof Settings["paths"]) {
    try {
      if (canPickDirectory) {
        const handle = await (window as any).showDirectoryPicker({ mode: "read" });
        dirHandlesRef.current[settingKey] = handle;
        updateSetting(`paths.${settingKey}`, handle.name || "Selected Folder");
      } else {
        const input = document.createElement("input");
        (input as any).webkitdirectory = true;
        input.type = "file";
        input.onchange = (ev: any) => {
          const files: FileList = ev.target.files;
          if (files && files.length) {
            const first: any = files[0];
            const relPath = first.webkitRelativePath || first.name;
            const topFolder = relPath.split("/")[0] || "Selected Folder";
            dirHandlesRef.current[settingKey] = files;
            updateSetting(`paths.${settingKey}`, topFolder);
          }
        };
        input.click();
      }
    } catch (err) {
      console.warn("Folder pick canceled/failed:", err);
    }
  }

  /** presets — load / edit / save / delete / clone / import / export */
  const loadPresetDetails = async (type: string, name: string) => {
    try {
      const res = await api.get(`/presets/${type}/${name}`);
      setPresetDetails((prev) => ({ ...prev, [`${type}:${name}`]: res.data as PresetData }));
    } catch (err) {
      console.error("Failed to load preset:", name, err);
    }
  };

  const handlePresetEdit = (type: string, name: string) => {
    const key = `${type}:${name}`;
    const cached = presetDetails[key];
    if (cached) {
      setEditingPreset(cached);
      setShowPresetEditor(true);
    } else {
      loadPresetDetails(type, name).then(() => {
        const loaded = presetDetails[`${type}:${name}`];
        if (loaded) {
          setEditingPreset(loaded);
          setShowPresetEditor(true);
        }
      });
    }
  };

  const handlePresetSave = async (preset: PresetData) => {
    try {
      if (preset.id) {
        await api.put(`/presets/${preset.type}/${preset.name}`, preset);
      } else {
        await api.post(`/presets/${preset.type}`, preset);
        setSettings((prev) => ({
          ...prev,
          presets: { ...prev.presets, [preset.type]: [...prev.presets[preset.type], preset.name] },
        }));
      }
      setPresetDetails((prev) => ({ ...prev, [`${preset.type}:${preset.name}`]: preset }));
      setShowPresetEditor(false);
      setEditingPreset(null);
    } catch (e: any) {
      showError("Preset Save Failed", e?.message || "Failed to save preset.");
    }
  };

  const handlePresetDelete = async (type: keyof Settings["presets"], name: string) => {
    try {
      await api.delete(`/presets/${type}/${name}`);
      setSettings((prev) => ({
        ...prev,
        presets: { ...prev.presets, [type]: prev.presets[type].filter((p) => p !== name) },
      }));
      setPresetDetails((prev) => {
        const copy = { ...prev };
        delete copy[`${type}:${name}`];
        return copy;
      });
      setShowPresetEditor(false);
      setEditingPreset(null);
      showSuccess("Preset Deleted", `"${name}" was removed.`);
    } catch (e: any) {
      showError("Delete Failed", e?.message || "Failed to delete preset.");
    }
  };

  const handlePresetClone = (preset: PresetData) => {
    setEditingPreset({ ...preset, id: undefined, name: `${preset.name} (Copy)` });
  };

  const handlePresetExport = (preset: PresetData) => {
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preset-${preset.name}-${preset.type}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("Preset Exported", `"${preset.name}" exported.`);
  };

  const handlePresetImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const preset = JSON.parse(text) as PresetData;
        setEditingPreset(preset);
        setShowPresetEditor(true);
      } catch {
        showError("Import Failed", "Invalid JSON file.");
      }
    };
    input.click();
  };

  // Background theme setting (grid / noise / gradient)
  const [bgTheme, setBgTheme] = useState<string>(() => localStorage.getItem("app:bgTheme") || "gradient");
  useEffect(() => {
    localStorage.setItem("app:bgTheme", bgTheme);
    const root = document.querySelector("body");
    if (!root) return;
    root.classList.remove("bg-grid","bg-noise","bg-gradient");
    root.classList.add(bgTheme === "grid" ? "bg-grid" : bgTheme === "noise" ? "bg-noise" : "bg-gradient");
  }, [bgTheme]);

  /** layout */
  if (isLoading) {
    return (
      <div style={{ display: "flex", height: "100vh" }}>
        <LeftRail />
        <div style={{ marginLeft: 56, flex: 1, background: "#0f172a", color: "#94a3b8", display: "grid", placeItems: "center" }}>
          Loading settings…
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "56px 1fr", height: "100vh" }}>
      {/* top spacer to match other pages’ fixed header height */}
      <header style={{ height: 56, borderBottom: "1px solid #1f2a3a", background: "#0a0f1a" }} />

      <div style={{ display: "flex", minHeight: 0 }}>
        {/* non-scrolling left nav */}
        <LeftRail />

        {/* sticky tabs + scrollable content */}
        <div
          style={{
            marginLeft: 56,
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            width: "100%",
            minWidth: 0,
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          {/* tabs (sticky) */}
          <aside
            style={{
              position: "sticky",
              top: 56,
              alignSelf: "start",
              height: "calc(100vh - 56px)",
              borderRight: "1px solid #1f2a3a",
              background: "#0b1220",
              padding: 12,
              display: "grid",
              gap: 8,
            }}
          >
            {[
              { id: "ui", label: "UI & Appearance" },
              { id: "paths", label: "File Paths" },
              { id: "presets", label: "Presets" },
              { id: "groq", label: "Groq API" },
              { id: "huggingface", label: "Hugging Face" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #2b3443",
                  background: activeTab === (t.id as any) ? "#132035" : "#0f172a",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {t.label}
              </button>
            ))}

            <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
              <button
                onClick={saveSettings}
                style={{
                  height: 36,
                  borderRadius: 8,
                  background: "#2563eb",
                  border: "1px solid #1f2a3a",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Save changes
              </button>
            </div>
          </aside>

          {/* content (only this scrolls) */}
          <main
            style={{
              height: "calc(100vh - 56px)",
              overflow: "auto",
              padding: 16,
              display: "grid",
              gap: 16,
            }}
          >
            {/* UI */}
            {activeTab === "ui" && (
              <section style={card}>
                <h2 style={h2}>UI & Appearance</h2>

                <div style={group}>
                  <label style={label}>Theme</label>
                  <select
                    value={settings.ui.theme}
                    onChange={(e) => updateSetting("ui.theme", e.target.value)}
                    style={select}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>

                <div style={group}>
                  <label style={label}>Background</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { k: "gradient", label: "Gradient" },
                      { k: "grid", label: "Grid" },
                      { k: "noise", label: "Noise" },
                    ].map((opt) => (
                      <button
                        key={opt.k}
                        onClick={() => setBgTheme(opt.k)}
                        className={`rb-glare rb-press ${bgTheme === opt.k ? "rb-pulse-bg" : ""}`}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: bgTheme === opt.k ? "#1e293b" : "#0f172a", color: "#e2e8f0" }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={group}>
                  <label style={label}>Default Landing Page</label>
                  <select
                    value={settings.ui.defaultLandingPage}
                    onChange={(e) => updateSetting("ui.defaultLandingPage", e.target.value)}
                    style={select}
                  >
                    <option value="/">Home</option>
                    <option value="/ocr">OCR Evaluation</option>
                    <option value="/prompt">Prompt Evaluation</option>
                    <option value="/chat">Chat</option>
                    <option value="/models">Models</option>
                    <option value="/analytics">Analytics</option>
                  </select>
                </div>

                <div style={group}>
                  <label style={label}>Background State Management</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={settings.ui.backgroundStateManagement}
                      onChange={(e) => updateSetting("ui.backgroundStateManagement", e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: 13, color: "#cbd5e1" }}>
                      Keep pages running when navigating.
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Paths */}
            {activeTab === "paths" && (
              <section style={card}>
                <h2 style={h2}>File Paths</h2>

                <h3 style={h3}>OCR Evaluation</h3>
                <div style={group}>
                  <label style={sublabel}>Source Input Folder</label>
                  <RowPath
                    value={settings.paths.ocrSource}
                    onChange={(v) => updateSetting("paths.ocrSource", v)}
                    onBrowse={() => browseForFolder("ocrSource")}
                  />
                </div>
                <div style={group}>
                  <label style={sublabel}>Reference Input Folder</label>
                  <RowPath
                    value={settings.paths.ocrReference}
                    onChange={(v) => updateSetting("paths.ocrReference", v)}
                    onBrowse={() => browseForFolder("ocrReference")}
                  />
                </div>

                <h3 style={h3}>Prompt Evaluation</h3>
                <div style={group}>
                  <label style={sublabel}>Source Input Folder</label>
                  <RowPath
                    value={settings.paths.promptSource}
                    onChange={(v) => updateSetting("paths.promptSource", v)}
                    onBrowse={() => browseForFolder("promptSource")}
                  />
                </div>
                <div style={group}>
                  <label style={sublabel}>Reference Input Folder</label>
                  <RowPath
                    value={settings.paths.promptReference}
                    onChange={(v) => updateSetting("paths.promptReference", v)}
                    onBrowse={() => browseForFolder("promptReference")}
                  />
                </div>

                <h3 style={h3}>Chat Downloads</h3>
                <div style={group}>
                  <label style={sublabel}>Chats Folder</label>
                  <RowPath
                    value={settings.paths.chatDownloadPath}
                    onChange={(v) => updateSetting("paths.chatDownloadPath", v)}
                    onBrowse={() => browseForFolder("chatDownloadPath")}
                  />
                </div>
              </section>
            )}

            {/* Presets */}
            {activeTab === "presets" && (
              <section style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={h2}>Preset Management</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btnGreen} onClick={handlePresetImport}>Import</button>
                    <button
                      style={btnBlue}
                      onClick={() => {
                        setEditingPreset(null);
                        setShowPresetEditor(true);
                      }}
                    >
                      Create Preset
                    </button>
                  </div>
                </div>

                {(["ocr", "prompt", "chat"] as const).map((type) => (
                  <div key={type} style={{ marginTop: 12 }}>
                    <h3 style={h3}>{type.toUpperCase()} Presets</h3>
                    {settings.presets[type].length === 0 ? (
                      <div style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 14 }}>No presets yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {settings.presets[type].map((name) => (
                          <div key={name} style={presetRow}>
                            <span style={{ color: "#e2e8f0", fontSize: 14 }}>{name}</span>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button style={btnRow} onClick={() => handlePresetEdit(type, name)}>Edit</button>
                              <button style={btnRow} onClick={() => showInfo("Preset Location", "See presets folder.")}>
                                Reveal
                              </button>
                              <button
                                style={{ ...btnRow, borderColor: "#ef4444", color: "#ef4444" }}
                                onClick={() => handlePresetDelete(type, name)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* Groq */}
            {activeTab === "groq" && (
              <section style={card}>
                <h2 style={h2}>Groq API</h2>
                <div style={group}>
                  <label style={label}>API Key</label>
                  <input
                    type="password"
                    value={settings.groq.apiKey}
                    onChange={(e) => updateSetting("groq.apiKey", e.target.value)}
                    style={input}
                    placeholder="groq_xxx…"
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btnBlue} onClick={testGroqConnection}>Test Connection</button>
                    <span style={{ alignSelf: "center", fontSize: 13, color: "#94a3b8" }}>
                      Status:{" "}
                      <b style={{ color: settings.groq.connected ? "#10b981" : "#ef4444" }}>
                        {settings.groq.connected ? "Connected" : "Not connected"}
                      </b>
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Hugging Face */}
            {activeTab === "huggingface" && (
              <section style={card}>
                <h2 style={h2}>Hugging Face</h2>
                <div style={group}>
                  <label style={label}>Access Token</label>
                  <input
                    type="password"
                    value={settings.huggingface.token}
                    onChange={(e) => updateSetting("huggingface.token", e.target.value)}
                    style={input}
                    placeholder="hf_xxx…"
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btnBlue} onClick={testHuggingFaceConnection}>Test Connection</button>
                    <span style={{ alignSelf: "center", fontSize: 13, color: "#94a3b8" }}>
                      Status:{" "}
                      <b style={{ color: settings.huggingface.connected ? "#10b981" : "#ef4444" }}>
                        {settings.huggingface.connected ? "Connected" : "Not connected"}
                      </b>
                    </span>
                  </div>
                </div>
                <div style={noteBox}>
                  Get your token at{" "}
                  <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>
                    huggingface.co/settings/tokens
                  </a>.
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Preset Editor Modal */}
      {showPresetEditor && (
        <PresetEditor
          preset={editingPreset}
          onSave={handlePresetSave}
          onCancel={() => {
            setShowPresetEditor(false);
            setEditingPreset(null);
          }}
          onDelete={editingPreset?.id ? () => handlePresetDelete(editingPreset.type, editingPreset.name) : undefined}
          onClone={handlePresetClone}
          onExport={handlePresetExport}
        />
      )}
    </div>
  );
}

/** ------------------------------
 *  Small subcomponents & styles
 *  ------------------------------ */
function RowPath({
  value,
  onChange,
  onBrowse,
}: {
  value: string;
  onChange: (v: string) => void;
  onBrowse: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...input, flex: 1 }} />
      <button style={btnRow} onClick={onBrowse}>
        Browse…
      </button>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 12,
  padding: 16,
};

const h2: React.CSSProperties = { margin: "0 0 12px 0", color: "#e2e8f0", fontSize: 18, fontWeight: 600 };
const h3: React.CSSProperties = { margin: "12px 0 8px 0", color: "#e2e8f0", fontSize: 15, fontWeight: 500 };

const group: React.CSSProperties = { display: "grid", gap: 8, marginTop: 8 };
const label: React.CSSProperties = { color: "#e2e8f0", fontSize: 14, fontWeight: 500 };
const sublabel: React.CSSProperties = { color: "#cbd5e1", fontSize: 12 };

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #334155",
  borderRadius: 8,
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: 14,
  outline: "none",
};

const select: React.CSSProperties = { ...input };

const btnBlue: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #1d4ed8",
  background: "#1d4ed8",
  color: "#fff",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};
const btnGreen: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #059669",
  background: "#059669",
  color: "#fff",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};
const btnRow: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
};

const presetRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
};

const noteBox: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  borderRadius: 8,
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#94a3b8",
  fontSize: 13,
};
