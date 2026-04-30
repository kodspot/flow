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
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
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
  if (!res.ok) throw new Error(`Failed to load asset: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
