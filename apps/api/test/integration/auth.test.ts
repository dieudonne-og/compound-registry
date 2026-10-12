import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieHeader, createTestApp, login, request, type TestApp } from '../helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

const post = (
  url: string,
  payload: unknown,
  extra: Record<string, string> = {},
  remoteAddress = '10.1.1.1',
) => t.app.inject({ method: 'POST', url, payload: payload as object, headers: extra, remoteAddress });

describe('auth', () => {
  it('signs in and sets secure cookies', async () => {
    const res = await post('/api/auth/login', { email: 'ADMIN@example.com', password: 'Demo!2026' });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: 'admin@example.com', role: 'admin' });
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.find((c) => c.startsWith('access_token='))).toMatch(/HttpOnly/);
    expect(cookies.find((c) => c.startsWith('refresh_token='))).toMatch(/Path=\/api\/auth/);
    expect(cookies.find((c) => c.startsWith('csrf_token='))).not.toMatch(/HttpOnly/);
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const res = await post(
      '/api/auth/login',
      { email: 'admin@example.com', password: 'wrong' },
      {},
      '10.1.1.2',
    );
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rate-limits repeated attempts for the same email and IP', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      codes.push(
        (await post('/api/auth/login', { email: 'operator@example.com', password: 'x' }, {}, '10.1.1.3'))
          .statusCode,
      );
    }
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes[5]).toBe(429);
  });

  it('cannot be bypassed by sending a different X-Forwarded-For header on each attempt', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '10.1.1.9',
        headers: { 'x-forwarded-for': `203.0.113.${i}` },
        payload: { email: 'auditor@example.com', password: 'x' },
      });
      codes.push(res.statusCode);
    }
    expect(codes[5]).toBe(429);
  });

  it('uses the address added by the trusted proxy, not one supplied by the client', async () => {
    const proxied = await createTestApp({ TRUST_PROXY: 1 });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await proxied.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          remoteAddress: '172.18.0.5',
          headers: { 'x-forwarded-for': `198.51.100.${i}, 203.0.113.7` },
          payload: { email: 'auditor@example.com', password: 'x' },
        });
        codes.push(res.statusCode);
      }
      expect(codes[5]).toBe(429);
    } finally {
      await proxied.close();
    }
  });

  it('marks session cookies Secure when configured', async () => {
    const secure = await createTestApp({ COOKIE_SECURE: true });
    try {
      const res = await secure.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '10.1.1.10',
        payload: { email: 'admin@example.com', password: 'Demo!2026' },
      });
      const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cookies.every((c) => /;\s*Secure/i.test(c))).toBe(true);
    } finally {
      await secure.close();
    }
  });

  it('requires a session for /me', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('blocks state-changing requests without the CSRF header', async () => {
    const s = await login(t.app, 'admin');
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: s.cookies },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_FAILED');
  });

  it('lets two tabs renew the same session at the same moment', async () => {
    const s = await login(t.app, 'operator');
    const first = await request(t.app, s, { method: 'POST', url: '/api/auth/refresh' });
    // The second tab still holds the cookie from before the first tab's renewal.
    const second = await request(t.app, s, { method: 'POST', url: '/api/auth/refresh' });
    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
  });

  it('rotates refresh tokens and revokes all sessions when an old token is reused', async () => {
    const s = await login(t.app, 'supervisor');
    const first = await request(t.app, s, { method: 'POST', url: '/api/auth/refresh' });
    expect(first.statusCode).toBe(200);
    // Reuse is only tolerated for a few seconds (parallel tabs); age the rotation past that window.
    await t.pool.query(
      'UPDATE refresh_tokens SET revoked_at = revoked_at - INTERVAL 1 MINUTE WHERE revoked_at IS NOT NULL',
    );
    const rotated = cookieHeader(first.headers['set-cookie']);
    const reuse = await request(t.app, s, { method: 'POST', url: '/api/auth/refresh' });
    expect(reuse.statusCode).toBe(401);
    const csrf = /csrf_token=([^;]+)/.exec(rotated)![1]!;
    const afterReuse = await t.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: rotated, 'x-csrf-token': csrf },
    });
    expect(afterReuse.statusCode).toBe(401);
  });

  it('logs out', async () => {
    const s = await login(t.app, 'auditor');
    const res = await request(t.app, s, { method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(204);
  });
});
