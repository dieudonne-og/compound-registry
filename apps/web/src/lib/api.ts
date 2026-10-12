import type { ErrorCode } from '@cr/contracts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string,
  ) {
    super(message);
  }
  get fieldErrors(): Record<string, string> {
    return (this.details?.fields as Record<string, string> | undefined) ?? {};
  }
}

export const csrfToken = () =>
  document.cookie
    .split('; ')
    .find((c) => c.startsWith('csrf_token='))
    ?.slice('csrf_token='.length) ?? '';

export function toApiError(status: number, body: unknown): ApiError {
  const e = (
    body as {
      error?: { code?: ErrorCode; message?: string; details?: Record<string, unknown>; requestId?: string };
    }
  )?.error;
  return new ApiError(
    status,
    e?.code ?? 'INTERNAL_ERROR',
    e?.message ?? 'Something went wrong. Please try again.',
    e?.details,
    e?.requestId,
  );
}

const networkError = () =>
  new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
const NO_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout'];

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by all requests that hit a 401 together. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-csrf-token': csrfToken() },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  retry = true,
): Promise<T> {
  const { json, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('content-type', 'application/json');
  if (method !== 'GET' && method !== 'HEAD') headers.set('x-csrf-token', csrfToken());

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      method,
      headers,
      credentials: 'include',
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw networkError();
  }

  // Without a csrf_token cookie there was never a session, so there is nothing to refresh.
  if (res.status === 401 && retry && !NO_REFRESH.includes(path) && csrfToken()) {
    if (await refreshSession()) return api<T>(path, init, false);
    // /auth/me failing just means "not signed in" on first load; only announce expiry mid-session.
    if (path !== '/auth/me') window.dispatchEvent(new Event('session-expired'));
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

/** Makes sure the session is valid (renewing it if needed) before a plain link hits the API. */
export async function ensureSession(): Promise<boolean> {
  try {
    await api('/auth/me');
    return true;
  } catch {
    window.dispatchEvent(new Event('session-expired'));
    return false;
  }
}

/** Opens an API URL in a new tab after renewing the session; the tab opens first so pop-up blockers allow it. */
export async function openWithSession(url: string) {
  const tab = window.open('about:blank', '_blank');
  if (!(await ensureSession())) return tab?.close();
  if (tab) {
    tab.opener = null;
    tab.location.href = url;
  }
}

/** Downloads an API URL after renewing the session. */
export async function downloadWithSession(url: string) {
  if (!(await ensureSession())) return;
  const link = Object.assign(document.createElement('a'), { href: url, download: '' });
  document.body.append(link);
  link.click();
  link.remove();
}
