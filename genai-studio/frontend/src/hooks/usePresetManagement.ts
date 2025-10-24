// frontend/src/hooks/usePresetManagement.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useNotifications } from '@/components/Notification/Notification';
import { ocrPresetStore, promptEvalPresetStore, chatPresetStore, Preset } from '@/stores/presetStore';
import { PresetData } from '@/types/settings';

export interface UsePresetManagementReturn {
  localPresets: {
    ocr: Preset[];
    prompt: Preset[];
    chat: Preset[];
  };
  showPresetEditor: boolean;
  editingPreset: PresetData | null;
  presetDetails: Record<string, PresetData>;
  setShowPresetEditor: (show: boolean) => void;
  setEditingPreset: (preset: PresetData | null) => void;
  handlePresetEdit: (type: string, name: string) => void;
  handlePresetEditLocal: (type: "ocr" | "prompt" | "chat", preset: Preset) => void;
  handlePresetSave: (preset: PresetData) => Promise<void>;
  handlePresetSaveLocal: (preset: PresetData) => Promise<void>;
  handlePresetDelete: (type: keyof { ocr: string[]; prompt: string[]; chat: string[] }, name: string) => Promise<void>;
  handlePresetDeleteLocal: (type: "ocr" | "prompt" | "chat", presetId: string) => void;
  handlePresetClone: (preset: PresetData) => void;
  handlePresetExport: (preset: PresetData) => void;
  handlePresetImport: () => void;
  refreshLocalPresets: () => void;
}

