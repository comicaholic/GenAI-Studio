import React, { useState, useEffect } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { api } from "@/services/api";
import { useNotifications } from "@/components/Notification/Notification";
import PresetEditor from "@/components/PresetEditor/PresetEditor";

// Default settings to guarantee required nested objects exist
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



interface Settings {
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
}

interface PresetData {
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
}

export default function SettingsPage() {
  const { showSuccess, showError, showInfo } = useNotifications();
  const [settings, setSettings] = useState<Settings>(defaultSettings);


  const [activeTab, setActiveTab] = useState("ui");
  const [isLoading, setIsLoading] = useState(true);
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetData | null>(null);
  const [presetDetails, setPresetDetails] = useState<Record<string, PresetData>>({});

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/settings");
      // Merge backend response into defaults so no field is undefined
      setSettings({ ...defaultSettings, ...response.data });
    } catch (error: any) {
      console.error("Failed to load settings:", error);
      setSettings(defaultSettings); // fallback so UI never breaks
    } finally {
      setIsLoading(false);
    }
  };


  const saveSettings = async () => {
    try {
      await api.post("/settings", settings);
      showSuccess("Settings Saved", "Your settings have been saved successfully!");
    } catch (error: any) {
      showError("Save Failed", "Failed to save settings: " + (error.message || error));
    }
  };

  const testGroqConnection = async () => {
    if (!settings.groq.apiKey.trim()) {
      showError("Missing API Key", "Please enter a Groq API key first.");
      return;
    }
    
    try {
      const response = await api.post("/groq/test", { apiKey: settings.groq.apiKey });
      setSettings(prev => ({
        ...prev,
        groq: { ...prev.groq, connected: response.data.connected }
      }));
      if (response.data.connected) {
        showSuccess("Groq Connected", `Groq API connected successfully! Found ${response.data.models_count || 0} models.`);
      } else {
        showError("Connection Failed", response.data.error || "Failed to connect to Groq API.");
      }
    } catch (error: any) {
      showError("Connection Test Failed", "Failed to test Groq connection: " + (error.message || error));
    }
  };

  const testHuggingFaceConnection = async () => {
    if (!settings.huggingface.token.trim()) {
      showError("Missing Token", "Please enter a Hugging Face token first.");
      return;
    }
    
    try {
      const response = await api.post("/huggingface/test", { token: settings.huggingface.token });
      setSettings(prev => ({
        ...prev,
        huggingface: { ...prev.huggingface, connected: response.data.connected }
      }));
      if (response.data.connected) {
        showSuccess("Hugging Face Connected", `Connected as ${response.data.username || 'user'}!`);
      } else {
        showError("Connection Failed", response.data.error || "Failed to connect to Hugging Face.");
      }
    } catch (error: any) {
      showError("Connection Test Failed", "Failed to test Hugging Face connection: " + (error.message || error));
    }
  };

  const loadPresetDetails = async (type: string, presetName: string) => {
    try {
      const response = await api.get(`/presets/${type}/${presetName}`);
      setPresetDetails(prev => ({
        ...prev,
        [`${type}:${presetName}`]: response.data
      }));
    } catch (error) {
      console.error(`Failed to load preset ${presetName}:`, error);
    }
  };

  const handlePresetEdit = (type: string, presetName: string) => {
    const key = `${type}:${presetName}`;
    const preset = presetDetails[key];
    if (preset) {
      setEditingPreset(preset);
      setShowPresetEditor(true);
    } else {
      // Load preset details first
      loadPresetDetails(type, presetName).then(() => {
        const loadedPreset = presetDetails[`${type}:${presetName}`];
        if (loadedPreset) {
          setEditingPreset(loadedPreset);
          setShowPresetEditor(true);
        }
      });
    }
  };

  const handlePresetSave = async (preset: PresetData) => {
    try {
      if (preset.id) {
        // Update existing preset
        await api.put(`/presets/${preset.type}/${preset.name}`, preset);
      } else {
        // Create new preset
        await api.post(`/presets/${preset.type}`, preset);
        setSettings(prev => ({
          ...prev,
          presets: {
            ...prev.presets,
            [preset.type]: [...prev.presets[preset.type], preset.name]
          }
        }));
      }
      
      // Update preset details
      setPresetDetails(prev => ({
        ...prev,
        [`${preset.type}:${preset.name}`]: preset
      }));
      
      setShowPresetEditor(false);
      setEditingPreset(null);
    } catch (error: any) {
      throw new Error(error.message || "Failed to save preset");
    }
  };

  const handlePresetDelete = async (presetId: string) => {
    if (!editingPreset) return;
    
    try {
      await api.delete(`/presets/${editingPreset.type}/${editingPreset.name}`);
      setSettings(prev => ({
        ...prev,
        presets: {
          ...prev.presets,
          [editingPreset.type]: prev.presets[editingPreset.type].filter(p => p !== editingPreset.name)
        }
      }));
      
      // Remove from preset details
      const key = `${editingPreset.type}:${editingPreset.name}`;
      setPresetDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[key];
        return newDetails;
      });
      
      setShowPresetEditor(false);
      setEditingPreset(null);
    } catch (error: any) {
      throw new Error(error.message || "Failed to delete preset");
    }
  };

  const handlePresetClone = (preset: PresetData) => {
    const clonedPreset = {
      ...preset,
      name: `${preset.name} (Copy)`,
      id: undefined
    };
    setEditingPreset(clonedPreset);
  };

  const handlePresetExport = (preset: PresetData) => {
    const blob = new Blob([JSON.stringify(preset, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset-${preset.name}-${preset.type}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("Preset Exported", `Preset "${preset.name}" has been exported successfully.`);
  };

  const handlePresetImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const preset = JSON.parse(text) as PresetData;
          setEditingPreset(preset);
          setShowPresetEditor(true);
        } catch (error) {
          showError("Import Failed", "Failed to parse preset file. Please ensure it's a valid JSON file.");
        }
      }
    };
    input.click();
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings: any = { ...prev };
      const keys = path.split('.');
      let current = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (current[k] == null || typeof current[k] !== "object") {
          current[k] = {}; // ensure intermediate object exists
        }
        current = current[k];
      }
      current[keys[keys.length - 1]] = value;
      return newSettings as Settings;
    });
  };


  const deletePreset = async (type: keyof Settings['presets'], presetName: string) => {
    try {
      await api.delete(`/presets/${type}/${presetName}`);
      setSettings(prev => ({
        ...prev,
        presets: {
          ...prev.presets,
          [type]: prev.presets[type].filter(p => p !== presetName),
        },
      }));
      showSuccess("Preset Deleted", `Preset "${presetName}" has been deleted successfully.`);
    } catch (error: any) {
      showError("Delete Failed", "Failed to delete preset: " + (error.message || error));
    }
  };

  const tabs = [
    { id: "ui", label: "UI & Appearance", icon: "🎨" },
    { id: "paths", label: "File Paths", icon: "📁" },
    { id: "presets", label: "Presets", icon: "⚙️" },
    { id: "groq", label: "Groq API", icon: "🔐" },
    { id: "huggingface", label: "Hugging Face", icon: "🤗" },
  ];
  
  // Detect if File System Access is available
  const canPickDirectory = typeof (window as any).showDirectoryPicker === "function";

  // Cache handles in-memory for later reads (you can move this to context if needed)
  const dirHandlesRef = React.useRef<Record<string, any>>({});

  if (isLoading) {
    return (
      <div style={{ display: "flex", height: "100vh" }}>
        <LeftRail />
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", marginLeft: 56, background: "#0f172a", minHeight: "100vh", flex: 1 }}>
          Loading settings...
        </div>
      </div>
    );
  }

  

  // Open a folder and store a friendly name + handle
  async function browseForFolder(settingKey: keyof Settings["paths"]) {
    try {
      if (canPickDirectory) {
        // Modern Chromium way
        const handle = await (window as any).showDirectoryPicker({ mode: "read" });
        dirHandlesRef.current[settingKey] = handle;
        // Use a friendly label for display
        updateSetting(`paths.${settingKey}`, handle.name || "Selected Folder");
      } else {
        // Fallback: webkitdirectory input
        const input = document.createElement("input");
        (input as any).webkitdirectory = true;
        input.type = "file";
        input.onchange = (ev: any) => {
          const files: FileList = ev.target.files;
          if (files && files.length) {
            // Derive a label from the first file's relative path root
            // (Not a true path; browsers won't give you absolute paths)
            const first = files[0] as any;
            const relPath = first.webkitRelativePath || first.name;
            const topFolder = relPath.split("/")[0] || "Selected Folder";
            dirHandlesRef.current[settingKey] = files; // store the list for later use
            updateSetting(`paths.${settingKey}`, topFolder);
          }
        };
        input.click();
      }
    } catch (err) {
      console.error("Folder pick canceled or failed:", err);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <LeftRail />
      <div style={{ padding: 24, background: "#0f172a", minHeight: "100vh", marginLeft: 56, color: "#e2e8f0", flex: 1, overflow: "auto" }}>
        <h1 style={{ margin: "0 0 24px 0", color: "#e2e8f0" }}>Settings</h1>

        <div style={{ display: "flex", gap: 24 }}>
          {/* Tabs */}
          <div style={{ width: 200 }}>
            <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    ...styles.tab,
                    ...(activeTab === tab.id ? styles.tabActive : {}),
                  }}
                >
                  <span style={{ marginRight: 8 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <div style={styles.content}>
              {/* UI & Appearance Tab */}
              {activeTab === "ui" && (
                <div>
                  <h2 style={styles.sectionTitle}>UI & Appearance</h2>
                  
                  <div style={styles.settingGroup}>
                    <label style={styles.label}>Theme</label>
                    <select
                      value={settings.ui.theme}
                      onChange={(e) => updateSetting('ui.theme', e.target.value)}
                      style={styles.select}
                    >
                      <option value="dark">Dark Mode</option>
                      <option value="light">Light Mode</option>
                    </select>
                  </div>

                  <div style={styles.settingGroup}>
                    <label style={styles.label}>Default Landing Page</label>
                    <select
                      value={settings.ui.defaultLandingPage}
                      onChange={(e) => updateSetting('ui.defaultLandingPage', e.target.value)}
                      style={styles.select}
                    >
                      <option value="/">Home</option>
                      <option value="/ocr">OCR Evaluation</option>
                      <option value="/prompt">Prompt Evaluation</option>
                      <option value="/chat">Chat</option>
                      <option value="/models">Models</option>
                      <option value="/analytics">Analytics</option>
                    </select>
                  </div>

                  <div style={styles.settingGroup}>
                    <label style={styles.label}>Background State Management</label>
                    <div style={styles.checkboxGroup}>
                      <input
                        type="checkbox"
                        id="backgroundState"
                        checked={settings.ui.backgroundStateManagement}
                        onChange={(e) => updateSetting('ui.backgroundStateManagement', e.target.checked)}
                        style={styles.checkbox}
                      />
                      <label htmlFor="backgroundState" style={styles.checkboxLabel}>
                        Keep pages running in background when navigating
                      </label>
                    </div>
                    <div style={styles.helpText}>
                      When enabled, OCR evaluations, prompt evaluations, and chat sessions will continue running in the background when you navigate to other pages. Operations like AI responses and evaluations won't be interrupted.
                    </div>
                  </div>
                </div>
              )}

              {/* File Paths Tab */}
              {activeTab === "paths" && (
                <div>
                  <h2 style={styles.sectionTitle}>File Paths</h2>
                  
                  <div style={styles.settingGroup}>
                    <h3 style={styles.subsectionTitle}>OCR Evaluation Page</h3>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Source Input Folder</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          value={settings.paths.ocrSource}
                          onChange={(e) => updateSetting('paths.ocrSource', e.target.value)}
                          style={{ ...styles.input, flex: 1 }}
                          placeholder={canPickDirectory ? "Choose a folder…" : "Choose a folder (Chromium recommended)"}
                        />
                        <button
                          onClick={() => browseForFolder("ocrSource")}
                          style={styles.browseBtn}
                          title={canPickDirectory ? "Pick Folder" : "Pick Folder (Chromium browsers)"}
                        >
                          Browse…
                        </button>
                      </div>
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Reference Input Folder</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          value={settings.paths.ocrReference}
                          onChange={(e) => updateSetting('paths.ocrReference', e.target.value)}
                          style={{ ...styles.input, flex: 1 }}
                          placeholder={canPickDirectory ? "Choose a folder…" : "Choose a folder (Chromium recommended)"}
                        />
                        <button
                          onClick={() => browseForFolder("ocrReference")}
                          style={styles.browseBtn}
                          title={canPickDirectory ? "Pick Folder" : "Pick Folder (Chromium browsers)"}
                        >
                          Browse…
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={styles.settingGroup}>
                    <h3 style={styles.subsectionTitle}>Prompt Evaluation Page</h3>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Source Input Folder</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          value={settings.paths.promptSource}
                          onChange={(e) => updateSetting('paths.promptSource', e.target.value)}
                          style={{ ...styles.input, flex: 1 }}
                          placeholder={canPickDirectory ? "Choose a folder…" : "Choose a folder (Chromium recommended)"}
                        />
                        <button
                          onClick={() => browseForFolder("promptSource")}
                          style={styles.browseBtn}
                          title={canPickDirectory ? "Pick Folder" : "Pick Folder (Chromium browsers)"}
                        >
                          Browse…
                        </button>
                      </div>
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Reference Input Folder</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          value={settings.paths.promptReference}
                          onChange={(e) => updateSetting('paths.promptReference', e.target.value)}
                          style={{ ...styles.input, flex: 1 }}
                          placeholder={canPickDirectory ? "Choose a folder…" : "Choose a folder (Chromium recommended)"}
                        />
                        <button
                          onClick={() => browseForFolder("promptReference")}
                          style={styles.browseBtn}
                          title={canPickDirectory ? "Pick Folder" : "Pick Folder (Chromium browsers)"}
                        >
                          Browse…
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={styles.settingGroup}>
                    <h3 style={styles.subsectionTitle}>Chat Downloads</h3>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Chats Folder</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          value={settings.paths.chatDownloadPath}
                          onChange={(e) => updateSetting('paths.chatDownloadPath', e.target.value)}
                          style={{ ...styles.input, flex: 1 }}
                          placeholder={canPickDirectory ? "Choose a folder…" : "Choose a folder (Chromium recommended)"}
                        />
                        <button
                          onClick={() => browseForFolder("chatDownloadPath")}
                          style={styles.browseBtn}
                          title={canPickDirectory ? "Pick Folder" : "Pick Folder (Chromium browsers)"}
                        >
                          Browse…
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Presets Tab */}
              {activeTab === "presets" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h2 style={styles.sectionTitle}>Preset Management</h2>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handlePresetImport}
                        style={styles.importBtn}
                      >
                        📥 Import
                      </button>
                      <button
                        onClick={() => {
                          setEditingPreset(null);
                          setShowPresetEditor(true);
                        }}
                        style={styles.createBtn}
                      >
                        ＋ Create New Preset
                      </button>
                    </div>
                  </div>
                  
                  {Object.entries(settings.presets).map(([type, presets]) => (
                    <div key={type} style={styles.settingGroup}>
                      <h3 style={styles.subsectionTitle}>{type.charAt(0).toUpperCase() + type.slice(1)} Presets</h3>
                      {presets.length === 0 ? (
                        <div style={styles.emptyState}>No presets found</div>
                      ) : (
                        <div style={styles.presetList}>
                          {presets.map((preset) => (
                            <div key={preset} style={styles.presetItem}>
                              <span style={styles.presetName}>{preset}</span>
                              <div style={styles.presetActions}>
                                <button
                                  onClick={() => handlePresetEdit(type, preset)}
                                  style={styles.actionBtn}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => showInfo("Preset Location", `Preset "${preset}" is located in the presets folder.`)}
                                  style={styles.actionBtn}
                                >
                                  📁 Reveal
                                </button>
                                <button
                                  onClick={() => deletePreset(type as keyof Settings['presets'], preset)}
                                  style={{...styles.actionBtn, ...styles.dangerBtn}}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Groq Tab */}
              {activeTab === "groq" && (
              <div style={{ display: "grid", gap: 24 }}>
                <div style={{ padding: 24, background: "#1e293b", border: "1px solid #334155", borderRadius: 16 }}>
                  <h2 style={{ margin: "0 0 16px 0", color: "#e2e8f0" }}>Groq API Settings</h2>
                  
                  <label style={{ display: "block", marginBottom: 8, color: "#e2e8f0" }}>API Key</label>
                  <input
                    type="password"
                    value={settings.groq?.apiKey ?? ""}
                    onChange={(e) => updateSetting("groq.apiKey", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: 6,
                      border: "1px solid #334155",
                      background: "#0f172a",
                      color: "#e2e8f0",
                    }}
                  />

                  <button
                    onClick={() => {
                      // quick connection test
                      api.get("/models/list?include_groq=true").then(() => {
                        alert("Groq API connected successfully!");
                      }).catch(() => {
                        alert("Failed to connect to Groq API. Check your key.");
                      });
                    }}
                    style={{
                      marginTop: 12,
                      padding: "8px 16px",
                      background: "#10b981",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "#fff"
                    }}
                  >
                    Test Connection
                  </button>
                </div>
              </div>
            )}

              {/* Hugging Face Tab */}
              {activeTab === "huggingface" && (
                <div>
                  <h2 style={styles.sectionTitle}>Hugging Face Configuration</h2>
                  
                  <div style={styles.settingGroup}>
                    <label style={styles.label}>Access Token</label>
                    <div style={styles.inputGroup}>
                      <input
                        type="password"
                        value={settings.huggingface.token}
                        onChange={(e) => updateSetting('huggingface.token', e.target.value)}
                        placeholder="Enter your Hugging Face access token"
                        style={styles.input}
                      />
                      <button
                        onClick={testHuggingFaceConnection}
                        style={styles.testBtn}
                      >
                        Test Connection
                      </button>
                    </div>
                    <div style={styles.statusIndicator}>
                      Status: <span style={{
                        color: settings.huggingface.connected ? "#10b981" : "#ef4444",
                        fontWeight: "bold"
                      }}>
                        {settings.huggingface.connected ? "Connected" : "Not Connected"}
                      </span>
                    </div>
                  </div>

                  <div style={styles.infoBox}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#e2e8f0" }}>About Hugging Face</h4>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.5 }}>
                      Hugging Face provides access to thousands of pre-trained models and datasets. 
                      When connected, you can use Hugging Face models for inference and fine-tuning.
                      You can get your access token from the <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>Hugging Face Settings</a>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={saveSettings}
                style={styles.saveBtn}
              >
                Save Settings
              </button>
            </div>
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
            onDelete={editingPreset?.id ? handlePresetDelete : undefined}
            onClone={handlePresetClone}
            onExport={handlePresetExport}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tab: {
    padding: "12px 16px",
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    borderRadius: 8,
    textAlign: "left",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  tabActive: {
    background: "#1e293b",
    color: "#e2e8f0",
    fontWeight: 500,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
  },
  content: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 24,
  },
  sectionTitle: {
    margin: "0 0 20px 0",
    color: "#e2e8f0",
    fontSize: 20,
    fontWeight: 600,
  },
  subsectionTitle: {
    margin: "0 0 12px 0",
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: 500,
  },
  settingGroup: {
    marginBottom: 24,
  },
  label: {
    display: "block",
    marginBottom: 8,
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 500,
  },
  inputLabel: {
    display: "block",
    marginBottom: 6,
    color: "#94a3b8",
    fontSize: 12,
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #334155",
    borderRadius: 8,
    background: "#0f172a",
    color: "#e2e8f0",
    fontSize: 14,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #334155",
    borderRadius: 8,
    background: "#0f172a",
    color: "#e2e8f0",
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  emptyState: {
    color: "#94a3b8",
    fontSize: 14,
    fontStyle: "italic",
  },
  presetList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  presetItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
  },
  presetName: {
    color: "#e2e8f0",
    fontSize: 14,
  },
  presetActions: {
    display: "flex",
    gap: 8,
  },
  actionBtn: {
    padding: "4px 8px",
    border: "1px solid #334155",
    borderRadius: 6,
    background: "#1e293b",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 12,
  },
  dangerBtn: {
    borderColor: "#ef4444",
    color: "#ef4444",
  },
  testBtn: {
    padding: "8px 16px",
    border: "1px solid #1d4ed8",
    borderRadius: 8,
    background: "#1d4ed8",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    marginLeft: 8,
  },
  statusIndicator: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
  },
  infoBox: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  saveBtn: {
    padding: "12px 24px",
    background: "#10b981",
    border: "none",
    borderRadius: 8,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 500,
  },
  createBtn: {
    padding: "8px 16px",
    background: "#1d4ed8",
    border: "none",
    borderRadius: 8,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  importBtn: {
    padding: "8px 16px",
    background: "#059669",
    border: "none",
    borderRadius: 8,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  helpText: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  checkboxGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  checkbox: {
    margin: 0,
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#e2e8f0",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 24,
    minWidth: 600,
    maxWidth: 800,
    maxHeight: "80vh",
    overflow: "auto",
  },
  cancelBtn: {
    padding: "8px 16px",
    border: "1px solid #334155",
    borderRadius: 8,
    background: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 14,
  },
};