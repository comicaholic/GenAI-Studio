// frontend/src/components/Settings/UISettings.tsx
import React, { useState, useEffect } from 'react';
import { Settings } from '@/types/settings';

interface UISettingsProps {
  settings: Settings;
  onUpdateSetting: (path: string, value: any) => void;
  onSaveSettings: () => Promise<void>;
  isSaving: boolean;
}

export default function UISettings({ settings, onUpdateSetting, onSaveSettings, isSaving }: UISettingsProps) {
  const [bgTheme, setBgTheme] = useState<string>(() => localStorage.getItem("app:bgTheme") || "gradient");

  useEffect(() => {
    localStorage.setItem("app:bgTheme", bgTheme);
    const root = document.querySelector("body");
    if (!root) return;
    root.classList.remove("bg-grid", "bg-noise", "bg-gradient");
    root.classList.add(bgTheme === "grid" ? "bg-grid" : bgTheme === "noise" ? "bg-noise" : "bg-gradient");
  }, [bgTheme]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 }}>
          UI & Appearance
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
          Customize the look and feel of your application
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Theme Selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>
            Theme
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" }
            ].map((theme) => (
              <button
                key={theme.value}
                onClick={() => onUpdateSetting("ui.theme", theme.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  border: `1px solid ${settings.ui.theme === theme.value ? "#3b82f6" : "#334155"}`,
                  borderRadius: 8,
                  background: settings.ui.theme === theme.value ? "#1e293b" : "#0f172a",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: theme.value === "dark" ? "#1f2937" : "#f9fafb",
                  border: `2px solid ${theme.value === "dark" ? "#374151" : "#d1d5db"}`,
                }} />
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* Background Theme */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>
            Background Style
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { value: "gradient", label: "Gradient" },
              { value: "grid", label: "Grid" },
              { value: "noise", label: "Noise" }
            ].map((bg) => (
              <button
                key={bg.value}
                onClick={() => setBgTheme(bg.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  border: `1px solid ${bgTheme === bg.value ? "#3b82f6" : "#334155"}`,
                  borderRadius: 8,
                  background: bgTheme === bg.value ? "#1e293b" : "#0f172a",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: bg.value === "gradient" ? "linear-gradient(45deg, #3b82f6, #8b5cf6)" :
                             bg.value === "grid" ? "repeating-linear-gradient(0deg, transparent, transparent 2px, #374151 2px, #374151 4px)" :
                             "radial-gradient(circle, #374151 1px, transparent 1px)",
                  backgroundSize: bg.value === "noise" ? "8px 8px" : "auto",
                }} />
                {bg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Default Landing Page */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>
            Default Landing Page
          </label>
          <select
            value={settings.ui.defaultLandingPage}
            onChange={(e) => onUpdateSetting("ui.defaultLandingPage", e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #334155",
              borderRadius: 8,
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: 14,
              maxWidth: 300,
            }}
          >
            <option value="/">Home</option>
            <option value="/chat">Chat</option>
            <option value="/models">Models</option>
            <option value="/ocr">OCR</option>
            <option value="/prompt-eval">Prompt Evaluation</option>
            <option value="/custom">Custom</option>
            <option value="/analytics">Analytics</option>
          </select>
        </div>

        {/* Background State Management */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="checkbox"
            id="backgroundStateManagement"
            checked={settings.ui.backgroundStateManagement}
            onChange={(e) => onUpdateSetting("ui.backgroundStateManagement", e.target.checked)}
            style={{
              width: 16,
              height: 16,
              accentColor: "#3b82f6",
            }}
          />
          <label htmlFor="backgroundStateManagement" style={{ fontSize: 14, color: "#e2e8f0", cursor: "pointer" }}>
            Keep pages alive in background
          </label>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", marginTop: -8 }}>
          When enabled, pages remain mounted when switching tabs, preserving their state
        </p>

        {/* Text Box Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="checkbox"
              id="textBoxCharacterLimitEnabled"
              checked={settings.ui.textBoxCharacterLimitEnabled}
              onChange={(e) => onUpdateSetting("ui.textBoxCharacterLimitEnabled", e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "#3b82f6",
              }}
            />
            <label htmlFor="textBoxCharacterLimitEnabled" style={{ fontSize: 14, color: "#e2e8f0", cursor: "pointer" }}>
              Enable character limit for text boxes
            </label>
          </div>
          
          {settings.ui.textBoxCharacterLimitEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 14, color: "#e2e8f0" }}>
                Character Limit:
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={settings.ui.textBoxCharacterLimit}
                onChange={(e) => onUpdateSetting("ui.textBoxCharacterLimit", parseInt(e.target.value))}
                style={{
                  padding: "6px 8px",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 14,
                  width: 100,
                }}
              />
            </div>
          )}
        </div>

        {/* Text Box Default Expansion */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>
            Text Box Default Expansion
          </label>
          <select
            value={settings.ui.textBoxDefaultExpansion}
            onChange={(e) => onUpdateSetting("ui.textBoxDefaultExpansion", e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #334155",
              borderRadius: 8,
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: 14,
              maxWidth: 300,
            }}
          >
            <option value="all-collapsed">All Collapsed</option>
            <option value="all-expanded">All Expanded</option>
            <option value="first-expanded">First Expanded</option>
          </select>
        </div>

        {/* API Connection Visibility Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>
            API Connection Visibility on Home Page
          </label>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
            Choose which API connections to display on the home page
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { key: "groq", label: "Groq API", defaultOn: true },
              { key: "ollama", label: "Ollama API", defaultOn: true },
              { key: "lmstudio", label: "LM Studio", defaultOn: false },
              { key: "huggingface", label: "Hugging Face", defaultOn: false }
            ].map((api) => (
              <div key={api.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="checkbox"
                  id={`showApi-${api.key}`}
                  checked={settings.ui.showApiConnections[api.key as keyof typeof settings.ui.showApiConnections]}
                  onChange={(e) => onUpdateSetting(`ui.showApiConnections.${api.key}`, e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: "#3b82f6",
                  }}
                />
                <label htmlFor={`showApi-${api.key}`} style={{ fontSize: 14, color: "#e2e8f0", cursor: "pointer" }}>
                  {api.label}
                </label>
                {api.defaultOn && (
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>
                    (Default: On)
                  </span>
                )}
                {!api.defaultOn && (
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
                    (Default: Off)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #334155" }}>
          <button
            onClick={onSaveSettings}
            disabled={isSaving}
            style={{
              padding: "12px 24px",
              background: isSaving ? "#374151" : "#10b981",
              border: "none",
              borderRadius: 8,
              color: "#ffffff",
              cursor: isSaving ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isSaving ? (
              <>
                <div style={{
                  width: 16,
                  height: 16,
                  border: "2px solid #ffffff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }} />
                Saving...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/>
                </svg>
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
