// src/pages/OCR/OCRPage.tsx
import React, { useMemo, useState, useEffect } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";

import FileDrop from "@/components/FileDrop/FileDrop";
import ExpandableTextarea from "@/components/ExpandableTextarea/ExpandableTextarea";
import PromptPresetBox from "@/components/PresetPanel/PromptPresetBox";
import PresetManager from "@/components/PresetPanel/PresetManager";
import ParamsPanel, { ModelParams } from "@/components/RightPanel/ParamsPanel";
import MetricsPanel, { DEFAULT_METRICS, MetricState } from "@/components/RightPanel/MetricsPanel";
import { ocrPresetStore } from "@/stores/presetStore";
import { extractOCR, OCRExtractResponse } from "@/services/ocr";
import { computeMetrics, downloadCSV, downloadPDF } from "@/services/eval";
import { chatComplete } from "@/services/llm";
import { api } from "@/services/api";
import { listFiles, loadReferenceByName } from "@/services/files";
import { useSelectedModelId } from "@/hooks/useSelectedModelId";
import { useModel } from "@/context/ModelContext";
import { completeLLM } from "@/services/llm";
import { useNotifications } from "@/components/Notification/Notification";
import { useBackgroundState } from "@/stores/backgroundState";
import { historyService } from "@/services/history";
import LayoutShell from "@/components/LayoutShell/LayoutShell";

const DEFAULT_PARAMS: ModelParams = { temperature: 0.2, max_tokens: 512, top_p: 1.0, top_k: 40 };

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
    return savedPrompt || "Clean up OCR artifacts in {extracted text} and correct punctuation.";
  });

  // Save prompt to localStorage whenever it changes
  const handlePromptChange = (newPrompt: string) => {
    setTextareaContent(newPrompt);
    localStorage.setItem("ocr-prompt", newPrompt);
  };

  // Handle preset changes
  const handlePresetChange = (preset: { body?: string }) => {
    const presetText = preset.body || "";
    setTextareaContent(presetText);
    localStorage.setItem("ocr-prompt", presetText);
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

      const m = res?.scores ?? res?.scores ?? res?.data?.scores ?? res?.data ?? (res as any) ?? {};
      setScores(m);

      // Save evaluation to history
      const evaluation = {
        id: crypto.randomUUID(),
        type: "ocr" as const,
        title: `OCR Evaluation - ${new Date().toLocaleDateString()}`,
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
    const rows = [{ ...scores, source_file: srcFileName, reference_file: refFileName }];
    const blob = await downloadCSV(rows, meta);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evaluation.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadPDF = async () => {
    if (!scores) return;
    const rows = [{ metric: "results", ...scores }];
    const blob = await downloadPDF(rows, meta);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evaluation.pdf";
    a.click();
    URL.revokeObjectURL(url);
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
  const handleTabSwitch = (newTab: "prompt" | "parameters" | "metrics") => setActiveRightTab(newTab);
  const getCurrentPromptText = () => textareaContent || "Clean up OCR artifacts in {extracted text} and correct punctuation.";

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
    <div style={{ display: "grid", gap: 16 }}>
      {/* Tab Navigation */}
      <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
        <button
          className="btn h-10 min-w-[96px]"
          onClick={() => handleTabSwitch("prompt")}
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
          Prompt
        </button>
        <button
          className="btn h-10 min-w-[96px]"
          onClick={() => handleTabSwitch("parameters")}
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
        <button
          className="btn h-10 min-w-[96px]"
          onClick={() => handleTabSwitch("metrics")}
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
          <PromptPresetBox onPromptChange={handlePromptChange} value={getCurrentPromptText()} presetStore={ocrPresetStore} />
        </div>
      )}

      {activeRightTab === "parameters" && (
        <div>
          <PresetManager onPresetChange={handlePresetChange} autoApplyOnMount={false} presetStore={ocrPresetStore} />
          <ParamsPanel params={params} onChange={setParams} />
        </div>
      )}

      {activeRightTab === "metrics" && (
        <div>
          <PresetManager onPresetChange={handlePresetChange} autoApplyOnMount={false} presetStore={ocrPresetStore} />
          <MetricsPanel metrics={metricsState} onChange={setMetricsState} />
        </div>
      )}
    </div>
  );

  const renderFormView = () => (
    <>
      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>OCR Extracted Text</h3>
        <ExpandableTextarea value={ocr?.text ?? ""} />
      </section>

      <section style={{ display: "grid", gap: 8, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>LLM Output</h3>
        </div>
        <ExpandableTextarea editable value={llmOutput} onChange={setLlmOutput} />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn h-10 min-w-[96px]"
            onClick={buildLlmOutput}
            style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 6 }}
          >
            Build LLM Output
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 8, marginTop: 16 }}>
        <h3 style={{ margin: 0, color: "#e2e8f0" }}>Reference Text</h3>
        <ExpandableTextarea editable value={reference} onChange={setReference} />
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
    <LayoutShell title="OCR Evaluation" left={left} right={right}>
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
        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px 0", color: "#e2e8f0" }}>Evaluation Results</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(scores).map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#1e293b", borderRadius: 4 }}>
                <span style={{ color: "#e2e8f0" }}>{key}</span>
                <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{typeof value === "number" ? value.toFixed(4) : String(value)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          className="btn h-10 min-w-[96px]"
          onClick={onEvaluate}
          style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 6 }}
        >
          Run Evaluation
        </button>
        <button
          className="btn h-10 min-w-[96px]"
          onClick={onDownloadCSV}
          disabled={!scores}
          style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 6, opacity: !scores ? 0.6 : 1 }}
        >
          Download CSV
        </button>
        <button
          className="btn h-10 min-w-[96px]"
          onClick={onDownloadPDF}
          disabled={!scores}
          style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 6, opacity: !scores ? 0.6 : 1 }}
        >
          Download PDF
        </button>
      </div>
    </LayoutShell>
  );
}

// helper used by some other code paths in the repo (kept for compatibility)
function getCurrentModelId(): string {
  const sel = document.querySelector('select[title="Select model"]') as HTMLSelectElement | null;
  return sel?.value || "stub:echo";
}
