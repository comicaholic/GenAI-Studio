// frontend/src/stores/resourceStore.ts
import { Resource } from '@/types/promptEval';

class ResourceStore {
  private resources: Map<string, Resource> = new Map();
  private readonly STORAGE_KEY = 'prompt-eval-resources';
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
  private readonly MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200 MB

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.resources = new Map(data);
      }
    } catch (error) {
      console.error('Failed to load resources from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      const data = Array.from(this.resources.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save resources to storage:', error);
    }
  }

  private getTotalSize(): number {
    return Array.from(this.resources.values()).reduce((total, resource) => total + resource.size, 0);
  }

  private validateFile(file: File): string | null {
    if (file.size > this.MAX_FILE_SIZE) {
      return `File "${file.name}" is too large. Maximum size is ${this.MAX_FILE_SIZE / (1024 * 1024)} MB.`;
    }

    const totalSize = this.getTotalSize();
    if (totalSize + file.size > this.MAX_TOTAL_SIZE) {
      return `Adding this file would exceed the total size limit of ${this.MAX_TOTAL_SIZE / (1024 * 1024)} MB.`;
    }

    return null;
  }

  async add(files: File[]): Promise<{ resources: Resource[]; errors: string[] }> {
    const resources: Resource[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const validationError = this.validateFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      try {
        const resource = await this.createResourceFromFile(file);
        this.resources.set(resource.id, resource);
        resources.push(resource);
      } catch (error) {
        errors.push(`Failed to process "${file.name}": ${error}`);
      }
    }

    if (resources.length > 0) {
      this.saveToStorage();
    }

    return { resources, errors };
  }

  private async createResourceFromFile(file: File): Promise<Resource> {
    const id = crypto.randomUUID();
    const resource: Resource = {
      id,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: Date.now(),
      file,
    };

    // Create dataUrl for previews
    if (file.type.startsWith('image/') || file.type === 'text/plain' || file.type === 'text/markdown') {
      try {
        resource.dataUrl = await this.createDataUrl(file);
      } catch (error) {
        console.warn(`Failed to create preview for ${file.name}:`, error);
      }
    }

    return resource;
  }

  private createDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  remove(id: string): boolean {
    const removed = this.resources.delete(id);
    if (removed) {
      this.saveToStorage();
    }
    return removed;
  }

  clear(): void {
    this.resources.clear();
    this.saveToStorage();
  }

  rename(id: string, newName: string): boolean {
    const resource = this.resources.get(id);
    if (resource) {
      resource.name = newName;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  get(id: string): Resource | undefined {
    return this.resources.get(id);
  }

  getAll(): Resource[] {
    return Array.from(this.resources.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getByIds(ids: string[]): Resource[] {
    return ids.map(id => this.resources.get(id)).filter(Boolean) as Resource[];
  }

  getStats() {
    const resources = this.getAll();
    const totalSize = this.getTotalSize();
    return {
      count: resources.length,
      totalSize,
      totalSizeFormatted: this.formatFileSize(totalSize),
      maxTotalSize: this.MAX_TOTAL_SIZE,
      maxTotalSizeFormatted: this.formatFileSize(this.MAX_TOTAL_SIZE),
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
export const resourceStore = new ResourceStore();

