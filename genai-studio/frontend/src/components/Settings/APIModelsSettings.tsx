// frontend/src/components/Settings/APIModelsSettings.tsx
import React from 'react';
import { Settings } from '@/types/settings';

interface APIModelsSettingsProps {
  settings: Settings;
  onUpdateSetting: (path: string, value: any) => void;
  onTestGroqConnection: () => Promise<void>;
  onTestHuggingFaceConnection: () => Promise<void>;
  onTestLmStudioConnection: () => Promise<void>;
  onTestOllamaConnection: () => Promise<void>;
  onTestOllamaApiConnection: () => Promise<void>;
  onTestVllmConnection: () => Promise<void>;
  testingStates: {
    groq: boolean;
    huggingface: boolean;
    lmstudio: boolean;
    ollama: boolean;
    ollamaApi: boolean;
    vllm: boolean;
  };
}

export default function APIModelsSettings({
  settings,
  onUpdateSetting,
  onTestGroqConnection,
  onTestHuggingFaceConnection,
  onTestLmStudioConnection,
  onTestOllamaConnection,
  onTestOllamaApiConnection,
  onTestVllmConnection,
  testingStates,
}: APIModelsSettingsProps) {
  const TipsCard = ({ 
    title, 
    tips, 
    isVisible, 
    onToggle 
  }: { 
    title: string; 
    tips: string[]; 
    isVisible: boolean; 
    onToggle: () => void; 
  }) => (
    <div style={{ marginTop: 16 }}>
      {isVisible && (
        <div style={{
          marginTop: 8,
          padding: 16,
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 6, 
            marginBottom: 12,
            color: "#e2e8f0",
            fontWeight: 600,
            fontSize: 14
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
            </svg>
            Setup Guide
          </div>
          {tips.map((tip, index) => (
            <div key={index} style={{ marginBottom: 8, color: "#cbd5e1" }}>
              {tip.split(/(\*\*.*?\*\*|`.*?`)/).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={i} style={{ color: "#e2e8f0", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                } else if (part.startsWith('`') && part.endsWith('`')) {
                  return <code key={i} style={{ 
                    background: "#374151", 
                    padding: "2px 6px", 
                    borderRadius: 4, 
                    fontSize: 12,
                    color: "#fbbf24",
                    fontFamily: "monospace"
                  }}>{part.slice(1, -1)}</code>;
                }
                return part;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const ConnectionCard = ({ 
    title, 
    description, 
    icon, 
    children,
    tips 
  }: { 
    title: string; 
    description: string; 
    icon: React.ReactNode; 
    children: React.ReactNode;
    tips?: string[];
  }) => {
    const [showTips, setShowTips] = React.useState(false);
    
    return (
      <div style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>
              {title}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
              {description}
            </p>
          </div>
          {tips && tips.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTips(!showTips)}
              style={{
                padding: "6px 12px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: showTips ? "#1e293b" : "#0f172a",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1e293b";
                e.currentTarget.style.borderColor = "#475569";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = showTips ? "#1e293b" : "#0f172a";
                e.currentTarget.style.borderColor = "#334155";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
              </svg>
              Tips
            </button>
          )}
        </div>
        
        {children}
        
        {tips && tips.length > 0 && (
          <TipsCard 
            title={`${title} Setup Guide`}
            tips={tips}
            isVisible={showTips}
            onToggle={() => setShowTips(!showTips)}
          />
        )}
      </div>
    );
  };

  const TestButton = ({ 
    onClick, 
    isLoading, 
    connected 
  }: { 
    onClick: () => void; 
    isLoading: boolean; 
    connected: boolean; 
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      disabled={isLoading}
      style={{
        padding: "8px 16px",
        border: `1px solid ${connected ? "#10b981" : "#334155"}`,
        borderRadius: 6,
        background: connected ? "#10b981" : "#0f172a",
        color: "#ffffff",
        cursor: isLoading ? "not-allowed" : "pointer",
        fontSize: 12,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: 6,
        opacity: isLoading ? 0.6 : 1,
      }}
    >
      {isLoading ? (
        <>
          <div style={{
            width: 12,
            height: 12,
            border: "2px solid #ffffff",
            borderTop: "2px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
          Testing...
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
          </svg>
          {connected ? "Connected" : "Test Connection"}
        </>
      )}
    </button>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 }}>
          API Models
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          Configure connections to external AI model providers
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Groq */}
        <ConnectionCard
          title="Groq"
          description="Fast inference for open-source models"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
            </svg>
          }
          tips={[
            "Get your **API key** from `console.groq.com`",
            "Groq provides **ultra-fast inference** for Llama models",
            "**Free tier** includes generous usage limits (14,400 requests/day)",
            "Supports **streaming responses** for better user experience",
            "Models available: `llama-3.1-8b-instant`, `llama-3.1-70b-versatile`, `mixtral-8x7b-32768`"
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", marginBottom: 6, display: "block" }}>
                API Key
              </label>
              <input
                type="password"
                value={settings.groq.apiKey}
                onChange={(e) => onUpdateSetting("groq.apiKey", e.target.value)}
                placeholder="Enter your Groq API key"
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: settings.groq.connected ? "#10b981" : "#ef4444" }}>
                {settings.groq.connected ? "Connected" : "Not connected"}
              </span>
              <TestButton
                onClick={onTestGroqConnection}
                isLoading={testingStates.groq}
                connected={settings.groq.connected}
              />
            </div>
          </div>
        </ConnectionCard>

        {/* Hugging Face */}
        <ConnectionCard
          title="Hugging Face"
          description="Access to thousands of open-source models"
          icon={
            <img 
              src="/assets/hf-logo.svg" 
              alt="Hugging Face" 
              style={{ width: 20, height: 20 }}
            />
          }
          tips={[
            "Create a **token** at `huggingface.co/settings/tokens`",
            "Tokens must start with **`hf_`** prefix",
            "Ensure your **email is verified** on Hugging Face",
            "Token needs **'Read' permissions** for model access",
            "Popular models: `microsoft/DialoGPT-medium`, `facebook/blenderbot-400M-distill`, `EleutherAI/gpt-neo-2.7B`"
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", marginBottom: 6, display: "block" }}>
                Access Token
              </label>
              <input
                type="password"
                value={settings.huggingface.token}
                onChange={(e) => onUpdateSetting("huggingface.token", e.target.value)}
                placeholder="hf_..."
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: settings.huggingface.connected ? "#10b981" : "#ef4444" }}>
                {settings.huggingface.connected ? "Connected" : "Not connected"}
              </span>
              <TestButton
                onClick={onTestHuggingFaceConnection}
                isLoading={testingStates.huggingface}
                connected={settings.huggingface.connected}
              />
            </div>
          </div>
        </ConnectionCard>

        {/* LM Studio */}
        <ConnectionCard
          title="LM Studio"
          description="Local OpenAI-compatible server"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4,6H20V16H4M20,18A2,2 0 0,0 22,16V6C22,4.89 21.1,4 20,4H4C2.89,4 2,4.89 2,6V16A2,2 0 0,0 4,18H0V20H24V18H20Z"/>
            </svg>
          }
          tips={[
            "Download **LM Studio** from `lmstudio.ai`",
            "Start a **local server** in the app (default port `1234`)",
            "Supports **OpenAI-compatible API** calls",
            "Load models locally for **privacy** and **offline use**",
            "Recommended models: `Llama-2-7B-Chat`, `CodeLlama-7B-Instruct`, `Mistral-7B-Instruct`"
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", marginBottom: 6, display: "block" }}>
                Base URL
              </label>
              <input
                type="url"
                value={settings.lmstudio?.baseUrl || "http://localhost:1234"}
                onChange={(e) => onUpdateSetting("lmstudio.baseUrl", e.target.value)}
                placeholder="http://localhost:1234"
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: settings.lmstudio?.connected ? "#10b981" : "#ef4444" }}>
                {settings.lmstudio?.connected ? "Connected" : "Not connected"}
              </span>
              <TestButton
                onClick={onTestLmStudioConnection}
                isLoading={testingStates.lmstudio}
                connected={settings.lmstudio?.connected || false}
              />
            </div>
          </div>
        </ConnectionCard>

        {/* Ollama */}
        <ConnectionCard
          title="Ollama"
          description="Local model runner and cloud API"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
            </svg>
          }
          tips={[
            "Install **Ollama** from `ollama.com`",
            "Run `ollama serve` to start **local server** (port `11434`)",
            "For **cloud API**: Sign up at `ollama.com` and get API key",
            "**Cloud API key** accesses Ollama's cloud models directly",
            "**No desktop app needed** for cloud API access",
            "Popular models: `llama2`, `codellama`, `mistral`, `neural-chat`"
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", marginBottom: 6, display: "block" }}>
                Local Server URL
              </label>
              <input
                type="url"
                value={settings.ollama?.baseUrl || "http://localhost:11434"}
                onChange={(e) => onUpdateSetting("ollama.baseUrl", e.target.value)}
                placeholder="http://localhost:11434"
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
              <label style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", marginBottom: 6, display: "block" }}>
                Cloud API Key (Optional)
              </label>
              <input
                type="password"
                value={settings.ollama?.apiKey || ""}
                onChange={(e) => onUpdateSetting("ollama.apiKey", e.target.value)}
                placeholder="Enter Ollama cloud API key"
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: settings.ollama?.connected ? "#10b981" : "#ef4444" }}>
                  Local: {settings.ollama?.connected ? "Connected" : "Not connected"}
                </span>
                <span style={{ fontSize: 12, color: settings.ollama?.apiConnected ? "#10b981" : "#ef4444" }}>
                  Cloud: {settings.ollama?.apiConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <TestButton
                  onClick={onTestOllamaConnection}
                  isLoading={testingStates.ollama}
                  connected={settings.ollama?.connected || false}
                />
                <TestButton
                  onClick={onTestOllamaApiConnection}
                  isLoading={testingStates.ollamaApi}
                  connected={settings.ollama?.apiConnected || false}
                />
              </div>
            </div>
          </div>
        </ConnectionCard>

        {/* vLLM */}
        <ConnectionCard
          title="vLLM"
          description="High-throughput LLM serving"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
            </svg>
          }
          tips={[
            "Install **vLLM**: `pip install vllm`",
            "Start server: `python -m vllm.entrypoints.openai.api_server`",
            "Default port is **`8000`**",
            "Requires **CUDA-compatible GPU**",
            "Supports **batch processing** for efficiency",
            "Best for **production deployments** with high throughput"
          ]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", marginBottom: 6, display: "block" }}>
                Base URL
              </label>
              <input
                type="url"
                value={settings.vllm?.baseUrl || "http://localhost:8000"}
                onChange={(e) => onUpdateSetting("vllm.baseUrl", e.target.value)}
                placeholder="http://localhost:8000"
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: settings.vllm?.connected ? "#10b981" : "#ef4444" }}>
                {settings.vllm?.connected ? "Connected" : "Not connected"}
              </span>
              <TestButton
                onClick={onTestVllmConnection}
                isLoading={testingStates.vllm}
                connected={settings.vllm?.connected || false}
              />
            </div>
          </div>
        </ConnectionCard>
      </div>
    </div>
  );
}
