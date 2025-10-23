// frontend/src/services/eval.ts
import { api, postForBlob } from "./api";

export type MetricsRequest = {
  prediction: string;
  reference: string;
  metrics: string[];  // e.g. ["rouge","bleu","em","bertscore"]
  meta?: Record<string, any>;
};

export type MetricsResponse = {
  scores: Record<string, number | string | null>;
  meta: Record<string, any>;
};

export async function computeMetrics(body: MetricsRequest): Promise<MetricsResponse> {
  const { data } = await api.post<MetricsResponse>("/eval/metrics", body);
  return data;
}

export async function downloadCSV(rows: Record<string, any>[], meta: Record<string, any> = {}) {
  try {
    const blob = await postForBlob("/eval/report/csv", { rows, meta });
    
    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = meta.filename || "evaluation-results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return blob;
  } catch (error) {
    console.error("CSV download failed:", error);
    throw error;
  }
}

export async function downloadPDF(rows: Record<string, any>[], meta: Record<string, any> = {}) {
  try {
    const blob = await postForBlob("/eval/report/pdf", { rows, meta });
    
    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = meta.filename || "evaluation-results.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return blob;
  } catch (error) {
    console.error("PDF download failed:", error);
    throw error;
  }
}
