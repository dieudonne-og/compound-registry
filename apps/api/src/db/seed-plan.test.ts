import { describe, expect, it } from 'vitest';
import { userSeedPlan } from './seed-plan';

describe('userSeedPlan', () => {
  it('seeds the demo accounts outside production', () => {
    expect(userSeedPlan({ nodeEnv: 'development', demo: false })).toEqual({ kind: 'demo' });
  });

  it('seeds the demo accounts in production only when demo data is requested', () => {
    expect(userSeedPlan({ nodeEnv: 'production', demo: true })).toEqual({ kind: 'demo' });
  });

  it('creates a single administrator from the environment in production', () => {
    expect(
      userSeedPlan({
        nodeEnv: 'production',
        demo: false,
        adminEmail: 'Ops@Example.org',
        adminPassword: 'a-long-passphrase',
      }),
    ).toEqual({ kind: 'admin', email: 'ops@example.org', password: 'a-long-passphrase' });
  });

  it('refuses to start production without a strong first administrator password', () => {
    expect(() => userSeedPlan({ nodeEnv: 'production', demo: false })).toThrow(
      /ADMIN_EMAIL and ADMIN_PASSWORD/,
    );
    expect(() =>
      userSeedPlan({ nodeEnv: 'production', demo: false, adminEmail: 'a@b.co', adminPassword: 'short' }),
    ).toThrow(/at least 12/);
  });
});
