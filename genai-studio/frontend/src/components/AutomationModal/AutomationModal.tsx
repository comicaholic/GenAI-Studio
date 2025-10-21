// src/components/AutomationModal/AutomationModal.tsx
import React, { useState, useCallback } from 'react';
import { ModelParams } from '@/components/RightPanel/ParamsPanel';
import { MetricState } from '@/components/RightPanel/MetricsPanel';
import ParamsPanel from '@/components/RightPanel/ParamsPanel';
import MetricsPanel from '@/components/RightPanel/MetricsPanel';
import PromptPresetBox from '@/components/PresetPanel/PromptPresetBox';
import PresetManager from '@/components/PresetPanel/PresetManager';
import { Preset } from '@/stores/presetStore';
import { useModel } from '@/context/ModelContext';
import axios from 'axios';
import { useNotifications } from '@/components/Notification/Notification';

export interface AutomationRun {
  id: string;
  name: string;
  prompt: string;
  parameters: ModelParams;
  metrics: MetricState;
  // Optional per-run model override
  modelId?: string;
  modelProvider?: string;
  // Optional per-run files (used by OCR/Prompt kinds)
  sourceFileName?: string;
  promptFileName?: string;
  referenceFileName?: string;
  // Tracking which preset was used for UX display
  presetTitle?: string;
  results?: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

export interface AutomationConfig {
  id: string;
  name: string;
  runs: AutomationRun[];
  status: 'pending' | 'running' | 'completed' | 'error';
  createdAt: string;
  completedAt?: string;
}

interface AutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: AutomationConfig) => void;
  presetStore: any;
  defaultPrompt?: string;
  kind?: 'ocr' | 'prompt' | 'chat';
}

const DEFAULT_PARAMS: ModelParams = { temperature: 0.7, max_tokens: 1024, top_p: 1.0, top_k: 40 };
const DEFAULT_METRICS: MetricState = {
  rouge: false,
  bleu: false,
  f1: false,
  em: false,
  em_avg: false,
  bertscore: false,
  perplexity: false,
  accuracy: false,
  accuracy_avg: false,
  precision: false,
  precision_avg: false,
  recall: false,
  recall_avg: false,
};

