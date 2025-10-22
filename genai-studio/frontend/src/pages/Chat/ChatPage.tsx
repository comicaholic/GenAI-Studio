// src/pages/Chat/ChatPage.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import LayoutShell from "@/components/Layout/LayoutShell";

import FileDrop from "@/components/FileDrop/FileDrop";
import ExpandableTextarea from "@/components/ExpandableTextarea/ExpandableTextarea";
import PresetManager from "@/components/PresetPanel/PresetManager";
import ParamsPanel, { ModelParams } from "@/components/RightPanel/ParamsPanel";
import { chatComplete } from "@/services/llm";
import LoadingButton from "@/components/ui/LoadingButton";
import Bounce from "@/components/ui/Bounce";
import { useModel } from "@/context/ModelContext";
import { chatPresetStore, Preset } from "@/stores/presetStore";
import { useNotifications } from "@/components/Notification/Notification";
import { useBackgroundState } from "@/stores/backgroundState";
import { historyService } from "@/services/history";
import ChatAutomationModal, { ChatAutomationConfig } from "@/components/ChatAutomationModal/ChatAutomationModal";
import { automationStore } from "@/stores/automationStore";
import AutomationProgressIndicator from "@/components/AutomationProgress/AutomationProgressIndicator";
import AutomationProgressModal from "@/components/AutomationProgress/AutomationProgressModal";
import { api } from "@/services/api";

const DEFAULT_PARAMS: ModelParams = { temperature: 0.7, max_tokens: 1024, top_p: 1.0, top_k: 40 };

type UsageMeta = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  firstTokenMs?: number; // ms to first token
  elapsedMs?: number; // total elapsed time in ms
  stopReason?: string;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO to simplify serialization
  files?: { name: string; size?: number }[]; // don't store File objects in storage
  meta?: UsageMeta;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  lastActivityAt?: string;
  modelId?: string;
  modelProvider?: string;
  parameters?: ModelParams;
  context?: string;
}

const STORAGE_KEY = "app:chat:sessions_v1";

