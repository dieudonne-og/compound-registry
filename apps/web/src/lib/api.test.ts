import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('api', () => {
  it('sends the CSRF token on state-changing requests', async () => {
    document.cookie = 'csrf_token=abc123';
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await api('/production', { method: 'POST', json: { a: 1 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/production');
    expect(new Headers(init.headers).get('x-csrf-token')).toBe('abc123');
    expect(init.credentials).toBe('include');
  });

  it('refreshes the session once and retries after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHENTICATED', message: 'x', requestId: 'r' } }))
      .mockResolvedValueOnce(json(200, { user: {} }))
      .mockResolvedValueOnce(json(200, { items: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/production')).resolves.toEqual({ items: [] });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/production',
      '/api/auth/refresh',
      '/api/production',
    ]);
  });

  it('turns error bodies into ApiError with field details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(422, {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Fix it',
            details: { fields: { weightKg: 'Too small' } },
            requestId: 'req-1',
          },
        }),
      ),
    );
    const err = await api('/production', { method: 'POST', json: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      details: { fields: { weightKg: 'Too small' } },
      requestId: 'req-1',
    });
  });

  it('reports network failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/production')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
