import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, request, type TestApp } from '../helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('preferences and passwords', () => {
  it('stores and merges preferences per user', async () => {
    const s = await login(t.app, 'auditor');
    const put = await request(t.app, s, {
      method: 'PUT',
      url: '/api/me/preferences',
      payload: { language: 'fr', pageSize: 50 },
    });
    expect(put.json()).toMatchObject({ language: 'fr', pageSize: 50, theme: 'system' });
    const me = await request(t.app, s, { method: 'GET', url: '/api/auth/me' });
    expect(me.json()).toMatchObject({
      mustChangePassword: false,
      preferences: { language: 'fr', pageSize: 50 },
    });
    const bad = await request(t.app, s, {
      method: 'PUT',
      url: '/api/me/preferences',
      payload: { pageSize: 7 },
    });
    expect(bad.statusCode).toBe(422);
  });

  it('changes the password only with the current one and a long enough new one', async () => {
    const s = await login(t.app, 'supervisor');
    const wrong = await request(t.app, s, {
      method: 'POST',
      url: '/api/auth/change-password',
      payload: { currentPassword: 'nope', newPassword: 'a-long-new-passphrase' },
    });
    expect(wrong.json().error.code).toBe('WRONG_PASSWORD');
    const short = await request(t.app, s, {
      method: 'POST',
      url: '/api/auth/change-password',
      payload: { currentPassword: 'Demo!2026', newPassword: 'short' },
    });
    expect(short.statusCode).toBe(422);
    const ok = await request(t.app, s, {
      method: 'POST',
      url: '/api/auth/change-password',
      payload: { currentPassword: 'Demo!2026', newPassword: 'a-long-new-passphrase' },
    });
    expect(ok.statusCode).toBe(204);
    // The session that changed the password stays signed in.
    expect((await request(t.app, s, { method: 'GET', url: '/api/production' })).statusCode).toBe(200);
    // Restore the demo password for the other test files (every demo account shares one hash).
    await t.pool.query(
      "UPDATE users u JOIN (SELECT password_hash FROM users WHERE email = 'admin@example.com') a SET u.password_hash = a.password_hash WHERE u.email = 'supervisor@example.com'",
    );
  });

  it('blocks everything except the password change while a change is required', async () => {
    await t.pool.query("UPDATE users SET must_change_password = TRUE WHERE email = 'operator@example.com'");
    try {
      const s = await login(t.app, 'operator');
      const blocked = await request(t.app, s, { method: 'GET', url: '/api/production' });
      expect(blocked.statusCode).toBe(403);
      expect(blocked.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');
      expect(
        (await request(t.app, s, { method: 'GET', url: '/api/auth/me' })).json().mustChangePassword,
      ).toBe(true);
    } finally {
      await t.pool.query(
        "UPDATE users SET must_change_password = FALSE WHERE email = 'operator@example.com'",
      );
    }
  });

  it('records the time of each sign-in', async () => {
    await login(t.app, 'auditor');
    const [rows] = await t.pool.query(
      "SELECT last_sign_in_at FROM users WHERE email = 'auditor@example.com'",
    );
    expect((rows as { last_sign_in_at: Date | null }[])[0]!.last_sign_in_at).toBeInstanceOf(Date);
  });
});
