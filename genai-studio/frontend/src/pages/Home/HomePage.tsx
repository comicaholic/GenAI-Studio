// Frontend/src/pages/Home/HomePage.tsx
import React, { useState, useEffect } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { api } from "@/services/api";
import { SavedEvaluation, SavedChat } from "@/types/history";
import { historyService } from "@/services/history";
import HistoryModal from "@/components/HistoryModal/HistoryModal";
import { useNavigate } from "react-router-dom";
import { useModel } from "@/context/ModelContext";

export default function HomePage() {
  const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [groqConnected, setGroqConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<SavedEvaluation | SavedChat | null>(null);
  const navigate = useNavigate();
  const { setSelected } = useModel();

  // Load data from backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [evaluationsData, chatsData] = await Promise.all([
          historyService.getEvaluations(),
          historyService.getChats()
        ]);
        setEvaluations(evaluationsData);
        setChats(chatsData);
        setGroqConnected(true); // TODO: Check actual Groq connection
      } catch (error) {
        console.error('Error loading data:', error);
        // Don't show mock data - just show empty state
        setEvaluations([]);
        setChats([]);
        setGroqConnected(false);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate pass rate from evaluations
  const passRate = Math.round(
    (evaluations.filter(e => e.results && (e.results.rouge || 0) > 0.6).length / Math.max(evaluations.length, 1)) * 100
  );

  // Combine evaluations and chats for filtering
  const allItems = [
    ...evaluations.map(e => ({ ...e, itemType: 'evaluation' as const })),
    ...chats.map(c => ({ ...c, itemType: 'chat' as const }))
  ];

  const filteredItems = allItems.filter(item => {
    // Tab filter
    const tabMatch = activeTab === "all" || 
      (activeTab === "ocr" && item.itemType === 'evaluation' && item.type === "ocr") || 
      (activeTab === "prompt" && item.itemType === 'evaluation' && item.type === "prompt") ||
      (activeTab === "chats" && item.itemType === 'chat');
    
    // Search filter
    const searchMatch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Provider filters
    const providerFilters = activeFilters.filter(f => f.startsWith("provider:")).map(f => f.split(":")[1]);
    const providerMatch = providerFilters.length === 0 || providerFilters.includes(item.model.provider);
    
    return tabMatch && searchMatch && providerMatch;
  });

  // Handle item actions
  const handleLoad = async (item: SavedEvaluation | SavedChat) => {
    // Set the model in context
    setSelected({
      id: item.model.id,
      label: item.model.id,
      provider: item.model.provider.toLowerCase() as "local" | "groq"
    });

    if ('type' in item) {
      // It's an evaluation
      if (item.type === 'ocr') {
        navigate('/ocr', { state: { loadEvaluation: item } });
      } else {
        navigate('/prompt', { state: { loadEvaluation: item } });
      }
    } else {
      // It's a chat
      navigate('/chat', { state: { loadChat: item } });
    }
  };

  const handleRun = async (item: SavedEvaluation | SavedChat) => {
    // First load the item, then trigger auto-run
    await handleLoad(item);
    // The target page will detect the auto-run flag and start evaluation automatically
  };

  const handleItemClick = (item: SavedEvaluation | SavedChat) => {
    setSelectedItem(item);
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pass":
        return { background: "#ecfdf5", borderColor: "#bbf7d0", color: "#065f46" };
      case "review":
        return { background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" };
      case "fail":
        return { background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" };
      default:
        return { background: "#f3f4f6", borderColor: "#d1d5db", color: "#374151" };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pass": return "✔ Passed";
      case "review": return "▲ Needs review";
      case "fail": return "✗ Failed";
      default: return "Unknown";
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <LeftRail />
      <div style={{ ...styles.main, marginLeft: 56, flex: 1, overflow: "auto" }}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>GenAI Eval — Projects</h1>
            <div style={styles.sub}>Clean home hub for your evaluations, presets, and reports.</div>
          </div>
          <div style={styles.actions}>
            <span style={{...styles.badge, ...styles.badgeOk}}>
              🔐 Groq API: {groqConnected ? "Connected" : "Not Connected"}
            </span>
            <span style={styles.badge}>Pass rate: {passRate}%</span>
            <button style={styles.btn}>＋ New OCR Eval</button>
            <button style={{...styles.btn, ...styles.btnSecondary}}>⭳ Import</button>
          </div>
        </header>

        <section style={styles.controls}>
          <div style={styles.search}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.searchIcon}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              placeholder="Search projects, models…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <div style={styles.chips}>
            <button
              className={`chip ${activeFilters.includes("kind:OCR") ? "active" : ""}`}
              onClick={() => toggleFilter("kind:OCR")}
              style={styles.chip}
            >
              OCR
            </button>
            <button
              className={`chip ${activeFilters.includes("kind:Prompt") ? "active" : ""}`}
              onClick={() => toggleFilter("kind:Prompt")}
              style={styles.chip}
            >
              Prompt
            </button>
            <button
              className={`chip ${activeFilters.includes("provider:Groq") ? "active" : ""}`}
              onClick={() => toggleFilter("provider:Groq")}
              style={styles.chip}
            >
              Groq
            </button>
            <button
              className={`chip ${activeFilters.includes("provider:Local") ? "active" : ""}`}
              onClick={() => toggleFilter("provider:Local")}
              style={styles.chip}
            >
              Local
            </button>
          </div>
        </section>

        <nav style={styles.tabs}>
          <button
            className={activeTab === "all" ? "active" : ""}
            onClick={() => setActiveTab("all")}
            style={{...styles.tab, ...(activeTab === "all" ? styles.tabActive : {})}}
          >
            All
          </button>
          <button
            className={activeTab === "ocr" ? "active" : ""}
            onClick={() => setActiveTab("ocr")}
            style={{...styles.tab, ...(activeTab === "ocr" ? styles.tabActive : {})}}
          >
            OCR Evals
          </button>
          <button
            className={activeTab === "prompt" ? "active" : ""}
            onClick={() => setActiveTab("prompt")}
            style={{...styles.tab, ...(activeTab === "prompt" ? styles.tabActive : {})}}
          >
            Prompt Evals
          </button>
          <button
            className={activeTab === "chats" ? "active" : ""}
            onClick={() => setActiveTab("chats")}
            style={{...styles.tab, ...(activeTab === "chats" ? styles.tabActive : {})}}
          >
            Chats
          </button>
        </nav>

        <section style={styles.grid}>
          {isLoading ? (
            <div style={styles.loading}>Loading projects...</div>
          ) : filteredItems.length === 0 ? (
            <div style={styles.empty}>No projects found matching your criteria.</div>
          ) : (
            filteredItems.map(item => (
              <article key={item.id} style={styles.card} onClick={() => handleItemClick(item)}>
                <div style={styles.cardHead}>
                  <div style={styles.title}>
                    {item.itemType === 'evaluation' ? '📁' : '💬'} {item.title}
                  </div>
                  <span style={{
                    ...styles.status,
                    ...(item.itemType === 'evaluation' && item.results ? 
                      getStatusStyle((item.results.rouge || 0) > 0.6 ? 'pass' : 'review') :
                      { background: "#f3f4f6", borderColor: "#d1d5db", color: "#374151" }
                    )
                  }}>
                    {item.itemType === 'evaluation' && item.results ? 
                      getStatusText((item.results.rouge || 0) > 0.6 ? 'pass' : 'review') :
                      '💬 Chat'
                    }
                  </span>
                </div>
                <div style={styles.meta}>
                  Last run: {new Date(item.itemType === 'evaluation' ? item.startedAt : item.lastActivityAt).toLocaleDateString()}
                </div>
                <div style={styles.tags}>
                  <span style={styles.tag}>
                    {item.itemType === 'evaluation' ? item.type.toUpperCase() : 'CHAT'}
                  </span>
                  <span style={styles.tag}>{item.model.id}</span>
                  <span style={styles.tag}>{item.model.provider}</span>
                </div>
                {item.itemType === 'evaluation' && item.results && (
                  <div style={styles.metrics}>
                    <span style={styles.pill}>ROUGE: {Math.round((item.results.rouge || 0) * 100)}%</span>
                    <span style={styles.pill}>BLEU: {Math.round((item.results.bleu || 0) * 100)}%</span>
                    <span style={styles.pill}>F1: {Math.round((item.results.f1 || 0) * 100)}%</span>
                  </div>
                )}
                <div style={styles.foot}>
                  <span>🕒 history</span>
                  <div>
                    <button 
                      style={styles.smallBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoad(item);
                      }}
                    >
                      Load
                    </button>
                    <button 
                      style={styles.smallBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRun(item);
                      }}
                    >
                      Run
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        <div style={styles.hint}>
          Tip: Use presets in Settings to keep evaluations reproducible across OCR and Prompt pages.
        </div>

        {/* History Modal */}
        <HistoryModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onLoad={handleLoad}
          onRun={handleRun}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    marginLeft: 64,
    padding: 28,
    maxWidth: 1400,
    background: "#0f172a",
    minHeight: "100vh",
    color: "#e2e8f0",
  },
  header: {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  h1: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "0.2px",
    color: "#e2e8f0",
  },
  sub: {
    color: "#94a3b8",
    marginTop: 2,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid #334155",
    color: "#e2e8f0",
    background: "#1e293b",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
  },
  badgeOk: {
    background: "#064e3b",
    borderColor: "#10b981",
    color: "#10b981",
  },
  btn: {
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e2e8f0",
    padding: "8px 12px",
    borderRadius: 14,
    cursor: "pointer",
    fontSize: 14,
  },
  btnSecondary: {
    background: "#0f172a",
    color: "#e2e8f0",
    borderColor: "#334155",
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    margin: "14px 0 8px",
  },
  search: {
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 10,
    top: 9,
    opacity: 0.5,
  },
  searchInput: {
    width: 320,
    maxWidth: "100%",
    padding: "10px 12px 10px 36px",
    border: "1px solid #334155",
    borderRadius: 14,
    background: "#1e293b",
    color: "#e2e8f0",
    fontSize: 14,
  },
  chips: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    border: "1px solid #334155",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#1e293b",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 12,
  },
  tabs: {
    display: "flex",
    gap: 6,
    borderBottom: "1px solid #334155",
  },
  tab: {
    padding: "8px 12px",
    borderRadius: "10px 10px 0 0",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: 14,
  },
  tabActive: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderBottomColor: "#1e293b",
    color: "#e2e8f0",
  },
  grid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    marginTop: 14,
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 16,
    display: "flex",
    flexDirection: "column",
  },
  cardHead: {
    padding: "14px 14px 8px",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "flex",
    gap: 8,
    alignItems: "center",
    color: "#e2e8f0",
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid",
  },
  meta: {
    color: "#94a3b8",
    fontSize: 12,
    padding: "0 14px 10px",
  },
  tags: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    padding: "0 14px 10px",
  },
  tag: {
    border: "1px solid #334155",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#0f172a",
    fontSize: 12,
    color: "#e2e8f0",
  },
  metrics: {
    display: "flex",
    gap: 8,
    padding: "0 14px 12px",
  },
  pill: {
    background: "#0f172a",
    border: "1px solid #334155",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    color: "#e2e8f0",
  },
  foot: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderTop: "1px solid #334155",
    color: "#94a3b8",
    fontSize: 12,
  },
  smallBtn: {
    border: "1px solid #334155",
    background: "#1e293b",
    padding: "6px 10px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 12,
    color: "#e2e8f0",
    marginLeft: 4,
  },
  hint: {
    marginTop: 18,
    color: "#94a3b8",
    fontSize: 12,
  },
  loading: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: 40,
    color: "#94a3b8",
  },
  empty: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: 40,
    color: "#94a3b8",
  },
};
