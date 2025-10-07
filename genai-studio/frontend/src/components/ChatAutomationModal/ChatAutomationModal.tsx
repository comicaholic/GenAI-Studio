// src/components/ChatAutomationModal/ChatAutomationModal.tsx
import React, { useState, useCallback } from 'react';
import { ModelParams } from '@/components/RightPanel/ParamsPanel';
import ParamsPanel from '@/components/RightPanel/ParamsPanel';
import PromptPresetBox from '@/components/PresetPanel/PromptPresetBox';
import PresetManager from '@/components/PresetPanel/PresetManager';
import { useModel } from '@/context/ModelContext';
import { useNotifications } from '@/components/Notification/Notification';

export interface ChatPrompt {
  id: string;
  name: string;
  content: string;
  parameters: ModelParams;
  context?: string;
}

export interface ChatRun {
  id: string;
  name: string;
  chatId?: string; // existing chat ID, or undefined for new chat
  chatTitle: string;
  prompts: ChatPrompt[];
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

export interface ChatAutomationConfig {
  id: string;
  name: string;
  runs: ChatRun[];
  status: 'pending' | 'running' | 'completed' | 'error';
  createdAt: string;
  completedAt?: string;
}

interface ChatAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: ChatAutomationConfig) => void;
  existingChats: Array<{ id: string; title: string }>;
  presetStore: any;
}

const DEFAULT_PARAMS: ModelParams = { temperature: 0.7, max_tokens: 1024, top_p: 1.0, top_k: 40 };

