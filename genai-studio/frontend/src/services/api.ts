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
