// frontend/src/lib/llm.ts
import { LLMInput, ResourceForTransport } from '@/types/promptEval';

// Simple token estimation (4 chars ≈ 1 token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Convert resources to transport format
export function convertResourcesForTransport(resources: any[]): ResourceForTransport[] {
  return resources.map(resource => ({
    name: resource.name,
    mime: resource.mime,
    bytes: new Uint8Array(0), // Mock implementation
  }));
}

// Mock LLM call with streaming
export async function* callLLM(input: LLMInput): AsyncGenerator<string, void, unknown> {
  const { modelId, prompt, context, resources, parameters, signal } = input;

  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  // Mock response chunks
  const mockResponse = `This is a mock response from ${modelId}.\n\nPrompt: "${prompt}"\n\nContext: "${context || 'None'}"\n\nParameters: Temperature=${parameters.temperature}, Top-p=${parameters.topP}, Max tokens=${parameters.maxTokens}\n\nResources attached: ${resources?.length || 0} files\n\nThis is a streaming response that simulates real LLM output. Each chunk is delivered with a small delay to demonstrate the streaming functionality. The response includes information about the input parameters and resources to show that the data is being processed correctly.`;

  const chunks = mockResponse.split(' ');
  let currentChunk = 0;

  for (const chunk of chunks) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    // Simulate streaming delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    yield currentChunk === 0 ? chunk : ' ' + chunk;
    currentChunk++;
  }
}

// Real LLM call (for future implementation)
export async function* callRealLLM(input: LLMInput): AsyncGenerator<string, void, unknown> {
  // This would be implemented to call actual LLM APIs
  // For now, fall back to mock
  yield* callLLM(input);
}

// Calculate estimated cost (mock implementation)
export function calculateCost(usage: { promptTokens: number; completionTokens: number }): number {
  // Mock pricing: $0.001 per 1K tokens
  const totalTokens = usage.promptTokens + usage.completionTokens;
  return (totalTokens / 1000) * 0.001;
}

// Get model info for display
export function getModelInfo(modelId: string) {
  // Mock model information
  const modelInfo: { [key: string]: any } = {
    'groq/llama-3.1-8b-instant': {
      name: 'LLaMA 3.1 8B Instant',
      provider: 'Groq',
      maxTokens: 8192,
      costPer1K: 0.0002,
    },
    'groq/mixtral-8x7b-32768': {
      name: 'Mixtral 8x7B',
      provider: 'Groq',
      maxTokens: 32768,
      costPer1K: 0.0003,
    },
  };

  return modelInfo[modelId] || {
    name: modelId,
    provider: 'Unknown',
    maxTokens: 4096,
    costPer1K: 0.001,
  };
}

