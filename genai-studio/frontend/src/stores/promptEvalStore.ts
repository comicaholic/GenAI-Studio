// frontend/src/stores/promptEvalStore.ts
import { PromptEvalDraft, RunResult } from '@/types/promptEval';
import { resourceStore } from './resourceStore';

class PromptEvalStore {
  private draft: PromptEvalDraft = {
    prompt: '',
    context: '',
    parameters: {
      temperature: 0.7,
      topP: 1.0,
      maxTokens: 1000,
      system: 'You are a helpful assistant.',
      seed: null,
    },
    selectedModelId: null,
    resourceIds: [],
  };

  private runHistory: RunResult[] = [];
  private readonly STORAGE_KEY = 'prompt-eval-draft';
  private readonly HISTORY_KEY = 'prompt-eval-history';
  private saveTimeout: number | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.draft = { ...this.draft, ...data };
      }

      const historyStored = localStorage.getItem(this.HISTORY_KEY);
      if (historyStored) {
        this.runHistory = JSON.parse(historyStored);
      }
    } catch (error) {
      console.error('Failed to load draft from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.draft));
    } catch (error) {
      console.error('Failed to save draft to storage:', error);
    }
  }

  private saveHistory() {
    try {
      // Keep only last 5 runs
      const recentHistory = this.runHistory.slice(0, 5);
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Failed to save history to storage:', error);
    }
  }

  // Debounced save to avoid excessive localStorage writes
  private debouncedSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.saveToStorage();
    }, 400);
  }

  // Getters
  getDraft(): PromptEvalDraft {
    return { ...this.draft };
  }

  getRunHistory(): RunResult[] {
    return [...this.runHistory];
  }

  // Setters with auto-save
  updatePrompt(prompt: string) {
    this.draft.prompt = prompt;
    this.debouncedSave();
  }

  updateContext(context: string) {
    this.draft.context = context;
    this.debouncedSave();
  }

  updateParameters(parameters: Partial<PromptEvalDraft['parameters']>) {
    this.draft.parameters = { ...this.draft.parameters, ...parameters };
    this.debouncedSave();
  }

  updateSelectedModel(modelId: string | null) {
    this.draft.selectedModelId = modelId;
    this.debouncedSave();
  }

  updateResourceIds(resourceIds: string[]) {
    this.draft.resourceIds = resourceIds;
    this.debouncedSave();
  }

  // Preset management
  applyPreset(preset: Partial<PromptEvalDraft>) {
    this.draft = { ...this.draft, ...preset };
    this.saveToStorage();
  }

  // Run management
  addRunResult(result: RunResult) {
    this.runHistory.unshift(result);
    this.saveHistory();
  }

  clearHistory() {
    this.runHistory = [];
    this.saveHistory();
  }

  // Clear draft
  clearDraft() {
    this.draft = {
      prompt: '',
      context: '',
      parameters: {
        temperature: 0.7,
        topP: 1.0,
        maxTokens: 1000,
        system: 'You are a helpful assistant.',
        seed: null,
      },
      selectedModelId: null,
      resourceIds: [],
    };
    this.saveToStorage();
  }

  // Get current resources
  getCurrentResources() {
    return resourceStore.getByIds(this.draft.resourceIds);
  }

  // Validation
  validateDraft(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.draft.selectedModelId) {
      errors.push('Please select a model');
    }

    if (!this.draft.prompt.trim()) {
      errors.push('Please enter a prompt');
    }

    if (this.draft.parameters.temperature < 0 || this.draft.parameters.temperature > 2) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (this.draft.parameters.topP < 0 || this.draft.parameters.topP > 1) {
      errors.push('Top-p must be between 0 and 1');
    }

    if (this.draft.parameters.maxTokens && this.draft.parameters.maxTokens < 1) {
      errors.push('Max tokens must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const promptEvalStore = new PromptEvalStore();
