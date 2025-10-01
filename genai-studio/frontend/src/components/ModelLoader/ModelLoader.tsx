// frontend/src/components/ModelLoader/ModelDropdown.tsx
import React from "react";
import axios from "axios";
import { useModel } from "@/context/ModelContext";

type Provider = "local" | "groq";
type Model = {
  id: string;
  provider: Provider;
  size?: string | null;
  quant?: string | null;
  label?: string | null;
};

type ListResponse = {
  local: Model[];
  groq: Model[];
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

export default function ModelDropdown() {
  const { selected, setSelected } = useModel();

  const [open, setOpen] = React.useState(false);
  const [modelsLocal, setModelsLocal] = React.useState<Model[]>([]);
  const [modelsGroq, setModelsGroq] = React.useState<Model[]>([]);
  const [includeGroq, setIncludeGroq] = React.useState(true);
  const [warning, setWarning] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);

  const rootRef = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const fetchModels = React.useCallback(async () => {
    const { data } = await axios.get<ListResponse>("/api/models/list", {
      params: { include_groq: includeGroq },
    });
    setModelsLocal(data.local || []);
    setModelsGroq((data.groq || []).map(m => ({ ...m, provider: "groq" })));
    setWarning(data.warning?.warning || data.warning?.error || null);
  }, [includeGroq]);

  React.useEffect(() => { fetchModels(); }, [fetchModels]);

  // Compose + filter list (with section separators)
  const composed = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (m: Model) =>
      !q || (m.label || m.id).toLowerCase().includes(q) ||
      (m.quant || "").toLowerCase().includes(q) ||
      (m.size || "").toLowerCase().includes(q);

    const L = modelsLocal.filter(filter);
    const G = includeGroq ? modelsGroq.filter(filter) : [];
    const rows: Array<{ kind: "section" | "item"; text?: string; model?: Model }> = [];

    // Local section
    rows.push({ kind: "section", text: "Local Models" });
    if (L.length) L.forEach(m => rows.push({ kind: "item", model: m }));

    // Groq section (only if includeGroq is true)
    if (includeGroq) {
      rows.push({ kind: "section", text: "Groq Models" });
      if (G.length) G.forEach(m => rows.push({ kind: "item", model: m }));
    }

    // If both empty (after filter), keep structurefor empty notice
    return rows;
  }, [modelsLocal, modelsGroq, includeGroq, query]);

  const itemsOnly = React.useMemo(
    () => composed.filter(r => r.kind === "item"),
    [composed]
  );

  const selectByIndex = (idx: number) => {
    const row = itemsOnly[idx];
    if (!row || !row.model) return;
    setSelected({ ...row.model, label: row.model.label || row.model.id });
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(itemsOnly.length - 1, i + 1));
      scrollIntoView(activeIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(0, i - 1));
      scrollIntoView(activeIndex - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) selectByIndex(activeIndex);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const scrollIntoView = (idx: number) => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLDivElement>(`[data-idx="${idx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  };

  const noneAvailable = modelsLocal.length === 0 && (!includeGroq || modelsGroq.length === 0);

  // Closed state label
  const closedLabel = selected
    ? formatLabel(selected)
    : noneAvailable
      ? "No models available"
      : "Select a model…";

  return (
    <div ref={rootRef} style={styles.root} onKeyDown={onKeyDown}>
      {/* Closed control */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen(o => !o);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        style={{
          ...styles.button,
          color: selected ? "#e2e8f0" : noneAvailable ? "#f59e0b" : "#cbd5e1",
        }}
        title={selected?.id || closedLabel}
      >
        <span style={styles.buttonText}>{closedLabel}</span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: .85 }}>
          <path d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z" />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div role="listbox" aria-label="Model selection" style={styles.popover}>
          {/* Header row */}
          <div style={styles.header}>
            <input
              ref={inputRef}
              placeholder="Type to filter models…"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIndex(itemsOnly.length ? 0 : -1); }}
              style={styles.search}
            />
            <label style={styles.chkLabel}>
              <input
                type="checkbox"
                checked={includeGroq}
                onChange={e => setIncludeGroq(e.target.checked)}
              />
              <span style={{ marginLeft: 6 }}>include Groq</span>
            </label>
          </div>

          {warning && <div style={styles.warning}>{warning}</div>}

          {/* List */}
          <div ref={listRef} style={styles.list}>
            {/* Empty overall */}
            {noneAvailable && (
              <div style={styles.empty}>
                No models available.<br />
                Load or configure models, then return here to select one.
              </div>
            )}

            {/* Empty after filter */}
            {!noneAvailable && itemsOnly.length === 0 && (
              <div style={styles.empty}>No models match your filter.</div>
            )}

            {/* Rows */}
            {composed.map((r, i) =>
              r.kind === "section" ? (
                <div key={`sec-${i}`} style={styles.section}>{r.text}</div>
              ) : (
                <div
                  key={r.model!.id}
                  role="option"
                  aria-selected={selected?.id === r.model!.id}
                  data-idx={itemsOnly.findIndex(x => x.model!.id === r.model!.id)}
                  onMouseEnter={() => {
                    const idx = itemsOnly.findIndex(x => x.model!.id === r.model!.id);
                    setActiveIndex(idx);
                  }}
                  onClick={() => {
                    const idx = itemsOnly.findIndex(x => x.model!.id === r.model!.id);
                    selectByIndex(idx);
                  }}
                  style={{
                    ...styles.row,
                    ...(activeIndex >= 0 && itemsOnly[activeIndex]?.model?.id === r.model!.id
                      ? styles.rowActive
                      : {}),
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) auto auto", gap: 10, alignItems: "center" }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <strong>{r.model!.label || r.model!.id}</strong>
                    </div>
                    <div style={styles.meta}>{badge(providerLabel(r.model!.provider))}</div>
                    <div style={styles.meta}>
                      {r.model!.quant ? badge(r.model!.quant) : null}
                      {r.model!.size ? <span style={{ marginLeft: 8 }}>{r.model!.size}</span> : null}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- helpers & styles ---------------- */

function providerLabel(p: Provider) { return p === "groq" ? "Groq" : "Local"; }

function formatLabel(m: Model) {
  const base = m.label || m.id;
  const tags = [m.quant, m.size].filter(Boolean).join(" · ");
  return tags ? `${base}  ·  ${tags}` : base;
}

function badge(text: string) {
  return (
    <span style={{
      fontSize: 11,
      padding: "2px 6px",
      borderRadius: 8,
      border: "1px solid #334155",
      background: "#0f172a",
      color: "#cbd5e1",
    }}>
      {text}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { position: "relative", display: "inline-block" },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    minWidth: 360,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
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
    width: 560,
    maxHeight: 520,
    display: "grid",
    gridTemplateRows: "auto auto 1fr",
    background: "#0b1220",
    color: "#e2e8f0",
    border: "1px solid #1f2937",
    borderRadius: 12,
    boxShadow: "0 20px 60px rgba(0,0,0,.55)",
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
  list: { overflow: "auto", maxHeight: 420, padding: "6px 0" },
  section: {
    padding: "8px 12px",
    fontSize: 12,
    color: "#93a2bd",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  row: {
    padding: "8px 12px",
    cursor: "pointer",
  },
  rowActive: {
    background: "rgba(59,130,246,.12)",
  },
  meta: { display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" },
};