export default function ChatAutomationModal({ 
  isOpen, 
  onClose, 
  onStart, 
  existingChats,
  presetStore 
}: ChatAutomationModalProps) {
  const [numRuns, setNumRuns] = useState(2);
  const [automationName, setAutomationName] = useState("");
  const [runs, setRuns] = useState<ChatRun[]>([]);
  const [activeRunIndex, setActiveRunIndex] = useState(0);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const { selected } = useModel();
  const { showError } = useNotifications();

  // Initialize runs when numRuns changes
  React.useEffect(() => {
    const newRuns: ChatRun[] = Array.from({ length: numRuns }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Chat Run ${i + 1}`,
      chatTitle: `Automation Chat ${i + 1}`,
      prompts: [{
        id: crypto.randomUUID(),
        name: "Prompt 1",
        content: "",
        parameters: { ...DEFAULT_PARAMS },
      }],
      status: 'pending',
    }));
    setRuns(newRuns);
    setActiveRunIndex(0);
    setActivePromptIndex(0);
  }, [numRuns]);

  const updateRun = useCallback((runIndex: number, updates: Partial<ChatRun>) => {
    setRuns(prev => prev.map((run, i) => 
      i === runIndex ? { ...run, ...updates } : run
    ));
  }, []);

  const updatePrompt = useCallback((runIndex: number, promptIndex: number, updates: Partial<ChatPrompt>) => {
    setRuns(prev => prev.map((run, i) => {
      if (i !== runIndex) return run;
      const newPrompts = [...run.prompts];
      newPrompts[promptIndex] = { ...newPrompts[promptIndex], ...updates };
      return { ...run, prompts: newPrompts };
    }));
  }, []);

  const addPrompt = useCallback((runIndex: number) => {
    setRuns(prev => prev.map((run, i) => {
      if (i !== runIndex) return run;
      const newPrompt: ChatPrompt = {
        id: crypto.randomUUID(),
        name: `Prompt ${run.prompts.length + 1}`,
        content: "",
        parameters: { ...DEFAULT_PARAMS },
      };
      return { ...run, prompts: [...run.prompts, newPrompt] };
    }));
  }, []);

  const removePrompt = useCallback((runIndex: number, promptIndex: number) => {
    setRuns(prev => prev.map((run, i) => {
      if (i !== runIndex) return run;
      if (run.prompts.length <= 1) return run; // Keep at least one prompt
      const newPrompts = run.prompts.filter((_, idx) => idx !== promptIndex);
      return { ...run, prompts: newPrompts };
    }));
  }, []);

  const handleStart = useCallback(() => {
    if (!selected) {
      showError("Model Required", "Please select a model first.");
      return;
    }

    if (!automationName.trim()) {
      showError("Name Required", "Please enter a name for this automation.");
      return;
    }

    // Validate that all runs have at least one prompt with content
    for (const run of runs) {
      if (run.prompts.length === 0) {
        showError("Invalid Configuration", `Run "${run.name}" must have at least one prompt.`);
        return;
      }
      for (const prompt of run.prompts) {
        if (!prompt.content.trim()) {
          showError("Invalid Configuration", `Prompt "${prompt.name}" in run "${run.name}" must have content.`);
          return;
        }
      }
    }

    const config: ChatAutomationConfig = {
      id: crypto.randomUUID(),
      name: automationName,
      runs: runs.map(run => ({ ...run, status: 'pending' as const })),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    onStart(config);
    onClose();
  }, [selected, automationName, runs, onStart, onClose, showError]);

  if (!isOpen) return null;

  const currentRun = runs[activeRunIndex];
  const currentPrompt = currentRun?.prompts[activePromptIndex];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90vw",
          maxWidth: "1200px",
          height: "80vh",
          maxHeight: "800px",
          background: "#0b1220",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 24,
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Chat Automation</h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 24,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Configuration */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              Automation Name
            </label>
            <input
              type="text"
              value={automationName}
              onChange={(e) => setAutomationName(e.target.value)}
              placeholder="Enter automation name..."
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                fontSize: 14,
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              Number of Chat Runs
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={numRuns}
              onChange={(e) => setNumRuns(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                fontSize: 14,
              }}
            />
          </div>
        </div>

        {/* Run Selection */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            Select Chat Run to Configure
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {runs.map((run, index) => (
              <button
                key={run.id}
                onClick={() => {
                  setActiveRunIndex(index);
                  setActivePromptIndex(0);
                }}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  background: activeRunIndex === index ? "#1e293b" : "#0f172a",
                  color: activeRunIndex === index ? "#e2e8f0" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {run.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Configuration */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
                Chat Title
              </label>
              <input
                type="text"
                value={currentRun?.chatTitle || ""}
                onChange={(e) => updateRun(activeRunIndex, { chatTitle: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
                Use Existing Chat
              </label>
              <select
                value={currentRun?.chatId || ""}
                onChange={(e) => updateRun(activeRunIndex, { 
                  chatId: e.target.value || undefined,
                  chatTitle: e.target.value ? existingChats.find(c => c.id === e.target.value)?.title || "" : currentRun?.chatTitle || ""
                })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 14,
                }}
              >
                <option value="">Create New Chat</option>
                {existingChats.map(chat => (
                  <option key={chat.id} value={chat.id}>{chat.title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Prompt Management */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24, overflow: "auto", minHeight: 0 }}>
          {/* Left Column - Prompts List */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Prompts</h3>
              <button
                onClick={() => addPrompt(activeRunIndex)}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  background: "#1e293b",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                + Add Prompt
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {currentRun?.prompts.map((prompt, index) => (
                <div
                  key={prompt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    background: activePromptIndex === index ? "#1e293b" : "#0f172a",
                    cursor: "pointer",
                  }}
                  onClick={() => setActivePromptIndex(index)}
                >
                  <span style={{ flex: 1, fontSize: 14 }}>{prompt.name}</span>
                  {currentRun.prompts.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePrompt(activeRunIndex, index);
                        if (activePromptIndex >= index) {
                          setActivePromptIndex(Math.max(0, activePromptIndex - 1));
                        }
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: 16,
                        padding: 2,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Prompt Configuration */}
          <div>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 500 }}>Prompt Configuration</h3>
            {currentPrompt && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
                    Prompt Name
                  </label>
                  <input
                    type="text"
                    value={currentPrompt.name}
                    onChange={(e) => updatePrompt(activeRunIndex, activePromptIndex, { name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: 14,
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <PresetManager
                    onPresetChange={(preset) => updatePrompt(activeRunIndex, activePromptIndex, { content: preset.body || "" })}
                    autoApplyOnMount={false}
                    presetStore={presetStore}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <PromptPresetBox
                    onPromptChange={(content) => updatePrompt(activeRunIndex, activePromptIndex, { content })}
                    presetStore={presetStore}
                    value={currentPrompt.content}
                  />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 500 }}>Parameters</h4>
                  <ParamsPanel
                    params={currentPrompt.parameters}
                    onChange={(params) => updatePrompt(activeRunIndex, activePromptIndex, { parameters: params })}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              border: "1px solid #334155",
              borderRadius: 6,
              background: "#0f172a",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            style={{
              padding: "10px 20px",
              border: "1px solid #2563eb",
              borderRadius: 6,
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Start Automation
          </button>
        </div>
      </div>
    </div>
  );
}