export default function AutomationModal({ 
  isOpen, 
  onClose, 
  onStart, 
  presetStore, 
  defaultPrompt = "",
  kind = 'prompt'
}: AutomationModalProps) {
  const [numRuns, setNumRuns] = useState(2);
  const [automationName, setAutomationName] = useState("");
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [sourceChoices, setSourceChoices] = useState<string[]>([]);
  const [referenceChoices, setReferenceChoices] = useState<string[]>([]);
  const [activeRunIndex, setActiveRunIndex] = useState(0);
  const { selected } = useModel();
  const { showError } = useNotifications();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Initialize runs when numRuns changes (preserve existing selections)
  React.useEffect(() => {
    setRuns(prev => {
      const current = prev ?? [];
      if (numRuns === current.length) return current;
      if (numRuns < current.length) {
        // Truncate but keep existing data
        return current.slice(0, numRuns);
      }
      // Append new runs cloning the last run's selections where possible
      const toAdd = numRuns - current.length;
      const template = current[current.length - 1];
      const baseModelId = template?.modelId || selected?.id;
      const baseModelProvider = template?.modelProvider || selected?.provider;
      const appended: AutomationRun[] = Array.from({ length: toAdd }, (_, j) => ({
        id: crypto.randomUUID(),
        name: `Run ${current.length + j + 1}`,
        prompt: template?.prompt ?? defaultPrompt,
        parameters: { ...(template?.parameters || DEFAULT_PARAMS) },
        metrics: { ...(template?.metrics || DEFAULT_METRICS) },
        modelId: baseModelId,
        modelProvider: baseModelProvider,
        presetTitle: template?.presetTitle,
        status: 'pending',
      }));
      return [...current, ...appended];
    });
    // keep activeRunIndex if still valid
    setActiveRunIndex((idx) => Math.min(idx, Math.max(0, numRuns - 1)));
  }, [numRuns, defaultPrompt, selected?.id, selected?.provider]);

  // Load file lists if needed
  React.useEffect(() => {
    (async () => {
      try {
        const mod = await import('@/services/files');
        if (kind !== 'chat') {
          const s = await mod.listFiles('source');
          setSourceChoices(s.files ?? []);
          const r = await mod.listFiles('reference');
          setReferenceChoices(r.files ?? []);
        }
      } catch {
        // ignore
      }
    })();
  }, [kind]);

  // ---------- model list for per-run selection ----------
  type Provider = 'local' | 'groq';
  type ModelInfo = { id: string; label: string; provider: Provider };
  type ListResponse = { local: any[]; groq: any[] };
  const [localModels, setLocalModels] = useState<ModelInfo[]>([]);
  const [groqModels, setGroqModels] = useState<ModelInfo[]>([]);

  const prettifyModelId = (id?: string | null) => {
    if (!id) return 'Unknown model';
    const parts = String(id).trim().split(/[/:]/);
    const last = parts[parts.length - 1] || id;
    return last.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get<ListResponse>('/api/models/list', { params: { include_groq: true } });
        const normalize = (raw: any, provider: Provider): ModelInfo => ({
          id: String(raw?.id || raw?.name || raw?.model_id || raw?.model || ''),
          label: String(raw?.label && String(raw.label).trim() ? raw.label : prettifyModelId(raw?.id || raw?.name)),
          provider
        });
        setLocalModels((data.local || []).map((m: any) => normalize(m, 'local')));
        setGroqModels((data.groq || []).map((m: any) => normalize(m, 'groq')));
      } catch {
        setLocalModels([]); setGroqModels([]);
      }
    })();
  }, []);

  const updateRun = useCallback((index: number, updates: Partial<AutomationRun>) => {
    setRuns(prev => prev.map((run, i) => 
      i === index ? { ...run, ...updates } : run
    ));
  }, []);

  const handleStart = useCallback(() => {
    // Build config, filling missing per-run model with globally selected model if available
    const name = (automationName && automationName.trim()) ? automationName.trim() : `Automation ${new Date().toLocaleDateString('en-GB')}`;

    const preparedRuns = runs.map(run => ({
      ...run,
      modelId: run.modelId || selected?.id,
      modelProvider: run.modelProvider || (selected?.provider as any),
      status: 'pending' as const,
    }));

    // If no run has any model at all, show an error
    const anyModel = preparedRuns.some(r => !!r.modelId);
    if (!anyModel) {
      showError("Model Required", "Select a model in the header or per-run before starting.");
      return;
    }

    const config: AutomationConfig = {
      id: crypto.randomUUID(),
      name,
      runs: preparedRuns,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    onStart(config);
    onClose();
  }, [selected?.id, selected?.provider, automationName, runs, onStart, onClose, showError]);

  // Export current automation config to JSON
  const handleExport = useCallback(() => {
    const payload = {
      name: automationName || 'Automation',
      runs: runs.map(r => ({
        id: r.id,
        name: r.name,
        prompt: r.prompt,
        parameters: r.parameters,
        metrics: r.metrics,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(automationName || 'automation').replace(/[^a-z0-9\-_]+/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }, [automationName, runs]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImport = useCallback(async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.name) setAutomationName(String(data.name));
      if (Array.isArray(data.runs)) {
        const imported: AutomationRun[] = data.runs.map((r: any, i: number) => ({
          id: r.id || crypto.randomUUID(),
          name: r.name || `Run ${i + 1}`,
          prompt: r.prompt ?? defaultPrompt,
          parameters: { ...DEFAULT_PARAMS, ...(r.parameters || {}) },
          metrics: { ...DEFAULT_METRICS, ...(r.metrics || {}) },
          status: 'pending',
        }));
        setRuns(imported);
        setNumRuns(imported.length);
        setActiveRunIndex(0);
      }
      evt.target.value = '';
    } catch (e: any) {
      showError('Import Failed', e?.message ?? 'Could not import automation configuration');
    }
  }, [defaultPrompt, showError]);

  if (!isOpen) return null;

  const currentRun = runs[activeRunIndex];

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
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Run Automation</h2>
          <input type="file" accept="application/json" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
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
              Number of Runs
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
            Select Run to Configure
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {runs.map((run, index) => (
              <button
                key={run.id}
                onClick={() => setActiveRunIndex(index)}
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

        {/* Run Configuration */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24, overflow: "auto", minHeight: 0 }}>
          {/* Left Column - Prompt */}
          <div>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 500 }}>Prompt Configuration</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
                Run Name
              </label>
              <input
                type="text"
                value={currentRun?.name || ""}
                onChange={(e) => updateRun(activeRunIndex, { name: e.target.value })}
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
                presetStore={presetStore}
                onPresetChange={(preset: { title: string; body: string; id: string; parameters?: Preset['parameters']; metrics?: any }) => {
                  updateRun(activeRunIndex, {
                    prompt: preset.body || '',
                    parameters: {
                      ...currentRun?.parameters,
                      ...(preset.parameters || {}),
                    } as ModelParams,
                    metrics: {
                      ...(currentRun?.metrics || {}),
                      ...(preset.metrics || {}),
                    } as MetricState,
                    presetTitle: preset.title,
                  });
                }}
                autoApplyOnMount={false}
                currentContent={currentRun?.prompt || ''}
                currentParameters={currentRun?.parameters || DEFAULT_PARAMS}
              currentMetrics={currentRun?.metrics || DEFAULT_METRICS}
              selectedPresetTitle={currentRun?.presetTitle}
              />
              {currentRun?.presetTitle && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                  Preset: <span style={{ color: '#e2e8f0' }}>{currentRun.presetTitle}</span>
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>Prompt</label>
              <textarea
                value={currentRun?.prompt || ''}
                onChange={(e) => updateRun(activeRunIndex, { prompt: e.target.value })}
                placeholder="Enter prompt..."
                style={{
                  width: '100%',
                  minHeight: 220,
                  resize: 'vertical',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: 12,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Right Column - Parameters & Metrics */}
          <div>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 500 }}>Parameters & Metrics</h3>
            {/* Per-run model selection (from available models) */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Model</label>
              <select
                value={currentRun?.modelId || selected?.id || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  const found = [...localModels, ...groqModels].find(m => m.id === id);
                  updateRun(activeRunIndex, { modelId: id, modelProvider: (found?.provider || selected?.provider) as any });
                }}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #334155', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', fontSize: 14 }}
              >
                {selected?.id && (
                  <option value={selected.id}>{prettifyModelId(selected.id)} ({selected.provider})</option>
                )}
                {localModels.length > 0 && (
                  <optgroup label="Local">
                    {localModels.map(m => (
                      <option key={m.id} value={m.id}>{m.label} (local)</option>
                    ))}
                  </optgroup>
                )}
                {groqModels.length > 0 && (
                  <optgroup label="Groq">
                    {groqModels.map(m => (
                      <option key={m.id} value={m.id}>{m.label} (groq)</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            {/* Per-run file selectors (only for OCR and Prompt kinds) */}
            {kind !== 'chat' && (
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                {kind === 'ocr' && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Source File (OCR)</label>
                      <select
                        value={(runs[activeRunIndex] as any)?.sourceFileName || ''}
                        onChange={(e) => updateRun(activeRunIndex, { ...(runs[activeRunIndex] as any), ...( { sourceFileName: e.target.value } as any) })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #334155', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', fontSize: 14 }}
                      >
                        <option value="">Select a source file…</option>
                        {sourceChoices.map((f) => (<option key={f} value={f}>{f}</option>))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Reference File</label>
                      <select
                        value={(runs[activeRunIndex] as any)?.referenceFileName || ''}
                        onChange={(e) => updateRun(activeRunIndex, { ...(runs[activeRunIndex] as any), ...( { referenceFileName: e.target.value } as any) })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #334155', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', fontSize: 14 }}
                      >
                        <option value="">Select a reference file…</option>
                        {referenceChoices.map((f) => (<option key={f} value={f}>{f}</option>))}
                      </select>
                    </div>
                  </>
                )}
                {kind === 'prompt' && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Prompt File</label>
                      <select
                        value={(runs[activeRunIndex] as any)?.promptFileName || ''}
                        onChange={(e) => updateRun(activeRunIndex, { ...(runs[activeRunIndex] as any), ...( { promptFileName: e.target.value } as any) })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #334155', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', fontSize: 14 }}
                      >
                        <option value="">Select a prompt file…</option>
                        {sourceChoices.map((f) => (<option key={f} value={f}>{f}</option>))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>Reference File</label>
                      <select
                        value={(runs[activeRunIndex] as any)?.referenceFileName || ''}
                        onChange={(e) => updateRun(activeRunIndex, { ...(runs[activeRunIndex] as any), ...( { referenceFileName: e.target.value } as any) })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #334155', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', fontSize: 14 }}
                      >
                        <option value="">Select a reference file…</option>
                        {referenceChoices.map((f) => (<option key={f} value={f}>{f}</option>))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 500 }}>Parameters</h4>
              <ParamsPanel
                params={currentRun?.parameters || DEFAULT_PARAMS}
                onChange={(params) => updateRun(activeRunIndex, { parameters: params })}
              />
            </div>
            <div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 500 }}>Metrics</h4>
              <MetricsPanel
                metrics={currentRun?.metrics || DEFAULT_METRICS}
                onChange={(metrics) => updateRun(activeRunIndex, { metrics })}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleImportClick}
              style={{
                padding: "10px 16px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Import
            </button>
            <button
              onClick={handleExport}
              style={{
                padding: "10px 16px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Export
            </button>
          </div>
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
