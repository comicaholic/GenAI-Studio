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
import { makePathRelative } from '@/lib/pathUtils';
import { computeMetrics, downloadCSV, downloadPDF } from '@/services/eval';
import { useNotifications } from '@/components/Notification/Notification';
import UploadPanel from './components/UploadPanel';
import { promptEvalPresetStore, Preset } from '@/stores/presetStore';
import { useBackgroundState } from '@/stores/backgroundState';
import { historyService } from '@/services/history';
import LayoutShell from "@/components/Layout/LayoutShell";
import AutomationModal, { AutomationConfig } from '@/components/AutomationModal/AutomationModal';
import { automationStore } from '@/stores/automationStore';
import AutomationProgressIndicator from '@/components/AutomationProgress/AutomationProgressIndicator';
import AutomationProgressModal from '@/components/AutomationProgress/AutomationProgressModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import LoadingButton from '@/components/ui/LoadingButton';
import TextDisplay from '@/components/TextDisplay/TextDisplay';

const DEFAULT_PARAMS: ModelParams = { temperature: 0.7, max_tokens: 1000, top_p: 1.0, top_k: 40 };

export default function PromptEvalPage() {
  // Sidebar state
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Main state
  const { selected, setSelected } = useModel();
  const [draft, setDraft] = useState(promptEvalStore.getDraft());
  const [runHistory, setRunHistory] = useState(promptEvalStore.getRunHistory());
  const [currentRun, setCurrentRun] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'prompt' | 'parameters' | 'metrics'>('prompt');
  const [error, setError] = useState<string | null>(null);
  // Enhanced loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'prompt' | 'llm' | 'metrics' | 'automation' | null>(null);

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
  const [compareSelection, setCompareSelection] = useState<{
    first: "prompt" | "llm" | "reference";
    second: "prompt" | "llm" | "reference";
  }>({ first: "prompt", second: "reference" });

  // Evaluation results
  const [scores, setScores] = useState<Record<string, any> | null>(null);
  const [llmOutput, setLlmOutput] = useState("");

  // Automation state
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [isAutomationProgressModalOpen, setIsAutomationProgressModalOpen] = useState(false);
  const [automationResults, setAutomationResults] = useState<Record<string, any>>({});
  const [loadedAutomationSet, setLoadedAutomationSet] = useState<any>(null);
  const [loadedAutomationName, setLoadedAutomationName] = useState<string>("");
  
  // Prompt enlarge modal state
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const location = useLocation();

  // Allow loading an evaluation from navigation state (HomePage "Load")
  useEffect(() => {
    console.log("PromptEval Page - useEffect triggered");
    console.log("PromptEval Page - location.state:", location.state);
    
    const loadEvaluationData = async () => {
      const state: any = location.state;
      console.log("PromptEval Page - Processing state:", state);
      
      const evalToLoad = state?.loadEvaluation;
      const automationToLoad = state?.loadAutomation;
      const autoLoadFiles = state?.autoLoadFiles;
      const autoLoadPreset = state?.autoLoadPreset;
      const autoRun = state?.autoRun;
      const showFeedback = state?.showFeedback;
      const openAutomationModal = state?.openAutomationModal;
      
      console.log("PromptEval Page - evalToLoad:", evalToLoad);
      console.log("PromptEval Page - automationToLoad:", automationToLoad);
      console.log("PromptEval Page - autoLoadFiles:", autoLoadFiles);
      console.log("PromptEval Page - autoLoadPreset:", autoLoadPreset);
      
      if (evalToLoad?.type === 'prompt') {
        try {
          console.log("PromptEval Page - Loading evaluation:", evalToLoad);
          console.log("PromptEval Page - evalToLoad.usedText:", evalToLoad.usedText);
          console.log("PromptEval Page - evalToLoad.parameters:", evalToLoad.parameters);
          console.log("PromptEval Page - evalToLoad.metrics:", evalToLoad.metrics);
          console.log("PromptEval Page - evalToLoad.metricsState:", evalToLoad.metricsState);
          
          // IMMEDIATE DATA LOADING (fast, synchronous)
          const used = evalToLoad.usedText || {};
          console.log("PromptEval Page - used object:", used);
          
          // 0. Set model immediately
          if (evalToLoad.model) {
            setSelected({
              id: evalToLoad.model.id,
              label: evalToLoad.model.id, // Use id as label if no label provided
              provider: evalToLoad.model.provider as any,
            });
            console.log("PromptEval Page - Set model:", evalToLoad.model);
          } else {
            console.log("PromptEval Page - No model found in evaluation");
          }
          
          // 1. Set prompt text immediately
          if (used.promptText) {
            setDraft((d) => ({ ...d, prompt: used.promptText }));
            setPromptText(used.promptText);
            console.log("PromptEval Page - Set prompt text:", used.promptText);
          } else {
            console.log("PromptEval Page - No prompt text found in usedText");
          }
          
          // 2. Set reference text immediately
          if (used.referenceText) {
            setReference(used.referenceText);
            console.log("PromptEval Page - Set reference text:", used.referenceText);
          } else {
            console.log("PromptEval Page - No reference text found in usedText");
          }
          
          // 3. Set parameters immediately
          if (evalToLoad.parameters) {
            setParams(prev => ({
              ...prev,
              temperature: evalToLoad.parameters?.temperature ?? prev.temperature,
              max_tokens: evalToLoad.parameters?.max_tokens ?? prev.max_tokens,
              top_p: evalToLoad.parameters?.top_p ?? prev.top_p,
              top_k: evalToLoad.parameters?.top_k ?? prev.top_k,
            }));
            console.log("PromptEval Page - Set parameters:", evalToLoad.parameters);
          } else {
            console.log("PromptEval Page - No parameters found in evaluation");
          }
          
          // 4. Set metrics immediately
          if ((evalToLoad as any).metricsState) {
            setMetricsState((evalToLoad as any).metricsState);
            console.log("PromptEval Page - Set metrics from state:", (evalToLoad as any).metricsState);
          } else if (evalToLoad.metrics && Array.isArray(evalToLoad.metrics)) {
            const metricsConfig: MetricState = {
              rouge: evalToLoad.metrics.includes('rouge'),
              bleu: evalToLoad.metrics.includes('bleu'),
              f1: evalToLoad.metrics.includes('f1'),
              em: evalToLoad.metrics.includes('em'),
              em_avg: evalToLoad.metrics.includes('em_avg'),
              bertscore: evalToLoad.metrics.includes('bertscore'),
              perplexity: evalToLoad.metrics.includes('perplexity'),
              accuracy: evalToLoad.metrics.includes('accuracy'),
              accuracy_avg: evalToLoad.metrics.includes('accuracy_avg'),
              precision: evalToLoad.metrics.includes('precision'),
              precision_avg: evalToLoad.metrics.includes('precision_avg'),
              recall: evalToLoad.metrics.includes('recall'),
              recall_avg: evalToLoad.metrics.includes('recall_avg'),
            };
            setMetricsState(metricsConfig);
            console.log("PromptEval Page - Set metrics from array:", metricsConfig);
          } else {
            console.log("PromptEval Page - No metrics found in evaluation");
          }
          
          // 5. Set results if available
          if (evalToLoad.results && typeof evalToLoad.results === 'object') {
            setScores(evalToLoad.results as any);
            console.log("PromptEval Page - Set scores:", evalToLoad.results);
          }
          
          // 6. Load preset data (override previous settings if preset exists)
          if (autoLoadPreset && evalToLoad.loadedPreset) {
            const preset = evalToLoad.loadedPreset;
            console.log("PromptEval Page - Loading preset:", preset);
            
            // Override prompt with preset if preset has content
            if (preset.body) {
              setDraft((d) => ({ ...d, prompt: preset.body }));
              setPromptText(preset.body);
              console.log("PromptEval Page - Override prompt with preset:", preset.body);
            }
            
            // Override parameters with preset if preset has parameters
            if (preset.parameters) {
              setParams(prev => ({
                ...prev,
                temperature: preset.parameters?.temperature ?? prev.temperature,
                max_tokens: preset.parameters?.max_tokens ?? prev.max_tokens,
                top_p: preset.parameters?.top_p ?? prev.top_p,
                top_k: preset.parameters?.top_k ?? prev.top_k,
              }));
              console.log("PromptEval Page - Override parameters with preset:", preset.parameters);
            }
            
            // Override metrics with preset if preset has metrics
            if (preset.metrics) {
              setMetricsState(prev => ({
                ...prev,
                ...preset.metrics
              }));
              console.log("PromptEval Page - Override metrics with preset:", preset.metrics);
            }
          }
          
          // FILE LOADING (synchronous, but after immediate data)
          if (autoLoadFiles) {
            console.log("PromptEval Page - Starting file loading...");
            
            try {
              if (evalToLoad.loadedFiles) {
                console.log("PromptEval Page - Loading files from loadedFiles:", evalToLoad.loadedFiles);
                const files = evalToLoad.loadedFiles;
                
                // Process prompt files
                const promptFiles = files.filter((f: any) => f.type === 'prompt');
                if (promptFiles.length > 0) {
                  const promptFile = promptFiles[0];
                  if (promptFile.file) {
                    setPromptFileName(promptFile.fileName);
                    setPromptChoices(prev => {
                      if (!prev.includes(promptFile.fileName)) {
                        return [...prev, promptFile.fileName];
                      }
                      return prev;
                    });
                    console.log("PromptEval Page - Set prompt file:", promptFile.fileName);
                  }
                }
                
                // Process reference files
                const referenceFiles = files.filter((f: any) => f.type === 'reference');
                if (referenceFiles.length > 0) {
                  const refFile = referenceFiles[0];
                  if (refFile.data) {
                    setRefFileName(refFile.fileName);
                    setReference(refFile.data.text);
                    setReferenceChoices(prev => {
                      if (!prev.includes(refFile.fileName)) {
                        return [...prev, refFile.fileName];
                      }
                      return prev;
                    });
                    console.log("PromptEval Page - Set reference file:", refFile.fileName);
                  }
                }
              } else {
                // Fallback file loading
                console.log("PromptEval Page - Fallback file loading...");
                const promptName = evalToLoad.files?.promptFileName;
                const refName = evalToLoad.files?.referenceFileName;
                
                if (promptName) {
                  setPromptFileName(promptName);
                  setPromptChoices(prev => {
                    if (!prev.includes(promptName)) {
                      return [...prev, promptName];
                    }
                    return prev;
                  });
                  console.log("PromptEval Page - Set prompt file (fallback):", promptName);
                }
                
                if (refName) {
                  try {
                    const data = await loadReferenceByName(refName);
                    setRefFileName(data.filename);
                    setReference(data.text);
                    setReferenceChoices(prev => {
                      if (!prev.includes(data.filename)) {
                        return [...prev, data.filename];
                      }
                      return prev;
                    });
                    console.log("PromptEval Page - Set reference file (fallback):", data.filename);
                  } catch (error) {
                    console.warn(`Failed to load reference file ${refName}:`, error);
                  }
                }
              }
            } catch (error) {
              console.error("Error loading files:", error);
            }
          }
          
          // Show user feedback for missing items
          if (showFeedback) {
            const feedbackMessages: string[] = [];
            
            // Check for missing model
            if (evalToLoad.missingModel) {
              feedbackMessages.push(`Model "${evalToLoad.missingModel.id}" is not available. Using fallback model.`);
            }
            
            // Check for missing files
            if (evalToLoad.missingFiles && evalToLoad.missingFiles.length > 0) {
              feedbackMessages.push(`Missing files: ${evalToLoad.missingFiles.join(', ')}`);
            }
            
            // Show consolidated feedback
            if (feedbackMessages.length > 0) {
              showError("Evaluation Loaded with Issues", feedbackMessages.join('\n'));
            } else {
              showSuccess("Evaluation Loaded", "All files and settings have been restored successfully.");
            }
          }
          
          // Auto-run if requested
          if (autoRun) {
            // Wait a bit for files to load, then auto-run
            setTimeout(() => {
              handleRun();
            }, 1000);
          }
          
        } catch (error) {
          console.error("Failed to load evaluation:", error);
          showError("Load Failed", "Failed to load evaluation data");
        }
      } else if (automationToLoad?.type === 'prompt') {
        try {
          console.log("PromptEval Page - Loading automation:", automationToLoad);
          console.log("PromptEval Page - automationToLoad.automations:", automationToLoad.automations);
          console.log("PromptEval Page - automationToLoad.name:", automationToLoad.name);
          
          // Handle both single automation and automation set
          let automation = automationToLoad;
          let firstRun = null;
          
          // If it's an automation set, get the first automation
          if (automationToLoad.automations && Array.isArray(automationToLoad.automations)) {
            automation = automationToLoad.automations[0];
            firstRun = automation?.runs?.[0];
            console.log("PromptEval Page - Using first automation from set:", automation);
            console.log("PromptEval Page - First run:", firstRun);
          } else if (automationToLoad.runs && Array.isArray(automationToLoad.runs)) {
            // It's a single automation
            firstRun = automationToLoad.runs[0];
            console.log("PromptEval Page - Using single automation:", automation);
            console.log("PromptEval Page - First run:", firstRun);
          }
          
          if (firstRun) {
            // Set model from automation
            if (automation.model) {
              setSelected({
                id: automation.model.id,
                label: automation.model.id, // Use id as label if no label provided
                provider: automation.model.provider as any,
              });
              console.log("PromptEval Page - Set model from automation:", automation.model);
            }
            
            setDraft((d) => ({ 
              ...d, 
              prompt: firstRun.prompt ?? d.prompt, 
              context: d.context 
            }));
            setReference("");
            
            // Load automation parameters from the automation object
            if (automation.parameters) {
              setParams(prev => ({
                ...prev,
                temperature: automation.parameters.temperature ?? prev.temperature,
                max_tokens: automation.parameters.max_tokens ?? prev.max_tokens,
                top_p: automation.parameters.top_p ?? prev.top_p,
                top_k: automation.parameters.top_k ?? prev.top_k,
              }));
            }
            
            // Load automation metrics from the first run
            if (firstRun.metrics) {
              if (Array.isArray(firstRun.metrics)) {
                // If it's an array of metric names
                const metricsState: MetricState = {
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
                firstRun.metrics.forEach((metric: string) => {
                  if (metric in metricsState) {
                    (metricsState as any)[metric] = true;
                  }
                });
                setMetricsState(metricsState);
              } else if (typeof firstRun.metrics === 'object') {
                // If it's already a metrics state object
                setMetricsState(firstRun.metrics as MetricState);
              }
            }
            
            // Load files from the first run
            if (firstRun.promptFileName) {
              try {
                const res = await api.get(`/files/load`, { params: { kind: 'source', name: firstRun.promptFileName }, responseType: 'blob' });
                const file = new File([res.data], firstRun.promptFileName);
                await onPromptUpload(file);
              } catch (error) {
                console.warn(`Failed to load prompt file ${firstRun.promptFileName}:`, error);
              }
            }
            if (firstRun.referenceFileName) {
              try {
                const data = await loadReferenceByName(firstRun.referenceFileName);
                setRefFileName(data.filename);
                setReference(data.text);
              } catch (error) {
                console.warn(`Failed to load reference file ${firstRun.referenceFileName}:`, error);
              }
            }
          }
        } catch (error) {
          console.error("Failed to load automation:", error);
        }
        
        // Store automation set data for the modal
        if (openAutomationModal) {
          console.log("PromptEval Page - Opening automation modal with data:", automationToLoad);
          console.log("PromptEval Page - Setting loadedAutomationSet:", automationToLoad);
          console.log("PromptEval Page - Setting loadedAutomationName:", automationToLoad.name || "Loaded Automation");
          
          setLoadedAutomationSet(automationToLoad);
          setLoadedAutomationName(automationToLoad.name || "Loaded Automation");
          setIsAutomationModalOpen(true);
          
          console.log("PromptEval Page - Automation modal should now be open");
        }
      }
    };
    
    loadEvaluationData();
    // run when location.state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const { showError, showSuccess } = useNotifications();
  const { addOperation, updateOperation } = useBackgroundState();

  // Load initial state (store draft) - only clear if this is a fresh page load
  useEffect(() => {
    const state: any = location.state;
    const evalToLoad = state?.loadEvaluation;
    const automationToLoad = state?.loadAutomation;
    
    // Only load stored draft if we're not loading from navigation state
    if (!evalToLoad && !automationToLoad) {
      // Check if this is truly a fresh load (no existing data in store)
      const storedDraft = promptEvalStore.getDraft();
      const hasExistingData = storedDraft.prompt || storedDraft.context || storedDraft.selectedModelId;
      
      if (hasExistingData) {
        // Load existing data from store
        setDraft(storedDraft);
        setPromptText(storedDraft.prompt || "");
        setReference(storedDraft.context || "");
      } else {
        // No existing data, start with clean state
        setDraft(storedDraft);
        setPromptText("");
        setReference("");
        setPromptFileName("");
        setRefFileName("");
        setLlmOutput("");
        setScores(null);
        setCurrentRun(null);
        setError(null);
      }
    }
  }, [location.state]);

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
    // Validate file type for prompt uploads
    const allowedExtensions = ['.txt', '.md'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      showError("Invalid File Type", "Prompt files must be .txt or .md files only.");
      return;
    }
    
    setLoadingType('prompt');
    try {
      const text = await file.text();
      setPromptFileName(file.name);
      setPromptText(text);
      updateDraft({ prompt: text });
    } catch (e: any) {
      showError("Upload Failed", "Failed to process prompt file: " + (e?.message ?? e));
    } finally {
      setLoadingType(null);
    }
  };

  const onReferenceUpload = async (file: File) => {
    setLoadingType('prompt');
    try {
      const text = await file.text();
      setRefFileName(file.name);
      setReference(text);
    } catch (e: any) {
      showError("Upload Failed", "Failed to process reference file: " + (e?.message ?? e));
    } finally {
      setLoadingType(null);
    }
  };

  // Process template variables in prompt
  const processTemplateVariables = useCallback((prompt: string, context: string, resources: any[]) => {
    let processedPrompt = prompt;
    
    // Replace {context} with actual context
    if (processedPrompt.includes('{context}')) {
      processedPrompt = processedPrompt.replace(/\{context\}/g, context || '');
    }
    
    // Replace {resources} with formatted resources
    if (processedPrompt.includes('{resources}')) {
      const resourcesText = resources.length > 0 
        ? resources.map(r => `- ${r.name} (${r.mime})`).join('\n')
        : 'No resources attached';
      processedPrompt = processedPrompt.replace(/\{resources\}/g, resourcesText);
    }
    
    return processedPrompt;
  }, []);

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
    setLoadingType('llm');

    const runId = crypto.randomUUID?.() ?? (Date.now().toString() + Math.random().toString());
    const startTime = Date.now();
    const resources = resourceStore.getByIds(draft.resourceIds || []);
    
    // Process template variables in the prompt
    const processedPrompt = processTemplateVariables(draft.prompt, draft.context || '', resources);

    const runResult: RunResult = {
      id: runId,
      startedAt: startTime,
      finishedAt: 0,
      output: '',
      modelId: selected.id,
      resources,
      prompt: processedPrompt, // Use processed prompt
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
        prompt: processedPrompt, // Use processed prompt
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
      setLoadingType(null);
    }
  }, [selected, draft, params, processTemplateVariables]);

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

    setLoadingType('metrics');

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
          metricsState: metricsState, // Save the full metrics state
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
      
      // Save failed evaluation to history
      try {
        const evaluation = {
          id: crypto.randomUUID?.() ?? (Date.now().toString() + Math.random().toString()),
          type: 'prompt' as const,
          title: `Prompt Evaluation (Failed) - ${new Date().toLocaleDateString('en-GB')}`,
          model: { id: selected.id, provider: selected.provider },
          parameters: params,
          metrics: selectedMetrics,
          metricsState: metricsState,
          usedText: {
            promptText: draft.prompt,
            context: draft.context,
            referenceText: reference
          },
          files: {
            promptFileName,
            referenceFileName: refFileName
          },
          results: {}, // Empty results for failed evaluations
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: e?.response?.data?.detail ?? e?.message ?? String(e) // Store error message
        };
        await historyService.saveEvaluation?.(evaluation);
      } catch (saveError) {
        console.warn("Failed to save failed evaluation:", saveError);
      }
    } finally {
      setLoadingType(null);
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
  const onDownloadCSV = useCallback(async () => {
    if (!scores) return;
    
    // Enhanced CSV with model, parameters, and metrics info
    const enhancedData = {
      ...scores,
      // Model information
      model_id: selected?.id || 'unknown',
      model_provider: selected?.provider || 'local',
      model_label: selected?.label || selected?.id || 'unknown',
      
      // Parameters used
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      top_k: params.top_k,
      
      // Metrics configuration
      selected_metrics: selectedMetrics.join(', '),
      
      // File information
      prompt_file: promptFileName || 'none',
      reference_file: refFileName || 'none',
      
      // Timestamp
      evaluation_timestamp: new Date().toISOString(),
      
      // Prompt and reference text (truncated for CSV)
      prompt_text: draft.prompt?.substring(0, 500) + (draft.prompt?.length > 500 ? '...' : ''),
      reference_text: reference?.substring(0, 500) + (reference?.length > 500 ? '...' : ''),
      llm_output: llmOutput?.substring(0, 500) + (llmOutput?.length > 500 ? '...' : ''),
    };
    
    try {
      await downloadCSV([enhancedData], { filename: "prompt-eval-results.csv" });
    } catch (error) {
      console.error("Failed to download CSV:", error);
    }
  }, [scores, selected, params, selectedMetrics, promptFileName, refFileName, draft.prompt, reference, llmOutput]);

  const onDownloadPDF = useCallback(async () => {
    if (!scores) return;
    
    // Enhanced PDF with model, parameters, and metrics info
    const enhancedData = {
      ...scores,
      // Model information
      model_id: selected?.id || 'unknown',
      model_provider: selected?.provider || 'local',
      model_label: selected?.label || selected?.id || 'unknown',
      
      // Parameters used
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      top_k: params.top_k,
      
      // Metrics configuration
      selected_metrics: selectedMetrics.join(', '),
      
      // File information
      prompt_file: promptFileName || 'none',
      reference_file: refFileName || 'none',
      
      // Timestamp
      evaluation_timestamp: new Date().toISOString(),
      
      // Full text content for PDF
      prompt_text: draft.prompt || '',
      reference_text: reference || '',
      llm_output: llmOutput || '',
    };
    
    try {
      await downloadPDF([enhancedData], { filename: "prompt-eval-results.pdf" });
    } catch (error) {
      console.error("Failed to download PDF:", error);
    }
  }, [scores, selected, params, selectedMetrics, promptFileName, refFileName, draft.prompt, reference, llmOutput]);

  // Automation functionality
  const handleAutomationStart = useCallback(async (config: AutomationConfig) => {
    const automationId = automationStore.startAutomation('prompt', config);
    setLoadingType('automation');
    setIsAutomationProgressModalOpen(true);

    try {
      const results: Record<string, any> = {};
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < config.runs.length; i++) {
        const run = config.runs[i];
        
        // Update progress with animation
        automationStore.updateProgress(automationId, { currentRunIndex: i });

        // Declare variables outside try block so they're accessible in catch block
        let runPromptText = draft?.prompt || "";
        let runReference = reference || "";
        let runPromptFileName = promptFileName;
        let runRefFileName = refFileName;
        let runModelId = run.modelId || selected?.id;
        let runModelProvider = run.modelProvider || selected?.provider;
        let runSelectedMetrics: string[] = [];

        try {
          // Load per-run files if specified
          if (run.promptFileName && run.promptFileName !== promptFileName) {
            try {
              const data = await loadReferenceByName(run.promptFileName);
              runPromptText = data.text ?? "";
              runPromptFileName = run.promptFileName;
            } catch (e: any) {
              showError("Prompt File Load Failed", `Failed to load prompt file ${run.promptFileName}: ${e?.message ?? e}`);
              results[run.id] = {
                runName: run.name,
                error: `Failed to load prompt file: ${e?.message ?? e}`,
              };
              continue;
            }
          }

          // Load reference file for this run if specified
          if (run.referenceFileName && run.referenceFileName !== refFileName) {
            try {
              const data = await loadReferenceByName(run.referenceFileName);
              runReference = data.text ?? "";
              runRefFileName = run.referenceFileName;
            } catch (e: any) {
              showError("Reference File Load Failed", `Failed to load reference file ${run.referenceFileName}: ${e?.message ?? e}`);
              results[run.id] = {
                runName: run.name,
                error: `Failed to load reference file: ${e?.message ?? e}`,
              };
              continue;
            }
          }

          // Validate required data for this run
          if (!runPromptText.trim()) {
            results[run.id] = {
              runName: run.name,
              error: "No prompt text available for this run",
            };
            continue;
          }

          if (!runReference.trim()) {
            results[run.id] = {
              runName: run.name,
              error: "No reference text available for this run",
            };
            continue;
          }

          // Use per-run model if specified, otherwise use current selected model
          runModelId = run.modelId || selected?.id;
          runModelProvider = run.modelProvider || selected?.provider;
          
          if (!runModelId) {
            results[run.id] = {
              runName: run.name,
              error: "No model specified for this run",
            };
            continue;
          }


          // Build LLM output for this run
          const resources = resourceStore.getByIds(draft.resourceIds || []);
          let output = '';
          
          // Process template variables for this run
          const processedRunPrompt = processTemplateVariables(runPromptText, draft.context || '', resources);
          
          // Use the same streaming approach as the regular run
          for await (const chunk of callLLM({
            modelId: runModelId,
            prompt: processedRunPrompt,
            context: draft.context,
            resources,
            parameters: run.parameters as any,
          })) {
            output += chunk;
          }

          // Compute metrics - only compute selected metrics
          runSelectedMetrics = [];
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
            reference: runReference,
            metrics: runSelectedMetrics,
            meta: {
              model: runModelId,
              params: run.parameters,
              source_file: runPromptFileName,
              reference_file: runRefFileName,
            },
          });

          results[run.id] = {
            runName: run.name,
            prompt: runPromptText,
            parameters: run.parameters,
            metrics: run.metrics,
            output,
            scores: res.scores ?? res,
            model: { id: runModelId, provider: runModelProvider },
            files: {
              promptFileName: runPromptFileName,
              referenceFileName: runRefFileName,
            },
          };

          // Save individual evaluation to history
          try {
            const evaluation = {
              id: crypto.randomUUID(),
              type: 'prompt' as const,
              title: `${config.name} - ${run.name}`,
              model: { id: runModelId || "unknown", provider: runModelProvider || "local" },
              parameters: run.parameters,
              metrics: runSelectedMetrics,
              usedText: {
                promptText: runPromptText,
                context: draft.context,
                referenceText: runReference
              },
              files: {
                promptFileName: runPromptFileName,
                referenceFileName: runRefFileName
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
          errorCount++;
          results[run.id] = {
            runName: run.name,
            error: error?.message ?? String(error),
          };

          // Save failed evaluation to history
          try {
            const evaluation = {
              id: crypto.randomUUID(),
              type: 'prompt' as const,
              title: `${config.name} - ${run.name} (Failed)`,
              model: { id: runModelId || "unknown", provider: runModelProvider || "local" },
              parameters: run.parameters,
              metrics: runSelectedMetrics,
              usedText: {
                promptText: runPromptText,
                context: draft.context,
                referenceText: runReference
              },
              files: {
                promptFileName: runPromptFileName,
                referenceFileName: runRefFileName
              },
              results: {}, // Empty results for failed evaluations
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              automationId: config.id,
              runId: run.id,
              error: error?.message ?? String(error), // Store error message
            };
            await historyService.saveEvaluation?.(evaluation);
          } catch (e) {
            console.warn("Failed to save failed evaluation:", e);
          }
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
        const automationSetId = `prompt_${config.name}_${Date.now()}`;
        const automationAggregate = {
          id: config.id,
          name: config.name,
          type: 'prompt',
          model: { id: selected?.id || "unknown", provider: selected?.provider || "local" },
          parameters: params,
          runs: config.runs.map(run => ({
            id: run.id,
            runId: run.id,
            runName: run.name,
            prompt: run.prompt,
            parameters: run.parameters,
            metrics: run.metrics,
            modelId: run.modelId || selected?.id,
            modelProvider: run.modelProvider || selected?.provider,
            promptFileName: run.promptFileName ? makePathRelative(run.promptFileName) : (promptFileName ? makePathRelative(promptFileName) : null),
            referenceFileName: run.referenceFileName ? makePathRelative(run.referenceFileName) : (refFileName ? makePathRelative(refFileName) : null),
            results: results[run.id]?.scores || null,
            error: results[run.id]?.error || null,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            status: results[run.id]?.error ? "error" : "completed",
          })),
          status: errorCount === 0 ? "completed" : successCount === 0 ? "error" : "completed",
          createdAt: new Date().toISOString(),
          completedAt: new Date(),
          automationSetId: automationSetId,
        };
        await api.post("/history/automations", automationAggregate);
      } catch (e) {
        console.warn("Failed to save automation aggregate:", e);
      }
      
      // Show appropriate success/error message
      if (errorCount === 0) {
        showSuccess("Automation Complete", `All ${config.runs.length} runs completed successfully!`);
      } else if (successCount === 0) {
        showError("Automation Failed", `All ${config.runs.length} runs failed. Check the progress modal for details.`);
      } else {
        showSuccess("Automation Partially Complete", `${successCount} runs succeeded, ${errorCount} failed. Check the progress modal for details.`);
      }

    } catch (error: any) {
      automationStore.completeAutomation(automationId, error?.message ?? String(error));
      showError("Automation Failed", "Automation failed: " + (error?.message ?? String(error)));
    } finally {
      setLoadingType(null);
    }
  }, [selected, draft, reference, promptFileName, refFileName, showError, showSuccess, processTemplateVariables]);

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
    if (window.confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      promptEvalStore.clearDraft();
      setDraft(promptEvalStore.getDraft());
      setCurrentRun(null);
      setError(null);
      setPromptText("");
      setReference("");
      setPromptFileName("");
      setRefFileName("");
      setLlmOutput("");
      setScores(null);
      showSuccess("Data Cleared", "All data has been cleared successfully.");
    }
  }, [showSuccess]);

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
              setLoadingType('prompt');
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
                setLoadingType(null);
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
              setLoadingType('prompt');
              try {
                const data = await loadReferenceByName(name);
                setRefFileName(data.filename);
                setReference(data.text);
              } catch (e: any) {
                showError("Load Reference Failed", "Load reference failed: " + (e?.response?.data?.detail ?? e?.message ?? e));
              } finally {
                setLoadingType(null);
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
      
      {(draft?.prompt || draft?.context || promptText || reference || promptFileName || refFileName) && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={handleClear}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              border: "none",
              color: "#ffffff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
            </svg>
            Clear All Data
          </button>
        </div>
      )}
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
              <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3, marginLeft: 6 }}>{'{resources}'}</code>
              inside your prompt to inject the current context and resources.
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
        <TextDisplay
          editable
          value={draft?.prompt ?? ""}
          onChange={(value) => updateDraft({ prompt: value })}
          title="Prompt"
        />
        
        {/* Template Variable Preview */}
        {(draft?.prompt?.includes('{context}') || draft?.prompt?.includes('{resources}')) && (
          <div style={{ 
            marginTop: 12,
            padding: 12,
            background: "#1e293b",
            borderRadius: 8,
            border: "1px solid #334155"
          }}>
            <div style={{ 
              fontSize: 12, 
              color: "#94a3b8", 
              marginBottom: 8,
              fontWeight: 600
            }}>
              Template Preview:
            </div>
            <div style={{ 
              fontSize: 13, 
              color: "#e2e8f0",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              maxHeight: 150,
              overflow: "auto",
              padding: 8,
              background: "#0f172a",
              borderRadius: 4,
              border: "1px solid #475569"
            }}>
              {processTemplateVariables(
                draft?.prompt || "", 
                draft?.context || "", 
                resourceStore.getByIds(draft?.resourceIds || [])
              )}
            </div>
          </div>
        )}
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
          <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3, marginLeft: 6 }}>{'{resources}'}</code>
          inside your prompt to inject the current context and resources.
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
        <TextDisplay
          editable
          value={currentRun?.output ?? llmOutput ?? ""}
          onChange={setLlmOutput}
          title="LLM Output"
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
        <TextDisplay
          editable
          value={reference}
          onChange={setReference}
          title="Reference Text"
        />
      </section>
    </>
  );

  const renderSideBySideView = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, height: "100%", flex: 1 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Prompt</h3>
        <TextDisplay
          editable
          value={draft?.prompt ?? ""}
          onChange={(value) => updateDraft({ prompt: value })}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>LLM Output</h3>
        <TextDisplay
          editable
          value={currentRun?.output ?? llmOutput ?? ""}
          onChange={setLlmOutput}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Reference Text</h3>
        <TextDisplay
          editable
          value={reference}
          onChange={setReference}
        />
      </section>
    </div>
  );

  const renderCompareTwoView = () => {
    const getTextForType = (type: "prompt" | "llm" | "reference") => {
      switch (type) {
        case "prompt": return draft?.prompt ?? "";
        case "llm": return currentRun?.output ?? llmOutput ?? "";
        case "reference": return reference;
        default: return "";
      }
    };

    const getTitleForType = (type: "prompt" | "llm" | "reference") => {
      switch (type) {
        case "prompt": return "Prompt";
        case "llm": return "LLM Output";
        case "reference": return "Reference Text";
        default: return "";
      }
    };

    const isEditable = (type: "prompt" | "llm" | "reference") => {
      return type === "prompt" || type === "llm" || type === "reference";
    };

    const handleTextChange = (type: "prompt" | "llm" | "reference", value: string) => {
      switch (type) {
        case "prompt": 
          updateDraft({ prompt: value });
          break;
        case "llm": 
          setLlmOutput(value);
          break;
        case "reference": 
          setReference(value);
          break;
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", flex: 1 }}>
        {/* Selection Controls */}
        <div style={{ 
          display: "flex", 
          gap: 16, 
          padding: 16, 
          background: "#1e293b", 
          borderRadius: 8, 
          border: "1px solid #334155" 
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>First Item</label>
            <select
              value={compareSelection.first}
              onChange={(e) => setCompareSelection(prev => ({ ...prev, first: e.target.value as "prompt" | "llm" | "reference" }))}
              style={{
                padding: "8px 12px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                fontSize: 14,
                outline: "none",
                transition: "all 0.2s ease"
              }}
            >
              <option value="prompt">Prompt</option>
              <option value="llm">LLM Output</option>
              <option value="reference">Reference Text</option>
            </select>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>Second Item</label>
            <select
              value={compareSelection.second}
              onChange={(e) => setCompareSelection(prev => ({ ...prev, second: e.target.value as "prompt" | "llm" | "reference" }))}
              style={{
                padding: "8px 12px",
                border: "1px solid #334155",
                borderRadius: 6,
                background: "#0f172a",
                color: "#e2e8f0",
                fontSize: 14,
                outline: "none",
                transition: "all 0.2s ease"
              }}
            >
              <option value="prompt">Prompt</option>
              <option value="llm">LLM Output</option>
              <option value="reference">Reference Text</option>
            </select>
          </div>
        </div>

        {/* Comparison View */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: "100%", flex: 1 }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>{getTitleForType(compareSelection.first)}</h3>
            <TextDisplay 
              editable={isEditable(compareSelection.first)}
              value={getTextForType(compareSelection.first)} 
              onChange={isEditable(compareSelection.first) ? 
                (value) => handleTextChange(compareSelection.first, value) : 
                undefined
              }
            />
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>{getTitleForType(compareSelection.second)}</h3>
            <TextDisplay 
              editable={isEditable(compareSelection.second)}
              value={getTextForType(compareSelection.second)} 
              onChange={isEditable(compareSelection.second) ? 
                (value) => handleTextChange(compareSelection.second, value) : 
                undefined
              }
            />
          </section>
        </div>
      </div>
    );
  };

  return (
    <LayoutShell title="Prompt Evaluation" left={left} right={right} rightWidth={400}>

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
          <LoadingButton 
            onClick={onEvaluate} 
            isLoading={loadingType === 'metrics'}
            disabled={loadingType === 'metrics'}
            style={{ 
              padding: "12px 20px", 
              background: loadingType === 'metrics'
                ? "#6b7280" 
                : "linear-gradient(135deg, #10b981, #059669)", 
              border: "none", 
              color: "#ffffff", 
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loadingType === 'metrics' ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loadingType === 'metrics' ? "Processing..." : "Run Evaluation"}
          </LoadingButton>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            
            <AutomationProgressIndicator onOpenModal={() => setIsAutomationProgressModalOpen(true)} />
          </div>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h4 style={{ color: "#e2e8f0", margin: 0 }}>Automation Results</h4>
                <div style={{ display: "flex", gap: 8 }}>
                  <button 
                    onClick={() => {
                      // Export automation results as CSV
                      const automationData = Object.values(automationResults).map((result: any) => ({
                        run_name: result.runName,
                        model_id: result.model?.id || 'unknown',
                        model_provider: result.model?.provider || 'local',
                        status: result.error ? 'error' : 'success',
                        error: result.error || '',
                        scores: result.scores ? JSON.stringify(result.scores) : '',
                        prompt_file: result.files?.promptFileName || 'none',
                        reference_file: result.files?.referenceFileName || 'none',
                        timestamp: new Date().toISOString()
                      }));
                      downloadCSV(automationData, { filename: "automation-results.csv" });
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Export CSV
                  </button>
                  <button 
                    onClick={() => {
                      // Export automation results as PDF
                      const automationData = Object.values(automationResults).map((result: any) => ({
                        run_name: result.runName,
                        model_id: result.model?.id || 'unknown',
                        model_provider: result.model?.provider || 'local',
                        status: result.error ? 'error' : 'success',
                        error: result.error || '',
                        scores: result.scores || {},
                        prompt_file: result.files?.promptFileName || 'none',
                        reference_file: result.files?.referenceFileName || 'none',
                        timestamp: new Date().toISOString()
                      }));
                      downloadPDF(automationData, { filename: "automation-results.pdf" });
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "linear-gradient(135deg, #ef4444, #dc2626)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Export PDF
                  </button>
                </div>
              </div>
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
        onClose={() => {
          setIsAutomationModalOpen(false);
          setLoadedAutomationSet(null);
          setLoadedAutomationName("");
        }}
        onStart={handleAutomationStart}
        presetStore={promptEvalPresetStore}
        defaultPrompt={draft?.prompt || ""}
        kind="prompt"
        loadedAutomationSet={loadedAutomationSet}
        loadedAutomationName={loadedAutomationName}
      />
      
      {/* Automation Progress Modal */}
      <AutomationProgressModal
        isOpen={isAutomationProgressModalOpen}
        onClose={() => setIsAutomationProgressModalOpen(false)}
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
