// src/pages/Settings/SettingsPage.tsx
import React, { useEffect, useRef, useState } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { api } from "@/services/api";
import { useNotifications } from "@/components/Notification/Notification";
import PresetEditor from "@/components/PresetEditor/PresetEditor";
import { usePageState } from "@/stores/pageState";
import { ocrPresetStore, promptEvalPresetStore, chatPresetStore, Preset } from "@/stores/presetStore";

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
  localModels: {
    selectedGpu: string;
    availableGpus: string[];
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
  localModels: { selectedGpu: "auto", availableGpus: ["auto", "cpu", "cuda:0", "cuda:1", "mps"] },
};

/** ------------------------------
 *  Component
 *  ------------------------------ */
export default function SettingsPage() {
  const { showSuccess, showError, showInfo } = useNotifications();
  const { setBackgroundStateEnabled, backgroundStateEnabled } = usePageState();

  // state
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<"ui" | "paths" | "presets" | "groq" | "huggingface" | "localModels">("ui");
  const [isLoading, setIsLoading] = useState(true);

  // preset editor state
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetData | null>(null);
  const [presetDetails, setPresetDetails] = useState<Record<string, PresetData>>({});
  
  // Load presets from localStorage stores
  const [localPresets, setLocalPresets] = useState<{
    ocr: Preset[];
    prompt: Preset[];
    chat: Preset[];
  }>({ ocr: [], prompt: [], chat: [] });

  // GPU info state
  const [gpuInfo, setGpuInfo] = useState<{available_gpus: string[], gpu_details: any[]}>({available_gpus: [], gpu_details: []});

  // folder picker cache (optionally move to context later)
  const dirHandlesRef = useRef<Record<string, any>>({});

  // platform capability
  const canPickDirectory = typeof (window as any).showDirectoryPicker === "function";

  /** load settings from backend */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/settings/settings");
        // merge so we never render undefined sub-objects
        const loadedSettings = { ...defaultSettings, ...(res.data || {}) };
        setSettings(loadedSettings);
        
        // Sync background state management setting with page state store
        setBackgroundStateEnabled(loadedSettings.ui.backgroundStateManagement);
        
        // Apply theme immediately on load
        applyTheme(loadedSettings.ui.theme);
        
        // Load GPU information
        try {
          const gpuRes = await api.get("/settings/gpu/info");
          setGpuInfo(gpuRes.data);
        } catch (err) {
          console.warn("Failed to load GPU info:", err);
        }
        
        // Load presets from localStorage stores
        setLocalPresets({
          ocr: ocrPresetStore.getPresets(),
          prompt: promptEvalPresetStore.getPresets(),
          chat: chatPresetStore.getPresets(),
        });
      } catch (err: any) {
        console.error("Failed to load settings:", err);
        setSettings(defaultSettings);
        setBackgroundStateEnabled(defaultSettings.ui.backgroundStateManagement);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setBackgroundStateEnabled]);

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
      
      // Sync background state management setting with page state store
      if (path === "ui.backgroundStateManagement") {
        setBackgroundStateEnabled(value);
      }
      
      // Apply theme immediately when changed
      if (path === "ui.theme") {
        applyTheme(value);
      }
      
      // Validate GPU selection
      if (path === "localModels.selectedGpu") {
        validateGpuSelection(value);
      }
      
      return next as Settings;
    });
  };

  const saveSettings = async () => {
    try {
      await api.post("/settings/settings", settings); // backend persists & writes .env as needed
      showSuccess("Settings Saved", "Your settings have been saved successfully.");
      
      // Apply theme immediately
      applyTheme(settings.ui.theme);
      
      // Trigger a refresh of models in other components
      window.dispatchEvent(new Event("models:changed"));
      
      // Trigger settings change event for other components
      window.dispatchEvent(new CustomEvent("settings:changed", { detail: settings }));
    } catch (err: any) {
      showError("Save Failed", err?.message || "Failed to save settings.");
    }
  };

  const applyTheme = (theme: "light" | "dark") => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const validateGpuSelection = async (gpuId: string) => {
    try {
      const res = await api.post("/settings/gpu/validate", { gpu_id: gpuId });
      if (!res.data.valid) {
        showError("Invalid GPU Selection", `GPU "${gpuId}" is not available on this system.`);
      }
    } catch (err) {
      console.warn("Failed to validate GPU selection:", err);
    }
  };

  const testGroqConnection = async () => {
    if (!settings.groq.apiKey.trim()) {
      showError("Missing API Key", "Enter a Groq API key first.");
      return;
    }
    try {
      // send key explicitly in body; backend expects { apiKey }
      const res = await api.post("/settings/groq/test", { apiKey: settings.groq.apiKey });
      setSettings((prev) => ({ ...prev, groq: { ...prev.groq, connected: !!res.data?.connected } }));
      res.data?.connected
        ? showSuccess("Groq Connected", `OK${res.data?.models_count ? ` — ${res.data.models_count} models` : ""}.`)
        : showError("Groq Failed", res.data?.error || "Connection failed.");
      
      // Trigger a refresh of models if connection is successful
      if (res.data?.connected) {
        window.dispatchEvent(new Event("models:changed"));
      }
    } catch (e: any) {
      showError("Groq Failed", e?.message || "Connection failed.");
    }
  };

  const testHuggingFaceConnection = async () => {
    if (!settings.huggingface.token.trim()) {
      showError("Missing Token", "Enter a Hugging Face token first.");
      return;
    }
    
    // Validate token format
    if (!settings.huggingface.token.startsWith("hf_")) {
      showError("Invalid Token Format", "Hugging Face tokens must start with 'hf_'. Please check your token.");
      return;
    }
    
    try {
      console.log("Testing HF connection with token:", settings.huggingface.token.substring(0, 10) + "...");
      console.log("Token length:", settings.huggingface.token.length);
      
      const res = await api.post("/settings/huggingface/test", { token: settings.huggingface.token });
      console.log("HF test response:", res.data);
      
      setSettings((p) => ({ ...p, huggingface: { ...p.huggingface, connected: !!res.data?.connected } }));
      
      if (res.data?.connected) {
        showSuccess("Hugging Face Connected", `Connected as ${res.data?.username || "user"}.`);
      } else {
        const errorMsg = res.data?.error || "Connection failed. Please check your token and try again.";
        console.error("HF connection failed:", errorMsg);
        showError("HF Connection Failed", `${errorMsg}\n\nTroubleshooting tips:\n• Make sure your account email is verified\n• Check that the token has 'Read' permissions\n• Ensure the token is not expired\n• Try creating a new token`);
      }
    } catch (e: any) {
      console.error("HF test error:", e);
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

  const handlePresetEditLocal = (type: "ocr" | "prompt" | "chat", preset: Preset) => {
    setEditingPreset({ 
      type, 
      name: preset.title, 
      content: {
        prompt: preset.body,
        params: preset.parameters ? {
          temperature: preset.parameters.temperature ?? 0.7,
          max_tokens: preset.parameters.max_tokens ?? 1024,
          top_p: preset.parameters.top_p ?? 1.0,
          top_k: preset.parameters.top_k ?? 40,
        } : undefined,
        metrics: preset.metrics ? {
          rouge: preset.metrics.rouge ?? false,
          bleu: preset.metrics.bleu ?? false,
          f1: preset.metrics.f1 ?? false,
          em: preset.metrics.em ?? false,
          em_avg: false,
          bertscore: preset.metrics.bertscore ?? false,
          perplexity: preset.metrics.perplexity ?? false,
          accuracy: preset.metrics.accuracy ?? false,
          accuracy_avg: false,
          precision: preset.metrics.precision ?? false,
          precision_avg: false,
          recall: preset.metrics.recall ?? false,
          recall_avg: false,
        } : undefined
      }
    });
    setShowPresetEditor(true);
  };

  const handlePresetDeleteLocal = (type: "ocr" | "prompt" | "chat", presetId: string) => {
    const preset = localPresets[type].find(p => p.id === presetId);
    if (preset && confirm(`Delete preset "${preset.title}"?`)) {
      try {
        // Get the appropriate store
        const store = type === "ocr" ? ocrPresetStore : 
                     type === "prompt" ? promptEvalPresetStore : 
                     chatPresetStore;
        
        store.deletePreset(presetId);
        
        // Refresh local presets
        setLocalPresets({
          ocr: ocrPresetStore.getPresets(),
          prompt: promptEvalPresetStore.getPresets(),
          chat: chatPresetStore.getPresets(),
        });
        
        showSuccess("Preset Deleted", `Preset "${preset.title}" has been deleted.`);
      } catch (err: any) {
        showError("Delete Failed", err?.message || "Failed to delete preset.");
      }
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

  const handlePresetSaveLocal = async (preset: PresetData) => {
    try {
      // Get the appropriate store
      const store = preset.type === "ocr" ? ocrPresetStore : 
                   preset.type === "prompt" ? promptEvalPresetStore : 
                   chatPresetStore;
      
      if (preset.id) {
        // Update existing preset
        store.updatePreset(preset.id, {
          title: preset.name,
          body: preset.content.prompt || "",
          parameters: preset.content.params,
          metrics: preset.content.metrics,
        });
      } else {
        // Create new preset
        store.savePreset({
          id: crypto.randomUUID(),
          title: preset.name,
          body: preset.content.prompt || "",
          parameters: preset.content.params,
          metrics: preset.content.metrics,
        });
      }
      
      // Refresh local presets
      setLocalPresets({
        ocr: ocrPresetStore.getPresets(),
        prompt: promptEvalPresetStore.getPresets(),
        chat: chatPresetStore.getPresets(),
      });
      
      setShowPresetEditor(false);
      setEditingPreset(null);
      showSuccess("Preset Saved", `Preset "${preset.name}" has been saved.`);
    } catch (err: any) {
      showError("Save Failed", err?.message || "Failed to save preset.");
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
    <div style={{ display: "flex", height: "100vh", background: "#0b1220" }}>
      <LeftRail />
      <div style={{ 
        marginLeft: 80, 
        flex: 1, 
        background: "#0b1220", 
        color: "#e2e8f0",
        display: "flex",
        minHeight: 0
      }}>
        {/* Modern sidebar navigation */}
        <aside style={{
          width: 280,
          background: "#0f172a",
          borderRight: "1px solid #334155",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
              </svg>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>Settings</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Configure your application</p>
            </div>
          </div>

          {/* Navigation tabs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { 
                id: "ui", 
                label: "UI & Appearance", 
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                  </svg>
                )
              },
              { 
                id: "paths", 
                label: "File Paths", 
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                  </svg>
                )
              },
              { 
                id: "presets", 
                label: "Presets", 
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
                  </svg>
                )
              },
              { 
                id: "groq", 
                label: "Groq API", 
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                  </svg>
                )
              },
              { 
                id: "huggingface", 
                label: "Hugging Face", 
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                  </svg>
                )
              },
              { 
                id: "localModels", 
                label: "Local Models", 
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                  </svg>
                )
              },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #334155",
                  background: activeTab === (t.id as any) 
                    ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                    : "transparent",
                  color: activeTab === (t.id as any) ? "#ffffff" : "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "all 0.2s ease",
                  textAlign: "left"
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== (t.id as any)) {
                    e.currentTarget.style.background = "#1e293b";
                    e.currentTarget.style.borderColor = "#475569";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== (t.id as any)) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "#334155";
                  }
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Save button */}
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <button
              onClick={saveSettings}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #10b981, #059669)",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(16, 185, 129, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(16, 185, 129, 0.3)";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3M19,19H5V5H16.17L19,7.83V19M12,12A3,3 0 0,0 9,15A3,3 0 0,0 12,18A3,3 0 0,0 15,15A3,3 0 0,0 12,12M6,6H15V10H6V6Z"/>
              </svg>
              Save Changes
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <main style={{
          flex: 1,
          padding: 24,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 24
        }}>
            {/* UI */}
            {activeTab === "ui" && (
              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", 
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>UI & Appearance</h2>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Customize the look and feel of your application</p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>Theme</label>
                    <select
                      value={settings.ui.theme}
                      onChange={(e) => updateSetting("ui.theme", e.target.value)}
                      style={{
                        padding: "12px 16px",
                        border: "1px solid #334155",
                        borderRadius: 10,
                        background: "#1e293b",
                        color: "#e2e8f0",
                        fontSize: 14,
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#334155";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>Background Style</label>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {[
                        { 
                          k: "gradient", 
                          label: "Gradient", 
                          icon: (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                            </svg>
                          )
                        },
                        { 
                          k: "grid", 
                          label: "Grid", 
                          icon: (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3,3V11H11V3H3M9,9H5V5H9V9M13,3V11H21V3H13M19,9H15V5H19V9M3,13V21H11V13H3M9,19H5V15H9V19M13,13V21H21V13H13M19,19H15V15H19V19Z"/>
                            </svg>
                          )
                        },
                        { 
                          k: "noise", 
                          label: "Noise", 
                          icon: (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                            </svg>
                          )
                        },
                      ].map((opt) => (
                        <button
                          key={opt.k}
                          onClick={() => setBgTheme(opt.k)}
                          style={{ 
                            padding: "12px 16px", 
                            borderRadius: 10, 
                            border: "1px solid #334155", 
                            background: bgTheme === opt.k 
                              ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                              : "#1e293b", 
                            color: bgTheme === opt.k ? "#ffffff" : "#e2e8f0",
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => {
                            if (bgTheme !== opt.k) {
                              e.currentTarget.style.background = "#334155";
                              e.currentTarget.style.borderColor = "#475569";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (bgTheme !== opt.k) {
                              e.currentTarget.style.background = "#1e293b";
                              e.currentTarget.style.borderColor = "#334155";
                            }
                          }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>Default Landing Page</label>
                    <select
                      value={settings.ui.defaultLandingPage}
                      onChange={(e) => updateSetting("ui.defaultLandingPage", e.target.value)}
                      style={{
                        padding: "12px 16px",
                        border: "1px solid #334155",
                        borderRadius: 10,
                        background: "#1e293b",
                        color: "#e2e8f0",
                        fontSize: 14,
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#334155";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <option value="/">Home</option>
                      <option value="/ocr">OCR Evaluation</option>
                      <option value="/prompt">Prompt Evaluation</option>
                      <option value="/chat">Chat</option>
                      <option value="/models">Models</option>
                      <option value="/analytics">Analytics</option>
                    </select>
                  </div>

                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 12,
                    padding: "16px",
                    background: "#1e293b",
                    borderRadius: 10,
                    border: "1px solid #334155"
                  }}>
                    <input
                      type="checkbox"
                      checked={settings.ui.backgroundStateManagement}
                      onChange={(e) => updateSetting("ui.backgroundStateManagement", e.target.checked)}
                      style={{ 
                        width: 18, 
                        height: 18, 
                        accentColor: "#3b82f6",
                        cursor: "pointer"
                      }}
                    />
                    <div>
                      <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>Background State Management</div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>Keep pages running when navigating between sections</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Paths */}
            {activeTab === "paths" && (
              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    background: "linear-gradient(135deg, #10b981, #059669)", 
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>File Paths</h2>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Configure where your files are stored and accessed</p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 24 }}>
                  {/* OCR Evaluation */}
                  <div style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>OCR Evaluation</h3>
                    </div>
                    <div style={{ display: "grid", gap: 16 }}>
                      <div>
                        <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, marginBottom: 8, display: "block" }}>Source Input Folder</label>
                        <RowPath
                          value={settings.paths.ocrSource}
                          onChange={(v) => updateSetting("paths.ocrSource", v)}
                          onBrowse={() => browseForFolder("ocrSource")}
                        />
                      </div>
                      <div>
                        <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, marginBottom: 8, display: "block" }}>Reference Input Folder</label>
                        <RowPath
                          value={settings.paths.ocrReference}
                          onChange={(v) => updateSetting("paths.ocrReference", v)}
                          onBrowse={() => browseForFolder("ocrReference")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prompt Evaluation */}
                  <div style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", 
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>Prompt Evaluation</h3>
                    </div>
                    <div style={{ display: "grid", gap: 16 }}>
                      <div>
                        <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, marginBottom: 8, display: "block" }}>Source Input Folder</label>
                        <RowPath
                          value={settings.paths.promptSource}
                          onChange={(v) => updateSetting("paths.promptSource", v)}
                          onBrowse={() => browseForFolder("promptSource")}
                        />
                      </div>
                      <div>
                        <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, marginBottom: 8, display: "block" }}>Reference Input Folder</label>
                        <RowPath
                          value={settings.paths.promptReference}
                          onChange={(v) => updateSetting("paths.promptReference", v)}
                          onBrowse={() => browseForFolder("promptReference")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chat Downloads */}
                  <div style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        background: "linear-gradient(135deg, #f59e0b, #d97706)", 
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>Chat Downloads</h3>
                    </div>
                    <div>
                      <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, marginBottom: 8, display: "block" }}>Chats Folder</label>
                      <RowPath
                        value={settings.paths.chatDownloadPath}
                        onChange={(v) => updateSetting("paths.chatDownloadPath", v)}
                        onBrowse={() => browseForFolder("chatDownloadPath")}
                      />
                    </div>
                  </div>
                </div>
              </div>
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
                    {localPresets[type].length === 0 ? (
                      <div style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 14 }}>No presets yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {localPresets[type].map((preset) => (
                          <div key={preset.id} style={presetRow}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>{preset.title}</span>
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                                {preset.body.length > 100 ? `${preset.body.substring(0, 100)}...` : preset.body}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button style={btnRow} onClick={() => handlePresetEditLocal(type, preset)}>Edit</button>
                              <button
                                style={{ ...btnRow, borderColor: "#ef4444", color: "#ef4444" }}
                                onClick={() => handlePresetDeleteLocal(type, preset.id)}
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

            {/* Local Models */}
            {activeTab === "localModels" && (
              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    background: "linear-gradient(135deg, #f59e0b, #d97706)", 
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>Local Models</h2>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Configure GPU settings for local model inference</p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>GPU Selection</label>
                    <select
                      value={settings.localModels.selectedGpu}
                      onChange={(e) => updateSetting("localModels.selectedGpu", e.target.value)}
                      style={{
                        padding: "12px 16px",
                        border: "1px solid #334155",
                        borderRadius: 10,
                        background: "#1e293b",
                        color: "#e2e8f0",
                        fontSize: 14,
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#334155";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {gpuInfo.available_gpus.length > 0 ? gpuInfo.available_gpus.map((gpu) => {
                        const gpuDetail = gpuInfo.gpu_details.find(d => d.id === gpu);
                        const displayName = gpuDetail ? `${gpuDetail.name} (${gpuDetail.memory})` : gpu;
                        return (
                          <option key={gpu} value={gpu}>
                            {gpu === "auto" ? "Auto-detect (Recommended)" : displayName}
                          </option>
                        );
                      }) : settings.localModels.availableGpus.map((gpu) => (
                        <option key={gpu} value={gpu}>
                          {gpu === "auto" ? "Auto-detect (Recommended)" : 
                           gpu === "cpu" ? "CPU Only" :
                           gpu === "mps" ? "Apple Silicon (MPS)" :
                           gpu.startsWith("cuda:") ? `NVIDIA GPU ${gpu.split(":")[1]}` : gpu}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                      Select the GPU device for local model inference. "Auto-detect" will automatically choose the best available GPU.
                    </div>
                  </div>

                  <div style={{ 
                    padding: "16px",
                    background: "#1e293b",
                    borderRadius: 10,
                    border: "1px solid #334155"
                  }}>
                    <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Detected GPUs</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                      {gpuInfo.gpu_details.length > 0 ? (
                        gpuInfo.gpu_details.map((gpu, index) => (
                          <div key={gpu.id} style={{ marginBottom: 4 }}>
                            • <strong>{gpu.name}:</strong> {gpu.memory} {gpu.id === "auto" ? "(Auto-detection)" : ""}
                          </div>
                        ))
                      ) : (
                        <>
                          <div>• <strong>Auto-detect:</strong> Automatically selects the best available GPU</div>
                          <div>• <strong>CPU:</strong> Forces CPU-only inference (slower but more compatible)</div>
                          <div>• <strong>CUDA:</strong> NVIDIA GPU acceleration (requires CUDA-compatible GPU)</div>
                          <div>• <strong>MPS:</strong> Apple Silicon GPU acceleration (Mac only)</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hugging Face */}
            {activeTab === "huggingface" && (
              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    background: "linear-gradient(135deg, #ff6b35, #f7931e)", 
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#e2e8f0" }}>Hugging Face Integration</h2>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Connect to Hugging Face Hub for model discovery and downloads</p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 20 }}>
                  {/* Token Configuration */}
                  <div style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V13H14.8V15H12.8V13H11V11H12.8V10C12.8,9.2 12.4,8.5 11.8,8.2C12.2,7.9 12.6,7.5 12,7M12,6.1C11.2,6.1 10.5,6.7 10.5,7.5C10.5,8.3 11.1,8.9 11.9,8.9C12.7,8.9 13.3,8.3 13.3,7.5C13.3,6.7 12.7,6.1 12,6.1Z"/>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>Access Token</h3>
                    </div>
                    
                    <div style={{ display: "grid", gap: 16 }}>
                      <div>
                        <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, marginBottom: 8, display: "block" }}>Hugging Face Token</label>
                        <input
                          type="password"
                          value={settings.huggingface.token}
                          onChange={(e) => updateSetting("huggingface.token", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            border: "1px solid #334155",
                            borderRadius: 10,
                            background: "#0f172a",
                            color: "#e2e8f0",
                            fontSize: 14,
                            outline: "none",
                            transition: "all 0.2s ease"
                          }}
                          placeholder="hf_xxx…"
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = "#3b82f6";
                            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = "#334155";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        />
                      </div>
                      
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <button 
                          onClick={testHuggingFaceConnection}
                          style={{
                            padding: "12px 16px",
                            borderRadius: 10,
                            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                            border: "none",
                            color: "#ffffff",
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 500,
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 4px 8px rgba(59, 130, 246, 0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
                          </svg>
                          Test Connection
                        </button>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: settings.huggingface.connected ? "#10b981" : "#ef4444"
                          }}></div>
                          <span style={{ fontSize: 13, color: "#94a3b8" }}>
                            Status:{" "}
                            <span style={{ 
                              color: settings.huggingface.connected ? "#10b981" : "#ef4444",
                              fontWeight: 500
                            }}>
                              {settings.huggingface.connected ? "Connected" : "Not connected"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Setup Instructions */}
                  <div style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        background: "linear-gradient(135deg, #10b981, #059669)", 
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>How to Get Your Token</h3>
                    </div>
                    
                    <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: "1.6" }}>
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ color: "#e2e8f0" }}>Step 1:</strong> Visit{" "}
                        <a 
                          href="https://huggingface.co/settings/tokens" 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ 
                            color: "#60a5fa", 
                            textDecoration: "underline",
                            fontWeight: 500
                          }}
                        >
                          huggingface.co/settings/tokens
                        </a>
                      </div>
                      
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ color: "#e2e8f0" }}>Step 2:</strong> Sign in to your Hugging Face account (create one if needed)
                      </div>
                      
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ color: "#e2e8f0" }}>Step 3:</strong> Click "New token" and select "Read" permissions
                      </div>
                      
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ color: "#e2e8f0" }}>Step 4:</strong> Copy the generated token (starts with "hf_")
                      </div>
                      
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ color: "#e2e8f0" }}>Step 5:</strong> Paste the token above and click "Test Connection"
                      </div>
                    </div>
                    
                    <div style={{
                      marginTop: "16px",
                      padding: "12px",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#94a3b8"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                        </svg>
                        <strong style={{ color: "#e2e8f0" }}>Minimum Requirements:</strong>
                      </div>
                      <div style={{ paddingLeft: "18px" }}>
                        • Token must have "Read" access to browse public models<br/>
                        • Token must be valid and not expired<br/>
                        • Account must be verified (email confirmation)
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", 
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>What You Can Do</h3>
                    </div>
                    
                    <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: "1.6" }}>
                      <div style={{ marginBottom: "8px" }}>
                        • <strong style={{ color: "#e2e8f0" }}>Discover Models:</strong> Browse and search thousands of models from Hugging Face Hub
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        • <strong style={{ color: "#e2e8f0" }}>Add Models:</strong> Easily add models to your local collection with one click
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        • <strong style={{ color: "#e2e8f0" }}>Access Gated Models:</strong> Download models that require authentication
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        • <strong style={{ color: "#e2e8f0" }}>Stay Updated:</strong> Get the latest model information and metadata
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </main>
      </div>

      {/* Preset Editor Modal */}
      {showPresetEditor && (
        <PresetEditor
          preset={editingPreset}
          onSave={editingPreset?.id ? handlePresetSaveLocal : handlePresetSave}
          onCancel={() => {
            setShowPresetEditor(false);
            setEditingPreset(null);
          }}
          onDelete={editingPreset?.id ? () => {
            if (editingPreset.type === "ocr" || editingPreset.type === "prompt" || editingPreset.type === "chat") {
              const preset = localPresets[editingPreset.type].find(p => p.title === editingPreset.name);
              if (preset) {
                handlePresetDeleteLocal(editingPreset.type, preset.id);
              }
            } else {
              handlePresetDelete(editingPreset.type, editingPreset.name);
            }
          } : undefined}
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
    <div style={{ display: "flex", gap: 12 }}>
      <input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        style={{ 
          flex: 1,
          padding: "12px 16px",
          border: "1px solid #334155",
          borderRadius: 10,
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 14,
          outline: "none",
          transition: "all 0.2s ease"
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#3b82f6";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#334155";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button 
        onClick={onBrowse}
        style={{
          padding: "12px 16px",
          border: "1px solid #334155",
          background: "#1e293b",
          color: "#e2e8f0",
          borderRadius: 10,
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 500,
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#334155";
          e.currentTarget.style.borderColor = "#475569";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#1e293b";
          e.currentTarget.style.borderColor = "#334155";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
        </svg>
        Browse
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
