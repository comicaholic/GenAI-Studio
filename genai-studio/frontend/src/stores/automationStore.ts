// src/stores/automationStore.ts
import { AutomationConfig, AutomationRun } from '@/components/AutomationModal/AutomationModal';
import { ChatAutomationConfig, ChatRun } from '@/components/ChatAutomationModal/ChatAutomationModal';

export interface AutomationProgress {
  id: string;
  type: 'ocr' | 'prompt' | 'chat';
  config: AutomationConfig | ChatAutomationConfig;
  currentRunIndex: number;
  currentPromptIndex?: number; // for chat automations
  status: 'running' | 'completed' | 'error';
  error?: string;
  startTime: number;
  endTime?: number;
}

class AutomationStore {
  private progress: AutomationProgress[] = [];
  private listeners: Set<() => void> = new Set();

  // Subscribe to changes
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners
  private notify() {
    this.listeners.forEach(listener => listener());
  }

  // Get all automation progress
  getProgress(): AutomationProgress[] {
    return [...this.progress];
  }

  // Get automation by ID
  getAutomation(id: string): AutomationProgress | undefined {
    return this.progress.find(p => p.id === id);
  }

  // Start automation
  startAutomation(type: 'ocr' | 'prompt' | 'chat', config: AutomationConfig | ChatAutomationConfig): string {
    const progress: AutomationProgress = {
      id: config.id,
      type,
      config,
      currentRunIndex: 0,
      currentPromptIndex: type === 'chat' ? 0 : undefined,
      status: 'running',
      startTime: Date.now(),
    };

    this.progress.push(progress);
    this.notify();
    return config.id;
  }

  // Update automation progress
  updateProgress(id: string, updates: Partial<AutomationProgress>) {
    const index = this.progress.findIndex(p => p.id === id);
    if (index !== -1) {
      this.progress[index] = { ...this.progress[index], ...updates };
      this.notify();
    }
  }

  // Complete automation
  completeAutomation(id: string, error?: string) {
    const index = this.progress.findIndex(p => p.id === id);
    if (index !== -1) {
      this.progress[index] = {
        ...this.progress[index],
        status: error ? 'error' : 'completed',
        error,
        endTime: Date.now(),
      };
      this.notify();
    }
  }

  // Remove completed automation
  removeAutomation(id: string) {
    this.progress = this.progress.filter(p => p.id !== id);
    this.notify();
  }

  // Clear all completed automations
  clearCompleted() {
    this.progress = this.progress.filter(p => p.status === 'running');
    this.notify();
  }
}

export const automationStore = new AutomationStore();

