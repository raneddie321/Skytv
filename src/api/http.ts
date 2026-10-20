/** Minimal fetch wrapper with timeouts, typed errors and JSON handling. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    /** Network failures, timeouts and 5xx responses are worth retrying / falling back. */
    readonly retriable: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isNetworkError = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status >= 500 || e.status === 503);

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function requestJson<T>(url: string, options: RequestOptions = {}, fetchImpl: FetchLike = fetch): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    throw new ApiError(aborted ? `Request timed out: ${url}` : `Network error: ${url}`, 0, aborted ? 'timeout' : 'network', true);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
  if (res.status === 204) return undefined as T;
  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    const p = (payload ?? {}) as { error?: string; message?: string; status_message?: string };
    throw new ApiError(p.message ?? p.status_message ?? `HTTP ${res.status}`, res.status, p.error ?? `http_${res.status}`, res.status >= 500);
  }
  return payload as T;
}

export function withQuery(base: string, params: Record<string, string | number | boolean | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `${base}${base.includes('?') ? '&' : '?'}${q}` : base;
}
