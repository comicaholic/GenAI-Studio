// frontend/src/components/TopBar/ModelSelector.tsx
import React from "react";
import Switch from "@/components/ui/Switch";
import axios from "axios";
import { useModel } from "@/context/ModelContext";

type Provider = "local" | "groq";
type ModelInfo = {
  id: string;
  label: string;
  provider: Provider;
  size?: string | null;
  quant?: string | null;
  tags?: string[];
};

type ListResponse = {
  local: any[];
  groq: any[];
  warning?: { warning?: string; error?: string } | null;
};

function useClickOutside<T extends HTMLElement>(onAway: () => void) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onAway();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [onAway]);
  return ref;
}

function prettifyModelId(id: string | undefined | null): string {
  if (!id) return "Unknown model";
  const trimmed = id.trim();
  const parts = trimmed.split(/[/:]/);
  const last = parts[parts.length - 1] || trimmed;
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function ModelSelector() {
  const { selected, setSelected } = useModel();

  const [open, setOpen] = React.useState(false);
  const [localModels, setLocalModels] = React.useState<ModelInfo[]>([]);
  const [groqModels, setGroqModels] = React.useState<ModelInfo[]>([]);
  const [includeGroq, setIncludeGroq] = React.useState(true);
  const [groqConnected, setGroqConnected] = React.useState(true);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [disabledIds, setDisabledIds] = React.useState<Set<string>>(new Set());

  // no capability filtering; show all models

  const [query, setQuery] = React.useState("");
  const rootRef = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const normalize = (raw: any, provider: Provider): ModelInfo => {
    const id = raw?.id || raw?.name || raw?.model_id || raw?.model || "";
    const label = (raw?.label && String(raw.label).trim())
      ? String(raw.label)
      : (raw?.name || prettifyModelId(id));
    const sizeRaw = raw?.size || raw?.details?.size || null;
    const size = sizeRaw === "hosted" ? null : sizeRaw;
    const quant = raw?.quant || raw?.details?.quantization || null;
    const tags = Array.isArray(raw?.tags) ? raw.tags : undefined;
    return { id: String(id), label: String(label), provider, size: size ? String(size) : null, quant: quant ? String(quant) : null, tags };
  };

  const fetchModels = React.useCallback(async () => {
    const { data } = await axios.get<ListResponse>("/api/models/list", {
      params: { include_groq: includeGroq },
    });
    const locals = (data.local || []).map(m => normalize(m, "local"));
    const groqs = (data.groq || []).map(m => normalize(m, "groq"));
    setLocalModels(locals);
    setGroqModels(groqs);
    setWarning(data.warning?.warning || data.warning?.error || null);
    setGroqConnected(!data.warning?.error);
  }, [includeGroq]);

  React.useEffect(() => { fetchModels(); }, [fetchModels]);

  React.useEffect(() => {
    const handler = () => fetchModels();
    window.addEventListener("models:changed", handler);
    return () => window.removeEventListener("models:changed", handler);
  }, []);

  // listen to visibility changes from Models page
  React.useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get("/api/models/visibility");
        const arr: string[] | null = data.enabled_ids ?? null;
        if (arr === null) {
          setDisabledIds(new Set());
        } else {
          // Convert enabled list to disabled set
          const enabled = new Set(arr);
          const allModelIds = [...localModels, ...groqModels].map(m => m.id);
          setDisabledIds(new Set(allModelIds.filter(id => !enabled.has(id))));
        }
      } catch { setDisabledIds(new Set()); }
    };
    load();
    const onChange = () => load();
    window.addEventListener("models:visibility-changed", onChange);
    return () => window.removeEventListener("models:visibility-changed", onChange);
  }, [localModels, groqModels]);

  const allModels = React.useMemo(() => {
    const q = query.toLowerCase();
    const filter = (m: ModelInfo) =>
      !disabledIds.has(m.id) && (!q || m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));

    return {
      local: localModels.filter(filter),
      groq: includeGroq ? groqModels.filter(filter) : [],
    };
  }, [localModels, groqModels, includeGroq, query, disabledIds]);

  const noneAvailable = allModels.local.length === 0 && allModels.groq.length === 0;

  const closedLabel = selected
    ? (selected.label && selected.label.trim() ? selected.label : prettifyModelId(selected.id))
    : (noneAvailable ? "No models available" : "Select a model…");

  const handleEject = () => {
    setSelected(null);
  };

  return (
    <div style={styles.container}>
      {/* Eject button */}
      <button
        type="button"
        onClick={handleEject}
        title="Eject model"
        style={{
          ...styles.ejectButton,
          opacity: selected ? 1 : 0.3,
          cursor: selected ? "pointer" : "not-allowed",
        }}
        className="rb-glare rb-press"
        disabled={!selected}
      >
        ⏏
      </button>

      <div ref={rootRef} style={styles.root}>
        {/* Closed button */}
        <button
          type="button"
          onClick={() => {
            setOpen(o => !o);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          style={styles.button}
          className="rb-glare rb-press"
        >
          <span style={styles.buttonText}>{closedLabel}</span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z" />
          </svg>
        </button>

        {/* Popover */}
        {open && (
          <div style={styles.popover} className="rb-bounce">
            <div style={styles.header}>
              <input
                ref={inputRef}
                placeholder="Filter models…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={styles.search}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#cbd5e1" }}>Groq</span>
                <Switch checked={includeGroq} onChange={setIncludeGroq} color="#10b981" />
              </div>
            </div>

            {warning && <div style={styles.warning}>{warning}</div>}

            <div style={styles.list}>
              {noneAvailable && (
                <div style={styles.empty}>
                  No models available.<br />
                  Use the Models page to discover and load models.
                </div>
              )}

              {allModels.local.length > 0 && (
                <>
                  <div style={styles.section}>Local Models</div>
                  {allModels.local.map(m => (
                    <div
                      key={m.id}
                      style={styles.row}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e293b"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      onClick={() => { 
                        setSelected(m); 
                        setOpen(false); 
                      }}
                      className="rb-hover-lift rb-press"
                    >
                      <div style={styles.modelName}>{(m.label && m.label.trim()) ? m.label : prettifyModelId(m.id)}</div>
                      <div style={styles.modelId}>{m.id || ""}</div>
                      <div style={styles.meta}>
                        {m.quant && <span>Quant: {m.quant}</span>}
                        {m.size && <span>Size: {m.size}</span>}
                        <span>Provider: Local</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {includeGroq && allModels.groq.length > 0 && (
                <>
                  <div style={styles.section}>Groq Models</div>
                  {allModels.groq.map(m => (
                    <div
                      key={m.id}
                      style={styles.row}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e293b"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      onClick={() => { 
                        setSelected(m); 
                        setOpen(false); 
                      }}
                      className="rb-hover-lift rb-press"
                    >
                      <div style={styles.modelName}>{(m.label && m.label.trim()) ? m.label : prettifyModelId(m.id)}</div>
                      <div style={styles.modelId}>{m.id || ""}</div>
                      <div style={styles.meta}>
                        {m.quant && <span>Quant: {m.quant}</span>}
                        {m.size && <span>Size: {m.size}</span>}
                        <span>Provider: Groq</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Warning message */}
      {warning && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#fef3c7",
          color: "#92400e",
          padding: "8px 12px",
          fontSize: "12px",
          borderRadius: "4px",
          marginTop: "4px",
          zIndex: 1000,
          border: "1px solid #f59e0b"
        }}>
          {warning}
        </div>
      )}

    </div>
  );
}

/* ---------- styles ---------- */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  ejectButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e2e8f0",
    fontSize: 16,
  },
  root: { position: "relative", display: "inline-block" },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    minWidth: 400,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e2e8f0",
    cursor: "pointer",
  },
  buttonText: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    flex: 1,
    textAlign: "left",
  },
  popover: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    zIndex: 1000,
    width: 600,
    maxHeight: 500,
    overflow: "auto",
    background: "#0b1220",
    color: "#e2e8f0",
    border: "1px solid #1f2937",
    borderRadius: 12,
    boxShadow: "0 12px 40px rgba(0,0,0,.5)",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #1f2937",
  },
  search: {
    padding: "8px 10px",
    border: "1px solid #334155",
    borderRadius: 8,
    background: "#0f172a",
    color: "#e2e8f0",
    outline: "none",
  },
  chkLabel: { display: "flex", alignItems: "center", fontSize: 12, color: "#cbd5e1" },
  warning: { padding: "8px 12px", color: "#fbbf24", borderBottom: "1px solid #1f2937" },
  list: { padding: "6px 0" },
  section: { padding: "8px 12px", fontSize: 12, color: "#93a2bd", textTransform: "uppercase" },
  row: { 
    padding: "12px 16px", 
    cursor: "pointer", 
    display: "flex", 
    flexDirection: "column",
    gap: 4,
    borderBottom: "1px solid #1f2937",
    transition: "background-color 0.2s"
  },
  rowHover: {
    backgroundColor: "#1e293b"
  },
  modelName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e2e8f0"
  },
  modelId: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "monospace"
  },
  meta: { 
    fontSize: 11, 
    color: "#64748b",
    display: "flex",
    gap: 8,
    marginTop: 2
  },
  empty: { padding: "20px 12px", fontSize: 14, color: "#9ca3af", textAlign: "center" },
};