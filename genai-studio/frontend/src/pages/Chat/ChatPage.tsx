// src/pages/Chat/ChatPage.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import ModelSelector from "@/components/TopBar/ModelSelector";
import FileDrop from "@/components/FileDrop/FileDrop";
import PromptPresetBox from "@/components/PresetPanel/PromptPresetBox";
import PresetManager from "@/components/PresetPanel/PresetManager";
import ParamsPanel, { ModelParams } from "@/components/RightPanel/ParamsPanel";
import { chatComplete } from "@/services/llm";
import { useModel } from "@/context/ModelContext";
import { chatPresetStore } from "@/stores/presetStore";
import { useNotifications } from "@/components/Notification/Notification";
import { useBackgroundState } from "@/stores/backgroundState";
import { historyService } from "@/services/history";

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
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const { selected } = useModel();
  const { showError, showSuccess } = useNotifications();
  const { addOperation, updateOperation } = useBackgroundState();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // load sessions from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      }
    } catch {
      // ignore parse errors
    }
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

  // scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages?.length, isLoading]);

  const createNewSession = useCallback(() => {
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
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  }, [params, contextPrompt, selected]);

  // rename session
  const renameSession = (id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
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
        text = raw.output ?? raw.text ?? raw.response ?? "";
        const u = raw.usage ?? raw.metrics ?? raw.meta ?? {};
        usage.promptTokens = u.promptTokens ?? u.prompt_tokens ?? u.promptTokens;
        usage.completionTokens = u.completionTokens ?? u.completion_tokens ?? u.completionTokens;
        usage.totalTokens = u.totalTokens ?? u.total_tokens ?? u.totalTokens;
        usage.firstTokenMs = u.firstTokenMs ?? raw.firstTokenMs ?? raw.first_token_ms ?? u.first_token_ms;
        usage.elapsedMs = u.elapsedMs ?? raw.elapsedMs ?? raw.elapsed_ms ?? u.elapsed_ms;
        usage.stopReason = raw.stop_reason ?? u.stop_reason ?? u.stopReason ?? raw.stopReason;
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
        {tkPrompt !== null && <span>prompt: {tkPrompt} </span>}
        {tkCompletion !== null && <span>completion: {tkCompletion} </span>}
        {tkTotal !== null && <span>total: {tkTotal} </span>}
        {tokensPerSec !== null && <span>• {tokensPerSec.toFixed(2)} tok/s </span>}
        {firstTokenMs !== null && <span>• ttf: {Math.round(firstTokenMs)} ms </span>}
        {elapsedSec !== undefined && <span>• {elapsedSec.toFixed(2)} s</span>}
        {stopReason && <span>• stop: {stopReason}</span>}
      </div>
    );
  };

  // left & right panels (UI)
  const leftPanel = (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0", fontWeight: 600 }}>Chat History</h3>
        <button
          onClick={createNewSession}
          style={{
            padding: "6px 8px",
            background: "#2563eb",
            border: "1px solid #2563eb",
            color: "#fff",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          New
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => setCurrentSessionId(s.id)}
            style={{
              padding: 12,
              background: currentSessionId === s.id ? "#1e293b" : "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              cursor: "pointer",
              color: "#e2e8f0",
            }}
          >
            <div style={{ fontWeight: "700", marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {s.messages.length} messages • {new Date(s.createdAt).toLocaleDateString()}
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  const newTitle = prompt("Rename chat", s.title) || s.title;
                  renameSession(s.id, newTitle);
                }}
                style={{ fontSize: 12, background: "transparent", border: "1px solid #334155", color: "#e2e8f0", padding: "4px 8px", borderRadius: 6 }}
              >
                Rename
              </button>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (confirm("Delete chat?")) deleteSession(s.id);
                }}
                style={{ fontSize: 12, background: "transparent", border: "1px solid #7f1d1d", color: "#ef4444", padding: "4px 8px", borderRadius: 6 }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const rightPanel = (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
        <button
          onClick={() => setActiveRightTab("context")}
          style={{
            padding: "8px 12px",
            border: "none",
            background: activeRightTab === "context" ? "#1e293b" : "transparent",
            color: activeRightTab === "context" ? "#e2e8f0" : "#94a3b8",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Context
        </button>
        <button
          onClick={() => setActiveRightTab("parameters")}
          style={{
            padding: "8px 12px",
            border: "none",
            background: activeRightTab === "parameters" ? "#1e293b" : "transparent",
            color: activeRightTab === "parameters" ? "#e2e8f0" : "#94a3b8",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Parameters
        </button>
      </div>

      {activeRightTab === "context" && (
        <div>
          <PromptPresetBox onPromptChange={setContextPrompt} presetStore={chatPresetStore} />
        </div>
      )}

      {activeRightTab === "parameters" && (
        <div>
          <PresetManager onPresetChange={(preset) => setContextPrompt(preset.body ?? "")} presetStore={chatPresetStore} />
          <ParamsPanel params={params} onChange={setParams} />
        </div>
      )}
    </div>
  );

  const topBar = <ModelSelector />;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <LeftRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 56 }}>
        {/* Top Bar */}
        <header
          style={{
            height: 48,
            borderBottom: "1px solid #334155",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            padding: "0 16px",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              style={{
                padding: "6px 10px",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#e2e8f0",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {leftOpen ? "⟨" : "⟩"}
            </button>
            <strong>Chat</strong>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>{topBar}</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            <button
              onClick={() => setRightOpen(!rightOpen)}
              style={{
                padding: "6px 10px",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#e2e8f0",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {rightOpen ? "⟩" : "⟨"}
            </button>
          </div>
        </header>

        <div style={{ display: "flex", flex: 1 }}>
          {/* Left */}
          {leftOpen && (
            <aside style={{ width: 300, borderRight: "1px solid #334155", padding: 12, overflow: "auto", background: "#1e293b", color: "#e2e8f0" }}>
              {leftPanel}
            </aside>
          )}

          {/* Main */}
          <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, background: "#0f172a", color: "#e2e8f0" }}>
            <div style={{ flex: 1, overflow: "auto", padding: 12, border: "1px solid #334155", borderRadius: 8 }}>
              {(currentSession?.messages ?? []).map((m) => (
                <div key={m.id} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: m.role === "user" ? "#1e293b" : "#0f172a",
                      border: "1px solid #334155",
                      maxWidth: 920,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                      {m.role === "user" ? "You" : "Assistant"} • {new Date(m.timestamp).toLocaleTimeString()}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", color: "#e2e8f0" }}>{m.content}</div>

                    {m.files && m.files.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Attached files:</div>
                        {m.files.map((f, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: "#94a3b8" }}>
                            📎 {f.name}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* usage meta */}
                    {m.role === "assistant" && m.meta && <div>{renderUsageLine(m.meta)}</div>}
                  </div>
                </div>
              ))}
              {isLoading && <div style={{ padding: 12, color: "#94a3b8" }}>Assistant is typing…</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div style={{ marginTop: 12, borderTop: "1px solid #1f2a3a", paddingTop: 12 }}>
              {attachedFiles.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {attachedFiles.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", background: "#1e293b", borderRadius: 6 }}>
                      <span style={{ color: "#e2e8f0" }}>📎</span>
                      <span style={{ color: "#e2e8f0", fontSize: 13 }}>{f.name}</span>
                      <button onClick={() => removeFile(i)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ minWidth: 40 }}>
                  <FileDrop onFile={handleFileAttach} accept=".txt,.pdf,.png,.jpg,.jpeg,.tif,.tiff,.docx,.doc" label="📎" />
                </div>
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message… (Shift+Enter for newline)"
                  style={{
                    flex: 1,
                    minHeight: 56,
                    maxHeight: 200,
                    resize: "vertical",
                    padding: 12,
                    borderRadius: 8,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid #334155",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || (!messageInput.trim() && attachedFiles.length === 0)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      background: "#1e293b",
                      color: "#e2e8f0",
                      cursor: isLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {isLoading ? "Sending…" : "Send"}
                  </button>

                  <button
                    onClick={() => {
                      // quick save session title
                      if (!currentSessionId) return;
                      const title = prompt("Save chat as (title):", sessions.find((x) => x.id === currentSessionId)?.title ?? "");
                      if (!title) return;
                      renameSession(currentSessionId, title);
                      showSuccess("Saved", "Chat renamed.");
                    }}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#94a3b8" }}
                  >
                    Save Title
                  </button>
                </div>
              </div>
            </div>
          </main>

          {/* Right */}
          {rightOpen && (
            <aside style={{ width: 360, borderLeft: "1px solid #334155", padding: 12, overflow: "auto", background: "#1e293b", color: "#e2e8f0" }}>
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
