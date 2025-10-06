// src/pages/PromptEval/PromptEvalPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import LeftRail from '@/components/LeftRail/LeftRail';

import FileDrop from '@/components/FileDrop/FileDrop';
import ExpandableTextarea from '@/components/ExpandableTextarea/ExpandableTextarea';
import PromptPresetBox from '@/components/PresetPanel/PromptPresetBox';
import PresetManager from '@/components/PresetPanel/PresetManager';
import ParamsPanel, { ModelParams } from '@/components/RightPanel/ParamsPanel';
import MetricsPanel, { DEFAULT_METRICS, MetricState } from '@/components/RightPanel/MetricsPanel';
import { useModel } from '@/context/ModelContext';
import { promptEvalStore } from '@/stores/promptEvalStore';
import { resourceStore } from '@/stores/resourceStore';
import { callLLM, estimateTokens } from '@/lib/llm';
import { RunResult } from '@/types/promptEval';
import { api } from '@/services/api';
import { listFiles, loadReferenceByName } from '@/services/files';
import { computeMetrics, downloadCSV, downloadPDF } from '@/services/eval';
import { useNotifications } from '@/components/Notification/Notification';
import UploadPanel from './components/UploadPanel';
import { promptEvalPresetStore } from '@/stores/presetStore';
import { useBackgroundState } from '@/stores/backgroundState';
import { historyService } from '@/services/history';

const DEFAULT_PARAMS: ModelParams = { temperature: 0.7, max_tokens: 1000, top_p: 1.0, top_k: 40 };

