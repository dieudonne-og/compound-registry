import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dashboardSummary } from '@cr/contracts';
import { createTestApp, login, request, type TestApp } from '../helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('dashboard and docs', () => {
  it('returns a summary matching the contract', async () => {
    const s = await login(t.app, 'auditor');
    const res = await request(t.app, s, { method: 'GET', url: '/api/dashboard/summary' });
    expect(res.statusCode).toBe(200);
    expect(dashboardSummary.safeParse(res.json()).success).toBe(true);
  });

  it('shows audit-chain health only to roles that may verify it', async () => {
    const operator = await login(t.app, 'operator');
    const res = await request(t.app, operator, { method: 'GET', url: '/api/dashboard/summary' });
    expect(res.json().chainHealth).toBeNull();
  });

  it('publishes an OpenAPI document covering every endpoint', async () => {
    const doc = (await t.app.inject({ method: 'GET', url: '/docs/json' })).json();
    for (const path of [
      '/api/auth/login',
      '/api/compounds/extract',
      '/api/compounds',
      '/api/compounds/{id}/file',
      '/api/production',
      '/api/production/{id}',
      '/api/production/{id}/history',
      '/api/production/{id}/verify',
      '/api/reference/{kind}',
      '/api/dashboard/summary',
    ]) {
      expect(doc.paths, path).toHaveProperty([path]);
    }
  });
  it('tells signed-in users which administrator to contact', async () => {
    const operator = await login(t.app, 'operator');
    const res = await request(t.app, operator, { method: 'GET', url: '/api/help/contact' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ email: 'admin@example.com' });
    expect((await t.app.inject({ method: 'GET', url: '/api/help/contact' })).statusCode).toBe(401);
  });
});
