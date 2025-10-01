// frontend/src/types/history.ts
export interface ModelInfo {
  id: string;
  provider: string;
}

export interface UsedText {
  ocrText?: string;
  referenceText?: string;
  promptText?: string;
  context?: string;
  chatHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
  }>;
}

export interface FileInfo {
  sourceFileName?: string;
  referenceFileName?: string;
  promptFileName?: string;
}

export interface SavedEvaluation {
  id: string;
  type: 'ocr' | 'prompt';
  title: string;
  model: ModelInfo;
  parameters: Record<string, any>;
  metrics: string[];
  usedText: UsedText;
  files: FileInfo;
  results?: Record<string, any>;
  startedAt: string;
  finishedAt?: string;
}

export interface SavedChat {
  id: string;
  title: string;
  model: ModelInfo;
  parameters: Record<string, any>;
  context?: string;
  messagesSummary?: string;
  usedText?: UsedText;
  lastActivityAt: string;
}

export interface EvaluationSelection {
  type: 'ocr' | 'prompt' | 'chat';
  modelId: string;
  provider: string;
  parameters: Record<string, any>;
  metrics: string[];
  prompt?: string;
  context?: string;
  usedText: UsedText;
  files: FileInfo;
  timestamp: string;
}

