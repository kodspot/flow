'use client';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://api.flow.kodspot.co.in'
    : 'http://localhost:8787');
const TOKEN_KEY = 'kf_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

/** An HTTP error response from the API; `status` lets callers tell client from server errors. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The API reported this session as ended (expired, invalid, or the password was changed):
 * drop the token and sign in again. A full page load also discards every cached query, so
 * nothing from this session stays on screen.
 */
function endSession() {
  clearToken();
  if (!window.location.pathname.startsWith('/login')) window.location.assign('/login?expired=1');
}

function isSessionEnded(status: number, body: unknown): boolean {
  return status === 401 && (body as { code?: string } | null)?.code === 'session_expired';
}

/** Error text for a failed response; names the first invalid field when the API lists them. */
function errorMessage(status: number, body: unknown): string {
  const b = (body ?? {}) as { error?: string; issues?: Array<{ path?: unknown[]; message?: string }> };
  const base = b.error ?? `Request failed: ${status}`;
  const issue = Array.isArray(b.issues) ? b.issues[0] : undefined;
  if (!issue?.message) return base;
  const field = Array.isArray(issue.path) && issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${base} (${field}${issue.message})`;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      // Don't set Content-Type for FormData — the browser sets it with boundary
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (token && isSessionEnded(res.status, body)) endSession();
    throw new ApiError(errorMessage(res.status, body), res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Build an authenticated URL for streaming endpoints (img src, etc.). */
export function apiAssetUrl(path: string): string {
  const token = getToken();
  // For img tags we can't send Authorization header, so we use a query token.
  // Server-side: settings/asset accepts ?key=... but requires Bearer — we use fetch-as-blob below.
  return `${API_URL}${path}${path.includes('?') ? '&' : '?'}_t=${encodeURIComponent(token ?? '')}`;
}

/** Fetch a binary asset and return an object URL safely usable in <img>. */
export async function fetchAssetBlobUrl(path: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (token && isSessionEnded(res.status, body)) endSession();
    throw new Error(`Failed to load asset: ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
