// src/pages/OCR/OCRPage.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import LeftRail from "@/components/LeftRail/LeftRail";

import FileDrop from "@/components/FileDrop/FileDrop";
import ExpandableTextarea from "@/components/ExpandableTextarea/ExpandableTextarea";
import PromptPresetBox from "@/components/PresetPanel/PromptPresetBox";
import PresetManager from "@/components/PresetPanel/PresetManager";
import ParamsPanel, { ModelParams } from "@/components/RightPanel/ParamsPanel";
import MetricsPanel, { DEFAULT_METRICS, MetricState } from "@/components/RightPanel/MetricsPanel";
import { ocrPresetStore, Preset } from "@/stores/presetStore";
import { extractOCR, OCRExtractResponse } from "@/services/ocr";
import { computeMetrics, downloadCSV, downloadPDF } from "@/services/eval";
import { chatComplete } from "@/services/llm";
import { api } from "@/services/api";
import { listFiles, loadReferenceByName } from "@/services/files";
import { makePathRelative } from "@/lib/pathUtils";
import { useSelectedModelId } from "@/hooks/useSelectedModelId";
import { useModel } from "@/context/ModelContext";
import { completeLLM } from "@/services/llm";
import { useNotifications } from "@/components/Notification/Notification";
import { useBackgroundState } from "@/stores/backgroundState";
import { historyService } from "@/services/history";
import LayoutShell from "@/components/Layout/LayoutShell";
import AutomationModal, { AutomationConfig } from "@/components/AutomationModal/AutomationModal";
import { automationStore } from "@/stores/automationStore";
import AutomationProgressIndicator from "@/components/AutomationProgress/AutomationProgressIndicator";
import AutomationProgressModal from "@/components/AutomationProgress/AutomationProgressModal";

const DEFAULT_PARAMS: ModelParams = { temperature: 0.2, max_tokens: 1024, top_p: 1.0, top_k: 40 };

function renderPrompt(tmpl: string, ocrText: string, refText: string) {
  return tmpl
    .replace(/\{extracted text\}/gi, ocrText || "")
    .replace(/\{pdf_text\}/gi, ocrText || "")
    .replace(/\{source_text\}/gi, ocrText || "")
    .replace(/\{reference\}/gi, refText || "");
}

