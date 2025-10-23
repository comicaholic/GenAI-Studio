// src/lib/groqErrorMitigation.ts
/**
 * Utility functions for handling Groq API errors and providing mitigation strategies
 */

export interface GroqErrorMitigation {
  canMitigate: boolean;
  strategies: string[];
  suggestedAction: string;
}

/**
 * Analyzes Groq API errors and provides mitigation strategies
 */
export function analyzeGroqError(error: string): GroqErrorMitigation {
  const errorLower = error.toLowerCase();
  
  // Length-related errors
  if (errorLower.includes('reduce the length') || errorLower.includes('too long')) {
    return {
      canMitigate: true,
      strategies: [
        'Reduce prompt length by removing unnecessary context',
        'Split long prompts into smaller chunks',
        'Use more concise language',
        'Remove redundant information',
        'Use bullet points instead of paragraphs'
      ],
      suggestedAction: 'Try reducing the prompt length by 20-30%'
    };
  }
  
  // Token limit errors
  if (errorLower.includes('token') && errorLower.includes('limit')) {
    return {
      canMitigate: true,
      strategies: [
        'Reduce max_tokens parameter',
        'Shorten the input prompt',
        'Use a more concise response format',
        'Break down the request into smaller parts'
      ],
      suggestedAction: 'Reduce max_tokens to 500-1000 or shorten the prompt'
    };
  }
  
  // Model compatibility errors
  if (errorLower.includes('does not support') || errorLower.includes('not supported')) {
    return {
      canMitigate: false,
      strategies: [
        'Switch to a different model',
        'Use a model that supports the requested operation',
        'Check model capabilities before making requests'
      ],
      suggestedAction: 'Switch to a compatible model (e.g., llama-3.1-70b-versatile for chat completions)'
    };
  }
  
  // Rate limit errors
  if (errorLower.includes('rate limit') || errorLower.includes('too many requests')) {
    return {
      canMitigate: true,
      strategies: [
        'Wait a few minutes before retrying',
        'Reduce the frequency of requests',
        'Implement exponential backoff',
        'Use request queuing'
      ],
      suggestedAction: 'Wait 1-2 minutes before retrying the request'
    };
  }
  
  // Default case
  return {
    canMitigate: false,
    strategies: [
      'Check the error message for specific details',
      'Verify API key and permissions',
      'Check Groq service status',
      'Review request parameters'
    ],
    suggestedAction: 'Review the error details and try again'
  };
}

/**
 * Automatically suggests prompt modifications to reduce length
 */
export function suggestPromptReduction(prompt: string, targetReductionPercent: number = 25): string {
  const words = prompt.split(/\s+/);
  const targetWordCount = Math.floor(words.length * (1 - targetReductionPercent / 100));
  
  if (words.length <= targetWordCount) {
    return prompt; // Already short enough
  }
  
  // Try to keep important parts (first and last sentences)
  const firstSentence = prompt.split(/[.!?]/)[0];
  const lastSentence = prompt.split(/[.!?]/).pop();
  
  // If we can fit first and last sentences, use them
  const firstLastWords = (firstSentence + ' ' + lastSentence).split(/\s+/);
  if (firstLastWords.length <= targetWordCount) {
    return firstSentence + '. ' + lastSentence;
  }
  
  // Otherwise, just truncate
  return words.slice(0, targetWordCount).join(' ') + '...';
}

/**
 * Checks if a prompt is likely to cause length errors
 */
export function isPromptLikelyTooLong(prompt: string, maxTokens: number = 4000): boolean {
  // Rough estimation: 1 token ≈ 0.75 words
  const estimatedTokens = Math.ceil(prompt.split(/\s+/).length / 0.75);
  return estimatedTokens > maxTokens;
}

/**
 * Provides automatic mitigation for common Groq errors
 */
export function getAutomaticMitigation(error: string, prompt?: string): {
  shouldRetry: boolean;
  modifiedPrompt?: string;
  modifiedParams?: any;
  delayMs?: number;
} {
  const analysis = analyzeGroqError(error);
  
  if (!analysis.canMitigate) {
    return { shouldRetry: false };
  }
  
  const errorLower = error.toLowerCase();
  
  // Length mitigation
  if (errorLower.includes('reduce the length') && prompt) {
    return {
      shouldRetry: true,
      modifiedPrompt: suggestPromptReduction(prompt, 30),
      delayMs: 1000
    };
  }
  
  // Token limit mitigation
  if (errorLower.includes('token') && errorLower.includes('limit')) {
    return {
      shouldRetry: true,
      modifiedParams: { max_tokens: 1000 },
      delayMs: 2000
    };
  }
  
  // Rate limit mitigation
  if (errorLower.includes('rate limit')) {
    return {
      shouldRetry: true,
      delayMs: 60000 // Wait 1 minute
    };
  }
  
  return { shouldRetry: false };
}