export default function ChatPage() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [contextPrompt, setContextPrompt] = useState("");
  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS);
  const [activeRightTab, setActiveRightTab] = useState<"context" | "parameters">("context");

  // Handle preset changes - update both context and parameters
  const handlePresetChange = useCallback((preset: { title: string; body: string; id: string; parameters?: Preset['parameters']; metrics?: any }) => {
    if (preset.body !== undefined) {
      setContextPrompt(preset.body);
    }
    if (preset.parameters) {
      setParams(prev => ({
        ...prev,
        ...preset.parameters
      }));
    }
  }, []);

  // Handle tab switching - preserve current content
  const handleTabSwitch = useCallback((newTab: "context" | "parameters") => {
    // Save current session parameters before switching tabs
    if (currentSessionId) {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          context: contextPrompt,
          parameters: params,
        };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? updatedSession : s));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.map(s => s.id === currentSessionId ? updatedSession : s)));
      }
    }
    setActiveRightTab(newTab);
  }, [currentSessionId, sessions, contextPrompt, params]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const { selected } = useModel();
  const { showError, showSuccess } = useNotifications();
  const { addOperation, updateOperation } = useBackgroundState();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Automation state
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [isAutomationProgressModalOpen, setIsAutomationProgressModalOpen] = useState(false);
  const [automationResults, setAutomationResults] = useState<Record<string, any>>({});

  // load sessions from localStorage and history service on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        // First try to load from localStorage (for immediate display)
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatSession[];
          setSessions(parsed);
          if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
        }

        // Then load from history service to get the latest data
        try {
          const historyChats = await historyService.getChats();
          if (historyChats.length > 0) {
            // Convert SavedChat to ChatSession format
            const convertedSessions: ChatSession[] = historyChats.map(chat => ({
              id: chat.id,
              title: chat.title,
              messages: chat.usedText?.chatHistory?.map((msg, index) => ({
                id: `${chat.id}-${index}`,
                role: msg.role as "user" | "assistant",
                content: msg.content,
                timestamp: chat.lastActivityAt || new Date().toISOString(),
              })) || [],
              createdAt: chat.lastActivityAt || new Date().toISOString(),
              lastActivityAt: chat.lastActivityAt,
              modelId: chat.model.id,
              modelProvider: chat.model.provider,
              parameters: (chat.parameters as ModelParams) || DEFAULT_PARAMS,
              context: chat.context,
            }));

            setSessions(convertedSessions);
            if (convertedSessions.length > 0 && !currentSessionId) {
              setCurrentSessionId(convertedSessions[0].id);
            }
          }
        } catch (e) {
          console.warn("Failed to load chats from history service:", e);
        }
      } catch (e) {
        console.warn("Failed to load sessions:", e);
      }
    };

    loadSessions();
  }, []);

  // persist sessions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // ignore storage failures
    }
  }, [sessions]);

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;

  // UI state: per-item context menu and delete confirmation
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages?.length, isLoading]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpenId && !(event.target as Element).closest('[data-context-menu]')) {
        setMenuOpenId(null);
        setMenuPosition(null);
      }
    };

    if (menuOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpenId]);

  const createNewSession = useCallback(async () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      modelId: selected?.id,
      modelProvider: selected?.provider,
      parameters: params,
      context: contextPrompt,
    };
    
    // Update sessions state first
    setSessions((prev) => {
      const updatedSessions = [newSession, ...prev];
      // Immediately save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
      } catch (e) {
        console.warn("Failed to save sessions to localStorage:", e);
      }
      return updatedSessions;
    });
    
    setCurrentSessionId(newSession.id);
    
    // Auto-save the new session to history
    try {
      await historyService.saveChat({
        id: newSession.id,
        title: newSession.title,
        model: { id: selected?.id ?? "", provider: selected?.provider ?? "" },
        parameters: params,
        context: contextPrompt,
        messagesSummary: "0 messages",
        usedText: { chatHistory: [] },
        lastActivityAt: newSession.lastActivityAt ?? new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Failed to auto-save new chat:", e);
    }
  }, [params, contextPrompt, selected]);

  // rename session
  const renameSession = async (id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
    
    // Also persist the change to the backend
    try {
      const session = sessions.find(s => s.id === id);
      if (session) {
        await historyService.updateChat(id, {
          id: session.id,
          title: title,
          model: { id: session.modelId ?? "", provider: session.modelProvider ?? "" },
          parameters: session.parameters ?? DEFAULT_PARAMS,
          context: session.context,
          messagesSummary: `${session.messages.length} messages`,
          usedText: { chatHistory: session.messages.map((m) => ({ role: m.role, content: m.content })) },
          lastActivityAt: session.lastActivityAt ?? new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("Failed to update chat title in backend:", e);
      // Show error notification to user
      showError("Save Failed", "Failed to save chat name. Please try again.");
    }
  };

  // start inline editing
  const startEditing = (id: string, currentTitle: string) => {
    setEditingSessionId(id);
    setEditingTitle(currentTitle);
    setMenuOpenId(null);
  };

  // save inline editing
  const saveEditing = async () => {
    if (editingSessionId && editingTitle.trim()) {
      await renameSession(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle("");
  };

  // cancel inline editing
  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  // duplicate session
  const duplicateSession = (id: string) => {
    const orig = sessions.find((s) => s.id === id);
    if (!orig) return;
    const dupe: ChatSession = {
      ...orig,
      id: crypto.randomUUID(),
      title: `${orig.title} (Copy)`,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
    setSessions((prev) => [dupe, ...prev]);
  };

  // export session as JSON (acts as "show in explorer" for web)
  const exportSession = (id: string) => {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${s.title.replace(/[^a-z0-9\-_]+/gi, "_") || "chat"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  // delete session
  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // add a message to current session (user or assistant)
  const pushMessageToCurrent = (msg: ChatMessage) => {
    if (!currentSessionId) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSessionId ? { ...s, messages: [...s.messages, msg], lastActivityAt: new Date().toISOString() } : s))
    );
  };

  // update last assistant message (for attaching meta or streaming updates)
  const updateLastAssistant = (sessionId: string, patch: Partial<ChatMessage>) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const msgs = [...s.messages];
        // find last assistant message index
        const idx = [...msgs].reverse().findIndex((m) => m.role === "assistant");
        if (idx === -1) return s;
        const actualIdx = msgs.length - 1 - idx;
        msgs[actualIdx] = { ...msgs[actualIdx], ...patch };
        return { ...s, messages: msgs, lastActivityAt: new Date().toISOString() };
      })
    );
  };

  const sendMessage = async () => {
    if ((!messageInput.trim() && attachedFiles.length === 0) || !selected) return;
    setIsLoading(true);

    const operationId = addOperation({ type: "chat", status: "running", progress: 0 });

    // create user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageInput,
      timestamp: new Date().toISOString(),
      files: attachedFiles.length ? attachedFiles.map((f) => ({ name: f.name, size: f.size })) : undefined,
    };

    // persist user message immediately
    pushMessageToCurrent(userMsg);

    // clear input & attachments
    setMessageInput("");
    setAttachedFiles([]);

    // prepare model messages
    const systemMessages = contextPrompt ? [{ role: "system" as const, content: contextPrompt }] : [];
    const messagesForModel = [
      ...systemMessages,
      ...((currentSession?.messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
      { role: "user" as const, content: userMsg.content },
    ];

    const startTime = performance.now();
    try {
      updateOperation(operationId, { progress: 25 });

      // call LLM - allow both string or object responses (defensive)
      const raw = await chatComplete(selected.id, messagesForModel, params);
      updateOperation(operationId, { progress: 75 });

      // normalize possible response shapes:
      // - string
      // - { output: string, usage: { ... }, stop_reason?, timing: { firstTokenMs, elapsedMs } }
      let text = "";
      let usage: UsageMeta = {};
      if (typeof raw === "string") {
        text = raw;
      } else if (raw && typeof raw === "object") {
        // try common fields
        const obj: any = raw as any;
        text = obj.output ?? obj.text ?? obj.response ?? "";
        const u: any = obj.usage ?? obj.metrics ?? obj.meta ?? {};
        usage.promptTokens = u.promptTokens ?? u.prompt_tokens ?? u.promptTokens;
        usage.completionTokens = u.completionTokens ?? u.completion_tokens ?? u.completionTokens;
        usage.totalTokens = u.totalTokens ?? u.total_tokens ?? u.totalTokens;
        usage.firstTokenMs = u.firstTokenMs ?? obj.firstTokenMs ?? obj.first_token_ms ?? u.first_token_ms;
        usage.elapsedMs = u.elapsedMs ?? obj.elapsedMs ?? obj.elapsed_ms ?? u.elapsed_ms;
        usage.stopReason = obj.stop_reason ?? u.stop_reason ?? u.stopReason ?? obj.stopReason;
      } else {
        text = String(raw);
      }

      const endTime = performance.now();
      // compute elapsed if not provided
      if (!usage.elapsedMs) {
        usage.elapsedMs = Math.max(0, Math.round(endTime - startTime));
      }
      // compute tokens/sec if tokens provided and elapsed available — attach later when rendering
      // compute time-to-first-token if not provided (leave undefined if unknown)

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: text,
        timestamp: new Date().toISOString(),
        meta: usage,
      };

      // append assistant message
      pushMessageToCurrent(assistantMsg);

      // persist to history service - build a minimal chat object
      if (currentSession) {
        const s = sessions.find((x) => x.id === currentSession.id) ?? currentSession;
        const finalSession = { ...s, messages: [...s.messages, userMsg, assistantMsg], lastActivityAt: new Date().toISOString() };
        try {
          await historyService.saveChat({
            id: finalSession.id,
            title: finalSession.title,
            model: { id: selected.id, provider: selected.provider },
            parameters: params,
            context: contextPrompt,
            messagesSummary: `${finalSession.messages.length} messages`,
            usedText: { chatHistory: finalSession.messages.map((m) => ({ role: m.role, content: m.content })) },
            lastActivityAt: finalSession.lastActivityAt,
          });
        } catch (e) {
          // non-blocking if history fails
          console.warn("historyService.saveChat failed:", e);
        }
      }

      updateOperation(operationId, { status: "completed", progress: 100, endTime: Date.now() });
    } catch (e: any) {
      updateOperation(operationId, { status: "error", error: e?.message ?? String(e), endTime: Date.now() });
      showError("Chat Error", e?.message ?? "Failed to get response from model");

      // append assistant error message
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Error: Could not get a response from the model.",
        timestamp: new Date().toISOString(),
      };
      pushMessageToCurrent(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileAttach = (file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Automation functionality
  const handleAutomationStart = async (config: ChatAutomationConfig) => {
    const automationId = automationStore.startAutomation('chat', config);
    setIsLoading(true);
    setIsAutomationProgressModalOpen(true);

    try {
      const results: Record<string, any> = {};
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < config.runs.length; i++) {
        const run = config.runs[i];
        
        // Update progress with animation
        automationStore.updateProgress(automationId, { currentRunIndex: i });

        try {
          // Use per-run model if specified, otherwise use current selected model
          const runModelId = run.modelId || selected?.id;
          const runModelProvider = run.modelProvider || selected?.provider;
          
          if (!runModelId) {
            results[run.id] = {
              runName: run.name,
              error: "No model specified for this run",
            };
            continue;
          }

          // Create or get chat session
          let targetSessionId = run.chatId;
          if (!targetSessionId) {
            // Create new session
            const newSession: ChatSession = {
              id: crypto.randomUUID(),
              title: run.chatTitle,
              messages: [],
              createdAt: new Date().toISOString(),
              lastActivityAt: new Date().toISOString(),
              modelId: runModelId,
              modelProvider: runModelProvider,
              parameters: DEFAULT_PARAMS,
              context: "",
            };
            setSessions((prev) => [newSession, ...prev]);
            targetSessionId = newSession.id;
          }

          const runResults: any[] = [];

          // Process each prompt in the run
          for (let j = 0; j < run.prompts.length; j++) {
            const prompt = run.prompts[j];
            
            // Update progress for current prompt
            automationStore.updateProgress(automationId, { 
              currentRunIndex: i, 
              currentPromptIndex: j 
            });

            // Create user message
            const userMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "user",
              content: prompt.content,
              timestamp: new Date().toISOString(),
            };

            // Add user message to session
            setSessions((prev) =>
              prev.map((s) => 
                s.id === targetSessionId 
                  ? { ...s, messages: [...s.messages, userMsg], lastActivityAt: new Date().toISOString() }
                  : s
              )
            );

            // Get current session messages for context
            const currentSession = sessions.find(s => s.id === targetSessionId);
            const systemMessages = prompt.context ? [{ role: "system" as const, content: prompt.context }] : [];
            const messagesForModel = [
              ...systemMessages,
              ...((currentSession?.messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
              { role: "user" as const, content: prompt.content },
            ];

            // Call LLM with per-run model
            const startTime = performance.now();
            const raw = await chatComplete(runModelId, messagesForModel, prompt.parameters);
            
            // Normalize response
            let text = "";
            let usage: UsageMeta = {};
            if (typeof raw === "string") {
              text = raw;
            } else if (raw && typeof raw === "object") {
              const obj: any = raw as any;
              text = obj.output ?? obj.text ?? obj.response ?? "";
              const u: any = obj.usage ?? obj.metrics ?? obj.meta ?? {};
              usage.promptTokens = u.promptTokens ?? u.prompt_tokens ?? u.promptTokens;
              usage.completionTokens = u.completionTokens ?? u.completion_tokens ?? u.completionTokens;
              usage.totalTokens = u.totalTokens ?? u.total_tokens ?? u.totalTokens;
              usage.firstTokenMs = u.firstTokenMs ?? obj.firstTokenMs ?? obj.first_token_ms ?? u.first_token_ms;
              usage.elapsedMs = u.elapsedMs ?? obj.elapsedMs ?? obj.elapsed_ms ?? u.elapsed_ms;
              usage.stopReason = obj.stop_reason ?? u.stop_reason ?? u.stopReason ?? obj.stopReason;
            } else {
              text = String(raw);
            }

            const endTime = performance.now();
            if (!usage.elapsedMs) {
              usage.elapsedMs = Math.max(0, Math.round(endTime - startTime));
            }

            // Create assistant message
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: text,
              timestamp: new Date().toISOString(),
              meta: usage,
            };

            // Add assistant message to session
            setSessions((prev) =>
              prev.map((s) => 
                s.id === targetSessionId 
                  ? { ...s, messages: [...s.messages, assistantMsg], lastActivityAt: new Date().toISOString() }
                  : s
              )
            );

            runResults.push({
              promptName: prompt.name,
              prompt: prompt.content,
              parameters: prompt.parameters,
              context: prompt.context,
              output: text,
              usage,
              model: { id: runModelId, provider: runModelProvider },
            });

            // Save to history
            try {
              const finalSession = sessions.find(s => s.id === targetSessionId);
              if (finalSession) {
                await historyService.saveChat({
                  id: finalSession.id,
                  title: finalSession.title,
                  model: { id: runModelId, provider: runModelProvider || "local" },
                  parameters: prompt.parameters,
                  context: prompt.context ?? "",
                  messagesSummary: `${finalSession.messages.length} messages`,
                  usedText: { 
                    chatHistory: finalSession.messages.map((m) => ({ role: m.role, content: m.content })) 
                  },
                  lastActivityAt: finalSession.lastActivityAt ?? new Date().toISOString(),
                  automationId: config.id,
                  runId: run.id,
                  promptId: prompt.id,
                });
              }
            } catch (e) {
              console.warn("Failed to save chat:", e);
            }
          }

          results[run.id] = {
            runName: run.name,
            chatId: targetSessionId,
            chatTitle: run.chatTitle,
            prompts: runResults,
            model: { id: runModelId, provider: runModelProvider },
          };

        } catch (error: any) {
          errorCount++;
          results[run.id] = {
            runName: run.name,
            error: error?.message ?? String(error),
          };
        }
      }

      setAutomationResults(results);
      
      // Count successes
      successCount = config.runs.length - errorCount;
      
      // Complete automation with appropriate status
      if (errorCount === 0) {
        automationStore.completeAutomation(automationId);
      } else if (successCount === 0) {
        automationStore.completeAutomation(automationId, "All runs failed");
      } else {
        automationStore.completeAutomation(automationId, `${errorCount} runs failed`);
      }
      
      // Save automation aggregate to history
      try {
        const automationAggregate = {
          id: config.id,
          name: config.name,
          model: { id: selected?.id || "unknown", provider: selected?.provider || "local" },
          parameters: params,
          runs: config.runs.map(run => ({
            id: run.id,
            name: run.name,
            chatTitle: run.chatTitle,
            prompts: results[run.id]?.prompts || [],
            error: results[run.id]?.error || null,
          })),
          status: errorCount === 0 ? "completed" : successCount === 0 ? "error" : "completed",
          completedAt: new Date().toISOString(),
        };
        await api.post("/history/automations", automationAggregate);
      } catch (e) {
        console.warn("Failed to save automation aggregate:", e);
      }
      
      // Show appropriate success/error message
      if (errorCount === 0) {
        showSuccess("Automation Complete", `All ${config.runs.length} chat runs completed successfully!`);
      } else if (successCount === 0) {
        showError("Automation Failed", `All ${config.runs.length} runs failed. Check the progress modal for details.`);
      } else {
        showSuccess("Automation Partially Complete", `${successCount} runs succeeded, ${errorCount} failed. Check the progress modal for details.`);
      }

    } catch (error: any) {
      automationStore.completeAutomation(automationId, error?.message ?? String(error));
      showError("Automation Failed", "Automation failed: " + (error?.message ?? String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  // UI helpers for rendering meta line under assistant messages
  const renderUsageLine = (meta?: UsageMeta) => {
    if (!meta) return null;
    const tkPrompt = typeof meta.promptTokens === "number" ? meta.promptTokens : null;
    const tkCompletion = typeof meta.completionTokens === "number" ? meta.completionTokens : null;
    const tkTotal = typeof meta.totalTokens === "number" ? meta.totalTokens : null;
    const elapsedSec = meta.elapsedMs ? (meta.elapsedMs / 1000) : undefined;
    let tokensPerSec: number | null = null;
    if (tkCompletion !== null && elapsedSec && elapsedSec > 0) tokensPerSec = +(tkCompletion / elapsedSec);
    const firstTokenMs = meta.firstTokenMs ?? null;
    const stopReason = meta.stopReason ?? null;

    return (
      <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
        {tokensPerSec !== null && <span>{tokensPerSec.toFixed(2)} tok/sec</span>}
        {tkTotal !== null && <span> • {tkTotal} tokens</span>}
        {firstTokenMs !== null && <span> • {firstTokenMs}ms to first token</span>}
        {stopReason && <span> • stop: {stopReason}</span>}
      </div>
    );
  };

  // left & right panels (UI)
  const leftPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0", fontWeight: 600, fontSize: 18 }}>Chat History</h3>
        <button
          onClick={createNewSession}
          style={{
            padding: "8px 12px",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            border: "none",
            color: "#fff",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(37, 99, 235, 0.3)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(37, 99, 235, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 4px rgba(37, 99, 235, 0.3)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          New Chat
        </button>
      </div>

      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: 8, 
        flex: 1, 
        overflow: "auto",
        paddingRight: 4
      }}>
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => setCurrentSessionId(s.id)}
            style={{
              padding: 16,
              background: currentSessionId === s.id 
                ? "linear-gradient(135deg, #1e293b, #334155)" 
                : "#0f172a",
              border: currentSessionId === s.id 
                ? "1px solid #3b82f6" 
                : "1px solid #334155",
              borderRadius: 12,
              cursor: "pointer",
              color: "#e2e8f0",
              position: "relative",
              transition: "all 0.2s ease",
              boxShadow: currentSessionId === s.id 
                ? "0 4px 12px rgba(59, 130, 246, 0.15)" 
                : "0 1px 3px rgba(0, 0, 0, 0.1)"
            }}
            onMouseEnter={(e) => {
              if (currentSessionId !== s.id) {
                e.currentTarget.style.background = "#1e293b";
                e.currentTarget.style.borderColor = "#475569";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
              }
            }}
            onMouseLeave={(e) => {
              if (currentSessionId !== s.id) {
                e.currentTarget.style.background = "#0f172a";
                e.currentTarget.style.borderColor = "#334155";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
              }
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingSessionId === s.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditing();
                        if (e.key === "Escape") cancelEditing();
                      }}
                      onBlur={saveEditing}
                      style={{
                        flex: 1,
                        background: "#1e293b",
                        border: "1px solid #3b82f6",
                        borderRadius: 4,
                        padding: "4px 8px",
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: 600,
                        outline: "none"
                      }}
                      autoFocus
                    />
                    <button
                      onClick={saveEditing}
                      style={{
                        background: "#10b981",
                        border: "none",
                        borderRadius: 4,
                        padding: "4px 8px",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontSize: 12
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={cancelEditing}
                      style={{
                        background: "#ef4444",
                        border: "none",
                        borderRadius: 4,
                        padding: "4px 8px",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontSize: 12
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: 14,
                    color: currentSessionId === s.id ? "#ffffff" : "#e2e8f0",
                    marginBottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {s.title}
                  </div>
                )}
                <div style={{ 
                  fontSize: 12, 
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                    </svg>
                    {s.messages.length} messages
                  </span>
                  <span>•</span>
                  <span>{new Date(s.createdAt).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
              <button
                onClick={(ev) => { 
                  ev.stopPropagation(); 
                  const rect = ev.currentTarget.getBoundingClientRect();
                  const x = Math.min(rect.right - 180, window.innerWidth - 200);
                  const y = Math.max(rect.top - 200, 20); // Position above the button
                  setMenuPosition({ x, y });
                  setMenuOpenId(menuOpenId === s.id ? null : s.id); 
                }}
                title="Actions"
                style={{ 
                  background: "transparent", 
                  border: "1px solid #475569", 
                  color: "#94a3b8", 
                  borderRadius: 6, 
                  width: 28, 
                  height: 28, 
                  display: "inline-flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#64748b";
                  e.currentTarget.style.color = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#475569";
                  e.currentTarget.style.color = "#94a3b8";
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  );

  const rightPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Modern segmented control for tabs */}
      <div style={{ 
        display: "flex", 
        background: "#0f172a", 
        borderRadius: 8, 
        padding: 4,
        border: "1px solid #334155"
      }}>
        <button
          onClick={() => handleTabSwitch("context")}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: "none",
            background: activeRightTab === "context" 
              ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
              : "transparent",
            color: activeRightTab === "context" ? "#ffffff" : "#94a3b8",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 6,
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
          Context
        </button>
        <button
          onClick={() => handleTabSwitch("parameters")}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: "none",
            background: activeRightTab === "parameters" 
              ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
              : "transparent",
            color: activeRightTab === "parameters" ? "#ffffff" : "#94a3b8",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 6,
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
          </svg>
          Parameters
        </button>
      </div>

      {/* Tab content with modern card styling */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        flexDirection: "column", 
        gap: 16,
        minHeight: 0
      }}>
        {activeRightTab === "context" && (
          <div style={{ 
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", 
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16, fontWeight: 600 }}>System Context</h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                  {contextPrompt ? `${contextPrompt.length} characters` : "No context provided"}
                </p>
              </div>
            </div>
            <PresetManager 
              onPresetChange={handlePresetChange} 
              presetStore={chatPresetStore}
              currentContent={contextPrompt}
              currentParameters={params}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
              <ExpandableTextarea 
                editable 
                value={contextPrompt} 
                onChange={setContextPrompt}
              />
            </div>
          </div>
        )}

        {activeRightTab === "parameters" && (
          <div style={{ 
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                background: "linear-gradient(135deg, #f59e0b, #d97706)", 
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16, fontWeight: 600 }}>Model Parameters</h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                  Temperature: {params.temperature} • Max Tokens: {params.max_tokens}
                </p>
              </div>
            </div>
            <PresetManager 
              onPresetChange={handlePresetChange} 
              presetStore={chatPresetStore}
              currentContent={contextPrompt}
              currentParameters={params}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
              <ParamsPanel params={params} onChange={setParams} />
            </div>
          </div>
        )}
      </div>
    </div>
  );



  return (
    <LayoutShell title="Chat" left={leftPanel} right={rightPanel}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Main Chat Interface */}
          <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column", 
            padding: 20, 
            background: "#0f172a", 
            color: "#e2e8f0", 
            minHeight: 0 
          }}>
            {/* Chat Messages Container */}
            <div style={{ 
              flex: 1, 
              overflow: "auto", 
              padding: 16, 
              background: "#0f172a",
              border: "1px solid #334155", 
              borderRadius: 12, 
              minHeight: 0, 
              display: "flex", 
              flexDirection: "column", 
              gap: 20,
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
            }}>
              {(currentSession?.messages ?? []).map((m) => (
                <div key={m.id} style={{ 
                  display: "flex", 
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 4
                }}>
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: m.role === "user" 
                        ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                        : "#1e293b",
                      border: m.role === "user" 
                        ? "1px solid #3b82f6" 
                        : "1px solid #334155",
                      maxWidth: "80%",
                      boxShadow: m.role === "user" 
                        ? "0 4px 12px rgba(59, 130, 246, 0.15)" 
                        : "0 2px 8px rgba(0, 0, 0, 0.1)",
                      position: "relative"
                    }}
                  >
                    {m.role === "assistant" && (
                      <div style={{ 
                        fontSize: 12, 
                        color: "#94a3b8", 
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                      }}>
                        <div style={{ 
                          width: 20, 
                          height: 20, 
                          borderRadius: "50%", 
                          background: "#475569",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10
                        }}>
                          🤖
                        </div>
                        <span style={{ fontWeight: 500 }}>
                          {selected?.id || "AI"}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                      </div>
                    )}
                    <div style={{ 
                      whiteSpace: "pre-wrap", 
                      color: m.role === "user" ? "#ffffff" : "#e2e8f0",
                      lineHeight: 1.5,
                      fontSize: 14
                    }}>
                      {m.content}
                    </div>

                    {m.files && m.files.length > 0 && (
                      <div style={{ 
                        marginTop: 12, 
                        padding: 8, 
                        background: m.role === "user" 
                          ? "rgba(255, 255, 255, 0.1)" 
                          : "#0f172a",
                        borderRadius: 8,
                        border: m.role === "user" 
                          ? "1px solid rgba(255, 255, 255, 0.2)" 
                          : "1px solid #334155"
                      }}>
                        <div style={{ 
                          fontSize: 12, 
                          color: m.role === "user" ? "#e0f2fe" : "#94a3b8", 
                          marginBottom: 6,
                          fontWeight: 500
                        }}>
                          Attached files:
                        </div>
                        {m.files.map((f, idx) => (
                          <div key={idx} style={{ 
                            fontSize: 12, 
                            color: m.role === "user" ? "#e0f2fe" : "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                            {f.name}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* usage meta */}
                    {m.role === "assistant" && m.meta && (
                      <div style={{ marginTop: 12 }}>
                        {renderUsageLine(m.meta)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ 
                  display: "flex", 
                  justifyContent: "flex-start",
                  marginBottom: 4
                }}>
                  <div style={{
                    padding: 16,
                    borderRadius: 16,
                    background: "#1e293b",
                    border: "1px solid #334155",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                  }}>
                    <div style={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: "50%", 
                      background: "#475569",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10
                    }}>
                      🤖
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 14 }}>
                      Assistant is typing
                      <span style={{ 
                        animation: "pulse 1.5s ease-in-out infinite",
                        marginLeft: 4
                      }}>
                        ...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Modern Composer */}
            <div style={{ 
              marginTop: 20, 
              background: "#0f172a",
              border: "1px solid #334155", 
              borderRadius: 12, 
              padding: 16, 
              position: "sticky", 
              bottom: 0,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
            }}>
              {attachedFiles.length > 0 && (
                <div style={{ 
                  display: "flex", 
                  gap: 8, 
                  flexWrap: "wrap", 
                  marginBottom: 12,
                  padding: 8,
                  background: "#1e293b",
                  borderRadius: 8,
                  border: "1px solid #475569"
                }}>
                  {attachedFiles.map((f, i) => (
                    <div key={i} style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 8, 
                      padding: "6px 10px", 
                      background: "#0f172a", 
                      borderRadius: 6,
                      border: "1px solid #334155"
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#3b82f6" }}>
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                      <span style={{ color: "#e2e8f0", fontSize: 13 }}>{f.name}</span>
                      <button 
                        onClick={() => removeFile(i)} 
                        style={{ 
                          background: "transparent", 
                          border: "none", 
                          color: "#ef4444", 
                          cursor: "pointer",
                          padding: 2,
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#ef444420"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div style={{ minWidth: 44 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}>
                    <FileDrop 
                      onFile={handleFileAttach} 
                      accept=".txt,.pdf,.png,.jpg,.jpeg,.tif,.tiff,.docx,.doc" 
                      label="📎"
                    />
                  </div>
                </div>
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message… (Shift+Enter for newline)"
                  style={{
                    flex: 1,
                    minHeight: 60,
                    maxHeight: 200,
                    resize: "vertical",
                    padding: 16,
                    borderRadius: 12,
                    background: "#1e293b",
                    color: "#e2e8f0",
                    border: "1px solid #475569",
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                    transition: "all 0.2s ease"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#475569";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <LoadingButton 
                    onClick={sendMessage} 
                    isLoading={isLoading} 
                    disabled={!messageInput.trim() && attachedFiles.length === 0}
                    style={{
                      padding: "12px 20px",
                      background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)"
                    }}
                  >
                    Send
                  </LoadingButton>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => setIsAutomationModalOpen(true)}
                      style={{ 
                        padding: "10px 16px", 
                        borderRadius: 8, 
                        border: "1px solid #7c3aed", 
                        background: "linear-gradient(135deg, #7c3aed, #6d28d9)", 
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 4px rgba(124, 58, 237, 0.3)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 8px rgba(124, 58, 237, 0.4)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(124, 58, 237, 0.3)";
                      }}
                    >
                      Automation
                    </button>
                    
                    <AutomationProgressIndicator />
                  </div>

                  <button
                    onClick={async () => {
                      // quick save session title
                      if (!currentSessionId) return;
                      const title = prompt("Save chat as (title):", sessions.find((x) => x.id === currentSessionId)?.title ?? "");
                      if (!title) return;
                      try {
                        await renameSession(currentSessionId, title);
                        showSuccess("Saved", "Chat renamed.");
                      } catch (e) {
                        // Error already handled in renameSession
                      }
                    }}
                    style={{ 
                      padding: "10px 16px", 
                      borderRadius: 8, 
                      border: "1px solid #334155", 
                      background: "#0f172a", 
                      color: "#94a3b8",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#1e293b";
                      e.currentTarget.style.borderColor = "#475569";
                      e.currentTarget.style.color = "#e2e8f0";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#0f172a";
                      e.currentTarget.style.borderColor = "#334155";
                      e.currentTarget.style.color = "#94a3b8";
                    }}
                  >
                    Save Title
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 360, background: "#0b1220", border: "1px solid #334155", borderRadius: 12, padding: 16, color: "#e2e8f0" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Delete chat?</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>This action cannot be undone.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0" }}>Cancel</button>
              <button
                onClick={() => { deleteSession(deleteConfirmId); setDeleteConfirmId(null); }}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #7f1d1d", background: "#1e293b", color: "#ef4444" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automation Results */}
      {Object.keys(automationResults).length > 0 && (
        <div style={{ marginTop: 24, padding: 16, background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0" }}>Automation Results</h3>
          <div style={{ display: "grid", gap: 16 }}>
            {Object.entries(automationResults).map(([runId, result]) => (
              <div key={runId} style={{ 
                border: "1px solid #334155", 
                borderRadius: 8, 
                padding: 16, 
                background: "#1e293b" 
              }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#e2e8f0" }}>{result.runName}</h4>
                {result.error ? (
                  <div style={{ color: "#ef4444", fontSize: 14 }}>Error: {result.error}</div>
                ) : (
                  <>
                    <div style={{ marginBottom: 12, fontSize: 14, color: "#94a3b8" }}>
                      Chat: <strong style={{ color: "#e2e8f0" }}>{result.chatTitle}</strong>
                    </div>
                    <div style={{ display: "grid", gap: 12 }}>
                      {result.prompts?.map((prompt: any, index: number) => (
                        <div key={index} style={{ 
                          background: "#0f172a", 
                          padding: 12, 
                          borderRadius: 6,
                          border: "1px solid #475569"
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", marginBottom: 8 }}>
                            {prompt.promptName}
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Prompt:</div>
                            <div style={{ 
                              background: "#1e293b", 
                              padding: 8, 
                              borderRadius: 4, 
                              fontSize: 13, 
                              color: "#e2e8f0",
                              maxHeight: 80,
                              overflow: "auto"
                            }}>
                              {prompt.prompt}
                            </div>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Response:</div>
                            <div style={{ 
                              background: "#1e293b", 
                              padding: 8, 
                              borderRadius: 4, 
                              fontSize: 13, 
                              color: "#e2e8f0",
                              maxHeight: 100,
                              overflow: "auto"
                            }}>
                              {prompt.output}
                            </div>
                          </div>
                          {prompt.usage && (
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>
                              Tokens: {prompt.usage.totalTokens || 'N/A'} • 
                              Time: {prompt.usage.elapsedMs ? `${(prompt.usage.elapsedMs / 1000).toFixed(2)}s` : 'N/A'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Automation Modal */}
      <ChatAutomationModal
        isOpen={isAutomationModalOpen}
        onClose={() => setIsAutomationModalOpen(false)}
        onStart={handleAutomationStart}
        existingChats={sessions.map(s => ({ id: s.id, title: s.title }))}
        presetStore={chatPresetStore}
      />
      
      {/* Automation Progress Modal */}
      <AutomationProgressModal
        isOpen={isAutomationProgressModalOpen}
        onClose={() => setIsAutomationProgressModalOpen(false)}
      />

      {/* Context Menu - Rendered at root level to escape scrollable container */}
      {menuOpenId && (
        <div
          data-context-menu
          onClick={(ev) => ev.stopPropagation()}
          style={{ 
            position: "fixed", 
            left: menuPosition?.x ?? 8, 
            top: menuPosition?.y ?? "50%",
            transform: menuPosition ? "none" : "translateY(-50%)",
            background: "#0b1220", 
            border: "1px solid #334155", 
            borderRadius: 8, 
            minWidth: 180, 
            zIndex: 9999, 
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            padding: 4
          }}
        >
          <button
            onClick={() => {
              const session = sessions.find(s => s.id === menuOpenId);
              if (session) startEditing(session.id, session.title);
            }}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8,
              width: "100%", 
              textAlign: "left", 
              padding: "8px 12px", 
              background: "transparent", 
              border: "none", 
              color: "#e2e8f0", 
              cursor: "pointer",
              borderRadius: 4,
              fontSize: 13
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Rename
          </button>
          <button
            onClick={() => { 
              const session = sessions.find(s => s.id === menuOpenId);
              if (session) duplicateSession(session.id); 
              setMenuOpenId(null); 
            }}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8,
              width: "100%", 
              textAlign: "left", 
              padding: "8px 12px", 
              background: "transparent", 
              border: "none", 
              color: "#e2e8f0", 
              cursor: "pointer",
              borderRadius: 4,
              fontSize: 13
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Duplicate
          </button>
          <button
            onClick={() => { 
              const session = sessions.find(s => s.id === menuOpenId);
              if (session) exportSession(session.id); 
              setMenuOpenId(null); 
            }}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8,
              width: "100%", 
              textAlign: "left", 
              padding: "8px 12px", 
              background: "transparent", 
              border: "none", 
              color: "#e2e8f0", 
              cursor: "pointer",
              borderRadius: 4,
              fontSize: 13
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Export
          </button>
          <div style={{ height: 1, background: "#334155", margin: "4px 0" }} />
          <button
            onClick={() => { 
              setDeleteConfirmId(menuOpenId); 
              setMenuOpenId(null); 
            }}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8,
              width: "100%", 
              textAlign: "left", 
              padding: "8px 12px", 
              background: "transparent", 
              border: "none", 
              color: "#ef4444", 
              cursor: "pointer",
              borderRadius: 4,
              fontSize: 13
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
            </svg>
            Delete
          </button>
        </div>
      )}
    </LayoutShell>
  );
}