export default function OCRPage() {
  // sidebar state
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // left panel state
  const [srcFileName, setSrcFileName] = useState("");
  const [ocr, setOcr] = useState<OCRExtractResponse | null>(null);
  const [refFileName, setRefFileName] = useState("");
  const [reference, setReference] = useState("");
  const [sourceChoices, setSourceChoices] = useState<string[]>([]);
  const [referenceChoices, setReferenceChoices] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"form" | "side-by-side" | "compare-two">("form");

  // right panel state
  const [textareaContent, setTextareaContent] = useState(() => {
    const savedPrompt = localStorage.getItem("ocr-prompt");
    return savedPrompt || "";
  });

  // Save prompt to localStorage whenever it changes
  const handlePromptChange = (newPrompt: string) => {
    setTextareaContent(newPrompt);
    localStorage.setItem("ocr-prompt", newPrompt);
  };

  // Handle preset changes
  const handlePresetChange = (preset: { title: string; body: string; id: string; parameters?: Preset['parameters']; metrics?: Preset['metrics'] }) => {
    const presetText = preset.body || "";
    setTextareaContent(presetText);
    localStorage.setItem("ocr-prompt", presetText);
    
    // Apply parameters if they exist
    if (preset.parameters) {
      setParams(prev => ({
        ...prev,
        temperature: preset.parameters?.temperature ?? prev.temperature,
        max_tokens: preset.parameters?.max_tokens ?? prev.max_tokens,
        top_p: preset.parameters?.top_p ?? prev.top_p,
        top_k: preset.parameters?.top_k ?? prev.top_k,
      }));
    }
    
    // Apply metrics if they exist
    if (preset.metrics) {
      setMetricsState(prev => ({
        ...prev,
        ...preset.metrics
      }));
    }
  };

  // Handle tab switching - preserve current content
  const handleTabSwitch = (newTab: "prompt" | "parameters" | "metrics") => {
    // Save current prompt content before switching tabs
    if (activeRightTab === "prompt") {
      localStorage.setItem("ocr-prompt", textareaContent);
    }
    setActiveRightTab(newTab);
  };

  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS);
  const [metricsState, setMetricsState] = useState<MetricState>(DEFAULT_METRICS);

  // Model selection & helpers
  const model_id = useSelectedModelId(false);
  const { showError, showSuccess } = useNotifications();
  const { addOperation, updateOperation } = useBackgroundState();

  // main form
  const [llmOutput, setLlmOutput] = useState("");
  const [scores, setScores] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { selected } = useModel();
  const [ocrText, setOcrText] = useState("");
  const [refText, setRefText] = useState("");
  const [llmOut, setLlmOut] = useState("");
  const [metrics, setMetrics] = useState<string[]>([]); // not used directly, kept for compatibility
  
  // Automation state
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [isAutomationProgressModalOpen, setIsAutomationProgressModalOpen] = useState(false);
  const [automationResults, setAutomationResults] = useState<Record<string, any>>({});
  // Automation progress overlay state
  const [automationProgress, setAutomationProgress] = useState<{
    id: string;
    currentRunIndex: number;
    status: "running" | "completed" | "error";
  } | null>(null);
  
  // Prompt enlarge modal state
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Allow loading an evaluation from navigation state (HomePage "Load")
  const location = useLocation();
  useEffect(() => {
    const state: any = location.state;
    const evalToLoad = state?.loadEvaluation;
    const automationToLoad = state?.loadAutomation;
    
    if (evalToLoad?.type === "ocr") {
      try {
        const used = evalToLoad.usedText || {};
        setOcrText(used.ocrText ?? "");
        setReference(used.referenceText ?? "");
        setTextareaContent(used.promptText ?? textareaContent);
        // If the evaluation already had results, show them immediately
        if (evalToLoad.results && typeof evalToLoad.results === "object") {
          setScores(evalToLoad.results as any);
        }
        // Try to load original files as well (if available)
        const srcName: string | undefined = evalToLoad.files?.sourceFileName;
        const refName: string | undefined = evalToLoad.files?.referenceFileName;
        if (srcName) {
          (async () => {
            try {
              const res = await api.get(`/files/load`, { params: { kind: "source", name: srcName }, responseType: "blob" });
              const file = new File([res.data], srcName);
              await onSourceUpload(file);
            } catch {}
          })();
        }
        if (refName) {
          (async () => {
            try {
              const data = await loadReferenceByName(refName);
              setRefFileName(data.filename);
              setReference(data.text);
              setRefText(data.text ?? "");
            } catch {}
          })();
        }
      } catch {}
    } else if (automationToLoad?.type === "ocr") {
      try {
        // Load automation data
        const firstRun = automationToLoad.runs?.[0];
        if (firstRun) {
          setOcrText(firstRun.prompt || "");
          setReference("");
          setTextareaContent(firstRun.prompt || "");
          
          // Load files from the first run
          if (firstRun.sourceFileName) {
            (async () => {
              try {
                const res = await api.get(`/files/load`, { params: { kind: "source", name: firstRun.sourceFileName }, responseType: "blob" });
                const file = new File([res.data], firstRun.sourceFileName);
                await onSourceUpload(file);
              } catch {}
            })();
          }
          if (firstRun.referenceFileName) {
            (async () => {
              try {
                const data = await loadReferenceByName(firstRun.referenceFileName);
                setRefFileName(data.filename);
                setReference(data.text);
                setRefText(data.text ?? "");
              } catch {}
            })();
          }
        }
      } catch {}
    }
  // run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = useMemo(
    () => ({
      model: selected?.id ?? "(select at top)",
      params,
      source_file: srcFileName,
      reference_file: refFileName,
    }),
    [params, srcFileName, refFileName, selected]
  );

  // Build LLM Output (from older file)
  const onBuild = async () => {
    if (!selected) {
      showError("Model Required", "Select a model first.");
      return;
    }
    if (!textareaContent) {
      showError("Prompt Required", "Select or write a prompt first.");
      return;
    }

    const prompt = renderPrompt(textareaContent, ocrText, refText);
    try {
      const res = await completeLLM({
        model_id: selected.id,
        provider: selected.provider as "groq" | "local",
        messages: [{ role: "user", content: prompt }],
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        top_p: params.top_p,
      });
      setLlmOut(res.output || "");
      setLlmOutput(res.output || "");
    } catch (e: any) {
      showError("LLM Call Failed", "LLM call failed: " + (e?.message ?? String(e)));
    }
  };

  // ----- actions -----
  const onSourceUpload = async (file: File) => {
    setBusy("Extracting OCR...");
    setSrcFileName(file.name);
    try {
      const res = await extractOCR(file);
      setOcr(res);
      setOcrText(res?.text ?? "");
    } catch (e: any) {
      showError("OCR Failed", "OCR failed: " + (e?.response?.data?.detail ?? e.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const onReferenceUpload = async (file: File) => {
    setRefFileName(file.name);
    setBusy("Extracting reference…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/ocr/reference", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReference(res.data.text ?? "");
      setRefText(res.data.text ?? "");
    } catch (e: any) {
      showError("Reference Extraction Failed", "Reference extraction failed: " + (e?.response?.data?.detail ?? e.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const buildLlmOutput = async () => {
    if (!selected) {
      showError("Model Required", "Select a model first.");
      return;
    }
    if (!textareaContent.trim()) {
      showError("Prompt Required", "Select or write a prompt in the right panel.");
      return;
    }

    const injected = renderPrompt(textareaContent, ocr?.text ?? "", reference || "");
    // sanity check
    if (injected.trim().length < 10) {
      showError("Prompt Too Short", "The prompt after injection is too short. Make sure you have OCR text or reference text, or write a longer prompt.");
      return;
    }

    setBusy("Calling LLM…");
    try {
      const output = await chatComplete(
        selected.id,
        [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: injected },
        ],
        params
      );
      setLlmOutput(output || "");
      setLlmOut(output || "");
    } catch (e: any) {
      console.error("LLM call error:", e);
      let errorMessage = "Unknown error";
      let errorTitle = "LLM Call Failed";

      if (e?.response?.data?.detail) {
        errorMessage = e.response.data.detail;
        if (errorMessage.includes("not compatible with chat completions")) {
          errorTitle = "Incompatible Model";
          errorMessage = "This model is not designed for text generation. Please select a different model.";
        } else if (errorMessage.includes("GROQ_API_KEY not set")) {
          errorTitle = "API Key Missing";
          errorMessage = "Please set your GROQ_API_KEY in the backend/.env file.";
        } else if (errorMessage.includes("502")) {
          errorTitle = "Model Error";
          errorMessage = "The selected model returned an error. Try a different model.";
        }
      } else if (e?.message) {
        errorMessage = e.message;
      }

      showError(errorTitle, errorMessage);
    } finally {
      setBusy(null);
    }
  };

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

  // When metrics selection changes, clear prior scores so the user can recompute
  useEffect(() => {
    setScores(null);
  }, [metricsState]);

  const onEvaluate = async () => {
    if (!selected) {
      showError("Model Required", "Select a model first.");
      return;
    }
    if (!textareaContent.trim()) {
      showError("Prompt Required", "Select or write a prompt (Prompt preset box).");
      return;
    }
    if (!reference) {
      showError("Missing Reference", "Provide reference text first.");
      return;
    }

    // If LLM output is empty, automatically run Build LLM first
    let currentLlmOutput = llmOutput;
    if (!currentLlmOutput || currentLlmOutput.trim() === "") {
      setBusy("Building LLM output...");
      try {
        const injected = renderPrompt(textareaContent, ocr?.text ?? "", reference || "");
        if (injected.trim().length < 10) {
          showError("Prompt Too Short", "The prompt after injection is too short.");
          return;
        }

        const output = await chatComplete(
          selected.id,
          [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: injected },
          ],
          params
        );
        setLlmOutput(output || "");
        currentLlmOutput = output || "";
      } catch (e: any) {
        console.error("LLM call error:", e);
        let errorMessage = e?.message ?? "Unknown error";
        let errorTitle = "LLM Call Failed";
        if (e?.response?.data?.detail) {
          errorMessage = e.response.data.detail;
          if (errorMessage.includes("GROQ_API_KEY not set")) {
            errorTitle = "API Key Missing";
            errorMessage = "Please set your GROQ_API_KEY in the backend/.env file.";
          }
        }
        showError(errorTitle, errorMessage);
        return;
      } finally {
        setBusy(null);
      }
    }

    setBusy("Computing metrics...");
    const operationId = addOperation({
      type: "ocr",
      status: "running",
      progress: 0,
    });

    try {
      const res = await computeMetrics({
        prediction: currentLlmOutput,
        reference,
        metrics: selectedMetrics,
        meta,
      });

      const m = res?.scores ?? (res as any) ?? {};
      setScores(m);

      // Save evaluation to history
      const evaluation = {
        id: crypto.randomUUID(),
        type: "ocr" as const,
        title: `OCR Evaluation - ${new Date().toLocaleDateString('en-GB')}`,
        model: { id: selected.id, provider: selected.provider },
        parameters: params,
        metrics: selectedMetrics,
        usedText: {
          ocrText: ocr?.text ?? "",
          referenceText: reference,
          promptText: renderPrompt(textareaContent, ocr?.text ?? "", reference || ""),
        },
        files: {
          sourceFileName: srcFileName,
          referenceFileName: refFileName,
        },
        results: m,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      };

      await historyService.saveEvaluation(evaluation);

      updateOperation(operationId, {
        status: "completed",
        progress: 100,
        endTime: Date.now(),
      });

      showSuccess("Evaluation Complete", "OCR evaluation completed and saved successfully!");
    } catch (e: any) {
      updateOperation(operationId, {
        status: "error",
        error: e?.response?.data?.detail ?? e.message ?? String(e),
        endTime: Date.now(),
      });
      showError("Metric Computation Failed", "Metric computation failed: " + (e?.response?.data?.detail ?? e.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const onDownloadCSV = async () => {
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
      source_file: srcFileName || 'none',
      reference_file: refFileName || 'none',
      
      // Timestamp
      evaluation_timestamp: new Date().toISOString(),
      
      // OCR and reference text (truncated for CSV)
      ocr_text: ocrText?.substring(0, 500) + (ocrText?.length > 500 ? '...' : ''),
      reference_text: reference?.substring(0, 500) + (reference?.length > 500 ? '...' : ''),
      llm_output: llmOutput?.substring(0, 500) + (llmOutput?.length > 500 ? '...' : ''),
    };
    
    try {
      await downloadCSV([enhancedData], { filename: "ocr-evaluation.csv" });
    } catch (error) {
      console.error("Failed to download CSV:", error);
    }
  };

  const onDownloadPDF = async () => {
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
      source_file: srcFileName || 'none',
      reference_file: refFileName || 'none',
      
      // Timestamp
      evaluation_timestamp: new Date().toISOString(),
      
      // Full text content for PDF
      ocr_text: ocrText || '',
      reference_text: reference || '',
      llm_output: llmOutput || '',
    };
    
    try {
      await downloadPDF([enhancedData], { filename: "ocr-evaluation.pdf" });
    } catch (error) {
      console.error("Failed to download PDF:", error);
    }
  };

  // Automation functionality
  const handleAutomationStart = async (config: AutomationConfig) => {
    const automationId = automationStore.startAutomation('ocr', config);
    setBusy("Running automation...");
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
          // Load per-run files if specified
          let runOcrText = ocr?.text || "";
          let runReference = reference || "";
          let runSrcFileName = srcFileName;
          let runRefFileName = refFileName;

          // Load source file for this run if specified
          if (run.sourceFileName && run.sourceFileName !== srcFileName) {
            setBusy(`Loading source file for ${run.name}...`);
            try {
              const res = await api.get(`/files/load`, { params: { kind: "source", name: run.sourceFileName }, responseType: "blob" });
              const file = new File([res.data], run.sourceFileName);
              const ocrRes = await extractOCR(file);
              runOcrText = ocrRes?.text ?? "";
              runSrcFileName = run.sourceFileName;
            } catch (e: any) {
              showError("Source File Load Failed", `Failed to load source file ${run.sourceFileName}: ${e?.message ?? e}`);
              results[run.id] = {
                runName: run.name,
                error: `Failed to load source file: ${e?.message ?? e}`,
              };
              continue;
            }
          }

          // Load reference file for this run if specified
          if (run.referenceFileName && run.referenceFileName !== refFileName) {
            setBusy(`Loading reference file for ${run.name}...`);
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
          if (!runOcrText) {
            results[run.id] = {
              runName: run.name,
              error: "No OCR text available for this run",
            };
            continue;
          }

          if (!runReference) {
            results[run.id] = {
              runName: run.name,
              error: "No reference text available for this run",
            };
            continue;
          }

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

          setBusy(`Running ${run.name}...`);

          // Build LLM output for this run
          const injected = renderPrompt(run.prompt, runOcrText, runReference);
          const output = await chatComplete(
            runModelId,
            [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: injected },
            ],
            run.parameters
          );

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
            prediction: output || "",
            reference: runReference,
            metrics: runSelectedMetrics,
            meta: {
              model: runModelId,
              params: run.parameters,
              source_file: runSrcFileName,
              reference_file: runRefFileName,
            },
          });

          results[run.id] = {
            runName: run.name,
            prompt: run.prompt,
            parameters: run.parameters,
            metrics: run.metrics,
            output,
            scores: res.scores ?? res,
            model: { id: runModelId, provider: runModelProvider },
            files: {
              sourceFileName: runSrcFileName,
              referenceFileName: runRefFileName,
            },
          };

          // Save individual evaluation to history
          try {
            const evaluation = {
              id: crypto.randomUUID(),
              type: "ocr" as const,
              title: `${config.name} - ${run.name}`,
              model: { id: runModelId, provider: runModelProvider || "local" },
              parameters: run.parameters,
              metrics: runSelectedMetrics,
              usedText: {
                ocrText: runOcrText,
                referenceText: runReference,
                promptText: injected,
              },
              files: {
                sourceFileName: runSrcFileName,
                referenceFileName: runRefFileName,
              },
              results: res.scores ?? res,
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              automationId: config.id,
              runId: run.id,
            };
            await historyService.saveEvaluation(evaluation);
          } catch (e) {
            console.warn("Failed to save evaluation:", e);
          }

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
          type: 'ocr',
          model: { id: selected?.id || "unknown", provider: selected?.provider || "local" },
          parameters: params,
          runs: config.runs.map(run => ({
            id: run.id,
            name: run.name,
            prompt: run.prompt,
            parameters: run.parameters,
            metrics: run.metrics,
            modelId: run.modelId || selected?.id,
            modelProvider: run.modelProvider || selected?.provider,
            sourceFileName: run.sourceFileName ? makePathRelative(run.sourceFileName) : (srcFileName ? makePathRelative(srcFileName) : null),
            referenceFileName: run.referenceFileName ? makePathRelative(run.referenceFileName) : (refFileName ? makePathRelative(refFileName) : null),
            results: results[run.id]?.scores || null,
            error: results[run.id]?.error || null,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            status: results[run.id]?.error ? "error" : "completed",
          })),
          status: errorCount === 0 ? "completed" : successCount === 0 ? "error" : "completed",
          createdAt: new Date().toISOString(),
          completedAt: new Date(),
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
      setBusy(null);
    }
  };

  // ----- left quick-load lists -----
  useEffect(() => {
    (async () => {
      try {
        const s = await listFiles("source");
        setSourceChoices(s.files ?? []);
        const r = await listFiles("reference");
        setReferenceChoices(r.files ?? []);
      } catch {
        // ignore listing errors
      }
    })();
  }, []);

  const [activeRightTab, setActiveRightTab] = useState<"prompt" | "parameters" | "metrics">("prompt");
  const getCurrentPromptText = () => textareaContent || "";

  // ----- UI fragments -----
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

      <h3 style={{ margin: 0, color: "#e2e8f0" }}>Source (OCR)</h3>
      <FileDrop onFile={onSourceUpload} accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" label="Drop source file (PDF/Image) or click" />
      {sourceChoices.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Quick load from folder</div>
          <select
            className="select h-10 text-sm"
            id="srcQuick"
            onChange={async (e) => {
              const name = e.target.value;
              if (!name) return;
              setBusy("Loading source…");
              try {
                const res = await api.get(`/files/load`, { params: { kind: "source", name }, responseType: "blob" });
                const file = new File([res.data], name);
                await onSourceUpload(file);
              } catch (e: any) {
                showError("Load Source Failed", "Load source failed: " + (e?.response?.data?.detail ?? e.message ?? e));
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
              fontSize: "14px",
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Select a file
            </option>
            {sourceChoices.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {ocr && (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          <div>
            File: <b>{srcFileName}</b>
          </div>
          <div>Pages: {ocr.page_count}</div>
        </div>
      )}

      <h3 style={{ color: "#e2e8f0" }}>Reference</h3>
      <FileDrop onFile={onReferenceUpload} accept=".pdf,.txt,.png,.jpg,.jpeg,.tif,.tiff" label="Drop reference (PDF/TXT/Image) or click" />
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
                setRefText(data.text ?? "");
              } catch (e: any) {
                showError("Load Reference Failed", "Load reference failed: " + (e?.response?.data?.detail ?? e.message ?? e));
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
              fontSize: "14px",
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Select a file
            </option>
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
    </div>
  );

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
          { key: "prompt", label: "Prompt", icon: (
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
              onPresetChange={handlePresetChange} 
              autoApplyOnMount={false} 
              presetStore={ocrPresetStore}
              currentContent={textareaContent}
              currentParameters={params}
              currentMetrics={metricsState}
            />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label 
                htmlFor="prompt-textarea"
                style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: "#e2e8f0"
                }}
              >
                Prompt Template
              </label>
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
              value={getCurrentPromptText()} 
              onChange={handlePromptChange}
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
              <strong>Template Variables:</strong> Use <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3 }}>{'{extracted text}'}</code>, <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3 }}>{'{reference}'}</code>, <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3 }}>{'{pdf_text}'}</code>, or <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3 }}>{'{source_text}'}</code> in your prompt.
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
              onPresetChange={handlePresetChange} 
              autoApplyOnMount={false} 
              presetStore={ocrPresetStore}
              currentContent={textareaContent}
              currentParameters={params}
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
              onPresetChange={handlePresetChange} 
              autoApplyOnMount={false} 
              presetStore={ocrPresetStore}
              currentContent={textareaContent}
              currentParameters={params}
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
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
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
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 18, fontWeight: 600 }}>OCR Extracted Text</h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
              {ocr ? `${ocr.page_count} page${ocr.page_count !== 1 ? 's' : ''} processed` : "No document processed yet"}
            </p>
          </div>
        </div>
        <ExpandableTextarea 
          value={ocr?.text ?? ""} 
        />
      </section>

      <section style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: 12,
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
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
                {llmOutput ? `${llmOutput.length} characters` : "No output generated yet"}
              </p>
            </div>
          </div>
          
        </div>
        <ExpandableTextarea 
          editable 
          value={llmOutput} 
          onChange={setLlmOutput}
          
        />
        <div>
          <button
            onClick={buildLlmOutput}
            disabled={busy === "Calling LLM…"}
            style={{ 
              padding: "12px 20px", 
              background: busy === "Calling LLM…" 
                ? "#6b7280" 
                : "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
              border: "none", 
              color: "#ffffff", 
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: busy === "Calling LLM…" ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (busy !== "Calling LLM…") {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
              }
            }}
            onMouseLeave={(e) => {
              if (busy !== "Calling LLM…") {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
            </svg>
            {busy === "Calling LLM…" ? "Processing..." : "Build LLM Output"}
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
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>OCR Extracted Text</h3>
        <ExpandableTextarea value={ocr?.text ?? ""} />
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>LLM Output</h3>
        <ExpandableTextarea editable value={llmOutput} onChange={setLlmOutput} />
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Reference Text</h3>
        <ExpandableTextarea editable value={reference} onChange={setReference} />
      </section>

      <div />
    </div>
  );

  const renderCompareTwoView = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>OCR Extracted Text</h3>
        <ExpandableTextarea value={ocr?.text ?? ""} />
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Reference Text</h3>
        <ExpandableTextarea editable value={reference} onChange={setReference} />
      </section>
    </div>
  );

  return (
    <LayoutShell title="OCR Evaluation" left={left} right={right} rightWidth={400}>
      {/* Automation progress overlay */}
      {automationProgress && (
        <div style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
          minWidth: 280,
          background: "#0b1220",
          border: "1px solid #334155",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          padding: 16,
          color: "#e2e8f0",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Running Automation</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Run {automationProgress.currentRunIndex + 1}</div>
              </div>
            </div>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: automationProgress.status === "running" ? "#10b981" : automationProgress.status === "error" ? "#ef4444" : "#3b82f6", boxShadow: automationProgress.status === "running" ? "0 0 8px rgba(16,185,129,0.6)" : "none" }} />
          </div>
          <div style={{ height: 6, background: "#1e293b", borderRadius: 999, overflow: "hidden", border: "1px solid #334155" }}>
            <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg,#3b82f6,#8b5cf6)", animation: "progressStripe 1.2s linear infinite" }} />
          </div>
          <style>
            {`@keyframes progressStripe {0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}
          </style>
        </div>
      )}
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

      {viewMode === "form" && renderFormView()}
      {viewMode === "side-by-side" && renderSideBySideView()}
      {viewMode === "compare-two" && renderCompareTwoView()}

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
        <button
          onClick={onEvaluate}
          disabled={busy === "Computing metrics..."}
          style={{ 
            padding: "12px 20px", 
            background: busy === "Computing metrics..." 
              ? "#6b7280" 
              : "linear-gradient(135deg, #10b981, #059669)", 
            border: "none", 
            color: "#ffffff", 
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: busy === "Computing metrics..." ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
          {busy === "Computing metrics..." ? "Computing..." : "Run Evaluation"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setIsAutomationModalOpen(true)}
            style={{ 
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
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
              <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
            </svg>
            Run Automation
          </button>
          
          <AutomationProgressIndicator onOpenModal={() => setIsAutomationProgressModalOpen(true)} />
        </div>
        <button
          onClick={onDownloadCSV}
          disabled={!scores}
          style={{ 
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
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
          Download CSV
        </button>
        <button
          onClick={onDownloadPDF}
          disabled={!scores}
          style={{ 
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
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
          Download PDF
        </button>
      </div>

      {/* Automation Results */}
      {Object.keys(automationResults).length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>Automation Results</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button 
                onClick={async () => {
                  // Export automation results as CSV
                  const automationData = Object.values(automationResults).map((result: any) => ({
                    run_name: result.runName,
                    model_id: result.model?.id || 'unknown',
                    model_provider: result.model?.provider || 'local',
                    status: result.error ? 'error' : 'success',
                    error: result.error || '',
                    scores: result.scores ? JSON.stringify(result.scores) : '',
                    source_file: result.files?.sourceFileName || 'none',
                    reference_file: result.files?.referenceFileName || 'none',
                    timestamp: new Date().toISOString()
                  }));
                  try {
                    await downloadCSV(automationData, { filename: "ocr-automation-results.csv" });
                  } catch (error) {
                    console.error("Failed to download automation CSV:", error);
                  }
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
                onClick={async () => {
                  // Export automation results as PDF
                  const automationData = Object.values(automationResults).map((result: any) => ({
                    run_name: result.runName,
                    model_id: result.model?.id || 'unknown',
                    model_provider: result.model?.provider || 'local',
                    status: result.error ? 'error' : 'success',
                    error: result.error || '',
                    scores: result.scores || {},
                    source_file: result.files?.sourceFileName || 'none',
                    reference_file: result.files?.referenceFileName || 'none',
                    timestamp: new Date().toISOString()
                  }));
                  try {
                    await downloadPDF(automationData, { filename: "ocr-automation-results.pdf" });
                  } catch (error) {
                    console.error("Failed to download automation PDF:", error);
                  }
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
                <h4 style={{ margin: "0 0 12px 0", color: "#e2e8f0" }}>{result.runName}</h4>
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
        </section>
      )}

      {/* Automation Modal */}
      <AutomationModal
        isOpen={isAutomationModalOpen}
        onClose={() => setIsAutomationModalOpen(false)}
        onStart={handleAutomationStart}
        presetStore={ocrPresetStore}
        defaultPrompt={textareaContent}
        kind="ocr"
      />
      
      {/* Automation Progress Modal */}
      <AutomationProgressModal
        isOpen={isAutomationProgressModalOpen}
        onClose={() => setIsAutomationProgressModalOpen(false)}
      />
      {/* Prompt Enlarge Modal */}
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
                Edit Prompt Template
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
                  Prompt Template
                </label>
                <textarea
                  value={getCurrentPromptText()}
                  onChange={(e) => handlePromptChange(e.target.value)}
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
                  placeholder="Enter your prompt template here..."
                />
              </div>
              
              <div style={{ 
                fontSize: 12, 
                color: "#94a3b8", 
                padding: 12,
                background: "#0f172a",
                borderRadius: 6,
                border: "1px solid #334155"
              }}>
                <strong>Template Variables:</strong> Use <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3 }}>{'{extracted text}'}</code>, <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3 }}>{'{reference}'}</code>, <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3 }}>{'{pdf_text}'}</code>, or <code style={{ background: "#1e293b", padding: "2px 4px", borderRadius: 3 }}>{'{source_text}'}</code> in your prompt.
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

// helper used by some other code paths in the repo (kept for compatibility)
function getCurrentModelId(): string {
  const sel = document.querySelector('select[title="Select model"]') as HTMLSelectElement | null;
  return sel?.value || "stub:echo";
}
