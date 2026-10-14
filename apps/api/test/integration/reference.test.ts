import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, request, type Session, type TestApp } from '../helpers';

let t: TestApp;
let admin: Session;
let operator: Session;
beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t.app, 'admin');
  operator = await login(t.app, 'operator');
});
afterAll(async () => {
  await t.close();
});

describe('reference data', () => {
  it('lists active mineral types with codes, sorted by name', async () => {
    const res = await request(t.app, operator, { method: 'GET', url: '/api/reference/mineral-types' });
    expect(res.statusCode).toBe(200);
    const names = res.json().map((m: { name: string }) => m.name);
    expect(names).toEqual([...names].sort());
    expect(res.json()[0]).toMatchObject({ code: expect.any(String), active: true });
  });

  it('lets admins add and deactivate companies', async () => {
    const created = await request(t.app, admin, {
      method: 'POST',
      url: '/api/reference/companies',
      payload: { name: 'Test Mining Ltd' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const patched = await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/reference/companies/${id}`,
      payload: { active: false },
    });
    expect(patched.json().active).toBe(false);
    const list = await request(t.app, operator, { method: 'GET', url: '/api/reference/companies' });
    expect(list.json().some((c: { id: number }) => c.id === id)).toBe(false);
  });

  it('rejects an update with nothing to change', async () => {
    const res = await request(t.app, admin, {
      method: 'PATCH',
      url: '/api/reference/companies/1',
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it('rejects duplicate names', async () => {
    const res = await request(t.app, admin, {
      method: 'POST',
      url: '/api/reference/locations',
      payload: { name: 'Gikondo Warehouse' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('DUPLICATE_NAME');
  });

  it('requires a code for mineral types', async () => {
    const res = await request(t.app, admin, {
      method: 'POST',
      url: '/api/reference/mineral-types',
      payload: { name: 'Lithium' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('forbids non-admins from managing reference data', async () => {
    const res = await request(t.app, operator, {
      method: 'POST',
      url: '/api/reference/agents',
      payload: { name: 'X Agent' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects unknown kinds', async () => {
    expect(
      (await request(t.app, operator, { method: 'GET', url: '/api/reference/planets' })).statusCode,
    ).toBe(422);
  });
  it('shows administrators how many records use each entry, and logs changes', async () => {
    const res = await request(t.app, admin, {
      method: 'GET',
      url: '/api/reference/companies?includeInactive=true',
    });
    expect(res.json()[0]).toHaveProperty('usageCount');
    const plain = await request(t.app, operator, { method: 'GET', url: '/api/reference/companies' });
    expect(plain.json()[0].usageCount).toBe(0); // only counted for administrators
    const created = (
      await request(t.app, admin, {
        method: 'POST',
        url: '/api/reference/agents',
        payload: { name: 'Logged Agent' },
      })
    ).json();
    await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/reference/agents/${created.id}`,
      payload: { active: false },
    });
    const log = (
      await request(t.app, admin, {
        method: 'GET',
        url: '/api/admin/activity?targetType=reference&pageSize=50',
      })
    ).json();
    expect(log.items.map((e: { action: string }) => e.action)).toEqual(
      expect.arrayContaining(['reference.created', 'reference.retired']),
    );
    const retired = log.items.find(
      (e: { action: string; targetId: number }) => e.action === 'reference.retired',
    );
    expect(retired).toMatchObject({ before: { active: true }, after: { active: false } });
    expect(retired.targetLabel).toMatch(/Logged Agent/);
  });
});
