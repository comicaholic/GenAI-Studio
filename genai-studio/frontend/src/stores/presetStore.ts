// frontend/src/stores/presetStore.ts
export interface Preset {
  id: string;
  title: string;
  body: string;
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
    system?: string;
    seed?: number | null;
  };
  metrics?: {
    rouge?: boolean;
    bleu?: boolean;
    f1?: boolean;
    em?: boolean;
    bertscore?: boolean;
    perplexity?: boolean;
    accuracy?: boolean;
    precision?: boolean;
    recall?: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface PresetStore {
  getPresets: () => Preset[];
  getPreset: (id: string) => Preset | undefined;
  savePreset: (preset: Omit<Preset, 'createdAt' | 'updatedAt'>) => void;
  updatePreset: (id: string, updates: Partial<Pick<Preset, 'title' | 'body' | 'parameters' | 'metrics'>>) => void;
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
        parameters: {
          temperature: 0.7,
          max_tokens: 1024,
          top_p: 1.0,
          top_k: 40,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'ocr-cleanup',
        title: 'OCR Cleanup',
        body: '',
        parameters: {
          temperature: 0.2,
          max_tokens: 512,
          top_p: 1.0,
          top_k: 40,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'creative-writing',
        title: 'Creative Writing',
        body: 'Write creatively and engagingly about the following topic:',
        parameters: {
          temperature: 0.9,
          max_tokens: 2048,
          top_p: 0.9,
          top_k: 50,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'technical-analysis',
        title: 'Technical Analysis',
        body: 'Provide a detailed technical analysis of the following:',
        parameters: {
          temperature: 0.3,
          max_tokens: 1500,
          top_p: 0.8,
          top_k: 30,
        },
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

  updatePreset(id: string, updates: Partial<Pick<Preset, 'title' | 'body' | 'parameters' | 'metrics'>>): void {
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



