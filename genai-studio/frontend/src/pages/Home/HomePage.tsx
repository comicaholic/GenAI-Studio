// src/pages/Home/HomePage.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { SavedEvaluation, SavedChat, SavedAutomation, ModelInfo } from "@/types/history";
import { historyService } from "@/services/history";
import { useNavigate } from "react-router-dom";
import { useModel } from "@/context/ModelContext";
import HistoryModal from "@/components/HistoryModal/HistoryModal";
import AutomationProgressModal from "@/components/AutomationProgress/AutomationProgressModal";
import AutomationGroupModal from "@/components/AutomationModal/AutomationGroupModal";
import RunDetailModal from "@/components/AutomationModal/RunDetailModal";
import { api } from "@/services/api";

// Improved type definitions
interface AutomationSet {
  setId: string;
  name: string;
  automations: SavedAutomation[];
  evaluations: SavedEvaluation[];
  totalRuns: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
  lastRunAt: string | null;
  itemType: "automationSet";
}

type Item = 
  | (SavedEvaluation & { itemType: "evaluation" }) 
  | (SavedChat & { itemType: "chat" }) 
  | AutomationSet;

interface LoadingState {
  data: boolean;
  files: boolean;
  modelValidation: boolean;
}

interface ErrorState {
  data?: string;
  files?: string;
  modelValidation?: string;
}

