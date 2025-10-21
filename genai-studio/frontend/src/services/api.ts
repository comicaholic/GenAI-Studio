// frontend/src/services/api.ts
/// <reference types="vite/client" />


const V = import.meta.env as any;

export const API_BASE: string =
  (V?.VITE_API_BASE as string) ??
  (V?.DEV ? '/api' : '/api');

type Json = Record<string, any> | undefined;
type ResponseType = 'json' | 'blob' | 'text';

export interface ApiConfig {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  responseType?: ResponseType;
  signal?: AbortSignal;
  /** Extra fetch options if you ever need them */
  init?: RequestInit;
}

function buildURL(path: string, params?: Record<string, any>) {
  if (!params || Object.keys(params).length === 0) return `${API_BASE}${path}`;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function request<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts?: ApiConfig & { body?: Json }
): Promise<{ data: T }> {
  const url = buildURL(path, opts?.params);
  const fetchInit: RequestInit = {
    method,
    headers: {
      ...(opts?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts?.headers ?? {}),
    },
    ...(opts?.signal ? { signal: opts.signal } : {}),
    ...(opts?.init ?? {}),
  };
  if (opts?.body !== undefined) {
    fetchInit.body = JSON.stringify(opts.body);
  }

  // Robust retry mechanism for backend cold start (e.g., conda env)
  const maxAttempts = 8; // Increased from 3 to handle slower backend startup
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, fetchInit);
      if (!res.ok) {
        const text = await res.text().catch(() => `${res.status} ${res.statusText}`);
        throw new Error(text || `${res.status} ${res.statusText}`);
      }

      const rt: ResponseType = opts?.responseType ?? 'json';
      if (rt === 'blob') {
        return { data: await res.blob() as any };
      } else if (rt === 'text') {
        return { data: await res.text() as any };
      } else {
        return { data: (await res.json()) as T };
      }
    } catch (err: any) {
      lastErr = err;
      // Only retry on network errors / refused connections
      const msg = String(err?.message || err);
      const isConnRefused = msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch') || msg.includes('NetworkError');
      if (attempt < maxAttempts && isConnRefused) {
        // Progressive backoff: 200ms, 500ms, 1s, 2s, 3s, 5s, 8s
        const delayMs = attempt <= 2 ? 200 * attempt : Math.min(500 * Math.pow(1.5, attempt - 2), 8000);
        console.log(`API request failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`, url);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export const api = {
  get:  <T = any>(path: string, cfg?: ApiConfig) =>
    request<T>('GET', path, cfg),
  post: <T = any>(path: string, body?: Json, cfg?: ApiConfig) =>
    request<T>('POST', path, { ...cfg, body }),
  put:  <T = any>(path: string, body?: Json, cfg?: ApiConfig) =>
    request<T>('PUT', path, { ...cfg, body }),
  delete:<T = any>(path: string, cfg?: ApiConfig) =>
    request<T>('DELETE', path, cfg),
};

/** Keep compatibility with places that request a blob explicitly */
export async function postForBlob(
  path: string,
  body: any,
  init?: RequestInit
): Promise<Blob> {
  const { data } = await api.post<Blob>(path, body, { responseType: 'blob', init });
  return data;
}

/**
 * Wait for backend to be ready by checking health endpoint
 * Uses exponential backoff to avoid flooding the backend with requests
 */
export async function waitForBackend(maxWaitMs = 30000): Promise<boolean> {
  const startTime = Date.now();
  let attempt = 0;
  let lastLogTime = 0;
  
  while (Date.now() - startTime < maxWaitMs) {
    attempt++;
    
    try {
      // Use a direct fetch with a short timeout to avoid hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch('/api/health', { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Backend is ready');
        return true;
      }
    } catch (err: any) {
      // Only log every 10 seconds to minimize noise
      const now = Date.now();
      const elapsed = now - startTime;
      
      if (now - lastLogTime > 10000) {
        console.log(`⏳ Waiting for backend... (${Math.round(elapsed/1000)}s elapsed)`);
        lastLogTime = now;
      }
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 16s)
    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  console.warn('⚠️ Backend did not become ready within timeout, proceeding anyway');
  return false;
}
