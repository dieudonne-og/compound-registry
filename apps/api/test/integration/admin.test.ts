import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RowDataPacket } from 'mysql2';
import { cookieHeader, createTestApp, login, request, type Session, type TestApp } from '../helpers';

let t: TestApp;
let admin: Session;
beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t.app, 'admin');
});
afterAll(async () => {
  await t.close();
});

const createUser = (email: string, role = 'operator') =>
  request(t.app, admin, { method: 'POST', url: '/api/users', payload: { name: 'New Person', email, role } });
const signInAs = (email: string, password: string, ip: string) =>
  t.app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: ip, payload: { email, password } });

describe('user administration', () => {
  it('creates a user with a one-time temporary password that must be changed', async () => {
    const res = await createUser('new.person@example.com');
    expect(res.statusCode).toBe(201);
    const { user, temporaryPassword } = res.json();
    expect(temporaryPassword).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]{16}$/);
    expect(user).toMatchObject({
      email: 'new.person@example.com',
      role: 'operator',
      active: true,
      mustChangePassword: true,
    });
    const signIn = await signInAs('new.person@example.com', temporaryPassword, '10.9.0.1');
    expect(signIn.statusCode).toBe(200);
    const cookies = cookieHeader(signIn.headers['set-cookie']);
    const blocked = await t.app.inject({
      method: 'GET',
      url: '/api/production',
      headers: { cookie: cookies },
    });
    expect(blocked.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    const again = await createUser('New.Person@example.com ');
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('signs a disabled user out on their very next request', async () => {
    const { user, temporaryPassword } = (await createUser('soon.disabled@example.com')).json();
    await t.pool.query('UPDATE users SET must_change_password = FALSE WHERE id = ?', [user.id]);
    const signIn = await signInAs('soon.disabled@example.com', temporaryPassword, '10.9.0.2');
    const cookies = cookieHeader(signIn.headers['set-cookie']);
    const before = await t.app.inject({
      method: 'GET',
      url: '/api/production',
      headers: { cookie: cookies },
    });
    expect(before.statusCode).toBe(200);
    const off = await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/users/${user.id}`,
      payload: { active: false },
    });
    expect(off.json()).toMatchObject({ active: false });
    const after = await t.app.inject({ method: 'GET', url: '/api/production', headers: { cookie: cookies } });
    expect(after.statusCode).toBe(401);
    expect(after.json().error.code).toBe('ACCOUNT_DISABLED');
    // The password is still right, but the account is disabled.
    const retry = await signInAs('soon.disabled@example.com', temporaryPassword, '10.9.0.3');
    expect(retry.json().error.code).toBe('ACCOUNT_DISABLED');
  });

  it('applies a role change on the next request', async () => {
    const { user, temporaryPassword } = (await createUser('role.change@example.com', 'supervisor')).json();
    await t.pool.query('UPDATE users SET must_change_password = FALSE WHERE id = ?', [user.id]);
    const cookies = cookieHeader(
      (await signInAs('role.change@example.com', temporaryPassword, '10.9.0.4')).headers['set-cookie'],
    );
    const history = () =>
      t.app.inject({ method: 'GET', url: '/api/production/999999/history', headers: { cookie: cookies } });
    // No such record: a supervisor may read history (404), an operator may not (403).
    expect((await history()).statusCode).toBe(404);
    await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/users/${user.id}`,
      payload: { role: 'operator' },
    });
    expect((await history()).statusCode).toBe(403);
  });

  it('does not let an administrator demote or disable themselves', async () => {
    const [[me]] = await t.pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = 'admin@example.com'",
    );
    const self = await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/users/${me!.id}`,
      payload: { role: 'auditor' },
    });
    expect(self.statusCode).toBe(422);
    expect(self.json().error.code).toBe('SELF_CHANGE_NOT_ALLOWED');
    const rename = await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/users/${me!.id}`,
      payload: { name: 'Alice U.' },
    });
    expect(rename.statusCode).toBe(200);
    await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/users/${me!.id}`,
      payload: { name: 'Alice Uwase' },
    });
    const second = (await createUser('second.admin@example.com', 'admin')).json().user;
    // Another active administrator remains, so demoting this one is allowed.
    const demote = await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/users/${second.id}`,
      payload: { role: 'operator' },
    });
    expect(demote.statusCode).toBe(200);
  });

  it('resets a password, requiring a change and revoking existing sessions', async () => {
    const { user, temporaryPassword } = (await createUser('reset.me@example.com')).json();
    await t.pool.query('UPDATE users SET must_change_password = FALSE WHERE id = ?', [user.id]);
    const old = await signInAs('reset.me@example.com', temporaryPassword, '10.9.0.5');
    const res = await request(t.app, admin, { method: 'POST', url: `/api/users/${user.id}/reset-password` });
    expect(res.statusCode).toBe(200);
    expect(res.json().temporaryPassword).toHaveLength(16);
    expect(res.json().temporaryPassword).not.toBe(temporaryPassword);
    const [[row]] = await t.pool.query<RowDataPacket[]>(
      'SELECT must_change_password FROM users WHERE id = ?',
      [user.id],
    );
    expect(row!.must_change_password).toBe(1);
    const refresh = await t.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        cookie: cookieHeader(old.headers['set-cookie']),
        'x-csrf-token': /csrf_token=([^;]+)/.exec(cookieHeader(old.headers['set-cookie']))![1]!,
      },
    });
    expect(refresh.statusCode).toBe(401);
    expect((await signInAs('reset.me@example.com', temporaryPassword, '10.9.0.6')).statusCode).toBe(401);
  });

  it('lists users without secrets', async () => {
    const res = await request(t.app, admin, { method: 'GET', url: '/api/users' });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((u: { email: string }) => u.email)).toContain('admin@example.com');
    expect(JSON.stringify(res.json())).not.toMatch(/password_hash|passwordHash|\$argon2/);
  });

  it('logs every action without secrets', async () => {
    const res = await request(t.app, admin, {
      method: 'GET',
      url: '/api/admin/activity?targetType=user&pageSize=50',
    });
    const actions = res.json().items.map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['user.created', 'user.disabled', 'user.updated', 'user.password_reset']),
    );
    expect(JSON.stringify(res.json())).not.toMatch(/password_hash|temporaryPassword|\$argon2/);
    const disabled = res.json().items.find((e: { action: string }) => e.action === 'user.disabled');
    expect(disabled).toMatchObject({
      before: { active: true },
      after: { active: false },
      targetType: 'user',
    });
    expect(disabled.actor.label).toMatch(/\(admin\)/);
  });

  it('is for administrators only', async () => {
    const supervisor = await login(t.app, 'supervisor');
    expect((await request(t.app, supervisor, { method: 'GET', url: '/api/users' })).statusCode).toBe(403);
    expect((await request(t.app, supervisor, { method: 'GET', url: '/api/admin/activity' })).statusCode).toBe(
      403,
    );
  });
});
