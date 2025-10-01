// frontend/src/stores/backgroundState.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BackgroundOperation {
  id: string;
  type: 'ocr' | 'prompt' | 'chat';
  status: 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  progress?: number;
  error?: string;
}

interface BackgroundState {
  operations: BackgroundOperation[];
  isEnabled: boolean;
  
  // Actions
  setEnabled: (enabled: boolean) => void;
  addOperation: (operation: Omit<BackgroundOperation, 'id' | 'startTime'>) => string;
  updateOperation: (id: string, updates: Partial<BackgroundOperation>) => void;
  removeOperation: (id: string) => void;
  clearCompleted: () => void;
}

export const useBackgroundState = create<BackgroundState>()(
  persist(
    (set, get) => ({
      operations: [],
      isEnabled: true,

      setEnabled: (enabled: boolean) => {
        set({ isEnabled: enabled });
        if (!enabled) {
          // Clear all operations when disabled
          set({ operations: [] });
        }
      },

      addOperation: (operation) => {
        const id = crypto.randomUUID();
        const newOperation: BackgroundOperation = {
          ...operation,
          id,
          startTime: Date.now(),
        };
        
        set((state) => ({
          operations: [...state.operations, newOperation]
        }));
        
        return id;
      },

      updateOperation: (id: string, updates: Partial<BackgroundOperation>) => {
        set((state) => ({
          operations: state.operations.map(op => 
            op.id === id ? { ...op, ...updates } : op
          )
        }));
      },

      removeOperation: (id: string) => {
        set((state) => ({
          operations: state.operations.filter(op => op.id !== id)
        }));
      },

      clearCompleted: () => {
        set((state) => ({
          operations: state.operations.filter(op => op.status === 'running')
        }));
      },
    }),
    {
      name: 'background-state',
      partialize: (state) => ({ 
        isEnabled: state.isEnabled,
        operations: state.operations.filter(op => op.status === 'running')
      }),
    }
  )
);