export default function PromptEvalPage() {
  // Sidebar state
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Main state
  const { selected } = useModel();
  const [draft, setDraft] = useState(promptEvalStore.getDraft());
  const [runHistory, setRunHistory] = useState(promptEvalStore.getRunHistory());
  const [currentRun, setCurrentRun] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'prompt' | 'parameters' | 'metrics'>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Parameters and metrics
  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS);
  const [metricsState, setMetricsState] = useState<MetricState>(DEFAULT_METRICS);

  // File handling
  const [promptFileName, setPromptFileName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [refFileName, setRefFileName] = useState("");
  const [reference, setReference] = useState("");
  const [promptChoices, setPromptChoices] = useState<string[]>([]);
  const [referenceChoices, setReferenceChoices] = useState<string[]>([]);

  // Evaluation results
  const [scores, setScores] = useState<Record<string, any> | null>(null);
  const [llmOutput, setLlmOutput] = useState("");

  const { showError, showSuccess } = useNotifications();
  const { addOperation, updateOperation } = useBackgroundState();

  // Load initial state (store draft)
  useEffect(() => {
    const storedDraft = promptEvalStore.getDraft();
    setDraft(storedDraft);
  }, []);

  // Load file choices (safe)
  useEffect(() => {
    (async () => {
      try {
        const p = await listFiles("source");
        if (p?.files) setPromptChoices(p.files);
      } catch {
        // ignore; optional
      }

      try {
        const r = await listFiles("reference");
        if (r?.files) setReferenceChoices(r.files);
      } catch {
        // ignore
      }
    })();
  }, []);

  // updateDraft uses functional update to avoid stale closures
  const updateDraft = useCallback((updates: Partial<typeof draft>) => {
    setDraft((prevDraft) => {
      const newDraft = { ...prevDraft, ...updates };
      // propagate to store (keep your existing store usage)
      if (updates.prompt !== undefined) promptEvalStore.updatePrompt(updates.prompt);
      if (updates.context !== undefined) promptEvalStore.updateContext(updates.context);
      if (updates.parameters) promptEvalStore.updateParameters(updates.parameters as any);
      if ((updates as any).selectedModelId !== undefined) promptEvalStore.updateSelectedModel((updates as any).selectedModelId);
      if ((updates as any).resourceIds) promptEvalStore.updateResourceIds((updates as any).resourceIds);
      return newDraft;
    });
  }, []);

  // File upload handlers
  const onPromptUpload = async (file: File) => {
    setBusy("Processing prompt file...");
    try {
      const text = await file.text();
      setPromptFileName(file.name);
      setPromptText(text);
      updateDraft({ prompt: text });
    } catch (e: any) {
      showError("Upload Failed", "Failed to process prompt file: " + (e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const onReferenceUpload = async (file: File) => {
    setBusy("Processing reference file...");
    try {
      const text = await file.text();
      setRefFileName(file.name);
      setReference(text);
    } catch (e: any) {
      showError("Upload Failed", "Failed to process reference file: " + (e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  // Handle run
  const handleRun = useCallback(async () => {
    if (!selected) {
      setError('Please select a model');
      return;
    }

    if (!draft?.prompt?.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsRunning(true);
    setError(null);
    setBusy('Running prompt...');

    const runId = crypto.randomUUID?.() ?? (Date.now().toString() + Math.random().toString());
    const startTime = Date.now();
    const resources = resourceStore.getByIds(draft.resourceIds || []);

    const runResult: RunResult = {
      id: runId,
      startedAt: startTime,
      finishedAt: 0,
      output: '',
      modelId: selected.id,
      resources,
      prompt: draft.prompt,
      context: draft.context,
      parameters: draft.parameters || params,
    };

    setCurrentRun(runResult);

    try {
      const abortController = new AbortController();
      let output = '';

      // callLLM is an async iterable (stream); iterate chunks
      for await (const chunk of callLLM({
        modelId: selected.id,
        prompt: draft.prompt,
        context: draft.context,
        resources,
        parameters: draft.parameters,
        signal: abortController.signal,
      })) {
        output += chunk;
        setCurrentRun(prev => prev ? { ...prev, output } : null);
      }

      const endTime = Date.now();
      const finalResult: RunResult = {
        ...runResult,
        finishedAt: endTime,
        output,
        usage: {
          promptTokens: estimateTokens((draft.prompt || '') + (draft.context || '')),
          completionTokens: estimateTokens(output),
          totalTokens: estimateTokens((draft.prompt || '') + (draft.context || '') + output),
        },
      };

      setCurrentRun(finalResult);
      setLlmOutput(output);
      try {
        promptEvalStore.addRunResult(finalResult);
        setRunHistory(promptEvalStore.getRunHistory());
      } catch {
        // store ops are best-effort
      }

    } catch (error: any) {
      const endTime = Date.now();
      const errorResult: RunResult = {
        ...runResult,
        finishedAt: endTime,
        error: error?.message ?? String(error),
      };

      setCurrentRun(errorResult);
      setError(error?.message ?? String(error));
    } finally {
      setIsRunning(false);
      setBusy(null);
    }
  }, [selected, draft, params]);

  // Handle evaluation
  const onEvaluate = useCallback(async () => {
    if (!selected) {
      showError("Model Required", "Select a model first.");
      return;
    }
    if (!draft?.prompt?.trim()) {
      showError("Prompt Required", "Select or write a prompt first.");
      return;
    }
    if (!reference?.trim()) {
      showError("Missing Reference", "Provide reference text first.");
      return;
    }

    setBusy("Computing metrics...");

    const operationId = addOperation({
      type: 'prompt',
      status: 'running',
      progress: 0
    });

    try {
      const res = await computeMetrics({
        prediction: llmOutput || currentRun?.output || "",
        reference,
        metrics: Object.keys(metricsState).filter(key => (metricsState as any)[key]),
        meta: {
          model: selected.id,
          params,
          source_file: promptFileName,
          reference_file: refFileName,
        },
      });

      setScores(res.scores ?? res);
      
      // Save evaluation to history (best-effort)
      try {
        const evaluation = {
          id: crypto.randomUUID?.() ?? (Date.now().toString() + Math.random().toString()),
          type: 'prompt' as const,
          title: `Prompt Evaluation - ${new Date().toLocaleDateString()}`,
          model: { id: selected.id, provider: selected.provider },
          parameters: params,
          metrics: Object.keys(metricsState).filter(key => (metricsState as any)[key]),
          usedText: {
            promptText: draft.prompt,
            context: draft.context,
            referenceText: reference
          },
          files: {
            promptFileName,
            referenceFileName: refFileName
          },
          results: res.scores ?? res,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString()
        };
        await historyService.saveEvaluation?.(evaluation);
      } catch (e) {
        // ignore save errors; history is "best-effort"
      }

      updateOperation(operationId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      });

      showSuccess("Evaluation Complete", "Prompt evaluation completed and saved successfully!");

    } catch (e: any) {
      updateOperation(operationId, { 
        status: 'error', 
        error: e?.response?.data?.detail ?? e?.message ?? String(e),
        endTime: Date.now()
      });
      showError("Metric Computation Failed", "Metric computation failed: " + (e?.response?.data?.detail ?? e?.message ?? String(e)));
    } finally {
      setBusy(null);
    }
  }, [selected, draft?.prompt, reference, llmOutput, currentRun, metricsState, params, promptFileName, refFileName]);

  // Download handlers
  const onDownloadCSV = useCallback(() => {
    if (!scores) return;
    downloadCSV([scores], { filename: "prompt-eval-results.csv" });
  }, [scores]);

  const onDownloadPDF = useCallback(() => {
    if (!scores) return;
    downloadPDF([scores], { filename: "prompt-eval-results.pdf" });
  }, [scores]);

  // Handle preset apply
  const handlePresetApply = useCallback((preset: { body?: string }) => {
    const presetData = {
      prompt: preset.body || '',
      context: '',
      parameters: {
        temperature: 0.7,
        topP: 1.0,
        maxTokens: 1000,
        system: 'You are a helpful assistant.',
        seed: null,
      },
    };
    updateDraft(presetData);
  }, [updateDraft]);

  // Handle clear
  const handleClear = useCallback(() => {
    promptEvalStore.clearDraft();
    setDraft(promptEvalStore.getDraft());
    setCurrentRun(null);
    setError(null);
  }, []);

  // Left sidebar content
  const left = (
    <div style={{ display: "grid", gap: 16 }}>
      <h3 style={{ color: "#e2e8f0", margin: 0 }}>Prompt</h3>
      <FileDrop
        onFile={onPromptUpload}
        accept=".txt,.md"
        label="Drop prompt file (TXT/MD) or click"
      />
      {/* Quick load prompt */}
      {promptChoices.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Quick load from folder</div>
          <select
            className="select h-10 text-sm"
            id="promptQuick"
            onChange={async (e) => {
              const name = e.target.value;
              if (!name) return;
              setBusy("Loading prompt...");
              try {
                const res = await api.get(`/files/load`, {
                  params: { kind: "source", name },
                  responseType: "blob",
                });
                const file = new File([res.data], name);
                await onPromptUpload(file);
              } catch (e: any) {
                showError("Load Prompt Failed", "Load prompt failed: " + (e?.response?.data?.detail ?? e?.message ?? e));
              } finally {
                setBusy(null);
              }
            }}
            style={{
              width: "100%",
              padding: "6px 8px",
              border: "1px solid #475569",
              borderRadius: 8,
              background: "#1e293b",
              color: "#e2e8f0",
              fontSize: "14px"
            }}
            defaultValue=""
          >
            <option value="" disabled>Select a file</option>
            {promptChoices.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {promptFileName && (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          File: <b>{promptFileName}</b>
        </div>
      )}

      <h3 style={{ color: "#e2e8f0", marginTop: 8 }}>Reference</h3>
      <FileDrop
        onFile={onReferenceUpload}
        accept=".pdf,.txt,.png,.jpg,.jpeg,.tif,.tiff"
        label="Drop reference (PDF/TXT/Image) or click"
      />
      {/* Quick load reference */}
      {referenceChoices.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Quick load from folder</div>
          <select
            className="select h-10 text-sm"
            id="refQuick"
            onChange={async (e) => {
              const name = e.target.value;
              if (!name) return;
              setBusy("Loading reference…");
              try {
                const data = await loadReferenceByName(name);
                setRefFileName(data.filename);
                setReference(data.text);
              } catch (e: any) {
                showError("Load Reference Failed", "Load reference failed: " + (e?.response?.data?.detail ?? e?.message ?? e));
              } finally {
                setBusy(null);
              }
            }}
            style={{
              width: "100%",
              padding: "6px 8px",
              border: "1px solid #475569",
              borderRadius: 8,
              background: "#1e293b",
              color: "#e2e8f0",
              fontSize: "14px"
            }}
            defaultValue=""
          >
            <option value="" disabled>Select a file</option>
            {referenceChoices.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}
      {refFileName && (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          File: <b>{refFileName}</b>
        </div>
      )}

      <h3 style={{ color: "#e2e8f0", marginTop: 8 }}>Resources</h3>
      <UploadPanel
        resourceIds={draft.resourceIds}
        onResourceIdsChange={(ids: string[]) => updateDraft({ resourceIds: ids })}
      />
    </div>
  );

  // Right sidebar content
  const right = (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Tab Navigation */}
      <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
        <button onClick={() => setActiveRightTab("prompt")}
          style={{
            padding: "8px 12px",
            border: "none",
            background: activeRightTab === "prompt" ? "#1e293b" : "transparent",
            color: activeRightTab === "prompt" ? "#e2e8f0" : "#94a3b8",
            cursor: "pointer",
            fontSize: 14,
            borderBottom: activeRightTab === "prompt" ? "2px solid #60a5fa" : "2px solid transparent",
          }}
        >
          Context
        </button>
        <button onClick={() => setActiveRightTab("parameters")}
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
        <button onClick={() => setActiveRightTab("metrics")}
          style={{
            padding: "8px 12px",
            border: "none",
            background: activeRightTab === "metrics" ? "#1e293b" : "transparent",
            color: activeRightTab === "metrics" ? "#e2e8f0" : "#94a3b8",
            cursor: "pointer",
            fontSize: 14,
            borderBottom: activeRightTab === "metrics" ? "2px solid #60a5fa" : "2px solid transparent",
          }}
        >
          Metrics
        </button>
      </div>

      {/* Tab Content */}
      {activeRightTab === "prompt" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <PresetManager
              onPresetChange={handlePresetApply}
              autoApplyOnMount={false}
              presetStore={promptEvalPresetStore}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: "#e2e8f0", marginBottom: 8 }}>Context</h4>
            <ExpandableTextarea
              editable
              value={draft.context}
              onChange={(value) => updateDraft({ context: value })}
            />
          </div>
        </div>
      )}

      {activeRightTab === "parameters" && (
        <div>
          <PresetManager
            onPresetChange={handlePresetApply}
            autoApplyOnMount={false}
            presetStore={promptEvalPresetStore}
          />
          <div style={{ marginTop: 16 }} />
          <ParamsPanel params={params} onChange={setParams} />
        </div>
      )}

      {activeRightTab === "metrics" && (
        <div>
          <PresetManager
            onPresetChange={handlePresetApply}
            autoApplyOnMount={false}
            presetStore={promptEvalPresetStore}
          />
          <MetricsPanel metrics={metricsState} onChange={setMetricsState} />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", minHeight: 0 }}>
      <LeftRail />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 56, minHeight: 0 }}>
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
            <button onClick={() => setLeftOpen(!leftOpen)}
              className="btn h-8 min-w-[6px]"
              style={{
                padding: "6px 10px",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#e2e8f0",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                display: 'grid',
                placeItems: 'center'
              }}
              aria-label={leftOpen ? "Collapse left" : "Expand left"}
            >
              {leftOpen ? "⟨" : "⟩"}
            </button>
            <strong style={{ fontSize: 15 }}>Prompt Evaluation</strong>
          </div>

          
          <div></div>
          {/* Right Section */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            <button onClick={() => setRightOpen(!rightOpen)}
              className="btn h-8 min-w-[6px]"
              style={{
                padding: "6px 10px",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#e2e8f0",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                display: 'grid',
                placeItems: 'center'
              }}
              aria-label={rightOpen ? "Collapse right" : "Expand right"}
            >
              {rightOpen ? "⟩" : "⟨"}
            </button>
          </div>
        </header>

        {/* body area: left sidebar, center (scrollable), right sidebar */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left Sidebar */}
          {leftOpen && (
            <aside style={{
              width: 300,
              borderRight: "1px solid #334155",
              padding: 12,
              overflow: "auto",
              background: "#1e293b",
              color: "#e2e8f0",
              minHeight: 0
            }}>
              {left}
            </aside>
          )}

          {/* Main Content (only this scrolls) */}
          <main
            className="container-page py-6 space-y-6"
            style={{
              flex: 1,
              padding: 16,
              overflow: "auto",
              background: "#0f172a",
              color: "#e2e8f0",
              minHeight: 0
            }}
          >
            {busy && (
              <div style={{
                background: "#1e293b",
                border: "1px solid #334155",
                padding: 8,
                borderRadius: 8,
                color: "#e2e8f0"
              }}>{busy}</div>
            )}

            {error && (
              <div style={{
                background: "#ef444420",
                border: "1px solid #ef4444",
                padding: 8,
                borderRadius: 8,
                color: "#fca5a5",
                marginBottom: 16
              }}>{error}</div>
            )}

            <section style={{ display: "grid", gap: 8 }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>Prompt</h3>
              <ExpandableTextarea
                editable
                value={draft?.prompt ?? ""}
                onChange={(value) => updateDraft({ prompt: value })}
              />
            </section>

            <section style={{ display: "grid", gap: 8, marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, color: "#e2e8f0" }}>LLM Output</h3>
              </div>
              <ExpandableTextarea
                value={currentRun?.output ?? llmOutput ?? ""}
                onChange={setLlmOutput}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleRun}
                  disabled={isRunning}
                  style={{
                    padding: "6px 10px",
                    background: isRunning ? "#6b7280" : "#1e293b",
                    border: "1px solid #334155",
                    color: "#e2e8f0",
                    borderRadius: 6,
                    cursor: isRunning ? "not-allowed" : "pointer",
                    height: 36,
                    minWidth: 160
                  }}>
                  {isRunning ? "Running..." : "Build LLM Output"}
                </button>
              </div>
            </section>

            <section style={{ display: "grid", gap: 8, marginTop: 16 }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>Reference Text</h3>
              <ExpandableTextarea
                editable
                value={reference}
                onChange={setReference}
              />
            </section>

            <section style={{ marginTop: 16 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onEvaluate} style={{
                  padding: "6px 10px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#e2e8f0",
                  borderRadius: 6,
                  height: 36
                }}>
                  Run Evaluation
                </button>
                <button onClick={onDownloadCSV} disabled={!scores} style={{
                  padding: "6px 10px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#e2e8f0",
                  borderRadius: 6,
                  height: 36
                }}>
                  Download CSV
                </button>
                <button onClick={onDownloadPDF} disabled={!scores} style={{
                  padding: "6px 10px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#e2e8f0",
                  borderRadius: 6,
                  height: 36
                }}>
                  Download PDF
                </button>
              </div>

              {scores && (
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ color: "#e2e8f0", marginBottom: 8 }}>Evaluation Results</h4>
                  <table style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    background: "#0f172a",
                    borderRadius: 8,
                    overflow: "hidden",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
                  }}>
                    <thead>
                      <tr>
                        <th style={{
                          border: "1px solid #334155",
                          padding: "12px 16px",
                          textAlign: "left",
                          background: "#1e293b",
                          color: "#e2e8f0",
                          fontWeight: 600,
                          fontSize: 14
                        }}>Metric</th>
                        <th style={{
                          border: "1px solid #334155",
                          padding: "12px 16px",
                          textAlign: "left",
                          background: "#1e293b",
                          color: "#e2e8f0",
                          fontWeight: 600,
                          fontSize: 14
                        }}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(scores)
                        .filter(([key]) => {
                          // Only show metrics that were selected
                          if (['rouge1','rouge2','rougeL','rougeLsum'].includes(key)) return !!metricsState?.rouge;
                          if (key === 'bleu') return !!metricsState?.bleu;
                          if (key === 'f1') return !!metricsState?.f1;
                          if (key === 'em') return !!metricsState?.em;
                          if (['bertscore_precision','bertscore_recall','bertscore_f1'].includes(key)) return !!metricsState?.bertscore;
                          if (key === 'perplexity') return !!metricsState?.perplexity;
                          if (key === 'accuracy') return !!metricsState?.accuracy;
                          if (key === 'precision') return !!metricsState?.precision;
                          if (key === 'recall') return !!metricsState?.recall;
                          return false;
                        })
                        .map(([key, value]) => (
                          <tr key={key} style={{
                            background:
                              (key.includes('rouge') && metricsState?.rouge) || (key === 'bleu' && metricsState?.bleu)
                                ? '#1e293b' : '#0f172a'
                          }}>
                            <td style={{
                              border: "1px solid #334155",
                              padding: "12px 16px",
                              color: "#e2e8f0",
                              fontWeight: 500,
                              fontSize: 13
                            }}>
                              {key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </td>
                            <td style={{
                              border: "1px solid #334155",
                              padding: "12px 16px",
                              color: "#e2e8f0",
                              fontSize: 13,
                              fontFamily: "monospace"
                            }}>
                              {typeof value === 'number' ? value.toFixed(4) : String(value)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </main>

          {/* Right Sidebar */}
          {rightOpen && (
            <aside style={{
              width: 340,
              borderLeft: "1px solid #334155",
              padding: 12,
              overflow: "auto",
              background: "#1e293b",
              color: "#e2e8f0",
              minHeight: 0
            }}>
              {right}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