export default function HomePage() {
  const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [automationSets, setAutomationSets] = useState<AutomationSet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "ocr" | "prompt" | "chats" | "automations">("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [groqConnected, setGroqConnected] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({
    data: true,
    files: false,
    modelValidation: false
  });
  const [errors, setErrors] = useState<ErrorState>({});
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [selectedAutomationSet, setSelectedAutomationSet] = useState<AutomationSet | null>(null);
  const [selectedRun, setSelectedRun] = useState<{automation: SavedAutomation, runIndex: number} | null>(null);

  const navigate = useNavigate();
  const { setSelected } = useModel();

  // Improved data loading with better error handling
  const loadData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, data: true }));
      setErrors(prev => ({ ...prev, data: undefined }));
      
      const [evaluationsData, chatsData, automationSetsData, settingsData] = await Promise.all([
        historyService.getEvaluations().catch(err => {
          console.error("Failed to load evaluations:", err);
          return [];
        }),
        historyService.getChats().catch(err => {
          console.error("Failed to load chats:", err);
          return [];
        }),
        historyService.getAutomationSets().catch(err => {
          console.error("Failed to load automation sets:", err);
          return [];
        }),
        api.get("/settings/settings").catch(err => {
          console.warn("Failed to load settings:", err);
          return { data: { groq: { connected: false } } };
        })
      ]);
      
      setEvaluations(evaluationsData ?? []);
      setChats(chatsData ?? []);
      setAutomationSets(automationSetsData ?? []);
      setGroqConnected(Boolean(settingsData.data?.groq?.connected));
      
    } catch (err) {
      console.error("Failed to load homepage data:", err);
      setErrors(prev => ({ ...prev, data: "Failed to load data. Please try refreshing the page." }));
      setEvaluations([]);
      setChats([]);
      setAutomationSets([]);
      setGroqConnected(false);
    } finally {
      setLoading(prev => ({ ...prev, data: false }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await loadData();
      if (cancelled) return;
    };
    // Defer slightly to ensure router shell is ready
    const t = setTimeout(load, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  // Memoized pass rate calculation
  const passRate = useMemo(() => {
    if (!evaluations || !evaluations.length) return 0;
    const passing = evaluations.filter((e) => {
      const rouge = e.results?.rouge ?? 0;
      return rouge > 0.6;
    }).length;
    return Math.round((passing / Math.max(evaluations.length, 1)) * 100);
  }, [evaluations]);

  // Memoized automation set items creation
  const automationSetItems: AutomationSet[] = useMemo(() => 
    (automationSets || []).map((set) => ({
      setId: set.setId,
      name: set.name,
      automations: set.automations || [],
      evaluations: set.evaluations || [],
      totalRuns: set.totalRuns || 0,
      successCount: set.successCount || 0,
      errorCount: set.errorCount || 0,
      createdAt: set.createdAt,
      lastRunAt: set.lastRunAt,
      itemType: "automationSet" as const
    })), [automationSets]
  );

  // Memoized all items creation
  const allItems: Item[] = useMemo(() => [
    ...(evaluations || []).map((e) => ({ ...e, itemType: "evaluation" as const })),
    ...(chats || []).map((c) => ({ ...c, itemType: "chat" as const })),
    ...automationSetItems.map((a) => ({ ...a, itemType: "automationSet" as const })),
  ], [evaluations, chats, automationSetItems]);
  
  // Memoized provider filters
  const providerFilters = useMemo(() => 
    activeFilters
      .filter((f) => f.startsWith("provider:"))
      .map((f) => f.split(":")[1]), [activeFilters]
  );

  // Memoized filtering logic
  const filtered = useMemo(() => allItems.filter((item) => {
    const isAutomationSet = item.itemType === "automationSet";
    const tabOK =
      activeTab === "all" ||
      (activeTab === "ocr" && item.itemType === "evaluation" && (item as SavedEvaluation).type === "ocr") ||
      (activeTab === "prompt" && item.itemType === "evaluation" && (item as SavedEvaluation).type === "prompt") ||
      (activeTab === "chats" && item.itemType === "chat") ||
      (activeTab === "automations" && item.itemType === "automationSet");

    const s = searchQuery.trim().toLowerCase();
    const searchOK =
      !s ||
      ((isAutomationSet ? (item as AutomationSet).name : item.title) ?? "").toLowerCase().includes(s) ||
      (isAutomationSet ? (item as AutomationSet).automations[0]?.model?.id : item.model?.id)?.toLowerCase?.().includes(s);

    const provider = isAutomationSet 
      ? (item as AutomationSet).automations[0]?.model?.provider 
      : item.model?.provider;
    const providerLower = provider?.toLowerCase?.() || "";
    const providerOK = providerFilters.length === 0 || providerFilters.includes(providerLower);

    return tabOK && searchOK && providerOK;
  }), [allItems, activeTab, searchQuery, providerFilters]);

  // Enhanced file loading helper with better error handling
  const loadEvaluationFiles = useCallback(async (evaluation: SavedEvaluation) => {
    try {
      setLoading(prev => ({ ...prev, files: true }));
      setErrors(prev => ({ ...prev, files: undefined }));
      
      const filePromises: Promise<any>[] = [];
      
      // Load source file if available
      if (evaluation.files?.sourceFileName) {
        filePromises.push(
          api.get(`/files/load`, { 
            params: { kind: "source", name: evaluation.files.sourceFileName }, 
            responseType: "blob" 
          }).then(res => ({
            type: 'source',
            file: new File([res.data], evaluation.files.sourceFileName!),
            fileName: evaluation.files.sourceFileName!
          })).catch(err => {
            console.warn(`Failed to load source file ${evaluation.files.sourceFileName}:`, err);
            return null;
          })
        );
      }
      
      // Load reference file if available
      if (evaluation.files?.referenceFileName) {
        filePromises.push(
          api.get(`/files/load`, { 
            params: { kind: "reference", name: evaluation.files.referenceFileName } 
          }).then(res => ({
            type: 'reference',
            data: res.data,
            fileName: evaluation.files.referenceFileName!
          })).catch(err => {
            console.warn(`Failed to load reference file ${evaluation.files.referenceFileName}:`, err);
            return null;
          })
        );
      }
      
      // Load prompt file if available
      if (evaluation.files?.promptFileName) {
        filePromises.push(
          api.get(`/files/load`, { 
            params: { kind: "source", name: evaluation.files.promptFileName }, 
            responseType: "blob" 
          }).then(res => ({
            type: 'prompt',
            file: new File([res.data], evaluation.files.promptFileName!),
            fileName: evaluation.files.promptFileName!
          })).catch(err => {
            console.warn(`Failed to load prompt file ${evaluation.files.promptFileName}:`, err);
            return null;
          })
        );
      }
      
      const results = await Promise.all(filePromises);
      return results.filter(Boolean);
      
    } catch (error) {
      console.error("Failed to load evaluation files:", error);
      setErrors(prev => ({ ...prev, files: "Failed to load some files" }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, files: false }));
    }
  }, []);

  // Enhanced preset loading helper
  const loadEvaluationPreset = (evaluation: SavedEvaluation) => {
    // Create a synthetic preset from the evaluation data
    const preset = {
      id: `eval-${evaluation.id}`,
      title: `${evaluation.title} (Restored)`,
      body: evaluation.usedText?.promptText || "",
      parameters: evaluation.parameters || {},
      metrics: (evaluation as any).metricsState || evaluation.metrics?.reduce((acc, metric) => {
        acc[metric] = true;
        return acc;
      }, {} as Record<string, boolean>) || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    return preset;
  };

  // Enhanced model validation helper with better error handling
  const validateModelAvailability = useCallback(async (model: ModelInfo) => {
    try {
      setLoading(prev => ({ ...prev, modelValidation: true }));
      setErrors(prev => ({ ...prev, modelValidation: undefined }));
      
      // Check if model is available by trying to get model info
      const response = await api.get("/models/scan");
      const availableModels = response.data.local || [];
      
      // Check if the model exists in available models
      const modelExists = availableModels.some((m: any) => 
        m.id === model.id || m.name === model.id
      );
      
      return {
        available: modelExists,
        fallback: modelExists ? model : availableModels[0] || model
      };
    } catch (error) {
      console.warn("Failed to validate model availability:", error);
      setErrors(prev => ({ ...prev, modelValidation: "Failed to validate model availability" }));
      return {
        available: true, // Assume available if we can't check
        fallback: model
      };
    } finally {
      setLoading(prev => ({ ...prev, modelValidation: false }));
    }
  }, []);

  // actions
  const handleLoad = async (item: Item) => {
    if (item.itemType === "automationSet") {
      // For automation sets, show the automation set modal
      setSelectedAutomationSet(item);
      return;
    }

    if (item.itemType === "evaluation") {
      const evaluation = item as SavedEvaluation;
      
      // Validate and potentially adjust model
      const modelValidation = await validateModelAvailability(evaluation.model);
      const finalModel = modelValidation.fallback;
      
      // Set the model context
      const provider = finalModel.provider?.toLowerCase?.() || "local";
      const id = finalModel.id || "unknown";
      setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });

      // Load files, presets, and other data
      const files = await loadEvaluationFiles(evaluation);
      const preset = loadEvaluationPreset(evaluation);
      
      // Create enhanced evaluation data with all loaded information
      const enhancedEvaluation = {
        ...evaluation,
        model: finalModel,
        loadedFiles: files,
        loadedPreset: preset,
        modelValidation: modelValidation
      };

      navigate(evaluation.type === "ocr" ? "/ocr" : "/prompt", { 
        state: { 
          loadEvaluation: enhancedEvaluation,
          autoLoadFiles: true,
          autoLoadPreset: true
        } 
      });
    } else {
      const chat = item as SavedChat;
      const provider = chat.model?.provider?.toLowerCase?.() || "local";
      const id = chat.model?.id || "unknown";
      setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });
      navigate("/chat", { state: { loadChat: item } });
    }
  };

  const handleRun = async (item: Item) => {
    if (item.itemType === "automationSet") {
      // For automation sets, run the first automation
      handleAutomationSetRun(item);
      return;
    }

    if (item.itemType === "evaluation") {
      const evaluation = item as SavedEvaluation;
      
      // Validate and potentially adjust model
      const modelValidation = await validateModelAvailability(evaluation.model);
      const finalModel = modelValidation.fallback;
      
      // Set the model context
      const provider = finalModel.provider?.toLowerCase?.() || "local";
      const id = finalModel.id || "unknown";
      setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });

      // Load files, presets, and other data
      const files = await loadEvaluationFiles(evaluation);
      const preset = loadEvaluationPreset(evaluation);
      
      // Create enhanced evaluation data with all loaded information
      const enhancedEvaluation = {
        ...evaluation,
        model: finalModel,
        loadedFiles: files,
        loadedPreset: preset,
        modelValidation: modelValidation
      };

      navigate(evaluation.type === "ocr" ? "/ocr" : "/prompt", { 
        state: { 
          loadEvaluation: enhancedEvaluation,
          autoLoadFiles: true,
          autoLoadPreset: true,
          autoRun: true // This will trigger automatic execution
        } 
      });
    } else {
      const chat = item as SavedChat;
      const provider = chat.model?.provider?.toLowerCase?.() || "local";
      const id = chat.model?.id || "unknown";
      setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });
      navigate("/chat", { state: { loadChat: item, autoRun: true } });
    }
  };

  // Automation set modal handlers
  const handleAutomationSetLoad = (automationSet: any) => {
    // Load the first automation in the set
    const automation = automationSet.automations[0];
    if (!automation) return;
    
    const provider = automation?.model?.provider?.toLowerCase?.() || "local";
    const id = automation?.model?.id || "unknown";

    setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });

    // Navigate to the appropriate page based on automation type
    if (automation.type === "ocr") {
      navigate("/ocr", { state: { loadAutomation: automation } });
    } else if (automation.type === "prompt") {
      navigate("/prompt", { state: { loadAutomation: automation } });
    } else if (automation.type === "chat") {
      navigate("/chat", { state: { loadAutomation: automation } });
    }
    setSelectedAutomationSet(null);
  };

  const handleAutomationSetRun = (automationSet: any) => {
    // Load and run the first automation in the set
    handleAutomationSetLoad(automationSet);
  };

  const handleAutomationLoadRun = (automation: SavedAutomation, runIndex: number) => {
    const run = automation.runs[runIndex];
    if (!run) return;

    // Create a single evaluation from the run
    const evaluation = {
      id: run.id,
      type: automation.type,
      title: `${automation.name} - ${run.runName}`,
      model: { id: run.model?.id || automation.model?.id, provider: run.model?.provider || automation.model?.provider },
      parameters: run.parameters,
      metrics: run.metrics || [],
      usedText: {
        promptText: run.usedText?.promptText,
        ocrText: run.usedText?.ocrText,
        referenceText: run.usedText?.referenceText,
      },
      files: {
        sourceFileName: run.files?.sourceFileName,
        promptFileName: run.files?.promptFileName,
        referenceFileName: run.files?.referenceFileName,
      },
      results: run.results,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    };

    const provider = automation?.model?.provider?.toLowerCase?.() || "local";
    const id = automation?.model?.id || "unknown";
    setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });

    // Navigate to the appropriate page with the evaluation
    if (automation.type === "ocr") {
      navigate("/ocr", { state: { loadEvaluation: evaluation } });
    } else if (automation.type === "prompt") {
      navigate("/prompt", { state: { loadEvaluation: evaluation } });
    } else if (automation.type === "chat") {
      navigate("/chat", { state: { loadChat: evaluation } });
    }
    setSelectedAutomationSet(null);
  };

  const handleRunDetails = (automation: SavedAutomation, runIndex: number) => {
    setSelectedRun({ automation, runIndex });
  };

  const handleDelete = async (item: SavedEvaluation | SavedChat | SavedAutomation | { setId: string, name: string, automations: SavedAutomation[], evaluations: SavedEvaluation[], totalRuns: number, successCount: number, errorCount: number, createdAt: string, lastRunAt: string | null, itemType: "automationSet" }) => {
    try {
      if ("itemType" in item && item.itemType === "automationSet") {
        // Delete all automations in the set
        for (const automation of item.automations) {
          await historyService.deleteAutomation(automation.id);
        }
        // Delete all evaluations in the set
        for (const evaluation of item.evaluations) {
          await historyService.deleteEvaluation(evaluation.id);
        }
      } else if ("type" in item && !("runs" in item)) {
        // It's an evaluation
        await historyService.deleteEvaluation((item as SavedEvaluation).id);
      } else if ("runs" in item) {
        // It's an automation
        await historyService.deleteAutomation((item as SavedAutomation).id);
      } else {
        // It's a chat
        await historyService.deleteChat((item as SavedChat).id);
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
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
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
              {/* Refresh Button */}
              <button
                onClick={loadData}
                disabled={loading.data}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  background: loading.data 
                    ? "#6b7280" 
                    : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  border: "none",
                  borderRadius: 8,
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading.data ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                }}
                onMouseEnter={(e) => {
                  if (!loading.data) {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading.data) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                  }
                }}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  style={{
                    animation: loading.data ? "spin 1s linear infinite" : "none"
                  }}
                >
                  <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                </svg>
                {loading.data ? "Refreshing..." : "Refresh"}
              </button>
              
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
            {loading.data && (
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
            {errors.data && (
              <div style={{ 
                gridColumn: "1 / -1", 
                color: "#ef4444", 
                padding: 48, 
                textAlign: "center",
                background: "#0f172a",
                border: "1px solid #ef4444",
                borderRadius: 16,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2C17.5,2 22,6.5 22,12S17.5,22 12,22 2,17.5 2,12 6.5,2 12,2M12,20C16.4,20 20,16.4 20,12S16.4,4 12,4 4,7.6 4,12 7.6,20 12,20M11,7H13V9H11V7M11,11H13V17H11V11Z"/>
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>{errors.data}</span>
                </div>
                <button
                  onClick={loadData}
                  style={{
                    padding: "8px 16px",
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  Try Again
                </button>
              </div>
            )}
            {!loading.data && !errors.data && filtered.length === 0 && (
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

            {!loading.data && !errors.data &&
              filtered.map((item) => {
                const isEval = item.itemType === "evaluation";
                const isChat = item.itemType === "chat";
                const isAutomationSet = item.itemType === "automationSet";
                const modelId = isAutomationSet 
                  ? (item as AutomationSet).automations[0]?.model?.id ?? "unknown"
                  : item.model?.id ?? "unknown";
                const provider = isAutomationSet 
                  ? (item as AutomationSet).automations[0]?.model?.provider ?? "local"
                  : item.model?.provider ?? "local";
                const metrics = isEval ? (item as SavedEvaluation).results ?? {} : {};
                const rouge = typeof metrics.rouge === "number" ? metrics.rouge : undefined;
                const bleu = typeof metrics.bleu === "number" ? metrics.bleu : undefined;
                const f1 = typeof metrics.f1 === "number" ? metrics.f1 : undefined;

                return (
                  <article
                    key={isAutomationSet ? (item as AutomationSet).setId : item.id}
                    onClick={() => {
                      if (item.itemType === "automationSet") {
                        setSelectedAutomationSet(item);
                      } else {
                        setSelectedItem(item);
                      }
                    }}
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
                            : isAutomationSet 
                            ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                            : "linear-gradient(135deg, #10b981, #059669)", 
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: isEval 
                            ? "0 4px 12px rgba(59, 130, 246, 0.3)" 
                            : isAutomationSet 
                            ? "0 4px 12px rgba(139, 92, 246, 0.3)"
                            : "0 4px 12px rgba(16, 185, 129, 0.3)"
                        }}>
                          {isEval ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                          ) : isAutomationSet ? (
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
                            title={isAutomationSet ? (item as AutomationSet).name : item.title}
                          >
                            {isAutomationSet ? (item as AutomationSet).name : item.title}
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
                              ? (item as SavedEvaluation).finishedAt
                                ? new Date((item as SavedEvaluation).finishedAt as string).toLocaleDateString('en-GB')
                                : ((item as SavedEvaluation).startedAt ? new Date((item as SavedEvaluation).startedAt as string).toLocaleDateString('en-GB') : "—")
                              : item.itemType === "automationSet"
                              ? (item as AutomationSet).lastRunAt
                                ? new Date((item as AutomationSet).lastRunAt as string).toLocaleDateString('en-GB')
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
                          : isAutomationSet 
                          ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                          : "linear-gradient(135deg, #10b981, #059669)",
                        color: "#ffffff",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        {isEval ? (item as SavedEvaluation).type?.toUpperCase() : isAutomationSet ? "AUTOMATION SET" : "CHAT"}
                      </span>
                      {!isAutomationSet && (
                        <>
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
                        </>
                      )}
                      {isAutomationSet && (
                        <>
                          <span style={{
                            ...tagStyle,
                            background: "#1e293b",
                            borderColor: "#475569",
                            color: "#e2e8f0",
                            fontWeight: 500
                          }}>
                            {(item as AutomationSet).automations.length} automations
                          </span>
                          <span style={{
                            ...tagStyle,
                            background: "#1e293b",
                            borderColor: "#475569",
                            color: "#e2e8f0",
                            fontWeight: 500
                          }}>
                            {(item as AutomationSet).totalRuns} total runs
                          </span>
                        </>
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

                    {/* Modern Automation Set Summary */}
                    {isAutomationSet && (
                      <div style={{ 
                        padding: "16px 20px",
                        borderBottom: "1px solid #334155"
                      }}>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "1fr 1fr", 
                          gap: 12,
                          marginBottom: 12
                        }}>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "#1e293b",
                            borderRadius: 6,
                            border: "1px solid #334155"
                          }}>
                            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Automations</span>
                            <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                              {(item as AutomationSet).automations.length}
                            </span>
                          </div>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "#1e293b",
                            borderRadius: 6,
                            border: "1px solid #334155"
                          }}>
                            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Total Runs</span>
                            <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                              {(item as AutomationSet).totalRuns}
                            </span>
                          </div>
                        </div>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "1fr 1fr", 
                          gap: 12
                        }}>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "#0f172a",
                            borderRadius: 6,
                            border: "1px solid #10b981"
                          }}>
                            <span style={{ fontSize: 12, color: "#10b981", fontWeight: 500 }}>Success</span>
                            <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>
                              {(item as AutomationSet).successCount}
                            </span>
                          </div>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "#0f172a",
                            borderRadius: 6,
                            border: "1px solid #ef4444"
                          }}>
                            <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 500 }}>Errors</span>
                            <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>
                              {(item as AutomationSet).errorCount}
                            </span>
                          </div>
                        </div>
                        {(item as AutomationSet).automations.length > 0 && (
                          <div style={{ 
                            marginTop: 12,
                            padding: "8px 12px",
                            background: "#1e293b",
                            borderRadius: 6,
                            border: "1px solid #334155"
                          }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                              Latest Automation Type
                            </div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 500 }}>
                              {(item as AutomationSet).automations[0]?.type?.toUpperCase() || 'UNKNOWN'}
                            </div>
                          </div>
                        )}
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
                        {isAutomationSet && (
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
                            Automation Set
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
                          {isAutomationSet ? "View" : "Load"}
                        </button>
                        
                        {!isAutomationSet && (
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
      
      {/* Automation Progress Modal */}
      <AutomationProgressModal
        isOpen={isAutomationModalOpen}
        onClose={() => setIsAutomationModalOpen(false)}
      />
      
      {/* Automation Set Modal */}
      {selectedAutomationSet && (
        <AutomationGroupModal
          automations={selectedAutomationSet.automations}
          evaluations={selectedAutomationSet.evaluations}
          onClose={() => setSelectedAutomationSet(null)}
          onLoad={handleAutomationSetLoad}
          onRun={handleAutomationSetRun}
          onRunDetails={handleRunDetails}
        />
      )}
      
      {/* Run Details Modal */}
      {selectedRun && (
        <RunDetailModal
          automation={selectedRun.automation}
          runIndex={selectedRun.runIndex}
          onClose={() => setSelectedRun(null)}
          onBack={() => setSelectedRun(null)}
          onLoadRun={handleAutomationLoadRun}
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

