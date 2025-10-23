import { api } from "./api";
import { analyzeGroqError, getAutomaticMitigation } from "@/lib/groqErrorMitigation";

export type ModelInfo = { id: string; label: string; tags?: string[] };

export async function fetchModels(): Promise<ModelInfo[]> {
  const { data } = await api.get<{models: ModelInfo[]}>("/llm/models");
  return data.models;
}

export async function chatComplete(
  model_id: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  params: { temperature?: number; top_p?: number; top_k?: number; max_tokens?: number },
  retryCount: number = 0
): Promise<string> {
  if (!model_id) throw new Error("No model selected.");
  
  console.log("Making LLM request:", { model_id, messages, params, retryCount });
  
  try {
    const { data } = await api.post("/llm/chat", { model_id, messages, params });
    console.log("LLM response:", data);
    return data.output ?? data.text ?? "";
  } catch (error: any) {
    console.error("LLM request failed:", error);
    
    // Check if this is a Groq error that we can mitigate
    const errorMessage = error?.response?.data?.detail || error?.message || String(error);
    const mitigation = getAutomaticMitigation(errorMessage, messages[messages.length - 1]?.content);
    
    if (mitigation.shouldRetry && retryCount < 2) {
      console.log("Attempting automatic mitigation:", mitigation);
      
      // Show user notification about mitigation
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('groq-mitigation', {
          detail: {
            error: errorMessage,
            mitigation: mitigation,
            retryCount: retryCount + 1
          }
        }));
      }
      
      // Wait before retry
      if (mitigation.delayMs) {
        await new Promise(resolve => setTimeout(resolve, mitigation.delayMs));
      }
      
      // Modify parameters if needed
      const modifiedParams = mitigation.modifiedParams ? { ...params, ...mitigation.modifiedParams } : params;
      
      // Modify messages if needed
      let modifiedMessages = messages;
      if (mitigation.modifiedPrompt && messages.length > 0) {
        modifiedMessages = [...messages];
        modifiedMessages[modifiedMessages.length - 1] = {
          ...modifiedMessages[modifiedMessages.length - 1],
          content: mitigation.modifiedPrompt
        };
      }
      
      // Retry with modified parameters
      return chatComplete(model_id, modifiedMessages, modifiedParams, retryCount + 1);
    }
    
    // If we can't mitigate or have exceeded retries, throw the original error
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
