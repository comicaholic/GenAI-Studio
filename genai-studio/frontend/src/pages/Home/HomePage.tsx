// src/pages/Home/HomePage.tsx
import React, { useState, useEffect } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { SavedEvaluation, SavedChat, SavedAutomation } from "@/types/history";
import { historyService } from "@/services/history";
import { useNavigate } from "react-router-dom";
import { useModel } from "@/context/ModelContext";
import HistoryModal from "@/components/HistoryModal/HistoryModal"; // keep if you already have it
import { api } from "@/services/api";

type Item = (SavedEvaluation & { itemType: "evaluation" }) | (SavedChat & { itemType: "chat" }) | (SavedAutomation & { itemType: "automation" });

export default function HomePage() {
  const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [automations, setAutomations] = useState<SavedAutomation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "ocr" | "prompt" | "chats" | "automations">("all");
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
        const [evaluationsData, chatsData, automationsData, settingsData] = await Promise.all([
          historyService.getEvaluations(),
          historyService.getChats(),
          historyService.getAutomationAggregates(),
          api.get("/settings/settings").catch(() => ({ data: { groq: { connected: false } } }))
        ]);
        if (cancelled) return;
        setEvaluations(evaluationsData ?? []);
        setChats(chatsData ?? []);
        setAutomations(automationsData ?? []);
        setGroqConnected(Boolean(settingsData.data?.groq?.connected));
      } catch (err) {
        if (cancelled) return;
        console.error("Home: failed to load history", err);
        setEvaluations([]);
        setChats([]);
        setAutomations([]);
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
    if (!evaluations || !evaluations.length) return 0;
    const passing = evaluations.filter((e) => {
      const rouge = (e as any)?.results?.rouge ?? 0;
      return rouge > 0.6;
    }).length;
    return Math.round((passing / Math.max(evaluations.length, 1)) * 100);
  })();

  // merge
  const allItems: Item[] = [
    ...(evaluations || []).map((e) => ({ ...e, itemType: "evaluation" as const })),
    ...(chats || []).map((c) => ({ ...c, itemType: "chat" as const })),
    ...(automations || []).map((a) => ({ ...a, itemType: "automation" as const })),
  ];

  // provider filter parsing
  const providerFilters = activeFilters
    .filter((f) => f.startsWith("provider:"))
    .map((f) => f.split(":")[1]);

  // filtering
  const filtered = allItems.filter((item) => {
    const isAutomation = item.itemType === "automation";
    const tabOK =
      activeTab === "all" ||
      (activeTab === "ocr" && item.itemType === "evaluation" && (item as SavedEvaluation).type === "ocr") ||
      (activeTab === "prompt" && item.itemType === "evaluation" && (item as SavedEvaluation).type === "prompt") ||
      (activeTab === "chats" && item.itemType === "chat") ||
      (activeTab === "automations" && item.itemType === "automation");

    const s = searchQuery.trim().toLowerCase();
    const searchOK =
      !s ||
      ((isAutomation ? (item as SavedAutomation).name : item.title) ?? "").toLowerCase().includes(s) ||
      (item as any)?.model?.id?.toLowerCase?.().includes(s);

    const provider = (item as any)?.model?.provider?.toLowerCase?.() || "";
    const providerOK = providerFilters.length === 0 || providerFilters.includes(provider);

    return tabOK && searchOK && providerOK;
  });

  // actions
  const handleLoad = async (item: Item) => {
    if (item.itemType === "automation") {
      // For automations, just show the modal with run details
      setSelectedItem(item);
      return;
    }

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

  const handleDelete = async (item: SavedEvaluation | SavedChat | SavedAutomation) => {
    try {
      if ("type" in item && !("runs" in item)) {
        // It's an evaluation
        await historyService.deleteEvaluation(item.id);
      } else if ("runs" in item) {
        // It's an automation
        await historyService.deleteAutomation(item.id);
      } else {
        // It's a chat
        await historyService.deleteChat(item.id);
      }
      
      // Refresh the data by reloading the page
      window.location.reload();
      setSelectedItem(null);
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
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
      <div style={{ flex: 1, marginLeft: 80, display: "grid", gridTemplateRows: "auto 1fr" }}>
        {/* Modern Header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            background: "#0b1220",
            borderBottom: "1px solid #334155",
            padding: "24px 32px",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 12, 
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/>
                </svg>
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#e2e8f0" }}>GenAI Studio</h1>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: 16 }}>Your AI evaluation and chat workspace</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8,
                padding: "12px 16px", 
                background: groqConnected ? "#0f172a" : "#0f172a", 
                border: groqConnected ? "1px solid #10b981" : "1px solid #ef4444",
                borderRadius: 12,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: "50%", 
                  background: groqConnected ? "#10b981" : "#ef4444",
                  boxShadow: groqConnected ? "0 0 8px rgba(16, 185, 129, 0.5)" : "0 0 8px rgba(239, 68, 68, 0.5)"
                }} />
                <span style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: groqConnected ? "#10b981" : "#ef4444" 
                }}>
                  Groq API: {groqConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8,
                padding: "12px 16px", 
                background: "#0f172a", 
                border: "1px solid #3b82f6",
                borderRadius: 12,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#3b82f6" }}>
                  <path d="M9,16.17L4.83,12l-1.42,1.41L9,19L21,7l-1.41-1.41L9,16.17Z"/>
                </svg>
                <span style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: "#3b82f6" 
                }}>
                  Pass Rate: {passRate}%
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main style={{ overflow: "auto", padding: "32px" }}>
          {/* Modern Search + Filter Section */}
          <div style={{ 
            display: "flex", 
            gap: 16, 
            flexWrap: "wrap", 
            alignItems: "center", 
            marginBottom: 24,
            padding: "20px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 16,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
          }}>
            <div style={{ position: "relative", flex: 1, minWidth: 300 }}>
              <div style={{ position: "relative" }}>
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{ 
                    position: "absolute", 
                    left: 12, 
                    top: "50%", 
                    transform: "translateY(-50%)", 
                    color: "#94a3b8",
                    zIndex: 1
                  }}
                >
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects, models, and evaluations..."
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 44px",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#e2e8f0",
                    fontSize: 14,
                    outline: "none",
                    transition: "all 0.2s ease",
                    boxSizing: "border-box"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#334155";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 8 }}>
              {["provider:groq", "provider:local"].map((f) => {
                const active = activeFilters.includes(f);
                const provider = f.replace("provider:", "");
                return (
                  <button
                    key={f}
                    onClick={() => toggleFilter(f)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 12,
                      border: "1px solid #334155",
                      background: active 
                        ? provider === "groq" 
                          ? "linear-gradient(135deg, #10b981, #059669)" 
                          : "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                        : "#1e293b",
                      color: active ? "#ffffff" : "#e2e8f0",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: active ? "0 2px 4px rgba(0, 0, 0, 0.1)" : "none"
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "#334155";
                        e.currentTarget.style.borderColor = "#475569";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "#1e293b";
                        e.currentTarget.style.borderColor = "#334155";
                      }
                    }}
                  >
                    <div style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: "50%", 
                      background: provider === "groq" ? "#10b981" : "#3b82f6",
                      boxShadow: provider === "groq" ? "0 0 6px rgba(16, 185, 129, 0.5)" : "0 0 6px rgba(59, 130, 246, 0.5)"
                    }} />
                    {provider.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modern Tab Navigation */}
          <div style={{ 
            display: "flex", 
            gap: 8, 
            padding: 6, 
            background: "#0f172a", 
            border: "1px solid #334155", 
            borderRadius: 12,
            marginBottom: 24,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
          }}>
            {(["all", "ocr", "prompt", "chats", "automations"] as const).map((t) => {
              const active = activeTab === t;
              const getIcon = (tab: string) => {
                switch (tab) {
                  case "all": return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                    </svg>
                  );
                  case "ocr": return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                  );
                  case "prompt": return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  );
                  case "chats": return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,3C17.5,3 22,6.58 22,11C22,15.42 17.5,19 12,19C10.76,19 9.57,18.82 8.47,18.5C7.55,20.1 5.68,21 3.5,21C3.25,21 3,20.75 3,20.5V20.5C3,18.83 4.15,17.5 5.7,17.5C4.15,16.5 3,14.83 3,13C3,8.58 7.5,5 12,5Z"/>
                    </svg>
                  );
                  case "automations": return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                    </svg>
                  );
                  default: return null;
                }
              };
              
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: active 
                      ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                      : "transparent",
                    color: active ? "#ffffff" : "#94a3b8",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "#1e293b";
                      e.currentTarget.style.color = "#e2e8f0";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#94a3b8";
                    }
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center" }}>{getIcon(t)}</span>
                  <span>{t === "all" ? "All" : t === "ocr" ? "OCR Evals" : t === "prompt" ? "Prompt Evals" : t === "chats" ? "Chats" : "Automations"}</span>
                  {active && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "60%",
                      height: 2,
                      background: "linear-gradient(90deg, #ffffff, rgba(255,255,255,0.5))",
                      borderRadius: 1,
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Modern Cards Grid */}
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {isLoading && (
              <div style={{ 
                gridColumn: "1 / -1", 
                color: "#94a3b8", 
                padding: 48, 
                textAlign: "center",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 16,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>Loading projects...</span>
                </div>
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div style={{ 
                gridColumn: "1 / -1", 
                color: "#94a3b8", 
                padding: 48, 
                textAlign: "center",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 16,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,11H15V13H9M7,5H17A2,2 0 0,1 19,7V17A2,2 0 0,1 17,19H7A2,2 0 0,1 5,17V7A2,2 0 0,1 7,5M7,7V17H17V7H7Z"/>
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>No projects found</span>
                </div>
                <p style={{ margin: 0, fontSize: 14 }}>Try different filters or create a new evaluation to get started.</p>
              </div>
            )}

            {!isLoading &&
              filtered.map((item) => {
                const isEval = item.itemType === "evaluation";
                const isChat = item.itemType === "chat";
                const isAutomation = item.itemType === "automation";
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
                      transition: "all 0.2s ease",
                      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                      overflow: "hidden"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
                      e.currentTarget.style.borderColor = "#475569";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)";
                      e.currentTarget.style.borderColor = "#334155";
                    }}
                  >
                    {/* Modern Header */}
                    <div style={{ 
                      padding: "20px 20px 16px", 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "flex-start",
                      gap: 12,
                      borderBottom: "1px solid #334155"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: 10, 
                          background: isEval 
                            ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                            : isAutomation 
                            ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                            : "linear-gradient(135deg, #10b981, #059669)", 
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: isEval 
                            ? "0 4px 12px rgba(59, 130, 246, 0.3)" 
                            : isAutomation 
                            ? "0 4px 12px rgba(139, 92, 246, 0.3)"
                            : "0 4px 12px rgba(16, 185, 129, 0.3)"
                        }}>
                          {isEval ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                          ) : isAutomation ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                              <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                              <path d="M12,3C17.5,3 22,6.58 22,11C22,15.42 17.5,19 12,19C10.76,19 9.57,18.82 8.47,18.5C7.55,20.1 5.68,21 3.5,21C3.25,21 3,20.75 3,20.5V20.5C3,18.83 4.15,17.5 5.7,17.5C4.15,16.5 3,14.83 3,13C3,8.58 7.5,5 12,5Z"/>
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: "#e2e8f0",
                              marginBottom: 4,
                            }}
                            title={isAutomation ? (item as SavedAutomation).name : item.title}
                          >
                            {isAutomation ? (item as SavedAutomation).name : item.title}
                          </div>
                          <div style={{ 
                            color: "#94a3b8", 
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                            </svg>
                            Last run:{" "}
                            {item.itemType === "evaluation"
                              ? (item as any).finishedAt
                                ? new Date((item as any).finishedAt).toLocaleDateString('en-GB')
                                : ((item as any).startedAt ? new Date((item as any).startedAt).toLocaleDateString('en-GB') : "—")
                              : item.itemType === "automation"
                              ? (item as SavedAutomation).completedAt
                                ? new Date((item as SavedAutomation).completedAt!).toLocaleDateString('en-GB')
                                : "—"
                              : (item as SavedChat).lastActivityAt
                              ? new Date((item as SavedChat).lastActivityAt).toLocaleDateString('en-GB')
                              : "—"}
                          </div>
                        </div>
                      </div>
                      {statusBadge((item as any)?.status)}
                    </div>

                    {/* Modern Tags */}
                    <div style={{ 
                      display: "flex", 
                      gap: 8, 
                      flexWrap: "wrap", 
                      padding: "16px 20px",
                      borderBottom: "1px solid #334155"
                    }}>
                      <span style={{
                        ...tagStyle,
                        background: isEval 
                          ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                          : isAutomation 
                          ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                          : "linear-gradient(135deg, #10b981, #059669)",
                        color: "#ffffff",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        {isEval ? (item as SavedEvaluation).type?.toUpperCase() : isAutomation ? "AUTOMATION" : "CHAT"}
                      </span>
                      <span style={{
                        ...tagStyle,
                        background: "#1e293b",
                        borderColor: "#475569",
                        color: "#e2e8f0",
                        fontWeight: 500
                      }}>
                        {modelId}
                      </span>
                      <span style={{
                        ...tagStyle,
                        background: provider === "groq" ? "#0f172a" : "#0f172a",
                        borderColor: provider === "groq" ? "#10b981" : "#3b82f6",
                        color: provider === "groq" ? "#10b981" : "#3b82f6",
                        fontWeight: 600
                      }}>
                        {String(provider).toUpperCase()}
                      </span>
                      {isAutomation && (
                        <span style={{
                          ...tagStyle,
                          background: "#1e293b",
                          borderColor: "#475569",
                          color: "#e2e8f0",
                          fontWeight: 500
                        }}>
                          {(item as SavedAutomation).runs?.length || 0} runs
                        </span>
                      )}
                      {isChat && (
                        <span style={{
                          ...tagStyle,
                          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                          borderColor: "#3b82f6",
                          color: "#ffffff",
                          fontWeight: 600
                        }}>
                          {(item as SavedChat).usedText?.chatHistory?.length || 0} messages
                        </span>
                      )}
                    </div>

                    {/* Modern Metrics (eval only) */}
                    {isEval && (
                      <div style={{ 
                        padding: "16px 20px",
                        borderBottom: "1px solid #334155"
                      }}>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", 
                          gap: 12 
                        }}>
                          {pill("ROUGE", rouge)}
                          {pill("BLEU", bleu)}
                          {pill("F1", f1)}
                        </div>
                      </div>
                    )}

                    {/* Modern Automation Summary */}
                    {isAutomation && (
                      <div style={{ 
                        padding: "16px 20px",
                        borderBottom: "1px solid #334155"
                      }}>
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center",
                          marginBottom: 8
                        }}>
                          <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>Runs</span>
                          <span style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>
                            {(item as SavedAutomation).runs?.length || 0}
                          </span>
                        </div>
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center"
                        }}>
                          <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>Status</span>
                          <span style={{ 
                            fontSize: 13, 
                            color: "#e2e8f0", 
                            fontWeight: 600,
                            textTransform: "capitalize"
                          }}>
                            {(item as SavedAutomation).status || "unknown"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Modern Footer Actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 20px",
                        background: "#1e293b",
                        borderTop: "1px solid #334155",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isAutomation && (
                          <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 6,
                            fontSize: 12,
                            color: "#94a3b8",
                            fontWeight: 500
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                            </svg>
                            Automation
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoad(item);
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid #334155",
                            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                            color: "#ffffff",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                          </svg>
                          {isAutomation ? "View" : "Load"}
                        </button>
                        
                        {!isAutomation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRun(item);
                            }}
                            style={{
                              padding: "8px 16px",
                              borderRadius: 8,
                              border: "1px solid #334155",
                              background: "linear-gradient(135deg, #10b981, #059669)",
                              color: "#ffffff",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "translateY(-1px)";
                              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                            </svg>
                            Run
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #ef4444",
                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                            color: "#ffffff",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>

          {/* Modern Hint Section */}
          <div style={{ 
            marginTop: 32, 
            padding: "20px 24px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 16,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
          }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 12,
              color: "#94a3b8", 
              fontSize: 14,
              fontWeight: 500
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
              </svg>
              <span>Tip: Use presets in Settings to keep evaluations reproducible across OCR and Prompt pages.</span>
            </div>
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
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

const tagStyle: React.CSSProperties = {
  border: "1px solid #334155",
  padding: "6px 12px",
  borderRadius: 8,
  background: "#1e293b",
  fontSize: 12,
  color: "#e2e8f0",
  fontWeight: 500,
  transition: "all 0.2s ease",
};

const btnSmall: React.CSSProperties = {
  border: "1px solid #334155",
  background: "#0f172a",
  padding: "8px 16px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  color: "#e2e8f0",
  fontWeight: 600,
  transition: "all 0.2s ease",
};

