// src/pages/Home/HomePage.tsx
import React, { useState, useEffect } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { SavedEvaluation, SavedChat } from "@/types/history";
import { historyService } from "@/services/history";
import { useNavigate } from "react-router-dom";
import { useModel } from "@/context/ModelContext";
import HistoryModal from "@/components/HistoryModal/HistoryModal"; // keep if you already have it

type Item = (SavedEvaluation & { itemType: "evaluation" }) | (SavedChat & { itemType: "chat" });

export default function HomePage() {
  const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "ocr" | "prompt" | "chats">("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [groqConnected, setGroqConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const navigate = useNavigate();
  const { setSelected } = useModel();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        const [evaluationsData, chatsData] = await Promise.all([
          historyService.getEvaluations(),
          historyService.getChats(),
        ]);
        if (cancelled) return;
        setEvaluations(evaluationsData ?? []);
        setChats(chatsData ?? []);
        setGroqConnected(Boolean(import.meta.env.VITE_GROQ_API_KEY));
      } catch (err) {
        if (cancelled) return;
        console.error("Home: failed to load history", err);
        setEvaluations([]);
        setChats([]);
        setGroqConnected(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    // Defer slightly to ensure router shell is ready
    const t = setTimeout(load, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  // pass rate: safe
  const passRate = (() => {
    if (!evaluations.length) return 0;
    const passing = evaluations.filter((e) => {
      const rouge = (e as any)?.results?.rouge ?? 0;
      return rouge > 0.6;
    }).length;
    return Math.round((passing / Math.max(evaluations.length, 1)) * 100);
  })();

  // merge
  const allItems: Item[] = [
    ...evaluations.map((e) => ({ ...e, itemType: "evaluation" as const })),
    ...chats.map((c) => ({ ...c, itemType: "chat" as const })),
  ];

  // provider filter parsing
  const providerFilters = activeFilters
    .filter((f) => f.startsWith("provider:"))
    .map((f) => f.split(":")[1]);

  // filtering
  const filtered = allItems.filter((item) => {
    const tabOK =
      activeTab === "all" ||
      (activeTab === "ocr" && item.itemType === "evaluation" && (item as SavedEvaluation).type === "ocr") ||
      (activeTab === "prompt" && item.itemType === "evaluation" && (item as SavedEvaluation).type === "prompt") ||
      (activeTab === "chats" && item.itemType === "chat");

    const s = searchQuery.trim().toLowerCase();
    const searchOK =
      !s ||
      (item.title ?? "").toLowerCase().includes(s) ||
      (item as any)?.model?.id?.toLowerCase?.().includes(s);

    const provider = (item as any)?.model?.provider?.toLowerCase?.() || "";
    const providerOK = providerFilters.length === 0 || providerFilters.includes(provider);

    return tabOK && searchOK && providerOK;
  });

  // actions
  const handleLoad = async (item: Item) => {
    const provider = (item as any)?.model?.provider?.toLowerCase?.() || "local";
    const id = (item as any)?.model?.id || "unknown";

    setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });

    if (item.itemType === "evaluation") {
      navigate(item.type === "ocr" ? "/ocr" : "/prompt", { state: { loadEvaluation: item } });
    } else {
      navigate("/chat", { state: { loadChat: item } });
    }
  };

  const handleRun = async (item: Item) => {
    await handleLoad(item);
    // target page can auto-run if implemented
  };

  const toggleFilter = (f: string) =>
    setActiveFilters((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  // helpers
  const statusBadge = (status?: string) => {
    const s = (status ?? "").toLowerCase();
    const base: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 8px",
      borderRadius: 999,
      fontSize: 12,
      border: "1px solid",
    };
    const map: Record<string, React.CSSProperties> = {
      pass: { background: "#064e3b", borderColor: "#10b981", color: "#10b981" },
      review: { background: "#3f2c05", borderColor: "#f59e0b", color: "#f59e0b" },
      fail: { background: "#4c1d1d", borderColor: "#f87171", color: "#f87171" },
      unknown: { background: "#1f2937", borderColor: "#374151", color: "#cbd5e1" },
    };
    const text =
      s === "pass" ? "✔ Passed" : s === "review" ? "▲ Needs review" : s === "fail" ? "✗ Failed" : "Status";
    return <span style={{ ...base, ...(map[s] ?? map.unknown) }}>{text}</span>;
  };

  const pill = (label: string, value?: number) => (
    <span
      key={label}
      style={{
        background: "#0f172a",
        border: "1px solid #334155",
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 12,
        color: "#e2e8f0",
      }}
    >
      {label}: {typeof value === "number" ? `${Math.round(value * 100) / 100}` : "N/A"}
    </span>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b1220" }}>
      <LeftRail />

      {/* Page frame: header (sticky) + scrollable content; left rail width accounted with marginLeft */}
      <div style={{ flex: 1, marginLeft: 56, display: "grid", gridTemplateRows: "72px 1fr" }}>
        {/* Header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            background: "#0b1220",
            borderBottom: "1px solid #1f2a3a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: "#e2e8f0" }}>GenAI Eval — Projects</h1>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Clean home hub for your evaluations, presets, and reports.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#0b2a1c",
                color: "#34d399",
                border: "1px solid #065f46",
              }}
            >
              Groq API: {groqConnected ? "Connected" : "Not Connected"}
            </span>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#0b1b2a",
                color: "#93c5fd",
                border: "1px solid #1e3a8a",
              }}
            >
              Pass rate: {passRate}%
            </span>
          </div>
        </header>

        {/* Scrollable content */}
        <main style={{ overflow: "auto", padding: 20 }}>
          {/* Search + provider chips */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div style={{ position: "relative" }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, models…"
                style={{
                  width: 320,
                  maxWidth: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#e2e8f0",
                }}
              />
            </div>
            {["provider:groq", "provider:local"].map((f) => {
              const active = activeFilters.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggleFilter(f)}
                  style={{
                    border: "1px solid #334155",
                    background: active ? "#1e293b" : "#0f172a",
                    color: "#e2e8f0",
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {f.replace("provider:", "").toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #1f2a3a", marginBottom: 12 }}>
            {(["all", "ocr", "prompt", "chats"] as const).map((t) => {
              const active = activeTab === t;
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px 10px 0 0",
                    cursor: "pointer",
                    background: active ? "#0f172a" : "transparent",
                    color: active ? "#e2e8f0" : "#94a3b8",
                    border: "none",
                    borderBottom: active ? "2px solid #334155" : "2px solid transparent",
                  }}
                >
                  {t === "all" ? "All" : t === "ocr" ? "OCR Evals" : t === "prompt" ? "Prompt Evals" : "Chats"}
                </button>
              );
            })}
          </div>

          {/* Cards grid */}
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {isLoading && (
              <div style={{ gridColumn: "1 / -1", color: "#94a3b8", padding: 24, textAlign: "center" }}>Loading…</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", color: "#94a3b8", padding: 24, textAlign: "center" }}>
                Nothing here yet. Try different filters or create a new evaluation.
              </div>
            )}

            {!isLoading &&
              filtered.map((item) => {
                const isEval = item.itemType === "evaluation";
                const modelId = (item as any)?.model?.id ?? "unknown";
                const provider = (item as any)?.model?.provider ?? "local";
                const metrics = (item as any)?.results ?? {};
                const rouge = typeof metrics.rouge === "number" ? metrics.rouge : undefined;
                const bleu = typeof metrics.bleu === "number" ? metrics.bleu : undefined;
                const f1 = typeof metrics.f1 === "number" ? metrics.f1 : undefined;

                return (
                  <article
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 16,
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                    }}
                  >
                    {/* head */}
                    <div style={{ padding: "14px 14px 8px", display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: "#e2e8f0",
                          }}
                          title={item.title}
                        >
                          {isEval ? "📁" : "💬"} {item.title}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 12 }}>
                          Last run:{" "}
                          {item.itemType === "evaluation"
                            ? (item as any).updatedAt
                              ? new Date((item as any).updatedAt).toLocaleString()
                              : "—"
                            : (item as SavedChat).lastActivityAt
                            ? new Date((item as SavedChat).lastActivityAt).toLocaleString()
                            : "—"}
                        </div>
                      </div>
                      {statusBadge((item as any)?.status)}
                    </div>

                    {/* tags */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 14px 10px" }}>
                      <span style={tagStyle}>{isEval ? (item as SavedEvaluation).type?.toUpperCase() : "CHAT"}</span>
                      <span style={tagStyle}>{modelId}</span>
                      <span style={tagStyle}>{String(provider).toUpperCase()}</span>
                    </div>

                    {/* metrics (eval only) */}
                    {isEval && <div style={{ display: "flex", gap: 8, padding: "0 14px 12px" }}>
                      {pill("ROUGE", rouge)}
                      {pill("BLEU", bleu)}
                      {pill("F1", f1)}
                    </div>}

                    {/* footer buttons (clicks don’t trigger modal) */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderTop: "1px solid #334155",
                        color: "#94a3b8",
                        fontSize: 12,
                      }}
                    >
                      <span>🕒 history</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoad(item);
                          }}
                          style={btnSmall}
                        >
                          Load
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRun(item);
                          }}
                          style={{ ...btnSmall, background: "#1e293b" }}
                        >
                          Run
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>

          {/* hint */}
          <div style={{ marginTop: 18, color: "#94a3b8", fontSize: 12 }}>
            Tip: Use presets in Settings to keep evaluations reproducible across OCR and Prompt pages.
          </div>
        </main>
      </div>

      {/* Modal (uses your component if present) */}
      {selectedItem && (
        <HistoryModal
          item={selectedItem as unknown as (SavedEvaluation | SavedChat)}
          onClose={() => setSelectedItem(null)}
          onLoad={(i) => handleLoad(i as unknown as Item)}
          onRun={(i) => handleRun(i as unknown as Item)}
        />
      )}
    </div>
  );
}

const tagStyle: React.CSSProperties = {
  border: "1px solid #334155",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#0b1220",
  fontSize: 12,
  color: "#e2e8f0",
};

const btnSmall: React.CSSProperties = {
  border: "1px solid #334155",
  background: "#0f172a",
  padding: "6px 10px",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 12,
  color: "#e2e8f0",
};

