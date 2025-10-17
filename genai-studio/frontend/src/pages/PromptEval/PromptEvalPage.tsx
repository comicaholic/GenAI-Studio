// src/pages/PromptEval/PromptEvalPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
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
import { promptEvalPresetStore, Preset } from '@/stores/presetStore';
import { useBackgroundState } from '@/stores/backgroundState';
import { historyService } from '@/services/history';
import LayoutShell from "@/components/Layout/LayoutShell";
import AutomationModal, { AutomationConfig } from '@/components/AutomationModal/AutomationModal';
import { automationStore } from '@/stores/automationStore';

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
  const [viewMode, setViewMode] = useState<"form" | "side-by-side" | "compare-two">("form");

  // Evaluation results
  const [scores, setScores] = useState<Record<string, any> | null>(null);
  const [llmOutput, setLlmOutput] = useState("");

  // Automation state
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [automationResults, setAutomationResults] = useState<Record<string, any>>({});
  
  // Prompt enlarge modal state
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const location = useLocation();

  // Allow loading an evaluation from navigation state (HomePage "Load")
  useEffect(() => {
    const state: any = location.state;
    const evalToLoad = state?.loadEvaluation;
    if (evalToLoad?.type === 'prompt') {
      try {
        const used = evalToLoad.usedText || {};
        setDraft((d) => ({ ...d, prompt: used.promptText ?? d.prompt, context: used.context ?? d.context }));
        setReference(used.referenceText ?? "");
        if (evalToLoad.results && typeof evalToLoad.results === 'object') {
          setScores(evalToLoad.results as any);
        }
        // Attempt to reload prompt/reference files if available
        const promptName: string | undefined = evalToLoad.files?.promptFileName;
        const refName: string | undefined = evalToLoad.files?.referenceFileName;
        if (promptName) {
          (async () => {
            try {
              const res = await api.get(`/files/load`, { params: { kind: 'source', name: promptName }, responseType: 'blob' });
              const file = new File([res.data], promptName);
              await onPromptUpload(file);
            } catch {}
          })();
        }
        if (refName) {
          (async () => {
            try {
              const data = await loadReferenceByName(refName);
              setRefFileName(data.filename);
              setReference(data.text);
            } catch {}
          })();
        }
      } catch {}
    }
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        metrics: selectedMetrics,
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
          title: `Prompt Evaluation - ${new Date().toLocaleDateString('en-GB')}`,
          model: { id: selected.id, provider: selected.provider },
          parameters: params,
          metrics: selectedMetrics,
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

  // Create selectedMetrics useMemo for consistent metric filtering
  const selectedMetrics = useMemo(() => {
    const list: string[] = [];
    if (metricsState.rouge) list.push("rouge");
    if (metricsState.bleu) list.push("bleu");
    if (metricsState.f1) list.push("f1");
    if (metricsState.em) list.push("em");
    if (metricsState.bertscore) list.push("bertscore");
    if (metricsState.perplexity) list.push("perplexity");
    if (metricsState.accuracy) list.push("accuracy");
    if (metricsState.precision) list.push("precision");
    if (metricsState.recall) list.push("recall");
    return list;
  }, [metricsState]);

  // When metrics toggle changes, clear prior scores to allow rerunning with new metrics
  useEffect(() => {
    setScores(null);
  }, [metricsState]);

  // Download handlers
  const onDownloadCSV = useCallback(() => {
    if (!scores) return;
    downloadCSV([scores], { filename: "prompt-eval-results.csv" });
  }, [scores]);

  const onDownloadPDF = useCallback(() => {
    if (!scores) return;
    downloadPDF([scores], { filename: "prompt-eval-results.pdf" });
  }, [scores]);

  // Automation functionality
  const handleAutomationStart = useCallback(async (config: AutomationConfig) => {
    if (!selected) {
      showError("Model Required", "Select a model first.");
      return;
    }
    if (!draft?.prompt?.trim()) {
      showError("Prompt Required", "Please enter a prompt first.");
      return;
    }
    if (!reference?.trim()) {
      showError("Missing Reference", "Provide reference text first.");
      return;
    }

    const automationId = automationStore.startAutomation('prompt', config);
    setBusy("Running automation...");

    try {
      const results: Record<string, any> = {};

      for (let i = 0; i < config.runs.length; i++) {
        const run = config.runs[i];
        
        // Update progress
        automationStore.updateProgress(automationId, { currentRunIndex: i });

        try {
          // Build LLM output for this run
          const resources = resourceStore.getByIds(draft.resourceIds || []);
          let output = '';
          
          // Use the same streaming approach as the regular run
          for await (const chunk of callLLM({
            modelId: selected.id,
            prompt: run.prompt,
            context: draft.context,
            resources,
            parameters: run.parameters as any,
          })) {
            output += chunk;
          }

          // Compute metrics - only compute selected metrics
          const runSelectedMetrics: string[] = [];
          if (run.metrics.rouge) runSelectedMetrics.push("rouge");
          if (run.metrics.bleu) runSelectedMetrics.push("bleu");
          if (run.metrics.f1) runSelectedMetrics.push("f1");
          if (run.metrics.em) runSelectedMetrics.push("em");
          if (run.metrics.bertscore) runSelectedMetrics.push("bertscore");
          if (run.metrics.perplexity) runSelectedMetrics.push("perplexity");
          if (run.metrics.accuracy) runSelectedMetrics.push("accuracy");
          if (run.metrics.precision) runSelectedMetrics.push("precision");
          if (run.metrics.recall) runSelectedMetrics.push("recall");
          
          const res = await computeMetrics({
            prediction: output,
            reference,
            metrics: runSelectedMetrics,
            meta: {
              model: selected.id,
              params: run.parameters,
              source_file: promptFileName,
              reference_file: refFileName,
            },
          });

          results[run.id] = {
            runName: run.name,
            prompt: run.prompt,
            parameters: run.parameters,
            metrics: run.metrics,
            output,
            scores: res.scores ?? res,
          };

          // Save individual evaluation to history
          try {
            const evaluation = {
              id: crypto.randomUUID(),
              type: 'prompt' as const,
              title: `${config.name} - ${run.name}`,
              model: { id: selected.id, provider: selected.provider },
              parameters: run.parameters,
              metrics: runSelectedMetrics,
              usedText: {
                promptText: run.prompt,
                context: draft.context,
                referenceText: reference
              },
              files: {
                promptFileName,
                referenceFileName: refFileName
              },
              results: res.scores ?? res,
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              automationId: config.id,
              runId: run.id,
            };
            await historyService.saveEvaluation?.(evaluation);
          } catch (e) {
            console.warn("Failed to save evaluation:", e);
          }

        } catch (error: any) {
          results[run.id] = {
            runName: run.name,
            error: error?.message ?? String(error),
          };
        }
      }

      setAutomationResults(results);
      automationStore.completeAutomation(automationId);
      showSuccess("Automation Complete", `Completed ${config.runs.length} runs successfully!`);

    } catch (error: any) {
      automationStore.completeAutomation(automationId, error?.message ?? String(error));
      showError("Automation Failed", "Automation failed: " + (error?.message ?? String(error)));
    } finally {
      setBusy(null);
    }
  }, [selected, draft, reference, promptFileName, refFileName, showError, showSuccess]);

  // Handle preset apply
  const handlePresetApply = useCallback((preset: { title: string; body: string; id: string; parameters?: Preset['parameters']; metrics?: Preset['metrics'] }) => {
    const presetData = {
      prompt: preset.body || '',
      context: draft?.context || '',
      parameters: preset.parameters ? {
        temperature: preset.parameters.temperature ?? params.temperature,
        topP: preset.parameters.top_p ?? params.top_p,
        maxTokens: preset.parameters.max_tokens ?? params.max_tokens,
        system: preset.parameters.system,
        seed: preset.parameters.seed,
      } : (draft?.parameters || params),
    };
    updateDraft(presetData);
    
    // Apply metrics if they exist
    if (preset.metrics) {
      setMetricsState(prev => ({
        ...prev,
        ...preset.metrics
      }));
    }
  }, [updateDraft, draft?.context, draft?.parameters, params]);

  // Handle tab switching - preserve current content
  const handleTabSwitch = useCallback((newTab: "prompt" | "parameters" | "metrics") => {
    // Save current draft before switching tabs
    if (draft) {
      promptEvalStore.applyPreset(draft);
    }
    setActiveRightTab(newTab);
  }, [draft]);

  // Handle clear
  const handleClear = useCallback(() => {
    promptEvalStore.clearDraft();
    setDraft(promptEvalStore.getDraft());
    setCurrentRun(null);
    setError(null);
  }, []);

  // Left sidebar content
  const left = (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <h3 style={{ margin: "0 0 8px 0", color: "#e2e8f0" }}>View Selection</h3>
        <select
          className="select h-10 text-sm"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as "form" | "side-by-side" | "compare-two")}
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #334155",
            borderRadius: 6,
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <option value="form">Form View</option>
          <option value="side-by-side">Side by Side Comparison</option>
          <option value="compare-two">Compare Two Selected</option>
        </select>
      </div>

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
    <div style={{ display: "grid", gap: 20 }}>
      {/* Enhanced Tab Navigation — Modern segmented control */}
      <div style={{
        display: "flex",
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 6,
        gap: 2,
        position: "sticky",
        top: 0,
        zIndex: 10,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      }}>
        {([
          { key: "prompt", label: "Context", icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          )},
          { key: "parameters", label: "Parameters", icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
          )},
          { key: "metrics", label: "Metrics", icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
          )},
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => handleTabSwitch(t.key)}
            role="tab"
            aria-selected={activeRightTab === t.key}
            aria-controls={`tabpanel-${t.key}`}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 8,
              border: "none",
              background: activeRightTab === t.key 
                ? "linear-gradient(135deg, #1e293b 0%, #334155 100%)" 
                : "transparent",
              color: activeRightTab === t.key ? "#ffffff" : "#94a3b8",
              fontSize: 14,
              fontWeight: activeRightTab === t.key ? 600 : 500,
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              if (activeRightTab !== t.key) {
                e.currentTarget.style.background = "#1e293b";
                e.currentTarget.style.color = "#e2e8f0";
              }
            }}
            onMouseLeave={(e) => {
              if (activeRightTab !== t.key) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = "2px solid #3b82f6";
              e.currentTarget.style.outlineOffset = "2px";
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = "none";
            }}
          >
            <span style={{ display: "flex", alignItems: "center" }}>{t.icon}</span>
            <span>{t.label}</span>
            {activeRightTab === t.key && (
              <div style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "60%",
                height: 2,
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                borderRadius: 1,
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Enhanced Tab Content */}
      {activeRightTab === "prompt" && (
        <div 
          id="tabpanel-prompt"
          role="tabpanel"
          aria-labelledby="tab-prompt"
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <PresetManager
              onPresetChange={handlePresetApply}
              autoApplyOnMount={false}
              presetStore={promptEvalPresetStore}
              currentContent={draft?.prompt ?? ""}
              currentParameters={draft?.parameters ?? params}
              currentMetrics={metricsState}
            />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ 
                fontSize: 16, 
                fontWeight: 600, 
                color: "#e2e8f0", 
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
                Context
              </h4>
              <button
                onClick={() => setIsPromptModalOpen(true)}
                style={{
                  padding: "6px 8px",
                  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
                Enlarge
              </button>
            </div>
            <ExpandableTextarea
              editable
              value={draft.context}
              onChange={(value) => updateDraft({ context: value })}
            />
            <div style={{ 
              fontSize: 12, 
              color: "#94a3b8", 
              marginTop: 8,
              padding: 8,
              background: "#0f172a",
              borderRadius: 6,
              border: "1px solid #334155"
            }}>
              <strong>Template Variables:</strong> Use
              <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3, marginLeft: 6 }}>{'{context}'}</code>
              and
              <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3, marginLeft: 6 }}>{'{reference}'}</code>
              inside your prompt to inject the current context and reference text.
            </div>
          </div>
        </div>
      )}

      {activeRightTab === "parameters" && (
        <div 
          id="tabpanel-parameters"
          role="tabpanel"
          aria-labelledby="tab-parameters"
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <PresetManager
              onPresetChange={handlePresetApply}
              autoApplyOnMount={false}
              presetStore={promptEvalPresetStore}
              currentContent={draft?.prompt ?? ""}
              currentParameters={draft?.parameters ?? params}
              currentMetrics={metricsState}
            />
          </div>
          <div>
            <h4 style={{ 
              fontSize: 16, 
              fontWeight: 600, 
              color: "#e2e8f0", 
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
              Model Parameters
            </h4>
            <ParamsPanel params={params} onChange={setParams} />
          </div>
        </div>
      )}

      {activeRightTab === "metrics" && (
        <div 
          id="tabpanel-metrics"
          role="tabpanel"
          aria-labelledby="tab-metrics"
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <PresetManager
              onPresetChange={handlePresetApply}
              autoApplyOnMount={false}
              presetStore={promptEvalPresetStore}
              currentContent={draft?.prompt ?? ""}
              currentParameters={draft?.parameters ?? params}
              currentMetrics={metricsState}
            />
          </div>
          <div>
            <h4 style={{ 
              fontSize: 16, 
              fontWeight: 600, 
              color: "#e2e8f0", 
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
              </svg>
              Evaluation Metrics
            </h4>
            <MetricsPanel metrics={metricsState} onChange={setMetricsState} />
          </div>
        </div>
      )}
    </div>
  );

  const renderFormView = () => (
    <>
      <section style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: 12,
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", 
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 18, fontWeight: 600 }}>Prompt</h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
              {draft?.prompt ? `${draft.prompt.length} characters` : "No prompt entered yet"}
            </p>
          </div>
        </div>
        <ExpandableTextarea
          editable
          value={draft?.prompt ?? ""}
          onChange={(value) => updateDraft({ prompt: value })}
        />
        <div style={{ 
          fontSize: 12, 
          color: "#94a3b8", 
          marginTop: 8,
          padding: 8,
          background: "#0f172a",
          borderRadius: 6,
          border: "1px solid #334155"
        }}>
          <strong>Template Variables:</strong> Use
          <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3, marginLeft: 6 }}>{'{context}'}</code>
          and
          <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3, marginLeft: 6 }}>{'{reference}'}</code>
          inside your prompt to inject the current context and reference text.
        </div>
      </section>

      <section style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: 12,
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              background: "linear-gradient(135deg, #10b981, #059669)", 
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 18, fontWeight: 600 }}>LLM Output</h3>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
                {currentRun?.output || llmOutput ? `${(currentRun?.output || llmOutput).length} characters` : "No output generated yet"}
              </p>
            </div>
          </div>
        </div>
        <ExpandableTextarea
          value={currentRun?.output ?? llmOutput ?? ""}
          onChange={setLlmOutput}
        />
        <div>
          <button onClick={handleRun}
            disabled={isRunning}
            style={{ 
              padding: "12px 20px", 
              background: isRunning 
                ? "#6b7280" 
                : "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
              border: "none", 
              color: "#ffffff", 
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: isRunning ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!isRunning) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isRunning) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
            </svg>
            {isRunning ? "Running..." : "Build LLM Output"}
          </button>
        </div>
      </section>

      <section style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: 12,
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            background: "linear-gradient(135deg, #f59e0b, #d97706)", 
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 18, fontWeight: 600 }}>Reference Text</h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
              {reference ? `${reference.length} characters` : "No reference text provided"}
            </p>
          </div>
        </div>
        <ExpandableTextarea
          editable
          value={reference}
          onChange={setReference}
        />
      </section>
    </>
  );

  const renderSideBySideView = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, height: "100%", flex: 1 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Prompt</h3>
        <ExpandableTextarea
          editable
          value={draft?.prompt ?? ""}
          onChange={(value) => updateDraft({ prompt: value })}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>LLM Output</h3>
        <ExpandableTextarea
          value={currentRun?.output ?? llmOutput ?? ""}
          onChange={setLlmOutput}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Reference Text</h3>
        <ExpandableTextarea
          editable
          value={reference}
          onChange={setReference}
        />
      </section>
    </div>
  );

  const renderCompareTwoView = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: "100%", flex: 1 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>LLM Output</h3>
        <ExpandableTextarea
          value={currentRun?.output ?? llmOutput ?? ""}
          onChange={setLlmOutput}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Reference Text</h3>
        <ExpandableTextarea
          editable
          value={reference}
          onChange={setReference}
        />
      </section>
    </div>
  );

  return (
    <LayoutShell title="Prompt Evaluation" left={left} right={right} rightWidth={400}>
      {busy && (
        <div style={{
          background: "#1e293b",
          border: "1px solid #334155",
          padding: 8,
          borderRadius: 8,
          color: "#e2e8f0",
          marginBottom: 16,
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

            <div
              style={{
                padding: 16,
                overflow: "auto",
                background: "#0f172a",
                color: "#e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                width: "100%",
                flex: 1
              }}
            >
        {viewMode === "form" && renderFormView()}
        {viewMode === "side-by-side" && renderSideBySideView()}
        {viewMode === "compare-two" && renderCompareTwoView()}

        <div style={{ 
          display: "flex", 
          gap: 12, 
          marginTop: 24,
          padding: 20,
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 12,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        }}>
          <button onClick={onEvaluate} style={{ 
            padding: "12px 20px", 
            background: "linear-gradient(135deg, #10b981, #059669)", 
            border: "none", 
            color: "#ffffff", 
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
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
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
            Run Evaluation
          </button>
          <button onClick={() => setIsAutomationModalOpen(true)} style={{ 
            padding: "12px 20px", 
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)", 
            border: "none", 
            color: "#ffffff", 
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
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
              <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
            </svg>
            Run Automation
          </button>
          <button onClick={onDownloadCSV} disabled={!scores} style={{ 
            padding: "12px 20px", 
            background: !scores 
              ? "#6b7280" 
              : "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
            border: "none", 
            color: "#ffffff", 
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: !scores ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => {
            if (scores) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
            }
          }}
          onMouseLeave={(e) => {
            if (scores) {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
            }
          }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Download CSV
          </button>
          <button onClick={onDownloadPDF} disabled={!scores} style={{ 
            padding: "12px 20px", 
            background: !scores 
              ? "#6b7280" 
              : "linear-gradient(135deg, #ef4444, #dc2626)", 
            border: "none", 
            color: "#ffffff", 
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: !scores ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => {
            if (scores) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
            }
          }}
          onMouseLeave={(e) => {
            if (scores) {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
            }
          }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Download PDF
          </button>
        </div>

          {scores && (
            <section style={{ 
              marginTop: 24,
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", 
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 18, fontWeight: 600 }}>Evaluation Results</h3>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
                    {Object.keys(scores).length} metric{Object.keys(scores).length !== 1 ? 's' : ''} computed
                  </p>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {Object.entries(scores).map(([key, value]) => (
                  <div key={key} style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    padding: "12px 16px", 
                    background: "#1e293b", 
                    borderRadius: 8,
                    border: "1px solid #334155",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#334155";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#1e293b";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  >
                    <span style={{ 
                      color: "#e2e8f0", 
                      fontSize: 14,
                      fontWeight: 500,
                      textTransform: "capitalize"
                    }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{ 
                      color: "#e2e8f0", 
                      fontFamily: "monospace",
                      fontSize: 14,
                      fontWeight: 600,
                      background: "#0f172a",
                      padding: "4px 8px",
                      borderRadius: 4,
                      border: "1px solid #475569"
                    }}>
                      {typeof value === "number" ? value.toFixed(4) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Automation Results */}
          {Object.keys(automationResults).length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ color: "#e2e8f0", marginBottom: 16 }}>Automation Results</h4>
              <div style={{ display: "grid", gap: 16 }}>
                {Object.entries(automationResults).map(([runId, result]) => (
                  <div key={runId} style={{ 
                    border: "1px solid #334155", 
                    borderRadius: 8, 
                    padding: 16, 
                    background: "#0f172a" 
                  }}>
                    <h5 style={{ margin: "0 0 12px 0", color: "#e2e8f0" }}>{result.runName}</h5>
                    {result.error ? (
                      <div style={{ color: "#ef4444", fontSize: 14 }}>Error: {result.error}</div>
                    ) : (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Output:</div>
                          <div style={{ 
                            background: "#1e293b", 
                            padding: 8, 
                            borderRadius: 4, 
                            fontSize: 13, 
                            color: "#e2e8f0",
                            maxHeight: 100,
                            overflow: "auto"
                          }}>
                            {result.output}
                          </div>
                        </div>
                        {result.scores && (
                          <div>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Scores:</div>
                            <div style={{ display: "grid", gap: 4 }}>
                              {Object.entries(result.scores).map(([key, value]) => (
                                <div key={key} style={{ 
                                  display: "flex", 
                                  justifyContent: "space-between", 
                                  padding: "4px 8px", 
                                  background: "#1e293b", 
                                  borderRadius: 4 
                                }}>
                                  <span style={{ color: "#e2e8f0", fontSize: 12 }}>{key}</span>
                                  <span style={{ color: "#e2e8f0", fontFamily: "monospace", fontSize: 12 }}>
                                    {typeof value === "number" ? value.toFixed(4) : String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      {/* Automation Modal */}
      <AutomationModal
        isOpen={isAutomationModalOpen}
        onClose={() => setIsAutomationModalOpen(false)}
        onStart={handleAutomationStart}
        presetStore={promptEvalPresetStore}
        defaultPrompt={draft?.prompt || ""}
        kind="prompt"
      />
      
      {/* Context Enlarge Modal */}
      {isPromptModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setIsPromptModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90vw",
              maxWidth: "1000px",
              height: "80vh",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 24,
              color: "#e2e8f0",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>
                Edit Context
              </h2>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                style={{
                  padding: "8px",
                  background: "transparent",
                  border: "1px solid #334155",
                  color: "#94a3b8",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#334155";
                  e.currentTarget.style.color = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ 
                  display: "block", 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: "#e2e8f0", 
                  marginBottom: 8 
                }}>
                  Context
                </label>
                <textarea
                  value={draft?.context || ""}
                  onChange={(e) => updateDraft({ context: e.target.value })}
                  style={{
                    width: "100%",
                    height: "60vh",
                    border: "1px solid #475569",
                    borderRadius: 8,
                    background: "#1e293b",
                    color: "#e2e8f0",
                    padding: 16,
                    fontSize: 14,
                    fontFamily: "monospace",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                  placeholder="Enter your context here..."
                />
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Save & Close
              </button>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                style={{
                  padding: "12px 24px",
                  background: "transparent",
                  border: "1px solid #334155",
                  color: "#94a3b8",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#334155";
                  e.currentTarget.style.color = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
