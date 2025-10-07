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
  automationId?: string;
  runId?: string;
  promptId?: string;
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
  automationId?: string;
  runId?: string;
  promptId?: string;
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

export interface AutomationRun {
  id: string;
  runId: string;
  runName: string;
  type: 'ocr' | 'prompt' | 'chat';
  title: string;
  model: ModelInfo;
  parameters: Record<string, any>;
  metrics?: string[];
  usedText: UsedText;
  files?: FileInfo;
  results?: Record<string, any>;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface SavedAutomation {
  id: string;
  name: string;
  title: string;
  type: 'ocr' | 'prompt' | 'chat';
  model: ModelInfo;
  runs: AutomationRun[];
  status: 'pending' | 'running' | 'completed' | 'error';
  createdAt: string;
  completedAt?: string;
  error?: string;
}

