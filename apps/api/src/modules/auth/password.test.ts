import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('Demo!2026');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'Demo!2026')).toBe(true);
    expect(await verifyPassword(hash, 'demo!2026')).toBe(false);
  });
  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});
