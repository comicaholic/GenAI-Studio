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
  // start completely empty (no auto-restore)
  const [selected, setSelectedState] = React.useState<ModelInfo | null>(null);

  const setSelected = React.useCallback((m: ModelInfo | null) => {
    setSelectedState(m);
    // persist only when user changes it; comment this out if you never want persistence
    try {
      if (m) localStorage.setItem(KEY, JSON.stringify(m));
      else localStorage.removeItem(KEY);
    } catch {}
  }, []);

  const value = React.useMemo(() => ({ selected, setSelected }), [selected, setSelected]);
  return <ModelCtx.Provider value={value}>{children}</ModelCtx.Provider>;
}

export const useModel = () => React.useContext(ModelCtx);


