// src/context/ModelContext.tsx
import React from "react";

export type Provider = "local" | "groq";
export type ModelInfo = {
  id: string;
  label: string;
  provider: Provider;
  size?: string | null;
  quant?: string | null;
  tags?: string[];
  // Additional metadata from classified models
  publisher?: string;
  category?: string;
  architecture?: string;
  params?: string;
  description?: string;
  source?: string;
};

type Ctx = {
  selected: ModelInfo | null;
  setSelected: (m: ModelInfo | null) => void;
};

const ModelCtx = React.createContext<Ctx>({ selected: null, setSelected: () => {} });
const KEY = "genai.selectedModel";           // optional: keep persistence

export function ModelProvider({ children }: { children: React.ReactNode }) {
  // Start with no model selected to avoid phantom selections
  const [selected, setSelectedState] = React.useState<ModelInfo | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Restore persisted model after component mounts and models are loaded
  React.useEffect(() => {
    if (!isInitialized) {
      try {
        const stored = localStorage.getItem(KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Validate the stored model has required fields
          if (parsed && parsed.id && parsed.label && parsed.provider) {
            // Don't auto-restore immediately - let the user choose
            console.log("Found persisted model:", parsed.id, "but not auto-restoring");
          }
        }
      } catch (error) {
        console.warn("Failed to check persisted model:", error);
      }
      setIsInitialized(true);
    }
  }, [isInitialized]);

  const setSelected = React.useCallback((m: ModelInfo | null) => {
    setSelectedState(m);
    // persist only when user changes it
    try {
      if (m) {
        // Validate model before persisting
        if (m.id && m.label && m.provider) {
          localStorage.setItem(KEY, JSON.stringify(m));
          console.log("Persisted model selection:", m.id);
        } else {
          console.warn("Invalid model data, not persisting:", m);
        }
      } else {
        localStorage.removeItem(KEY);
        console.log("Cleared persisted model selection");
      }
    } catch (error) {
      console.warn("Failed to persist model selection:", error);
    }
  }, []);

  const value = React.useMemo(() => ({ selected, setSelected }), [selected, setSelected]);
  return <ModelCtx.Provider value={value}>{children}</ModelCtx.Provider>;
}

export const useModel = () => React.useContext(ModelCtx);