export function usePresetManagement(): UsePresetManagementReturn {
  const { showSuccess, showError } = useNotifications();
  
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetData | null>(null);
  const [presetDetails, setPresetDetails] = useState<Record<string, PresetData>>({});
  
  const [localPresets, setLocalPresets] = useState<{
    ocr: Preset[];
    prompt: Preset[];
    chat: Preset[];
  }>({ ocr: [], prompt: [], chat: [] });

  const refreshLocalPresets = useCallback(() => {
    setLocalPresets({
      ocr: ocrPresetStore.getPresets(),
      prompt: promptEvalPresetStore.getPresets(),
      chat: chatPresetStore.getPresets(),
    });
  }, []);

  // Convert Preset to PresetData format
  const convertPresetToPresetData = useCallback((preset: Preset, type: "ocr" | "prompt" | "chat"): PresetData => {
    return {
      id: preset.id,
      title: preset.title,
      type,
      body: preset.body,
      context: preset.parameters?.system,
      parameters: preset.parameters ? {
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
      } : undefined,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    };
  }, []);

  // Convert PresetData to Preset format
  const convertPresetDataToPreset = useCallback((presetData: PresetData): Omit<Preset, 'createdAt' | 'updatedAt'> => {
    return {
      id: presetData.id || crypto.randomUUID(),
      title: presetData.title,
      body: presetData.body,
      parameters: presetData.parameters ? {
        temperature: presetData.parameters.temperature,
        max_tokens: presetData.parameters.max_tokens,
        top_p: presetData.parameters.top_p,
        top_k: presetData.parameters.top_k,
        system: presetData.context,
      } : undefined,
      metrics: presetData.metrics,
    };
  }, []);

  const loadPresetDetails = useCallback(async (type: string, name: string) => {
    try {
      const res = await api.get(`/presets/${type}/${name}`);
      setPresetDetails((prev) => ({ ...prev, [`${type}:${name}`]: res.data as PresetData }));
    } catch (err) {
      console.error("Failed to load preset:", name, err);
    }
  }, []);

  const handlePresetEdit = useCallback((type: string, name: string) => {
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
  }, [presetDetails, loadPresetDetails]);

  const handlePresetEditLocal = useCallback((type: "ocr" | "prompt" | "chat", preset: Preset) => {
    const presetData = convertPresetToPresetData(preset, type);
    setEditingPreset(presetData);
    setShowPresetEditor(true);
  }, [convertPresetToPresetData]);

  const handlePresetSave = useCallback(async (preset: PresetData) => {
    try {
      if (preset.id) {
        await api.put(`/presets/${preset.type}/${preset.title}`, preset);
      } else {
        await api.post(`/presets/${preset.type}`, preset);
      }
      setPresetDetails((prev) => ({ ...prev, [`${preset.type}:${preset.title}`]: preset }));
      setShowPresetEditor(false);
      setEditingPreset(null);
      showSuccess("Preset Saved", `Preset "${preset.title}" has been saved successfully.`);
    } catch (err: any) {
      showError("Preset Save Failed", err?.message || "Failed to save preset.");
    }
  }, [showSuccess, showError]);

  const handlePresetSaveLocal = useCallback(async (preset: PresetData) => {
    try {
      const store = preset.type === "ocr" ? ocrPresetStore : 
                   preset.type === "prompt" ? promptEvalPresetStore : 
                   chatPresetStore;
      
      const presetToSave = convertPresetDataToPreset(preset);
      
      if (preset.id) {
        store.updatePreset(preset.id, presetToSave);
      } else {
        store.savePreset(presetToSave);
      }
      
      refreshLocalPresets();
      setShowPresetEditor(false);
      setEditingPreset(null);
      showSuccess("Preset Saved", `Preset "${preset.title}" has been saved.`);
    } catch (err: any) {
      showError("Save Failed", err?.message || "Failed to save preset.");
    }
  }, [convertPresetDataToPreset, refreshLocalPresets, showSuccess, showError]);

  const handlePresetDelete = useCallback(async (type: keyof { ocr: string[]; prompt: string[]; chat: string[] }, name: string) => {
    try {
      await api.delete(`/presets/${type}/${name}`);
      setPresetDetails((prev) => {
        const copy = { ...prev };
        delete copy[`${type}:${name}`];
        return copy;
      });
      setShowPresetEditor(false);
      setEditingPreset(null);
      showSuccess("Preset Deleted", `"${name}" was removed.`);
    } catch (err: any) {
      showError("Delete Failed", err?.message || "Failed to delete preset.");
    }
  }, [showSuccess, showError]);

  const handlePresetDeleteLocal = useCallback((type: "ocr" | "prompt" | "chat", presetId: string) => {
    const preset = localPresets[type].find(p => p.id === presetId);
    if (preset && confirm(`Delete preset "${preset.title}"?`)) {
      try {
        const store = type === "ocr" ? ocrPresetStore : 
                     type === "prompt" ? promptEvalPresetStore : 
                     chatPresetStore;
        
        store.deletePreset(presetId);
        refreshLocalPresets();
        showSuccess("Preset Deleted", `Preset "${preset.title}" has been deleted.`);
      } catch (err: any) {
        showError("Delete Failed", err?.message || "Failed to delete preset.");
      }
    }
  }, [localPresets, refreshLocalPresets, showSuccess, showError]);

  const handlePresetClone = useCallback((preset: PresetData) => {
    setEditingPreset({ ...preset, id: undefined, title: `${preset.title} (Copy)` });
  }, []);

  const handlePresetExport = useCallback((preset: PresetData) => {
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preset-${preset.title}-${preset.type}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("Preset Exported", `"${preset.title}" exported.`);
  }, [showSuccess]);

  const handlePresetImport = useCallback(() => {
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
  }, [showError]);

  // Load local presets on mount
  useEffect(() => {
    refreshLocalPresets();
  }, [refreshLocalPresets]);

  return {
    localPresets,
    showPresetEditor,
    editingPreset,
    presetDetails,
    setShowPresetEditor,
    setEditingPreset,
    handlePresetEdit,
    handlePresetEditLocal,
    handlePresetSave,
    handlePresetSaveLocal,
    handlePresetDelete,
    handlePresetDeleteLocal,
    handlePresetClone,
    handlePresetExport,
    handlePresetImport,
    refreshLocalPresets,
  };
}



