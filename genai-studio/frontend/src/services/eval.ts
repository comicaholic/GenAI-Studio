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
  const blob = await postForBlob("/eval/report/csv", { rows, meta });
  return blob;
}

export async function downloadPDF(rows: Record<string, any>[], meta: Record<string, any> = {}) {
  const blob = await postForBlob("/eval/report/pdf", { rows, meta });
  return blob;
}
