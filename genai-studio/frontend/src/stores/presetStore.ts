// frontend/src/stores/presetStore.ts
export interface Preset {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface PresetStore {
  getPresets: () => Preset[];
  getPreset: (id: string) => Preset | undefined;
  savePreset: (preset: Omit<Preset, 'createdAt' | 'updatedAt'>) => void;
  updatePreset: (id: string, updates: Partial<Pick<Preset, 'title' | 'body'>>) => void;
  deletePreset: (id: string) => void;
  clearPresets: () => void;
}

class LocalStoragePresetStore implements PresetStore {
  private storageKey: string;

  constructor(pageName: string) {
    this.storageKey = `presets-${pageName}`;
  }

  private getDefaultPresets(): Preset[] {
    return [
      {
        id: 'default',
        title: 'Default',
        body: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'ocr-cleanup',
        title: 'OCR Cleanup',
        body: 'Clean up OCR artifacts in {extracted text} and correct punctuation.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  }

  getPresets(): Preset[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        const defaults = this.getDefaultPresets();
        this.savePresets(defaults);
        return defaults;
      }
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load presets from localStorage', e);
      return this.getDefaultPresets();
    }
  }

  private savePresets(presets: Preset[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save presets to localStorage', e);
    }
  }

  getPreset(id: string): Preset | undefined {
    const presets = this.getPresets();
    return presets.find(p => p.id === id);
  }

  savePreset(preset: Omit<Preset, 'createdAt' | 'updatedAt'>): void {
    const presets = this.getPresets();
    const now = Date.now();
    const newPreset: Preset = {
      ...preset,
      createdAt: now,
      updatedAt: now,
    };
    
    // Remove existing preset with same id if it exists
    const filteredPresets = presets.filter(p => p.id !== preset.id);
    filteredPresets.unshift(newPreset); // Add to beginning
    this.savePresets(filteredPresets);
  }

  updatePreset(id: string, updates: Partial<Pick<Preset, 'title' | 'body'>>): void {
    const presets = this.getPresets();
    const index = presets.findIndex(p => p.id === id);
    if (index !== -1) {
      presets[index] = {
        ...presets[index],
        ...updates,
        updatedAt: Date.now(),
      };
      this.savePresets(presets);
    }
  }

  deletePreset(id: string): void {
    const presets = this.getPresets();
    const filteredPresets = presets.filter(p => p.id !== id);
    this.savePresets(filteredPresets);
  }

  clearPresets(): void {
    localStorage.removeItem(this.storageKey);
  }
}

// Create separate stores for each page
export const ocrPresetStore = new LocalStoragePresetStore('ocr');
export const promptEvalPresetStore = new LocalStoragePresetStore('prompt-eval');
export const chatPresetStore = new LocalStoragePresetStore('chat');



