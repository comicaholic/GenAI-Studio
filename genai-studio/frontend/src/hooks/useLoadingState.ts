import { useState, useCallback } from 'react';

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  retryCount: number;
}

export interface LoadingActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  retry: () => void;
  reset: () => void;
}

export function useLoadingState(initialState: boolean = false): LoadingState & LoadingActions {
  const [isLoading, setIsLoading] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
    if (loading) {
      setError(null); // Clear error when starting new operation
    }
  }, []);

  const setErrorCallback = useCallback((error: string | null) => {
    setError(error);
    setIsLoading(false);
  }, []);

  const retry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setIsLoading(true);
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    isLoading,
    error,
    retryCount,
    setLoading,
    setError: setErrorCallback,
    retry,
    reset
  };
}

// Hook for managing multiple loading states
export function useMultipleLoadingStates<T extends string>(
  keys: T[]
): Record<T, LoadingState & LoadingActions> {
  const states = {} as Record<T, LoadingState & LoadingActions>;
  
  keys.forEach(key => {
    states[key] = useLoadingState();
  });
  
  return states;
}



