import React, { useState, useRef, useEffect } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import ModelSelector from "@/components/TopBar/ModelSelector";
import FileDrop from "@/components/FileDrop/FileDrop";
import PromptPresetBox from "@/components/PresetPanel/PromptPresetBox";
import PresetManager from "@/components/PresetPanel/PresetManager";
import ParamsPanel, { ModelParams } from "@/components/RightPanel/ParamsPanel";
import { chatComplete } from "@/services/llm";
import { useModel } from "@/context/ModelContext";
import { chatPresetStore } from "@/stores/presetStore";
import { useNotifications } from '@/components/Notification/Notification';
import { useBackgroundState } from '@/stores/backgroundState';
import { historyService } from '@/services/history';

const DEFAULT_PARAMS: ModelParams = { temperature: 0.7, max_tokens: 1024, top_p: 1.0, top_k: 40 };

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  files?: File[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
}

export default function ChatPage() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [contextPrompt, setContextPrompt] = useState("");
  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS);
  const [activeRightTab, setActiveRightTab] = useState<"context" | "parameters">("context");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const { selected } = useModel();
  const { showError, showSuccess } = useNotifications();
  const { addOperation, updateOperation } = useBackgroundState();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [currentSession?.messages]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() && attachedFiles.length === 0) return;
    if (!selected) return;

    setIsLoading(true);
    
    // Add background operation
    const operationId = addOperation({
      type: 'chat',
      status: 'running',
      progress: 0
    });

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageInput,
      timestamp: new Date(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };

    if (currentSession) {
      const updatedSession = {
        ...currentSession,
        messages: [...currentSession.messages, userMessage],
      };
      setCurrentSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === currentSession.id ? updatedSession : s));
    }

    setMessageInput("");
    setAttachedFiles([]);

    try {
      updateOperation(operationId, { progress: 25 });
      
      const messages = [
        ...(contextPrompt ? [{ role: "system" as const, content: contextPrompt }] : []),
        { role: "user" as const, content: messageInput }
      ];
      const response = await chatComplete(selected.id, messages, params);
      
      updateOperation(operationId, { progress: 75 });
      
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      if (currentSession) {
        const finalSession = {
          ...currentSession,
          messages: [...currentSession.messages, userMessage, assistantMessage],
        };
        setCurrentSession(finalSession);
        setSessions(prev => prev.map(s => s.id === currentSession.id ? finalSession : s));
        
        // Save chat to history
        const chat = {
          id: currentSession.id,
          title: currentSession.title,
          model: { id: selected.id, provider: selected.provider },
          parameters: params,
          context: contextPrompt,
          messagesSummary: `${finalSession.messages.length} messages`,
          usedText: {
            chatHistory: finalSession.messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          },
          lastActivityAt: new Date().toISOString()
        };
        
        await historyService.saveChat(chat);
      }
      
      updateOperation(operationId, { 
        status: 'completed', 
        progress: 100,
        endTime: Date.now()
      });
      
    } catch (error) {
      updateOperation(operationId, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Chat failed',
        endTime: Date.now()
      });
      
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Error: Could not get a response from the model.",
        timestamp: new Date(),
      };

      if (currentSession) {
        const errorSession = {
          ...currentSession,
          messages: [...currentSession.messages, userMessage, errorMessage],
        };
        setCurrentSession(errorSession);
        setSessions(prev => prev.map(s => s.id === currentSession.id ? errorSession : s));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileAttach = (file: File) => {
    setAttachedFiles(prev => [...prev, file]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const left = (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Chat History</h3>
        <button
          onClick={createNewSession}
          style={{
            padding: "4px 8px",
            background: "#2563eb",
            border: "1px solid #2563eb",
            color: "#fff",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          New
        </button>
      </div>
      
      <div style={{ display: "grid", gap: 8 }}>
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => setCurrentSession(session)}
            style={{
              padding: 12,
              background: currentSession?.id === session.id ? "#1e293b" : "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              cursor: "pointer",
              color: "#e2e8f0",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>{session.title}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {session.messages.length} messages • {session.createdAt.toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const right = (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Tab Navigation */}
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
            borderBottom: activeRightTab === "context" ? "2px solid #60a5fa" : "2px solid transparent",
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
            borderBottom: activeRightTab === "parameters" ? "2px solid #60a5fa" : "2px solid transparent",
          }}
        >
          Parameters
        </button>
      </div>

      {/* Tab Content */}
      {activeRightTab === "context" && (
        <div>
          <PromptPresetBox 
            onPromptChange={setContextPrompt} 
            presetStore={chatPresetStore}
          />
        </div>
      )}

      {activeRightTab === "parameters" && (
        <div>
          <PresetManager 
            onPresetChange={(preset) => setContextPrompt(preset.body)} 
            presetStore={chatPresetStore}
          />
          <ParamsPanel params={params} onChange={setParams} />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <LeftRail />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 56 }}>
        {/* Top Bar */}
        <header style={{ 
          height: 48, 
          borderBottom: "1px solid #334155", 
          display: "grid", 
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          padding: "0 16px",
          background: "#0f172a", 
          color: "#e2e8f0" 
        }}>
          {/* Left Section */}
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
          
          {/* Center Section - Model Selector */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ModelSelector />
          </div>
          
          {/* Right Section */}
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
          {/* Left Sidebar */}
          {leftOpen && (
            <aside style={{ width: 300, borderRight: "1px solid #334155", padding: 12, overflow: "auto", background: "#1e293b", color: "#e2e8f0" }}>
              {left}
            </aside>
          )}

          {/* Main Content */}
          <main style={{ flex: 1, padding: 16, overflow: "auto", background: "#0f172a", color: "#e2e8f0", display: "flex", flexDirection: "column" }}>
        {/* Chat Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: 16, border: "1px solid #334155", borderRadius: 8, marginBottom: 16 }}>
          {currentSession?.messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background: message.role === "user" ? "#1e293b" : "#0f172a",
                border: "1px solid #334155",
              }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                {message.role === "user" ? "You" : "Assistant"} • {message.timestamp.toLocaleTimeString()}
              </div>
              <div style={{ whiteSpace: "pre-wrap", color: "#e2e8f0" }}>{message.content}</div>
              {message.files && message.files.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Attached files:</div>
                  {message.files.map((file, index) => (
                    <div key={index} style={{ fontSize: 12, color: "#94a3b8" }}>
                      📎 {file.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div style={{ padding: 12, textAlign: "center", color: "#94a3b8" }}>
              Assistant is typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#e2e8f0",
                  }}
                >
                  <span>📎</span>
                  <span>{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ minWidth: 40, height: 40 }}>
              <FileDrop
                onFile={handleFileAttach}
                accept=".txt,.pdf,.png,.jpg,.jpeg,.tif,.tiff,.docx,.doc"
                label="📎"
              />
            </div>
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: 12,
                border: "1px solid #334155",
                borderRadius: 8,
                background: "#0f172a",
                color: "#e2e8f0",
                resize: "vertical",
                minHeight: 40,
                maxHeight: 120,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || (!messageInput.trim() && attachedFiles.length === 0)}
              style={{
                padding: "8px 16px",
                border: "1px solid #334155",
                borderRadius: 8,
                background: "#1e293b",
                color: "#e2e8f0",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
          </main>

          {/* Right Sidebar */}
          {rightOpen && (
            <aside style={{ width: 340, borderLeft: "1px solid #334155", padding: 12, overflow: "auto", background: "#1e293b", color: "#e2e8f0" }}>
              {right}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}