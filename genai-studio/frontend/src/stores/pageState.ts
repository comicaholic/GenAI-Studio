// frontend/src/stores/pageState.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PageState {
  // Current active page
  activePage: string;
  
  // Pages that should be kept alive (mounted but hidden)
  alivePages: Set<string>;
  
  // Whether background state management is enabled
  backgroundStateEnabled: boolean;
  
  // Actions
  setActivePage: (page: string) => void;
  setBackgroundStateEnabled: (enabled: boolean) => void;
  addAlivePage: (page: string) => void;
  removeAlivePage: (page: string) => void;
  clearAlivePages: () => void;
  isPageAlive: (page: string) => boolean;
}

export const usePageState = create<PageState>()(
  persist(
    (set, get) => ({
      activePage: '/',
      alivePages: new Set(['/']), // Start with home page alive
      backgroundStateEnabled: true,

      setActivePage: (page: string) => {
        const { backgroundStateEnabled, alivePages } = get();
        
        set({ activePage: page });
        
        // If background state management is enabled, keep the page alive
        if (backgroundStateEnabled) {
          set({ alivePages: new Set([...alivePages, page]) });
        }
        
        console.log('PageState: Active page set to', page, 'Background enabled:', backgroundStateEnabled, 'Alive pages:', Array.from(alivePages));
      },

      setBackgroundStateEnabled: (enabled: boolean) => {
        set({ backgroundStateEnabled: enabled });
        
        if (!enabled) {
          // When disabled, only keep the current active page alive
          const { activePage } = get();
          set({ alivePages: new Set([activePage]) });
        }
      },

      addAlivePage: (page: string) => {
        const { alivePages } = get();
        set({ alivePages: new Set([...alivePages, page]) });
      },

      removeAlivePage: (page: string) => {
        const { alivePages } = get();
        const newAlivePages = new Set(alivePages);
        newAlivePages.delete(page);
        set({ alivePages: newAlivePages });
      },

      clearAlivePages: () => {
        const { activePage } = get();
        set({ alivePages: new Set([activePage]) });
      },

      isPageAlive: (page: string) => {
        const { alivePages } = get();
        return alivePages.has(page);
      },
    }),
    {
      name: 'page-state',
      partialize: (state) => ({
        backgroundStateEnabled: state.backgroundStateEnabled,
        alivePages: Array.from(state.alivePages),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert array back to Set after rehydration
          state.alivePages = new Set(state.alivePages as any);
        }
      },
    }
  )
);
