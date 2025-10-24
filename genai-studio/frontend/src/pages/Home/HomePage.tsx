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
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary";
import { api } from "@/services/api";
import { safeLocalStorage, validators } from "@/utils/localStorage";
import { withRetry } from "@/utils/retry";
import { useLoadingState } from "@/hooks/useLoadingState";

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

export default function HomePage() {
  console.log("HomePage - Component rendering");
  
  const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [automationSets, setAutomationSets] = useState<AutomationSet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "ocr" | "prompt" | "chats" | "automations">("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [recencySort, setRecencySort] = useState<"most-recent" | "least-recent">("most-recent");
  const [groqConnected, setGroqConnected] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [lmstudioConnected, setLmstudioConnected] = useState(false);
  const [huggingfaceConnected, setHuggingfaceConnected] = useState(false);
  const [showApiConnections, setShowApiConnections] = useState({
    groq: true,
    ollama: true,
    huggingface: false,
    lmstudio: false,
    ollamaLocal: false,
    vllm: false,
  });
  // Enhanced loading state management
  const dataLoading = useLoadingState(true);
  const filesLoading = useLoadingState(false);
  const modelValidationLoading = useLoadingState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [selectedAutomationSet, setSelectedAutomationSet] = useState<AutomationSet | null>(null);
  const [selectedRun, setSelectedRun] = useState<{automation: SavedAutomation, runIndex: number} | null>(null);
  const [importFileRef, setImportFileRef] = useState<HTMLInputElement | null>(null);
  
  // Safe localStorage operations
  const hiddenCardsStorage = safeLocalStorage({
    key: 'genai-studio-hidden-cards',
    defaultValue: new Set<string>(),
    validator: validators.set
  });
  
  const showHiddenCardsStorage = safeLocalStorage({
    key: 'genai-studio-show-hidden-cards',
    defaultValue: false,
    validator: validators.boolean
  });

  const [hiddenCards, setHiddenCards] = useState<Set<string>>(hiddenCardsStorage.get());
  const [showHiddenCards, setShowHiddenCards] = useState<boolean>(showHiddenCardsStorage.get());
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);

  const navigate = useNavigate();
  const { setSelected } = useModel();

  // Improved data loading with better error handling and retry
  const loadData = useCallback(async () => {
    try {
      dataLoading.setLoading(true);
      
      const loadEvaluations = () => historyService.getEvaluations();
      const loadChats = () => historyService.getChats();
      const loadAutomationSets = () => historyService.getAutomationSets();
      const loadSettings = () => api.get("/settings/settings");

      const [evaluationsData, chatsData, automationSetsData, settingsData] = await Promise.all([
        withRetry(loadEvaluations, { maxAttempts: 3 }).catch(err => {
          console.error("Failed to load evaluations:", err);
          dataLoading.setError("Failed to load evaluations. Please try again.");
          return [];
        }),
        withRetry(loadChats, { maxAttempts: 3 }).catch(err => {
          console.error("Failed to load chats:", err);
          dataLoading.setError("Failed to load chats. Please try again.");
          return [];
        }),
        withRetry(loadAutomationSets, { maxAttempts: 3 }).catch(err => {
          console.error("Failed to load automation sets:", err);
          dataLoading.setError("Failed to load automation sets. Please try again.");
          return [];
        }),
        withRetry(loadSettings, { maxAttempts: 2 }).catch(err => {
          console.warn("Failed to load settings:", err);
          return { data: { groq: { connected: false } } };
        })
      ]);
      
      setEvaluations(evaluationsData ?? []);
      setChats(chatsData ?? []);
      setAutomationSets(automationSetsData ?? []);
      console.log("HomePage - Loaded automation sets:", automationSetsData);
      setGroqConnected(Boolean(settingsData.data?.groq?.connected));
      setOllamaConnected(Boolean(settingsData.data?.ollama?.connected));
      setLmstudioConnected(Boolean(settingsData.data?.lmstudio?.connected));
      setHuggingfaceConnected(Boolean(settingsData.data?.huggingface?.connected));
      setShowApiConnections(settingsData.data?.ui?.showApiConnections || {
        groq: true,
        ollama: true,
        huggingface: false,
        lmstudio: false,
        ollamaLocal: false,
        vllm: false,
      });
      
    } catch (err) {
      console.error("Failed to load homepage data:", err);
      dataLoading.setError("Failed to load data. Please try refreshing the page.");
      setEvaluations([]);
      setChats([]);
      setAutomationSets([]);
      setGroqConnected(false);
      setOllamaConnected(false);
      setLmstudioConnected(false);
      setHuggingfaceConnected(false);
      setShowApiConnections({
        groq: true,
        ollama: true,
        huggingface: false,
        lmstudio: false,
        ollamaLocal: false,
        vllm: false,
      });
    } finally {
      dataLoading.setLoading(false);
    }
  }, [dataLoading]);

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

  // Keyboard navigation support for refresh
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Refresh data with Ctrl+R or Cmd+R
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        if (!dataLoading.isLoading) {
          loadData();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dataLoading.isLoading, loadData]);

  // Listen for settings changes to update API status
  useEffect(() => {
    const handleSettingsChange = (event: CustomEvent) => {
      const settings = event.detail;
      if (settings?.groq) {
        setGroqConnected(Boolean(settings.groq.connected));
      }
      if (settings?.ollama) {
        setOllamaConnected(Boolean(settings.ollama.connected));
      }
      if (settings?.lmstudio) {
        setLmstudioConnected(Boolean(settings.lmstudio.connected));
      }
      if (settings?.huggingface) {
        setHuggingfaceConnected(Boolean(settings.huggingface.connected));
      }
      if (settings?.ui?.showApiConnections) {
        setShowApiConnections(settings.ui.showApiConnections);
      }
    };

    window.addEventListener("settings:changed", handleSettingsChange as EventListener);
    return () => {
      window.removeEventListener("settings:changed", handleSettingsChange as EventListener);
    };
  }, []);

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

  // Hide card functionality
  const toggleCardVisibility = useCallback((itemId: string) => {
    setHiddenCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      hiddenCardsStorage.set(newSet);
      return newSet;
    });
  }, [hiddenCardsStorage]);

  // Toggle show hidden cards functionality
  const toggleShowHiddenCards = useCallback(() => {
    setShowHiddenCards(prev => {
      const newValue = !prev;
      showHiddenCardsStorage.set(newValue);
      return newValue;
    });
  }, [showHiddenCardsStorage]);

  // Add keyboard handler for toggleShowHiddenCards after it's declared
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle hidden cards with Ctrl+H or Cmd+H
      if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        toggleShowHiddenCards();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleShowHiddenCards]);

  // Helper function to get sortable date for each item type
  const getItemSortDate = (item: Item): Date => {
    if (item.itemType === "evaluation") {
      const evaluation = item as SavedEvaluation;
      // Use finishedAt if available, otherwise startedAt
      const dateString = evaluation.finishedAt || evaluation.startedAt;
      return new Date(dateString);
    } else if (item.itemType === "chat") {
      const chat = item as SavedChat;
      // Use lastActivityAt
      const dateString = chat.lastActivityAt;
      return new Date(dateString);
    } else if (item.itemType === "automationSet") {
      const automationSet = item as AutomationSet;
      // Use lastRunAt if available, otherwise createdAt
      const dateString = automationSet.lastRunAt || automationSet.createdAt;
      return new Date(dateString);
    }
    return new Date(); // Fallback
  };

  // Memoized filtering and sorting logic
  const filtered = useMemo(() => {
    // First filter the items
    const filteredItems = allItems.filter((item) => {
      const isAutomationSet = item.itemType === "automationSet";
      const itemId = isAutomationSet ? (item as AutomationSet).setId : item.id;
      
      // Check if card is hidden
      const isHidden = hiddenCards.has(itemId);
      const visibilityOK = showHiddenCards || !isHidden;
      
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

      return visibilityOK && tabOK && searchOK && providerOK;
    });

    // Then sort by recency (left-to-right instead of top-to-bottom)
    return filteredItems.sort((a, b) => {
      const dateA = getItemSortDate(a);
      const dateB = getItemSortDate(b);
      
      if (recencySort === "most-recent") {
        return dateB.getTime() - dateA.getTime(); // Most recent first (newer dates first)
      } else {
        return dateA.getTime() - dateB.getTime(); // Least recent first (older dates first)
      }
    });
  }, [allItems, activeTab, searchQuery, providerFilters, hiddenCards, showHiddenCards, recencySort]);

  // Enhanced file loading helper with better error handling
  const loadEvaluationFiles = useCallback(async (evaluation: SavedEvaluation) => {
    try {
      filesLoading.setLoading(true);
      filesLoading.setError(null);
      
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
      filesLoading.setError("Failed to load some files");
      return [];
    } finally {
      filesLoading.setLoading(false);
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
      isRestored: true, // Flag to indicate this is a restored preset
    };
    
    return preset;
  };

  // Enhanced model validation helper with better error handling
  const validateModelAvailability = useCallback(async (model: ModelInfo) => {
    try {
      modelValidationLoading.setLoading(true);
      modelValidationLoading.setError(null);
      
      // Check if model is available by trying to get model info
      const response = await api.get("/models/scan");
      const availableModels = response.data.local || [];
      
      // Check if the model exists in available models
      const modelExists = availableModels.some((m: any) => 
        m.id === model.id || m.name === model.id
      );
      
      return {
        available: modelExists,
        fallback: modelExists ? model : availableModels[0] || model,
        missingModel: !modelExists ? model : null
      };
    } catch (error) {
      console.warn("Failed to validate model availability:", error);
      modelValidationLoading.setError("Failed to validate model availability");
      return {
        available: true, // Assume available if we can't check
        fallback: model,
        missingModel: null
      };
    } finally {
      modelValidationLoading.setLoading(false);
    }
  }, []);

  // actions
  const handleLoad = async (item: Item) => {
    console.log("HomePage - handleLoad called with:", item);
    console.log("HomePage - item.itemType:", item.itemType);
    
    if (item.itemType === "automationSet") {
      console.log("HomePage - Setting selectedAutomationSet");
      // For automation sets, show the automation set modal
      setSelectedAutomationSet(item);
      return;
    }

    if (item.itemType === "evaluation") {
      const evaluation = item as SavedEvaluation;
      
      console.log("HomePage - Starting evaluation load:", evaluation);
      console.log("HomePage - Evaluation files:", evaluation.files);
      console.log("HomePage - Evaluation usedText:", evaluation.usedText);
      console.log("HomePage - Evaluation parameters:", evaluation.parameters);
      console.log("HomePage - Evaluation metrics:", evaluation.metrics);
      console.log("HomePage - Evaluation metricsState:", evaluation.metricsState);
      console.log("HomePage - Evaluation model:", evaluation.model);
      console.log("HomePage - Evaluation type:", evaluation.type);
      
      // Validate and potentially adjust model
      const modelValidation = await validateModelAvailability(evaluation.model);
      const finalModel = modelValidation.fallback;
      console.log("HomePage - Model validation result:", modelValidation);
      
      // Set the model context
      const provider = finalModel.provider?.toLowerCase?.() || "local";
      const id = finalModel.id || "unknown";
      setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });
      console.log("HomePage - Set selected model:", { id, provider });

      // Load files, presets, and other data
      console.log("HomePage - Loading evaluation files...");
      const files = await loadEvaluationFiles(evaluation);
      console.log("HomePage - Loaded files:", files);
      
      console.log("HomePage - Loading evaluation preset...");
      const preset = loadEvaluationPreset(evaluation);
      console.log("HomePage - Loaded preset:", preset);
      
      // Track missing files for user feedback
      const missingFiles: string[] = [];
      if (evaluation.files?.sourceFileName && !files.some(f => f.type === 'source')) {
        missingFiles.push(`Source file: ${evaluation.files.sourceFileName}`);
      }
      if (evaluation.files?.referenceFileName && !files.some(f => f.type === 'reference')) {
        missingFiles.push(`Reference file: ${evaluation.files.referenceFileName}`);
      }
      if (evaluation.files?.promptFileName && !files.some(f => f.type === 'prompt')) {
        missingFiles.push(`Prompt file: ${evaluation.files.promptFileName}`);
      }
      
      // Create enhanced evaluation data with all loaded information
      const enhancedEvaluation = {
        ...evaluation,
        model: finalModel,
        loadedFiles: files,
        loadedPreset: preset,
        modelValidation: modelValidation,
        missingFiles: missingFiles,
        missingModel: modelValidation.missingModel,
        // Ensure metricsState is properly set
        metricsState: evaluation.metricsState || evaluation.metrics?.reduce((acc, metric) => {
          acc[metric] = true;
          return acc;
        }, {} as Record<string, boolean>) || {}
      };
      
      console.log("HomePage - Enhanced evaluation data:", enhancedEvaluation);
      console.log("HomePage - Parameters:", enhancedEvaluation.parameters);
      console.log("HomePage - Metrics:", enhancedEvaluation.metrics);
      console.log("HomePage - MetricsState:", enhancedEvaluation.metricsState);
      console.log("HomePage - LoadedFiles:", enhancedEvaluation.loadedFiles);
      console.log("HomePage - LoadedPreset:", enhancedEvaluation.loadedPreset);
      console.log("HomePage - UsedText:", enhancedEvaluation.usedText);
      console.log("HomePage - Files:", enhancedEvaluation.files);

      console.log("HomePage - Navigating to:", evaluation.type === "ocr" ? "/ocr" : "/prompt");
      console.log("HomePage - Navigation state being passed:", {
        loadEvaluation: enhancedEvaluation,
        autoLoadFiles: true,
        autoLoadPreset: true,
        showFeedback: true
      });
      console.log("HomePage - Enhanced evaluation keys:", Object.keys(enhancedEvaluation));
      console.log("HomePage - Enhanced evaluation usedText:", enhancedEvaluation.usedText);
      console.log("HomePage - Enhanced evaluation files:", enhancedEvaluation.files);
      console.log("HomePage - Enhanced evaluation loadedFiles:", enhancedEvaluation.loadedFiles);
      
      navigate(evaluation.type === "ocr" ? "/ocr" : "/prompt", { 
        state: { 
          loadEvaluation: enhancedEvaluation,
          autoLoadFiles: true,
          autoLoadPreset: true,
          showFeedback: true // Flag to show feedback on the target page
        } 
      });
      console.log("HomePage - Navigation completed");
    } else {
      const chat = item as SavedChat;
      const provider = chat.model?.provider?.toLowerCase?.() || "local";
      const id = chat.model?.id || "unknown";
      setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });
      // Navigate to chat page and load the existing chat by ID instead of creating a new one
      navigate("/chat", { state: { loadChatById: chat.id } });
    }
  };

  const handleRun = async (item: Item) => {
    if (item.itemType === "automationSet") {
      // For automation sets, show the automation set modal AND auto-run
      setSelectedAutomationSet(item);
      
      // Also auto-run the first automation
      const automationSet = item as AutomationSet;
      const firstAutomation = automationSet.automations[0];
      if (firstAutomation) {
        await handleAutomationSetRun(automationSet);
      }
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
        modelValidation: modelValidation,
        // Ensure metricsState is properly set
        metricsState: evaluation.metricsState || evaluation.metrics?.reduce((acc, metric) => {
          acc[metric] = true;
          return acc;
        }, {} as Record<string, boolean>) || {}
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
      // Navigate to chat page and load the existing chat by ID, then auto-run
      navigate("/chat", { state: { loadChatById: chat.id, autoRun: true } });
    }
  };

  // Automation set modal handlers
  const handleAutomationSetLoad = (automationSet: any) => {
    console.log("HomePage - handleAutomationSetLoad called with:", automationSet);
    console.log("HomePage - automationSet.automations:", automationSet.automations);
    console.log("HomePage - automationSet.name:", automationSet.name);
    
    // Load the first automation in the set
    const automation = automationSet.automations[0];
    if (!automation) {
      console.log("HomePage - No automation found in set");
      return;
    }
    
    console.log("HomePage - First automation:", automation);
    console.log("HomePage - Automation type:", automation.type);
    console.log("HomePage - Automation model:", automation.model);
    
    const provider = automation?.model?.provider?.toLowerCase?.() || "local";
    const id = automation?.model?.id || "unknown";

    console.log("HomePage - Setting model:", { id, provider });
    setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });

    // Navigate to the appropriate page and open automation modal with loaded settings
    console.log("HomePage - Navigating to:", automation.type);
    if (automation.type === "ocr") {
      navigate("/ocr", { 
        state: { 
          loadAutomation: automationSet, // Pass the full automation set
          openAutomationModal: true,
          autoLoadFiles: true,
          autoLoadPreset: true
        } 
      });
    } else if (automation.type === "prompt") {
      navigate("/prompt", { 
        state: { 
          loadAutomation: automationSet, // Pass the full automation set
          openAutomationModal: true,
          autoLoadFiles: true,
          autoLoadPreset: true
        } 
      });
    } else if (automation.type === "chat") {
      navigate("/chat", { 
        state: { 
          loadAutomation: automationSet, // Pass the full automation set
          openAutomationModal: true
        } 
      });
    }
    console.log("HomePage - Navigation completed");
    setSelectedAutomationSet(null);
  };

  const handleAutomationSetRun = (automationSet: any) => {
    // Load and run the first automation in the set
    const automation = automationSet.automations[0];
    if (!automation) return;
    
    const provider = automation?.model?.provider?.toLowerCase?.() || "local";
    const id = automation?.model?.id || "unknown";

    setSelected({ id, label: id, provider: provider === "groq" ? "groq" : "local" });

    // Navigate to the appropriate page based on automation type with autoRun flag
    if (automation.type === "ocr") {
      navigate("/ocr", { 
        state: { 
          loadAutomation: automationSet, // Pass the full automation set
          autoRun: true,
          autoLoadFiles: true,
          autoLoadPreset: true
        } 
      });
    } else if (automation.type === "prompt") {
      navigate("/prompt", { 
        state: { 
          loadAutomation: automationSet, // Pass the full automation set
          autoRun: true,
          autoLoadFiles: true,
          autoLoadPreset: true
        } 
      });
    } else if (automation.type === "chat") {
      navigate("/chat", { 
        state: { 
          loadAutomation: automationSet, // Pass the full automation set
          autoRun: true
        } 
      });
    }
    setSelectedAutomationSet(null);
  };

  const handleAutomationLoadRun = async (automation: SavedAutomation, runIndex: number) => {
    const run = automation.runs[runIndex];
    if (!run) return;

    // Create a single evaluation from the run with proper structure
    const evaluation = {
      id: run.id,
      type: automation.type === 'chat' ? 'prompt' : automation.type, // Convert chat to prompt for evaluation
      title: `${automation.name} - ${run.runName}`,
      model: { 
        id: run.model?.id || automation.model?.id, 
        provider: run.model?.provider || automation.model?.provider 
      },
      parameters: run.parameters || {},
      metrics: Array.isArray(run.metrics) ? run.metrics : [],
      metricsState: (run as any).metricsState || run.metrics?.reduce((acc: Record<string, boolean>, metric: string) => {
        acc[metric] = true;
        return acc;
      }, {} as Record<string, boolean>) || {},
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
      createdAt: run.startedAt || automation.createdAt,
      updatedAt: run.finishedAt || automation.createdAt,
    };

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
    
    // Track missing files for user feedback
    const missingFiles: string[] = [];
    if (evaluation.files?.sourceFileName && !files.some(f => f.type === 'source')) {
      missingFiles.push(`Source file: ${evaluation.files.sourceFileName}`);
    }
    if (evaluation.files?.referenceFileName && !files.some(f => f.type === 'reference')) {
      missingFiles.push(`Reference file: ${evaluation.files.referenceFileName}`);
    }
    if (evaluation.files?.promptFileName && !files.some(f => f.type === 'prompt')) {
      missingFiles.push(`Prompt file: ${evaluation.files.promptFileName}`);
    }
    
    // Create enhanced evaluation data with all loaded information
    const enhancedEvaluation = {
      ...evaluation,
      model: finalModel,
      loadedFiles: files,
      loadedPreset: preset,
      modelValidation: modelValidation,
      missingFiles: missingFiles,
      missingModel: modelValidation.missingModel,
      // Ensure metricsState is properly set
      metricsState: evaluation.metricsState || evaluation.metrics?.reduce((acc, metric) => {
        acc[metric] = true;
        return acc;
      }, {} as Record<string, boolean>) || {}
    };

    // Navigate to the appropriate page with the evaluation
    if (automation.type === "ocr") {
      navigate("/ocr", { 
        state: { 
          loadEvaluation: enhancedEvaluation,
          autoLoadFiles: true,
          autoLoadPreset: true,
          showFeedback: true
        } 
      });
    } else if (automation.type === "prompt") {
      navigate("/prompt", { 
        state: { 
          loadEvaluation: enhancedEvaluation,
          autoLoadFiles: true,
          autoLoadPreset: true,
          showFeedback: true
        } 
      });
    } else if (automation.type === "chat") {
      // For chat runs, we need to handle them differently since they're not evaluations
      // We'll navigate to chat and load the run data
      navigate("/chat", { 
        state: { 
          loadChatRun: {
            run: run,
            automation: automation,
            model: finalModel,
            loadedFiles: files,
            loadedPreset: preset,
            modelValidation: modelValidation,
            missingFiles: missingFiles,
            missingModel: modelValidation.missingModel
          }
        } 
      });
    }
    setSelectedAutomationSet(null);
  };

  const handleRunDetails = (automation: SavedAutomation, runIndex: number) => {
    setSelectedRun({ automation, runIndex });
  };

  // Import functionality for HomePage
  const handleImportClick = useCallback(() => {
    importFileRef?.click();
  }, [importFileRef]);

  const handleImport = useCallback(async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      console.log("HomePage - Importing data:", data);
      
      // Determine the type of data being imported
      if (data.type === 'automation' && Array.isArray(data.runs)) {
        // Import automation set
        console.log("HomePage - Importing automation set:", data.name);
        
        // Create a synthetic automation set
        const automationSet: AutomationSet = {
          setId: `imported_${Date.now()}`,
          name: data.name || 'Imported Automation',
          automations: [{
            id: crypto.randomUUID(),
            title: data.name || 'Imported Automation',
            name: data.name || 'Imported Automation',
            type: data.type || 'prompt',
            model: data.model || { id: 'unknown', provider: 'local' },
            runs: data.runs.map((run: any) => ({
              id: run.id || crypto.randomUUID(),
              runId: run.id || crypto.randomUUID(),
              runName: run.name || `Run ${Date.now()}`,
              prompt: run.prompt || '',
              parameters: run.parameters || data.defaultParameters || {},
              metrics: run.metrics || data.defaultMetrics || {},
              modelId: run.modelId || data.model?.id,
              modelProvider: run.modelProvider || data.model?.provider,
              sourceFileName: run.sourceFileName,
              promptFileName: run.promptFileName,
              referenceFileName: run.referenceFileName,
              presetTitle: run.presetTitle,
              status: 'pending',
              results: run.results,
              error: run.error,
              startedAt: run.startedAt || new Date().toISOString(),
              finishedAt: run.finishedAt,
            })),
            status: 'pending',
            createdAt: new Date().toISOString(),
            automationSetId: `imported_${Date.now()}`,
          }],
          evaluations: [],
          totalRuns: data.runs.length,
          successCount: 0,
          errorCount: 0,
          createdAt: new Date().toISOString(),
          lastRunAt: null,
          itemType: "automationSet" as const,
        };
        
        // Add to automation sets
        setAutomationSets(prev => [automationSet, ...prev]);
        
        // Show success message
        console.log("HomePage - Successfully imported automation set");
        
      } else if (data.type === 'evaluation' || data.type === 'prompt' || data.type === 'ocr') {
        // Import single evaluation
        console.log("HomePage - Importing evaluation:", data.title || data.name);
        
        const evaluation = {
          id: data.id || crypto.randomUUID(),
          type: data.type || 'prompt',
          title: data.title || data.name || 'Imported Evaluation',
          model: data.model || { id: 'unknown', provider: 'local' },
          parameters: data.parameters || {},
          metrics: data.metrics || [],
          metricsState: data.metricsState || {},
          usedText: data.usedText || {},
          files: data.files || {},
          results: data.results,
          startedAt: data.startedAt || new Date().toISOString(),
          finishedAt: data.finishedAt,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          itemType: "evaluation" as const,
        };
        
        // Add to evaluations
        setEvaluations(prev => [evaluation, ...prev]);
        
        // Show success message
        console.log("HomePage - Successfully imported evaluation");
        
      } else if (data.type === 'chat' || data.messages) {
        // Import chat
        console.log("HomePage - Importing chat:", data.title || data.name);
        
        const chat: SavedChat = {
          id: data.id || crypto.randomUUID(),
          title: data.title || data.name || 'Imported Chat',
          model: data.model || { id: 'unknown', provider: 'local' },
          parameters: data.parameters || { temperature: 0.7, max_tokens: 1024, top_p: 1.0, top_k: 40 },
          context: data.context || '',
          messagesSummary: data.messagesSummary || 'Imported chat',
          usedText: data.usedText || {},
          lastActivityAt: data.lastActivityAt || new Date().toISOString(),
        };
        
        // Add to chats
        setChats(prev => [chat, ...prev]);
        
        // Show success message
        console.log("HomePage - Successfully imported chat");
        
      } else {
        console.warn("HomePage - Unknown import data format:", data);
      }
      
      evt.target.value = '';
    } catch (e: any) {
      console.error('HomePage - Import failed:', e?.message ?? 'Could not import data');
    }
  }, []);

  const handleRunSingle = async (automation: SavedAutomation, runIndex: number) => {
    const run = automation.runs[runIndex];
    if (!run) return;

    // Create a single evaluation from the run with proper structure
    const evaluation = {
      id: run.id,
      type: automation.type === 'chat' ? 'prompt' : automation.type, // Convert chat to prompt for evaluation
      title: `${automation.name} - ${run.runName}`,
      model: { 
        id: run.model?.id || automation.model?.id, 
        provider: run.model?.provider || automation.model?.provider 
      },
      parameters: run.parameters || {},
      metrics: Array.isArray(run.metrics) ? run.metrics : [],
      metricsState: (run as any).metricsState || run.metrics?.reduce((acc: Record<string, boolean>, metric: string) => {
        acc[metric] = true;
        return acc;
      }, {} as Record<string, boolean>) || {},
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
      createdAt: run.startedAt || automation.createdAt,
      updatedAt: run.finishedAt || automation.createdAt,
    };

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
      modelValidation: modelValidation,
      // Ensure metricsState is properly set
      metricsState: evaluation.metricsState || evaluation.metrics?.reduce((acc, metric) => {
        acc[metric] = true;
        return acc;
      }, {} as Record<string, boolean>) || {}
    };

    // Navigate to the appropriate page with the evaluation and autoRun flag
    if (automation.type === "ocr") {
      navigate("/ocr", { 
        state: { 
          loadEvaluation: enhancedEvaluation,
          autoLoadFiles: true,
          autoLoadPreset: true,
          autoRun: true
        } 
      });
    } else if (automation.type === "prompt") {
      navigate("/prompt", { 
        state: { 
          loadEvaluation: enhancedEvaluation,
          autoLoadFiles: true,
          autoLoadPreset: true,
          autoRun: true
        } 
      });
    } else if (automation.type === "chat") {
      navigate("/chat", { state: { loadChat: enhancedEvaluation, autoRun: true } });
    }
    setSelectedAutomationSet(null);
  };

  const handleDelete = async (item: SavedEvaluation | SavedChat | SavedAutomation | { setId: string, name: string, automations: SavedAutomation[], evaluations: SavedEvaluation[], totalRuns: number, successCount: number, errorCount: number, createdAt: string, lastRunAt: string | null, itemType: "automationSet" }) => {
    setDeleteConfirmItem(item as Item);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    
    try {
      if ("itemType" in deleteConfirmItem && deleteConfirmItem.itemType === "automationSet") {
        // Delete all automations in the set
        for (const automation of (deleteConfirmItem as AutomationSet).automations) {
          await historyService.deleteAutomation(automation.id);
        }
        // Delete all evaluations in the set
        for (const evaluation of (deleteConfirmItem as AutomationSet).evaluations) {
          await historyService.deleteEvaluation(evaluation.id);
        }
      } else if ("type" in deleteConfirmItem && !("runs" in deleteConfirmItem)) {
        // It's an evaluation
        await historyService.deleteEvaluation((deleteConfirmItem as SavedEvaluation).id);
      } else if (deleteConfirmItem.itemType === "chat") {
        // It's a chat
        await historyService.deleteChat((deleteConfirmItem as SavedChat).id);
      } else {
        // It's an evaluation
        await historyService.deleteEvaluation((deleteConfirmItem as SavedEvaluation).id);
      }
      
      // Refresh the data by reloading the page
      window.location.reload();
      setSelectedItem(null);
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setDeleteConfirmItem(null);
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
        background: "rgba(30, 41, 59, 0.8)",
        border: "1px solid rgba(51, 65, 85, 0.5)",
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 12,
        color: "#e2e8f0",
        fontWeight: 600,
        backdropFilter: "blur(8px)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        minWidth: "fit-content",
        maxWidth: "40px"
      }}
    >
      {label}: {typeof value === "number" ? `${Math.round(value * 100) / 100}` : "N/A"}
    </span>
  );

  return (
    <ErrorBoundary>
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
              {/* Toggle Hidden Cards Button */}
              <button
                onClick={toggleShowHiddenCards}
                aria-label={showHiddenCards ? "Hide hidden cards" : "Show hidden cards"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  background: showHiddenCards 
                    ? "linear-gradient(135deg, #f59e0b, #d97706)" 
                    : "linear-gradient(135deg, #6b7280, #4b5563)",
                  border: "none",
                  borderRadius: 8,
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
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
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                >
                  {showHiddenCards ? (
                    <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                  ) : (
                    <path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,17.14 12.79,17.7 12,18.16C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5C13.55,4.5 15.03,4.9 16.3,5.6L14.8,7.1C13.85,6.5 12.95,6.2 12,6.2A5.8,5.8 0 0,0 6.2,12A5.8,5.8 0 0,0 12,17.8A5.8,5.8 0 0,0 17.8,12C17.8,11.05 17.5,10.15 16.9,9.2L18.4,7.7C19.1,8.97 19.5,10.45 19.5,12C19.5,16.39 15.39,19.5 11,19.5C6.61,19.5 2.5,16.39 2.5,12C2.5,7.61 6.61,4.5 11,4.5C12.55,4.5 14.03,4.9 15.3,5.6L13.8,7.1C12.85,6.5 11.95,6.2 11,6.2A5.8,5.8 0 0,0 5.2,12A5.8,5.8 0 0,0 11,17.8A5.8,5.8 0 0,0 17.8,12C17.8,11.05 17.5,10.15 16.9,9.2L18.4,7.7C19.1,8.97 19.5,10.45 19.5,12C19.5,16.39 15.39,19.5 11,19.5C6.61,19.5 2.5,16.39 2.5,12C2.5,7.61 6.61,4.5 11,4.5Z"/>
                  )}
                </svg>
                {showHiddenCards ? "Hide Cards" : "Show Hidden"}
              </button>
              
              {/* Refresh Button */}
              <button
                onClick={loadData}
                disabled={dataLoading.isLoading}
                aria-label={dataLoading.isLoading ? "Refreshing data..." : "Refresh data"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  background: dataLoading.isLoading 
                    ? "#6b7280" 
                    : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  border: "none",
                  borderRadius: 8,
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: dataLoading.isLoading ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                }}
                onMouseEnter={(e) => {
                  if (!dataLoading.isLoading) {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!dataLoading.isLoading) {
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
                    animation: dataLoading.isLoading ? "spin 1s linear infinite" : "none"
                  }}
                >
                  <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                </svg>
                {dataLoading.isLoading ? "Refreshing..." : "Refresh"}
              </button>
              
              {showApiConnections.groq && (
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
              )}
              
              {showApiConnections.ollama && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8,
                  padding: "12px 16px", 
                  background: ollamaConnected ? "#0f172a" : "#0f172a", 
                  border: ollamaConnected ? "1px solid #10b981" : "1px solid #ef4444",
                  borderRadius: 12,
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                }}>
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: "50%", 
                    background: ollamaConnected ? "#10b981" : "#ef4444",
                    boxShadow: ollamaConnected ? "0 0 8px rgba(16, 185, 129, 0.5)" : "0 0 8px rgba(239, 68, 68, 0.5)"
                  }} />
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: ollamaConnected ? "#10b981" : "#ef4444" 
                  }}>
                    Ollama API: {ollamaConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              )}
              
              {showApiConnections.lmstudio && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8,
                  padding: "12px 16px", 
                  background: lmstudioConnected ? "#0f172a" : "#0f172a", 
                  border: lmstudioConnected ? "1px solid #10b981" : "1px solid #ef4444",
                  borderRadius: 12,
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                }}>
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: "50%", 
                    background: lmstudioConnected ? "#10b981" : "#ef4444",
                    boxShadow: lmstudioConnected ? "0 0 8px rgba(16, 185, 129, 0.5)" : "0 0 8px rgba(239, 68, 68, 0.5)"
                  }} />
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: lmstudioConnected ? "#10b981" : "#ef4444" 
                  }}>
                    LM Studio: {lmstudioConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              )}
              
              {showApiConnections.huggingface && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8,
                  padding: "12px 16px", 
                  background: huggingfaceConnected ? "#0f172a" : "#0f172a", 
                  border: huggingfaceConnected ? "1px solid #10b981" : "1px solid #ef4444",
                  borderRadius: 12,
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                }}>
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: "50%", 
                    background: huggingfaceConnected ? "#10b981" : "#ef4444",
                    boxShadow: huggingfaceConnected ? "0 0 8px rgba(16, 185, 129, 0.5)" : "0 0 8px rgba(239, 68, 68, 0.5)"
                  }} />
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: huggingfaceConnected ? "#10b981" : "#ef4444" 
                  }}>
                    Hugging Face: {huggingfaceConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              )}
              
              {showApiConnections.ollamaLocal && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8,
                  padding: "12px 16px", 
                  background: ollamaConnected ? "#0f172a" : "#0f172a", 
                  border: ollamaConnected ? "1px solid #10b981" : "1px solid #ef4444",
                  borderRadius: 12,
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                }}>
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: "50%", 
                    background: ollamaConnected ? "#10b981" : "#ef4444",
                    boxShadow: ollamaConnected ? "0 0 8px rgba(16, 185, 129, 0.5)" : "0 0 8px rgba(239, 68, 68, 0.5)"
                  }} />
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: ollamaConnected ? "#10b981" : "#ef4444" 
                  }}>
                    Ollama Local: {ollamaConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              )}
              
              {showApiConnections.vllm && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8,
                  padding: "12px 16px", 
                  background: "#0f172a", 
                  border: "1px solid #ef4444",
                  borderRadius: 12,
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
                }}>
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: "50%", 
                    background: "#ef4444",
                    boxShadow: "0 0 8px rgba(239, 68, 68, 0.5)"
                  }} />
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: "#ef4444" 
                  }}>
                    vLLM: Not Connected
                  </span>
                </div>
              )}
              
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main 
          role="main" 
          aria-label="Home page content"
          style={{ overflow: "auto", padding: "32px" }}
        >
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
                  aria-label="Search projects, models, and evaluations"
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
              
              {/* Import Button */}
              <div style={{ position: "relative" }}>
                <input
                  type="file"
                  accept="application/json"
                  ref={setImportFileRef}
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={handleImportClick}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#ffffff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                  Import
                </button>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 8 }}>
              {/* Recency Sort Filter */}
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => setRecencySort("most-recent")}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: recencySort === "most-recent" 
                      ? "linear-gradient(135deg, #f59e0b, #d97706)" 
                      : "#1e293b",
                    color: recencySort === "most-recent" ? "#ffffff" : "#e2e8f0",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: recencySort === "most-recent" ? "0 2px 4px rgba(0, 0, 0, 0.1)" : "none"
                  }}
                  onMouseEnter={(e) => {
                    if (recencySort !== "most-recent") {
                      e.currentTarget.style.background = "#334155";
                      e.currentTarget.style.borderColor = "#475569";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (recencySort !== "most-recent") {
                      e.currentTarget.style.background = "#1e293b";
                      e.currentTarget.style.borderColor = "#334155";
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7,14H5V10H7M11,14H9V6H11M15,14H13V2H15M19,14H17V8H19V14Z"/>
                  </svg>
                  Most Recent
                </button>
                <button
                  onClick={() => setRecencySort("least-recent")}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: recencySort === "least-recent" 
                      ? "linear-gradient(135deg, #f59e0b, #d97706)" 
                      : "#1e293b",
                    color: recencySort === "least-recent" ? "#ffffff" : "#e2e8f0",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: recencySort === "least-recent" ? "0 2px 4px rgba(0, 0, 0, 0.1)" : "none"
                  }}
                  onMouseEnter={(e) => {
                    if (recencySort !== "least-recent") {
                      e.currentTarget.style.background = "#334155";
                      e.currentTarget.style.borderColor = "#475569";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (recencySort !== "least-recent") {
                      e.currentTarget.style.background = "#1e293b";
                      e.currentTarget.style.borderColor = "#334155";
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7,14H5V2H7M11,14H9V6H11M15,14H13V10H15M19,14H17V8H19V14Z"/>
                  </svg>
                  Least Recent
                </button>
              </div>

              {/* Provider Filters */}
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

          {/* Modern Cards Grid - Masonry Style */}
          <div style={{ 
            columnCount: "auto",
            columnWidth: "320px",
            columnGap: "16px",
            breakInside: "avoid"
          }}>
            {dataLoading.error && (
              <div style={{ 
                color: "#ef4444", 
                padding: 24, 
                textAlign: "center",
                background: "#0f172a",
                border: "1px solid #ef4444",
                borderRadius: 12,
                margin: "16px 0"
              }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#ef4444" }}>
                  Failed to Load Data
                </h3>
                <p style={{ margin: "0 0 16px 0", color: "#94a3b8" }}>
                  {dataLoading.error}
                </p>
                <button
                  onClick={dataLoading.retry}
                  style={{
                    padding: "8px 16px",
                    background: "#ef4444",
                    border: "none",
                    borderRadius: 6,
                    color: "#ffffff",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  Try Again
                </button>
              </div>
            )}
            {dataLoading.isLoading && (
              <div style={{ 
                color: "#94a3b8", 
                padding: 48, 
                textAlign: "center",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 16,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                width: "100%",
                marginBottom: "16px",
                breakInside: "avoid"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>Loading projects...</span>
                </div>
              </div>
            )}
            {dataLoading.error && (
              <div style={{ 
                color: "#ef4444", 
                padding: 48, 
                textAlign: "center",
                background: "#0f172a",
                border: "1px solid #ef4444",
                borderRadius: 16,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                width: "100%",
                marginBottom: "16px",
                breakInside: "avoid"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2C17.5,2 22,6.5 22,12S17.5,22 12,22 2,17.5 2,12 6.5,2 12,2M12,20C16.4,20 20,16.4 20,12S16.4,4 12,4 4,7.6 4,12 7.6,20 12,20M11,7H13V9H11V7M11,11H13V17H11V11Z"/>
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>{dataLoading.error}</span>
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
            {!dataLoading.isLoading && !dataLoading.error && filtered.length === 0 && (
              <div style={{ 
                color: "#94a3b8", 
                padding: 48, 
                textAlign: "center",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 16,
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                width: "100%",
                marginBottom: "16px",
                breakInside: "avoid"
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

            {!dataLoading.isLoading && !dataLoading.error &&
              filtered.map((item) => {
                const isEval = item.itemType === "evaluation";
                const isChat = item.itemType === "chat";
                const isAutomationSet = item.itemType === "automationSet";
                const itemId = isAutomationSet ? (item as AutomationSet).setId : item.id;
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
                const hasError = isEval && (!metrics || Object.keys(metrics).length === 0);

                return (
                  <article
                    key={itemId}
                    onClick={() => {
                      if (item.itemType === "automationSet") {
                        setSelectedAutomationSet(item);
                      } else {
                        setSelectedItem(item);
                      }
                    }}
                    style={{
                      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                      border: hasError ? "2px solid #ef4444" : "1px solid #334155",
                      borderRadius: 20,
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: hasError 
                        ? "0 8px 32px rgba(239, 68, 68, 0.15), 0 0 0 1px rgba(239, 68, 68, 0.1)" 
                        : "0 4px 20px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1)",
                      overflow: "hidden",
                      position: "relative",
                      height: "fit-content",
                      minHeight: isChat ? "280px" : "400px",
                      width: "100%",
                      marginBottom: "16px",
                      breakInside: "avoid"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                      e.currentTarget.style.boxShadow = hasError 
                        ? "0 12px 40px rgba(239, 68, 68, 0.2), 0 0 0 1px rgba(239, 68, 68, 0.15)" 
                        : "0 8px 32px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)";
                      e.currentTarget.style.borderColor = hasError ? "#ef4444" : "#475569";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow = hasError 
                        ? "0 8px 32px rgba(239, 68, 68, 0.15), 0 0 0 1px rgba(239, 68, 68, 0.1)" 
                        : "0 4px 20px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1)";
                      e.currentTarget.style.borderColor = hasError ? "#ef4444" : "#334155";
                    }}
                  >
                    {/* Error Indicator */}
                    {hasError && (
                      <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: "linear-gradient(90deg, #ef4444, #dc2626)",
                        zIndex: 1
                      }} />
                    )}

                    {/* Hide Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardVisibility(itemId);
                      }}
                      style={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: hiddenCards.has(itemId) 
                          ? "rgba(239, 68, 68, 0.8)" 
                          : "rgba(0, 0, 0, 0.6)",
                        border: hiddenCards.has(itemId) 
                          ? "1px solid #ef4444" 
                          : "1px solid rgba(255, 255, 255, 0.2)",
                        color: hiddenCards.has(itemId) 
                          ? "#ffffff" 
                          : "#94a3b8",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                        zIndex: 2,
                        backdropFilter: "blur(8px)"
                      }}
                      onMouseEnter={(e) => {
                        if (hiddenCards.has(itemId)) {
                          e.currentTarget.style.background = "rgba(16, 185, 129, 0.8)";
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.borderColor = "#10b981";
                        } else {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.8)";
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.borderColor = "#ef4444";
                        }
                        e.currentTarget.style.transform = "scale(1.1)";
                      }}
                      onMouseLeave={(e) => {
                        if (hiddenCards.has(itemId)) {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.8)";
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.borderColor = "#ef4444";
                        } else {
                          e.currentTarget.style.background = "rgba(0, 0, 0, 0.6)";
                          e.currentTarget.style.color = "#94a3b8";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                        }
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,17.14 12.79,17.7 12,18.16C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5C13.55,4.5 15.03,4.9 16.3,5.6L14.8,7.1C13.85,6.5 12.95,6.2 12,6.2A5.8,5.8 0 0,0 6.2,12A5.8,5.8 0 0,0 12,17.8A5.8,5.8 0 0,0 17.8,12C17.8,11.05 17.5,10.15 16.9,9.2L18.4,7.7C19.1,8.97 19.5,10.45 19.5,12C19.5,16.39 15.39,19.5 11,19.5C6.61,19.5 2.5,16.39 2.5,12C2.5,7.61 6.61,4.5 11,4.5Z"/>
                      </svg>
                    </button>

                    {/* Enhanced Header */}
                    <div style={{ 
                      padding: "24px 24px 20px", 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "flex-start",
                      gap: 16,
                      borderBottom: "1px solid rgba(51, 65, 85, 0.3)",
                      background: "linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          width: 48, 
                          height: 48, 
                          borderRadius: 14, 
                          background: hasError 
                            ? "linear-gradient(135deg, #ef4444, #dc2626)" 
                            : isEval 
                            ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                            : isAutomationSet 
                            ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                            : "linear-gradient(135deg, #10b981, #059669)", 
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: hasError 
                            ? "0 8px 24px rgba(239, 68, 68, 0.4)" 
                            : isEval 
                            ? "0 8px 24px rgba(59, 130, 246, 0.4)" 
                            : isAutomationSet 
                            ? "0 8px 24px rgba(139, 92, 246, 0.4)"
                            : "0 8px 24px rgba(16, 185, 129, 0.4)",
                          position: "relative"
                        }}>
                          {hasError ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                              <path d="M12,2C17.5,2 22,6.5 22,12S17.5,22 12,22 2,17.5 2,12 6.5,2 12,2M12,20C16.4,20 20,16.4 20,12S16.4,4 12,4 4,7.6 4,12 7.6,20 12,20M11,7H13V9H11V7M11,11H13V17H11V11Z"/>
                            </svg>
                          ) : isEval ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                          ) : isAutomationSet ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                              <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                            </svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                              <path d="M12,3C17.5,3 22,6.58 22,11C22,15.42 17.5,19 12,19C10.76,19 9.57,18.82 8.47,18.5C7.55,20.1 5.68,21 3.5,21C3.25,21 3,20.75 3,20.5V20.5C3,18.83 4.15,17.5 5.7,17.5C4.15,16.5 3,14.83 3,13C3,8.58 7.5,5 12,5Z"/>
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: "#e2e8f0",
                              marginBottom: 6,
                              textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)"
                            }}
                            title={isAutomationSet ? (item as AutomationSet).name : item.title}
                          >
                            {isAutomationSet ? (item as AutomationSet).name : item.title}
                          </div>
                          <div style={{ 
                            color: "#94a3b8", 
                            fontSize: 14,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontWeight: 500
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
                      {hasError && (
                        <div style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 12px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: "#ef4444"
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2C17.5,2 22,6.5 22,12S17.5,22 12,22 2,17.5 2,12 6.5,2 12,2M12,20C16.4,20 20,16.4 20,12S16.4,4 12,4 4,7.6 4,12 7.6,20 12,20M11,7H13V9H11V7M11,11H13V17H11V11Z"/>
                          </svg>
                          Error
                        </div>
                      )}
                    </div>

                    {/* Enhanced Tags */}
                    <div style={{ 
                      display: "flex", 
                      gap: 10, 
                      flexWrap: "wrap", 
                      padding: "20px 24px",
                      borderBottom: "1px solid rgba(51, 65, 85, 0.3)"
                    }}>
                      <span style={{
                        ...tagStyle,
                        background: hasError 
                          ? "linear-gradient(135deg, #ef4444, #dc2626)" 
                          : isEval 
                          ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                          : isAutomationSet 
                          ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                          : "linear-gradient(135deg, #10b981, #059669)",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                        padding: "8px 16px",
                        borderRadius: 12,
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)"
                      }}>
                        {hasError ? "ERROR" : isEval ? (item as SavedEvaluation).type?.toUpperCase() : isAutomationSet ? "AUTOMATION SET" : "CHAT"}
                      </span>
                      {!isAutomationSet && (
                        <>
                          <span style={{
                            ...tagStyle,
                            background: "rgba(30, 41, 59, 0.8)",
                            borderColor: "#475569",
                            color: "#e2e8f0",
                            fontWeight: 600,
                            padding: "6px 12px",
                            borderRadius: 10
                          }}>
                            {modelId}
                          </span>
                          <span style={{
                            ...tagStyle,
                            background: provider === "groq" ? "rgba(16, 185, 129, 0.1)" : "rgba(59, 130, 246, 0.1)",
                            borderColor: provider === "groq" ? "#10b981" : "#3b82f6",
                            color: provider === "groq" ? "#10b981" : "#3b82f6",
                            fontWeight: 700,
                            padding: "6px 12px",
                            borderRadius: 10
                          }}>
                            {String(provider).toUpperCase()}
                          </span>
                        </>
                      )}
                      {isAutomationSet && (
                        <>
                          <span style={{
                            ...tagStyle,
                            background: "rgba(30, 41, 59, 0.8)",
                            borderColor: "#475569",
                            color: "#e2e8f0",
                            fontWeight: 600,
                            padding: "6px 12px",
                            borderRadius: 10
                          }}>
                            {(item as AutomationSet).totalRuns} runs
                          </span>
                          {/* Show unique models used */}
                          {(() => {
                            const automationSet = item as AutomationSet;
                            const uniqueModels = new Set();
                            automationSet.automations.forEach(automation => {
                              if (automation.model?.id) {
                                uniqueModels.add(automation.model.id);
                              }
                              automation.runs?.forEach(run => {
                                if (run.modelId) {
                                  uniqueModels.add(run.modelId);
                                }
                              });
                            });
                            const modelArray = Array.from(uniqueModels);
                            return modelArray.slice(0, 2).map((modelId, index) => (
                              <span key={index} style={{
                                ...tagStyle,
                                background: "rgba(30, 41, 59, 0.8)",
                                borderColor: "#475569",
                                color: "#e2e8f0",
                                fontWeight: 600,
                                padding: "6px 12px",
                                borderRadius: 10
                              }}>
                                {String(modelId)}
                              </span>
                            ));
                          })()}
                          {/* Show provider if available */}
                          {(() => {
                            const automationSet = item as AutomationSet;
                            const providers = new Set();
                            automationSet.automations.forEach(automation => {
                              if (automation.model?.provider) {
                                providers.add(automation.model.provider);
                              }
                            });
                            const providerArray = Array.from(providers);
                            return providerArray.slice(0, 1).map((provider, index) => (
                              <span key={index} style={{
                                ...tagStyle,
                                background: provider === "groq" ? "rgba(16, 185, 129, 0.1)" : "rgba(59, 130, 246, 0.1)",
                                borderColor: provider === "groq" ? "#10b981" : "#3b82f6",
                                color: provider === "groq" ? "#10b981" : "#3b82f6",
                                fontWeight: 700,
                                padding: "6px 12px",
                                borderRadius: 10,
                              }}>
                                {String(provider).toUpperCase()}
                              </span>
                            ));
                          })()}
                        </>
                      )}
                      {isChat && (
                        <>
                          <span style={{
                            ...tagStyle,
                            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                            borderColor: "#3b82f6",
                            color: "#ffffff",
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 8,
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "24px", 
                            maxHeight: "28px", 
                            maxWidth: "120px" 
                            

                          }}>
                            {(item as SavedChat).usedText?.chatHistory?.length || 0} messages
                          </span>
                        </>
                      )}
                    </div>

                    {/* Enhanced Metrics (eval only) */}
                    {isEval && (
                      <div style={{ 
                        padding: "20px 24px",
                        borderBottom: "1px solid rgba(51, 65, 85, 0.3)"
                      }}>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", 
                          gap: 16,
                          marginBottom: 16
                        }}>
                          {/* Dynamic metrics based on what's actually available */}
                          {metrics && Object.keys(metrics).length > 0 ? (
                            Object.entries(metrics).slice(0, 6).map(([metricName, metricValue]) => (
                              pill(metricName.toUpperCase(), typeof metricValue === "number" ? metricValue : undefined)
                            ))
                          ) : (
                            // Fallback to common metrics if no results available
                            <>
                              {pill("ROUGE", rouge)}
                              {pill("BLEU", bleu)}
                              {pill("F1", f1)}
                            </>
                          )}
                        </div>
                        
                        {/* Dynamic parameter tags for evaluations */}
                        {(item as SavedEvaluation).parameters && Object.keys((item as SavedEvaluation).parameters).length > 0 && (
                          <div style={{ 
                            display: "flex", 
                            gap: 8, 
                            flexWrap: "wrap",
                            marginTop: 12
                          }}>
                            <span style={{
                              fontSize: 12,
                              color: "#94a3b8",
                              fontWeight: 600,
                              marginBottom: 4,
                              width: "100%",
                              
                            }}>
                              Parameters:
                            </span>
                            {Object.entries((item as SavedEvaluation).parameters).slice(0, 4).map(([key, value]) => (
                              <span key={key} style={{
                                ...tagStyle,
                                background: "rgba(30, 41, 59, 0.6)",
                                borderColor: "#475569",
                                color: "#e2e8f0",
                                fontWeight: 500,
                                padding: "3px 6px",
                                borderRadius: 6,
                                fontSize: 10,
                                maxWidth: "120px"
                              }}>
                                {key}: {String(value).length > 6 ? String(value).substring(0, 6) + '...' : String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Additional metrics if there are more than 6 metrics */}
                        {metrics && Object.keys(metrics).length > 6 && (
                          <div style={{ 
                            display: "flex", 
                            gap: 8, 
                            flexWrap: "wrap",
                            marginTop: 12
                          }}>
                            <span style={{
                              fontSize: 12,
                              color: "#94a3b8",
                              fontWeight: 600,
                              marginBottom: 4,
                              width: "100%"
                            }}>
                              Additional Metrics:
                            </span>
                            {Object.entries(metrics).slice(6, 10).map(([key, value]) => (
                              <span key={key} style={{
                                ...tagStyle,
                                background: "rgba(59, 130, 246, 0.1)",
                                borderColor: "#3b82f6",
                                color: "#3b82f6",
                                fontWeight: 500,
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontSize: 10,
                                maxWidth: "120px"
                              }}>
                                {key}: {typeof value === "number" ? Math.round(value * 100) / 100 : String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Enhanced Automation Set Summary */}
                    {isAutomationSet && (
                      <div style={{ 
                        padding: "20px 24px",
                        borderBottom: "1px solid rgba(51, 65, 85, 0.3)"
                      }}>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "1fr 1fr", 
                          gap: 16,
                          marginBottom: 16
                        }}>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "12px 16px",
                            background: "rgba(30, 41, 59, 0.6)",
                            borderRadius: 12,
                            border: "1px solid rgba(51, 65, 85, 0.5)",
                            backdropFilter: "blur(8px)"
                          }}>
                            <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Automations</span>
                            <span style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 700 }}>
                              {(item as AutomationSet).automations.length}
                            </span>
                          </div>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "12px 16px",
                            background: "rgba(30, 41, 59, 0.6)",
                            borderRadius: 12,
                            border: "1px solid rgba(51, 65, 85, 0.5)",
                            backdropFilter: "blur(8px)"
                          }}>
                            <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Total Runs</span>
                            <span style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 700 }}>
                              {(item as AutomationSet).totalRuns}
                            </span>
                          </div>
                        </div>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "1fr 1fr", 
                          gap: 16
                        }}>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "12px 16px",
                            background: "rgba(16, 185, 129, 0.1)",
                            borderRadius: 12,
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            backdropFilter: "blur(8px)"
                          }}>
                            <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>Success</span>
                            <span style={{ fontSize: 16, color: "#10b981", fontWeight: 700 }}>
                              {(item as AutomationSet).successCount}
                            </span>
                          </div>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            padding: "12px 16px",
                            background: "rgba(239, 68, 68, 0.1)",
                            borderRadius: 12,
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            backdropFilter: "blur(8px)"
                          }}>
                            <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>Errors</span>
                            <span style={{ fontSize: 16, color: "#ef4444", fontWeight: 700 }}>
                              {(item as AutomationSet).errorCount}
                            </span>
                          </div>
                        </div>
                        {(item as AutomationSet).automations.length > 0 && (
                          <>
                            <div style={{ 
                              marginTop: 16,
                              padding: "12px 16px",
                              background: "rgba(30, 41, 59, 0.6)",
                              borderRadius: 12,
                              border: "1px solid rgba(51, 65, 85, 0.5)",
                              backdropFilter: "blur(8px)"
                            }}>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
                                Latest Automation Type
                              </div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 700 }}>
                                {(item as AutomationSet).automations[0]?.type?.toUpperCase() || 'UNKNOWN'}
                              </div>
                            </div>
                            
                            {/* Dynamic automation details - show when space allows */}
                            <div style={{ 
                              marginTop: 12,
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap"
                            }}>
                              {(item as AutomationSet).automations.slice(0, 3).map((automation, index) => (
                                <span key={index} style={{
                                  ...tagStyle,
                                  background: "rgba(139, 92, 246, 0.1)",
                                  borderColor: "#8b5cf6",
                                  color: "#8b5cf6",
                                  fontWeight: 500,
                                  padding: "3px 6px",
                                  borderRadius: 6,
                                  fontSize: 10,
                                  maxWidth: "70px"
                                }}>
                                  {automation.type?.toUpperCase() || 'UNKNOWN'}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Enhanced Footer Actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "20px 24px",
                        background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%)",
                        borderTop: "1px solid rgba(51, 65, 85, 0.3)",
                        backdropFilter: "blur(8px)",
                        marginTop: "auto"
                      }}
                    >
                      
                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log("HomePage - Load button clicked");
                            console.log("HomePage - isAutomationSet:", isAutomationSet);
                            console.log("HomePage - item:", item);
                            if (isAutomationSet) {
                              console.log("HomePage - Calling handleAutomationSetLoad");
                              handleAutomationSetLoad(item);
                            } else {
                              console.log("HomePage - Calling handleLoad");
                              handleLoad(item);
                            }
                          }}
                          style={{
                            padding: "10px 20px",
                            borderRadius: 12,
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                            color: "#ffffff",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 20px rgba(59, 130, 246, 0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                          </svg>
                          Load
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAutomationSet) {
                              handleAutomationSetRun(item);
                            } else {
                              handleRun(item);
                            }
                          }}
                          style={{
                            padding: "10px 20px",
                            borderRadius: 12,
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            background: "linear-gradient(135deg, #10b981, #059669)",
                            color: "#ffffff",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                          </svg>
                          Run
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 12,
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                            color: "#ffffff",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 20px rgba(239, 68, 68, 0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
              <span>Tip: Use presets to keep evaluations reproducible across evaluations.</span>
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
          onRunSingle={handleRunSingle}
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
          onRunSingle={handleRunSingle}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(8px)"
          }}
          onClick={() => setDeleteConfirmItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              border: "1px solid #334155",
              borderRadius: 20,
              padding: 32,
              maxWidth: 500,
              width: "90%",
              color: "#e2e8f0",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(20px)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(239, 68, 68, 0.4)"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M12,2C17.5,2 22,6.5 22,12S17.5,22 12,22 2,17.5 2,12 6.5,2 12,2M12,20C16.4,20 20,16.4 20,12S16.4,4 12,4 4,7.6 4,12 7.6,20 12,20M11,7H13V9H11V7M11,11H13V17H11V11Z"/>
                </svg>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#e2e8f0" }}>
                  Confirm Deletion
                </h2>
                <p style={{ margin: "8px 0 0 0", color: "#94a3b8", fontSize: 16 }}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <p style={{ margin: 0, fontSize: 16, color: "#e2e8f0", lineHeight: 1.5 }}>
                Are you sure you want to delete{" "}
                <strong style={{ color: "#f59e0b" }}>
                  {deleteConfirmItem.itemType === "automationSet" 
                    ? (deleteConfirmItem as AutomationSet).name 
                    : deleteConfirmItem.title}
                </strong>?
              </p>
              {deleteConfirmItem.itemType === "automationSet" && (
                <div style={{ 
                  marginTop: 16, 
                  padding: 16, 
                  background: "rgba(239, 68, 68, 0.1)", 
                  borderRadius: 12, 
                  border: "1px solid rgba(239, 68, 68, 0.3)" 
                }}>
                  <p style={{ margin: 0, fontSize: 14, color: "#ef4444", fontWeight: 600 }}>
                    ⚠️ This will also delete all associated automations and evaluations in this set.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteConfirmItem(null)}
                style={{
                  padding: "12px 24px",
                  borderRadius: 12,
                  border: "1px solid #334155",
                  background: "#1e293b",
                  color: "#e2e8f0",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#334155";
                  e.currentTarget.style.borderColor = "#475569";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#1e293b";
                  e.currentTarget.style.borderColor = "#334155";
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: "12px 24px",
                  borderRadius: 12,
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(239, 68, 68, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

const tagStyle: React.CSSProperties = {
  border: "1px solid #334155",
  padding: "6px 12px",
  borderRadius: 6,
  background: "#1e293b",
  fontSize: 11,
  color: "#e2e8f0",
  fontWeight: 500,
  transition: "all 0.2s ease",
  maxHeight: "30px",
  display: "inline-flex",
  alignItems: "center",
  lineHeight: 1
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

