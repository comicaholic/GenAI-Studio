import { api } from "./api";

export type ModelInfo = { id: string; label: string; tags?: string[] };

export async function fetchModels(): Promise<ModelInfo[]> {
  const { data } = await api.get<{models: ModelInfo[]}>("/llm/models");
  return data.models;
}

export async function chatComplete(
  model_id: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  params: { temperature?: number; top_p?: number; top_k?: number; max_tokens?: number }
): Promise<string> {
  if (!model_id) throw new Error("No model selected.");
  
  console.log("Making LLM request:", { model_id, messages, params });
  
  try {
    const { data } = await api.post("/llm/chat", { model_id, messages, params });
    console.log("LLM response:", data);
    return data.output ?? data.text ?? "";
  } catch (error: any) {
    console.error("LLM request failed:", error);
    throw error;
  }
}
export async function completeLLM(opts: {
  model_id: string;
  provider: "groq" | "local";
  messages?: { role: "system"|"user"|"assistant"; content: string }[];
  prompt?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}) {
  const r = await fetch("/api/llm/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ output: string; raw?: unknown }>;
}
