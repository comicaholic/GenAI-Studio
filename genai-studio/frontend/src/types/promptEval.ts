// frontend/src/types/promptEval.ts

export type Resource = {
  id: string;             // uuid
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  dataUrl?: string;       // for images/txt preview
  file?: File;            // kept in-memory for mock transport
};

export type PromptEvalDraft = {
  prompt: string;
  context: string;
  parameters: {
    temperature: number;
    topP: number;
    maxTokens?: number;
    system?: string;
    seed?: number | null;
  };
  selectedModelId: string | null;
  resourceIds: string[];   // references into ResourceStore
};

export type RunResult = {
  id: string;
  startedAt: number;
  finishedAt: number;
  usage?: { 
    promptTokens: number; 
    completionTokens: number; 
    totalTokens: number; 
    costUSD?: number 
  };
  output: string;
  error?: string;
  modelId: string;
  resources: Resource[];
  prompt: string;
  context: string;
  parameters: PromptEvalDraft['parameters'];
};

export type LLMInput = {
  modelId: string;
  prompt: string;          // user prompt
  context?: string;        // optional additional context
  resources?: Resource[];  // attachments
  parameters: PromptEvalDraft['parameters'];
  signal?: AbortSignal;
};

export type ResourceForTransport = {
  name: string;
  mime: string;
  bytes: Uint8Array;
};

